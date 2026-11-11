import React, { useEffect, useRef } from 'react';

type StarKind = 'fourPoint' | 'eightPoint' | 'stardust';

interface CelestialParticle {
  kind: StarKind;
  x: number;
  y: number;
  size: number;
  vy: number;
  vx: number;
  sway: number;
  swayFreq: number;
  swayOffset: number;
  alpha: number;
  color: string;
  twinklePhase: number;
  twinkleSpeed: number;
}

interface ShootingStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  length: number;
  life: number;
  maxLife: number;
  color: string;
}

const STARRY_PALETTE = [
  '#F8FAFC', // Blanco estelar
  '#E2E8F0', // Plata brillante
  '#CBD5E1', // Plata satinado
  '#E5B85B', // Oro de gala
  '#F6E2A8', // Oro champaña
  '#93C5FD', // Azul celeste
];

interface AmbientLeavesCanvasProps {
  enabled?: boolean;
  density?: 'subtle' | 'normal';
}

/**
 * Animación interactiva "La Noche Estrellada":
 * Estrellas de 4 y 8 puntas en plata y oro que titilan, polvo estelar flotante
 * y estrellas fugaces que cruzan el firmamento nocturno.
 */
export const AmbientLeavesCanvas: React.FC<AmbientLeavesCanvasProps> = ({
  enabled = true,
  density = 'subtle',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);
    const mobile = width < 768;
    const total = density === 'subtle' ? (mobile ? 32 : 58) : mobile ? 44 : 80;

    const makeParticle = (kind: StarKind): CelestialParticle => ({
      kind,
      x: Math.random() * width,
      y: Math.random() * height,
      size:
        kind === 'eightPoint'
          ? 6 + Math.random() * 6
          : kind === 'fourPoint'
          ? 4 + Math.random() * 5
          : 1.5 + Math.random() * 2.2,
      vy:
        kind === 'stardust'
          ? -0.12 - Math.random() * 0.22
          : -0.04 - Math.random() * 0.08,
      vx: (Math.random() - 0.5) * 0.14,
      sway: 0.15 + Math.random() * 0.35,
      swayFreq: 0.008 + Math.random() * 0.012,
      swayOffset: Math.random() * Math.PI * 2,
      alpha: kind === 'stardust' ? 0.55 + Math.random() * 0.35 : 0.75 + Math.random() * 0.25,
      color: STARRY_PALETTE[Math.floor(Math.random() * STARRY_PALETTE.length)],
      twinklePhase: Math.random() * Math.PI * 2,
      twinkleSpeed: 0.02 + Math.random() * 0.035,
    });

    const kinds: StarKind[] = ['fourPoint', 'stardust', 'stardust', 'eightPoint', 'fourPoint'];
    const particles: CelestialParticle[] = Array.from({ length: total }, (_, i) =>
      makeParticle(kinds[i % kinds.length])
    );

    const shootingStars: ShootingStar[] = [];

    const spawnShootingStar = () => {
      const startX = Math.random() * (width * 0.8) + width * 0.1;
      const startY = Math.random() * (height * 0.38);
      const speed = 7 + Math.random() * 5;
      const angle = (Math.PI / 6) + Math.random() * (Math.PI / 8); // Diagonal hacia abajo
      const dir = Math.random() > 0.3 ? 1 : -1;
      shootingStars.push({
        x: startX,
        y: startY,
        vx: Math.cos(angle) * speed * dir,
        vy: Math.sin(angle) * speed,
        length: 75 + Math.random() * 55,
        life: 0,
        maxLife: 42 + Math.floor(Math.random() * 24),
        color: Math.random() > 0.45 ? '#E2E8F0' : '#F6E2A8',
      });
    };

    const onResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', onResize);

    let tick = 0;
    const drawFourPointStar = (radius: number) => {
      ctx.beginPath();
      ctx.moveTo(0, -radius);
      ctx.quadraticCurveTo(0, 0, radius, 0);
      ctx.quadraticCurveTo(0, 0, 0, radius);
      ctx.quadraticCurveTo(0, 0, -radius, 0);
      ctx.quadraticCurveTo(0, 0, 0, -radius);
      ctx.closePath();
      ctx.fill();
    };

    const draw = () => {
      tick++;
      ctx.clearRect(0, 0, width, height);

      // Lanzar una estrella fugaz periódicamente
      if (tick % 190 === 40 && shootingStars.length < 2) {
        spawnShootingStar();
      }

      // Dibujar estrellas y polvo estelar
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.y += p.vy;
        p.x += p.vx + Math.sin(tick * p.swayFreq + p.swayOffset) * p.sway;
        p.twinklePhase += p.twinkleSpeed;

        if (p.y < -20) p.y = height + 15;
        if (p.y > height + 20) p.y = -15;
        if (p.x > width + 20) p.x = -15;
        if (p.x < -20) p.x = width + 15;

        const pulse = 0.3 + 0.7 * Math.abs(Math.sin(p.twinklePhase));

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.globalAlpha = pulse * p.alpha;
        ctx.fillStyle = p.color;

        if (p.kind === 'stardust') {
          ctx.beginPath();
          ctx.arc(0, 0, p.size * (0.7 + pulse * 0.4), 0, Math.PI * 2);
          ctx.fill();
        } else if (p.kind === 'fourPoint') {
          const r = p.size * (0.65 + pulse * 0.5);
          drawFourPointStar(r);
        } else {
          // Estrella de 8 puntas con halo plateado/dorado
          const r = p.size * (0.7 + pulse * 0.5);
          drawFourPointStar(r);
          ctx.rotate(Math.PI / 4);
          ctx.globalAlpha = pulse * p.alpha * 0.55;
          drawFourPointStar(r * 0.65);
        }

        ctx.restore();
      }

      // Dibujar estrellas fugaces
      for (let i = shootingStars.length - 1; i >= 0; i--) {
        const s = shootingStars[i];
        s.x += s.vx;
        s.y += s.vy;
        s.life++;

        const progress = s.life / s.maxLife;
        const opacity = progress < 0.2 ? progress * 5 : 1 - (progress - 0.2) / 0.8;

        if (s.life >= s.maxLife || s.x < -100 || s.x > width + 100 || s.y > height + 100) {
          shootingStars.splice(i, 1);
          continue;
        }

        const norm = Math.hypot(s.vx, s.vy) || 1;
        const tailX = s.x - (s.vx / norm) * s.length;
        const tailY = s.y - (s.vy / norm) * s.length;

        ctx.save();
        const grad = ctx.createLinearGradient(s.x, s.y, tailX, tailY);
        grad.addColorStop(0, s.color);
        grad.addColorStop(0.35, 'rgba(226, 232, 240, 0.55)');
        grad.addColorStop(1, 'rgba(226, 232, 240, 0)');

        ctx.globalAlpha = Math.max(0, opacity);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();

        // Cabeza brillante de la estrella fugaz
        ctx.fillStyle = '#FFFFFF';
        ctx.translate(s.x, s.y);
        drawFourPointStar(5.5);
        ctx.restore();
      }

      raf = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(raf);
    };
  }, [enabled, density]);

  if (!enabled) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-10"
    />
  );
};
