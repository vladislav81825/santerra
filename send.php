<?php
/**
 * Обработчик заявок с сайта «Сантерра».
 *
 * Настройки:
 *   MAIL_TO            — куда присылать заявки
 *   MAIL_FROM          — адрес отправителя (должен существовать на домене)
 *   TELEGRAM_BOT_TOKEN — токен бота (необязательно)
 *   TELEGRAM_CHAT_ID   — ID чата/канала для уведомлений (необязательно)
 *
 * Если Telegram не нужен — оставьте константы пустыми.
 */

const MAIL_TO = 'info-sunterra@mail.ru';
const MAIL_FROM = 'no-reply@apartamenty.poprostomy.ru';
const TELEGRAM_BOT_TOKEN = '';
const TELEGRAM_CHAT_ID = '';
const MAX_BODY = 20480;

date_default_timezone_set('Europe/Moscow');

function wants_json()
{
    $accept = isset($_SERVER['HTTP_ACCEPT']) ? $_SERVER['HTTP_ACCEPT'] : '';
    $xhr = isset($_SERVER['HTTP_X_REQUESTED_WITH']) ? $_SERVER['HTTP_X_REQUESTED_WITH'] : '';

    return stripos($accept, 'application/json') !== false || strtolower($xhr) === 'fetch';
}

function respond($status, $message, $isError, $extra)
{
    $payload = array(
        'ok' => !$isError,
        'message' => $isError ? '' : $message,
        'error' => $isError ? $message : '',
    );

    if (is_array($extra)) {
        $payload = array_merge($payload, $extra);
    }

    if (wants_json()) {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        header('X-Content-Type-Options: nosniff');
        echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    http_response_code($status);
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');

    $title = $isError ? 'Заявка не отправлена' : 'Спасибо!';
    $safe = htmlspecialchars($message, ENT_QUOTES, 'UTF-8');

    echo '<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8">';
    echo '<meta name="viewport" content="width=device-width, initial-scale=1.0">';
    echo '<title>' . $title . ' — Сантерра</title></head>';
    echo '<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#08080c;color:#f6f2e9;font:16px/1.6 system-ui,sans-serif">';
    echo '<main style="max-width:520px;padding:32px;text-align:center">';
    echo '<h1 style="font-size:1.6rem">' . $title . '</h1>';
    echo '<p style="color:#d2ccc2">' . $safe . '</p>';
    echo '<p><a href="/" style="color:#f5b94a">Вернуться на сайт</a></p>';
    echo '<p style="color:#98939f;font-size:.85rem">8 (800) 511-90-05 · info-sunterra@mail.ru</p>';
    echo '</main></body></html>';
    exit;
}

function clean_line($value, $maxLength)
{
    if (is_array($value)) {
        return '';
    }

    $value = strip_tags((string) $value);
    $value = preg_replace('/[\r\n\t]+/u', ' ', $value);
    $value = preg_replace('/\s+/u', ' ', $value);
    $value = trim($value);

    if (function_exists('mb_substr')) {
        return mb_substr($value, 0, $maxLength, 'UTF-8');
    }

    return substr($value, 0, $maxLength);
}

function normalize_phone($value)
{
    if (is_array($value)) {
        return null;
    }

    $digits = preg_replace('/\D+/', '', (string) $value);

    if (strlen($digits) === 10) {
        $digits = '7' . $digits;
    }
    if (strlen($digits) === 11 && $digits[0] === '8') {
        $digits = '7' . substr($digits, 1);
    }
    if (strlen($digits) !== 11 || $digits[0] !== '7') {
        return null;
    }

    return '+7 (' . substr($digits, 1, 3) . ') ' . substr($digits, 4, 3) . '-' .
        substr($digits, 7, 2) . '-' . substr($digits, 9, 2);
}

function send_telegram($text)
{
    if (TELEGRAM_BOT_TOKEN === '' || TELEGRAM_CHAT_ID === '') {
        return false;
    }

    $url = 'https://api.telegram.org/bot' . TELEGRAM_BOT_TOKEN . '/sendMessage';
    $params = array(
        'chat_id' => TELEGRAM_CHAT_ID,
        'text' => $text,
        'parse_mode' => 'HTML',
        'disable_web_page_preview' => 'true',
    );

    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($params));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 6);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 4);
        $result = curl_exec($ch);
        curl_close($ch);

        return $result !== false;
    }

    $context = stream_context_create(array(
        'http' => array(
            'method' => 'POST',
            'header' => "Content-Type: application/x-www-form-urlencoded\r\n",
            'content' => http_build_query($params),
            'timeout' => 6,
        ),
    ));

    return @file_get_contents($url, false, $context) !== false;
}

