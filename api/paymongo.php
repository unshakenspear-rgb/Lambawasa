<?php
require_once __DIR__ . '/db.php';

$pdo = getDBConnection();
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

function getPayMongoConfig()
{
    $secretKey = trim((string)getenv('PAYMONGO_SECRET_KEY'));
    if ($secretKey === '') {
        return [
            'success' => false,
            'error' => 'PayMongo is not configured. Set PAYMONGO_SECRET_KEY in the PHP server environment.',
        ];
    }

    if (!preg_match('/^sk_(test|live)_/', $secretKey, $matches)) {
        return [
            'success' => false,
            'error' => 'PAYMONGO_SECRET_KEY must be a PayMongo test or live secret key.',
        ];
    }

    return [
        'success' => true,
        'secretKey' => $secretKey,
        'mode' => $matches[1],
    ];
}

/**
 * Helper to call PayMongo API via cURL
 */
function callPayMongo($endpoint, $payload = null, $httpMethod = 'POST')
{
    $config = getPayMongoConfig();
    if (!$config['success']) {
        return [
            'success' => false,
            'http_code' => 503,
            'error' => $config['error'],
        ];
    }

    $url = 'https://api.paymongo.com/v1/' . ltrim($endpoint, '/');
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_USERPWD, $config['secretKey'] . ':');
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Accept: application/json'
    ]);

    if ($httpMethod === 'POST') {
        curl_setopt($ch, CURLOPT_POST, true);
        if ($payload !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        }
    } elseif ($httpMethod === 'GET') {
        curl_setopt($ch, CURLOPT_HTTPGET, true);
    }

    $rawResponse = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr = curl_error($ch);
    curl_close($ch);

    if ($curlErr) {
        return [
            'success' => false,
            'http_code' => 500,
            'error' => 'Network error connecting to PayMongo: ' . $curlErr
        ];
    }

    $json = json_decode($rawResponse, true);
    if ($httpCode >= 200 && $httpCode < 300) {
        return [
            'success' => true,
            'http_code' => $httpCode,
            'data' => $json['data'] ?? []
        ];
    }

    $errMsg = 'PayMongo request failed';
    if (!empty($json['errors']) && is_array($json['errors'])) {
        $errMsg = $json['errors'][0]['detail'] ?? $errMsg;
    }
    return [
        'success' => false,
        'http_code' => $httpCode,
        'error' => $errMsg,
        'raw' => $json
    ];
}

if ($method === 'GET' && $action === 'config') {
    $config = getPayMongoConfig();
    sendJsonResponse([
        'success' => true,
        'configured' => $config['success'],
        'mode' => $config['mode'] ?? null,
        'error' => $config['error'] ?? null,
    ]);
}

