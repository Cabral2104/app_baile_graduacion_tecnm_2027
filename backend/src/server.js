const express = require('express');
const cors = require('cors');
const path = require('node:path');
const { db, STORAGE_UPLOADS_DIR } = require('./db/database');
const { authRouter } = require('./routes/auth');
const { mediaRouter } = require('./routes/media');
const { adminRouter } = require('./routes/admin');
const { addClient, getConnectedCount } = require('./realtime/liveHub');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Servir archivos multimedia del bucket local (/storage/uploads) con cabeceras CORS para precarga Blob y descargas HD
app.use(
  '/uploads',
  express.static(STORAGE_UPLOADS_DIR, {
    setHeaders: (res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=31536000');
    },
  })
);

// Endpoint de salud y configuración pública del evento
app.get('/api/config', (_req, res) => {
  const config = db.prepare('SELECT * FROM SystemConfig WHERE id = 1').get();
  return res.json({
    config: {
      ...config,
      subidas_abiertas: Boolean(config.subidas_abiertas),
      moderacion_automatica_qr: Boolean(config.moderacion_automatica_qr),
    },
    liveConnections: getConnectedCount(),
  });
});

// Canal en Tiempo Real (SSE) para sincronización instantánea con /pantalla-en-vivo y Panel Admin
app.get('/api/live/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  res.write(`event: CONNECTED\ndata: ${JSON.stringify({ connectedAt: new Date().toISOString() })}\n\n`);
  addClient(res);

  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 20000);

  req.on('close', () => {
    clearInterval(heartbeat);
  });
});

// Rutas modulares de la API
app.use('/api/auth', authRouter);
app.use('/api/media', mediaRouter);
app.use('/api/admin', adminRouter);

// Manejador de errores global (incluye límites de tamaño de Multer)
app.use((err, _req, res, _next) => {
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: 'El archivo supera el límite máximo permitido de 50 MB.',
    });
  }
  console.error('[Backend Error]:', err);
  return res.status(500).json({
    error: err?.message || 'Error interno en el servidor.',
  });
});

app.listen(PORT, () => {
  console.log(`====================================================================`);
  console.log(`  GALA DE GRADUACION UNIVERSITARIA - BACKEND API & REALTIME SERVER  `);
  console.log(`  Servidor activo en: http://localhost:${PORT}                      `);
  console.log(`  Almacenamiento en:  ${STORAGE_UPLOADS_DIR}                        `);
  console.log(`====================================================================`);
});

