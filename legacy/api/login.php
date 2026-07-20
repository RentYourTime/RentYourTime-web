<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
require_method('POST');
rate_limit('login', 12, 900);

$data = json_body();
$email = strtolower(trim((string)($data['email'] ?? '')));
$password = (string)($data['password'] ?? '');
$stmt = db()->prepare('SELECT * FROM users WHERE email = ?');
$stmt->execute([$email]);
$user = $stmt->fetch();
if (!$user || !password_verify($password, $user['password_hash'])) {
    usleep(250000);
    json_response(['ok' => false, 'error' => 'invalid_credentials'], 401);
}

$auth = issue_token($user['id']);
json_response(['ok' => true, 'user' => ['id' => $user['id'], 'email' => $user['email']], 'auth' => $auth]);
