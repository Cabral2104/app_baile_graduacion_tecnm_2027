const express = require('express');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { db, STORAGE_UPLOADS_DIR } = require('../db/database');
const { requireAdmin } = require('./auth');
const { normalizeText } = require('../utils/security');
const { buildZipBuffer } = require('../utils/zipBuilder');
const { broadcastEvent, getConnectedCount } = require('../realtime/liveHub');

const router = express.Router();

/**
 * Re-secuencia los elementos del Storyboard para mantener numeración continua 1..N.
 */
function compactStoryboardOrder() {
  const rows = db.prepare('SELECT id FROM SequenceOrder ORDER BY orden ASC, updated_at ASC').all();
  const updateStmt = db.prepare('UPDATE SequenceOrder SET orden = ? WHERE id = ?');
  rows.forEach((row, index) => {
    updateStmt.run(index + 1, row.id);
  });
}

/**
 * 1. Vista integral para el Panel de Administradoras
 * GET /api/admin/overview
 */
router.get('/overview', requireAdmin, (_req, res) => {
  const mediaItems = db.prepare(`
    SELECT
      m.*,
      u.nombre_completo as autor_nombre,
      u.distintivo_homonimo as autor_distintivo,
      u.mesa as autor_mesa,
      mod.nombre_completo as moderador_nombre,
      s.orden as storyboard_orden,
      s.duracion_display_seg,
      s.transicion,
      COALESCE((SELECT COUNT(*) FROM MediaReaction r WHERE r.media_item_id = m.id AND r.tipo = 'CORAZON'), 0) as reacciones_corazon,
      COALESCE((SELECT COUNT(*) FROM MediaReaction r WHERE r.media_item_id = m.id AND r.tipo = 'ESTRELLA'), 0) as reacciones_estrella,
      COALESCE((SELECT COUNT(*) FROM MediaReaction r WHERE r.media_item_id = m.id), 0) as reacciones_total
    FROM MediaItem m
    JOIN User u ON u.id = m.usuario_id
    LEFT JOIN User mod ON mod.id = m.moderado_por_id
    LEFT JOIN SequenceOrder s ON s.media_item_id = m.id
    ORDER BY m.created_at DESC
  `).all();

  const storyboard = db.prepare(`
    SELECT
      s.id as sequence_id,
      s.orden,
      s.duracion_display_seg,
      s.transicion,
      s.notas_editor,
      m.*,
      u.nombre_completo as autor_nombre,
      u.distintivo_homonimo as autor_distintivo,
      u.mesa as autor_mesa
    FROM SequenceOrder s
    JOIN MediaItem m ON m.id = s.media_item_id
    JOIN User u ON u.id = m.usuario_id
    ORDER BY s.orden ASC
  `).all();

  const users = db.prepare(`
    SELECT
      u.id,
      u.nombre_completo,
      u.distintivo_homonimo,
      u.mesa,
      u.rol,
      u.pin_hash,
      u.created_at,
      u.updated_at,
      COUNT(m.id) as total_subidas
    FROM User u
    LEFT JOIN MediaItem m ON m.usuario_id = u.id
    WHERE u.activo = 1
    GROUP BY u.id
    ORDER BY u.rol DESC, u.nombre_completo ASC
  `).all().map((u) => ({
    id: u.id,
    nombre_completo: u.nombre_completo,
    distintivo_homonimo: u.distintivo_homonimo,
    mesa: u.mesa,
    rol: u.rol,
    tiene_pin: Boolean(u.pin_hash),
    total_subidas: u.total_subidas,
    updated_at: u.updated_at,
  }));

  const config = db.prepare('SELECT * FROM SystemConfig WHERE id = 1').get();

  return res.json({
    config: {
      ...config,
      subidas_abiertas: Boolean(config.subidas_abiertas),
      moderacion_automatica_qr: Boolean(config.moderacion_automatica_qr),
    },
    stats: {
      pendientes: mediaItems.filter((i) => i.estado === 'PENDIENTE').length,
      aprobados_video: mediaItems.filter((i) => i.estado === 'APROBADO_VIDEO').length,
      aprobados_galeria: mediaItems.filter((i) => i.estado === 'APROBADO_GALERIA').length,
      aprobados_fotografo: mediaItems.filter((i) => i.estado === 'APROBADO_FOTOGRAFO').length,
      rechazados: mediaItems.filter((i) => i.estado === 'RECHAZADO').length,
      solicitudes_retiro: mediaItems.filter((i) => i.solicitud_retiro === 1).length,
      pantallas_conectadas: getConnectedCount(),
    },
    mediaItems,
    storyboard,
    users,
  });
});

