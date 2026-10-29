<?php
require_once __DIR__ . '/db.php';

$pdo = getDBConnection();
$method = $_SERVER['REQUEST_METHOD'];

function formatMeterReading(array $row): array {
    return [
        'id' => $row['reading_code'],
        'consumerId' => $row['consumer_code'],
        'consumerName' => $row['full_name'],
        'accountNo' => $row['account_no'],
        'zone' => $row['zone'],
        'meterSerial' => $row['meter_serial'],
        'classification' => $row['classification'],
        'previousReading' => (float)$row['previous_reading'],
        'currentReading' => (float)$row['current_reading'],
        'recordedAt' => $row['created_at'],
        'recordedBy' => $row['recorded_by_name'],
        'status' => $row['status'] === 'Pending' ? 'Pending Office Confirmation' : $row['status'],
        'reviewedBy' => $row['reviewed_by_name'],
        'reviewedAt' => $row['reviewed_at'],
        'billId' => $row['bill_no'] ?? null,
    ];
}

if ($method === 'GET') {
    $stmt = $pdo->query("
        SELECT r.*, c.consumer_code, c.account_no, c.full_name, c.zone, b.bill_no
        FROM meter_readings r
        JOIN consumers c ON c.id = r.consumer_id
        LEFT JOIN bills b ON b.id = r.bill_id
        ORDER BY r.created_at DESC, r.id DESC
    ");
    sendJsonResponse(['success' => true, 'data' => array_map('formatMeterReading', $stmt->fetchAll())]);
}

$input = getJsonInput();
$actorRole = trim((string)($input['actorRole'] ?? ''));
$actorName = trim((string)($input['actorName'] ?? ''));

if ($method === 'POST') {
    if (($input['action'] ?? '') === 'president-correction') {
        if ($actorRole !== 'President') {
            sendJsonResponse(['success' => false, 'error' => 'Only the President can directly correct official meter readings.'], 403);
        }

        $consumerCode = trim((string)($input['consumerId'] ?? ''));
        $previousInput = $input['previousReading'] ?? null;
        $currentInput = $input['currentReading'] ?? null;
        if (
            $consumerCode === ''
            || $actorName === ''
            || !is_numeric($previousInput)
            || !is_numeric($currentInput)
            || !is_finite((float)$previousInput)
            || !is_finite((float)$currentInput)
            || (float)$previousInput < 0
            || (float)$currentInput < (float)$previousInput
        ) {
            sendJsonResponse(['success' => false, 'error' => 'A consumer, valid previous reading, present reading, and President name are required.'], 400);
        }

        try {
            $pdo->beginTransaction();
            $consumerStmt = $pdo->prepare("
                SELECT id, consumer_code, account_no, full_name, zone, classification, meter_serial, last_reading
                FROM consumers
                WHERE consumer_code = ? OR account_no = ?
                LIMIT 1
                FOR UPDATE
            ");
            $consumerStmt->execute([$consumerCode, $consumerCode]);
            $consumer = $consumerStmt->fetch();
            if (!$consumer) {
                $pdo->rollBack();
                sendJsonResponse(['success' => false, 'error' => 'Consumer account was not found.'], 404);
            }

            $pendingStmt = $pdo->prepare("SELECT id FROM meter_readings WHERE consumer_id = ? AND status = 'Pending' LIMIT 1");
            $pendingStmt->execute([$consumer['id']]);
            if ($pendingStmt->fetch()) {
                $pdo->rollBack();
                sendJsonResponse(['success' => false, 'error' => 'This consumer has a reading waiting for Office Staff approval. Resolve it before making a President correction.'], 409);
            }

            $previous = (float)$previousInput;
            $current = (float)$currentInput;
            $consumption = round($current - $previous, 2);
            $baseAmount = round($consumption * 10, 2);
            $envFee = round($baseAmount * 0.10, 2);
            $maintFee = 2.00;
            $arrears = 0;
            $overdueStmt = $pdo->prepare("
                SELECT base_amount, arrears
                FROM bills
                WHERE consumer_id = ? AND status = 'Overdue'
                ORDER BY id DESC
                LIMIT 1
            ");
            $overdueStmt->execute([$consumer['id']]);
            $overdueBill = $overdueStmt->fetch();
            $penalty = $overdueBill
                ? round(((float)$overdueBill['base_amount'] + (float)$overdueBill['arrears']) * 0.10, 2)
                : 0;
            $totalAmount = round($baseAmount + $envFee + $maintFee + $arrears + $penalty, 2);
            $today = new DateTimeImmutable('today');
            $billingPeriod = $today->modify('first day of this month')->format('M d') . ' – ' . $today->modify('last day of this month')->format('M d, Y');
            $dueDate = $today->modify('+15 days')->format('Y-m-d');

            $periodStart = $today->modify('first day of this month')->format('Y-m-01');
            $nextPeriodStart = $today->modify('first day of next month')->format('Y-m-01');
            $currentBillStmt = $pdo->prepare("
                SELECT b.id, b.bill_no
                FROM bills b
                WHERE b.consumer_id = ?
                  AND b.status IN ('Ready', 'Overdue')
                  AND b.created_at >= ?
                  AND b.created_at < ?
                  AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.bill_id = b.id)
                ORDER BY b.id DESC
                LIMIT 1
                FOR UPDATE
            ");
            $currentBillStmt->execute([$consumer['id'], $periodStart, $nextPeriodStart]);
            $currentBill = $currentBillStmt->fetch();
            if ($currentBill) {
                $billId = (int)$currentBill['id'];
                $billNo = $currentBill['bill_no'];
                $updateBill = $pdo->prepare("
                    UPDATE bills
                    SET billing_period = ?, prev_reading = ?, pres_reading = ?, consumption_cum = ?,
                        base_amount = ?, env_fee = ?, maint_fee = ?, arrears = ?, penalty = ?,
                        total_amount = ?, status = 'Ready', due_date = ?, days_overdue = 0
                    WHERE id = ?
                ");
                $updateBill->execute([
                    $billingPeriod,
                    $previous,
                    $current,
                    $consumption,
                    $baseAmount,
                    $envFee,
                    $maintFee,
                    $arrears,
                    $penalty,
                    $totalAmount,
                    $dueDate,
                    $billId,
                ]);
            } else {
                $billNo = 'WS-' . $today->format('ymd') . '-' . strtoupper(bin2hex(random_bytes(4)));
                $insertBill = $pdo->prepare("
                    INSERT INTO bills
                        (bill_no, consumer_id, billing_period, prev_reading, pres_reading, consumption_cum,
                         base_amount, env_fee, maint_fee, arrears, penalty, total_amount, status, due_date, days_overdue)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Ready', ?, 0)
                ");
                $insertBill->execute([
                    $billNo,
                    $consumer['id'],
                    $billingPeriod,
                    $previous,
                    $current,
                    $consumption,
                    $baseAmount,
                    $envFee,
                    $maintFee,
                    $arrears,
                    $penalty,
                    $totalAmount,
                    $dueDate,
                ]);
                $billId = (int)$pdo->lastInsertId();
            }

            $readingCode = 'PRES-' . strtoupper(bin2hex(random_bytes(8)));
            $insertReading = $pdo->prepare("
                INSERT INTO meter_readings
                    (reading_code, consumer_id, meter_serial, previous_reading, current_reading, classification,
                     recorded_by_name, status, reviewed_by_name, reviewed_at, bill_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'Approved', ?, CURRENT_TIMESTAMP, ?)
            ");
            $insertReading->execute([
                $readingCode,
                $consumer['id'],
                $consumer['meter_serial'] ?: 'Unassigned',
                $previous,
                $current,
                $consumer['classification'],
                $actorName,
                $actorName,
                $billId,
            ]);

            $updateConsumer = $pdo->prepare('UPDATE consumers SET last_reading = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
            $updateConsumer->execute([$current, $consumer['id']]);

            $audit = $pdo->prepare("
                INSERT INTO audit_trail
                    (log_code, user_id, user_name, user_role, category, action, target_entity, details, ip_address)
                VALUES (?, NULL, ?, 'President', 'Meter', 'President Corrected Meter Reading and Generated Bill', ?, ?, ?)
            ");
            $audit->execute([
                'AUD-CORR-' . strtoupper(bin2hex(random_bytes(7))),
                $actorName,
                $consumer['meter_serial'] . ' (' . $consumer['account_no'] . ')',
                'Corrected previous reading from ' . number_format((float)$consumer['last_reading'], 2) . ' m³ to ' .
                    number_format($previous, 2) . ' m³; recorded present reading ' . number_format($current, 2) .
                    ' m³. Bill ' . $billNo . ' ' . ($currentBill ? 'updated' : 'generated') . ' for PHP ' . number_format($totalAmount, 2) . '.',
                $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1',
            ]);

            $pdo->commit();
            sendJsonResponse([
                'success' => true,
                'readingId' => $readingCode,
                'bill' => [
                    'dbId' => $billId,
                    'id' => $billNo,
                    'consumerId' => $consumer['consumer_code'],
                    'name' => $consumer['full_name'],
                    'accountNo' => $consumer['account_no'],
                    'zone' => $consumer['zone'],
                    'period' => $billingPeriod,
                    'prevReading' => $previous,
                    'presReading' => $current,
                    'consumption' => $consumption,
                    'baseAmount' => $baseAmount,
                    'envFee' => $envFee,
                    'maintFee' => $maintFee,
                    'arrears' => $arrears,
                    'penalty' => $penalty,
                    'totalAmount' => $totalAmount,
                    'status' => 'Ready',
                    'dueDate' => $dueDate,
                    'paidDate' => null,
                    'daysOverdue' => 0,
                    'avatar' => strtoupper(substr($consumer['full_name'], 0, 2)),
                ],
            ]);
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            sendJsonResponse(['success' => false, 'error' => $e->getMessage()], 500);
        }
    }

    if (!in_array($actorRole, ['Field Staffs', 'Office Staffs', 'Cashier', 'President', 'Administrator'], true)) {
        sendJsonResponse(['success' => false, 'error' => 'Only staff can submit meter readings.'], 403);
    }

    $readingCode = trim((string)($input['id'] ?? ''));
    $consumerCode = trim((string)($input['consumerId'] ?? ''));
    $accountNo = trim((string)($input['accountNo'] ?? ''));
    $previous = $input['previousReading'] ?? null;
    $current = $input['currentReading'] ?? null;
    if (
        $readingCode === ''
        || $consumerCode === ''
        || !is_numeric($previous)
        || !is_numeric($current)
        || !is_finite((float)$previous)
        || !is_finite((float)$current)
        || $actorName === ''
    ) {
        sendJsonResponse(['success' => false, 'error' => 'Reading, consumer, and staff details are required.'], 400);
    }

    try {
        $pdo->beginTransaction();
        $consumerStmt = $pdo->prepare("
            SELECT id, consumer_code, account_no, full_name, zone, classification, last_reading
            FROM consumers
            WHERE consumer_code = ? OR account_no = ?
            LIMIT 1
            FOR UPDATE
        ");
        $consumerStmt->execute([$consumerCode, $accountNo]);
        $consumer = $consumerStmt->fetch();
        if (!$consumer) {
            $pdo->rollBack();
            sendJsonResponse(['success' => false, 'error' => 'Consumer account was not found.'], 404);
        }

        $previous = (float)$previous;
        $current = (float)$current;
        $officialPrevious = (float)$consumer['last_reading'];
        if (abs($previous - $officialPrevious) > 0.009 || $current < $officialPrevious) {
            $pdo->rollBack();
            sendJsonResponse([
                'success' => false,
                'error' => "Reading does not match the latest approved value of {$officialPrevious} m³. Refresh the consumer data and try again."
            ], 409);
        }

        $pendingStmt = $pdo->prepare("SELECT id FROM meter_readings WHERE consumer_id = ? AND status = 'Pending' LIMIT 1");
        $pendingStmt->execute([$consumer['id']]);
        if ($pendingStmt->fetch()) {
            $pdo->rollBack();
            sendJsonResponse(['success' => false, 'error' => 'This consumer already has a reading waiting for Office Staff approval.'], 409);
        }

        $classification = $consumer['classification'];
        $meterSerial = trim((string)($input['meterSerial'] ?? 'Unassigned'));
        $insert = $pdo->prepare("
            INSERT INTO meter_readings
                (reading_code, consumer_id, meter_serial, previous_reading, current_reading, classification, recorded_by_name)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ");
        $insert->execute([
            $readingCode,
            $consumer['id'],
            $meterSerial !== '' ? $meterSerial : 'Unassigned',
            $previous,
            $current,
            $classification,
            $actorName,
        ]);

        $readStmt = $pdo->prepare("
            SELECT r.*, c.consumer_code, c.account_no, c.full_name, c.zone, NULL AS bill_no
            FROM meter_readings r
            JOIN consumers c ON c.id = r.consumer_id
            WHERE r.id = ?
        ");
        $readStmt->execute([$pdo->lastInsertId()]);
        $reading = formatMeterReading($readStmt->fetch());
        $pdo->commit();
        sendJsonResponse(['success' => true, 'data' => $reading]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        sendJsonResponse(['success' => false, 'error' => $e->getMessage()], 500);
    }
}

if ($method === 'PUT') {
    if ($actorRole !== 'Office Staffs') {
        sendJsonResponse(['success' => false, 'error' => 'Only Office Staff can approve or reject meter readings.'], 403);
    }

    $readingCode = trim((string)($input['readingId'] ?? ''));
    $decision = trim((string)($input['decision'] ?? ''));
    if ($readingCode === '' || !in_array($decision, ['Approved', 'Rejected'], true) || $actorName === '') {
        sendJsonResponse(['success' => false, 'error' => 'A pending reading, valid decision, and reviewer name are required.'], 400);
    }

    try {
        $pdo->beginTransaction();
        $readingStmt = $pdo->prepare("
            SELECT r.*, c.consumer_code, c.account_no, c.full_name, c.zone, c.last_reading
            FROM meter_readings r
            JOIN consumers c ON c.id = r.consumer_id
            WHERE r.reading_code = ?
            FOR UPDATE
        ");
        $readingStmt->execute([$readingCode]);
        $reading = $readingStmt->fetch();
        if (!$reading || $reading['status'] !== 'Pending') {
            $pdo->rollBack();
            sendJsonResponse(['success' => false, 'error' => 'This reading is no longer pending review.'], 409);
        }

        $billNo = null;
        if ($decision === 'Approved') {
            if (abs((float)$reading['last_reading'] - (float)$reading['previous_reading']) > 0.009) {
                $pdo->rollBack();
                sendJsonResponse(['success' => false, 'error' => 'The consumer reading changed since this record was submitted. Reject and record a fresh reading.'], 409);
            }

            $bill = $input['bill'] ?? [];
            $billNo = trim((string)($bill['id'] ?? ''));
            $previous = (float)$reading['previous_reading'];
            $current = (float)$reading['current_reading'];
            $consumption = $current - $previous;
            $providedPrevious = $bill['prevReading'] ?? null;
            $providedCurrent = $bill['presReading'] ?? null;
            $providedConsumption = $bill['consumption'] ?? null;
            if (
                $billNo === ''
                || strlen($billNo) > 30
                || !is_numeric($providedPrevious)
                || !is_numeric($providedCurrent)
                || !is_numeric($providedConsumption)
                || abs((float)$providedPrevious - $previous) > 0.009
                || abs((float)$providedCurrent - $current) > 0.009
                || abs((float)$providedConsumption - $consumption) > 0.009
            ) {
                $pdo->rollBack();
                sendJsonResponse(['success' => false, 'error' => 'The bill does not match the pending meter reading.'], 400);
            }

            $baseAmount = round($consumption * 10, 2);
            $envFee = round($baseAmount * 0.10, 2);
            $maintFee = 2.00;
            $arrears = 0;
            $overdueStmt = $pdo->prepare("
                SELECT base_amount, arrears
                FROM bills
                WHERE consumer_id = ? AND status = 'Overdue'
                ORDER BY id DESC
                LIMIT 1
            ");
            $overdueStmt->execute([$reading['consumer_id']]);
            $overdueBill = $overdueStmt->fetch();
            $penalty = $overdueBill
                ? round(((float)$overdueBill['base_amount'] + (float)$overdueBill['arrears']) * 0.10, 2)
                : 0;
            $totalAmount = round($baseAmount + $envFee + $maintFee + $arrears + $penalty, 2);
            $dueDate = $bill['dueDate'] ?? date('Y-m-d', strtotime('+15 days'));
            $insertBill = $pdo->prepare("
                INSERT INTO bills
                    (bill_no, consumer_id, billing_period, prev_reading, pres_reading, consumption_cum,
                     base_amount, env_fee, maint_fee, arrears, penalty, total_amount, status, due_date, days_overdue)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Ready', ?, 0)
            ");
            $insertBill->execute([
                $billNo,
                $reading['consumer_id'],
                $bill['period'] ?? date('F 1, Y') . ' - ' . date('F t, Y'),
                $previous,
                $current,
                $consumption,
                $baseAmount,
                $envFee,
                $maintFee,
                $arrears,
                $penalty,
                $totalAmount,
                $dueDate,
            ]);
            $billId = (int)$pdo->lastInsertId();
            $updateConsumer = $pdo->prepare('UPDATE consumers SET last_reading = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
            $updateConsumer->execute([$current, $reading['consumer_id']]);
            $reviewStmt = $pdo->prepare("
                UPDATE meter_readings
                SET status = 'Approved', reviewed_by_name = ?, reviewed_at = CURRENT_TIMESTAMP, bill_id = ?
                WHERE id = ?
            ");
            $reviewStmt->execute([$actorName, $billId, $reading['id']]);
        } else {
            $reviewStmt = $pdo->prepare("
                UPDATE meter_readings
                SET status = 'Rejected', reviewed_by_name = ?, reviewed_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ");
            $reviewStmt->execute([$actorName, $reading['id']]);
        }

        $pdo->commit();
        sendJsonResponse([
            'success' => true,
            'decision' => $decision,
            'billId' => $billNo,
            'bill' => $decision === 'Approved' ? [
                'baseAmount' => $baseAmount,
                'envFee' => $envFee,
                'maintFee' => $maintFee,
                'arrears' => $arrears,
                'penalty' => $penalty,
                'totalAmount' => $totalAmount,
            ] : null,
        ]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        sendJsonResponse(['success' => false, 'error' => $e->getMessage()], 500);
    }
}

sendJsonResponse(['success' => false, 'error' => 'Method not supported.'], 405);
