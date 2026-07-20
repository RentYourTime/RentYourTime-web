<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
require_method('POST');

$payload = file_get_contents('php://input') ?: '';
$signature = $_SERVER['HTTP_STRIPE_SIGNATURE'] ?? '';
$secret = env_required('STRIPE_WEBHOOK_SECRET');

$timestamp = null;
$signatures = [];
foreach (explode(',', $signature) as $part) {
    [$key, $value] = array_pad(explode('=', trim($part), 2), 2, '');
    if ($key === 't') $timestamp = ctype_digit($value) ? (int)$value : null;
    if ($key === 'v1') $signatures[] = $value;
}
if (!$timestamp || abs(time() - $timestamp) > 300 || !$signatures) {
    json_response(['ok' => false, 'error' => 'invalid_signature'], 400);
}
$expected = hash_hmac('sha256', $timestamp . '.' . $payload, $secret);
$valid = false;
foreach ($signatures as $candidate) {
    if (hash_equals($expected, $candidate)) { $valid = true; break; }
}
if (!$valid) json_response(['ok' => false, 'error' => 'invalid_signature'], 400);

$event = json_decode($payload, true);
if (!is_array($event) || empty($event['id']) || empty($event['type'])) {
    json_response(['ok' => false, 'error' => 'invalid_event'], 400);
}

$pdo = db();
$pdo->beginTransaction();
try {
    $seen = $pdo->prepare('SELECT 1 FROM webhook_events WHERE event_id = ?');
    $seen->execute([$event['id']]);
    if ($seen->fetchColumn()) {
        $pdo->rollBack();
        json_response(['ok' => true, 'duplicate' => true]);
    }

    $object = $event['data']['object'] ?? [];
    $type = $event['type'];
    if ($type === 'checkout.session.completed') {
        $userId = (string)($object['client_reference_id'] ?? $object['metadata']['user_id'] ?? '');
        if ($userId !== '') {
            if (!empty($object['customer'])) {
                $stmt = $pdo->prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?');
                $stmt->execute([$object['customer'], $userId]);
            }
            if (!empty($object['subscription'])) {
                $status = ($object['payment_status'] ?? '') === 'paid' ? 'active' : 'pending';
                $stmt = $pdo->prepare('INSERT OR IGNORE INTO subscriptions
                    (user_id, stripe_subscription_id, status, current_period_end, last_event_created, updated_at)
                    VALUES (?, ?, ?, NULL, ?, ?)');
                $stmt->execute([$userId, $object['subscription'], $status, (int)($event['created'] ?? 0), gmdate('c')]);
            }
        }
    } elseif (in_array($type, ['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'], true)) {
        $userId = (string)($object['metadata']['user_id'] ?? '');
        if ($userId === '' && !empty($object['customer'])) {
            $find = $pdo->prepare('SELECT id FROM users WHERE stripe_customer_id = ?');
            $find->execute([$object['customer']]);
            $userId = (string)($find->fetchColumn() ?: '');
        }
        if ($userId !== '') {
            $status = $type === 'customer.subscription.deleted' ? 'canceled' : (string)($object['status'] ?? 'unknown');
            $periodEnd = isset($object['current_period_end']) ? (int)$object['current_period_end'] : null;
            $stmt = $pdo->prepare('INSERT INTO subscriptions
                (user_id, stripe_subscription_id, status, current_period_end, last_event_created, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET stripe_subscription_id=excluded.stripe_subscription_id,
                status=excluded.status, current_period_end=excluded.current_period_end,
                last_event_created=excluded.last_event_created, updated_at=excluded.updated_at
                WHERE excluded.last_event_created >= subscriptions.last_event_created');
            $stmt->execute([$userId, $object['id'] ?? null, $status, $periodEnd, (int)($event['created'] ?? 0), gmdate('c')]);
        }
    }

    $save = $pdo->prepare('INSERT INTO webhook_events (event_id, event_type, received_at) VALUES (?, ?, ?)');
    $save->execute([$event['id'], $event['type'], gmdate('c')]);
    $pdo->commit();
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('Webhook processing error: ' . $e->getMessage());
    json_response(['ok' => false, 'error' => 'webhook_processing_failed'], 500);
}

json_response(['ok' => true]);