/**
 * 2. Moderación "One-Tap" desde móvil o escritorio
 * PATCH /api/admin/media/:id/moderate
 * Body: { estado: 'APROBADO_VIDEO' | 'APROBADO_GALERIA' | 'RECHAZADO' | 'PENDIENTE', restaurarPrivacidad?: boolean }
 */
router.patch('/media/:id/moderate', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { estado, restaurarPrivacidad } = req.body || {};
  const validStates = ['PENDIENTE', 'APROBADO_VIDEO', 'APROBADO_GALERIA', 'APROBADO_FOTOGRAFO', 'RECHAZADO'];

  if (!validStates.includes(estado)) {
    return res.status(400).json({ error: 'Estado de moderación inválido.' });
  }

  const item = db.prepare('SELECT * FROM MediaItem WHERE id = ?').get(id);
  if (!item) {
    return res.status(404).json({ error: 'Archivo multimedia no encontrado.' });
  }

  const now = new Date().toISOString();
  const clearRetiro = restaurarPrivacidad ? 0 : item.solicitud_retiro;

  db.prepare(`
    UPDATE MediaItem
    SET estado = ?, moderado_por_id = ?, moderado_en = ?, solicitud_retiro = ?
    WHERE id = ?
  `).run(estado, req.user.id, now, clearRetiro, id);

  // Si se aprueba para el Video Conmemorativo, asegurar que esté en el Storyboard
  if (estado === 'APROBADO_VIDEO') {
    const existingSeq = db.prepare('SELECT id FROM SequenceOrder WHERE media_item_id = ?').get(id);
    if (!existingSeq) {
      const maxRow = db.prepare('SELECT COALESCE(MAX(orden), 0) as maxOrden FROM SequenceOrder').get();
      const nextOrden = (maxRow?.maxOrden || 0) + 1;
      const defaultDur = item.tipo_medio === 'VIDEO' && item.duracion_seg
        ? Math.round(item.duracion_seg)
        : 4;

      db.prepare(`
        INSERT INTO SequenceOrder (id, media_item_id, orden, duracion_display_seg, transicion, notas_editor, updated_at)
        VALUES (?, ?, ?, ?, 'KEN_BURNS', ?, ?)
      `).run(crypto.randomUUID(), id, nextOrden, defaultDur, `Aprobado por ${req.user.nombre_completo}`, now);
    }
  } else {
    // Si cambia a otro estado que no es APROBADO_VIDEO, remover del Storyboard y compactar
    db.prepare('DELETE FROM SequenceOrder WHERE media_item_id = ?').run(id);
    compactStoryboardOrder();
  }

  const updatedItem = db.prepare(`
    SELECT
      m.*,
      u.nombre_completo as autor_nombre,
      u.distintivo_homonimo as autor_distintivo,
      u.mesa as autor_mesa,
      s.orden as storyboard_orden,
      s.duracion_display_seg
    FROM MediaItem m
    JOIN User u ON u.id = m.usuario_id
    LEFT JOIN SequenceOrder s ON s.media_item_id = m.id
    WHERE m.id = ?
  `).get(id);

  if (estado === 'APROBADO_VIDEO' || estado === 'APROBADO_GALERIA') {
    broadcastEvent('MEDIA_APPROVED', { item: updatedItem });
  } else {
    broadcastEvent('MEDIA_MODERATED', { item: updatedItem });
  }

  return res.json({
    message: `Elemento actualizado a ${estado}`,
    item: updatedItem,
  });
});

/**
 * 3. Reordenar Storyboard Secuencial (Drag & Drop) y configurar duración de fotos
 * PUT /api/admin/storyboard/reorder
 * Body: { items: [{ media_item_id: string, duracion_display_seg?: number, transicion?: string }] }
 */
