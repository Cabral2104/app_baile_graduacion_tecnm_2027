const express = require('express');
const crypto = require('crypto');
const { db } = require('../db/database');
const { normalizeText, hashPin, verifyPin, signToken, verifyToken } = require('../utils/security');

const router = express.Router();

// Limitador de intentos fallidos de PIN en memoria (protege contra fuerza bruta en línea)
const PIN_WINDOW_MS = 10 * 60 * 1000;
const PIN_LOCK_MS = 5 * 60 * 1000;
const MAX_FAILS_PER_USER_IP = 5;
const MAX_FAILS_PER_IP = 35;
const pinAttemptBuckets = new Map();

function getClientIp(req) {
  return String(req.ip || req.socket?.remoteAddress || 'unknown');
}

function getActiveLockRemainingMs(key, now) {
  const entry = pinAttemptBuckets.get(key);
  if (!entry) return 0;
  if (entry.blockedUntil && entry.blockedUntil > now) {
    return entry.blockedUntil - now;
  }
  if (now - entry.firstAttemptAt > PIN_WINDOW_MS) {
    pinAttemptBuckets.delete(key);
  }
  return 0;
}

function recordFailedPinAttempt(key, limit, now) {
  if (pinAttemptBuckets.size > 2000) {
    for (const [k, v] of pinAttemptBuckets.entries()) {
      if (now - v.firstAttemptAt > PIN_WINDOW_MS && (!v.blockedUntil || v.blockedUntil <= now)) {
        pinAttemptBuckets.delete(k);
      }
    }
  }
  const existing = pinAttemptBuckets.get(key);
  if (!existing || now - existing.firstAttemptAt > PIN_WINDOW_MS) {
    pinAttemptBuckets.set(key, {
      count: 1,
      firstAttemptAt: now,
      blockedUntil: 0,
    });
    return;
  }
  existing.count += 1;
  if (existing.count >= limit) {
    existing.blockedUntil = now + PIN_LOCK_MS;
  }
}

/**
 * Middleware para autenticar peticiones mediante JWT en header Authorization.
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const payload = verifyToken(token);

  if (!payload || !payload.id) {
    return res.status(401).json({
      error: 'Sesión no válida o expirada. Por favor identifícate nuevamente en la lista.',
    });
  }

  const user = db.prepare(`
    SELECT id, nombre_completo, distintivo_homonimo, mesa, rol, activo, pin_hash
    FROM User WHERE id = ? AND activo = 1
  `).get(payload.id);

  if (!user) {
    return res.status(401).json({ error: 'Usuario no encontrado en el padrón oficial.' });
  }

  req.user = {
    id: user.id,
    nombre_completo: user.nombre_completo,
    distintivo_homonimo: user.distintivo_homonimo,
    mesa: user.mesa,
    rol: user.rol,
    tiene_pin: Boolean(user.pin_hash),
  };
  next();
}

/**
 * Middleware exclusivo para el Comité Organizador (Administradoras).
 */
function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.rol !== 'ADMIN') {
      return res.status(403).json({
        error: 'Acceso restringido exclusivamente al Comité Organizador.',
      });
    }
    next();
  });
}

/**
 * 1. Búsqueda predictiva (Typeahead) con normalización de acentos y minúsculas
 * GET /api/auth/search?q=maria
 */
router.get('/search', (req, res) => {
  const rawQuery = String(req.query.q || '');
  const normalizedQuery = normalizeText(rawQuery);

  let rows;
  if (!normalizedQuery) {
    rows = db.prepare(`
      SELECT id, nombre_completo, distintivo_homonimo, mesa, rol, pin_hash
      FROM User
      WHERE activo = 1 AND rol IN ('ALUMNO', 'ADMIN')
      ORDER BY rol DESC, nombre_completo ASC
      LIMIT 30
    `).all();
  } else {
    const terms = normalizedQuery.split(' ').filter(Boolean);
    const allUsers = db.prepare(`
      SELECT id, nombre_completo, nombre_normalizado, distintivo_homonimo, mesa, rol, pin_hash
      FROM User
      WHERE activo = 1 AND rol IN ('ALUMNO', 'ADMIN')
      ORDER BY nombre_completo ASC
    `).all();

    rows = allUsers.filter((u) =>
      terms.every((term) => u.nombre_normalizado.includes(term))
    );
  }

  const results = rows.map((u) => ({
    id: u.id,
    nombre_completo: u.nombre_completo,
    distintivo_homonimo: u.distintivo_homonimo,
    mesa: u.mesa,
    rol: u.rol,
    tiene_pin: Boolean(u.pin_hash),
  }));

  return res.json({ users: results });
});

/**
 * 2. Primer ingreso (Creación de PIN de 4 dígitos) o Validación de PIN existente
 * POST /api/auth/verify-pin
 * Body: { userId: string, pin: string }
 */
