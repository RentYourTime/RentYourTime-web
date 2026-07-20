<?php
/**
 * RentYourTime — zapis na waitlistę.
 * Adresy trafiają do waitlist-emails.csv (obok tego pliku).
 * Dostęp do CSV z przeglądarki blokuje dołączony .htaccess.
 */

header('Content-Type: application/json; charset=utf-8');

$FILE   = __DIR__ . '/waitlist-emails.csv';
$NOTIFY = 'a.dolatowski@atlashc.pl'; // np. 'a.dolatowski@atlashc.pl' — jeśli ustawisz, dostaniesz e-mail przy każdym nowym zapisie

function count_rows($file) {
    if (!file_exists($file)) return 0;
    $handle = fopen($file, 'rb');
    if ($handle === false) return 0;
    $count = 0;
    if (flock($handle, LOCK_SH)) {
        while (fgetcsv($handle) !== false) $count++;
        flock($handle, LOCK_UN);
    }
    fclose($handle);
    return $count;
}

// GET ?count=1 → tylko liczba zapisów (do licznika na stronie)
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    echo json_encode(array('ok' => true, 'count' => count_rows($FILE)));
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(array('ok' => false, 'error' => 'method'));
    exit;
}

// Honeypot: pole "website" jest ukryte — wypełniają je tylko boty.
// Udajemy sukces, żeby bot nie próbował dalej.
if (!empty($_POST['website'])) {
    echo json_encode(array('ok' => true, 'count' => count_rows($FILE)));
    exit;
}

$email = isset($_POST['email']) ? trim($_POST['email']) : '';
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 254) {
    http_response_code(422);
    echo json_encode(array('ok' => false, 'error' => 'invalid'));
    exit;
}

$handle = fopen($FILE, 'c+');
if ($handle === false || !flock($handle, LOCK_EX)) {
    if (is_resource($handle)) fclose($handle);
    http_response_code(500);
    echo json_encode(array('ok' => false, 'error' => 'write'));
    exit;
}

// Sprawdzenie i zapis odbywają się pod jedną blokadą, więc równoczesne
// zgłoszenia nie utworzą duplikatów.
$exists = false;
$count = 0;
rewind($handle);
while (($cols = fgetcsv($handle)) !== false) {
    $count++;
    if (isset($cols[0]) && strtolower($cols[0]) === strtolower($email)) $exists = true;
}

if (!$exists) {
    $ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '';
    fseek($handle, 0, SEEK_END);
    if (fputcsv($handle, array($email, date('c'), $ip)) === false || !fflush($handle)) {
        flock($handle, LOCK_UN);
        fclose($handle);
        http_response_code(500);
        echo json_encode(array('ok' => false, 'error' => 'write'));
        exit;
    }
    $count++;
    if ($NOTIFY !== '') {
        @mail($NOTIFY, 'RentYourTime: nowy zapis na waitliste', $email,
              'From: waitlist@' . (isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : 'localhost'));
    }
}

flock($handle, LOCK_UN);
fclose($handle);

echo json_encode(array('ok' => true, 'count' => $count, 'new' => !$exists));
