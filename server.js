/**
 * Мини-сервер для локального просмотра сайта.
 * Запуск:  node server.js
 * Адрес:  http://localhost:4173
 * Другой порт: node server.js 4188
 *
 * Дополнительно обрабатывает POST /send.php (заглушка для локальной проверки форм).
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const querystring = require('querystring');

const ROOT = __dirname;
const PORT = Number(process.argv[2]) || 4173;
const MAX_BODY = 20 * 1024;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(body);
}

function cleanLine(value, maxLength) {
  if (Array.isArray(value) || (value && typeof value === 'object')) return '';

  return String(value == null ? '' : value)
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function normalizePhone(value) {
  if (Array.isArray(value) || (value && typeof value === 'object')) return null;

  let digits = String(value == null ? '' : value).replace(/\D/g, '');

  if (digits.length === 10) digits = '7' + digits;
  if (digits.length === 11 && digits[0] === '8') digits = '7' + digits.slice(1);
  if (!(digits.length === 11 && digits[0] === '7')) return null;

  return '+7 (' + digits.slice(1, 4) + ') ' + digits.slice(4, 7) + '-' +
    digits.slice(7, 9) + '-' + digits.slice(9, 11);
}

function validateLead(data) {
  const honeypot = cleanLine(data.company, 80);
  if (honeypot) {
    return { ok: false, status: 400, error: 'Заявка не отправлена.' };
  }

  const consent = Array.isArray(data.consent)
    ? ''
    : String(data.consent == null ? '' : data.consent).toLowerCase();
  if (!['yes', 'on', '1', 'true', 'да'].includes(consent)) {
    return { ok: false, status: 422, error: 'Нужно согласие на обработку персональных данных.' };
  }

  const phone = normalizePhone(data.phone);
  if (!phone) {
    return { ok: false, status: 422, error: 'Укажите корректный номер телефона.' };
  }

  const allowedFormats = ['Нужна консультация', 'Студия', 'Коммерческое помещение'];
  const rawFormat = cleanLine(data.format, 60);
  const format = allowedFormats.includes(rawFormat) ? rawFormat : 'Нужна консультация';

  return {
    ok: true,
    lead: {
      name: cleanLine(data.name, 80) || 'Не указано',
      phone,
      format,
      source: cleanLine(data.source, 120) || 'Сайт',
      page: cleanLine(data.page, 300),
      sentAt: cleanLine(data.sentAt, 40),
    },
  };
}

function parsePayload(req, raw) {
  const type = String(req.headers['content-type'] || '').toLowerCase();

  if (type.includes('application/json')) {
    try {
      const parsed = JSON.parse(raw || '{}');
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (err) {
      return null;
    }
  }

  try {
    const parsed = querystring.parse(raw || '');
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (err) {
    return null;
  }
}

function readBody(req, callback) {
  const chunks = [];
  let size = 0;
  let tooLarge = false;

  req.on('data', (chunk) => {
    size += chunk.length;
    if (size > MAX_BODY) {
      tooLarge = true;
      return;
    }
    chunks.push(chunk);
  });

  req.on('end', () => {
    if (tooLarge) {
      callback({ tooLarge: true });
      return;
    }
    callback(null, Buffer.concat(chunks).toString('utf8'));
  });

  req.on('error', (err) => callback(err));
}

function handleSend(req, res) {
  if (req.method !== 'POST') {
    res.writeHead(405, {
      'Content-Type': 'application/json; charset=utf-8',
      'Allow': 'POST',
      'Cache-Control': 'no-store',
    });
    res.end(JSON.stringify({ ok: false, error: 'Метод не поддерживается.' }));
    return;
  }

  readBody(req, (err, raw) => {
    if (err && err.tooLarge) {
      sendJson(res, 413, { ok: false, error: 'Слишком большой объём данных.' });
      return;
    }

    if (err) {
      sendJson(res, 400, { ok: false, error: 'Не удалось прочитать заявку.' });
      return;
    }

    const data = parsePayload(req, raw);
    if (!data) {
      sendJson(res, 400, { ok: false, error: 'Некорректный формат заявки.' });
      return;
    }

    const result = validateLead(data);
    if (!result.ok) {
      sendJson(res, result.status, { ok: false, error: result.error });
      return;
    }

    const lead = result.lead;
    console.log('\n--- Новая заявка (локальная проверка) ---');
    console.log('Имя:    ' + lead.name);
    console.log('Телефон: ' + lead.phone);
    console.log('Формат: ' + lead.format);
    console.log('Источник: ' + lead.source);
    if (lead.page) console.log('Страница: ' + lead.page);
    console.log('Время:  ' + new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' }));

    sendJson(res, 200, {
      ok: true,
      message: 'Спасибо! Заявка отправлена. Специалист свяжется с вами в течение 15 минут.',
    });
  });
}

const server = http.createServer((req, res) => {
  let urlPath;

  try {
    urlPath = decodeURIComponent(req.url.split('?')[0]);
  } catch (err) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }).end('400 — некорректный адрес');
    return;
  }

  if (urlPath === '/send.php') {
    handleSend(req, res);
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8', 'Allow': 'GET, HEAD' }).end('405 — метод не поддерживается');
    return;
  }

  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';

  const relative = path.normalize(urlPath).replace(/^([/\\])+/, '');
  const filePath = path.join(ROOT, relative);

  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404 — не найдено');
      return;
    }

    let type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    if (path.basename(filePath).toLowerCase() === 'rss.xml') {
      type = 'application/rss+xml; charset=utf-8';
    }
    const range = req.headers.range;

    if (range) {
      const m = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (m) {
        let start = m[1] ? parseInt(m[1], 10) : 0;
        let end = m[2] ? parseInt(m[2], 10) : stat.size - 1;

        if (start >= stat.size || start > end) {
          res.writeHead(416, { 'Content-Range': 'bytes */' + stat.size }).end();
          return;
        }
        end = Math.min(end, stat.size - 1);

        res.writeHead(206, {
          'Content-Type': type,
          'Content-Range': 'bytes ' + start + '-' + end + '/' + stat.size,
          'Accept-Ranges': 'bytes',
          'Content-Length': end - start + 1,
          'Cache-Control': 'no-cache',
          'X-Content-Type-Options': 'nosniff',
        });
        fs.createReadStream(filePath, { start, end }).pipe(res);
        return;
      }
    }

    res.writeHead(200, {
      'Content-Type': type,
      'Content-Length': stat.size,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    });

    if (req.method === 'HEAD') {
      res.end();
      return;
    }

    fs.createReadStream(filePath).pipe(res);
  });
});

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error('Порт ' + PORT + ' занят. Запустите с другим портом: node server.js 4188');
    return;
  }
  console.error('Ошибка сервера:', err.message);
});

server.listen(PORT, () => {
  console.log('Сантерра: сайт доступен по адресу http://localhost:' + PORT);
  console.log('Формы: POST /send.php (локальная заглушка, заявки выводятся в консоль)');
});
