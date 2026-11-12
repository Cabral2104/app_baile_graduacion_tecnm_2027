const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { normalizeText, hashPin } = require('../utils/security');

const DB_PATH = path.resolve(__dirname, '../../graduacion.db');
const STORAGE_UPLOADS_DIR = path.resolve(__dirname, '../../../storage/uploads');
const STORAGE_EXPORTS_DIR = path.resolve(__dirname, '../../../storage/exports');

fs.mkdirSync(STORAGE_UPLOADS_DIR, { recursive: true });
fs.mkdirSync(STORAGE_EXPORTS_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH);

// Evitar errores SQLITE_BUSY (500 Internal Server Error) en accesos concurrentes
db.exec('PRAGMA busy_timeout = 5000;');
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

function initializeSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS User (
      id TEXT PRIMARY KEY,
      nombre_completo TEXT NOT NULL,
      nombre_normalizado TEXT NOT NULL,
      distintivo_homonimo TEXT,
      mesa TEXT,
      pin_hash TEXT,
      rol TEXT NOT NULL DEFAULT 'ALUMNO',
      activo INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_user_nombre_norm ON User(nombre_normalizado);

    CREATE TABLE IF NOT EXISTS MediaItem (
      id TEXT PRIMARY KEY,
      usuario_id TEXT NOT NULL,
      origen TEXT NOT NULL,
      etapa TEXT NOT NULL,
      pie_de_foto TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'PENDIENTE',
      tipo_medio TEXT NOT NULL DEFAULT 'FOTO',
      archivo_url TEXT NOT NULL,
      miniatura_url TEXT,
      nombre_original TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      tamano_bytes INTEGER NOT NULL DEFAULT 0,
      duracion_seg REAL,
      solicitud_retiro INTEGER NOT NULL DEFAULT 0,
      motivo_retiro TEXT,
      moderado_por_id TEXT,
      moderado_en TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (usuario_id) REFERENCES User(id) ON DELETE CASCADE,
      FOREIGN KEY (moderado_por_id) REFERENCES User(id)
    );

    CREATE INDEX IF NOT EXISTS idx_media_estado_origen ON MediaItem(estado, origen);
    CREATE INDEX IF NOT EXISTS idx_media_etapa ON MediaItem(etapa);

    CREATE TABLE IF NOT EXISTS SequenceOrder (
      id TEXT PRIMARY KEY,
      media_item_id TEXT NOT NULL UNIQUE,
      orden INTEGER NOT NULL,
      duracion_display_seg INTEGER NOT NULL DEFAULT 4,
      transicion TEXT NOT NULL DEFAULT 'CROSSFADE',
      notas_editor TEXT,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (media_item_id) REFERENCES MediaItem(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sequence_orden ON SequenceOrder(orden);

    CREATE TABLE IF NOT EXISTS SystemConfig (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      nombre_generacion TEXT NOT NULL DEFAULT 'Generación 2022 - 2026',
      titulo_evento TEXT NOT NULL DEFAULT 'Gala de Graduación Universitaria',
      subtitulo_evento TEXT NOT NULL DEFAULT 'Noche de Gala y Memoria Colectiva',
      fase_actual TEXT NOT NULL DEFAULT 'PRE_EVENTO',
      subidas_abiertas INTEGER NOT NULL DEFAULT 1,
      moderacion_automatica_qr INTEGER NOT NULL DEFAULT 0,
      duracion_foto_ensayo_seg INTEGER NOT NULL DEFAULT 4,
      url_video_oficial TEXT,
      codigo_acceso_salon TEXT NOT NULL DEFAULT 'GALA2026',
      updated_at TEXT NOT NULL
    );
  `);
}

function ensureSampleArtworkFile(filename, title, subtitle, stageTag, palette) {
  const filePath = path.join(STORAGE_UPLOADS_DIR, filename);
  const silver = palette.silver || '#E2E8F0';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1060" width="1600" height="1060">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${palette.bg1}" />
        <stop offset="50%" stop-color="${palette.bg2}" />
        <stop offset="100%" stop-color="${palette.bg3}" />
      </linearGradient>
      <radialGradient id="nebula" cx="50%" cy="38%" r="58%">
        <stop offset="0%" stop-color="${palette.nebula || '#2F5BD0'}" stop-opacity="0.38" />
        <stop offset="55%" stop-color="${palette.accent}" stop-opacity="0.14" />
        <stop offset="100%" stop-color="${palette.bg3}" stop-opacity="0" />
      </radialGradient>
      <linearGradient id="goldSilver" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="${silver}" />
        <stop offset="50%" stop-color="${palette.accent}" />
        <stop offset="100%" stop-color="${silver}" />
      </linearGradient>
    </defs>
    <rect width="1600" height="1060" fill="url(#bg)" />
    <rect width="1600" height="1060" fill="url(#nebula)" />

    <!-- Constelaciones y estrellas de la Noche Estrellada -->
    <g stroke="${silver}" stroke-opacity="0.28" stroke-width="1.2" fill="none">
      <polyline points="210,190 290,150 380,210 460,160 530,240" />
      <polyline points="1080,180 1170,140 1260,200 1350,150 1410,230" />
      <polyline points="640,290 730,240 800,310 880,250 960,300" />
    </g>

    <!-- Estrellas plateadas y doradas -->
    <g fill="${silver}" opacity="0.85">
      <circle cx="210" cy="190" r="3.5" />
      <circle cx="290" cy="150" r="4.5" />
      <circle cx="380" cy="210" r="3" />
      <circle cx="460" cy="160" r="5" fill="${palette.accent}" />
      <circle cx="530" cy="240" r="3.5" />
      <circle cx="1080" cy="180" r="3.5" />
      <circle cx="1170" cy="140" r="5" fill="${palette.accent}" />
      <circle cx="1260" cy="200" r="3.5" />
      <circle cx="1350" cy="150" r="4.5" />
      <circle cx="1410" cy="230" r="3" />
      <circle cx="640" cy="290" r="3.5" />
      <circle cx="730" cy="240" r="4.5" fill="${palette.accent}" />
      <circle cx="800" cy="310" r="5.5" />
      <circle cx="880" cy="250" r="4.5" fill="${palette.accent}" />
      <circle cx="960" cy="300" r="3.5" />
      <circle cx="180" cy="520" r="2.5" />
      <circle cx="310" cy="680" r="3" />
      <circle cx="1320" cy="560" r="3" />
      <circle cx="1420" cy="720" r="2.5" />
    </g>

    <!-- Destello estelar central de 4 puntas -->
    <path d="M800,330 Q800,395 865,395 Q800,395 800,460 Q800,395 735,395 Q800,395 800,330 Z" fill="${palette.accent}" fill-opacity="0.85" />
    <path d="M800,355 Q800,395 840,395 Q800,395 800,435 Q800,395 760,395 Q800,395 800,355 Z" fill="${silver}" />

    <!-- Marcos ornamentales en plata y oro -->
    <rect x="64" y="64" width="1472" height="932" rx="18" fill="none" stroke="url(#goldSilver)" stroke-opacity="0.55" stroke-width="2.5" />
    <rect x="86" y="86" width="1428" height="888" rx="12" fill="none" stroke="${silver}" stroke-opacity="0.22" stroke-width="1" />

    <!-- Aros celestes centrales -->
    <circle cx="800" cy="395" r="175" fill="none" stroke="${palette.accent}" stroke-opacity="0.38" stroke-width="1.8" />
    <circle cx="800" cy="395" r="130" fill="none" stroke="${silver}" stroke-opacity="0.28" stroke-width="1.2" stroke-dasharray="6 8" />
    <path d="M620,455 Q800,265 980,455" fill="none" stroke="url(#goldSilver)" stroke-opacity="0.6" stroke-width="2.5" />

    <text x="800" y="185" text-anchor="middle" fill="${palette.accent}" font-family="Cinzel, Georgia, serif" font-size="22" font-weight="600" letter-spacing="8">${stageTag}</text>
    <text x="800" y="675" text-anchor="middle" fill="#F8FAFC" font-family="Georgia, serif" font-size="60" font-style="italic">${title}</text>
    <text x="800" y="742" text-anchor="middle" fill="${silver}" font-family="sans-serif" font-size="26" letter-spacing="2">${subtitle}</text>
    <line x1="650" y1="802" x2="950" y2="802" stroke="url(#goldSilver)" stroke-opacity="0.65" stroke-width="1.8" />
    <text x="800" y="855" text-anchor="middle" fill="${palette.accent}" font-family="Cinzel, Georgia, serif" font-size="19" letter-spacing="5">DONDE TERMINA EL AULA Y COMIENZA NUESTRA HISTORIA · 2022 – 2026</text>
  </svg>`;

  fs.writeFileSync(filePath, svg, 'utf8');
  return Buffer.byteLength(svg, 'utf8');
}

function seedInitialData() {
  const now = new Date().toISOString();

  const existingConfig = db.prepare('SELECT id FROM SystemConfig WHERE id = 1').get();
  if (!existingConfig) {
    db.prepare(`
      INSERT INTO SystemConfig (
        id, nombre_generacion, titulo_evento, subtitulo_evento,
        fase_actual, subidas_abiertas, moderacion_automatica_qr,
        duracion_foto_ensayo_seg, url_video_oficial, codigo_acceso_salon, updated_at
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'Generación 2022 – 2026',
      'Graduación TECNM',
      'Tecnológico Nacional de México',
      'PRE_EVENTO',
      1,
      0,
      4,
      '',
      'GALA2026',
      now
    );
  }

  const userCount = db.prepare('SELECT COUNT(*) as total FROM User').get().total;
  if (userCount === 0) {
    const adminPinHash = hashPin('2026');
    const demoStudentPinHash = hashPin('1234');

    const initialUsers = [
      {
        id: 'usr-admin-sofia',
        nombre_completo: 'Sofía Villalobos Mondragón',
        distintivo_homonimo: 'Comité Organizador · Presidencia',
        mesa: 'Mesa de Honor 01',
        pin_hash: adminPinHash,
        rol: 'ADMIN',
      },
      {
        id: 'usr-admin-regina',
        nombre_completo: 'Regina Montes de Oca',
        distintivo_homonimo: 'Comité Organizador · Producción Audiovisual',
        mesa: 'Mesa de Honor 01',
        pin_hash: adminPinHash,
        rol: 'ADMIN',
      },
      {
        id: 'usr-maria-ind',
        nombre_completo: 'María Fernanda López García',
        distintivo_homonimo: 'Ingeniería Industrial · Grupo A',
        mesa: 'Mesa 04',
        pin_hash: null,
        rol: 'ALUMNO',
      },
      {
        id: 'usr-maria-arq',
        nombre_completo: 'María Fernanda López García',
        distintivo_homonimo: 'Arquitectura · Taller Sur',
        mesa: 'Mesa 11',
        pin_hash: null,
        rol: 'ALUMNO',
      },
      {
        id: 'usr-alejandro',
        nombre_completo: 'Alejandro Morales Vega',
        distintivo_homonimo: 'Ingeniería en Sistemas · Generación XXIV',
        mesa: 'Mesa 02',
        pin_hash: demoStudentPinHash,
        rol: 'ALUMNO',
      },
      {
        id: 'usr-valentina',
        nombre_completo: 'Valentina Castillo Ríos',
        distintivo_homonimo: 'Diseño y Comunicación Visual',
        mesa: 'Mesa 07',
        pin_hash: null,
        rol: 'ALUMNO',
      },
      {
        id: 'usr-santiago',
        nombre_completo: 'Santiago Herrera Mendoza',
        distintivo_homonimo: 'Finanzas y Contaduría Pública',
        mesa: 'Mesa 05',
        pin_hash: null,
        rol: 'ALUMNO',
      },
      {
        id: 'usr-camila',
        nombre_completo: 'Camila Domínguez Soto',
        distintivo_homonimo: 'Relaciones Internacionales',
        mesa: 'Mesa 09',
        pin_hash: null,
        rol: 'ALUMNO',
      },
      {
        id: 'usr-sebastian',
        nombre_completo: 'Sebastián Reyes Aguilar',
        distintivo_homonimo: 'Ingeniería Mecatrónica',
        mesa: 'Mesa 03',
        pin_hash: null,
        rol: 'ALUMNO',
      },
      {
        id: 'usr-diego-hom-1',
        nombre_completo: 'Diego Emiliano Vargas Cruz',
        distintivo_homonimo: 'Derecho Corporativo · Sección Matutina',
        mesa: 'Mesa 08',
        pin_hash: null,
        rol: 'ALUMNO',
      },
      {
        id: 'usr-diego-hom-2',
        nombre_completo: 'Diego Emiliano Vargas Cruz',
        distintivo_homonimo: 'Mercadotecnia Estratégica · Sección Vespertina',
        mesa: 'Mesa 14',
        pin_hash: null,
        rol: 'ALUMNO',
      },
      {
        id: 'usr-mariana',
        nombre_completo: 'Mariana Elizondo Duarte',
        distintivo_homonimo: 'Ingeniería Biomédica',
        mesa: 'Mesa 06',
        pin_hash: null,
        rol: 'ALUMNO',
      },
    ];

    const insertUser = db.prepare(`
      INSERT INTO User (
        id, nombre_completo, nombre_normalizado, distintivo_homonimo,
        mesa, pin_hash, rol, activo, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `);

    for (const u of initialUsers) {
      insertUser.run(
        u.id,
        u.nombre_completo,
        normalizeText(`${u.nombre_completo} ${u.distintivo_homonimo || ''}`),
        u.distintivo_homonimo,
        u.mesa,
        u.pin_hash,
        u.rol,
        now,
        now
      );
    }
  }

  const sampleItems = [
    {
      id: 'med-sample-01',
      usuario_id: 'usr-alejandro',
      origen: 'PRE_EVENTO',
      etapa: 'INICIO',
      pie_de_foto: 'Primer día en la explanada de rectoría, agosto de 2022. Nadie imaginaba todo lo que construiríamos juntos.',
      estado: 'APROBADO_VIDEO',
      tipo_medio: 'FOTO',
      filename: 'sample_01_inicio_rectoria.svg',
      title: 'Primer Día en Rectoría',
      subtitle: 'Agosto 2022 · El comienzo de nuestra historia universitaria',
      stageTag: 'MODO MEMORIA · EL INICIO',
      palette: { bg1: '#040818', bg2: '#0D1E4C', bg3: '#030612', accent: '#E5B85B', silver: '#E2E8F0', nebula: '#3867E0' },
      orden: 1,
    },
    {
      id: 'med-sample-02',
      usuario_id: 'usr-valentina',
      origen: 'PRE_EVENTO',
      etapa: 'SUPERVIVENCIA',
      pie_de_foto: 'Madrugadas de entregas finales en el taller central con litros de café y maquetas imposibles.',
      estado: 'APROBADO_VIDEO',
      tipo_medio: 'FOTO',
      filename: 'sample_02_supervivencia_taller.svg',
      title: 'Noches de Entrega Final',
      subtitle: 'Semestre V · Entre planos, código y café a las 4:00 AM',
      stageTag: 'MODO MEMORIA · SUPERVIVENCIA',
      palette: { bg1: '#050B20', bg2: '#132864', bg3: '#040714', accent: '#F6E2A8', silver: '#F1F5F9', nebula: '#4A7BF7' },
      orden: 2,
    },
    {
      id: 'med-sample-03',
      usuario_id: 'usr-santiago',
      origen: 'PRE_EVENTO',
      etapa: 'RECTA_FINAL',
      pie_de_foto: 'Última foto grupal con toga frente a la biblioteca central tras defender el proyecto terminal.',
      estado: 'APROBADO_VIDEO',
      tipo_medio: 'FOTO',
      filename: 'sample_03_recta_final_toga.svg',
      title: 'Togas Frente a la Biblioteca',
      subtitle: 'Mayo 2026 · La última campana antes de la gran noche',
      stageTag: 'MODO MEMORIA · RECTA FINAL',
      palette: { bg1: '#060D26', bg2: '#162F70', bg3: '#030714', accent: '#E5B85B', silver: '#E2E8F0', nebula: '#2F5BD0' },
      orden: 3,
    },
    {
      id: 'med-sample-04',
      usuario_id: 'usr-camila',
      origen: 'EN_VIVO',
      etapa: 'GALA',
      pie_de_foto: 'Brindis inaugural de la Mesa 09 celebrando cuatro años de amistad incondicional.',
      estado: 'APROBADO_GALERIA',
      tipo_medio: 'FOTO',
      filename: 'sample_04_en_vivo_brindis.svg',
      title: 'Brindis de Gala · Mesa 09',
      subtitle: 'En Vivo · Donde termina el aula y comienza nuestra historia',
      stageTag: 'DÍA DE LA FIESTA · EN VIVO',
      palette: { bg1: '#04091D', bg2: '#102458', bg3: '#030610', accent: '#F6E2A8', silver: '#E2E8F0', nebula: '#3B82F6' },
      orden: null,
    },
    {
      id: 'med-sample-05',
      usuario_id: 'usr-sebastian',
      origen: 'PRE_EVENTO',
      etapa: 'SUPERVIVENCIA',
      pie_de_foto: 'Viaje académico de quinto semestre: el autobús se descompuso pero llegamos al congreso.',
      estado: 'PENDIENTE',
      tipo_medio: 'FOTO',
      filename: 'sample_05_pendiente_viaje.svg',
      title: 'Congreso Nacional de Ingeniería',
      subtitle: 'Octubre 2024 · Recuerdo en espera de aprobación por el comité',
      stageTag: 'BANDEJA DE MODERACIÓN',
      palette: { bg1: '#050A1F', bg2: '#0F2252', bg3: '#040713', accent: '#E5B85B', silver: '#CBD5E1', nebula: '#2563EB' },
      orden: null,
    },
    {
      id: 'med-sample-06',
      usuario_id: 'usr-admin-sofia',
      origen: 'FOTOGRAFO',
      etapa: 'GALA',
      pie_de_foto: 'Retrato oficial de generación bajo la cúpula iluminada del salón principal.',
      estado: 'APROBADO_FOTOGRAFO',
      tipo_medio: 'FOTO',
      filename: 'sample_06_fotografo_oficial.svg',
      title: 'Retrato Oficial de Generación',
      subtitle: 'Fotografía de Estudio en Alta Resolución · Gala 2026',
      stageTag: 'ÁLBUM DEL FOTÓGRAFO',
      palette: { bg1: '#030716', bg2: '#0E2154', bg3: '#02050E', accent: '#E5B85B', silver: '#F8FAFC', nebula: '#3867E0' },
      orden: null,
    },
  ];

  // Actualizar siempre el arte SVG con la paleta "La Noche Estrellada"
  for (const item of sampleItems) {
    ensureSampleArtworkFile(
      item.filename,
      item.title,
      item.subtitle,
      item.stageTag,
      item.palette
    );
  }

  const mediaCount = db.prepare('SELECT COUNT(*) as total FROM MediaItem').get().total;
  if (mediaCount === 0) {
    const insertMedia = db.prepare(`
      INSERT INTO MediaItem (
        id, usuario_id, origen, etapa, pie_de_foto, estado, tipo_medio,
        archivo_url, miniatura_url, nombre_original, mime_type, tamano_bytes,
        duracion_seg, solicitud_retiro, motivo_retiro, moderado_por_id, moderado_en, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?, ?)
    `);

    const insertSeq = db.prepare(`
      INSERT INTO SequenceOrder (
        id, media_item_id, orden, duracion_display_seg, transicion, notas_editor, updated_at
      ) VALUES (?, ?, ?, 4, 'KEN_BURNS', ?, ?)
    `);

    for (const item of sampleItems) {
      const sizeBytes = ensureSampleArtworkFile(
        item.filename,
        item.title,
        item.subtitle,
        item.stageTag,
        item.palette
      );

      const isModerated = item.estado !== 'PENDIENTE';
      insertMedia.run(
        item.id,
        item.usuario_id,
        item.origen,
        item.etapa,
        item.pie_de_foto,
        item.estado,
        item.tipo_medio,
        `/uploads/${item.filename}`,
        `/uploads/${item.filename}`,
        item.filename,
        'image/svg+xml',
        sizeBytes,
        null,
        isModerated ? 'usr-admin-sofia' : null,
        isModerated ? now : null,
        now
      );

      if (item.orden !== null) {
        insertSeq.run(
          crypto.randomUUID(),
          item.id,
          item.orden,
          `Clip secuencial #${item.orden} (${item.etapa})`,
          now
        );
      }
    }
  }
}

initializeSchema();
seedInitialData();

module.exports = {
  db,
  STORAGE_UPLOADS_DIR,
  STORAGE_EXPORTS_DIR,
};
