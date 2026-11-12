import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, GraduationCap, Sparkles } from 'lucide-react';

export interface PhaseCopy {
  badge: string;
  title: string;
  text: string;
  cta: string;
}

interface HeroBannerProps {
  phase: PhaseCopy;
  firstName?: string;
  /** Versión reducida para los demás apartados */
  compact?: boolean;
  showCta: boolean;
  onCta: () => void;
}

const MARQUEE_ITEMS = [
  { text: 'Graduación TECNM', accent: 'gold' },
  { text: 'Generación 2022 – 2026', accent: 'silver' },
  { text: 'Donde termina el aula y comienza nuestra historia', accent: 'gold' },
  { text: 'Tecnológico Nacional de México', accent: 'silver' },
  { text: 'El inicio de nuestra historia', accent: 'gold' },
  { text: 'Recuerdos para Siempre', accent: 'silver' },
] as const;

/** Letras que entran una por una con brillo estelar */
const AnimatedWord: React.FC<{
  text: string;
  className?: string;
  delay?: number;
}> = ({ text, className = '', delay = 0 }) => (
  <span className={`inline-block ${className}`} aria-label={text}>
    {text.split('').map((ch, i) => (
      <motion.span
        key={i}
        aria-hidden="true"
        className="inline-block"
        initial={{ opacity: 0, y: 40, rotateX: -65 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{
          delay: delay + i * 0.05,
          type: 'spring',
          stiffness: 175,
          damping: 16,
        }}
      >
        {ch === ' ' ? '\u00A0' : ch}
      </motion.span>
    ))}
  </span>
);

/** Sello celestial con anillo giratorio en plata y oro alrededor del birrete */
export const Seal: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`relative ${className}`}>
    {/* Halo estelar exterior */}
    <div className="absolute -inset-2 rounded-full bg-gradient-to-tr from-gala-royal/30 via-gala-silver/15 to-gala-gold/30 blur-xl pointer-events-none" />
    <svg
      viewBox="0 0 200 200"
      className="absolute inset-0 w-full h-full animate-spin-slow"
      aria-hidden="true"
    >
      <defs>
        <path
          id="seal-circle"
          d="M100,100 m-80,0 a80,80 0 1,1 160,0 a80,80 0 1,1 -160,0"
        />
        <linearGradient id="seal-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F6E2A8" />
          <stop offset="50%" stopColor="#E2E8F0" />
          <stop offset="100%" stopColor="#E5B85B" />
        </linearGradient>
      </defs>
      <text
        fill="url(#seal-grad)"
        fontSize="11.2"
        fontFamily="Cinzel, serif"
        fontWeight="600"
      >
        <textPath
          href="#seal-circle"
          textLength="498"
          lengthAdjust="spacing"
        >
          TECNM · 2022 – 2026 · EL INICIO DE NUESTRA HISTORIA ·
        </textPath>
      </text>
    </svg>
    <div className="absolute inset-[17%] rounded-full border border-gala-silver/50 bg-gradient-to-b from-gala-card via-gala-velvet to-gala-obsidian flex items-center justify-center shadow-[0_0_42px_-6px_rgba(229,184,91,0.55)]">
      <div className="absolute inset-1.5 rounded-full border border-gala-gold/35" />
      <GraduationCap className="w-[42%] h-[42%] text-gala-gold animate-float" />
    </div>
  </div>
);

/**
 * Carrusel continuo (Ticker) que avanza suavemente de derecha a izquierda
 * con desvanecimiento lateral para que el texto nunca se vea cortado.
 */
const StarryMarqueeCarousel: React.FC = () => {
  const renderSet = (setKey: string) => (
    <div key={setKey} className="flex items-center shrink-0">
      {MARQUEE_ITEMS.map((item, idx) => (
        <div
          key={`${setKey}-${idx}`}
          className="flex items-center shrink-0"
        >
          <span
            className={`font-display text-[11px] sm:text-xs tracking-[0.24em] uppercase px-4 sm:px-6 whitespace-nowrap ${
              item.accent === 'gold'
                ? 'text-gala-champagne font-semibold'
                : 'text-gala-silver font-medium'
            }`}
          >
            {item.text}
          </span>
          <Sparkles className="w-3.5 h-3.5 text-gala-gold/80 shrink-0" />
        </div>
      ))}
    </div>
  );

  return (
    <div className="relative border-t border-gala-silver/20 bg-gradient-to-r from-gala-obsidian/95 via-gala-velvet/90 to-gala-obsidian/95 py-3">
      <div className="marquee-mask">
        <div className="marquee-track">
          {renderSet('set-1')}
          {renderSet('set-2')}
        </div>
      </div>
    </div>
  );
};

