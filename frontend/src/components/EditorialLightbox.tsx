import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Download,
  Heart,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from 'lucide-react';
import { MediaItem } from '../types';
import { StageBackground } from './StageBackground';

interface EditorialLightboxProps {
  items: MediaItem[];
  activeIndex: number | null;
  onClose: () => void;
  onChangeIndex: (nextIndex: number) => void;
  badgeLabel?: (item: MediaItem) => string;
  subtitleLabel?: (item: MediaItem) => string;
  /** Reacciones interactivas opcionales */
  enableReactions?: boolean;
  myReactions?: Record<string, 'CORAZON' | 'ESTRELLA' | null>;
  reactionCounts?: (item: MediaItem) => { corazon: number; estrella: number };
  onReact?: (mediaId: string, tipo: 'CORAZON' | 'ESTRELLA') => void;
  /** Permiso para eliminar (propia o Admin) */
  canDelete?: (item: MediaItem) => boolean;
  onDelete?: (item: MediaItem) => void;
}

/**
 * Visor editorial en pantalla completa con soporte para deslizamiento táctil (swipe)
 * en celular, teclado (flechas y Esc), fondo ambiental difuminado y acciones de gala.
 */
export const EditorialLightbox: React.FC<EditorialLightboxProps> = ({
  items,
  activeIndex,
  onClose,
  onChangeIndex,
  badgeLabel,
  subtitleLabel,
  enableReactions = false,
  myReactions = {},
  reactionCounts,
  onReact,
  canDelete,
  onDelete,
}) => {
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  const isOpen = activeIndex !== null && items[activeIndex] !== undefined;
  const currentItem = isOpen && activeIndex !== null ? items[activeIndex] : null;

  useEffect(() => {
    if (!isOpen || activeIndex === null) return;

    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && activeIndex > 0) {
        onChangeIndex(activeIndex - 1);
      } else if (e.key === 'ArrowRight' && activeIndex < items.length - 1) {
        onChangeIndex(activeIndex + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, activeIndex, items.length, onClose, onChangeIndex]);

  if (typeof document === 'undefined') return null;

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartXRef.current = e.touches[0].clientX;
      touchStartYRef.current = e.touches[0].clientY;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (
      touchStartXRef.current === null ||
      touchStartYRef.current === null ||
      activeIndex === null
    ) {
      return;
    }

    const dx = e.changedTouches[0].clientX - touchStartXRef.current;
    const dy = e.changedTouches[0].clientY - touchStartYRef.current;
    touchStartXRef.current = null;
    touchStartYRef.current = null;

    // Solo disparar swipe si el gesto horizontal domina claramente sobre el vertical
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      if (dx < 0 && activeIndex < items.length - 1) {
        onChangeIndex(activeIndex + 1);
      } else if (dx > 0 && activeIndex > 0) {
        onChangeIndex(activeIndex - 1);
      }
    }
  };

  const counts = currentItem
    ? reactionCounts
      ? reactionCounts(currentItem)
      : {
          corazon: currentItem.reacciones_corazon || 0,
          estrella: currentItem.reacciones_estrella || 0,
        }
    : { corazon: 0, estrella: 0 };

  const activeReaction = currentItem
    ? myReactions[currentItem.id] ?? currentItem.mi_reaccion ?? null
    : null;

  return createPortal(
    <AnimatePresence>
      {isOpen && currentItem && activeIndex !== null && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="fixed inset-0 z-[130] h-[100dvh] w-screen bg-gala-obsidian/96 backdrop-blur-2xl flex flex-col justify-between p-3.5 sm:p-6 overflow-hidden select-none"
        >
          <StageBackground />

          {/* Barra superior */}
          <div className="relative z-20 flex items-center justify-between gap-2 max-w-6xl mx-auto w-full">
            <div className="flex items-center gap-2 min-w-0">
              <span className="px-3 py-1 rounded-full bg-gala-surface/80 border border-gala-silver/20 text-[11px] font-mono tabular-nums text-gala-champagne shrink-0">
                {activeIndex + 1} / {items.length}
              </span>
              {badgeLabel && (
                <span className="px-2.5 py-1 rounded-full bg-gala-gold/15 border border-gala-gold/35 text-[10px] sm:text-[11px] font-display uppercase tracking-wider text-gala-champagne truncate">
                  {badgeLabel(currentItem)}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl bg-gala-surface/85 hover:bg-gala-card border border-gala-silver/25 text-xs font-semibold text-gala-ivory flex items-center gap-1.5 transition shrink-0"
            >
              <X className="w-4 h-4 text-gala-gold" />
              <span className="hidden sm:inline">Cerrar</span>
            </button>
          </div>

          {/* Lienzo fotográfico central con flechas laterales en escritorio y ambient blur */}
          <div className="relative z-20 flex-1 min-h-0 max-w-6xl mx-auto w-full flex items-center justify-center my-2 sm:my-3">
            <button
              type="button"
              disabled={activeIndex === 0}
              onClick={() => onChangeIndex(Math.max(0, activeIndex - 1))}
              className="hidden sm:flex absolute left-2 z-30 w-10 h-10 rounded-full bg-gala-obsidian/70 hover:bg-gala-surface border border-gala-silver/25 disabled:opacity-20 items-center justify-center text-gala-champagne backdrop-blur-md transition"
              aria-label="Foto anterior"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="relative w-full h-full rounded-2xl overflow-hidden bg-gala-obsidian/80 border border-gala-silver/15 flex items-center justify-center shadow-2xl">
              {currentItem.tipo_medio !== 'VIDEO' && (
                <>
                  <img
                    src={currentItem.archivo_url}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 w-full h-full object-cover scale-125 blur-3xl opacity-30 pointer-events-none"
                  />
                  <div className="absolute inset-0 bg-gala-obsidian/45 pointer-events-none" />
                </>
              )}

              <AnimatePresence mode="wait">
                <motion.div
                  key={currentItem.id}
                  initial={{ opacity: 0, scale: 0.985 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.22 }}
                  className="relative z-10 w-full h-full flex items-center justify-center p-1 sm:p-3"
                >
                  {currentItem.tipo_medio === 'VIDEO' ? (
                    <video
                      key={currentItem.id}
                      src={currentItem.archivo_url}
                      controls
                      autoPlay
                      playsInline
                      className="max-h-full max-w-full object-contain rounded-xl shadow-2xl"
                    />
                  ) : (
                    <img
                      src={currentItem.archivo_url}
                      alt={currentItem.pie_de_foto}
                      className="max-h-full max-w-full object-contain rounded-xl shadow-2xl"
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            <button
              type="button"
              disabled={activeIndex === items.length - 1}
              onClick={() => onChangeIndex(Math.min(items.length - 1, activeIndex + 1))}
              className="hidden sm:flex absolute right-2 z-30 w-10 h-10 rounded-full bg-gala-obsidian/70 hover:bg-gala-surface border border-gala-silver/25 disabled:opacity-20 items-center justify-center text-gala-champagne backdrop-blur-md transition"
              aria-label="Siguiente foto"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Tarjeta inferior de dedicatoria + reacciones + acciones */}
          <div className="relative z-20 max-w-3xl mx-auto w-full space-y-2.5">
            <div className="px-4 py-3 rounded-2xl glass flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="min-w-0">
                <p className="font-serif italic text-lg sm:text-xl text-gala-ivory leading-snug">
                  "{currentItem.pie_de_foto}"
                </p>
                <p className="text-xs text-gala-gold mt-0.5 truncate">
                  {subtitleLabel
                    ? subtitleLabel(currentItem)
                    : `${currentItem.autor_nombre || 'Graduado TECNM'}${
                        currentItem.autor_mesa ? ` · ${currentItem.autor_mesa}` : ''
                      }`}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {enableReactions && onReact && (
                  <>
                    <button
                      type="button"
                      onClick={() => onReact(currentItem.id, 'CORAZON')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition tabular-nums ${
                        activeReaction === 'CORAZON'
                          ? 'bg-rose-900/70 border border-rose-400 text-rose-100 ring-1 ring-rose-400'
                          : 'bg-rose-950/40 hover:bg-rose-950/70 border border-rose-500/35 text-rose-300'
                      }`}
                    >
                      <Heart
                        className={`w-3.5 h-3.5 ${
                          activeReaction === 'CORAZON'
                            ? 'text-rose-400 fill-rose-400'
                            : 'text-rose-400/80'
                        }`}
                      />
                      <span>{counts.corazon}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onReact(currentItem.id, 'ESTRELLA')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition tabular-nums ${
                        activeReaction === 'ESTRELLA'
                          ? 'bg-amber-900/70 border border-gala-gold text-gala-champagne ring-1 ring-gala-gold'
                          : 'bg-amber-950/40 hover:bg-amber-950/70 border border-gala-gold/35 text-gala-champagne'
                      }`}
                    >
                      <Sparkles
                        className={`w-3.5 h-3.5 ${
                          activeReaction === 'ESTRELLA'
                            ? 'text-gala-gold fill-gala-gold'
                            : 'text-gala-gold/80'
                        }`}
                      />
                      <span>{counts.estrella}</span>
                    </button>
                  </>
                )}

                <a
                  href={currentItem.archivo_url}
                  download={currentItem.nombre_original || `Gala_TECNM_${currentItem.id}`}
                  className="px-3.5 py-1.5 rounded-xl btn-gold text-gala-obsidian font-semibold text-xs inline-flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar</span>
                </a>

                {canDelete && canDelete(currentItem) && onDelete && (
                  <button
                    type="button"
                    onClick={() => onDelete(currentItem)}
                    className="p-2 rounded-xl bg-red-950/70 hover:bg-red-900 border border-red-500/40 text-red-200 transition"
                    title="Eliminar fotografía"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="sm:hidden flex items-center justify-between text-[11px] text-gala-muted px-1">
              <button
                type="button"
                disabled={activeIndex === 0}
                onClick={() => onChangeIndex(Math.max(0, activeIndex - 1))}
                className="disabled:opacity-30 flex items-center gap-1 text-gala-silver"
              >
                <ChevronLeft className="w-3.5 h-3.5 text-gala-gold" /> Anterior
              </button>
              <span>Desliza para cambiar</span>
              <button
                type="button"
                disabled={activeIndex === items.length - 1}
                onClick={() => onChangeIndex(Math.min(items.length - 1, activeIndex + 1))}
                className="disabled:opacity-30 flex items-center gap-1 text-gala-silver"
              >
                Siguiente <ChevronRight className="w-3.5 h-3.5 text-gala-gold" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

