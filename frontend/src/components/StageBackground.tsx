import React, { useMemo } from 'react';

interface Orb {
  size: number;
  left: number;
  top: number;
  delay: number;
  duration: number;
  color: string;
}

interface StarDot {
  size: number;
  left: number;
  top: number;
  delay: number;
  duration: number;
  color: string;
}

const ORB_COLORS = [
  'rgba(229,184,91,0.45)',
  'rgba(226,232,240,0.42)',
  'rgba(56,103,224,0.48)',
  'rgba(246,226,168,0.38)',
];

const STAR_COLORS = ['#F8FAFC', '#E2E8F0', '#F6E2A8', '#93C5FD', '#E5B85B'];

/**
 * Escenario "La Noche Estrellada":
 * Cielo azul medianoche profundo, constelaciones en plata y oro,
 * estrellas titilantes y reflectores celestes de gala.
 */
export const StageBackground: React.FC = () => {
  const orbs = useMemo<Orb[]>(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        size: 10 + ((i * 31) % 34),
        left: (i * 53 + 7) % 98,
        top: (i * 29 + 9) % 95,
        delay: -((i * 1.9) % 14),
        duration: 11 + ((i * 3) % 9),
        color: ORB_COLORS[i % ORB_COLORS.length],
      })),
    []
  );

  const stars = useMemo<StarDot[]>(
    () =>
      Array.from({ length: 44 }, (_, i) => ({
        size: i % 5 === 0 ? 3.5 : i % 2 === 0 ? 2.5 : 1.8,
        left: (i * 37 + 13) % 99,
        top: (i * 61 + 5) % 96,
        delay: -((i * 0.7) % 6),
        duration: 2.6 + ((i * 1.3) % 4.2),
        color: STAR_COLORS[i % STAR_COLORS.length],
      })),
    []
  );

  return (
    <div className="aurora-bg" aria-hidden="true">
      {/* Constelaciones geométricas sutiles en plata y dorado */}
      <svg
        viewBox="0 0 1440 900"
        fill="none"
        className="absolute inset-0 w-full h-full opacity-40 object-cover"
        preserveAspectRatio="xMidYMid slice"
      >
        <g stroke="#E2E8F0" strokeOpacity="0.22" strokeWidth="1">
          <polyline points="110,140 190,95 275,130 340,85 420,145" />
          <polyline points="275,130 295,215 385,240" />
          <polyline points="1020,120 1110,80 1195,135 1290,95 1350,165" />
          <polyline points="1195,135 1160,220 1245,260" />
          <polyline points="560,180 650,125 745,165 835,115 910,175" />
          <polyline points="150,580 235,530 310,595 395,555" />
          <polyline points="1060,560 1150,515 1230,575 1320,530" />
        </g>
        <g>
          {[
            [110, 140, '#E2E8F0'],
            [190, 95, '#F6E2A8'],
            [275, 130, '#F8FAFC'],
            [340, 85, '#E5B85B'],
            [420, 145, '#E2E8F0'],
            [295, 215, '#93C5FD'],
            [385, 240, '#E2E8F0'],
            [1020, 120, '#E2E8F0'],
            [1110, 80, '#E5B85B'],
            [1195, 135, '#F8FAFC'],
            [1290, 95, '#F6E2A8'],
            [1350, 165, '#E2E8F0'],
            [1160, 220, '#93C5FD'],
            [1245, 260, '#E2E8F0'],
            [560, 180, '#E2E8F0'],
            [650, 125, '#F6E2A8'],
            [745, 165, '#F8FAFC'],
            [835, 115, '#E5B85B'],
            [910, 175, '#E2E8F0'],
            [150, 580, '#E2E8F0'],
            [235, 530, '#F6E2A8'],
            [310, 595, '#F8FAFC'],
            [395, 555, '#E2E8F0'],
            [1060, 560, '#E2E8F0'],
            [1150, 515, '#E5B85B'],
            [1230, 575, '#F8FAFC'],
            [1320, 530, '#E2E8F0'],
          ].map(([cx, cy, fill], idx) => (
            <circle
              key={idx}
              cx={Number(cx)}
              cy={Number(cy)}
              r={idx % 3 === 0 ? 3 : 2.2}
              fill={String(fill)}
              opacity="0.85"
            />
          ))}
        </g>
      </svg>

      {/* Reflectores celestes, plata y oro */}
      <div
        className="beam"
        style={{
          left: '16%',
          background:
            'linear-gradient(to bottom, rgba(226,232,240,0.28), rgba(56,103,224,0.06) 70%, transparent)',
          animationDuration: '14s',
        }}
      />
      <div
        className="beam"
        style={{
          left: '50%',
          background:
            'linear-gradient(to bottom, rgba(56,103,224,0.32), rgba(229,184,91,0.04) 70%, transparent)',
          animationDuration: '18s',
          animationDirection: 'alternate-reverse',
        }}
      />
      <div
        className="beam"
        style={{
          left: '84%',
          background:
            'linear-gradient(to bottom, rgba(229,184,91,0.3), rgba(226,232,240,0.04) 70%, transparent)',
          animationDuration: '15s',
          animationDelay: '-5s',
        }}
      />

      {/* Estrellas fijas titilantes */}
      {stars.map((s, i) => (
        <span
          key={`star-${i}`}
          className="star-dot"
          style={{
            width: s.size,
            height: s.size,
            left: `${s.left}%`,
            top: `${s.top}%`,
            backgroundColor: s.color,
            boxShadow: `0 0 ${s.size * 3}px ${s.color}`,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.duration}s`,
          }}
        />
      ))}

      {/* Destellos de luz flotantes */}
      {orbs.map((o, i) => (
        <span
          key={`orb-${i}`}
          className="orb"
          style={{
            width: o.size,
            height: o.size,
            left: `${o.left}%`,
            top: `${o.top}%`,
            background: o.color,
            animationDelay: `${o.delay}s`,
            animationDuration: `${o.duration}s`,
          }}
        />
      ))}
    </div>
  );
};
