<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
require_method('POST');
rate_limit('register', 8, 3600);

$data = json_body();
$email = strtolower(trim((string)($data['email'] ?? '')));
$password = (string)($data['password'] ?? '');
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 254) {
    json_response(['ok' => false, 'error' => 'invalid_email'], 422);
}
if (strlen($password) < 10 || strlen($password) > 200) {
    json_response(['ok' => false, 'error' => 'invalid_password'], 422);
}

$id = bin2hex(random_bytes(16));
try {
    $stmt = db()->prepare('INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)');
    $stmt->execute([$id, $email, password_hash($password, PASSWORD_DEFAULT), gmdate('c')]);
} catch (PDOException $e) {
    if ((string)$e->getCode() === '23000') json_response(['ok' => false, 'error' => 'email_taken'], 409);
    throw $e;
}

$auth = issue_token($id);
json_response(['ok' => true, 'user' => ['id' => $id, 'email' => $email], 'auth' => $auth], 201);
