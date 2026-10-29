<?php
/**
 * Minimal SMTP sender for Gmail SMTP submission.
 * Configure SIA_SMTP_HOST, SIA_SMTP_PORT, SIA_SMTP_USERNAME,
 * SIA_SMTP_PASSWORD, SIA_MAIL_FROM and SIA_MAIL_FROM_NAME in the
 * PHP/XAMPP environment. Gmail requires an App Password when 2-Step
 * Verification is enabled; never use the normal Gmail password here.
 */
function smtpConfig(): array {
    return [
        'host' => getenv('SIA_SMTP_HOST') ?: '',
        'port' => (int)(getenv('SIA_SMTP_PORT') ?: 587),
        'username' => getenv('SIA_SMTP_USERNAME') ?: '',
        'password' => getenv('SIA_SMTP_PASSWORD') ?: '',
        'from' => getenv('SIA_MAIL_FROM') ?: (getenv('SIA_SMTP_USERNAME') ?: ''),
        'fromName' => getenv('SIA_MAIL_FROM_NAME') ?: 'Lambawasa Municipal Water District',
    ];
}

function smtpRead($socket): string {
    $response = '';
    while (($line = fgets($socket, 515)) !== false) {
        $response .= $line;
        if (strlen($line) < 4 || $line[3] === ' ') break;
    }
    return $response;
}

function smtpCommand($socket, string $command, array $expectedCodes): void {
    if ($command !== '') fwrite($socket, $command . "\r\n");
    $response = smtpRead($socket);
    $code = (int)substr($response, 0, 3);
    if (!in_array($code, $expectedCodes, true)) {
        throw new RuntimeException('SMTP server rejected the request (code ' . $code . ').');
    }
}

function sendSmtpEmail(string $to, string $subject, string $textBody): void {
    $config = smtpConfig();
    foreach (['host', 'username', 'password', 'from'] as $required) {
        if ($config[$required] === '') {
            throw new RuntimeException('Email delivery is not configured. Set the SIA_SMTP_* and SIA_MAIL_FROM environment variables.');
        }
    }
    if (!filter_var($config['from'], FILTER_VALIDATE_EMAIL)) {
        throw new RuntimeException('SIA_MAIL_FROM must be a valid email address.');
    }

    $socket = @stream_socket_client(
        'tcp://' . $config['host'] . ':' . $config['port'],
        $errno,
        $errstr,
        15,
        STREAM_CLIENT_CONNECT
    );
    if (!$socket) throw new RuntimeException('Could not connect to the configured SMTP server.');
    stream_set_timeout($socket, 15);

    try {
        smtpCommand($socket, '', [220]);
        smtpCommand($socket, 'EHLO localhost', [250]);
        smtpCommand($socket, 'STARTTLS', [220]);
        if (!stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
            throw new RuntimeException('Could not establish TLS with the SMTP server.');
        }
        smtpCommand($socket, 'EHLO localhost', [250]);
        smtpCommand($socket, 'AUTH LOGIN', [334]);
        smtpCommand($socket, base64_encode($config['username']), [334]);
        smtpCommand($socket, base64_encode($config['password']), [235]);
        smtpCommand($socket, 'MAIL FROM:<' . $config['from'] . '>', [250]);
        smtpCommand($socket, 'RCPT TO:<' . $to . '>', [250, 251]);
        smtpCommand($socket, 'DATA', [354]);

        $safeSubject = preg_replace('/[\r\n]+/', ' ', $subject);
        $safeFromName = preg_replace('/[\r\n]+/', ' ', $config['fromName']);
        $headers = [
            'From: ' . $safeFromName . ' <' . $config['from'] . '>',
            'To: <' . $to . '>',
            'Subject: ' . $safeSubject,
            'Date: ' . date(DATE_RFC2822),
            'MIME-Version: 1.0',
            'Content-Type: text/plain; charset=UTF-8',
            'Content-Transfer-Encoding: 8bit',
        ];
        $body = implode("\r\n", $headers) . "\r\n\r\n" . str_replace(["\r\n", "\r"], "\n", $textBody);
        $body = str_replace("\n", "\r\n", $body);
        $body = preg_replace('/^\./m', '..', $body);
        fwrite($socket, $body . "\r\n.\r\n");
        $response = smtpRead($socket);
        if ((int)substr($response, 0, 3) !== 250) {
            throw new RuntimeException('SMTP server did not accept the email.');
        }
        smtpCommand($socket, 'QUIT', [221]);
    } finally {
        fclose($socket);
    }
}
