import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Film,
  Upload,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Download,
  ShieldAlert,
  CheckCircle2,
  X,
  Camera,
  Maximize2,
  Eye,
  Clock,
  AlertCircle,
  Trash2,
  Sparkles,
  RotateCcw,
  Search,
  Heart,
} from 'lucide-react';
import { MediaItem, SystemConfig, User, MediaEtapa } from '../types';
import { api } from '../services/api';
import {
  compressImageClientSide,
  getVideoDurationSeconds,
  formatBytes,
} from '../utils/imageCompression';
import { PaginationBar } from './PaginationBar';
import { StageBackground } from './StageBackground';

interface MemoryGalleryProps {
  items: MediaItem[];
  config: SystemConfig | null;
  currentUser: User | null;
  onRequireAuth: () => void;
  onRefresh: () => void;
}

const ETAPAS: Array<{ id: MediaEtapa; title: string; desc: string }> = [
  {
    id: 'INICIO',
    title: '1. El Inicio',
    desc: 'Primeros semestres, bienvenida y primeras amistades',
  },
  {
    id: 'SUPERVIVENCIA',
    title: '2. Supervivencia',
    desc: 'Desveladas, proyectos, viajes y exámenes',
  },
  {
    id: 'RECTA_FINAL',
    title: '3. Recta Final',
    desc: 'Último semestre, foto con toga y despedida',
  },
];

