# Wdrożenie RentYourTime na AWS

Poradnik krok po kroku, jak uruchomić tę aplikację na AWS w wersji produkcyjnej.

## Którą usługę AWS wybrać?

Aplikacja to **długo działający proces Node** z bazą **SQLite na trwałym dysku**
(plik `.data/rentyourtime.sqlite` + stan waitlisty / rate‑limitów). To determinuje wybór:

| Usługa | Nadaje się? | Dlaczego |
| --- | --- | --- |
| **EC2** (VM + dysk EBS) | ✅ **Zalecane** | Trwały dysk, pełna kontrola, najbliżej obecnej architektury. Ten poradnik. |
| **Lightsail** | ✅ prostsza alternatywa | To EC2 z prostszym UI i stałą ceną. Kroki niemal identyczne. |
| ECS/Fargate + EFS | ⚠️ możliwe | SQLite na EFS działa tylko przy **1 instancji** (SQLite nie znosi współdzielenia zapisu). Nadmiarowo złożone. |
| Amplify / Lambda | ❌ **nie** | Serverless nie ma trwałego dysku — plik SQLite i CSV nie przetrwają. Wymagałoby przepisania na Postgres (RDS). |

> Jeśli w przyszłości zechcesz skalować poziomo (wiele instancji), trzeba będzie
> przenieść bazę do **RDS/PostgreSQL**. Dziś SQLite + jedna instancja jest w zupełności OK.

## Architektura docelowa

```
Internet ──HTTPS(443)──► nginx (reverse proxy, TLS) ──HTTP(3000)──► Next.js (systemd) ──► SQLite (EBS)
                                                                            ▲
                                                     Stripe webhook ────────┘  POST /api/webhook
```

- **nginx** kończy HTTPS i przekazuje `X-Forwarded-For` (potrzebne do rate‑limitingu per IP).
- **systemd** trzyma proces Node żywy i restartuje po awarii / reboocie.
- **EBS** (dysk instancji) trzyma bazę SQLite — róbmy snapshoty.

---

## 0. Czego potrzebujesz zawczasu

- Konto AWS.
- Domena (np. `rentyourtime.pl`) — może być w Route 53 lub u dowolnego rejestratora.
- Klucze Stripe (live): `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, oraz `STRIPE_WEBHOOK_SECRET` (wygenerujesz w kroku 8).
- Kod aplikacji w repozytorium Git (GitHub/GitLab) — najwygodniej.

---

## 1. Uruchom instancję EC2

1. Konsola AWS → **EC2** → **Launch instance**.
2. **Name:** `rentyourtime`.
3. **AMI:** Ubuntu Server **24.04 LTS** (64‑bit x86).
4. **Typ instancji:** `t3.small` (2 GB RAM).
   > `t3.micro` (1 GB) potrafi zabraknąć pamięci przy `next build`. Jeśli używasz `t3.micro`,
   > dodaj plik swap (patrz krok 4a) albo buduj lokalnie.
5. **Key pair:** utwórz nowy i pobierz `.pem` (posłuży do SSH).
6. **Network / Security group** — utwórz regułę wejściową:
   - SSH (22) — **tylko Twój IP** (`My IP`),
   - HTTP (80) — `0.0.0.0/0`,
   - HTTPS (443) — `0.0.0.0/0`.
7. **Storage:** 20 GB gp3 (z zapasem na bazę i logi).
8. **Launch instance**.

### Przypnij stały adres IP (Elastic IP)

EC2 → **Elastic IPs** → **Allocate** → zaznacz nowy IP → **Associate** → wskaż instancję.
Dzięki temu adres nie zmieni się po restarcie.

### Skieruj domenę na serwer

W DNS domeny dodaj rekord **A**:

```
rentyourtime.pl        A     <TWÓJ_ELASTIC_IP>
www.rentyourtime.pl    A     <TWÓJ_ELASTIC_IP>
```

Propagacja DNS może potrwać kilka–kilkadziesiąt minut.

---

## 2. Połącz się przez SSH

```bash
chmod 400 rentyourtime.pem
ssh -i rentyourtime.pem ubuntu@<TWÓJ_ELASTIC_IP>
```

---

## 3. Zainstaluj Node.js 24 i narzędzia

```bash
sudo apt update && sudo apt upgrade -y

# Node.js 24 (NodeSource)
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs

