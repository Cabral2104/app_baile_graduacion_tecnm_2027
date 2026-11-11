const express = require('express');
const path = require('node:path');
const crypto = require('node:crypto');
const multer = require('multer');
const { db, STORAGE_UPLOADS_DIR } = require('../db/database');
const { requireAuth } = require('./auth');
const { broadcastEvent } = require('../realtime/liveHub');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, STORAGE_UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.mp4', '.mov', '.webm', '.svg'].includes(ext)
      ? ext
      : '.jpg';
    cb(null, `media_${Date.now()}_${crypto.randomUUID().slice(0, 8)}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
});

const VALID_ORIGENES = ['PRE_EVENTO', 'EN_VIVO', 'FOTOGRAFO'];
const VALID_ETAPAS = ['INICIO', 'SUPERVIVENCIA', 'RECTA_FINAL', 'GALA'];

router.post('/presign', requireAuth, (req, res) => {
  const { filename, mimeType, sizeBytes } = req.body || {};
  if (sizeBytes && Number(sizeBytes) > 50 * 1024 * 1024) {
    return res.status(400).json({ error: 'El archivo excede el límite máximo permitido de 50 MB.' });
  }

  const objectKey = `gala2026/${Date.now()}_${crypto.randomUUID().slice(0, 8)}_${String(filename || 'media').replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  return res.json({
    strategy: 'HYBRID_MULTIPART_OR_R2',
    uploadEndpoint: '/api/media/upload',
    objectKey,
    mimeType: mimeType || 'image/webp',
    expiresInSeconds: 900,
  });
});

router.post('/upload', requireAuth, upload.single('archivo'), (req, res) => {
  const config = db.prepare('SELECT * FROM SystemConfig WHERE id = 1').get();

  if (!req.file) {
    return res.status(400).json({ error: 'No se recibió ningún archivo multimedia.' });
  }

  const rawOrigen = String(req.body.origen || config.fase_actual || 'PRE_EVENTO').toUpperCase();
  const origen = VALID_ORIGENES.includes(rawOrigen) ? rawOrigen : 'PRE_EVENTO';

  // Reglas estrictas de recepción de fotos según la fase activa del evento:
  // 1. PRE_EVENTO ("Antes de la Fiesta"): solo se permiten subidas de PRE_EVENTO (Modo Memoria) o FOTOGRAFO (si es ADMIN).
  // 2. EN_VIVO ("Día de la Fiesta"): solo se permiten subidas de EN_VIVO (Día de la Fiesta) o FOTOGRAFO (si es ADMIN).
  // 3. MEMORIA ("Fiesta Terminada"): nadie puede subir excepto usuarios con rol ADMIN.
  const faseActual = config.fase_actual || 'PRE_EVENTO';
  const isAdmin = req.user.rol === 'ADMIN';

  if (origen === 'FOTOGRAFO' && !isAdmin) {
    return res.status(403).json({
      error: 'Solo las organizadoras pueden subir fotografías al Álbum del Fotógrafo Oficial.',
    });
  }

  if (faseActual === 'PRE_EVENTO') {
    if (origen === 'EN_VIVO') {
      return res.status(403).json({
        error:
          'El evento está en la fase "Antes de la Fiesta". En este momento solo se permiten subir recuerdos en el apartado 1. Modo Memoria.',
      });
    }
  } else if (faseActual === 'EN_VIVO') {
    if (origen === 'PRE_EVENTO') {
      return res.status(403).json({
        error:
          'El evento está en la fase "Día de la Fiesta". La recepción de recuerdos previos concluyó y solo se permiten subir fotos del Día de la Fiesta.',
      });
    }
  } else if (faseActual === 'MEMORIA' || !config.subidas_abiertas) {
    if (!isAdmin) {
      return res.status(403).json({
        error:
          'La fase actual es "Fiesta Terminada" (Subidas Cerradas). Solo las organizadoras (rol Admin) pueden agregar archivos.',
      });
    }
  }

  const rawEtapa = String(req.body.etapa || (origen === 'EN_VIVO' ? 'GALA' : 'INICIO')).toUpperCase();
  const etapa = VALID_ETAPAS.includes(rawEtapa) ? rawEtapa : 'INICIO';

  const pieDeFoto = String(req.body.pie_de_foto || '').trim();
  if (!pieDeFoto) {
    return res.status(400).json({
      error: 'El pie de foto o descripción del recuerdo es obligatorio.',
    });
  }

  const mimeType = req.file.mimetype || 'image/jpeg';
  const isVideo = mimeType.startsWith('video/') || ['.mp4', '.mov', '.webm'].includes(path.extname(req.file.filename).toLowerCase());
  const tipoMedio = isVideo ? 'VIDEO' : 'FOTO';
  const duracionSeg = req.body.duracion_seg ? Number(req.body.duracion_seg) : null;

  if (isVideo && duracionSeg && duracionSeg > 46) {
    return res.status(400).json({
      error: 'Los videos cortos no deben exceder los 45 segundos de duración.',
    });
  }

  let estadoInicial = 'PENDIENTE';
  let moderadoPorId = null;
  let moderadoEn = null;
  const now = new Date().toISOString();

  if (req.user.rol === 'ADMIN' && origen === 'FOTOGRAFO') {
    estadoInicial = 'APROBADO_FOTOGRAFO';
    moderadoPorId = req.user.id;
    moderadoEn = now;
  } else if (origen === 'EN_VIVO' && config.moderacion_automatica_qr === 1) {
    estadoInicial = 'APROBADO_GALERIA';
    moderadoEn = now;
  }

  const mediaId = `med-${crypto.randomUUID().slice(0, 12)}`;
  const archivoUrl = `/uploads/${req.file.filename}`;

  db.prepare(`
    INSERT INTO MediaItem (
      id, usuario_id, origen, etapa, pie_de_foto, estado, tipo_medio,
      archivo_url, miniatura_url, nombre_original, mime_type, tamano_bytes,
      duracion_seg, solicitud_retiro, motivo_retiro, moderado_por_id, moderado_en, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?, ?)
  `).run(
    mediaId,
    req.user.id,
    origen,
    etapa,
    pieDeFoto,
    estadoInicial,
    tipoMedio,
    archivoUrl,
    archivoUrl,
    req.file.originalname || req.file.filename,
    mimeType,
    req.file.size,
    duracionSeg,
    moderadoPorId,
    moderadoEn,
    now
  );

  const createdItem = db.prepare(`
    SELECT m.*, u.nombre_completo as autor_nombre, u.distintivo_homonimo as autor_distintivo, u.mesa as autor_mesa
    FROM MediaItem m
    JOIN User u ON u.id = m.usuario_id
    WHERE m.id = ?
  `).get(mediaId);

  broadcastEvent('MEDIA_UPLOADED', { item: createdItem });
  if (estadoInicial !== 'PENDIENTE') {
    broadcastEvent('MEDIA_APPROVED', { item: createdItem });
  }

  return res.status(201).json({
    message: 'Archivo recibido correctamente.',
    item: createdItem,
  });
});

