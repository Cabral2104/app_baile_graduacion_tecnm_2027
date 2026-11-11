# Especificación de API REST y Eventos en Tiempo Real

Base URL en desarrollo: `http://localhost:4000`

## 1. Autenticación por Lista Oficial (`/api/auth`)

| Método | Ruta | Descripción |
| :--- | :--- | :--- |
| `GET` | `/api/auth/search?q=texto` | Búsqueda predictiva normalizada sin acentos ni distinción de mayúsculas. |
| `POST` | `/api/auth/verify-pin` | Registra el PIN de 4 dígitos en el primer ingreso o valida el PIN existente; retorna JWT. |
| `GET` | `/api/auth/me` | Valida el token JWT persistente y devuelve el perfil activo. |

## 2. Pipeline Multimedia (`/api/media`)

| Método | Ruta | Descripción |
| :--- | :--- | :--- |
| `POST` | `/api/media/presign` | Genera parámetros de subida o Presigned URL compatible con buckets S3/Cloudflare R2. |
| `POST` | `/api/media/upload` | Recibe archivo multipart (`archivo`) y metadatos (`origen`, `etapa`, `pie_de_foto`, `duracion_seg`). |
| `GET` | `/api/media/public` | Lista todos los elementos aprobados y la configuración activa del evento. |
| `GET` | `/api/media/my-uploads` | Lista las subidas del alumno autenticado y su estado de moderación. |
| `POST` | `/api/media/:id/request-takedown` | Oculta preventivamente una foto y registra una solicitud de retiro por privacidad en Modo Memoria. |

## 3. Panel Exclusivo de Administradoras (`/api/admin`)

| Método | Ruta | Descripción |
| :--- | :--- | :--- |
| `GET` | `/api/admin/overview` | Retorna métricas, bandeja completa con trazabilidad, secuencia Storyboard y padrón de usuarios. |
| `PATCH` | `/api/admin/media/:id/moderate` | Moderación One-Tap (`APROBADO_VIDEO`, `APROBADO_GALERIA`, `RECHAZADO`, `PENDIENTE`). |
| `PUT` | `/api/admin/storyboard/reorder` | Actualiza el orden secuencial (`SequenceOrder.orden`) y la duración de exposición. |
| `GET` | `/api/admin/export-zip` | Descarga un archivo `.zip` con los archivos renombrados secuencialmente (`001_INICIO_foto.jpg`, `002_clip.mp4`) y guion de edición. |
| `POST` | `/api/admin/users/:id/reset-pin` | Restablece el PIN de cualquier alumno con un solo clic (`pin_hash = NULL`). |
| `POST` | `/api/admin/users` | Agrega uno o varios invitados al padrón oficial. |
| `PATCH` | `/api/admin/config` | Cambia la fase global del evento (`PRE_EVENTO`, `EN_VIVO`, `MEMORIA`) y el switch de subidas. |

## 4. Sincronización en Tiempo Real (`/api/live/stream`)

Canal Server-Sent Events (SSE) que emite los eventos:
- `CONNECTED`: Confirmación de enlace en vivo.
- `MEDIA_UPLOADED`: Nuevo archivo recibido en la bandeja de moderación.
- `MEDIA_APPROVED`: Nuevo archivo aprobado e inyectado al instante en `/pantalla-en-vivo`.
- `SEQUENCE_UPDATED`: Cambio en el orden del Storyboard.
- `CONFIG_UPDATED`: Cambio global de fase del evento.

