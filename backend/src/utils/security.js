const crypto = require('node:crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'gala_graduacion_universitaria_secret_key_2026';

/**
 * Normaliza un texto eliminando acentos/diacríticos, convirtiendo a minúsculas
 * y colapsando espacios múltiples para búsqueda predictiva (Typeahead).
 */
function normalizeText(input = '') {
  return String(input)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Genera un hash seguro para un PIN de 4 dígitos utilizando scrypt.
 */
function hashPin(pin) {
  const cleanPin = String(pin).trim();
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(cleanPin, salt, 64).toString('hex');
  return `${salt}:${derivedKey}`;
}

/**
 * Verifica un PIN contra el hash almacenado usando comparación de tiempo constante.
 */
function verifyPin(pin, storedHash) {
  if (!storedHash || ! storedHash.includes(':')) return false;
  const [salt, keyHex] = storedHash.split(':');
  const derivedKey = crypto.scryptSync(String(pin).trim(), salt, 64);
  const keyBuffer = Buffer.from(keyHex, 'hex');
  if (derivedKey.length !== keyBuffer.length) return false;
  return crypto.timingSafeEqual(derivedKey, keyBuffer);
}

/**
 * Firma un token JWT ligero (HMAC-SHA256) con persistencia de 30 días.
 */
function signToken(payload, expiresInDays = 30) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const exp = Math.floor(Date.now() / 1000) + expiresInDays * 86400;
  const fullPayload = { ...payload, exp, iat: Math.floor(Date.now() / 1000) };

  const base64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const base64Payload = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const data = `${base64Header}.${base64Payload}`;
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(data)
    .digest('base64url');

  return `${data}.${signature}`;
}

/**
 * Verifica y decodifica un token JWT.
 */
function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [base64Header, base64Payload, signature] = parts;
  const data = `${base64Header}.${base64Payload}`;
  const expectedSig = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(data)
    .digest('base64url');

  if (signature !== expectedSig) return null;

  try {
    const payload = JSON.parse(Buffer.from(base64Payload, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

module.exports = {
  normalizeText,
  hashPin,
  verifyPin,
  signToken,
  verifyToken,
};

