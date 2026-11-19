const express = require('express');
const cors = require('cors');
const path = require('node:path');
const fs = require('node:fs');
const { db, STORAGE_UPLOADS_DIR } = require('./db/database');
const { authRouter } = require('./routes/auth');
const { mediaRouter } = require('./routes/media');
const { adminRouter } = require('./routes/admin');
const { addClient, getConnectedCount } = require('./realtime/liveHub');

const app = express();
const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || '0.0.0.0';
const FRONTEND_DIST_DIR = path.resolve(__dirname, '../../frontend/dist');

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Visitor-Id'],
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Servir archivos multimedia del bucket local (/storage/uploads) con cabeceras CORS, nosniff y sandbox para SVGs
app.use(
  '/uploads',
  express.static(STORAGE_UPLOADS_DIR, {
    setHeaders: (res, filePath) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      if (String(filePath || '').toLowerCase().endsWith('.svg')) {
        res.setHeader(
          'Content-Security-Policy',
          "sandbox; default-src 'none'; style-src 'unsafe-inline'"
        );
      }
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
    'X-Accel-Buffering': 'no',
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

// En producción / hosting: servir el frontend compilado (frontend/dist) desde un único servidor
if (fs.existsSync(path.join(FRONTEND_DIST_DIR, 'index.html'))) {
  app.use(express.static(FRONTEND_DIST_DIR));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }
    return res.sendFile(path.join(FRONTEND_DIST_DIR, 'index.html'));
  });
}

// Manejador de errores global (incluye límites de tamaño y formato de Multer)
app.use((err, _req, res, _next) => {
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: 'El archivo supera el límite máximo permitido de 50 MB.',
    });
  }
  const statusCode = Number(err?.status) || 500;
  if (statusCode >= 500) {
    console.error('[Backend Error]:', err);
  }
  return res.status(statusCode).json({
    error: err?.message || 'Error interno en el servidor.',
  });
});

app.listen(PORT, HOST, () => {
  console.log(`====================================================================`);
  console.log(`  GALA DE GRADUACION UNIVERSITARIA - BACKEND API & REALTIME SERVER  `);
  console.log(`  Servidor activo en: http://${HOST}:${PORT}                        `);
  console.log(`  Almacenamiento en:  ${STORAGE_UPLOADS_DIR}                        `);
  console.log(`====================================================================`);
});

