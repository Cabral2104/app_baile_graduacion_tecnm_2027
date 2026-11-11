# Plataforma Web Integral — Gala de Graduación Universitaria

Aplicación web Full-Stack (*100% Mobile-First* y escritorio) diseñada para gestionar todo el ciclo de recuerdos fotográficos y de video de una Graduación Universitaria a través de **4 apartados claros y directos**:

1. **Apartado 1 · Modo Memoria (Video)** (`MemoryGallery.tsx`):
   - Reúne todas las fotos y videos de la época universitaria subidos antes de la fiesta y aprobados como **"Al Video"** (clasificados en *1. El Inicio*, *2. Supervivencia* y *3. Recta Final*).
   - Incluye el botón **"Presentar Video en Pantalla Grande"** para reproducir la película conmemorativa ahí mismo, el botón **"Subir Foto para el Video"** y el visor para ver las memorias una por una o descargarlas.
2. **Apartado 2 · Día de la Fiesta** (`PartyDaySection.tsx` + `LiveWallScreen.tsx`):
   - Reúne exclusivamente las fotos y clips subidos **en vivo durante la noche de la fiesta** desde las mesas.
   - Permite **ver las fotos una por una** con controles grandes (*Anterior* / *Siguiente Foto*) o verlas todas en cuadrícula.
   - Incluye el botón **"Subir Foto de la Fiesta"** para mandar fotos al momento desde la mesa y el botón **"Reproducir Carrusel (Pantalla Salón)"** para proyectar el carrusel automático a pantalla completa con buffer local anti-fallas de red (5 elementos precargados en memoria RAM).
3. **Apartado 3 · Álbum Fotógrafo** (`PhotographerSection.tsx`):
   - Galería dedicada a las fotografías profesionales de estudio y cobertura oficial para ver una por una y descargar en alta definición (HD).
4. **Apartado 4 · Organizadoras** (`AdminDashboard.tsx`):
   - Centro de control exclusivo para el comité organizador dividido en 4 tareas simples:
     1. **Aprobar Fotos Recibidas**: Con 3 botones claros debajo de cada foto (*Modo Memoria (Video)*, *Día de la Fiesta* o *Descartar*).
     2. **Ordenar Video y ZIP**: Para reordenar las escenas (`001`, `002`, `003`...), ensayar el video a pantalla completa y descargar el archivo `.zip` ya numerado en orden para el editor.
     3. **Invitados y PINs**: Para agregar invitados (uno por uno o pegando renglones desde Excel) y el botón **"Borrar PIN"** en un clic si algún alumno olvidó sus 4 números.
     4. **Ajustes del Evento**: Para abrir o cerrar la recepción de archivos.

---

## Estructura del Proyecto

```text
c:\app_baile_graduacion\
├── backend/
│   ├── prisma/
│   │   └── schema.prisma                # Modelos: User, MediaItem, SequenceOrder, SystemConfig
│   ├── src/
│   │   ├── db/
│   │   │   ├── database.js              # Base de datos SQLite nativa (WAL) y datos semilla
│   │   │   └── seed.js                  # Inicializador de datos de prueba
│   │   ├── realtime/
│   │   │   └── liveHub.js               # Sincronización en tiempo real (SSE)
│   │   ├── routes/
│   │   │   ├── auth.js                  # Buscador predictivo sin matrículas + PIN de 4 dígitos
│   │   │   ├── media.js                 # Subida de fotos/videos, galería y privacidad
│   │   │   └── admin.js                 # Moderación, orden de video, exportación ZIP y PINs
│   │   ├── utils/
│   │   │   ├── security.js              # Normalización sin acentos, hash scrypt y JWT
│   │   │   └── zipBuilder.js            # Generador nativo de archivos ZIP secuenciales
│   │   └── server.js                    # Servidor HTTP Express + Tiempo Real
│   ├── tests/
│   │   └── e2e.test.js                  # Pruebas automatizadas de extremo a extremo
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AmbientLeavesCanvas.tsx  # Animación sutil de hojas doradas en Canvas
│   │   │   ├── AuthTypeaheadModal.tsx   # Buscador por nombre y registro/validación de PIN
│   │   │   ├── MemoryGallery.tsx        # Apartado 1: Modo Memoria (Fotos "Al Video" + Presentador)
│   │   │   ├── PartyDaySection.tsx      # Apartado 2: Día de la Fiesta (Una por una + Subida rápida)
│   │   │   ├── LiveWallScreen.tsx       # Carrusel a pantalla completa para el proyector del salón
│   │   │   ├── PhotographerSection.tsx  # Apartado 3: Álbum del Fotógrafo Oficial en HD
│   │   │   ├── AdminDashboard.tsx       # Apartado 4: Panel de Organizadoras
│   │   │   └── QrCodeMatrix.tsx         # Generador de código QR en SVG sin dependencias externas
│   │   ├── services/api.ts
│   │   ├── types/index.ts
│   │   ├── utils/imageCompression.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── package.json
├── storage/
│   ├── uploads/                         # Archivos multimedia locales
│   └── s3-config.example.json           # Plantilla de configuración S3 / Cloudflare R2
├── docs/
│   ├── ARCHITECTURE.md
│   └── API_SPEC.md
└── README.md
```

---

## Cómo Iniciar el Proyecto en Modo Desarrollo

### 1. Iniciar el Backend (Puerto `4000`)

```powershell
cd c:\app_baile_graduacion\backend
npm run dev
```

### 2. Iniciar el Frontend (Puerto `5173`)

En otra ventana de terminal:

```powershell
cd c:\app_baile_graduacion\frontend
npm run dev
```

Abre en tu navegador:
- **Aplicación Principal**: `http://localhost:5173`
- **Vista Directa de Carrusel para Proyector**: `http://localhost:5173/pantalla-en-vivo`

---

## Cuentas Precargadas para Probar de Inmediato

Al tocar el botón **"Identificarme"** arriba a la derecha (o usando los 3 botones de acceso rápido al pie de la ventana):

| Perfil | Nombre en la Lista | PIN de 4 dígitos |
| :--- | :--- | :--- |
| **Alumno en Primer Ingreso** | `María Fernanda López García` *(Ing. Industrial o Arquitectura)* | Sin PIN (te pedirá crear uno de 4 dígitos) |
| **Alumno con PIN Activo** | `Alejandro Morales Vega` | **`1234`** |
| **Organizadora (Comité)** | `Sofía Villalobos Mondragón` | **`2026`** |