if (!isset($_SERVER['REQUEST_METHOD']) || $_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    respond(405, 'Метод не поддерживается.', true, null);
}

if (isset($_SERVER['CONTENT_LENGTH']) && (int) $_SERVER['CONTENT_LENGTH'] > MAX_BODY) {
    respond(413, 'Слишком большой объём данных.', true, null);
}

$contentType = isset($_SERVER['CONTENT_TYPE']) ? $_SERVER['CONTENT_TYPE'] : '';
$raw = file_get_contents('php://input');
$data = $_POST;

if (strlen($raw) > MAX_BODY) {
    respond(413, 'Слишком большой объём данных.', true, null);
}

if (stripos($contentType, 'application/json') !== false) {
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        respond(400, 'Некорректный формат заявки.', true, null);
    }
    $data = $decoded;
}

if (!empty($data['company'])) {
    respond(400, 'Заявка не отправлена.', true, null);
}

$consentRaw = isset($data['consent']) ? $data['consent'] : '';
$consent = is_array($consentRaw) ? '' : strtolower(trim((string) $consentRaw));
if (!in_array($consent, array('yes', 'on', '1', 'true', 'да'), true)) {
    respond(422, 'Нужно согласие на обработку персональных данных.', true, null);
}

$phone = normalize_phone(isset($data['phone']) ? $data['phone'] : '');
if ($phone === null) {
    respond(422, 'Укажите корректный номер телефона.', true, null);
}

$allowedFormats = array('Нужна консультация', 'Студия', 'Коммерческое помещение');
$format = clean_line(isset($data['format']) ? $data['format'] : '', 60);
if (!in_array($format, $allowedFormats, true)) {
    $format = 'Нужна консультация';
}

$name = clean_line(isset($data['name']) ? $data['name'] : '', 80);
if ($name === '') {
    $name = 'Не указано';
}

$source = clean_line(isset($data['source']) ? $data['source'] : '', 120);
if ($source === '') {
    $source = 'Сайт';
}

$page = clean_line(isset($data['page']) ? $data['page'] : '', 300);
$ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '';
$userAgent = clean_line(isset($_SERVER['HTTP_USER_AGENT']) ? $_SERVER['HTTP_USER_AGENT'] : '', 200);
$time = date('d.m.Y H:i:s');

$subject = 'Заявка с сайта Сантерра: ' . $format . ' — ' . $phone;
$encodedSubject = function_exists('mb_encode_mimeheader')
    ? mb_encode_mimeheader($subject, 'UTF-8', 'B', "\r\n")
    : '=?UTF-8?B?' . base64_encode($subject) . '?=';

$body = "Новая заявка с сайта «Сантерра»\n\n";
$body .= "Имя:        " . $name . "\n";
$body .= "Телефон:    " . $phone . "\n";
$body .= "Формат:     " . $format . "\n";
$body .= "Источник:   " . $source . "\n";
$body .= "Страница:   " . ($page !== '' ? $page : '—') . "\n";
$body .= "Время:      " . $time . " (МСК)\n";
$body .= "IP:         " . ($ip !== '' ? $ip : '—') . "\n";
$body .= "Браузер:    " . ($userAgent !== '' ? $userAgent : '—') . "\n";

$headers = array(
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    'From: Сантерра <' . MAIL_FROM . '>',
    'Reply-To: ' . MAIL_TO,
    'X-Mailer: PHP/' . phpversion(),
);

$mailSent = @mail(MAIL_TO, $encodedSubject, $body, implode("\r\n", $headers));

$safeName = htmlspecialchars($name, ENT_QUOTES, 'UTF-8');
$safePhone = htmlspecialchars($phone, ENT_QUOTES, 'UTF-8');
$safeFormat = htmlspecialchars($format, ENT_QUOTES, 'UTF-8');
$safeSource = htmlspecialchars($source, ENT_QUOTES, 'UTF-8');
$safePage = htmlspecialchars($page !== '' ? $page : '—', ENT_QUOTES, 'UTF-8');

$telegramText = "<b>Новая заявка с сайта «Сантерра»</b>\n" .
    'Имя: ' . $safeName . "\n" .
    'Телефон: ' . $safePhone . "\n" .
    'Формат: ' . $safeFormat . "\n" .
    'Источник: ' . $safeSource . "\n" .
    'Страница: ' . $safePage . "\n" .
    'Время: ' . $time . ' (МСК)';

$telegramSent = send_telegram($telegramText);

if (!$mailSent && !$telegramSent) {
    respond(500, 'Не удалось отправить заявку. Позвоните нам: 8 (800) 511-90-05.', true, null);
}

respond(
    200,
    'Спасибо! Заявка отправлена. Специалист свяжется с вами в течение 15 минут.',
    false,
    null
);
