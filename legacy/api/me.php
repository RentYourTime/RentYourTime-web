<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
require_method('GET');

$user = current_user();
$stmt = db()->prepare('SELECT status, current_period_end FROM subscriptions WHERE user_id = ?');
$stmt->execute([$user['id']]);
$subscription = $stmt->fetch() ?: null;

json_response([
    'ok' => true,
    'user' => ['id' => $user['id'], 'email' => $user['email']],
    'entitlements' => [
        'pro' => subscription_is_pro($subscription),
        'plan' => subscription_is_pro($subscription) ? 'pro' : 'free',
        'status' => $subscription['status'] ?? null,
        'current_period_end' => isset($subscription['current_period_end']) ? (int)$subscription['current_period_end'] : null
    ]
]);

