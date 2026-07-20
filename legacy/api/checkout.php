<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
require_method('POST');
rate_limit('checkout', 10, 600);

$user = current_user();
$priceId = env_required('STRIPE_PRICE_ID');
$siteUrl = rtrim(env_required('APP_URL'), '/');

$params = [
    'mode' => 'subscription',
    'line_items' => [['price' => $priceId, 'quantity' => 1]],
    'client_reference_id' => $user['id'],
    'success_url' => $siteUrl . '/pricing.html?checkout=success&session_id={CHECKOUT_SESSION_ID}',
    'cancel_url' => $siteUrl . '/pricing.html?checkout=cancelled',
    'allow_promotion_codes' => 'true',
    'subscription_data' => ['metadata' => ['user_id' => $user['id']]],
    'metadata' => ['user_id' => $user['id']]
];

if (!empty($user['stripe_customer_id'])) $params['customer'] = $user['stripe_customer_id'];
else $params['customer_email'] = $user['email'];

$session = stripe_request('POST', 'checkout/sessions', $params);
if (empty($session['url'])) json_response(['ok' => false, 'error' => 'checkout_url_missing'], 502);
json_response(['ok' => true, 'checkout_url' => $session['url'], 'session_id' => $session['id']]);
