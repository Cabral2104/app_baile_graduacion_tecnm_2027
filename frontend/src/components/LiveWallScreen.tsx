import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wifi,
  WifiOff,
  Pause,
  Play,
  SkipForward,
  SkipBack,
  Maximize2,
  ArrowLeft,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { MediaItem, SystemConfig } from '../types';
import { api } from '../services/api';
import { QrCodeMatrix } from './QrCodeMatrix';
import { StageBackground } from './StageBackground';
import { AmbientLeavesCanvas } from './AmbientLeavesCanvas';

const OFFLINE_CACHE_KEY = 'gala_livewall_party_only_cache_v2';
const BUFFER_AHEAD_COUNT = 5;

interface LiveWallScreenProps {
  onExit: () => void;
}

export const LiveWallScreen: React.FC<LiveWallScreenProps> = ({ onExit }) => {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [backendConnected, setBackendConnected] = useState(true);
  const [bufferedCount, setBufferedCount] = useState(0);
  const [progressPct, setProgressPct] = useState(0);

  const blobCacheRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    localStorage.removeItem('gala_livewall_offline_cache_v1');
  }, []);

  const preloadUpcomingBuffer = useCallback(
    async (list: MediaItem[], startIdx: number) => {
      if (list.length === 0) {
        setBufferedCount(0);
        return;
      }

      const countToPreload = Math.min(BUFFER_AHEAD_COUNT, list.length);
      let ready = 0;

      for (let offset = 0; offset < countToPreload; offset++) {
        const idx = (startIdx + offset) % list.length;
        const target = list[idx];
        if (!target) continue;

        if (blobCacheRef.current.has(target.archivo_url)) {
          ready++;
          continue;
        }

        try {
          const response = await fetch(target.archivo_url, { cache: 'force-cache' });
          if (response.ok) {
            const blob = await response.blob();
            const localObjectUrl = URL.createObjectURL(blob);
            blobCacheRef.current.set(target.archivo_url, localObjectUrl);
            ready++;
          }
        } catch {
          // Conserva los blobs ya almacenados en RAM
        }
      }

      setBufferedCount(ready);
    },
    []
  );

  const syncApprovedMedia = useCallback(async () => {
    try {
      const res = await api.getPublicMediaAndConfig();
      setConfig(res.config);
      setBackendConnected(true);

      const partyItems = res.items.filter(
        (i) => i.estado === 'APROBADO_GALERIA'
      );

      setItems(partyItems);
      localStorage.setItem(OFFLINE_CACHE_KEY, JSON.stringify(partyItems));

      if (partyItems.length === 0) {
        setCurrentIndex(0);
        setBufferedCount(0);
      } else {
        setCurrentIndex((prev) => (prev >= partyItems.length ? 0 : prev));
        preloadUpcomingBuffer(partyItems, 0);
      }
    } catch {
      setBackendConnected(false);
      try {
        const cached = localStorage.getItem(OFFLINE_CACHE_KEY);
        if (cached) {
          const parsed: MediaItem[] = JSON.parse(cached);
          setItems(parsed.filter((i) => i.estado === 'APROBADO_GALERIA'));
        }
      } catch {
        // Ignorar errores de lectura de caché
      }
    }
  }, [preloadUpcomingBuffer]);

  useEffect(() => {
    syncApprovedMedia();

    const eventSource = new EventSource('/api/live/stream');
    eventSource.addEventListener('CONNECTED', () => setBackendConnected(true));
    eventSource.addEventListener('MEDIA_APPROVED', () => syncApprovedMedia());
    eventSource.addEventListener('MEDIA_MODERATED', () => syncApprovedMedia());
    eventSource.onerror = () => {};

    const fallbackInterval = setInterval(syncApprovedMedia, 5000);

    return () => {
      eventSource.close();
      clearInterval(fallbackInterval);
    };
  }, [syncApprovedMedia]);

  const currentItem = items[currentIndex] || null;
  const currentIsVideo = currentItem?.tipo_medio === 'VIDEO';

  useEffect(() => {
    setProgressPct(0);
    if (items.length > 0) {
      preloadUpcomingBuffer(items, currentIndex);
    }
  }, [currentIndex, items.length, preloadUpcomingBuffer]);

  // Avance automático inmune al polling cada 5 segundos
  useEffect(() => {
    if (!isPlaying || items.length === 0 || currentIsVideo) return;

    const stepMs = 80;
    const totalMs = 5000;
    const inc = (stepMs / totalMs) * 100;

    const interval = setInterval(() => {
      setProgressPct((prev) => {
        if (prev + inc >= 100) {
          setCurrentIndex((idx) => (idx + 1) % items.length);
          return 0;
        }
        return prev + inc;
      });
    }, stepMs);

    return () => clearInterval(interval);
  }, [isPlaying, currentIndex, items.length, currentIsVideo]);

  const resolvedMediaSrc = currentItem
    ? blobCacheRef.current.get(currentItem.archivo_url) || currentItem.archivo_url
    : '';

  const requestFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <div className="fixed inset-0 z-[120] h-[100dvh] w-screen bg-gala-obsidian text-gala-ivory flex flex-col justify-between overflow-hidden select-none">
      <StageBackground />
      <AmbientLeavesCanvas enabled density="subtle" />
      <div className="pointer-events-none fixed inset-3 sm:inset-4 border border-gala-silver/25 rounded-2xl z-20" />

      {/* Barra Superior */}
      <header className="relative z-30 px-4 sm:px-8 pt-5 pb-2 space-y-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onExit}
              className="px-3.5 py-2 rounded-xl btn-silver text-xs font-medium text-gala-ivory flex items-center gap-1.5 transition shrink-0"
            >
              <ArrowLeft className="w-4 h-4 text-gala-gold" /> Volver
            </button>
            <div className="min-w-0">
              <div className="text-[10px] sm:text-[11px] uppercase tracking-[0.22em] text-gala-gold flex items-center gap-1.5 truncate">
                <Sparkles className="w-3 h-3 text-gala-silver shrink-0" />
                <span>Carrusel en Vivo · La Noche Estrellada</span>
              </div>
              <h1 className="font-serif text-lg sm:text-2xl text-gala-ivory truncate">
                {config?.titulo_evento || 'Graduación TECNM'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden md:flex px-3.5 py-1.5 rounded-full bg-gala-surface/90 border border-gala-silver/30 text-xs items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-gala-gold" />
              <span className="font-mono text-gala-silver">
                Buffer: {bufferedCount}/{Math.min(BUFFER_AHEAD_COUNT, items.length)} listas
              </span>
            </div>

            <div
              className={`px-3 py-1.5 rounded-full border text-xs flex items-center gap-1.5 ${
                backendConnected
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                  : 'bg-red-950/70 border-red-500/40 text-red-300'
              }`}
            >
              {backendConnected ? (
                <>
                  <Wifi className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Conectado</span> ({items.length})
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Modo Local</span>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={requestFullScreen}
              className="p-2.5 rounded-xl bg-gala-surface border border-gala-silver/30 text-gala-champagne hover:border-gala-gold"
              title="Pantalla Completa para Proyector"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {items.length > 0 && (
          <div className="w-full h-1.5 rounded-full bg-gala-surface/80 overflow-hidden border border-gala-silver/20">
            <div
              className="h-full bg-gradient-to-r from-gala-silver via-gala-gold to-gala-champagne transition-all duration-100 ease-linear"
              style={{ width: `${currentIsVideo ? 100 : progressPct}%` }}
            />
          </div>
        )}
      </header>

      {/* Visor Central */}
      <main className="relative z-20 flex-1 min-h-0 px-4 sm:px-8 py-2 grid grid-cols-1 lg:grid-cols-12 gap-5 items-center overflow-hidden">
        {currentItem ? (
          <>
            <div className="lg:col-span-8 h-full min-h-0 flex items-center justify-center overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentItem.id}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1.03 }}
                  exit={{ opacity: 0 }}
                  transition={{
                    opacity: { duration: 0.6 },
                    scale: { duration: 5, ease: 'easeOut' },
                  }}
                  className="w-full h-full max-h-[52vh] lg:max-h-[68vh] flex items-center justify-center"
                >
                  {currentItem.tipo_medio === 'VIDEO' ? (
                    <video
                      src={resolvedMediaSrc}
                      autoPlay
                      onEnded={() =>
                        setCurrentIndex((prev) => (prev + 1) % items.length)
                      }
                      className="max-h-full max-w-full object-contain rounded-2xl border border-gala-silver/35 shadow-2xl"
                    />
                  ) : (
                    <img
                      src={resolvedMediaSrc}
                      alt={currentItem.pie_de_foto}
                      className="max-h-full max-w-full object-contain rounded-2xl border border-gala-silver/35 shadow-2xl"
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="lg:col-span-4 flex flex-col justify-between gap-4">
              <div className="p-5 sm:p-6 rounded-2xl glass space-y-3 shadow-2xl">
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-full bg-gala-gold/15 border border-gala-gold/40 text-[11px] font-mono uppercase text-gala-champagne">
                    {currentItem.autor_mesa || 'Día de la Fiesta'}
                  </span>
                  <span className="font-mono text-xs text-gala-silver">
                    Foto {currentIndex + 1} de {items.length}
                  </span>
                </div>

                <blockquote className="font-serif italic text-xl sm:text-3xl text-gala-ivory leading-snug">
                  "{currentItem.pie_de_foto}"
                </blockquote>

                <div className="pt-2.5 border-t border-gala-silver/20">
                  <div className="text-sm sm:text-base font-semibold text-gala-champagne">
                    {currentItem.autor_nombre}
                  </div>
                  <div className="text-xs text-gala-silver/80 mt-0.5">
                    {currentItem.autor_distintivo}
                  </div>
                </div>
              </div>

              <div className="hidden sm:flex p-4 rounded-2xl glass items-center gap-4">
                <div className="shrink-0">
                  <QrCodeMatrix value={window.location.origin} size={74} />
                </div>
                <div className="space-y-1">
                  <div className="text-xs uppercase tracking-widest text-gala-gold font-semibold">
                    Sube tu Foto desde tu Mesa
                  </div>
                  <p className="text-xs text-gala-silver leading-snug">
                    Entra a <strong>Día de la Fiesta</strong> desde tu celular, sube tu foto y aparecerá en esta pantalla.
                  </p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="col-span-12 max-w-xl mx-auto text-center space-y-4 p-8 rounded-2xl glass">
            <p className="font-serif text-3xl text-gala-champagne">
              No hay fotos activas en el carrusel del Día de la Fiesta (0 fotos)
            </p>
            <p className="text-xs sm:text-sm text-gala-parchment/85 leading-relaxed">
              Actualmente ninguna foto tiene el estatus de mostrarse en el <strong>Día de la Fiesta</strong>. Para que aparezcan aquí, entra al apartado <strong>4. Organizadoras</strong> y toca el botón <strong>"Día de la Fiesta"</strong> en las fotos que quieras proyectar.
            </p>
            <button
              type="button"
              onClick={onExit}
              className="px-5 py-2.5 rounded-xl btn-gold text-gala-obsidian font-semibold text-xs inline-flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> Volver a la Aplicación
            </button>
          </div>
        )}
      </main>

      {/* Controles Inferiores Siempre Visibles */}
      <footer className="relative z-30 px-4 sm:px-8 pb-5 pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gala-silver">
        <div className="hidden sm:block">
          Carrusel exclusivo para fotos aprobadas en "Día de la Fiesta"
        </div>
        {items.length > 0 && (
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                setProgressPct(0);
                setCurrentIndex((prev) =>
                  prev === 0 ? items.length - 1 : prev - 1
                );
              }}
              className="px-3.5 py-2.5 rounded-xl btn-silver text-gala-ivory flex items-center gap-1.5 font-semibold"
            >
              <SkipBack className="w-3.5 h-3.5 text-gala-gold" /> Anterior
            </button>
            <button
              type="button"
              onClick={() => setIsPlaying((p) => !p)}
              className="px-5 py-2.5 rounded-xl btn-gold text-gala-obsidian font-semibold flex items-center gap-1.5 shadow-lg"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-3.5 h-3.5 fill-current" /> Pausar Carrusel
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" /> Reproducir Carrusel
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setProgressPct(0);
                setCurrentIndex((prev) =>
                  items.length > 0 ? (prev + 1) % items.length : 0
                );
              }}
              className="px-3.5 py-2.5 rounded-xl btn-silver text-gala-ivory flex items-center gap-1.5 font-semibold"
            >
              Siguiente <SkipForward className="w-3.5 h-3.5 text-gala-gold" />
            </button>
          </div>
        )}
      </footer>
    </div>
  );
};