# Narzędzia do (ewentualnej) kompilacji better-sqlite3 + git + nginx
sudo apt install -y build-essential python3 git nginx

node -v   # v24.x
npm -v
```

> `better-sqlite3` normalnie pobiera gotowy binarny build dla Node 24. `build-essential`
> i `python3` są zabezpieczeniem na wypadek, gdyby musiał kompilować się ze źródeł.

### 3a. (tylko t3.micro) dodaj swap

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## 4. Pobierz i zbuduj aplikację

```bash
# Katalog aplikacji
sudo mkdir -p /var/www && sudo chown ubuntu:ubuntu /var/www
cd /var/www

# Sklonuj repo (albo skopiuj pliki scp/rsync)
git clone <URL_TWOJEGO_REPO> rentyourtime
cd rentyourtime

# Zależności + build produkcyjny
npm ci
npm run build
```

> Jeśli nie masz repo, prześlij pliki z komputera (bez `node_modules`, `.next`, `legacy`):
> ```bash
> rsync -av --exclude node_modules --exclude .next --exclude .git \
>   -e "ssh -i rentyourtime.pem" ./ ubuntu@<IP>:/var/www/rentyourtime/
> ```

---

## 5. Skonfiguruj zmienne środowiskowe

```bash
cd /var/www/rentyourtime
cp .env.example .env
nano .env
```

Uzupełnij:

```dotenv
APP_URL=https://rentyourtime.pl
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...          # uzupełnisz po kroku 8
WAITLIST_NOTIFY_EMAIL=                    # opcjonalnie
DATA_DIR=/var/lib/rentyourtime           # baza poza katalogiem kodu
```

Utwórz trwały katalog na bazę (przetrwa `git pull` i redeploye):

```bash
sudo mkdir -p /var/lib/rentyourtime
sudo chown ubuntu:ubuntu /var/lib/rentyourtime
```

> `APP_URL` **musi** być docelowym adresem https — używa go Stripe do przekierowań
> po płatności oraz metadane strony.

> `APPLE_*` (opcjonalne, `docs/APPLE_SUBSCRIPTIONS.md`) — integracja Apple to na
> razie tylko szkielet bez realnej weryfikacji, więc te zmienne nie są wymagane do
> wdrożenia. Bez nich `/api/subscriptions/apple/sync` po prostu zwraca 503.

---

## 6. Uruchom jako usługa systemd

Utwórz plik usługi:

```bash
sudo nano /etc/systemd/system/rentyourtime.service
```

Wklej:

```ini
[Unit]
Description=RentYourTime (Next.js)
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/var/www/rentyourtime
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/npm run start:web
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

> Pod systemd używamy `start:web` (sama strona), **nie** `start` — bo `npm run start`
> odpala też bota przez `concurrently`, a bota prowadzi osobna usługa (poniżej).
> Jeden proces = jedna usługa.

Włącz i wystartuj:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now rentyourtime
sudo systemctl status rentyourtime      # powinno być "active (running)"
```

Test lokalny na serwerze:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000   # 200
```

Podgląd logów aplikacji:

```bash
journalctl -u rentyourtime -f
```

---

## 7. nginx jako reverse proxy (HTTPS)

Utwórz konfigurację witryny:

```bash
sudo nano /etc/nginx/sites-available/rentyourtime
```

Wklej (podmień domenę):

```nginx
server {
    listen 80;
    server_name rentyourtime.pl www.rentyourtime.pl;

    # Stripe webhook potrzebuje surowego body — proxy nic nie buforuje niepotrzebnie
    client_max_body_size 1m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

> `X-Forwarded-For` / `X-Real-IP` są kluczowe — aplikacja używa ich do rate‑limitingu per IP.
> Bez nich wszyscy użytkownicy wyglądaliby jak jeden adres (`127.0.0.1`).

Aktywuj i przeładuj:

```bash
sudo ln -s /etc/nginx/sites-available/rentyourtime /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

W tym momencie `http://rentyourtime.pl` powinno już działać.

### Certyfikat HTTPS (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d rentyourtime.pl -d www.rentyourtime.pl
```

Certbot sam dopisze konfigurację TLS i przekierowanie 80→443 oraz ustawi automatyczne
odnawianie. Sprawdź: `https://rentyourtime.pl`.

---

## 8. Webhook Stripe

