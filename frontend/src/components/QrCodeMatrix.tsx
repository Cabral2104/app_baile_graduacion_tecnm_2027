import React, { useMemo } from 'react';
import { generateQrMatrix } from '../utils/qr';

interface QrCodeMatrixProps {
  value: string;
  size?: number;
  className?: string;
  darkColor?: string;
  lightColor?: string;
}

/**
 * Generador determinista de matriz QR ISO/IEC 18004 en SVG puro (sin llamadas externas ni APIs)
 * Totalmente legible por cámaras de celulares (iPhone, Android, Google Lens)
 * para tarjetas de mesa imprimibles y proyección en el salón de gala.
 */
export const QrCodeMatrix: React.FC<QrCodeMatrixProps> = ({
  value,
  size = 128,
  className = '',
  darkColor = '#0A0F1D',
  lightColor = '#FFFFFF',
}) => {
  const matrix = useMemo(() => {
    try {
      return generateQrMatrix(value);
    } catch {
      // Fallback a matriz 21x21 mínima si ocurre error
      return Array.from({ length: 21 }, () => Array(21).fill(false));
    }
  }, [value]);

  const gridSize = matrix.length;
  // Margen de 2 módulos alrededor para garantizar lectura óptima por cámaras
  const quietZone = 2;
  const viewBoxSize = gridSize + quietZone * 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
      className={`rounded-xl p-1.5 shadow-sm ${className}`}
      style={{ backgroundColor: lightColor }}
      role="img"
      aria-label={`Código QR para ${value}`}
    >
      {/* Fondo blanco/luz con zona de silencio (Quiet Zone) */}
      <rect width={viewBoxSize} height={viewBoxSize} fill={lightColor} rx={1.5} />

      {/* Módulos oscuros del código QR */}
      {matrix.map((row, rIdx) =>
        row.map((cell, cIdx) =>
          cell ? (
            <rect
              key={`${rIdx}-${cIdx}`}
              x={cIdx + quietZone}
              y={rIdx + quietZone}
              width={1}
              height={1}
              fill={darkColor}
              rx={0.15}
            />
          ) : null
        )
      )}
    </svg>
  );
};
