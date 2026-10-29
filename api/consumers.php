<?php
require_once __DIR__ . '/db.php';

$pdo = getDBConnection();
$method = $_SERVER['REQUEST_METHOD'];

// Self-service registrations store the contact email on the consumer row.
// Keep this compatible with existing XAMPP databases that predate the column.
try {
    $pdo->exec("ALTER TABLE consumers ADD COLUMN email VARCHAR(255) DEFAULT NULL");
} catch (Throwable $ignored) {}

if ($method === 'DELETE') {
    $input = getJsonInput();
    $consumerCode = trim($input['consumerId'] ?? $input['id'] ?? '');
    $actorRole = trim($input['actorRole'] ?? '');

    if ($actorRole !== 'President') {
        sendJsonResponse(['success' => false, 'error' => 'Only the President can remove consumer accounts.'], 403);
    }
    if ($consumerCode === '') {
        sendJsonResponse(['success' => false, 'error' => 'Consumer account is required.'], 400);
    }

    try {
        $pdo->beginTransaction();
        $consumerStmt = $pdo->prepare('SELECT id, full_name, account_no FROM consumers WHERE consumer_code = ? OR id = ? LIMIT 1');
        $consumerStmt->execute([$consumerCode, $consumerCode]);
        $consumer = $consumerStmt->fetch();
        if (!$consumer) {
            $pdo->rollBack();
            sendJsonResponse(['success' => false, 'error' => 'Consumer account not found.'], 404);
        }

        $deletePayments = $pdo->prepare('DELETE FROM payments WHERE consumer_id = ?');
        $deletePayments->execute([$consumer['id']]);
        $deleteBills = $pdo->prepare('DELETE FROM bills WHERE consumer_id = ?');
        $deleteBills->execute([$consumer['id']]);
        $deleteNotifications = $pdo->prepare('DELETE FROM notifications WHERE account_no = ?');
        $deleteNotifications->execute([$consumer['account_no']]);
        $delete = $pdo->prepare('DELETE FROM consumers WHERE id = ?');
        $delete->execute([$consumer['id']]);
        $pdo->commit();

        sendJsonResponse([
            'success' => true,
            'deleted' => [
                'id' => $consumerCode,
                'name' => $consumer['full_name'],
                'accountNo' => $consumer['account_no'],
            ],
        ]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        sendJsonResponse(['success' => false, 'error' => $e->getMessage()], 500);
    }
}

if ($method === 'GET') {
    $stmt = $pdo->query("SELECT * FROM consumers ORDER BY id DESC");
    sendJsonResponse(['success' => true, 'data' => $stmt->fetchAll()]);
}

if ($method === 'POST') {
    $input = getJsonInput();
    
    $name = trim($input['name'] ?? '');
    $accountNo = trim($input['accountNo'] ?? '');
    $username = trim(strtolower($input['username'] ?? ''));
    $email = trim(strtolower($input['email'] ?? ''));
    $contact = trim((string)($input['contact'] ?? ''));
    $address = trim($input['address'] ?? '');
    $zone = trim($input['zone'] ?? '');
    $classification = $input['classification'] ?? 'Residential';
    $meterNo = trim($input['meterNo'] ?? '');
    $connectionDate = $input['connectionDate'] ?? date('Y-m-d');
    $lastReading = (float)($input['lastReading'] ?? 0);
    $status = ($input['status'] ?? 'Active') === 'Pending Approval' ? 'Pending' : ($input['status'] ?? 'Active');
    $approvalStatus = $input['approvalStatus'] ?? ($status === 'Pending' ? 'Pending' : 'Approved');

    if (empty($name) || empty($accountNo) || empty($zone) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        sendJsonResponse(['success' => false, 'error' => 'Name, account, zone, and a valid email address are required.'], 400);
    }

    try {
        $pdo->beginTransaction();

        // Determine consumer_code
        $countStmt = $pdo->query("SELECT COUNT(*) as c FROM consumers");
        $cCount = (int)$countStmt->fetch()['c'];
        $consumerCode = $input['id'] ?? ('C-' . (1001 + $cCount));

        // Check if consumer_code already exists
        $chk = $pdo->prepare("SELECT id FROM consumers WHERE consumer_code = ? OR account_no = ?");
        $chk->execute([$consumerCode, $accountNo]);
        if ($chk->fetch()) {
            // make code unique
            $consumerCode = 'C-' . rand(2000, 9999);
        }

        $insConsumer = $pdo->prepare("
            INSERT INTO consumers (consumer_code, account_no, username, email, full_name, contact_no, service_address, zone, classification, meter_serial, status, approval_status, connection_date, last_reading)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $insConsumer->execute([
            $consumerCode,
            $accountNo,
            $username ?: null,
            $email,
            $name,
            $contact,
            $address,
            $zone,
            $classification,
            $meterNo,
            $status,
            $approvalStatus,
            $connectionDate,
            $lastReading
        ]);
        $consumerDbId = $pdo->lastInsertId();

        // Also create meter asset if serial provided
        if (!empty($meterNo)) {
            $insMeter = $pdo->prepare("
                INSERT INTO meter_assets (serial_no, brand, model, pipe_size, install_date, consumer_id, zone, last_calibration, next_calibration, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $nextCalib = date('Y-m-d', strtotime($connectionDate . ' + 2 years'));
            $insMeter->execute([
                $meterNo,
                'Aquaflow Pro',
                'AF-20-Brass',
                '1/2 inch',
                $connectionDate,
                $consumerDbId,
                $zone,
                $connectionDate,
                $nextCalib,
                'Active'
            ]);
            $meterDbId = $pdo->lastInsertId();

            // Insert initial calibration log
            $insCal = $pdo->prepare("
                INSERT INTO meter_calibrations (meter_id, calibration_date, event_type, technician_name, accuracy_margin, test_result, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ");
            $insCal->execute([
                $meterDbId,
                $connectionDate,
                'Installation',
                'Roberto Ramos',
                '+/- 0.2%',
                'Passed',
                'Newly registered consumer line and meter installed.'
            ]);
        }

        // Add geo connection node
        $insGeo = $pdo->prepare("
            INSERT INTO geo_connections (consumer_id, zone, latitude, longitude, status)
            VALUES (?, ?, ?, ?, ?)
        ");
        $lat = (float)($input['latitude'] ?? $input['serviceCoordinates']['lat'] ?? (14.600000 + (rand(-300, 300) / 10000)));
        $lng = (float)($input['longitude'] ?? $input['serviceCoordinates']['lng'] ?? (121.050000 + (rand(-300, 300) / 10000)));
        $insGeo->execute([$consumerDbId, $zone, $lat, $lng, 'Normal']);

        // Add Audit Trail entry
        $insAudit = $pdo->prepare("
            INSERT INTO audit_trail (log_code, user_id, user_name, user_role, category, action, target_entity, details, ip_address)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $logCode = 'AUD-' . rand(1000, 9999);
        $insAudit->execute([
            $logCode,
            1,
            'Jamie Dizon',
            'Administrator',
            'Consumer',
            'Registered Consumer Profile',
            "{$name} ({$accountNo})",
            "Created profile in {$zone} with assigned meter {$meterNo}.",
            $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1'
        ]);

        $pdo->commit();

        sendJsonResponse([
            'success' => true,
            'message' => 'Consumer created successfully in database',
            'data' => [
                'dbId' => $consumerDbId,
                'id' => $consumerCode,
                'accountNo' => $accountNo,
                'name' => $name,
                'contact' => $contact,
                'address' => $address,
                'zone' => $zone,
                'cluster' => $input['cluster'] ?? null,
                'classification' => $classification,
                'meterNo' => $meterNo,
                'status' => $approvalStatus === 'Pending' ? 'Pending Approval' : $status,
                'approvalStatus' => $approvalStatus,
                'connectionDate' => $connectionDate,
                'lastReading' => $lastReading,
            ]
        ], 201);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        sendJsonResponse(['success' => false, 'error' => $e->getMessage()], 500);
    }
}

if ($method === 'PUT') {
    $input = getJsonInput();
    $consumerCode = trim($input['consumerId'] ?? $input['id'] ?? '');
    $action = $input['action'] ?? 'approval';

    if ($action === 'profile-update') {
        $contact = trim($input['contact'] ?? $input['contactNo'] ?? '');
        $email = trim(strtolower($input['email'] ?? ''));
        $password = trim($input['password'] ?? '');

        if ($consumerCode === '') {
            sendJsonResponse(['success' => false, 'error' => 'Consumer identifier is required.'], 400);
        }

        $fields = [];
        $params = [];

        if ($contact !== '') {
            $fields[] = 'contact_no = ?';
            $params[] = $contact;
        }
        if ($email !== '') {
            $fields[] = 'email = ?';
            $params[] = $email;
        }
        if (isset($input['lastReading'])) {
            $fields[] = 'last_reading = ?';
            $params[] = (float)$input['lastReading'];
        }

        if (!empty($fields)) {
            $params[] = $consumerCode;
            $params[] = $consumerCode;
            $stmt = $pdo->prepare('UPDATE consumers SET ' . implode(', ', $fields) . ' WHERE consumer_code = ? OR account_no = ?');
            $stmt->execute($params);
        }

        // Also update users table if consumer user exists
        $userFields = [];
        $userParams = [];
        if ($contact !== '') {
            $userFields[] = 'contact_no = ?';
            $userParams[] = $contact;
        }
        if ($email !== '') {
            $userFields[] = 'email = ?';
            $userParams[] = $email;
        }
        if (!empty($password)) {
            $userFields[] = 'password_hash = ?';
            $userParams[] = password_hash($password, PASSWORD_BCRYPT);
        }

        if (!empty($userFields)) {
            $accountNo = trim($input['accountNo'] ?? '');
            $username = trim($input['username'] ?? '');
            $userParams[] = $consumerCode;
            $userParams[] = $accountNo ?: $consumerCode;
            $userParams[] = $username ?: $consumerCode;
            $userStmt = $pdo->prepare('UPDATE users SET ' . implode(', ', $userFields) . ' WHERE account_no = ? OR username = ? OR id = ?');
            $userStmt->execute($userParams);
        }

        sendJsonResponse(['success' => true, 'message' => 'Profile updated successfully.']);
    }

    if ($action === 'location-request') {
        $latitude = (float)($input['latitude'] ?? 0);
        $longitude = (float)($input['longitude'] ?? 0);
        if ($consumerCode === '' || !$latitude || !$longitude) {
            sendJsonResponse(['success' => false, 'error' => 'Consumer and requested coordinates are required.'], 400);
        }
        $stmt = $pdo->prepare('UPDATE consumers SET location_approval_status = \'Pending\', requested_latitude = ?, requested_longitude = ? WHERE consumer_code = ?');
        $stmt->execute([$latitude, $longitude, $consumerCode]);
        sendJsonResponse(['success' => true, 'locationApprovalStatus' => 'Pending']);
    }

    if ($action === 'location-decision') {
        $decision = $input['locationApprovalStatus'] ?? '';
        if ($consumerCode === '' || !in_array($decision, ['Approved', 'Rejected'], true)) {
            sendJsonResponse(['success' => false, 'error' => 'Consumer and location decision are required.'], 400);
        }
        if ($decision === 'Approved') {
            $stmt = $pdo->prepare('SELECT requested_latitude, requested_longitude FROM consumers WHERE consumer_code = ?');
            $stmt->execute([$consumerCode]);
            $requested = $stmt->fetch();
            if (!$requested || $requested['requested_latitude'] === null || $requested['requested_longitude'] === null) {
                sendJsonResponse(['success' => false, 'error' => 'No pending location request found.'], 404);
            }
            $consumerStmt = $pdo->prepare('SELECT id, zone FROM consumers WHERE consumer_code = ?');
            $consumerStmt->execute([$consumerCode]);
            $consumer = $consumerStmt->fetch();
            $geoStmt = $pdo->prepare('UPDATE geo_connections SET latitude = ?, longitude = ? WHERE consumer_id = ?');
            $geoStmt->execute([$requested['requested_latitude'], $requested['requested_longitude'], $consumer['id']]);
            $stmt = $pdo->prepare("UPDATE consumers SET location_approval_status = 'Approved', requested_latitude = NULL, requested_longitude = NULL WHERE consumer_code = ?");
            $stmt->execute([$consumerCode]);
        } else {
            $stmt = $pdo->prepare("UPDATE consumers SET location_approval_status = 'Rejected', requested_latitude = NULL, requested_longitude = NULL WHERE consumer_code = ?");
            $stmt->execute([$consumerCode]);
        }
        sendJsonResponse(['success' => true, 'locationApprovalStatus' => $decision]);
    }

    $decision = $input['approvalStatus'] ?? '';

    if ($consumerCode === '' || !in_array($decision, ['Approved', 'Rejected'], true)) {
        sendJsonResponse(['success' => false, 'error' => 'Consumer and approval decision are required.'], 400);
    }

    $status = $decision === 'Approved' ? 'Active' : 'Pending';
    $stmt = $pdo->prepare('UPDATE consumers SET status = ?, approval_status = ? WHERE consumer_code = ?');
    $stmt->execute([$status, $decision, $consumerCode]);
    sendJsonResponse(['success' => true, 'approvalStatus' => $decision, 'status' => $decision === 'Approved' ? 'Active' : 'Rejected']);
}

sendJsonResponse(['success' => false, 'error' => 'Method not supported'], 405);
