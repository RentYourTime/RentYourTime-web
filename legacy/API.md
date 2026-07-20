# RentYourTime API

API łączy konto użytkownika z subskrypcją Stripe. Wymaga PHP 8.1+, rozszerzeń `pdo_sqlite` i `curl` oraz serwera HTTPS.

Logowanie, rejestracja i tworzenie płatności mają limit żądań per adres IP. Tokeny są losowe, przechowywane w bazie wyłącznie jako skróty SHA-256 i wygasają po 30 dniach.

## Konfiguracja

Ustaw zmienne środowiskowe serwera:

```text
APP_URL=https://twoja-domena.pl
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

W Stripe utwórz cykliczną cenę roczną i ustaw jej identyfikator jako `STRIPE_PRICE_ID`. Webhook powinien wskazywać na:

```text
https://twoja-domena.pl/api/webhook.php
```

Obsługiwane zdarzenia:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

## Endpointy

### Rejestracja

`POST /api/register.php`

```json
{"email":"user@example.com","password":"minimum10znakow"}
```

### Logowanie

`POST /api/login.php`

```json
{"email":"user@example.com","password":"minimum10znakow"}
```

Odpowiedź zawiera `auth.token`. Aplikacja powinna przechowywać go w Keychain/Keystore, nie w zwykłym `localStorage`.

### Utworzenie płatności

`POST /api/checkout.php` z nagłówkiem:

```text
Authorization: Bearer TOKEN
```

Odpowiedź zawiera `checkout_url`, pod który należy przekierować użytkownika.

### Status konta w aplikacji

`GET /api/me.php` z nagłówkiem `Authorization: Bearer TOKEN`.

```json
{
  "ok": true,
  "user": {"id": "...", "email": "user@example.com"},
  "entitlements": {
    "pro": true,
    "plan": "pro",
    "status": "active",
    "current_period_end": 1790000000
  }
}
```

To odpowiedź `entitlements.pro`, pochodząca z webhooków Stripe, powinna odblokowywać Pro w aplikacji.

### Wylogowanie

`POST /api/logout.php` z nagłówkiem autoryzacji.

## Testowanie Stripe

Najpierw użyj kluczy `sk_test_...` i testowego Price ID. Webhook można przekazywać lokalnie przez Stripe CLI. Nie ustawiaj ręcznie statusu Pro na podstawie parametru `?checkout=success` — przekierowanie nie jest dowodem płatności.
