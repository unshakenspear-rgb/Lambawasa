<?php
require_once __DIR__ . '/db.php';

$pdo = getDBConnection();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET' && ($_GET['action'] ?? '') === 'scheduled') {
    $today = new DateTimeImmutable('today');
    $force = ($_GET['force'] ?? '') === '1';

    if ((int)$today->format('j') !== 25 && !$force) {
        sendJsonResponse([
            'success' => true,
            'scheduled' => false,
            'message' => 'Automatic billing runs on the 25th of each month.'
        ]);
    }

    $runKey = $today->format('Y-m');
    $billingPeriod = $today->format('F 1, Y') . ' - ' . $today->format('F t, Y');
    $dueDate = $today->modify('+15 days')->format('Y-m-d');

    try {
        $pdo->beginTransaction();
        $claim = $pdo->prepare('INSERT IGNORE INTO billing_runs (run_key, billing_period, run_date) VALUES (?, ?, ?)');
        $claim->execute([$runKey, $billingPeriod, $today->format('Y-m-d')]);

        if ($claim->rowCount() === 0) {
            $pdo->commit();
            sendJsonResponse(['success' => true, 'scheduled' => true, 'already_processed' => true, 'run_key' => $runKey]);
        }

        $consumers = $pdo->query("SELECT id, account_no, full_name, classification, last_reading
            FROM consumers WHERE status IN ('Active', 'Overdue') AND approval_status = 'Approved'")->fetchAll();
        $latestBill = $pdo->prepare('SELECT pres_reading FROM bills WHERE consumer_id = ? ORDER BY id DESC LIMIT 1');
        $insertBill = $pdo->prepare("INSERT INTO bills
            (bill_no, consumer_id, billing_period, prev_reading, pres_reading, consumption_cum, base_amount, env_fee, maint_fee, arrears, penalty, total_amount, status, due_date, days_overdue)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Ready', ?, 0)");
        $updateConsumer = $pdo->prepare('UPDATE consumers SET last_reading = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
        $insertNotification = $pdo->prepare("INSERT INTO notifications
            (notification_code, type, recipient_name, account_no, message, channel, status)
            VALUES (?, 'Billing Notice', ?, ?, ?, 'System Push', 'Sent')");
        $inserted = 0;
        $notifications = 0;

        foreach ($consumers as $consumer) {
            $latestBill->execute([$consumer['id']]);
            $previous = $latestBill->fetchColumn();
            $previous = $previous === false ? 0 : (float)$previous;
            $present = max($previous, (float)($consumer['last_reading'] ?? 0));
            $consumption = max(0, $present - $previous);
            $base = round($consumption * 10, 2);
            $envFee = round($base * 0.10, 2);
            $maintFee = 2.00;
            $total = round($base + $envFee + $maintFee, 2);
            $billNo = 'WS-' . $today->format('Ym') . '-' . str_pad((string)$consumer['id'], 4, '0', STR_PAD_LEFT);

            $insertBill->execute([$billNo, $consumer['id'], $billingPeriod, $previous, $present, $consumption, $base, $envFee, $maintFee, 0, 0, $total, $dueDate]);
            $updateConsumer->execute([$present, $consumer['id']]);
            $insertNotification->execute([
                'NTF-' . $today->format('Ymd') . '-' . str_pad((string)$consumer['id'], 4, '0', STR_PAD_LEFT),
                $consumer['full_name'],
                $consumer['account_no'],
                "Your water bill for {$billingPeriod} is ready. Total due: PHP " . number_format($total, 2) . ". Due {$dueDate}."
            ]);
            $inserted++;
            $notifications++;
        }

        $complete = $pdo->prepare("UPDATE billing_runs SET inserted_count = ?, notification_count = ?, status = 'Completed', completed_at = NOW() WHERE run_key = ?");
        $complete->execute([$inserted, $notifications, $runKey]);
        $pdo->commit();
        sendJsonResponse(['success' => true, 'scheduled' => true, 'run_key' => $runKey, 'inserted_count' => $inserted, 'notification_count' => $notifications]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        sendJsonResponse(['success' => false, 'error' => $e->getMessage()], 500);
    }
}

if ($method === 'GET') {
    $stmt = $pdo->query("SELECT * FROM bills ORDER BY id DESC");
    sendJsonResponse(['success' => true, 'data' => $stmt->fetchAll()]);
}

if ($method === 'PUT') {
    $input = getJsonInput();
    $billNo = trim((string)($input['billId'] ?? ''));
    $actorName = trim((string)($input['actorName'] ?? ''));
    $actorRole = trim((string)($input['actorRole'] ?? ''));
    $addedArrearsInput = $input['addedArrears'] ?? 0;
    $penaltyAmountInput = $input['penaltyAmount'] ?? 0;
    if (!is_numeric($addedArrearsInput) || !is_numeric($penaltyAmountInput)) {
        sendJsonResponse(['success' => false, 'error' => 'Arrears and penalty amounts must be valid numbers.'], 400);
    }
    $addedArrears = round((float)$addedArrearsInput, 2);
    $penaltyAmount = round((float)$penaltyAmountInput, 2);
    $reason = trim((string)($input['reason'] ?? ''));
    $requestedDueDate = trim((string)($input['newDueDate'] ?? ''));

    if (!in_array($actorRole, ['President', 'Administrator'], true)) {
        sendJsonResponse(['success' => false, 'error' => 'Only the President or Administrator can adjust bill arrears.'], 403);
    }
    if ($billNo === '' || $actorName === '') {
        sendJsonResponse(['success' => false, 'error' => 'Bill and President details are required.'], 400);
    }
    if (!is_finite($addedArrears) || $addedArrears < 0 || !is_finite($penaltyAmount) || $penaltyAmount < 0) {
        sendJsonResponse(['success' => false, 'error' => 'Arrears and penalty amounts must be valid non-negative amounts.'], 400);
    }
    if ($requestedDueDate !== '') {
        $parsedDueDate = DateTimeImmutable::createFromFormat('!Y-m-d', $requestedDueDate);
        if (!$parsedDueDate || $parsedDueDate->format('Y-m-d') !== $requestedDueDate) {
            sendJsonResponse(['success' => false, 'error' => 'A valid statement due date is required.'], 400);
        }
    }

    try {
        $pdo->beginTransaction();
        $billStmt = $pdo->prepare("
            SELECT b.id, b.bill_no, b.consumer_id, b.billing_period, b.prev_reading, b.pres_reading,
                b.consumption_cum, b.base_amount, b.env_fee, b.maint_fee, b.arrears, b.penalty,
                b.total_amount, b.status, b.due_date, b.days_overdue, c.full_name, c.account_no
            FROM bills b
            JOIN consumers c ON c.id = b.consumer_id
            WHERE b.bill_no = ?
            LIMIT 1
            FOR UPDATE
        ");
        $billStmt->execute([$billNo]);
        $bill = $billStmt->fetch();
        if (!$bill) {
            $pdo->rollBack();
            sendJsonResponse(['success' => false, 'error' => 'Bill was not found.'], 404);
        }
        if (!in_array($bill['status'], ['Ready', 'Overdue'], true)) {
            $pdo->rollBack();
            sendJsonResponse(['success' => false, 'error' => 'Only an unpaid bill can be adjusted.'], 409);
        }

        $newArrears = round((float)$bill['arrears'] + $addedArrears, 2);
        $dueDate = $requestedDueDate !== '' ? $requestedDueDate : $bill['due_date'];
        $dueDay = $dueDate ? (int)date('j', strtotime($dueDate)) : 0;
        $isOverdue = $dueDay > 25;
        $statutoryPenalty = round(((float)$bill['base_amount'] + $newArrears) * 0.10, 2);
        $newPenalty = $isOverdue ? max($statutoryPenalty, $penaltyAmount) : $penaltyAmount;
        $newTotal = round(
            (float)$bill['base_amount'] + (float)$bill['env_fee'] + (float)$bill['maint_fee'] + $newArrears + $newPenalty,
            2
        );
        $newStatus = $isOverdue ? 'Overdue' : ($bill['status'] === 'Overdue' ? 'Ready' : $bill['status']);
        $newDaysOverdue = $isOverdue
            ? max((int)$bill['days_overdue'], max(0, $dueDay - 25))
            : 0;

        $update = $pdo->prepare("
            UPDATE bills
            SET arrears = ?, penalty = ?, total_amount = ?, due_date = ?, status = ?, days_overdue = ?
            WHERE id = ?
        ");
        $update->execute([
            $newArrears,
            $newPenalty,
            $newTotal,
            $dueDate,
            $newStatus,
            $newDaysOverdue,
            $bill['id'],
        ]);

        $audit = $pdo->prepare("
            INSERT INTO audit_trail
                (log_code, user_id, user_name, user_role, category, action, target_entity, details, ip_address)
            VALUES (?, NULL, ?, ?, 'Billing', 'Updated Bill Arrears', ?, ?, ?)
        ");
        $audit->execute([
            'AUD-ARR-' . strtoupper(bin2hex(random_bytes(6))),
            $actorName,
            $actorRole,
            $billNo . ' (' . $bill['account_no'] . ')',
            'Added PHP ' . number_format($addedArrears, 2) . ' arrears. New arrears: PHP ' .
                number_format($newArrears, 2) . ', penalty: PHP ' . number_format($newPenalty, 2) .
                ', updated total: PHP ' . number_format($newTotal, 2) . '. Reason: ' .
                ($reason !== '' ? $reason : 'President billing adjustment') . '.',
            $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1',
        ]);

        $pdo->commit();
        sendJsonResponse([
            'success' => true,
            'message' => 'Arrears and bill total were updated successfully.',
            'data' => [
                'id' => $bill['bill_no'],
                'accountNo' => $bill['account_no'],
                'name' => $bill['full_name'],
                'period' => $bill['billing_period'],
                'prevReading' => (float)$bill['prev_reading'],
                'presReading' => (float)$bill['pres_reading'],
                'consumption' => (float)$bill['consumption_cum'],
                'baseAmount' => (float)$bill['base_amount'],
                'envFee' => (float)$bill['env_fee'],
                'maintFee' => (float)$bill['maint_fee'],
                'arrears' => $newArrears,
                'penalty' => $newPenalty,
                'totalAmount' => $newTotal,
                'status' => $newStatus,
                'dueDate' => $dueDate,
                'daysOverdue' => $newDaysOverdue,
            ],
        ]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        sendJsonResponse(['success' => false, 'error' => $e->getMessage()], 500);
    }
}

if ($method === 'DELETE') {
    $input = getJsonInput();
    $billNo = trim((string)($input['billId'] ?? ''));
    $actorName = trim((string)($input['actorName'] ?? ''));
    $actorRole = trim((string)($input['actorRole'] ?? ''));

    if ($actorRole !== 'President') {
        sendJsonResponse(['success' => false, 'error' => 'Only the President can remove consumer bills.'], 403);
    }
    if ($billNo === '' || $actorName === '') {
        sendJsonResponse(['success' => false, 'error' => 'Bill and President details are required.'], 400);
    }

    try {
        $pdo->beginTransaction();
        $billStmt = $pdo->prepare("
            SELECT b.id, b.bill_no, b.total_amount, b.status, c.full_name, c.account_no
            FROM bills b
            JOIN consumers c ON c.id = b.consumer_id
            WHERE b.bill_no = ?
            LIMIT 1
            FOR UPDATE
        ");
        $billStmt->execute([$billNo]);
        $bill = $billStmt->fetch();
        if (!$bill) {
            $pdo->rollBack();
            sendJsonResponse(['success' => false, 'error' => 'Bill was not found.'], 404);
        }

        $paymentStmt = $pdo->prepare('SELECT COUNT(*) AS payment_count, COALESCE(SUM(amount_paid), 0) AS paid_amount FROM payments WHERE bill_id = ?');
        $paymentStmt->execute([$bill['id']]);
        $paymentSummary = $paymentStmt->fetch();

        $deletePayments = $pdo->prepare('DELETE FROM payments WHERE bill_id = ?');
        $deletePayments->execute([$bill['id']]);
        $deleteBill = $pdo->prepare('DELETE FROM bills WHERE id = ?');
        $deleteBill->execute([$bill['id']]);

        $audit = $pdo->prepare("
            INSERT INTO audit_trail
                (log_code, user_id, user_name, user_role, category, action, target_entity, details, ip_address)
            VALUES (?, NULL, ?, 'President', 'Billing', 'Removed Consumer Bill', ?, ?, ?)
        ");
        $audit->execute([
            'AUD-DEL-' . strtoupper(bin2hex(random_bytes(8))),
            $actorName,
            $bill['bill_no'] . ' (' . $bill['account_no'] . ')',
            'Removed ' . $bill['status'] . ' bill for ' . $bill['full_name'] . '. Amount: PHP ' .
                number_format((float)$bill['total_amount'], 2) . '. Linked payment records removed: ' .
                (int)$paymentSummary['payment_count'] . ', total paid: PHP ' .
                number_format((float)$paymentSummary['paid_amount'], 2) . '.',
            $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1',
        ]);

        $pdo->commit();
        sendJsonResponse([
            'success' => true,
            'billId' => $bill['bill_no'],
            'deletedPayments' => (int)$paymentSummary['payment_count'],
        ]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        sendJsonResponse(['success' => false, 'error' => $e->getMessage()], 500);
    }
}

if ($method === 'POST') {
    $input = getJsonInput();
    $action = $input['action'] ?? 'single';

    if ($action === 'batch') {
        sendJsonResponse([
            'success' => false,
            'error' => 'Batch bills cannot be created from unreviewed meter readings. Submit readings for Office Staff approval first.'
        ], 403);
    }

    $approvedReadingCode = trim((string)($input['approvedReadingId'] ?? ''));
    if ($approvedReadingCode === '') {
        sendJsonResponse([
            'success' => false,
            'error' => 'Bill statements must be created through the Office Staff meter-reading approval workflow.'
        ], 403);
    }
    $approvedReadingStmt = $pdo->prepare("
        SELECT status, bill_id, consumer_id, previous_reading, current_reading
        FROM meter_readings
        WHERE reading_code = ?
    ");
    $approvedReadingStmt->execute([$approvedReadingCode]);
    $approvedReading = $approvedReadingStmt->fetch();
    if (
        !$approvedReading
        || $approvedReading['status'] !== 'Approved'
        || $approvedReading['bill_id'] !== null
        || (float)$approvedReading['previous_reading'] !== (float)($input['prevReading'] ?? -1)
        || (float)$approvedReading['current_reading'] !== (float)($input['presReading'] ?? -1)
    ) {
        sendJsonResponse([
            'success' => false,
            'error' => 'The meter reading has not been approved or has already been billed.'
        ], 403);
    }

    try {
        $pdo->beginTransaction();

        if ($action === 'batch') {
            $billsList = $input['bills'] ?? [];
            $inserted = 0;

            foreach ($billsList as $b) {
                // Find consumer db id
                $cCode = $b['consumerId'] ?? '';
                $cStmt = $pdo->prepare("SELECT id FROM consumers WHERE consumer_code = ? OR account_no = ?");
                $cStmt->execute([$cCode, $b['accountNo'] ?? '']);
                $cRow = $cStmt->fetch();
                $cDbId = $cRow ? $cRow['id'] : null;

                if (!$cDbId) continue;

                $ins = $pdo->prepare("
                    INSERT INTO bills (bill_no, consumer_id, billing_period, prev_reading, pres_reading, consumption_cum, base_amount, env_fee, maint_fee, arrears, penalty, total_amount, status, due_date, days_overdue)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
                ");
                $ins->execute([
                    $b['id'],
                    $cDbId,
                    $b['period'] ?? 'Aug 01 – Aug 31, 2026',
                    $b['prevReading'] ?? 0,
                    $b['presReading'] ?? 0,
                    $b['consumption'] ?? 0,
                    $b['baseAmount'] ?? 0,
                    $b['envFee'] ?? 0,
                    $b['maintFee'] ?? 0,
                    $b['arrears'] ?? 0,
                    $b['penalty'] ?? 0,
                    $b['totalAmount'] ?? 0,
                    $b['status'] ?? 'Ready',
                    $b['dueDate'] ?? date('Y-m-d', strtotime('+15 days'))
                ]);

                // Update consumer last_reading
                $updLast = $pdo->prepare("UPDATE consumers SET last_reading = ? WHERE id = ?");
                $updLast->execute([$b['presReading'] ?? 0, $cDbId]);

                $inserted++;
            }

            // Audit
            $insAudit = $pdo->prepare("
                INSERT INTO audit_trail (log_code, user_id, user_name, user_role, category, action, target_entity, details, ip_address)
                VALUES (?, 1, 'Jamie Dizon', 'Administrator', 'Billing', 'Batch Bill Generation Run', ?, ?, ?)
            ");
            $logCode = 'AUD-' . rand(1000, 9999);
            $cycle = $input['cycle'] ?? 'Current Cycle';
            $insAudit->execute([
                $logCode,
                $cycle,
                "Batch billing run completed. Inserted {$inserted} billing statements.",
                $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1'
            ]);

            $pdo->commit();
            sendJsonResponse(['success' => true, 'inserted_count' => $inserted]);
        } else {
            // Single bill creation
            $cCode = $input['consumerId'] ?? '';
            $cStmt = $pdo->prepare("SELECT id FROM consumers WHERE consumer_code = ? OR account_no = ?");
            $cStmt->execute([$cCode, $input['accountNo'] ?? '']);
            $cRow = $cStmt->fetch();
            $cDbId = $cRow ? $cRow['id'] : null;

            if (!$cDbId) {
                // Fallback to first consumer
                $first = $pdo->query("SELECT id FROM consumers LIMIT 1")->fetch();
                $cDbId = $first['id'];
            }

            $billNo = $input['id'] ?? ('WS-' . rand(240000, 250000));
            $ins = $pdo->prepare("
                INSERT INTO bills (bill_no, consumer_id, billing_period, prev_reading, pres_reading, consumption_cum, base_amount, env_fee, maint_fee, arrears, penalty, total_amount, status, due_date, days_overdue)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
            ");
            $ins->execute([
                $billNo,
                $cDbId,
                $input['period'] ?? 'Sep 01 – Sep 30, 2026',
                $input['prevReading'] ?? 0,
                $input['presReading'] ?? 0,
                $input['consumption'] ?? 0,
                $input['baseAmount'] ?? 0,
                $input['envFee'] ?? 0,
                $input['maintFee'] ?? 0,
                $input['arrears'] ?? 0,
                $input['penalty'] ?? 0,
                $input['totalAmount'] ?? 0,
                $input['status'] ?? 'Ready',
                $input['dueDate'] ?? date('Y-m-d', strtotime('+15 days'))
            ]);
            $billDbId = $pdo->lastInsertId();

            // Update consumer last reading
            $updLast = $pdo->prepare("UPDATE consumers SET last_reading = ? WHERE id = ?");
            $updLast->execute([$input['presReading'] ?? 0, $cDbId]);

            // Audit
            $insAudit = $pdo->prepare("
                INSERT INTO audit_trail (log_code, user_id, user_name, user_role, category, action, target_entity, details, ip_address)
                VALUES (?, 1, 'Jamie Dizon', 'Billing Officer', 'Billing', 'Calculated & Queued Bill Statement', ?, ?, ?)
            ");
            $logCode = 'AUD-' . rand(1000, 9999);
            $insAudit->execute([
                $logCode,
                "{$billNo} ({$input['name']})",
                "Queued billing statement. Total payable: ₱ " . number_format((float)$input['totalAmount'], 2),
                $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1'
            ]);

            $pdo->commit();
            sendJsonResponse(['success' => true, 'id' => $billNo, 'dbId' => $billDbId]);
        }
    } catch (Exception $e) {
        $pdo->rollBack();
        sendJsonResponse(['success' => false, 'error' => $e->getMessage()], 500);
    }
}

sendJsonResponse(['success' => false, 'error' => 'Method not supported'], 405);
