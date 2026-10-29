<?php
require_once __DIR__ . '/db.php';

$pdo = getDBConnection();

try {
    // 1. Consumers
    $consumerRows = $pdo->query("SELECT * FROM consumers ORDER BY id ASC")->fetchAll();
    $consumers = [];
    $consumerIdMap = []; // map integer id to consumer_code for joins

    foreach ($consumerRows as $row) {
        $initials = '';
        $parts = explode(' ', trim($row['full_name']));
        foreach ($parts as $p) {
            if (!empty($p)) $initials .= strtoupper($p[0]);
        }
        $avatar = substr($initials, 0, 2) ?: 'C';

        $cItem = [
            'dbId' => (int)$row['id'],
            'id' => $row['consumer_code'],
            'accountNo' => $row['account_no'],
            'username' => $row['username'] ?? null,
            'email' => $row['email'] ?? null,
            'name' => $row['full_name'],
            'contact' => $row['contact_no'],
            'address' => $row['service_address'],
            'zone' => $row['zone'],
            'classification' => $row['classification'],
            'meterNo' => $row['meter_serial'],
            'status' => $row['approval_status'] === 'Rejected'
                ? 'Rejected'
                : ($row['approval_status'] === 'Pending' ? 'Pending Approval' : $row['status']),
            'approvalStatus' => $row['approval_status'],
            'locationApprovalStatus' => $row['location_approval_status'] ?? 'None',
            'requestedLatitude' => $row['requested_latitude'] !== null ? (float)$row['requested_latitude'] : null,
            'requestedLongitude' => $row['requested_longitude'] !== null ? (float)$row['requested_longitude'] : null,
            'connectionDate' => $row['connection_date'],
            'lastReading' => (float)$row['last_reading'],
            'avatar' => $avatar,
        ];
        $consumers[] = $cItem;
        $consumerIdMap[$row['id']] = $cItem;
    }

    // 2. Meter Calibrations (grouped by meter_id)
    $calibRows = $pdo->query("SELECT * FROM meter_calibrations ORDER BY calibration_date ASC")->fetchAll();
    $calibrationsByMeter = [];
    foreach ($calibRows as $cal) {
        $mId = $cal['meter_id'];
        if (!isset($calibrationsByMeter[$mId])) {
            $calibrationsByMeter[$mId] = [];
        }
        $calibrationsByMeter[$mId][] = [
            'date' => $cal['calibration_date'],
            'type' => $cal['event_type'],
            'technician' => $cal['technician_name'],
            'notes' => $cal['notes'] ?? '',
            'accuracyMargin' => $cal['accuracy_margin'] ?? '',
            'testResult' => $cal['test_result'] ?? '',
        ];
    }

    // 3. Meter Assets
    $meterRows = $pdo->query("SELECT m.*, c.consumer_code, c.full_name as consumer_name FROM meter_assets m LEFT JOIN consumers c ON m.consumer_id = c.id ORDER BY m.id ASC")->fetchAll();
    $meters = [];
    foreach ($meterRows as $m) {
        $mId = $m['id'];
        $meters[] = [
            'id' => (int)$m['id'],
            'serialNo' => $m['serial_no'],
            'brand' => $m['brand'],
            'model' => $m['model'] ?? '',
            'size' => $m['pipe_size'] ?? '1/2 inch',
            'installDate' => $m['install_date'],
            'consumerId' => $m['consumer_code'] ?? ($m['consumer_id'] ? 'C-' . $m['consumer_id'] : ''),
            'consumerName' => $m['consumer_name'] ?? 'Unassigned',
            'zone' => $m['zone'] ?? 'Mabuhay',
            'lastCalibration' => $m['last_calibration'] ?? $m['install_date'],
            'nextCalibration' => $m['next_calibration'] ?? date('Y-m-d', strtotime($m['install_date'] . ' + 2 years')),
            'status' => $m['status'],
            'history' => $calibrationsByMeter[$mId] ?? [
                [
                    'date' => $m['install_date'],
                    'type' => 'Installation',
                    'technician' => 'Roberto Ramos',
                    'notes' => 'Meter commissioned and sealed.'
                ]
            ],
        ];
    }

    // 4. Geo Connections (GIS Pins)
    $geoRows = $pdo->query("SELECT g.*, c.consumer_code, c.full_name, c.meter_serial, c.last_reading FROM geo_connections g LEFT JOIN consumers c ON g.consumer_id = c.id ORDER BY g.id ASC")->fetchAll();
    $geoPins = [];
    foreach ($geoRows as $idx => $g) {
        // Map latitude/longitude to 2D percentage or coordinates if needed
        $x = 20 + (($idx * 17 + 13) % 65);
        $y = 25 + (($idx * 23 + 7) % 55);

        $geoPins[] = [
            'id' => 'GP-' . $g['id'],
            'consumerId' => $g['consumer_code'] ?? 'C-' . $g['consumer_id'],
            'name' => $g['full_name'] ?? 'Unknown',
            'zone' => $g['zone'],
            'x' => $x,
            'y' => $y,
            'latitude' => (float)$g['latitude'],
            'longitude' => (float)$g['longitude'],
            'status' => $g['status'],
            'meterNo' => $g['meter_serial'] ?? '',
            'reading' => (float)($g['last_reading'] ?? 0),
        ];
    }

    // 5. Bills
    $billRows = $pdo->query("SELECT b.*, c.consumer_code, c.full_name, c.account_no, c.zone as c_zone FROM bills b LEFT JOIN consumers c ON b.consumer_id = c.id ORDER BY b.id DESC")->fetchAll();
    $bills = [];
    foreach ($billRows as $b) {
        $cName = $b['full_name'] ?? 'Consumer';
        $bAvatar = '';
        $parts = explode(' ', trim($cName));
        foreach ($parts as $p) {
            if (!empty($p)) $bAvatar .= strtoupper($p[0]);
        }
        $bAvatar = substr($bAvatar, 0, 2) ?: 'WS';

        $bills[] = [
            'dbId' => (int)$b['id'],
            'id' => $b['bill_no'],
            'consumerId' => $b['consumer_code'] ?? 'C-' . $b['consumer_id'],
            'name' => $cName,
            'accountNo' => $b['account_no'] ?? '',
            'zone' => $b['c_zone'] ?? 'Mabuhay',
            'period' => $b['billing_period'],
            'prevReading' => (float)$b['prev_reading'],
            'presReading' => (float)$b['pres_reading'],
            'consumption' => (float)$b['consumption_cum'],
            'baseAmount' => (float)$b['base_amount'],
            'envFee' => (float)$b['env_fee'],
            'maintFee' => (float)$b['maint_fee'],
            'arrears' => (float)$b['arrears'],
            'penalty' => (float)$b['penalty'],
            'totalAmount' => (float)$b['total_amount'],
            'status' => $b['status'],
            'dueDate' => $b['due_date'],
            'paidDate' => $b['paid_date'] ?? null,
            'daysOverdue' => (int)$b['days_overdue'],
            'avatar' => $bAvatar,
        ];
    }

    // 6. Payments
    $paymentRows = $pdo->query("
        SELECT p.*, b.bill_no, c.consumer_code, c.full_name, u.full_name as cashier_name 
        FROM payments p 
        LEFT JOIN bills b ON p.bill_id = b.id 
        LEFT JOIN consumers c ON p.consumer_id = c.id 
        LEFT JOIN users u ON p.cashier_id = u.id 
        ORDER BY p.id DESC
    ")->fetchAll();
    $payments = [];
    foreach ($paymentRows as $p) {
        $payments[] = [
            'id' => (int)$p['id'],
            'orNumber' => $p['or_number'],
            'billId' => $p['bill_no'] ?? ('WS-' . $p['bill_id']),
            'consumerId' => $p['consumer_code'] ?? ('C-' . $p['consumer_id']),
            'consumerName' => $p['full_name'] ?? 'Counter Consumer',
            'amountPaid' => (float)$p['amount_paid'],
            'tendered' => (float)$p['tendered_amount'],
            'change' => (float)$p['change_amount'],
            'method' => $p['payment_method'],
            'date' => $p['payment_date'],
            'cashier' => $p['cashier_name'] ?? 'Counter Cashier Alpha',
            'notes' => $p['notes'] ?? '',
        ];
    }

    // 7. Maintenance Tickets
    $ticketRows = $pdo->query("
        SELECT t.*, c.consumer_code, c.full_name, c.account_no
        FROM maintenance_tickets t 
        LEFT JOIN consumers c ON t.consumer_id = c.id 
        ORDER BY t.id DESC
    ")->fetchAll();
    $complaints = [];
    foreach ($ticketRows as $t) {
        $complaints[] = [
            'dbId' => (int)$t['id'],
            'id' => $t['ticket_no'],
            'ticketNo' => $t['ticket_no'],
            'consumerId' => $t['consumer_code'] ?? ('C-' . $t['consumer_id']),
            'consumerName' => $t['full_name'] ?? 'Reporting Consumer',
            'accountNo' => $t['account_no'] ?? '',
            'zone' => $t['zone'],
            'issueType' => $t['issue_type'],
            'priority' => $t['priority'],
            'status' => $t['status'],
            'reportedAt' => $t['reported_at'],
            'resolvedAt' => $t['resolved_at'],
            'assignedTo' => $t['technician_name'] ?? 'Roberto Ramos',
            'assignedTech' => $t['technician_name'] ?? 'Roberto Ramos',
            'description' => $t['description'] ?? '',
            'resolution' => $t['resolution_notes'] ?? '',
            'notes' => $t['resolution_notes'] ?? '',
            'resolutionImage' => $t['resolution_image'] ?? null,
        ];
    }

    // 8. Audit Trail
    $auditRows = $pdo->query("SELECT * FROM audit_trail ORDER BY id DESC LIMIT 100")->fetchAll();
    $auditLogs = [];
    foreach ($auditRows as $a) {
        $auditLogs[] = [
            'id' => $a['log_code'],
            'timestamp' => $a['created_at'],
            'user' => $a['user_name'],
            'role' => $a['user_role'] ?? 'Operator',
            'category' => $a['category'],
            'action' => $a['action'],
            'target' => $a['target_entity'],
            'details' => $a['details'],
            'ip' => $a['ip_address'] ?? '127.0.0.1',
        ];
    }

    // 9. Staff (Users)
    $userRows = $pdo->query("SELECT * FROM users ORDER BY id ASC")->fetchAll();
    $staff = [];
    foreach ($userRows as $u) {
        $staff[] = [
            'id' => (int)$u['id'],
            'username' => $u['username'],
            'name' => $u['full_name'],
            'role' => $u['role'],
            'email' => $u['email'],
            'phone' => $u['contact_no'] ?? '+63 900 000 0000',
            'status' => $u['status'],
            'zone' => 'Central Hub',
            'activeTickets' => 1,
            'completedTickets' => 14,
            'rating' => 4.9,
        ];
    }

    // 10. Notifications
    $notificationRows = $pdo->query("SELECT * FROM notifications ORDER BY id DESC")->fetchAll();
    $notifications = [];
    foreach ($notificationRows as $n) {
        $notifications[] = [
            'id'              => $n['notification_code'],
            'type'            => $n['type'],
            'recipient'       => $n['recipient_name'],
            'accountNo'       => $n['account_no'],
            'consumerId'      => $n['consumer_id']      ?? null,
            'ticketId'        => $n['ticket_id']        ?? null,
            'resolutionImage' => $n['resolution_image'] ?? null,
            'message'         => $n['message'],
            'channel'         => $n['channel'],
            'status'          => $n['status'],
            'sentAt'          => $n['sent_at'],
        ];
    }

    $boundaryRows = $pdo->query("SELECT boundary_key, boundary_data FROM system_boundaries")->fetchAll();
    $boundaries = [
        'serviceBoundary' => null,
        'clusterBoundaries' => [],
    ];
    foreach ($boundaryRows as $boundaryRow) {
        $boundaryData = json_decode($boundaryRow['boundary_data'], true);
        if ($boundaryRow['boundary_key'] === 'service' && is_array($boundaryData)) {
            $boundaries['serviceBoundary'] = $boundaryData;
        }
        if ($boundaryRow['boundary_key'] === 'clusters' && is_array($boundaryData)) {
            $boundaries['clusterBoundaries'] = $boundaryData;
        }
    }

    $readingRows = $pdo->query("
        SELECT r.*, c.consumer_code, c.account_no, c.full_name, c.zone, b.bill_no
        FROM meter_readings r
        JOIN consumers c ON c.id = r.consumer_id
        LEFT JOIN bills b ON b.id = r.bill_id
        WHERE r.status = 'Pending'
        ORDER BY r.created_at DESC, r.id DESC
    ")->fetchAll();
    $meterReadings = [];
    foreach ($readingRows as $reading) {
        $meterReadings[] = [
            'id' => $reading['reading_code'],
            'consumerId' => $reading['consumer_code'],
            'consumerName' => $reading['full_name'],
            'accountNo' => $reading['account_no'],
            'zone' => $reading['zone'],
            'meterSerial' => $reading['meter_serial'],
            'classification' => $reading['classification'],
            'previousReading' => (float)$reading['previous_reading'],
            'currentReading' => (float)$reading['current_reading'],
            'recordedAt' => $reading['created_at'],
            'recordedBy' => $reading['recorded_by_name'],
            'status' => $reading['status'] === 'Pending' ? 'Pending Office Confirmation' : $reading['status'],
            'reviewedBy' => $reading['reviewed_by_name'],
            'reviewedAt' => $reading['reviewed_at'],
            'billId' => $reading['bill_no'],
        ];
    }

    sendJsonResponse([
        'success' => true,
        'source' => 'MySQL (waterline_db)',
        'data' => [
            'consumers' => $consumers,
            'meters' => $meters,
            'geoPins' => $geoPins,
            'bills' => $bills,
            'meterReadings' => $meterReadings,
            'payments' => $payments,
            'complaints' => $complaints,
            'auditLogs' => $auditLogs,
            'staff' => $staff,
            'notifications' => $notifications,
            'serviceBoundary' => $boundaries['serviceBoundary'],
            'clusterBoundaries' => $boundaries['clusterBoundaries'],
        ]
    ]);
} catch (Exception $e) {
    sendJsonResponse([
        'success' => false,
        'error' => $e->getMessage()
    ], 500);
}