router.put('/storyboard/reorder', requireAdmin, (req, res) => {
  const { items } = req.body || {};
  if (!Array.isArray(items)) {
    return res.status(400).json({ error: 'Se requiere el arreglo ordenado de elementos del Storyboard.' });
  }

  const now = new Date().toISOString();
  const updateStmt = db.prepare(`
    UPDATE SequenceOrder
    SET orden = ?, duracion_display_seg = COALESCE(?, duracion_display_seg), transicion = COALESCE(?, transicion), updated_at = ?
    WHERE media_item_id = ?
  `);

  items.forEach((entry, idx) => {
    const mediaId = typeof entry === 'string' ? entry : entry.media_item_id;
    const duracion = typeof entry === 'object' && entry.duracion_display_seg ? Number(entry.duracion_display_seg) : null;
    const transicion = typeof entry === 'object' && entry.transicion ? String(entry.transicion) : null;
    updateStmt.run(idx + 1, duracion, transicion, now, mediaId);
  });

  broadcastEvent('SEQUENCE_UPDATED', { total: items.length });

  return res.json({
    message: 'Orden secuencial del Storyboard actualizado.',
  });
});

/**
 * 4. Exportación en ZIP con renombrado secuencial automático (001_foto.jpg, 002_clip.mp4)
 * GET /api/admin/export-zip
 */
router.get('/export-zip', requireAdmin, (_req, res) => {
  const storyboard = db.prepare(`
    SELECT
      s.orden,
      s.duracion_display_seg,
      s.transicion,
      m.id,
      m.etapa,
      m.origen,
      m.tipo_medio,
      m.pie_de_foto,
      m.archivo_url,
      m.nombre_original,
      u.nombre_completo as autor_nombre,
      u.distintivo_homonimo as autor_distintivo
    FROM SequenceOrder s
    JOIN MediaItem m ON m.id = s.media_item_id
    JOIN User u ON u.id = m.usuario_id
    ORDER BY s.orden ASC
  `).all();

  const zipEntries = [];
  const manifestLines = [
    '========================================================================',
    'GUION DE EDICION SECUENCIAL - VIDEO CONMEMORATIVO DE GRADUACION',
    `Generado el: ${new Date().toLocaleString('es-MX')}`,
    `Total de clips/fotos en secuencia: ${storyboard.length}`,
    '========================================================================',
    '',
  ];

  for (let i = 0; i < storyboard.length; i++) {
    const row = storyboard[i];
    const seqPrefix = String(i + 1).padStart(3, '0');
    const diskFilename = path.basename(row.archivo_url);
    const fullPath = path.join(STORAGE_UPLOADS_DIR, diskFilename);
    const ext = path.extname(diskFilename) || (row.tipo_medio === 'VIDEO' ? '.mp4' : '.jpg');
    const cleanEtapa = String(row.etapa || 'MEMORIA').replace(/[^A-Z0-9_]/gi, '');
    const cleanTipo = row.tipo_medio === 'VIDEO' ? 'clip' : 'foto';
    const exportFilename = `${seqPrefix}_${cleanEtapa}_${cleanTipo}${ext}`;

    if (fs.existsSync(fullPath)) {
      const fileBuffer = fs.readFileSync(fullPath);
      zipEntries.push({
        name: exportFilename,
        data: fileBuffer,
      });
    }

    manifestLines.push(
      `[${seqPrefix}] Archivo: ${exportFilename}`,
      `      Etapa: ${row.etapa} | Tipo: ${row.tipo_medio} | Duración sugerida: ${row.duracion_display_seg}s`,
      `      Autor: ${row.autor_nombre} (${row.autor_distintivo || 'Sin distintivo'})`,
      `      Pie de foto: "${row.pie_de_foto}"`,
      ''
    );
  }

  zipEntries.unshift({
    name: '000_GUION_STORYBOARD.txt',
    data: Buffer.from(manifestLines.join('\n'), 'utf8'),
  });

  zipEntries.push({
    name: 'manifest_storyboard.json',
    data: Buffer.from(JSON.stringify(storyboard, null, 2), 'utf8'),
  });

  const zipBuffer = buildZipBuffer(zipEntries);

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader(
    'Content-Disposition',
    'attachment; filename="Storyboard_Graduacion_Secuencial.zip"'
  );
  res.setHeader('Content-Length', zipBuffer.length);
  return res.send(zipBuffer);
});

/**
 * 5. Restablecer el PIN de cualquier alumno con un solo clic
 * POST /api/admin/users/:id/reset-pin
 */
router.post('/users/:id/reset-pin', requireAdmin, (req, res) => {
  const { id } = req.params;
  const user = db.prepare('SELECT id, nombre_completo FROM User WHERE id = ?').get(id);

  if (!user) {
    return res.status(404).json({ error: 'Alumno no encontrado.' });
  }

  const now = new Date().toISOString();
  db.prepare('UPDATE User SET pin_hash = NULL, updated_at = ? WHERE id = ?').run(now, id);

  return res.json({
    message: `El PIN de ${user.nombre_completo} ha sido restablecido. En su próximo ingreso podrá definir uno nuevo de 4 dígitos.`,
    userId: id,
  });
});