export const MemoryGallery: React.FC<MemoryGalleryProps> = ({
  items,
  config,
  currentUser,
  onRequireAuth,
  onRefresh,
}) => {
  // En Modo Memoria se muestran EXCLUSIVAMENTE las fotos y videos cuyo estatus actual es "APROBADO_VIDEO" ("Al Video")
  const videoMemories = items.filter((i) => i.estado === 'APROBADO_VIDEO');

  const [etapaFilter, setEtapaFilter] = useState<'TODAS' | MediaEtapa>('TODAS');
  const [searchQuery, setSearchQuery] = useState('');
  const [showUploadBox, setShowUploadBox] = useState(false);

  // Paginación para evitar saturación visual y lentitud cuando haya muchas fotos
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  // Estado del Presentador en Pantalla Grande (Modo Video Conmemorativo)
  const [presentationOpen, setPresentationOpen] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const [isPlayingVideo, setIsPlayingVideo] = useState(true);
  const [slideProgressPct, setSlideProgressPct] = useState(0);

  // Estado para ver una foto individual en grande (Una por una)
  const [selectedViewerIndex, setSelectedViewerIndex] = useState<number | null>(null);

  // Estado de subida de recuerdo para el video
  const [etapa, setEtapa] = useState<MediaEtapa>('INICIO');
  const [pieDeFoto, setPieDeFoto] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [myPreEventUploads, setMyPreEventUploads] = useState<MediaItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Estado de Solicitud de Retiro por Privacidad
  const [takedownTarget, setTakedownTarget] = useState<MediaItem | null>(null);
  const [takedownReason, setTakedownReason] = useState('');
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);

  // Estados para reacciones en tiempo real en recuerdos y control anti-spam de 1 reacción por persona
  const [localReactions, setLocalReactions] = useState<
    Record<string, { corazon: number; estrella: number }>
  >({});
  const [myReactions, setMyReactions] = useState<
    Record<string, 'CORAZON' | 'ESTRELLA' | null>
  >({});

  // Sincronizar mis reacciones cuando cargan los recuerdos
  useEffect(() => {
    const map: Record<string, 'CORAZON' | 'ESTRELLA' | null> = {};
    videoMemories.forEach((p) => {
      if (p.mi_reaccion) {
        map[p.id] = p.mi_reaccion;
      }
    });
    if (Object.keys(map).length > 0) {
      setMyReactions((prev) => ({ ...map, ...prev }));
    }
  }, [videoMemories]);

  const handleReactMemory = async (mediaId: string, tipo: 'CORAZON' | 'ESTRELLA') => {
    const targetItem = videoMemories.find((i) => i.id === mediaId);
    const currentReaction = myReactions[mediaId] ?? targetItem?.mi_reaccion ?? null;

    // Si vuelve a presionar la misma reacción -> se quita (Toggle off)
    const isTogglingOff = currentReaction === tipo;
    const nextReaction: 'CORAZON' | 'ESTRELLA' | null = isTogglingOff ? null : tipo;

    // Vibración háptica solo cuando se activa una reacción
    if (!isTogglingOff && typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(20);
      } catch {}
    }

    // Actualización optimista de la reacción personal (1 reacción por persona)
    setMyReactions((prev) => ({
      ...prev,
      [mediaId]: nextReaction,
    }));

    // Actualización optimista estricta de conteos para evitar spam
    setLocalReactions((prev) => {
      const current = prev[mediaId] || {
        corazon: targetItem?.reacciones_corazon || 0,
        estrella: targetItem?.reacciones_estrella || 0,
      };
      let newCorazon = current.corazon;
      let newEstrella = current.estrella;

      if (isTogglingOff) {
        if (tipo === 'CORAZON') newCorazon = Math.max(0, newCorazon - 1);
        if (tipo === 'ESTRELLA') newEstrella = Math.max(0, newEstrella - 1);
      } else if (currentReaction === null) {
        if (tipo === 'CORAZON') newCorazon += 1;
        if (tipo === 'ESTRELLA') newEstrella += 1;
      } else {
        if (tipo === 'CORAZON') {
          newCorazon += 1;
          newEstrella = Math.max(0, newEstrella - 1);
        } else {
          newEstrella += 1;
          newCorazon = Math.max(0, newCorazon - 1);
        }
      }

      return {
        ...prev,
        [mediaId]: {
          corazon: newCorazon,
          estrella: newEstrella,
        },
      };
    });

    try {
      const res = await api.reactToMedia(mediaId, tipo);
      if (res?.counts) {
        setLocalReactions((prev) => ({
          ...prev,
          [mediaId]: {
            corazon: res.counts.corazon,
            estrella: res.counts.estrella,
          },
        }));
      }
      if (res && res.user_reaction !== undefined) {
        setMyReactions((prev) => ({
          ...prev,
          [mediaId]: res.user_reaction,
        }));
      }
    } catch {
      // Revertir a la reacción anterior en caso de fallo
      setMyReactions((prev) => ({
        ...prev,
        [mediaId]: currentReaction,
      }));
    }
  };

  const normalizeSearch = (text: string) =>
    (text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

  const filteredMemories = videoMemories.filter((item) => {
    if (etapaFilter !== 'TODAS' && item.etapa !== etapaFilter) {
      return false;
    }
    const term = normalizeSearch(searchQuery);
    if (term) {
      const nameMatch = normalizeSearch(item.autor_nombre || '').includes(term);
      const badgeMatch = normalizeSearch(item.autor_distintivo || '').includes(term);
      const captionMatch = normalizeSearch(item.pie_de_foto || '').includes(term);
      if (!nameMatch && !badgeMatch && !captionMatch) {
        return false;
      }
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredMemories.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedMemories = filteredMemories.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  const loadMyUploads = () => {
    if (!currentUser) return;
    api
      .getMyUploads()
      .then((res) =>
        setMyPreEventUploads(
          res.items.filter((i) => i.origen === 'PRE_EVENTO')
        )
      )
      .catch(() => {});
  };

  useEffect(() => {
    loadMyUploads();
  }, [currentUser?.id]);

  // Bloquear scroll del body cuando un modal de pantalla completa esté abierto
  useEffect(() => {
    if (presentationOpen || selectedViewerIndex !== null) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [presentationOpen, selectedViewerIndex]);

  const currentSlideItem = videoMemories[activeSlide] || videoMemories[0] || null;
  const currentSlideDurationSec = currentSlideItem?.duracion_display_seg || 4;
  const currentSlideIsVideo = currentSlideItem?.tipo_medio === 'VIDEO';

  // Regla de negocio por fase:
  // - Antes de la Fiesta (PRE_EVENTO): subidas abiertas en Modo Memoria.
  // - Día de la Fiesta (EN_VIVO): subidas cerradas en Modo Memoria (solo abiertas en Día de la Fiesta).
  // - Fiesta Terminada (MEMORIA): subidas cerradas para invitados; habilitadas únicamente para rol ADMIN.
  const faseActual = config?.fase_actual || 'PRE_EVENTO';
  const isAdmin = currentUser?.rol === 'ADMIN';
  const canUploadMemory =
    (faseActual === 'PRE_EVENTO' && config?.subidas_abiertas !== false) ||
    (faseActual === 'MEMORIA' && isAdmin);

  useEffect(() => {
    if (!canUploadMemory && showUploadBox) {
      setShowUploadBox(false);
    }
  }, [canUploadMemory, showUploadBox]);

  // Reiniciar barra de progreso cuando cambia de escena
  useEffect(() => {
    setSlideProgressPct(0);
  }, [activeSlide, presentationOpen]);

  // Avance automático fluido e inmune al polling de fondo de App.tsx
  useEffect(() => {
    if (
      !presentationOpen ||
      !isPlayingVideo ||
      videoMemories.length === 0 ||
      currentSlideIsVideo
    ) {
      return;
    }

    const stepMs = 80;
    const totalMs = currentSlideDurationSec * 1000;
    const increment = (stepMs / totalMs) * 100;

    const interval = setInterval(() => {
      setSlideProgressPct((prev) => {
        if (prev + increment >= 100) {
          setActiveSlide((idx) => (idx + 1) % videoMemories.length);
          return 0;
        }
        return prev + increment;
      });
    }, stepMs);

    return () => clearInterval(interval);
  }, [
    presentationOpen,
    isPlayingVideo,
    activeSlide,
    videoMemories.length,
    currentSlideDurationSec,
    currentSlideIsVideo,
  ]);

  const handleSelectFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;
    setUploadError(null);

    if (rawFile.size > 50 * 1024 * 1024) {
      setUploadError('El archivo no debe pesar más de 50 MB.');
      return;
    }

    const fileIsVideo =
      rawFile.type.startsWith('video/') || /\.(mp4|mov|webm)$/i.test(rawFile.name);

    try {
      if (fileIsVideo) {
        const duration = await getVideoDurationSeconds(rawFile).catch(() => 15);
        if (duration > 45) {
          setUploadError('El video corto no debe pasar de 45 segundos.');
          return;
        }
        setIsVideo(true);
        setVideoDuration(duration);
        setSelectedFile(rawFile);
        setPreviewUrl(URL.createObjectURL(rawFile));
      } else {
        setIsVideo(false);
        setVideoDuration(null);
        const compressed = await compressImageClientSide(rawFile, 1920, 0.84);
        setSelectedFile(compressed.file);
        setPreviewUrl(URL.createObjectURL(compressed.file));
      }
    } catch {
      setUploadError('No se pudo leer el archivo seleccionado.');
    }
  };

  const handleUploadMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    if (!selectedFile || !pieDeFoto.trim()) {
      setUploadError('Selecciona una foto/video y escribe la historia de este recuerdo.');
      return;
    }

    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append('archivo', selectedFile);
      formData.append('origen', 'PRE_EVENTO');
      formData.append('etapa', etapa);
      formData.append('pie_de_foto', pieDeFoto.trim());
      if (videoDuration) formData.append('duracion_seg', String(videoDuration));

      await api.uploadMedia(formData);
      setPieDeFoto('');
      setSelectedFile(null);
      setPreviewUrl(null);
      setShowUploadBox(false);
      setFeedbackBanner(
        'Tu recuerdo fue enviado para el Video de Generación. Las organizadoras lo revisarán para incluirlo.'
      );
      loadMyUploads();
      onRefresh();
      setTimeout(() => setFeedbackBanner(null), 5000);
    } catch (err: any) {
      setUploadError(err.message || 'Error al enviar el recuerdo.');
    } finally {
      setUploading(false);
    }
  };

  const handleRequestTakedown = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!takedownTarget) return;
    const res = await api.requestTakedown(
      takedownTarget.id,
      takedownReason.trim() || 'Solicitud de privacidad',
      currentUser?.nombre_completo || 'Graduado'
    );
    setTakedownTarget(null);
    setTakedownReason('');
    setFeedbackBanner(res.message);
    onRefresh();
    setTimeout(() => setFeedbackBanner(null), 5000);
  };

  return (
    <div className="space-y-6">
      {feedbackBanner && (
        <div className="p-4 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-xs sm:text-sm text-emerald-200 flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{feedbackBanner}</span>
        </div>
      )}

      {/* CABECERA PRINCIPAL DE MODO MEMORIA (FOTOS "AL VIDEO" ANTES DE LA FIESTA) */}
      <div className="p-6 sm:p-8 rounded-2xl glass shadow-xl space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <span className="text-[11px] uppercase tracking-[0.25em] text-gala-gold font-semibold inline-flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-gala-silver" />
              Apartado 1 · Antes de la Fiesta (Video Conmemorativo)
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl text-gala-ivory">
              Modo Memoria · Recuerdos de la Carrera
            </h2>
            <p className="text-xs sm:text-sm text-gala-parchment/90 max-w-2xl leading-relaxed">
              Aquí se reúnen todas las fotografías y clips históricos de la universidad aprobados como <strong>"Al Video"</strong>. Desde aquí puedes presentar el video en pantalla grande o subir tus recuerdos de la carrera.
            </p>
          </div>

          {/* 2 Botones Principales Grandes y Claros */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <button
              type="button"
              disabled={videoMemories.length === 0}
              onClick={() => {
                setActiveSlide(0);
                setSlideProgressPct(0);
                setIsPlayingVideo(true);
                setPresentationOpen(true);
              }}
              className="px-5 py-3.5 rounded-xl btn-gold disabled:opacity-40 text-gala-obsidian font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Presentar Video en Pantalla Grande</span>
            </button>

            {canUploadMemory ? (
              <button
                type="button"
                onClick={() => {
                  if (!currentUser) {
                    onRequireAuth();
                  } else {
                    setShowUploadBox((prev) => !prev);
                  }
                }}
                className="px-5 py-3.5 rounded-xl btn-silver font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition"
              >
                <Upload className="w-4 h-4 text-gala-gold" />
                <span>
                  {showUploadBox
                    ? 'Cerrar Formulario'
                    : faseActual === 'MEMORIA' && isAdmin
                    ? 'Subir Foto al Video (Admin)'
                    : 'Subir Foto para el Video'}
                </span>
              </button>
            ) : (
              <div className="px-4 py-3 rounded-xl bg-gala-obsidian/85 border border-gala-silver/25 text-xs text-gala-silver flex items-center justify-center gap-2">
                <Clock className="w-4 h-4 text-gala-gold shrink-0" />
                <span>
                  {faseActual === 'EN_VIVO'
                    ? 'Recepción de Memorias cerrada · Fase activa: Día de la Fiesta'
                    : 'Fiesta Terminada · Subidas solo para Organizadoras'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* FORMULARIO DESPLEGABLE PARA SUBIR RECUERDO DE LA CARRERA ("AL VIDEO") */}
        <AnimatePresence>
          {showUploadBox && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              onSubmit={handleUploadMemory}
              className="pt-5 border-t border-gala-silver/20 space-y-5 overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-serif text-xl text-gala-ivory">
                  Subir un Recuerdo de la Universidad para el Video
                </h3>
                <button
                  type="button"
                  onClick={() => setShowUploadBox(false)}
                  className="text-xs text-gala-muted hover:text-gala-ivory"
                >
                  Cancelar
                </button>
              </div>

              {/* Paso 1: Elegir Etapa */}
              <div>
                <label className="block text-xs uppercase tracking-wider text-gala-gold mb-2">
                  Paso 1. ¿De qué etapa de la carrera es este recuerdo?
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {ETAPAS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setEtapa(opt.id)}
                      className={`p-3.5 rounded-xl border text-left transition ${
                        etapa === opt.id
                          ? 'bg-gala-gold/20 border-gala-gold text-gala-ivory'
                          : 'bg-gala-obsidian/80 border-gala-silver/20 text-gala-parchment hover:border-gala-gold/45'
                      }`}
                    >
                      <div className="font-serif text-base font-semibold text-gala-champagne">
                        {opt.title}
                      </div>
                      <div className="text-xs text-gala-parchment/80 mt-0.5">
                        {opt.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Paso 2: Elegir Foto o Video */}
              <div>
                <label className="block text-xs uppercase tracking-wider text-gala-gold mb-2">
                  Paso 2. Elige tu Foto o Video Corto
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/mp4,video/quicktime,video/webm"
                  onChange={handleSelectFile}
                  className="hidden"
                />
                {!selectedFile ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-8 px-4 rounded-xl border-2 border-dashed border-gala-silver/35 hover:border-gala-gold bg-gala-obsidian/70 flex flex-col items-center justify-center gap-2 text-center transition"
                  >
                    <Camera className="w-6 h-6 text-gala-gold" />
                    <span className="text-sm font-medium text-gala-ivory">
                      Toca aquí para seleccionar tu foto o video de la galería
                    </span>
                    <span className="text-xs text-gala-muted">
                      Fotos o videos de hasta 45 segundos
                    </span>
                  </button>
                ) : (
                  <div className="p-3 rounded-xl bg-gala-obsidian border border-gala-silver/30 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-gala-velvet shrink-0">
                        {isVideo ? (
                          <video
                            src={previewUrl || undefined}
                            className="w-full h-full object-cover"
                            muted
                          />
                        ) : (
                          <img
                            src={previewUrl || undefined}
                            alt="Vista previa"
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-gala-champagne truncate">
                          {selectedFile.name}
                        </div>
                        <div className="text-[11px] text-gala-muted">
                          {formatBytes(selectedFile.size)} · Lista para enviar
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        setPreviewUrl(null);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-red-950/60 text-xs text-red-200 border border-red-500/30 flex items-center gap-1 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Quitar
                    </button>
                  </div>
                )}
              </div>

              {/* Paso 3: Pie de Foto */}
              <div>
                <label className="block text-xs uppercase tracking-wider text-gala-gold mb-2">
                  Paso 3. Escribe qué pasaba en este recuerdo
                </label>
                <input
                  type="text"
                  maxLength={160}
                  required
                  value={pieDeFoto}
                  onChange={(e) => setPieDeFoto(e.target.value)}
                  placeholder="Ej. Nuestro primer día de clases en 2022 o Estudiando toda la noche..."
                  className="w-full px-4 py-3 rounded-xl bg-gala-obsidian border border-gala-silver/30 text-sm text-gala-ivory"
                />
              </div>

              {uploadError && (
                <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-xs text-red-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={uploading || !selectedFile}
                className="w-full py-3.5 rounded-xl btn-gold disabled:opacity-40 text-gala-obsidian font-semibold text-sm transition"
              >
                {uploading
                  ? 'Enviando recuerdo...'
                  : 'Guardar Recuerdo para el Video'}
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>

      {/* FILTROS POR ETAPA DE LA CARRERA Y BÚSQUEDA POR ALUMNO O HISTORIA */}
      <div className="glass rounded-2xl p-4 sm:p-5 space-y-3.5 border border-gala-silver/20 shadow-lg">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Pestañas de Etapas */}
          <div className="flex flex-wrap gap-2">
            {(
              [
                { id: 'TODAS', label: `Todas (${videoMemories.length})` },
                { id: 'INICIO', label: '1. El Inicio' },
                { id: 'SUPERVIVENCIA', label: '2. Supervivencia' },
                { id: 'RECTA_FINAL', label: '3. Recta Final' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setEtapaFilter(tab.id);
                  setCurrentPage(1);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-medium border transition ${
                  etapaFilter === tab.id
                    ? 'btn-gold border-gala-gold shadow font-semibold'
                    : 'bg-gala-velvet/90 text-gala-silver border-gala-silver/25 hover:border-gala-gold/50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Campo de búsqueda por alumno o historia */}
          <div className="relative min-w-[220px] md:max-w-xs flex-1">
            <Search className="w-4 h-4 text-gala-gold absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Buscar por alumno o historia..."
              className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-gala-obsidian/90 border border-gala-silver/30 text-xs text-gala-ivory placeholder-gala-muted focus:border-gala-gold focus:outline-none transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gala-muted hover:text-gala-ivory"
                title="Limpiar búsqueda"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Resumen de filtros y botón Ver Una por Una */}
        <div className="pt-2 border-t border-gala-silver/15 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2 text-gala-silver">
            <span>
              Mostrando <strong className="text-gala-champagne">{filteredMemories.length}</strong> de {videoMemories.length} recuerdos
            </span>
            {(searchQuery.trim() !== '' || etapaFilter !== 'TODAS') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setEtapaFilter('TODAS');
                  setCurrentPage(1);
                }}
                className="px-2 py-0.5 rounded-md bg-gala-velvet border border-gala-silver/30 text-gala-gold text-[11px] font-medium flex items-center gap-1 transition"
              >
                <RotateCcw className="w-3 h-3" /> Restablecer filtros
              </button>
            )}
          </div>

          {filteredMemories.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedViewerIndex(0)}
              className="px-3.5 py-1.5 rounded-xl btn-silver text-xs text-gala-champagne flex items-center gap-1.5 transition"
            >
              <Eye className="w-3.5 h-3.5 text-gala-gold" /> Ver Memorias Una por Una
            </button>
          )}
        </div>
      </div>

      {/* CUADRICULA PAGINADA DE MEMORIAS APROBADAS PARA EL VIDEO */}
      {filteredMemories.length === 0 ? (
        <div className="py-14 text-center glass rounded-2xl space-y-3">
          {searchQuery.trim() ? (
            <>
              <Search className="w-8 h-8 text-gala-gold/70 mx-auto" />
              <p className="text-base font-serif text-gala-ivory">
                No se encontraron recuerdos para "{searchQuery}"
              </p>
              <p className="text-xs text-gala-parchment/80 max-w-md mx-auto">
                No hay recuerdos de la carrera que coincidan con la búsqueda. Intenta con otro nombre o borra el término.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setEtapaFilter('TODAS');
                  setCurrentPage(1);
                }}
                className="px-4 py-2 rounded-xl btn-silver text-xs text-gala-champagne inline-flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5 text-gala-gold" /> Ver todas las memorias ({videoMemories.length})
              </button>
            </>
          ) : (
            <>
              <Film className="w-8 h-8 text-gala-gold mx-auto" />
              <p className="text-sm text-gala-parchment">
                Aún no hay recuerdos en esta etapa del video.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {paginatedMemories.map((item, idx) => {
              const globalIdx = (safePage - 1) * pageSize + idx;
              return (
                <motion.article
                  key={item.id}
                  initial={{ opacity: 0, y: 20, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{
                    duration: 0.45,
                    delay: Math.min(idx * 0.05, 0.4),
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="glass lift rounded-2xl overflow-hidden flex flex-col justify-between group"
                >
                  <div>
                    <div
                      onClick={() => setSelectedViewerIndex(globalIdx)}
                      className="relative aspect-[4/3] bg-gala-obsidian overflow-hidden flex items-center justify-center cursor-pointer"
                    >
                      {item.tipo_medio === 'VIDEO' ? (
                        <video
                          src={item.archivo_url}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <img
                          src={item.archivo_url}
                          alt={item.pie_de_foto}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                        />
                      )}
                      <div className="absolute top-3 left-3 flex items-center gap-1.5">
                        {item.storyboard_orden && (
                          <span className="px-2 py-0.5 rounded bg-gala-gold text-gala-obsidian font-mono text-[10px] font-bold shadow">
                            Escena #{String(item.storyboard_orden).padStart(2, '0')}
                          </span>
                        )}
                        <span className="px-2.5 py-0.5 rounded bg-gala-obsidian/90 border border-gala-silver/35 text-[10px] font-mono uppercase text-gala-silver">
                          {item.etapa}
                        </span>
                      </div>
                    </div>

                    <div className="p-4 space-y-2">
                      <p className="font-serif italic text-lg text-gala-ivory leading-snug">
                        "{item.pie_de_foto}"
                      </p>
                      <div className="flex items-center justify-between gap-2 pt-0.5">
                        <div className="text-xs text-gala-silver/85 truncate">
                          <span className="font-medium text-gala-champagne">
                            {item.autor_nombre}
                          </span>
                          {item.autor_distintivo ? ` · ${item.autor_distintivo}` : ''}
                        </div>

                        {/* Botones de Reacción compactos (Límite: 1 por persona) */}
                        {(() => {
                          const itemMyReaction = myReactions[item.id] ?? item.mi_reaccion ?? null;
                          const isItemHeart = itemMyReaction === 'CORAZON';
                          const isItemStar = itemMyReaction === 'ESTRELLA';
                          const counts = {
                            corazon: localReactions[item.id]?.corazon ?? item.reacciones_corazon ?? 0,
                            estrella: localReactions[item.id]?.estrella ?? item.reacciones_estrella ?? 0,
                          };

                          return (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReactMemory(item.id, 'CORAZON');
                                }}
                                className={`px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition active:scale-90 ${
                                  isItemHeart
                                    ? 'bg-rose-900/70 border border-rose-400 text-rose-100 ring-1 ring-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.35)]'
                                    : 'bg-rose-950/40 hover:bg-rose-950/70 border border-rose-500/30 text-rose-300'
                                }`}
                                title={
                                  isItemHeart
                                    ? 'Tu reacción activa · Toca para quitar'
                                    : 'Enviar corazón (máximo 1 por persona)'
                                }
                              >
                                <Heart
                                  className={`w-3 h-3 ${
                                    isItemHeart
                                      ? 'text-rose-400 fill-rose-400'
                                      : 'text-rose-400/80 fill-rose-400/20'
                                  }`}
                                />
                                <span>{counts.corazon}</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReactMemory(item.id, 'ESTRELLA');
                                }}
                                className={`px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition active:scale-90 ${
                                  isItemStar
                                    ? 'bg-amber-900/70 border border-gala-gold text-gala-champagne ring-1 ring-gala-gold shadow-[0_0_10px_rgba(212,175,55,0.35)]'
                                    : 'bg-amber-950/40 hover:bg-amber-950/70 border border-gala-gold/30 text-gala-champagne'
                                }`}
                                title={
                                  isItemStar
                                    ? 'Tu reacción activa · Toca para quitar'
                                    : 'Enviar estrella (máximo 1 por persona)'
                                }
                              >
                                <Sparkles
                                  className={`w-3 h-3 ${
                                    isItemStar
                                      ? 'text-gala-gold fill-gala-gold'
                                      : 'text-gala-gold/80'
                                  }`}
                                />
                                <span>{counts.estrella}</span>
                              </button>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  <div className="px-4 py-3 bg-gala-obsidian/85 border-t border-gala-silver/15 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedViewerIndex(globalIdx)}
                        className="px-2.5 py-1.5 rounded-lg bg-gala-surface hover:bg-gala-card text-xs text-gala-ivory border border-gala-silver/25 flex items-center gap-1"
                      >
                        <Maximize2 className="w-3 h-3 text-gala-gold" /> Ver grande
                      </button>
                      <a
                        href={item.archivo_url}
                        download={item.nombre_original || `Memoria_${item.id}`}
                        className="px-2.5 py-1.5 rounded-lg bg-gala-gold/15 hover:bg-gala-gold text-gala-champagne hover:text-gala-obsidian border border-gala-gold/35 text-xs font-medium flex items-center gap-1 transition"
                      >
                        <Download className="w-3 h-3" /> Descargar
                      </a>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setTakedownTarget(item);
                        setTakedownReason('');
                      }}
                      className="px-2 py-1.5 rounded-lg text-gala-muted hover:text-red-300 text-[11px] flex items-center gap-1"
                      title="Solicitar retiro por privacidad"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" /> Retirar
                    </button>
                  </div>
                </motion.article>
              );
            })}
          </div>

          {/* Barra de Paginación */}
          <PaginationBar
            currentPage={safePage}
            totalItems={filteredMemories.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            itemLabel="recuerdos del video"
          />
        </div>
      )}

      {/* MIS RECUERDOS ENVIADOS EN REVISION */}
      {currentUser && myPreEventUploads.some((i) => i.estado === 'PENDIENTE') && (
        <div className="p-4 rounded-2xl glass space-y-2">
          <div className="text-xs font-medium text-gala-champagne flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-gala-gold" />
            <span>
              Tienes{' '}
              {myPreEventUploads.filter((i) => i.estado === 'PENDIENTE').length}{' '}
              recuerdo(s) en revisión por las organizadoras para aparecer en esta galería.
            </span>
          </div>
        </div>
      )}

      {/* MODAL 1 (PORTAL): PRESENTADOR DEL VIDEO CONMEMORATIVO EN PANTALLA GRANDE */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {presentationOpen && videoMemories.length > 0 && currentSlideItem && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[120] h-[100dvh] w-screen bg-gala-obsidian text-gala-ivory flex flex-col justify-between overflow-hidden select-none"
              >
                {/* Cielo Noche Estrellada de fondo */}
                <StageBackground />

                {/* Marco ornamental estelar */}
                <div className="pointer-events-none fixed inset-2 sm:inset-4 border border-gala-silver/25 rounded-2xl z-10" />

                {/* Barra Superior con Progreso de Escena y Botón Cerrar */}
                <div className="relative z-20 px-4 sm:px-8 pt-4 sm:pt-6 pb-2 space-y-2.5 bg-gradient-to-b from-gala-obsidian/95 via-gala-obsidian/70 to-transparent">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="px-3 py-1 rounded-full bg-gala-surface/90 border border-gala-gold/50 text-[11px] sm:text-xs font-mono text-gala-champagne flex items-center gap-1.5 shrink-0">
                        <Sparkles className="w-3.5 h-3.5 text-gala-gold" />
                        <span>
                          ESCENA {String(activeSlide + 1).padStart(2, '0')} DE{' '}
                          {String(videoMemories.length).padStart(2, '0')}
                        </span>
                      </span>
                      <span className="px-2.5 py-1 rounded-full bg-gala-velvet/90 border border-gala-silver/30 text-[10px] sm:text-xs font-mono uppercase text-gala-silver truncate">
                        {currentSlideItem.etapa}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setPresentationOpen(false)}
                      className="px-3.5 py-2 rounded-xl bg-gala-surface hover:bg-gala-card border border-gala-silver/40 text-xs font-semibold text-gala-ivory flex items-center gap-1.5 shrink-0 shadow-lg"
                    >
                      <X className="w-4 h-4 text-gala-gold" />
                      <span>Cerrar</span>
                    </button>
                  </div>

                  {/* Barra de tiempo de cada escena en plata y oro */}
                  <div className="w-full h-1.5 rounded-full bg-gala-surface/80 overflow-hidden border border-gala-silver/20">
                    <div
                      className="h-full bg-gradient-to-r from-gala-silver via-gala-gold to-gala-champagne transition-all duration-100 ease-linear"
                      style={{
                        width: `${currentSlideIsVideo ? 100 : slideProgressPct}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Escenario Central Flexible (Nunca empuja los botones fuera de la pantalla) */}
                <div className="relative z-20 flex-1 min-h-0 px-4 sm:px-8 py-2 flex items-center justify-center overflow-hidden">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentSlideItem.id}
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1.03 }}
                      exit={{ opacity: 0 }}
                      transition={{
                        opacity: { duration: 0.5 },
                        scale: {
                          duration: currentSlideDurationSec,
                          ease: 'easeOut',
                        },
                      }}
                      className="w-full h-full flex items-center justify-center"
                    >
                      {currentSlideItem.tipo_medio === 'VIDEO' ? (
                        <video
                          src={currentSlideItem.archivo_url}
                          autoPlay
                          controls
                          onEnded={() => {
                            setActiveSlide((prev) => (prev + 1) % videoMemories.length);
                          }}
                          className="max-h-full max-w-full object-contain rounded-2xl border border-gala-silver/35 shadow-[0_0_50px_rgba(4,8,24,0.95)]"
                        />
                      ) : (
                        <img
                          src={currentSlideItem.archivo_url}
                          alt={currentSlideItem.pie_de_foto}
                          className="max-h-full max-w-full object-contain rounded-2xl border border-gala-silver/35 shadow-[0_0_50px_rgba(4,8,24,0.95)]"
                        />
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Tarjeta Inferior y Controles de Reproducción Siempre Visibles */}
                <div className="relative z-20 px-4 sm:px-8 pb-4 sm:pb-6 pt-2 bg-gradient-to-t from-gala-obsidian via-gala-obsidian/95 to-transparent">
                  <div className="max-w-3xl mx-auto w-full space-y-3">
                    <div className="p-3.5 sm:p-4 rounded-2xl glass text-center">
                      <p className="font-serif italic text-base sm:text-2xl text-gala-ivory line-clamp-2">
                        "{currentSlideItem.pie_de_foto}"
                      </p>
                      <p className="text-[11px] sm:text-xs text-gala-gold mt-1 truncate">
                        {currentSlideItem.autor_nombre}
                        {currentSlideItem.autor_distintivo
                          ? ` · ${currentSlideItem.autor_distintivo}`
                          : ''}
                      </p>
                    </div>

                    {/* Botones de control: Anterior, Pausar/Reproducir, Siguiente y Reiniciar */}
                    <div className="flex items-center justify-center gap-2 sm:gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setSlideProgressPct(0);
                          setActiveSlide((prev) =>
                            prev === 0 ? videoMemories.length - 1 : prev - 1
                          );
                        }}
                        className="px-3.5 sm:px-4 py-2.5 rounded-xl btn-silver text-xs font-semibold text-gala-ivory flex items-center gap-1.5"
                      >
                        <SkipBack className="w-4 h-4 text-gala-gold" />
                        <span>Anterior</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsPlayingVideo((p) => !p)}
                        className="px-5 sm:px-6 py-2.5 rounded-xl btn-gold text-gala-obsidian font-semibold text-xs flex items-center gap-2 shadow-lg"
                      >
                        {isPlayingVideo ? (
                          <>
                            <Pause className="w-4 h-4 fill-current" />
                            <span>Pausar</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 fill-current" />
                            <span>Reproducir</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSlideProgressPct(0);
                          setActiveSlide(
                            (prev) => (prev + 1) % videoMemories.length
                          );
                        }}
                        className="px-3.5 sm:px-4 py-2.5 rounded-xl btn-silver text-xs font-semibold text-gala-ivory flex items-center gap-1.5"
                      >
                        <span>Siguiente</span>
                        <SkipForward className="w-4 h-4 text-gala-gold" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveSlide(0);
                          setSlideProgressPct(0);
                          setIsPlayingVideo(true);
                        }}
                        title="Reiniciar desde la primera escena"
                        className="p-2.5 rounded-xl bg-gala-surface/90 hover:bg-gala-card border border-gala-silver/30 text-gala-silver"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}

      {/* MODAL 2 (PORTAL): VISOR INDIVIDUAL UNA POR UNA */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {selectedViewerIndex !== null &&
              filteredMemories[selectedViewerIndex] && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[120] h-[100dvh] w-screen bg-gala-obsidian/95 backdrop-blur-xl flex flex-col justify-between p-4 sm:p-8 overflow-hidden"
                >
                  <StageBackground />
                  <div className="relative z-20 flex items-center justify-between gap-2">
                    <span className="px-3 py-1 rounded-full bg-gala-surface border border-gala-silver/30 text-xs font-mono text-gala-champagne">
                      Memoria {selectedViewerIndex + 1} de {filteredMemories.length} ·{' '}
                      {filteredMemories[selectedViewerIndex].etapa}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedViewerIndex(null)}
                      className="px-3.5 py-2 rounded-xl bg-gala-surface border border-gala-silver/35 text-xs font-semibold text-gala-ivory flex items-center gap-1.5"
                    >
                      <X className="w-4 h-4 text-gala-gold" /> Cerrar
                    </button>
                  </div>

                  <div className="relative z-20 flex-1 min-h-0 flex items-center justify-center my-3 overflow-hidden">
                    <img
                      src={filteredMemories[selectedViewerIndex].archivo_url}
                      alt={filteredMemories[selectedViewerIndex].pie_de_foto}
                      className="max-h-full max-w-full object-contain rounded-2xl border border-gala-silver/35 shadow-2xl"
                    />
                  </div>

                  <div className="relative z-20 max-w-2xl mx-auto w-full text-center space-y-3">
                    <div className="p-3.5 rounded-2xl glass">
                      <p className="font-serif italic text-lg sm:text-xl text-gala-ivory">
                        "{filteredMemories[selectedViewerIndex].pie_de_foto}"
                      </p>
                      <p className="text-xs text-gala-gold mt-1">
                        Subida por: {filteredMemories[selectedViewerIndex].autor_nombre}
                      </p>
                    </div>
                    <div className="flex items-center justify-center gap-2.5">
                      <button
                        type="button"
                        disabled={selectedViewerIndex === 0}
                        onClick={() =>
                          setSelectedViewerIndex((i) => Math.max(0, (i || 0) - 1))
                        }
                        className="px-3.5 py-2.5 rounded-xl btn-silver text-xs font-semibold text-gala-ivory disabled:opacity-35 flex items-center gap-1"
                      >
                        <SkipBack className="w-3.5 h-3.5 text-gala-gold" /> Anterior
                      </button>
                      <a
                        href={filteredMemories[selectedViewerIndex].archivo_url}
                        download
                        className="px-4 py-2.5 rounded-xl btn-gold text-gala-obsidian font-semibold text-xs flex items-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" /> Descargar
                      </a>
                      <button
                        type="button"
                        disabled={
                          selectedViewerIndex === filteredMemories.length - 1
                        }
                        onClick={() =>
                          setSelectedViewerIndex((i) =>
                            Math.min(filteredMemories.length - 1, (i || 0) + 1)
                          )
                        }
                        className="px-3.5 py-2.5 rounded-xl btn-silver text-xs font-semibold text-gala-ivory disabled:opacity-35 flex items-center gap-1"
                      >
                        Siguiente <SkipForward className="w-3.5 h-3.5 text-gala-gold" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
          </AnimatePresence>,
          document.body
        )}

      {/* MODAL 3 (PORTAL): SOLICITAR RETIRO POR PRIVACIDAD */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {takedownTarget && (
              <div className="fixed inset-0 z-[120] bg-gala-obsidian/85 backdrop-blur-md flex items-center justify-center p-4">
                <motion.form
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  onSubmit={handleRequestTakedown}
                  className="w-full max-w-md glass rounded-2xl p-6 space-y-4"
                >
                  <h3 className="font-serif text-2xl text-gala-ivory">
                    Solicitar Retiro de Fotografía
                  </h3>
                  <p className="text-xs text-gala-parchment/85">
                    La fotografía se ocultará inmediatamente de la galería pública para proteger tu privacidad.
                  </p>
                  <textarea
                    rows={3}
                    required
                    value={takedownReason}
                    onChange={(e) => setTakedownReason(e.target.value)}
                    placeholder="Indica brevemente el motivo..."
                    className="w-full p-3 rounded-xl bg-gala-obsidian border border-gala-silver/30 text-xs text-gala-ivory"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setTakedownTarget(null)}
                      className="px-4 py-2 rounded-xl bg-gala-surface text-xs text-gala-muted"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-semibold"
                    >
                      Ocultar Ahora
                    </button>
                  </div>
                </motion.form>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
};
