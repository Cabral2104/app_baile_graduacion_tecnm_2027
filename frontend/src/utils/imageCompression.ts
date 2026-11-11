/**
 * Utilidades de compresión multimedia en cliente (Canvas -> WebP / JPEG)
 * y validación de duración de videos cortos para optimizar la red en el salón.
 */

export function normalizeClientText(input: string): string {
  return String(input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export interface CompressionResult {
  file: File;
  originalBytes: number;
  compressedBytes: number;
  width?: number;
  height?: number;
  durationSec?: number;
}

/**
 * Comprime una imagen en el navegador usando HTML5 Canvas a formato WebP (o JPEG fallback)
 * limitando la dimensión máxima a 1920px para transmisión rápida desde móviles.
 */
export async function compressImageClientSide(
  inputFile: File,
  maxDimension = 1920,
  quality = 0.84
): Promise<CompressionResult> {
  const originalBytes = inputFile.size;

  // Si es SVG o muy ligero (< 250KB), no recomprimir
  if (inputFile.type === 'image/svg+xml' || originalBytes < 250 * 1024) {
    return {
      file: inputFile,
      originalBytes,
      compressedBytes: originalBytes,
    };
  }

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(inputFile);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        if (width >= height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        resolve({ file: inputFile, originalBytes, compressedBytes: originalBytes });
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= originalBytes) {
            resolve({
              file: inputFile,
              originalBytes,
              compressedBytes: originalBytes,
              width,
              height,
            });
            return;
          }

          const baseName = inputFile.name.replace(/\.[^/.]+$/, '');
          const compressedFile = new File([blob], `${baseName}.webp`, {
            type: 'image/webp',
            lastModified: Date.now(),
          });

          resolve({
            file: compressedFile,
            originalBytes,
            compressedBytes: compressedFile.size,
            width,
            height,
          });
        },
        'image/webp',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ file: inputFile, originalBytes, compressedBytes: originalBytes });
    };

    img.src = objectUrl;
  });
}

/**
 * Obtiene la duración en segundos de un archivo de video local antes de subirlo.
 */
export function getVideoDurationSeconds(videoFile: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    const objectUrl = URL.createObjectURL(videoFile);

    video.onloadedmetadata = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(Number(video.duration.toFixed(1)));
    };

    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('No fue posible leer los metadatos del archivo de video.'));
    };

    video.src = objectUrl;
  });
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

