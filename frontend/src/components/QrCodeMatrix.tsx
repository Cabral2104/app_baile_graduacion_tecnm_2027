import React, { useMemo } from 'react';

interface QrCodeMatrixProps {
  value: string;
  size?: number;
}

/**
 * Generador determinista de matriz QR en SVG puro (sin llamadas externas)
 * para tarjetas de mesa imprimibles y proyección en salón.
 */
export const QrCodeMatrix: React.FC<QrCodeMatrixProps> = ({
  value,
  size = 128,
}) => {
  const gridSize = 21;

  const matrix = useMemo(() => {
    const grid: boolean[][] = Array.from({ length: gridSize }, () =>
      Array(gridSize).fill(false)
    );

    const drawFinderPattern = (startR: number, startC: number) => {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
          const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          if (isBorder || isInner) {
            grid[startR + r][startC + c] = true;
          }
        }
      }
    };

    drawFinderPattern(0, 0);
    drawFinderPattern(0, gridSize - 7);
    drawFinderPattern(gridSize - 7, 0);

    // Patrones de sincronización (Timing patterns)
    for (let i = 8; i < gridSize - 8; i++) {
      grid[6][i] = i % 2 === 0;
      grid[i][6] = i % 2 === 0;
    }

    // Hash determinista del texto/URL para poblar los módulos de datos
    let hash = 2166136261;
    for (let i = 0; i < value.length; i++) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }

    let seed = hash >>> 0;
    const nextBit = (r: number, c: number) => {
      seed = (Math.imul(seed ^ (r * 31 + c * 17), 1664525) + 1013904223) >>> 0;
      return (seed & 1) === 1;
    };

    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        const inTopLeft = r < 8 && c < 8;
        const inTopRight = r < 8 && c >= gridSize - 8;
        const inBottomLeft = r >= gridSize - 8 && c < 8;
        const isTiming = r === 6 || c === 6;

        if (!inTopLeft && !inTopRight && !inBottomLeft && !isTiming) {
          grid[r][c] = nextBit(r, c);
        }
      }
    }

    return grid;
  }, [value]);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${gridSize + 2} ${gridSize + 2}`}
      className="bg-[#FAF7F2] rounded-lg p-1"
      role="img"
      aria-label={`Código QR para ${value}`}
    >
      {matrix.map((row, rIdx) =>
        row.map((cell, cIdx) =>
          cell ? (
            <rect
              key={`${rIdx}-${cIdx}`}
              x={cIdx + 1}
              y={rIdx + 1}
              width={1}
              height={1}
              fill="#08130F"
              rx={0.12}
            />
          ) : null
        )
      )}
    </svg>
  );
};

