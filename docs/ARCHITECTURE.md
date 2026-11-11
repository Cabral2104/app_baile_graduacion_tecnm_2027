# Arquitectura del Sistema — Plataforma Integral de Baile de Graduación

## 1. Visión General de las 3 Fases Operativas

```mermaid
flowchart LR
    subgraph F1["Fase 1: Pre-Evento"]
        A1["Alumno se identifica por Lista (PIN 4 dígitos)"] --> A2["Compresión WebP en Cliente y Subida Clasificada"]
        A2 --> A3["Moderación One-Tap y Storyboard Drag & Drop"]
        A3 --> A4["Modo Ensayo y Exportación ZIP (001_foto, 002_clip)"]
    end

    subgraph F2["Fase 2: Noche del Baile (En Vivo)"]
        B1["Escaneo QR en Mesa"] --> B2["Subida Rápida de Foto o Clip Corto"]
        B2 --> B3["Aprobación Móvil Instantánea"]
        B3 --> B4["Stream SSE hacia /pantalla-en-vivo"]
        B4 --> B5["Buffer Local de 5 Blobs contra Caídas de Red"]
    end

    subgraph F3["Fase 3: Post-Evento (Modo Memoria)"]
        C1["Cierre Global de Subidas"] --> C2["Galería Permanente en 4 Pestañas"]
        C2 --> C3["Descarga Directa en Alta Resolución"]
        C2 --> C4["Solicitud de Retiro por Privacidad"]
    end

    F1 --> F2 --> F3
```

---

## 2. Flujo de Autenticación sin Matrículas (Padrón Oficial)

1. **Precarga de Invitados**: La tabla `User` almacena `nombre_completo`, `nombre_normalizado` (sin acentos y en minúsculas), `distintivo_homonimo` (carrera/grupo para desambiguar homónimos) y `pin_hash` (`NULL` inicialmente).
2. **Typeahead Predictivo**: El endpoint `GET /api/auth/search?q=` normaliza la entrada del alumno con `String.prototype.normalize('NFD')` y filtra coincidencias instantáneas.
3. **Activación en Primer Ingreso**: Si `pin_hash` es `NULL`, el sistema solicita crear un PIN numérico de 4 dígitos, lo deriva con `crypto.scryptSync` + sal aleatoria y devuelve un JWT con vigencia de 30 días almacenado en `localStorage`.
4. **Recuperación en 1 Clic**: Desde el Panel de Administradoras, `POST /api/admin/users/:id/reset-pin` limpia `pin_hash = NULL` para permitir que el alumno registre un nuevo PIN de inmediato.

---

## 3. Estrategia de Buffer Local Resiliente en `/pantalla-en-vivo`

Durante un evento masivo en salón, la red Wi-Fi suele experimentar saturación cuando cientos de invitados suben contenido simultáneamente:
- El componente `LiveWallScreen` mantiene una caché de metadatos en `localStorage` (`gala_livewall_offline_cache_v1`) y un mapa en memoria RAM (`Map<string, string>`) con `URL.createObjectURL(blob)` de los próximos **5 elementos adelantados**.
- Si ocurre una desconexión total de internet o caída momentánea del router, el carrusel continúa reproduciendo las imágenes y videos desde la memoria local del navegador conectado al proyector HDMI sin mostrar pantallas negras ni errores de carga.