1. Panel Stripe → **Developers → Webhooks → Add endpoint**.
2. **Endpoint URL:** `https://rentyourtime.pl/api/webhook`
3. **Events to send** — zaznacz:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `charge.refunded`
   > Jeśli endpoint już istnieje w Stripe Dashboard z tylko pierwszymi czterema
   > eventami, dopisz brakujące trzy do **tego samego** endpointu — nie twórz
   > drugiego. Szczegóły mapowania pól: `docs/STRIPE.md`.
4. Zapisz i skopiuj **Signing secret** (`whsec_...`).
5. Wklej go do `.env` jako `STRIPE_WEBHOOK_SECRET` i zrestartuj:

```bash
nano /var/www/rentyourtime/.env      # uzupełnij STRIPE_WEBHOOK_SECRET
sudo systemctl restart rentyourtime
```

> W Stripe utwórz **roczną cenę cykliczną** i jej ID ustaw jako `STRIPE_PRICE_ID`.
> Pro włącza się **wyłącznie** po potwierdzeniu płatności przez webhook — nie na podstawie
> przekierowania `?checkout=success`.

---

## 9. Aktualizacje (redeploy)

```bash
cd /var/www/rentyourtime
git pull
npm ci
npm test          # opcjonalnie, ale tania kontrola przed restartem produkcji
npm run build
sudo systemctl restart rentyourtime
```

> **Nigdy nie uruchamiaj `npm run build` przy działającym `npm run dev`** na tym samym
> katalogu — mieszają się artefakty w `.next`. Na produkcji `dev` nie działa, więc to bezpieczne.
> Gdyby po aktualizacji pojawił się błąd typu `Cannot find module './xxx.js'`, wyczyść cache:
> `rm -rf .next && npm run build && sudo systemctl restart rentyourtime`.

---

## 10. Kopie zapasowe bazy

Baza to jeden plik w `DATA_DIR` (`/var/lib/rentyourtime`). Dwa poziomy backupu:

**a) Snapshoty EBS (całego dysku)** — EC2 → Volumes → wybierz wolumen → **Create snapshot**.
Możesz ustawić harmonogram przez **Data Lifecycle Manager**.

**b) Zrzut samej bazy przez cron** (spójna kopia mimo zapisu):

```bash
sudo apt install -y sqlite3
mkdir -p /var/backups/rentyourtime
crontab -e
```

Dodaj (codziennie 3:00):

```cron
0 3 * * * sqlite3 /var/lib/rentyourtime/rentyourtime.sqlite ".backup '/var/backups/rentyourtime/ryt-$(date +\%F).sqlite'"
```

(Opcjonalnie kopiuj `/var/backups/rentyourtime` do S3: `aws s3 sync ...`.)

---

## Szybka checklista

- [ ] EC2 (Ubuntu 24.04, t3.small) + Elastic IP
- [ ] Security group: 22 (mój IP), 80, 443
- [ ] Rekord A domeny → Elastic IP
- [ ] Node 24 + `build-essential python3 git nginx`
- [ ] `git clone` → `npm ci` → `npm run build`
- [ ] `.env` z `APP_URL`, kluczami Stripe, `DATA_DIR`
- [ ] usługa `systemd` (`enable --now`)
- [ ] nginx z `X-Forwarded-For` + HTTPS przez certbot
- [ ] webhook Stripe → `/api/webhook` + `STRIPE_WEBHOOK_SECRET`
- [ ] backupy (snapshot EBS + cron `.backup`)

## Diagnostyka

| Objaw | Sprawdź |
| --- | --- |
| 502 Bad Gateway | `sudo systemctl status rentyourtime`, `journalctl -u rentyourtime -e` |
| Aplikacja nie startuje | `cd /var/www/rentyourtime && npm run start` (zobacz błąd na żywo) |
| Rate‑limit blokuje wszystkich | Czy nginx ustawia `X-Forwarded-For`? (krok 7) |
| Pro się nie włącza po płatności | Panel Stripe → Webhooks → czy zdarzenia mają status 200; czy `STRIPE_WEBHOOK_SECRET` zgadza się z endpointem |
| `Cannot find module './xxx.js'` | `rm -rf .next && npm run build && sudo systemctl restart rentyourtime` |
| HTTPS nie działa | `sudo certbot certificates`, `sudo nginx -t`, rekord A + propagacja DNS |
