const express = require('express');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { db, DB_PATH, STORAGE_UPLOADS_DIR, STORAGE_EXPORTS_DIR } = require('../db/database');
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
    WHERE u.activo = 1 AND u.rol IN ('ALUMNO', 'ADMIN')
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
 * 2b. Moderación en lote (ej. aprobar todas las fotos pendientes visibles)
 * POST /api/admin/media/moderate-batch
 * Body: { ids: string[], mode?: 'BY_ORIGIN' | 'APROBADO_VIDEO' | 'APROBADO_GALERIA' | 'RECHAZADO' }
 */
router.post('/media/moderate-batch', requireAdmin, (req, res) => {
  const rawIds = Array.isArray(req.body?.ids) ? req.body.ids : [];
  const ids = Array.from(
    new Set(rawIds.map((id) => String(id || '').trim()).filter(Boolean))
  ).slice(0, 200);

  if (ids.length === 0) {
    return res.status(400).json({ error: 'No se seleccionaron elementos para moderar.' });
  }

  const rawMode = String(req.body?.mode || 'BY_ORIGIN').toUpperCase();
  const allowedModes = ['BY_ORIGIN', 'APROBADO_VIDEO', 'APROBADO_GALERIA', 'RECHAZADO'];
  const mode = allowedModes.includes(rawMode) ? rawMode : 'BY_ORIGIN';

  const now = new Date().toISOString();
  let updatedCount = 0;
  let videoCount = 0;
  let galleryCount = 0;
  let touchedStoryboard = false;

  const selectItemStmt = db.prepare('SELECT id, origen, tipo_medio, duracion_seg FROM MediaItem WHERE id = ?');
  const updateMediaStmt = db.prepare(`
    UPDATE MediaItem
    SET estado = ?, moderado_por_id = ?, moderado_en = ?, solicitud_retiro = 0
    WHERE id = ?
  `);
  const existingSeqStmt = db.prepare('SELECT id FROM SequenceOrder WHERE media_item_id = ?');
  const maxOrdenStmt = db.prepare('SELECT COALESCE(MAX(orden), 0) as maxOrden FROM SequenceOrder');
  const insertSeqStmt = db.prepare(`
    INSERT INTO SequenceOrder (id, media_item_id, orden, duracion_display_seg, transicion, notas_editor, updated_at)
    VALUES (?, ?, ?, ?, 'KEN_BURNS', ?, ?)
  `);
  const deleteSeqStmt = db.prepare('DELETE FROM SequenceOrder WHERE media_item_id = ?');

  db.exec('BEGIN');
  try {
    let nextOrden = (maxOrdenStmt.get()?.maxOrden || 0) + 1;

    for (const id of ids) {
      const item = selectItemStmt.get(id);
      if (!item) continue;

      const targetEstado =
        mode === 'BY_ORIGIN'
          ? item.origen === 'PRE_EVENTO'
            ? 'APROBADO_VIDEO'
            : 'APROBADO_GALERIA'
          : mode;

      updateMediaStmt.run(targetEstado, req.user.id, now, id);
      updatedCount++;

      if (targetEstado === 'APROBADO_VIDEO') {
        videoCount++;
        if (!existingSeqStmt.get(id)) {
          const defaultDur =
            item.tipo_medio === 'VIDEO' && item.duracion_seg
              ? Math.round(item.duracion_seg)
              : 4;
          insertSeqStmt.run(
            crypto.randomUUID(),
            id,
            nextOrden++,
            defaultDur,
            `Aprobado en lote por ${req.user.nombre_completo}`,
            now
          );
          touchedStoryboard = true;
        }
      } else {
        if (targetEstado === 'APROBADO_GALERIA') galleryCount++;
        const delResult = deleteSeqStmt.run(id);
        if (delResult.changes > 0) touchedStoryboard = true;
      }
    }

    if (touchedStoryboard) {
      compactStoryboardOrder();
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    return res.status(500).json({ error: err?.message || 'Error al moderar el lote seleccionado.' });
  }

  broadcastEvent(mode === 'RECHAZADO' ? 'MEDIA_MODERATED' : 'MEDIA_APPROVED', {
    batch: true,
    updatedCount,
  });
  if (touchedStoryboard) {
    broadcastEvent('SEQUENCE_UPDATED', { batch: true });
  }

  return res.json({
    message: `Se procesaron ${updatedCount} archivo(s) (${videoCount} a Memorias/Video, ${galleryCount} a Día de la Fiesta).`,
    updatedCount,
    videoCount,
    galleryCount,
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
 * 4. Exportación en ZIP con renombrado secuencial automático
 * GET /api/admin/export-zip?scope=STORYBOARD|FIESTA|FOTOGRAFO
 */
router.get('/export-zip', requireAdmin, (req, res) => {
  const scope = String(req.query.scope || 'STORYBOARD').toUpperCase();

  if (scope === 'FIESTA' || scope === 'FOTOGRAFO') {
    const isFiesta = scope === 'FIESTA';
    const rows = isFiesta
      ? db.prepare(`
          SELECT
            m.*,
            u.nombre_completo as autor_nombre,
            u.distintivo_homonimo as autor_distintivo,
            u.mesa as autor_mesa,
            COALESCE((SELECT COUNT(*) FROM MediaReaction r WHERE r.media_item_id = m.id), 0) as reacciones_total
          FROM MediaItem m
          JOIN User u ON u.id = m.usuario_id
          WHERE m.estado = 'APROBADO_GALERIA' AND m.solicitud_retiro = 0
          ORDER BY m.created_at ASC
        `).all()
      : db.prepare(`
          SELECT
            m.*,
            u.nombre_completo as autor_nombre,
            u.distintivo_homonimo as autor_distintivo,
            u.mesa as autor_mesa,
            COALESCE((SELECT COUNT(*) FROM MediaReaction r WHERE r.media_item_id = m.id), 0) as reacciones_total
          FROM MediaItem m
          JOIN User u ON u.id = m.usuario_id
          WHERE (
            m.estado = 'APROBADO_FOTOGRAFO' OR
            (m.origen = 'FOTOGRAFO' AND m.estado NOT IN ('APROBADO_VIDEO', 'APROBADO_GALERIA', 'RECHAZADO'))
          )
          AND m.solicitud_retiro = 0
          ORDER BY m.created_at ASC
        `).all();

    const zipEntries = [];
    const titleLabel = isFiesta ? 'DIA DE LA FIESTA EN VIVO' : 'ALBUM DEL FOTOGRAFO OFICIAL';
    const manifestLines = [
      '========================================================================',
      `${titleLabel} - GRADUACION TECNM`,
      `Generado el: ${new Date().toLocaleString('es-MX')}`,
      `Total de archivos incluidos: ${rows.length}`,
      '========================================================================',
      '',
    ];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const seqPrefix = String(i + 1).padStart(3, '0');
      const diskFilename = path.basename(row.archivo_url);
      const fullPath = path.join(STORAGE_UPLOADS_DIR, diskFilename);
      const ext = path.extname(diskFilename) || (row.tipo_medio === 'VIDEO' ? '.mp4' : '.jpg');
      const cleanMesa = String(row.autor_mesa || 'Gala')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Z0-9]+/gi, '_');
      const exportFilename = isFiesta
        ? `${seqPrefix}_${cleanMesa}_${row.tipo_medio === 'VIDEO' ? 'clip' : 'foto'}${ext}`
        : `${seqPrefix}_Oficial${ext}`;

      if (fs.existsSync(fullPath)) {
        zipEntries.push({
          name: exportFilename,
          data: fs.readFileSync(fullPath),
        });
      }

      manifestLines.push(
        `[${seqPrefix}] Archivo: ${exportFilename}`,
        `      Autor: ${row.autor_nombre} (${row.autor_mesa || row.autor_distintivo || 'Invitado'})`,
        `      Reacciones: ${row.reacciones_total || 0}`,
        `      Dedicatoria: "${row.pie_de_foto}"`,
        ''
      );
    }

    zipEntries.unshift({
      name: isFiesta ? '000_INDICE_FIESTA.txt' : '000_INDICE_FOTOGRAFO.txt',
      data: Buffer.from(manifestLines.join('\n'), 'utf8'),
    });

    const zipBuffer = buildZipBuffer(zipEntries);
    const outName = isFiesta
      ? 'Dia_De_La_Fiesta_TECNM.zip'
      : 'Album_Fotografo_Oficial_TECNM.zip';

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${outName}"`);
    res.setHeader('Content-Length', zipBuffer.length);
    return res.send(zipBuffer);
  }

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
 * 4b. Respaldo íntegro de la base de datos SQLite en un solo archivo descargable
 * GET /api/admin/backup-db
 */
router.get('/backup-db', requireAdmin, (_req, res) => {
  const tempBackupPath = path.join(
    STORAGE_EXPORTS_DIR,
    `backup_graduacion_${Date.now()}_${crypto.randomUUID().slice(0, 6)}.db`
  );

  try {
    const safeSqlPath = tempBackupPath.replace(/'/g, "''");
    db.exec(`VACUUM INTO '${safeSqlPath}'`);
    const dbBuffer = fs.readFileSync(tempBackupPath);
    const dateStamp = new Date().toISOString().slice(0, 10);

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="Respaldo_Graduacion_TECNM_${dateStamp}.db"`
    );
    res.setHeader('Content-Length', dbBuffer.length);
    return res.send(dbBuffer);
  } catch {
    // Respaldo alterno directo tras checkpoint WAL si VACUUM INTO fallara
    try {
      db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
      const fallbackBuffer = fs.readFileSync(DB_PATH);
      const dateStamp = new Date().toISOString().slice(0, 10);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="Respaldo_Graduacion_TECNM_${dateStamp}.db"`
      );
      res.setHeader('Content-Length', fallbackBuffer.length);
      return res.send(fallbackBuffer);
    } catch (err) {
      return res.status(500).json({ error: 'No fue posible generar el respaldo de la base de datos.' });
    }
  } finally {
    if (fs.existsSync(tempBackupPath)) {
      try {
        fs.unlinkSync(tempBackupPath);
      } catch {
        // Ignorar limpieza temporal
      }
    }
  }
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
 * 6b. Editar datos de un alumno/invitado (nombre, carrera/grupo, mesa, rol)
 * PATCH /api/admin/users/:id
 */
router.patch('/users/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM User WHERE id = ? AND activo = 1').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Invitado no encontrado en el padrón.' });
  }

  const nextNombre =
    req.body.nombre_completo !== undefined
      ? String(req.body.nombre_completo).trim()
      : existing.nombre_completo;
  if (!nextNombre) {
    return res.status(400).json({ error: 'El nombre completo no puede estar vacío.' });
  }

  const nextDistintivo =
    req.body.distintivo_homonimo !== undefined
      ? String(req.body.distintivo_homonimo || '').trim() || null
      : existing.distintivo_homonimo;
  const nextMesa =
    req.body.mesa !== undefined
      ? String(req.body.mesa || '').trim() || 'Mesa por asignar'
      : existing.mesa;
  const nextRol =
    req.body.rol === 'ADMIN' || req.body.rol === 'ALUMNO' ? req.body.rol : existing.rol;

  if (id === req.user.id && nextRol !== 'ADMIN') {
    return res.status(400).json({
      error: 'No puedes retirar tus propios permisos de organizadora mientras tienes sesión activa.',
    });
  }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE User
    SET nombre_completo = ?, nombre_normalizado = ?, distintivo_homonimo = ?, mesa = ?, rol = ?, updated_at = ?
    WHERE id = ?
  `).run(
    nextNombre,
    normalizeText(`${nextNombre} ${nextDistintivo || ''}`),
    nextDistintivo,
    nextMesa,
    nextRol,
    now,
    id
  );

  return res.json({
    message: `Datos de ${nextNombre} actualizados correctamente.`,
  });
});

/**
 * 6c. Dar de baja / eliminar registro duplicado del padrón
 * DELETE /api/admin/users/:id
 */
router.delete('/users/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  if (id === req.user.id) {
    return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta de organizadora activa.' });
  }

  const existing = db.prepare('SELECT id, nombre_completo FROM User WHERE id = ? AND activo = 1').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Invitado no encontrado en el padrón.' });
  }

  const now = new Date().toISOString();
  db.prepare('UPDATE User SET activo = 0, updated_at = ? WHERE id = ?').run(now, id);

  return res.json({
    message: `${existing.nombre_completo} fue retirado(a) del padrón activo.`,
    userId: id,
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
    subtitulo_evento,
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
      subtitulo_evento = COALESCE(?, subtitulo_evento),
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
    subtitulo_evento !== undefined ? subtitulo_evento : null,
    now
  );

  const updated = db.prepare('SELECT * FROM SystemConfig WHERE id = 1').get();
  const normalizedConfig = {
    ...updated,
    subidas_abiertas: Boolean(updated.subidas_abiertas),
    moderacion_automatica_qr: Boolean(updated.moderacion_automatica_qr),
  };

  broadcastEvent('CONFIG_UPDATED', { config: normalizedConfig });

  const hasIdentityUpdate =
    titulo_evento !== undefined ||
    nombre_generacion !== undefined ||
    subtitulo_evento !== undefined ||
    url_video_oficial !== undefined;

  let responseMessage = `Fase del sistema actualizada a ${nextFase}`;
  if (!fase_actual && typeof moderacion_automatica_qr === 'boolean' && !hasIdentityUpdate) {
    responseMessage = nextAutoMod
      ? 'Publicación directa en la fiesta activada.'
      : 'Modo seguro activado: las fotos requerirán aprobación previa.';
  } else if (!fase_actual && hasIdentityUpdate) {
    responseMessage = 'Datos del evento y video oficial actualizados correctamente.';
  }

  return res.json({
    message: responseMessage,
    config: normalizedConfig,
  });
});

module.exports = { adminRouter: router };