export const HeroBanner: React.FC<HeroBannerProps> = ({
  phase,
  firstName,
  compact = false,
  showCta,
  onCta,
}) => {
  if (compact) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl overflow-hidden mb-6"
      >
        <StarryMarqueeCarousel />
        <div className="px-4 sm:px-5 py-3 flex flex-col sm:flex-row items-center justify-between gap-1.5 sm:gap-3 text-xs text-gala-parchment border-t border-gala-silver/15 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-gala-leaf animate-pulse shrink-0" />
            <span className="uppercase tracking-[0.14em] sm:tracking-[0.18em] text-[11px] text-gala-champagne font-semibold">
              {phase.badge}
            </span>
            <span className="hidden md:inline text-gala-silver/50">·</span>
            <span className="hidden md:inline truncate text-gala-silver">
              {phase.title}
            </span>
          </div>
          <span className="text-[11px] font-serif italic tracking-wide text-gala-silver/85 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-gala-gold shrink-0" />
            <span>Donde termina el aula y comienza nuestra historia</span>
          </span>
        </div>
      </motion.section>
    );
  }

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="relative mb-8"
    >
      <div className="glass rounded-3xl sm:rounded-[2rem] overflow-hidden">
        <div className="relative px-5 sm:px-10 pt-9 sm:pt-12 pb-8 sm:pb-10 flex flex-col items-center text-center">
          {/* Nebulosa luminosa azul, plata y oro detrás del título */}
          <div className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 w-[85%] h-64 rounded-full bg-gradient-to-r from-gala-royal/25 via-gala-silver/15 to-gala-gold/20 blur-3xl pointer-events-none" />

          {/* Distintivo superior con la frase de graduación */}
          <div className="relative mb-4 inline-flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-full bg-gala-surface/80 border border-gala-silver/30 text-[10px] sm:text-[11px] uppercase tracking-[0.1em] sm:tracking-[0.18em] text-gala-silver max-w-full">
            <Sparkles className="w-3 h-3 text-gala-gold shrink-0" />
            <span className="leading-snug">Donde termina el aula y comienza nuestra historia</span>
          </div>

          <Seal className="relative w-28 h-28 sm:w-36 sm:h-36 mb-5" />

          <motion.p
            initial={{ opacity: 0, letterSpacing: '0.45em' }}
            animate={{ opacity: 1, letterSpacing: '0.28em' }}
            transition={{ duration: 1, delay: 0.1 }}
            className="relative font-display text-[10px] sm:text-xs uppercase text-gala-silver"
          >
            Tecnológico Nacional de México
          </motion.p>

          <h2 className="relative font-display font-bold leading-[0.96] mt-2.5 text-[clamp(2rem,8.8vw,5rem)] tracking-[0.04em] text-gala-ivory">
            <AnimatedWord text="GRADUACIÓN" delay={0.2} />
            <br />
            <AnimatedWord
              text="TECNM"
              delay={0.7}
              className="text-shimmer text-[clamp(3.1rem,15vw,8.4rem)] tracking-[0.08em]"
            />
          </h2>

          <div className="relative ornament w-52 sm:w-80 mt-4" />
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1 }}
            className="relative font-serif italic text-xl sm:text-2xl text-gala-silver mt-2.5"
          >
            Generación 2022 – 2026
          </motion.p>

          {/* Mensaje según la fase del evento */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.25, duration: 0.55 }}
            className="relative mt-6 max-w-xl"
          >
            <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-gala-gold/15 border border-gala-gold/40 text-[11px] uppercase tracking-[0.18em] text-gala-champagne font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-gala-leaf animate-pulse" />
              {phase.badge}
            </span>
            <p className="text-lg sm:text-xl font-semibold text-gala-ivory mt-3">
              {firstName ? `${firstName}, ` : ''}
              {firstName
                ? phase.title.charAt(0).toLowerCase() + phase.title.slice(1)
                : phase.title}
            </p>
            <p className="text-xs sm:text-sm text-gala-parchment/90 mt-2 leading-relaxed">
              {phase.text}
            </p>
            {showCta && (
              <button
                type="button"
                onClick={onCta}
                className="btn-gold mt-5 px-6 py-3 rounded-xl font-semibold text-sm inline-flex items-center gap-2 animate-glow-pulse"
              >
                {phase.cta} <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </motion.div>
        </div>

        {/* Carrusel animado continuo en la parte inferior */}
        <StarryMarqueeCarousel />
      </div>
    </motion.section>
  );
};