// -------------------------------------------------------------
// 1. CREATE CHECKOUT SESSION
// -------------------------------------------------------------
if ($method === 'POST' && ($action === 'create-checkout' || empty($action))) {
    $input = getJsonInput();

    $billId = trim((string)($input['billId'] ?? ''));
    $accountNo = trim((string)($input['accountNo'] ?? ''));
    if ($billId === '' || $accountNo === '') {
        sendJsonResponse(['success' => false, 'error' => 'A bill and matching consumer account are required.'], 400);
    }

    $billStmt = $pdo->prepare("
        SELECT b.bill_no, b.total_amount, b.status, c.full_name, c.account_no, c.email
        FROM bills b
        JOIN consumers c ON c.id = b.consumer_id
        WHERE b.bill_no = ? AND c.account_no = ?
        LIMIT 1
    ");
    $billStmt->execute([$billId, $accountNo]);
    $bill = $billStmt->fetch();
    if (!$bill) {
        sendJsonResponse(['success' => false, 'error' => 'The bill does not belong to this consumer account.'], 404);
    }
    if (!in_array($bill['status'], ['Ready', 'Overdue'], true)) {
        sendJsonResponse(['success' => false, 'error' => 'Only an unpaid bill can be paid online.'], 409);
    }

    $paymentStmt = $pdo->prepare('
        SELECT COALESCE(SUM(p.amount_paid), 0)
        FROM payments p
        JOIN bills b ON b.id = p.bill_id
        WHERE b.bill_no = ?
    ');
    $paymentStmt->execute([$bill['bill_no']]);
    $paidAmount = (float)$paymentStmt->fetchColumn();

    $amount = max(0, round((float)$bill['total_amount'] - $paidAmount, 2));
    if ($amount <= 0) {
        sendJsonResponse(['success' => false, 'error' => 'This bill is already fully paid.'], 409);
    }
    // PayMongo expects amounts in centavos and does not accept checkout totals under ₱20.
    $amountInCentavos = (int)round($amount * 100);
    if ($amountInCentavos < 2000) {
        sendJsonResponse([
            'success' => false,
            'error' => 'PayMongo requires a minimum checkout of ₱20.00. This bill is below that minimum; pay the exact bill amount at the cashier instead.',
        ], 422);
    }

    $consumerName = $bill['full_name'];
    $consumerEmail = trim((string)($input['consumerEmail'] ?? $bill['email'] ?? ''));
    $description = 'Water Bill Settlement - ' . $bill['bill_no'];

    // Determine return URLs
    $currentHost = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $scheme = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') ? 'https' : 'http';
    $baseUrl = $input['successUrl'] ?? ($scheme . '://' . $currentHost . '/?paymongo_status=success&bill_id=' . urlencode($billId));
    $cancelUrl = $input['cancelUrl'] ?? ($scheme . '://' . $currentHost . '/?paymongo_status=cancelled&bill_id=' . urlencode($billId));

    $consumerPhone = trim($input['consumerPhone'] ?? $input['phone'] ?? $input['contact'] ?? '');

    $billing = [
        'name' => $consumerName,
        'email' => !empty($consumerEmail) && filter_var($consumerEmail, FILTER_VALIDATE_EMAIL) ? $consumerEmail : null,
    ];
    if (!empty($consumerPhone)) {
        $billing['phone'] = $consumerPhone;
    }

    $payload = [
        'data' => [
            'attributes' => [
                'billing' => $billing,
                'send_email_receipt' => true,
                'show_description' => true,
                'show_line_items' => true,
                'line_items' => [
                    [
                        'currency' => 'PHP',
                        'amount' => $amountInCentavos,
                        'name' => 'Lambawasa Water Bill (' . ($billId ?: $accountNo) . ')',
                        'quantity' => 1,
                        'description' => "Account: {$accountNo} | Consumer: {$consumerName}"
                    ]
                ],
                'payment_method_types' => [
                    'gcash',
                    'paymaya',
                    'card',
                    'grab_pay',
                    'dob'
                ],
                'description' => $description,
                'success_url' => $baseUrl,
                'cancel_url' => $cancelUrl,
                'metadata' => [
                    'bill_id' => (string) $billId,
                    'account_no' => (string) $accountNo,
                    'consumer_name' => (string) $consumerName,
                ]
            ]
        ]
    ];

    $result = callPayMongo('checkout_sessions', $payload, 'POST');

    if ($result['success']) {
        $sessionData = $result['data'];
        $checkoutUrl = $sessionData['attributes']['checkout_url'] ?? '';
        $checkoutId = $sessionData['id'] ?? '';

        sendJsonResponse([
            'success' => true,
            'message' => 'PayMongo checkout session initialized successfully.',
            'checkoutUrl' => $checkoutUrl,
            'sessionId' => $checkoutId,
            'amount' => $amount,
            'mode' => getPayMongoConfig()['mode'],
            'data' => $sessionData
        ]);
    } else {
        sendJsonResponse([
            'success' => false,
            'error' => $result['error'] ?? 'Could not initialize PayMongo checkout.',
            'details' => $result
        ], $result['http_code'] ?: 500);
    }
}

// -------------------------------------------------------------
// 2. CHECK CHECKOUT STATUS / VERIFY SESSION
// -------------------------------------------------------------
if ($method === 'GET' && ($action === 'verify' || $action === 'status')) {
    $sessionId = $_GET['session_id'] ?? '';
    if (empty($sessionId)) {
        sendJsonResponse(['success' => false, 'error' => 'session_id is required'], 400);
    }

    $result = callPayMongo('checkout_sessions/' . urlencode($sessionId), null, 'GET');

    if ($result['success']) {
        $attrs = $result['data']['attributes'] ?? [];
        $payments = $attrs['payments'] ?? [];
        $paymentStatus = 'unpaid';
        $paidMethod = 'PayMongo';

        foreach ($payments as $payment) {
            if (!is_array($payment)) {
                continue;
            }
            $paymentAttrs = $payment['attributes'] ?? [];
            if (($paymentAttrs['status'] ?? '') === 'paid') {
                $paymentStatus = 'paid';
                $paidMethod = $paymentAttrs['source']['type'] ?? 'PayMongo';
                break;
            }
        }

        $metadata = $attrs['metadata'] ?? [];
        $billNo = trim((string)($metadata['bill_id'] ?? ''));
        $accountNo = trim((string)($metadata['account_no'] ?? ''));
        $billStmt = $pdo->prepare("
            SELECT b.id, b.total_amount, b.status
            FROM bills b
            JOIN consumers c ON c.id = b.consumer_id
            WHERE b.bill_no = ? AND c.account_no = ?
            LIMIT 1
        ");
        $billStmt->execute([$billNo, $accountNo]);
        $bill = $billStmt->fetch();
        $sessionAmount = (int)($attrs['amount'] ?? 0);
        $amountSource = $sessionAmount > 0 ? 'checkout' : null;
        if ($sessionAmount <= 0) {
            $lineItemAmount = 0;
            foreach (($attrs['line_items'] ?? []) as $lineItem) {
                if (!is_array($lineItem)) {
                    continue;
                }
                $lineAmount = (int)($lineItem['amount'] ?? 0);
                $quantity = max(1, (int)($lineItem['quantity'] ?? 1));
                $lineItemAmount += $lineAmount * $quantity;
            }
            if ($lineItemAmount > 0) {
                $sessionAmount = $lineItemAmount;
                $amountSource = 'line_items';
            }
        }
        if ($sessionAmount <= 0) {
            $paidPaymentAmount = 0;
            foreach ($payments as $payment) {
                if (!is_array($payment)) {
                    continue;
                }
                $paymentAttrs = $payment['attributes'] ?? [];
                if (($paymentAttrs['status'] ?? '') === 'paid') {
                    $paidPaymentAmount += (int)($paymentAttrs['amount'] ?? 0);
                }
            }
            if ($paidPaymentAmount > 0) {
                $sessionAmount = $paidPaymentAmount;
                $amountSource = 'paid_payments';
            }
        }
        $paidTotal = 0.0;
        $alreadyRecorded = false;
        $remainingAmount = 0.0;
        if ($bill) {
            $paidStmt = $pdo->prepare('SELECT COALESCE(SUM(amount_paid), 0) FROM payments WHERE bill_id = ?');
            $paidStmt->execute([$bill['id']]);
            $paidTotal = (float)$paidStmt->fetchColumn();
            $remainingAmount = max(0, round((float)$bill['total_amount'] - $paidTotal, 2));

            $recordedStmt = $pdo->prepare('SELECT 1 FROM payments WHERE bill_id = ? AND notes LIKE ? LIMIT 1');
            $recordedStmt->execute([
                $bill['id'],
                '%PayMongo Checkout verified settlement (' . $sessionId . ').%',
            ]);
            $alreadyRecorded = (bool)$recordedStmt->fetchColumn();
        }
        $amountMatchesBill = $bill
            && $sessionAmount > 0
            && (
                $alreadyRecorded
                || $sessionAmount <= (int)round($remainingAmount * 100)
            );

        sendJsonResponse([
            'success' => true,
            'sessionId' => $sessionId,
            'status' => $paymentStatus,
            'mode' => !empty($attrs['livemode']) ? 'live' : 'test',
            'billId' => $billNo,
            'accountNo' => $accountNo,
            'billFound' => (bool)$bill,
            'billStatus' => $bill['status'] ?? null,
            'amountMatchesBill' => (bool)$amountMatchesBill,
            'amountSource' => $amountSource,
            'sessionAmount' => round($sessionAmount / 100, 2),
            'billTotal' => $bill ? (float)$bill['total_amount'] : null,
            'remainingAmount' => $remainingAmount,
            'alreadyRecorded' => $alreadyRecorded,
            'paymentMethod' => $paidMethod ?? 'PayMongo',
            'payments' => $payments,
            'attributes' => $attrs
        ]);
    } else {
        sendJsonResponse([
            'success' => false,
            'error' => $result['error'] ?? 'Could not verify checkout session.'
        ], $result['http_code'] ?: 500);
    }
}

sendJsonResponse(['success' => false, 'error' => 'Method or action not supported'], 405);
