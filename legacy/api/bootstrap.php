<?php
declare(strict_types=1);

const API_TOKEN_DAYS = 30;

function json_response(array $data, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function require_method(string $method): void {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== $method) {
        header('Allow: ' . $method);
        json_response(['ok' => false, 'error' => 'method_not_allowed'], 405);
    }
}

function json_body(): array {
    $raw = file_get_contents('php://input');
    if ($raw !== false && strlen($raw) > 32768) json_response(['ok' => false, 'error' => 'payload_too_large'], 413);
    $data = json_decode($raw ?: '', true);
    if (!is_array($data)) json_response(['ok' => false, 'error' => 'invalid_json'], 400);
    return $data;
}

function env_required(string $name): string {
    $value = getenv($name);
    if ($value === false || trim($value) === '') {
        error_log('Missing environment variable: ' . $name);
        json_response(['ok' => false, 'error' => 'server_not_configured'], 503);
    }
    return trim($value);
}

function db(): PDO {
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;

    $dir = dirname(__DIR__) . DIRECTORY_SEPARATOR . '.data';
    if (!is_dir($dir) && !mkdir($dir, 0750, true) && !is_dir($dir)) {
        json_response(['ok' => false, 'error' => 'storage_unavailable'], 500);
    }

    try {
        $pdo = new PDO('sqlite:' . $dir . DIRECTORY_SEPARATOR . 'rentyourtime.sqlite');
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        $pdo->exec('PRAGMA foreign_keys = ON');
        $pdo->exec('PRAGMA journal_mode = WAL');
        $pdo->exec('CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT NOT NULL UNIQUE COLLATE NOCASE,
            password_hash TEXT NOT NULL,
            stripe_customer_id TEXT UNIQUE,
            created_at TEXT NOT NULL
        )');
        $pdo->exec('CREATE TABLE IF NOT EXISTS tokens (
            token_hash TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            expires_at TEXT NOT NULL,
            created_at TEXT NOT NULL
        )');
        $pdo->exec('CREATE TABLE IF NOT EXISTS subscriptions (
            user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            stripe_subscription_id TEXT UNIQUE,
            status TEXT NOT NULL,
            current_period_end INTEGER,
            last_event_created INTEGER NOT NULL DEFAULT 0,
            updated_at TEXT NOT NULL
        )');
        $columns = $pdo->query('PRAGMA table_info(subscriptions)')->fetchAll();
        $columnNames = array_column($columns, 'name');
        if (!in_array('last_event_created', $columnNames, true)) {
            $pdo->exec('ALTER TABLE subscriptions ADD COLUMN last_event_created INTEGER NOT NULL DEFAULT 0');
        }
        $pdo->exec('CREATE TABLE IF NOT EXISTS webhook_events (
            event_id TEXT PRIMARY KEY,
            event_type TEXT NOT NULL,
            received_at TEXT NOT NULL
        )');
        $pdo->exec('CREATE TABLE IF NOT EXISTS rate_limits (
            bucket TEXT PRIMARY KEY,
            attempts INTEGER NOT NULL,
            resets_at INTEGER NOT NULL
        )');
        if (random_int(1, 100) === 1) {
            $pdo->prepare('DELETE FROM tokens WHERE expires_at <= ?')->execute([gmdate('c')]);
            $pdo->prepare('DELETE FROM rate_limits WHERE resets_at <= ?')->execute([time()]);
        }
    } catch (Throwable $e) {
        error_log('Database error: ' . $e->getMessage());
        json_response(['ok' => false, 'error' => 'database_unavailable'], 500);
    }
    return $pdo;
}

function rate_limit(string $action, int $maxAttempts, int $windowSeconds): void {
    $ip = (string)($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    $bucket = hash('sha256', $action . ':' . $ip);
    $now = time();
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('SELECT attempts, resets_at FROM rate_limits WHERE bucket = ?');
        $stmt->execute([$bucket]);
        $row = $stmt->fetch();
        if (!$row || (int)$row['resets_at'] <= $now) {
            $write = $pdo->prepare('INSERT INTO rate_limits (bucket, attempts, resets_at) VALUES (?, 1, ?)
                ON CONFLICT(bucket) DO UPDATE SET attempts=1, resets_at=excluded.resets_at');
            $write->execute([$bucket, $now + $windowSeconds]);
        } else {
            if ((int)$row['attempts'] >= $maxAttempts) {
                $retry = max(1, (int)$row['resets_at'] - $now);
                $pdo->rollBack();
                header('Retry-After: ' . $retry);
                json_response(['ok' => false, 'error' => 'rate_limited'], 429);
            }
            $write = $pdo->prepare('UPDATE rate_limits SET attempts = attempts + 1 WHERE bucket = ?');
            $write->execute([$bucket]);
        }
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        error_log('Rate limit error: ' . $e->getMessage());
    }
}

function bearer_token(): string {
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!preg_match('/^Bearer\s+(.+)$/i', $header, $match)) {
        json_response(['ok' => false, 'error' => 'unauthorized'], 401);
    }
    return trim($match[1]);
}

function current_user(): array {
    $hash = hash('sha256', bearer_token());
    $stmt = db()->prepare('SELECT u.* FROM tokens t JOIN users u ON u.id = t.user_id
        WHERE t.token_hash = ? AND t.expires_at > ?');
    $stmt->execute([$hash, gmdate('c')]);
    $user = $stmt->fetch();
    if (!$user) json_response(['ok' => false, 'error' => 'unauthorized'], 401);
    return $user;
}

function issue_token(string $userId): array {
    $token = bin2hex(random_bytes(32));
    $expires = gmdate('c', time() + API_TOKEN_DAYS * 86400);
    $stmt = db()->prepare('INSERT INTO tokens (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)');
    $stmt->execute([hash('sha256', $token), $userId, $expires, gmdate('c')]);
    return ['token' => $token, 'expires_at' => $expires];
}

function stripe_request(string $method, string $path, array $params = []): array {
    $secret = env_required('STRIPE_SECRET_KEY');
    $url = 'https://api.stripe.com/v1/' . ltrim($path, '/');
    $curl = curl_init();
    $options = [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $secret]
    ];
    if ($params) {
        $options[CURLOPT_POSTFIELDS] = http_build_query($params);
        $options[CURLOPT_HTTPHEADER][] = 'Content-Type: application/x-www-form-urlencoded';
    }
    curl_setopt_array($curl, $options);
    $body = curl_exec($curl);
    $status = (int)curl_getinfo($curl, CURLINFO_HTTP_CODE);
    $curlError = curl_error($curl);
    curl_close($curl);
    if ($body === false || $curlError !== '') {
        error_log('Stripe connection error: ' . $curlError);
        json_response(['ok' => false, 'error' => 'payment_provider_unavailable'], 502);
    }
    $result = json_decode($body, true);
    if ($status < 200 || $status >= 300 || !is_array($result)) {
        error_log('Stripe API error (' . $status . '): ' . $body);
        json_response(['ok' => false, 'error' => 'payment_provider_error'], 502);
    }
    return $result;
}

function subscription_is_pro(?array $subscription): bool {
    if (!$subscription) return false;
    if (!in_array($subscription['status'], ['active', 'trialing'], true)) return false;
    $end = isset($subscription['current_period_end']) ? (int)$subscription['current_period_end'] : 0;
    return $end === 0 || $end > time();
}
