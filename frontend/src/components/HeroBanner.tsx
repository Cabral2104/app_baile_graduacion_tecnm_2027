import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, ChevronDown, ChevronUp, GraduationCap, Sparkles } from 'lucide-react';

export interface PhaseCopy {
  badge: string;
  title: string;
  text: string;
  cta: string;
}

interface HeroBannerProps {
  phase: PhaseCopy;
  firstName?: string;
  titulo?: string;
  generacion?: string;
  subtitulo?: string;
  /** Versión reducida para evitar saturar antes de ver las fotografías */
  compact?: boolean;
  /** Permite expandir/contraer manualmente la portada monumental */
  onToggleCompact?: () => void;
  canExpand?: boolean;
  showCta: boolean;
  onCta: () => void;
}

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
const StarryMarqueeCarousel: React.FC<{
  titulo: string;
  generacion: string;
  subtitulo: string;
}> = ({ titulo, generacion, subtitulo }) => {
  const items = [
    { text: titulo, accent: 'gold' as const },
    { text: generacion, accent: 'silver' as const },
    { text: 'Donde termina el aula y comienza nuestra historia', accent: 'gold' as const },
    { text: subtitulo, accent: 'silver' as const },
    { text: 'El inicio de nuestra historia', accent: 'gold' as const },
    { text: 'Recuerdos para Siempre', accent: 'silver' as const },
  ];

  const renderSet = (setKey: string) => (
    <div key={setKey} className="flex items-center shrink-0">
      {items.map((item, idx) => (
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
  titulo = 'Graduación TECNM',
  generacion = 'Generación 2022 – 2026',
  subtitulo = 'Tecnológico Nacional de México',
  compact = false,
  onToggleCompact,
  canExpand = false,
  showCta,
  onCta,
}) => {
  const resolvedTitulo = titulo.trim() || 'Graduación TECNM';
  const resolvedGeneracion = generacion.trim() || 'Generación 2022 – 2026';
  const resolvedSubtitulo = subtitulo.trim() || 'Tecnológico Nacional de México';
  const tituloWords = resolvedTitulo.split(/\s+/);
  const titleTop = tituloWords.length >= 2 ? tituloWords.slice(0, -1).join(' ').toUpperCase() : '';
  const titleAccent = tituloWords[tituloWords.length - 1].toUpperCase();
  if (compact) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl px-4 sm:px-5 py-2.5 mb-5 flex flex-wrap items-center justify-between gap-2 text-xs text-gala-parchment"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-gala-leaf animate-pulse shrink-0" />
          <span className="uppercase tracking-[0.16em] text-[10px] sm:text-[11px] text-gala-champagne font-semibold shrink-0">
            {phase.badge}
          </span>
          <span className="hidden sm:inline text-gala-silver/40">·</span>
          <span className="hidden sm:inline truncate text-gala-silver/90">
            {phase.title}
          </span>
        </div>

        <div className="flex items-center gap-2.5 ml-auto">
          <span className="hidden lg:inline-flex items-center gap-1.5 text-[11px] font-serif italic tracking-wide text-gala-silver/80">
            <Sparkles className="w-3 h-3 text-gala-gold shrink-0" />
            Donde termina el aula y comienza nuestra historia
          </span>

          {showCta && (
            <button
              type="button"
              onClick={onCta}
              className="px-3 py-1 rounded-lg bg-gala-gold/15 hover:bg-gala-gold/25 border border-gala-gold/40 text-gala-champagne text-[11px] font-semibold inline-flex items-center gap-1 transition"
            >
              <span>{phase.cta}</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          )}

          {canExpand && onToggleCompact && (
            <button
              type="button"
              onClick={onToggleCompact}
              className="px-2.5 py-1 rounded-lg bg-gala-obsidian/60 hover:bg-gala-surface border border-gala-silver/20 text-[11px] text-gala-silver hover:text-gala-ivory inline-flex items-center gap-1 transition"
              title="Mostrar portada de bienvenida"
            >
              <span>Ver portada</span>
              <ChevronDown className="w-3 h-3 text-gala-gold" />
            </button>
          )}
        </div>
      </motion.section>
    );
  }

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="relative mb-6"
    >
      <div className="glass glass-ornate rounded-3xl sm:rounded-[2rem] overflow-hidden">
        <div className="relative px-4 sm:px-10 pt-4 sm:pt-6 pb-7 sm:pb-9 flex flex-col items-center text-center">
          {/* Nebulosa luminosa azul, plata y oro detrás del título */}
          <div className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 w-[85%] h-64 rounded-full bg-gradient-to-r from-gala-royal/25 via-gala-silver/15 to-gala-gold/20 blur-3xl pointer-events-none" />

          {/* Barra superior en flujo normal para evitar solapamientos en celular */}
          {onToggleCompact && (
            <div className="relative z-20 w-full flex justify-end mb-3">
              <button
                type="button"
                onClick={onToggleCompact}
                className="px-3 py-1.5 rounded-full bg-gala-obsidian/70 hover:bg-gala-surface border border-gala-silver/25 text-[11px] text-gala-silver hover:text-gala-ivory inline-flex items-center gap-1 transition backdrop-blur-md"
                title="Minimizar portada para ir directo a las fotos"
              >
                <span className="hidden sm:inline">Ir directo a las fotos</span>
                <span className="sm:hidden">Minimizar</span>
                <ChevronUp className="w-3.5 h-3.5 text-gala-gold" />
              </button>
            </div>
          )}

          {/* Distintivo superior con la frase de graduación */}
          <div className="relative mb-4 inline-flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-full bg-gala-surface/80 border border-gala-silver/25 text-[10px] sm:text-[11px] uppercase tracking-[0.1em] sm:tracking-[0.18em] text-gala-silver max-w-full">
            <Sparkles className="w-3 h-3 text-gala-gold shrink-0" />
            <span className="leading-snug">Donde termina el aula y comienza nuestra historia</span>
          </div>

          <Seal className="relative w-24 h-24 sm:w-32 sm:h-32 mb-4" />

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.9, delay: 0.1 }}
            className="relative font-display text-[clamp(9px,2.5vw,12px)] tracking-[0.14em] sm:tracking-[0.26em] uppercase text-gala-silver px-2"
          >
            {resolvedSubtitulo}
          </motion.p>

          <h2 className="relative font-display font-bold leading-[0.96] mt-2 text-[clamp(2rem,8.2vw,4.6rem)] tracking-[0.04em] text-gala-ivory">
            {titleTop ? (
              <>
                <AnimatedWord text={titleTop} delay={0.15} />
                <br />
              </>
            ) : null}
            <AnimatedWord
              text={titleAccent}
              delay={titleTop ? 0.55 : 0.15}
              className="text-shimmer text-[clamp(3rem,14vw,7.5rem)] tracking-[0.08em]"
            />
          </h2>

          <div className="relative ornament w-48 sm:w-72 mt-3.5" />
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
            className="relative font-serif italic text-xl sm:text-2xl text-gala-silver mt-2"
          >
            {resolvedGeneracion}
          </motion.p>

          {/* Mensaje según la fase del evento */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0, duration: 0.5 }}
            className="relative mt-5 max-w-xl"
          >
            <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-gala-gold/15 border border-gala-gold/40 text-[11px] uppercase tracking-[0.18em] text-gala-champagne font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-gala-leaf animate-pulse" />
              {phase.badge}
            </span>
            <p className="font-serif text-xl sm:text-2xl font-semibold text-gala-ivory mt-2.5">
              {firstName ? `${firstName}, ` : ''}
              {firstName
                ? phase.title.charAt(0).toLowerCase() + phase.title.slice(1)
                : phase.title}
            </p>
            <p className="text-xs sm:text-sm text-gala-parchment/90 mt-1.5 leading-relaxed">
              {phase.text}
            </p>
            {showCta && (
              <button
                type="button"
                onClick={onCta}
                className="btn-gold mt-4 px-6 py-2.5 rounded-xl font-semibold text-xs sm:text-sm inline-flex items-center gap-2 animate-glow-pulse"
              >
                {phase.cta} <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </motion.div>
        </div>

        {/* Carrusel animado continuo en la parte inferior */}
        <StarryMarqueeCarousel
          titulo={resolvedTitulo}
          generacion={resolvedGeneracion}
          subtitulo={resolvedSubtitulo}
        />
      </div>
    </motion.section>
  );
};
