<?php
require_once __DIR__ . '/db.php';

$pdo = getDBConnection();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $pdo->query("SELECT * FROM payments ORDER BY id DESC");
    sendJsonResponse(['success' => true, 'data' => $stmt->fetchAll()]);
}

if ($method === 'POST') {
    $input = getJsonInput();

    $billNo = $input['billId'] ?? '';
    $orNumber = $input['orNumber'] ?? ('OR-' . date('Y') . '-' . rand(1000, 9999));
    $consumerIdCode = $input['consumerId'] ?? '';
    $amountPaid = (float)($input['amountPaid'] ?? 0);
    $tendered = (float)($input['tendered'] ?? $amountPaid);
    $change = (float)($input['change'] ?? 0);
    $method = $input['method'] ?? 'Cash';
    $notes = $input['notes'] ?? 'Over-the-counter bill settlement.';
    $cashierName = $input['cashier'] ?? 'Counter Cashier Alpha';
    $allowedMethods = ['Cash', 'GCash', 'Maya', 'Bank Transfer'];

    try {
        if ($billNo === '' || $orNumber === '' || $amountPaid <= 0) {
            sendJsonResponse(['success' => false, 'error' => 'A bill, receipt number, and positive payment amount are required.'], 400);
        }
        if (!in_array($method, $allowedMethods, true)) {
            sendJsonResponse(['success' => false, 'error' => 'Unsupported payment method.'], 400);
        }

        $pdo->beginTransaction();

        $bStmt = $pdo->prepare("SELECT id, consumer_id, status, total_amount FROM bills WHERE bill_no = ? FOR UPDATE");
        $bStmt->execute([$billNo]);
        $billRow = $bStmt->fetch();

        if (!$billRow) {
            $pdo->rollBack();
            sendJsonResponse(['success' => false, 'error' => 'The bill was not found. No payment was recorded.'], 404);
        }
        if (!in_array($billRow['status'], ['Ready', 'Overdue', 'Paid'], true)) {
            $pdo->rollBack();
            sendJsonResponse(['success' => false, 'error' => 'This bill is not available for payment.'], 409);
        }
        $gatewayReference = trim((string)($input['gatewayReference'] ?? ''));
        if ($gatewayReference !== '') {
            $existingPayment = $pdo->prepare("
                SELECT id, or_number, amount_paid
                FROM payments
                WHERE bill_id = ? AND notes LIKE ?
                LIMIT 1
            ");
            $existingPayment->execute([
                $billRow['id'],
                '%PayMongo Checkout verified settlement (' . $gatewayReference . ').%',
            ]);
            $existing = $existingPayment->fetch();
            if ($existing) {
                $paidSummary = $pdo->prepare('SELECT COALESCE(SUM(amount_paid), 0) FROM payments WHERE bill_id = ?');
                $paidSummary->execute([$billRow['id']]);
                $paidTotal = (float)$paidSummary->fetchColumn();
                $remainingAmount = max(0, round((float)$billRow['total_amount'] - $paidTotal, 2));
                $status = $remainingAmount <= 0 ? 'Paid' : $billRow['status'];
                if ($status === 'Paid' && $billRow['status'] !== 'Paid') {
                    $settleBill = $pdo->prepare("
                        UPDATE bills
                        SET status = 'Paid', paid_date = NOW(), days_overdue = 0, penalty = 0
                        WHERE id = ? AND status IN ('Ready', 'Overdue')
                    ");
                    $settleBill->execute([$billRow['id']]);
                    if ($settleBill->rowCount() !== 1) {
                        throw new RuntimeException('Bill status changed before payment could be committed.');
                    }
                }
                $pdo->commit();
                sendJsonResponse([
                    'success' => true,
                    'message' => 'This PayMongo payment was already recorded.',
                    'data' => [
                        'id' => $existing['id'],
                        'orNumber' => $existing['or_number'],
                        'billId' => $billNo,
                        'amountPaid' => (float)$existing['amount_paid'],
                        'billTotal' => (float)$billRow['total_amount'],
                        'remainingAmount' => $remainingAmount,
                        'status' => $status,
                        'alreadyRecorded' => true,
                    ],
                ]);
            }
        }

        if ($billRow['status'] === 'Paid') {
            $pdo->rollBack();
            sendJsonResponse(['success' => false, 'error' => 'This bill is already paid.'], 409);
        }

        $paidSummary = $pdo->prepare('SELECT COALESCE(SUM(amount_paid), 0) FROM payments WHERE bill_id = ?');
        $paidSummary->execute([$billRow['id']]);
        $paidBefore = (float)$paidSummary->fetchColumn();
        $totalAmount = (float)$billRow['total_amount'];
        $remainingBefore = max(0, round($totalAmount - $paidBefore, 2));
        if ((int)round($amountPaid * 100) > (int)round($remainingBefore * 100)) {
            $pdo->rollBack();
            sendJsonResponse(['success' => false, 'error' => 'Payment amount exceeds the remaining bill balance. No payment was recorded.'], 409);
        }
        $billDbId = $billRow['id'];
        $consumerDbId = $billRow['consumer_id'];
        $remainingAfter = max(0, round($remainingBefore - $amountPaid, 2));
        $billStatusAfter = $remainingAfter <= 0 ? 'Paid' : $billRow['status'];

        // 1. Insert payment record
        $insPay = $pdo->prepare("
            INSERT INTO payments (or_number, bill_id, consumer_id, cashier_id, amount_paid, tendered_amount, change_amount, payment_method, payment_date, notes)
            VALUES (?, ?, ?, 1, ?, ?, ?, ?, NOW(), ?)
        ");
        $insPay->execute([
            $orNumber,
            $billDbId,
            $consumerDbId,
            $amountPaid,
            $tendered,
            $change,
            $method,
            $notes
        ]);
        $paymentId = $pdo->lastInsertId();

        // 2. Update outstanding balance status
        if ($billDbId && $billStatusAfter === 'Paid') {
            $updBill = $pdo->prepare("
                UPDATE bills
                SET status = 'Paid', paid_date = NOW(), days_overdue = 0, penalty = 0 
                WHERE id = ? AND status IN ('Ready', 'Overdue')
            ");
            $updBill->execute([$billDbId]);
            if ($updBill->rowCount() !== 1) {
                throw new RuntimeException('Bill status changed before payment could be committed.');
            }
        }

        // 3. Update consumer status if they were overdue
        if ($consumerDbId) {
            // Check if consumer has other unpaid bills
            $chkOverdue = $pdo->prepare("SELECT COUNT(*) as c FROM bills WHERE consumer_id = ? AND status = 'Overdue' AND id != ?");
            $chkOverdue->execute([$consumerDbId, $billDbId ?? 0]);
            $otherOverdue = (int)$chkOverdue->fetch()['c'];

            if ($otherOverdue === 0 && $billStatusAfter === 'Paid') {
                $updConsumer = $pdo->prepare("UPDATE consumers SET status = 'Active' WHERE id = ?");
                $updConsumer->execute([$consumerDbId]);

                $updGeo = $pdo->prepare("UPDATE geo_connections SET status = 'Normal' WHERE consumer_id = ?");
                $updGeo->execute([$consumerDbId]);
            }
        }

        // 4. Log in Audit Trail
        $insAudit = $pdo->prepare("
            INSERT INTO audit_trail (log_code, user_id, user_name, user_role, category, action, target_entity, details, ip_address)
            VALUES (?, 1, ?, 'Cashier / POS', 'Payment', 'Processed Counter Payment', ?, ?, ?)
        ");
        $logCode = 'AUD-' . rand(1000, 9999);
        $insAudit->execute([
            $logCode,
            $cashierName,
            "{$orNumber} / Bill {$billNo}",
            "Received ₱ " . number_format($amountPaid, 2) . " via {$method}. Remaining balance: ₱ " .
                number_format($remainingAfter, 2) . ". Bill status: {$billStatusAfter}.",
            $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1'
        ]);

        $pdo->commit();

        sendJsonResponse([
            'success' => true,
            'message' => 'Payment processed and committed to database successfully.',
            'data' => [
                'id' => $paymentId,
                'orNumber' => $orNumber,
                'billId' => $billNo,
                'amountPaid' => $amountPaid,
                'billTotal' => $totalAmount,
                'method' => $method,
                'remainingAmount' => $remainingAfter,
                'status' => $billStatusAfter,
            ]
        ]);
    } catch (Exception $e) {
        $pdo->rollBack();
        sendJsonResponse(['success' => false, 'error' => $e->getMessage()], 500);
    }
}

sendJsonResponse(['success' => false, 'error' => 'Method not supported'], 405);
