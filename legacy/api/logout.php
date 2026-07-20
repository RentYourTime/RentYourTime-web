<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
require_method('POST');

$token = bearer_token();
$stmt = db()->prepare('DELETE FROM tokens WHERE token_hash = ?');
$stmt->execute([hash('sha256', $token)]);
json_response(['ok' => true]);