/**
 * 6. Agregar invitado o importar lote desde Excel/CSV a la lista oficial
 * POST /api/admin/users
 * Body: { nombre_completo, distintivo_homonimo, mesa, rol } o { batch: [...] }
 */
router.post('/users', requireAdmin, (req, res) => {
  const now = new Date().toISOString();
  const entries = Array.isArray(req.body.batch) ? req.body.batch : [req.body];

  const insertStmt = db.prepare(`
    INSERT INTO User (
      id, nombre_completo, nombre_normalizado, distintivo_homonimo,
      mesa, pin_hash, rol, activo, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, NULL, ?, 1, ?, ?)
  `);

  let createdCount = 0;
  for (const item of entries) {
    const nombre = String(item.nombre_completo || '').trim();
    if (!nombre) continue;
    const distintivo = String(item.distintivo_homonimo || '').trim() || null;
    const mesa = String(item.mesa || '').trim() || 'Mesa por asignar';
    const rol = item.rol === 'ADMIN' ? 'ADMIN' : 'ALUMNO';

    insertStmt.run(
      `usr-${crypto.randomUUID().slice(0, 8)}`,
      nombre,
      normalizeText(`${nombre} ${distintivo || ''}`),
      distintivo,
      mesa,
      rol,
      now,
      now
    );
    createdCount++;
  }

  return res.status(201).json({
    message: `Se agregaron ${createdCount} invitado(s) al padrón oficial.`,
    createdCount,
  });
});

/**
 * 7. Actualizar Configuración Global / Switch de Fase (PRE_EVENTO | EN_VIVO | MEMORIA)
 * PATCH /api/admin/config
 */
router.patch('/config', requireAdmin, (req, res) => {
  const current = db.prepare('SELECT * FROM SystemConfig WHERE id = 1').get();
  const {
    fase_actual,
    subidas_abiertas,
    moderacion_automatica_qr,
    duracion_foto_ensayo_seg,
    url_video_oficial,
    nombre_generacion,
    titulo_evento,
  } = req.body || {};

  const nextFase = ['PRE_EVENTO', 'EN_VIVO', 'MEMORIA'].includes(fase_actual)
    ? fase_actual
    : current.fase_actual;

  // Si se activa el Modo Memoria, cerrar subidas por defecto a menos que se indique lo contrario
  const nextSubidas =
    typeof subidas_abiertas === 'boolean'
      ? subidas_abiertas ? 1 : 0
      : nextFase === 'MEMORIA'
      ? 0
      : current.subidas_abiertas;

  const nextAutoMod =
    typeof moderacion_automatica_qr === 'boolean'
      ? moderacion_automatica_qr ? 1 : 0
      : current.moderacion_automatica_qr;

  const nextDuracion = duracion_foto_ensayo_seg
    ? Math.max(2, Math.min(15, Number(duracion_foto_ensayo_seg)))
    : current.duracion_foto_ensayo_seg;

  const now = new Date().toISOString();

  db.prepare(`
    UPDATE SystemConfig
    SET
      fase_actual = ?,
      subidas_abiertas = ?,
      moderacion_automatica_qr = ?,
      duracion_foto_ensayo_seg = ?,
      url_video_oficial = COALESCE(?, url_video_oficial),
      nombre_generacion = COALESCE(?, nombre_generacion),
      titulo_evento = COALESCE(?, titulo_evento),
      updated_at = ?
    WHERE id = 1
  `).run(
    nextFase,
    nextSubidas,
    nextAutoMod,
    nextDuracion,
    url_video_oficial !== undefined ? url_video_oficial : null,
    nombre_generacion || null,
    titulo_evento || null,
    now
  );

  const updated = db.prepare('SELECT * FROM SystemConfig WHERE id = 1').get();
  const normalizedConfig = {
    ...updated,
    subidas_abiertas: Boolean(updated.subidas_abiertas),
    moderacion_automatica_qr: Boolean(updated.moderacion_automatica_qr),
  };

  broadcastEvent('CONFIG_UPDATED', { config: normalizedConfig });

  return res.json({
    message: `Fase del sistema actualizada a ${nextFase}`,
    config: normalizedConfig,
  });
});

module.exports = { adminRouter: router };