/**
 * Galería Pública: devuelve los elementos aprobados para Modo Memoria (APROBADO_VIDEO),
 * Día de la Fiesta (APROBADO_GALERIA) y Álbum Fotógrafo (APROBADO_FOTOGRAFO).
 * Soporta filtrado opcional (?estado=...&etapa=...) y paginación (?page=1&limit=6).
 */
router.get('/public', (req, res) => {
  const { estado, etapa, page, limit } = req.query || {};

  const allItems = db.prepare(`
    SELECT
      m.*,
      u.nombre_completo as autor_nombre,
      u.distintivo_homonimo as autor_distintivo,
      u.mesa as autor_mesa,
      s.orden as storyboard_orden,
      s.duracion_display_seg,
      s.transicion
    FROM MediaItem m
    JOIN User u ON u.id = m.usuario_id
    LEFT JOIN SequenceOrder s ON s.media_item_id = m.id
    WHERE m.estado IN ('APROBADO_VIDEO', 'APROBADO_GALERIA', 'APROBADO_FOTOGRAFO')
      AND m.solicitud_retiro = 0
    ORDER BY
      CASE WHEN s.orden IS NULL THEN 999999 ELSE s.orden END ASC,
      m.created_at DESC
  `).all();

  const counts = {
    APROBADO_VIDEO: allItems.filter((i) => i.estado === 'APROBADO_VIDEO').length,
    APROBADO_GALERIA: allItems.filter((i) => i.estado === 'APROBADO_GALERIA').length,
    APROBADO_FOTOGRAFO: allItems.filter(
      (i) =>
        i.estado === 'APROBADO_FOTOGRAFO' ||
        (i.origen === 'FOTOGRAFO' &&
          i.estado !== 'APROBADO_VIDEO' &&
          i.estado !== 'APROBADO_GALERIA')
    ).length,
  };

  let filtered = allItems;
  if (estado) {
    filtered = filtered.filter((i) => i.estado === String(estado));
  }
  if (etapa && etapa !== 'TODAS') {
    filtered = filtered.filter((i) => i.etapa === String(etapa));
  }

  const pageNum = page ? Math.max(1, Number(page)) : null;
  const pageSize = limit ? Math.max(1, Math.min(50, Number(limit))) : null;
  const totalItems = filtered.length;
  const totalPages = pageSize ? Math.max(1, Math.ceil(totalItems / pageSize)) : 1;

  const paginatedItems =
    pageNum && pageSize
      ? filtered.slice((pageNum - 1) * pageSize, pageNum * pageSize)
      : filtered;

  const config = db.prepare('SELECT * FROM SystemConfig WHERE id = 1').get();

  return res.json({
    config: {
      ...config,
      subidas_abiertas: Boolean(config.subidas_abiertas),
      moderacion_automatica_qr: Boolean(config.moderacion_automatica_qr),
    },
    counts,
    pagination: {
      page: pageNum || 1,
      limit: pageSize || totalItems,
      totalItems,
      totalPages,
    },
    items: paginatedItems,
  });
});

router.get('/my-uploads', requireAuth, (req, res) => {
  const items = db.prepare(`
    SELECT m.*, s.orden as storyboard_orden
    FROM MediaItem m
    LEFT JOIN SequenceOrder s ON s.media_item_id = m.id
    WHERE m.usuario_id = ?
    ORDER BY m.created_at DESC
  `).all(req.user.id);

  return res.json({ items });
});

router.post('/:id/request-takedown', (req, res) => {
  const { id } = req.params;
  const { motivo, solicitante } = req.body || {};

  const existing = db.prepare('SELECT id, pie_de_foto FROM MediaItem WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Elemento multimedia no encontrado.' });
  }

  const motivoTexto = `${solicitante ? `[${solicitante}] ` : ''}${motivo || 'Solicitud de privacidad'}`.trim();

  db.prepare(`
    UPDATE MediaItem
    SET solicitud_retiro = 1, motivo_retiro = ?
    WHERE id = ?
  `).run(motivoTexto, id);

  broadcastEvent('MEDIA_TAKEDOWN_REQUESTED', { id, motivo: motivoTexto });

  return res.json({
    message: 'La fotografía ha sido ocultada de la galería pública para revisión del comité.',
  });
});

module.exports = { mediaRouter: router };