router.post('/verify-pin', (req, res) => {
  const { userId, pin } = req.body || {};
  const cleanPin = String(pin || '').trim();
  const clientIp = getClientIp(req);
  const nowMs = Date.now();
  const userIpKey = `u:${clientIp}:${String(userId || '')}`;
  const ipKey = `ip:${clientIp}`;

  const lockMs = Math.max(
    getActiveLockRemainingMs(userIpKey, nowMs),
    getActiveLockRemainingMs(ipKey, nowMs)
  );
  if (lockMs > 0) {
    const waitMins = Math.max(1, Math.ceil(lockMs / 60000));
    return res.status(429).json({
      error: `Por seguridad, demasiados intentos fallidos de PIN. Espera ${waitMins} minuto(s) o pide a una organizadora que restablezca tu PIN.`,
    });
  }

  if (!userId || !/^\d{4}$/.test(cleanPin)) {
    return res.status(400).json({
      error: 'Debes seleccionar tu nombre de la lista e ingresar un PIN numérico de exactamente 4 dígitos.',
    });
  }

  const user = db.prepare(`
    SELECT id, nombre_completo, distintivo_homonimo, mesa, rol, pin_hash, activo
    FROM User WHERE id = ? AND activo = 1
  `).get(userId);

  if (!user) {
    return res.status(404).json({
      error: 'Invitado no encontrado en la lista oficial.',
    });
  }

  let authStatus = 'AUTHENTICATED';

  // Primer ingreso: el alumno aún no tiene PIN registrado -> se guarda su PIN hasheado
  if (!user.pin_hash) {
    const hashed = hashPin(cleanPin);
    const now = new Date().toISOString();
    db.prepare('UPDATE User SET pin_hash = ?, updated_at = ? WHERE id = ?').run(hashed, now, user.id);
    authStatus = 'PIN_CREATED';
    pinAttemptBuckets.delete(userIpKey);
  } else {
    // Ingresos posteriores: verificar PIN contra el hash
    const isValid = verifyPin(cleanPin, user.pin_hash);
    if (!isValid) {
      recordFailedPinAttempt(userIpKey, MAX_FAILS_PER_USER_IP, nowMs);
      recordFailedPinAttempt(ipKey, MAX_FAILS_PER_IP, nowMs);
      return res.status(401).json({
        error: 'PIN incorrecto. Si olvidaste tu PIN, pide a una organizadora que lo restablezca desde su panel.',
      });
    }
    pinAttemptBuckets.delete(userIpKey);
  }

  const sessionUser = {
    id: user.id,
    nombre_completo: user.nombre_completo,
    distintivo_homonimo: user.distintivo_homonimo,
    mesa: user.mesa,
    rol: user.rol,
    tiene_pin: true,
  };

  const token = signToken({
    id: user.id,
    rol: user.rol,
    nombre: user.nombre_completo,
  });

  return res.json({
    status: authStatus,
    message:
      authStatus === 'PIN_CREATED'
        ? 'Tu PIN de 4 dígitos ha quedado registrado y tu sesión está activa.'
        : 'Sesión iniciada correctamente.',
    token,
    user: sessionUser,
  });
});

/**
 * 3. Verificar sesión persistente actual
 * GET /api/auth/me
 */
router.get('/me', requireAuth, (req, res) => {
  return res.json({ user: req.user });
});

/**
 * 4. Acceso rápido para acompañantes/invitados que escanearon el QR de una mesa
 * POST /api/auth/guest-access
 * Body: { nombre: string, mesa: string }
 */
const MAX_GUEST_CREATIONS_PER_IP = 20;
const guestCreationBuckets = new Map();

function isGuestRateLimited(ip, now) {
  if (guestCreationBuckets.size > 2000) {
    for (const [k, v] of guestCreationBuckets.entries()) {
      if (now - v.firstAttemptAt > PIN_WINDOW_MS) {
        guestCreationBuckets.delete(k);
      }
    }
  }
  const entry = guestCreationBuckets.get(ip);
  if (!entry || now - entry.firstAttemptAt > PIN_WINDOW_MS) {
    guestCreationBuckets.set(ip, { count: 1, firstAttemptAt: now });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_GUEST_CREATIONS_PER_IP;
}

router.post('/guest-access', (req, res) => {
  const clientIp = getClientIp(req);
  if (isGuestRateLimited(clientIp, Date.now())) {
    return res.status(429).json({
      error: 'Demasiados registros recientes desde esta conexión. Espera unos minutos antes de volver a intentar.',
    });
  }

  const nombre = String(req.body.nombre || req.body.nombre_completo || '')
    .trim()
    .slice(0, 100);
  const mesa = String(req.body.mesa || 'Mesa General')
    .trim()
    .slice(0, 60);

  if (!nombre) {
    return res.status(400).json({
      error: 'Por favor ingresa tu nombre o el de tu familia para identificarte en la mesa.',
    });
  }

  const normalized = normalizeText(nombre);
  const now = new Date().toISOString();
  const guestId = `guest-${crypto.randomUUID().slice(0, 10)}`;

  db.prepare(`
    INSERT INTO User (id, nombre_completo, nombre_normalizado, distintivo_homonimo, mesa, pin_hash, rol, activo, created_at, updated_at)
    VALUES (?, ?, ?, 'Invitado de Mesa', ?, NULL, 'INVITADO', 1, ?, ?)
  `).run(guestId, nombre, normalized, mesa, now, now);

  const sessionUser = {
    id: guestId,
    nombre_completo: nombre,
    distintivo_homonimo: 'Invitado de Mesa',
    mesa,
    rol: 'INVITADO',
    tiene_pin: false,
  };

  const token = signToken({
    id: guestId,
    rol: 'INVITADO',
    nombre,
  });

  return res.json({
    status: 'GUEST_AUTHENTICATED',
    message: `¡Bienvenido(a), ${nombre}! Te has unido a la ${mesa}.`,
    token,
    user: sessionUser,
  });
});

module.exports = {
  authRouter: router,
  requireAuth,
  requireAdmin,
};

