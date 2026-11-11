const express = require('express');
const { db } = require('../db/database');
const { normalizeText, hashPin, verifyPin, signToken, verifyToken } = require('../utils/security');

const router = express.Router();

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
      WHERE activo = 1
      ORDER BY rol DESC, nombre_completo ASC
      LIMIT 30
    `).all();
  } else {
    const terms = normalizedQuery.split(' ').filter(Boolean);
    const allUsers = db.prepare(`
      SELECT id, nombre_completo, nombre_normalizado, distintivo_homonimo, mesa, rol, pin_hash
      FROM User
      WHERE activo = 1
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
  } else {
    // Ingresos posteriores: verificar PIN contra el hash
    const isValid = verifyPin(cleanPin, user.pin_hash);
    if (!isValid) {
      return res.status(401).json({
        error: 'PIN incorrecto. Si olvidaste tu PIN, pide a una organizadora que lo restablezca desde su panel.',
      });
    }
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

module.exports = {
  authRouter: router,
  requireAuth,
  requireAdmin,
};

