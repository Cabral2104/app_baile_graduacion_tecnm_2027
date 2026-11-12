import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera,
  Play,
  Pause,
  Upload,
  SkipBack,
  SkipForward,
  Download,
  LayoutGrid,
  Eye,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Tv,
  Clock,
  Sparkles,
  Search,
  X,
  RotateCcw,
  Users,
  Heart,
} from 'lucide-react';
import { MediaItem, SystemConfig, User } from '../types';
import { api } from '../services/api';
import {
  compressImageClientSide,
  getVideoDurationSeconds,
  formatBytes,
} from '../utils/imageCompression';
import { PaginationBar } from './PaginationBar';

interface PartyDaySectionProps {
  items: MediaItem[];
  config: SystemConfig | null;
  currentUser: User | null;
  onRequireAuth: () => void;
  onOpenFullCarousel: () => void;
  onRefresh: () => void;
}

export const PartyDaySection: React.FC<PartyDaySectionProps> = ({
  items,
  config,
  currentUser,
  onRequireAuth,
  onOpenFullCarousel,
  onRefresh,
}) => {
  // En Día de la Fiesta se muestran las fotos de la fiesta en orden cronológico: de la más antigua (primera) a la más reciente
  const partyPhotos = items
    .filter((i) => i.estado === 'APROBADO_GALERIA')
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

  // Estados para búsqueda por alumno y filtro por mesa
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMesa, setSelectedMesa] = useState<'TODAS' | string>('TODAS');

  // Modo de vista dentro de "Día de la Fiesta": 'ONE_BY_ONE' (Una por una) o 'GRID' (Todas paginadas)
  const [viewMode, setViewMode] = useState<'ONE_BY_ONE' | 'GRID'>('ONE_BY_ONE');
  const [currentPhotoIdx, setCurrentPhotoIdx] = useState(0);
  const [autoPlayInline, setAutoPlayInline] = useState(false);

  // Paginación para la vista en cuadrícula
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  // Estado del formulario para subir foto de la fiesta en ese momento
  const [showUploadBox, setShowUploadBox] = useState(false);
  const [pieDeFoto, setPieDeFoto] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [bannerMsg, setBannerMsg] = useState<string | null>(null);
  const [myLiveUploads, setMyLiveUploads] = useState<MediaItem[]>([]);

  // Estados para reacciones táctiles en tiempo real, ráfagas y control anti-spam de 1 reacción por persona
  const [localReactions, setLocalReactions] = useState<
    Record<string, { corazon: number; estrella: number }>
  >({});
  const [myReactions, setMyReactions] = useState<
    Record<string, 'CORAZON' | 'ESTRELLA' | null>
  >({});
  const [bursts, setBursts] = useState<
    Array<{ id: string; mediaId: string; tipo: 'CORAZON' | 'ESTRELLA' }>
  >([]);

  // Sincronizar mis reacciones cuando cargan las fotos públicas desde el backend
  useEffect(() => {
    const map: Record<string, 'CORAZON' | 'ESTRELLA' | null> = {};
    partyPhotos.forEach((p) => {
      if (p.mi_reaccion) {
        map[p.id] = p.mi_reaccion;
      }
    });
    if (Object.keys(map).length > 0) {
      setMyReactions((prev) => ({ ...map, ...prev }));
    }
  }, [partyPhotos]);

  const handleReact = async (mediaId: string, tipo: 'CORAZON' | 'ESTRELLA') => {
    const targetItem = partyPhotos.find((i) => i.id === mediaId);
    const currentReaction = myReactions[mediaId] ?? targetItem?.mi_reaccion ?? null;

    // Si el usuario vuelve a presionar la misma reacción -> se quita (Toggle off)
    const isTogglingOff = currentReaction === tipo;
    const nextReaction: 'CORAZON' | 'ESTRELLA' | null = isTogglingOff ? null : tipo;

    // Vibración háptica solo cuando se activa una reacción (no al quitarla)
    if (!isTogglingOff && typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(20);
      } catch {}
    }

    // Disparar ráfaga visual flotante solo al agregar o cambiar
    if (!isTogglingOff) {
      const burstId = `burst-${Date.now()}-${Math.random()}`;
      setBursts((prev) => [...prev, { id: burstId, mediaId, tipo }]);
      setTimeout(() => {
        setBursts((prev) => prev.filter((b) => b.id !== burstId));
      }, 900);
    }

    // Actualización optimista de la reacción personal (máximo 1 reacción por persona)
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
        // Intercambió de una a otra (solo 1 permitida en total)
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

  const getReactionCounts = (item: MediaItem) => {
    const local = localReactions[item.id];
    return {
      corazon: local?.corazon ?? item.reacciones_corazon ?? 0,
      estrella: local?.estrella ?? item.reacciones_estrella ?? 0,
    };
  };

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Normalización de texto sin acentos ni mayúsculas para búsquedas fluidas
  const normalizeSearch = (text: string) =>
    (text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

  // Lista única y ordenada de mesas presentes en las fotos de la fiesta con su conteo
  const availableMesas = useMemo(() => {
    const mesaMap = new Map<string, number>();
    partyPhotos.forEach((item) => {
      const mesa = item.autor_mesa?.trim();
      if (mesa) {
        mesaMap.set(mesa, (mesaMap.get(mesa) || 0) + 1);
      }
    });
    return Array.from(mesaMap.entries()).sort(([a], [b]) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );
  }, [partyPhotos]);

  // Filtrado reactivo por término (alumno, mesa, distintivo, pie de foto) y por mesa seleccionada
  const filteredPartyPhotos = useMemo(() => {
    const term = normalizeSearch(searchQuery);
    return partyPhotos.filter((item) => {
      // Filtro por mesa seleccionada
      if (selectedMesa !== 'TODAS') {
        const itemMesa = (item.autor_mesa || '').trim().toLowerCase();
        const targetMesa = selectedMesa.trim().toLowerCase();
        if (itemMesa !== targetMesa) {
          return false;
        }
      }

      // Filtro por búsqueda de texto
      if (term) {
        const nameMatch = normalizeSearch(item.autor_nombre || '').includes(term);
        const mesaMatch = normalizeSearch(item.autor_mesa || '').includes(term);
        const badgeMatch = normalizeSearch(item.autor_distintivo || '').includes(term);
        const captionMatch = normalizeSearch(item.pie_de_foto || '').includes(term);
        if (!nameMatch && !mesaMatch && !badgeMatch && !captionMatch) {
          return false;
        }
      }

      return true;
    });
  }, [partyPhotos, searchQuery, selectedMesa]);

  // Handlers para búsqueda y cambio de mesa
  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setCurrentPage(1);
    setCurrentPhotoIdx(0);
  };

  const handleMesaChange = (mesa: string) => {
    setSelectedMesa(mesa);
    setCurrentPage(1);
    setCurrentPhotoIdx(0);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedMesa('TODAS');
    setCurrentPage(1);
    setCurrentPhotoIdx(0);
  };

  // Mantener el índice dentro de los límites si el total de fotos filtradas cambia
  useEffect(() => {
    if (currentPhotoIdx >= filteredPartyPhotos.length) {
      setCurrentPhotoIdx(Math.max(0, filteredPartyPhotos.length - 1));
    }
  }, [filteredPartyPhotos.length, currentPhotoIdx]);

  const totalPages = Math.max(1, Math.ceil(filteredPartyPhotos.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedPartyPhotos = filteredPartyPhotos.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  const loadMyLiveUploads = () => {
    if (!currentUser) return;
    api
      .getMyUploads()
      .then((res) =>
        setMyLiveUploads(res.items.filter((i) => i.origen === 'EN_VIVO'))
      )
      .catch(() => { });
  };

  useEffect(() => {
    loadMyLiveUploads();
  }, [currentUser?.id]);

  // Si está activado "Pasar Fotos Automáticamente" aquí mismo, avanza cada 4.5 segundos
  useEffect(() => {
    if (!autoPlayInline || filteredPartyPhotos.length === 0) return;
    const timer = setTimeout(() => {
      setCurrentPhotoIdx((prev) => (prev + 1) % filteredPartyPhotos.length);
    }, 4500);
    return () => clearTimeout(timer);
  }, [autoPlayInline, currentPhotoIdx, filteredPartyPhotos.length]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;
    setUploadError(null);

    if (rawFile.size > 50 * 1024 * 1024) {
      setUploadError('El archivo supera el límite de 50 MB.');
      return;
    }

    const fileIsVideo =
      rawFile.type.startsWith('video/') || /\.(mp4|mov|webm)$/i.test(rawFile.name);

    try {
      if (fileIsVideo) {
        const duration = await getVideoDurationSeconds(rawFile).catch(() => 15);
        if (duration > 45) {
          setUploadError('El video no debe durar más de 45 segundos.');
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
      setUploadError('No se pudo procesar la foto o video.');
    }
  };

  const handleUploadPartyPhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    if (!selectedFile || !pieDeFoto.trim()) {
      setUploadError('Elige tu foto/video y escribe un mensaje breve desde tu mesa.');
      return;
    }

    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append('archivo', selectedFile);
      formData.append('origen', 'EN_VIVO');
      formData.append('etapa', 'GALA');
      formData.append('pie_de_foto', pieDeFoto.trim());
      if (videoDuration) formData.append('duracion_seg', String(videoDuration));

      await api.uploadMedia(formData);
      setPieDeFoto('');
      setSelectedFile(null);
      setPreviewUrl(null);
      setShowUploadBox(false);
      const isAutoMod = Boolean(config?.moderacion_automatica_qr);
      setBannerMsg(
        isAutoMod
          ? '¡Foto publicada al instante! Ya está disponible en el carrusel y en la pantalla gigante.'
          : 'Foto enviada desde tu mesa. En cuanto las organizadoras la aprueben aparecerá aquí y en el carrusel.'
      );
      loadMyLiveUploads();
      onRefresh();
      setTimeout(() => setBannerMsg(null), 5000);
    } catch (err: any) {
      setUploadError(err.message || 'Error al subir la foto.');
    } finally {
      setUploading(false);
    }
  };

  const handleQuickDiscard = async (mediaId: string) => {
    try {
      await api.moderateMedia(mediaId, 'RECHAZADO', false);
      setBannerMsg('La fotografía fue retirada de la pantalla gigante.');
      onRefresh();
      setTimeout(() => setBannerMsg(null), 4000);
    } catch {
      setBannerMsg('No se pudo retirar la fotografía.');
    }
  };

  const currentPhoto =
    filteredPartyPhotos[currentPhotoIdx] || filteredPartyPhotos[0] || null;

  // Regla de negocio por fase:
  // - Antes de la Fiesta (PRE_EVENTO): subidas cerradas en Día de la Fiesta (solo abiertas en Modo Memoria).
  // - Día de la Fiesta (EN_VIVO): subidas abiertas en Día de la Fiesta.
  // - Fiesta Terminada (MEMORIA): subidas cerradas para invitados; habilitadas únicamente para rol ADMIN.
  const faseActual = config?.fase_actual || 'PRE_EVENTO';
  const isAdmin = currentUser?.rol === 'ADMIN';
  const canUploadParty =
    (faseActual === 'EN_VIVO' && config?.subidas_abiertas !== false) ||
    (faseActual === 'MEMORIA' && isAdmin);

  useEffect(() => {
    if (!canUploadParty && showUploadBox) {
      setShowUploadBox(false);
    }
  }, [canUploadParty, showUploadBox]);

  return (
    <div className="space-y-6">
      {bannerMsg && (
        <div className="p-4 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-xs sm:text-sm text-emerald-200 flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{bannerMsg}</span>
        </div>
      )}

      {/* CABECERA PRINCIPAL DE "DIA DE LA FIESTA" */}
      <div className="p-6 sm:p-8 rounded-2xl glass shadow-xl space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <span className="text-[11px] uppercase tracking-[0.25em] text-gala-gold font-semibold inline-flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-gala-silver" />
              Apartado 2 · El inicio de nuestra historia · En Vivo
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl text-gala-ivory">
              Día de la Fiesta · Fotos en Momento Real
            </h2>
            <p className="text-xs sm:text-sm text-gala-parchment/90 max-w-2xl leading-relaxed">
              Mira una por una las fotos que los invitados están subiendo esta noche desde sus mesas, reproduce el carrusel en pantalla gigante para el salón o sube tu propia foto al instante.
            </p>
          </div>

          {/* Botones Principales: Reproducir Carrusel Proyector y Subir Foto de la Fiesta */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onOpenFullCarousel}
              className="px-5 py-3.5 rounded-xl btn-gold text-gala-obsidian font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition"
            >
              <Tv className="w-4 h-4" />
              <span>Reproducir Carrusel (Pantalla Salón)</span>
            </button>

            {canUploadParty ? (
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
                    ? 'Cerrar Cámara'
                    : faseActual === 'MEMORIA' && isAdmin
                      ? 'Subir Foto de la Fiesta (Admin)'
                      : 'Subir Foto de la Fiesta'}
                </span>
              </button>
            ) : (
              <div className="px-4 py-3 rounded-xl bg-gala-obsidian/85 border border-gala-silver/25 text-xs text-gala-silver flex items-center justify-center gap-2">
                <Clock className="w-4 h-4 text-gala-gold shrink-0" />
                <span>
                  {faseActual === 'PRE_EVENTO'
                    ? 'Subidas cerradas aquí · Fase activa: Antes de la Fiesta (Solo Memorias)'
                    : 'Fiesta Terminada · Subidas solo para Organizadoras'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* FORMULARIO RAPIDO PARA SUBIR FOTO DESDE LA MESA EN LA FIESTA */}
        <AnimatePresence>
          {showUploadBox && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              onSubmit={handleUploadPartyPhoto}
              className="pt-5 border-t border-gala-silver/20 space-y-4 overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-serif text-xl text-gala-ivory">
                  Subir Foto o Video Corto desde tu Mesa
                </h3>
                <button
                  type="button"
                  onClick={() => setShowUploadBox(false)}
                  className="text-xs text-gala-muted hover:text-gala-ivory"
                >
                  Cancelar
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/mp4,video/quicktime,video/webm"
                onChange={handleFileChange}
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
                    Toca aquí para tomar una foto o elegirla de tu celular
                  </span>
                  <span className="text-xs text-gala-muted">
                    Aparecerá con tu nombre y tu mesa ({currentUser?.mesa || 'Invitado'})
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
                        {formatBytes(selectedFile.size)}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      setPreviewUrl(null);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-red-950/60 text-xs text-red-200 border border-red-500/30 flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Quitar
                  </button>
                </div>
              )}

              <div>
                <label className="block text-xs uppercase tracking-wider text-gala-gold mb-2">
                  Mensaje o Saludo para la Fiesta
                </label>
                <input
                  type="text"
                  maxLength={140}
                  required
                  value={pieDeFoto}
                  onChange={(e) => setPieDeFoto(e.target.value)}
                  placeholder="Ej. Salud desde la Mesa 4 celebrando bajo las estrellas..."
                  className="w-full px-4 py-3 rounded-xl bg-gala-obsidian border border-gala-silver/30 text-sm text-gala-ivory"
                />
              </div>

              {/* Aviso disuasorio de no-anonimato */}
              <div className="p-3.5 rounded-xl bg-gala-obsidian/95 border border-gala-gold/30 text-xs text-gala-silver space-y-1">
                <div className="font-semibold text-gala-champagne flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-gala-gold" />
                  <span>Proyección con Identidad Verificada</span>
                </div>
                <p className="leading-relaxed">
                  Tu foto se proyectará en la pantalla gigante del salón identificada con tu nombre (
                  <strong className="text-gala-ivory">{currentUser?.nombre_completo}</strong>) y tu mesa (
                  <strong className="text-gala-champagne">{currentUser?.mesa || 'Invitado'}</strong>). Por favor cuida el respeto hacia tus compañeros y el evento.
                </p>
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
                {uploading ? 'Subiendo foto...' : 'Publicar en el Día de la Fiesta'}
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>

      {/* BARRA DE BÚSQUEDA Y FILTRO POR ALUMNO Y MESA */}
      <div className="glass rounded-2xl p-4 sm:p-5 space-y-3.5 border border-gala-silver/20 shadow-lg">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Campo de búsqueda de texto: busca por alumno, mesa, distintivo o mensaje */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gala-gold absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Buscar por alumno, mesa o dedicatoria..."
              className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-gala-obsidian/90 border border-gala-silver/30 text-xs sm:text-sm text-gala-ivory placeholder-gala-muted focus:border-gala-gold focus:outline-none transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => handleSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gala-muted hover:text-gala-ivory transition"
                title="Limpiar búsqueda"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filtro por mesa: botón rápido "Mi Mesa" y selector con conteo */}
          <div className="flex flex-wrap items-center gap-2">
            {currentUser?.mesa && (
              <button
                type="button"
                onClick={() =>
                  handleMesaChange(
                    selectedMesa === currentUser.mesa ? 'TODAS' : currentUser.mesa!
                  )
                }
                className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition shrink-0 ${
                  selectedMesa === currentUser.mesa
                    ? 'btn-gold text-gala-obsidian shadow'
                    : 'bg-gala-obsidian/80 text-gala-champagne border-gala-gold/40 hover:border-gala-gold'
                }`}
                title="Ver fotos tomadas en mi mesa"
              >
                <Sparkles className="w-3.5 h-3.5 text-gala-gold" />
                <span>Mi Mesa ({currentUser.mesa})</span>
              </button>
            )}

            <div className="relative shrink-0">
              <select
                value={selectedMesa}
                onChange={(e) => handleMesaChange(e.target.value)}
                className="appearance-none pl-8 pr-8 py-2.5 rounded-xl bg-gala-obsidian/90 border border-gala-silver/30 text-xs text-gala-ivory font-medium focus:border-gala-gold focus:outline-none cursor-pointer transition"
              >
                <option value="TODAS">Todas las mesas ({partyPhotos.length})</option>
                {availableMesas.map(([mesa, count]) => (
                  <option key={mesa} value={mesa}>
                    {mesa} ({count} {count === 1 ? 'foto' : 'fotos'})
                  </option>
                ))}
              </select>
              <Users className="w-3.5 h-3.5 text-gala-gold absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Resumen de filtros aplicados y botón para restablecer */}
        {(searchQuery.trim() !== '' || selectedMesa !== 'TODAS') && (
          <div className="pt-2 border-t border-gala-silver/15 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-2 text-gala-silver">
              <span>
                Mostrando <strong className="text-gala-champagne">{filteredPartyPhotos.length}</strong> de {partyPhotos.length} fotos
              </span>
              {selectedMesa !== 'TODAS' && (
                <span className="px-2 py-0.5 rounded-md bg-gala-velvet border border-gala-silver/30 text-gala-champagne text-[11px] font-mono">
                  Mesa: {selectedMesa}
                </span>
              )}
              {searchQuery.trim() !== '' && (
                <span className="px-2 py-0.5 rounded-md bg-gala-velvet border border-gala-silver/30 text-gala-champagne text-[11px]">
                  "{searchQuery}"
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleClearFilters}
              className="px-2.5 py-1 rounded-lg bg-gala-obsidian/80 hover:bg-gala-velvet border border-gala-silver/30 text-gala-gold hover:text-gala-ivory text-[11px] font-medium flex items-center gap-1 transition"
            >
              <RotateCcw className="w-3 h-3" /> Restablecer filtros
            </button>
          </div>
        )}
      </div>

      {/* BARRA DE MODO DE VISTA: VER UNA POR UNA O VER CUADRICULA PAGINADA */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl bg-gala-velvet p-1 border border-gala-silver/25">
          <button
            type="button"
            onClick={() => setViewMode('ONE_BY_ONE')}
            className={`px-4 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition ${
              viewMode === 'ONE_BY_ONE'
                ? 'btn-gold text-gala-obsidian font-semibold'
                : 'text-gala-silver hover:text-gala-ivory'
            }`}
          >
            <Eye className="w-3.5 h-3.5" /> Ver Fotos Una por Una ({filteredPartyPhotos.length})
          </button>
          <button
            type="button"
            onClick={() => setViewMode('GRID')}
            className={`px-4 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition ${
              viewMode === 'GRID'
                ? 'btn-gold text-gala-obsidian font-semibold'
                : 'text-gala-silver hover:text-gala-ivory'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" /> Ver Todas las Fotos
          </button>
        </div>

        {viewMode === 'ONE_BY_ONE' && filteredPartyPhotos.length > 1 && (
          <button
            type="button"
            onClick={() => setAutoPlayInline((prev) => !prev)}
            className={`px-4 py-2 rounded-xl text-xs font-medium border flex items-center gap-2 transition ${
              autoPlayInline
                ? 'bg-gala-gold/20 border-gala-gold text-gala-champagne'
                : 'btn-silver text-gala-silver'
            }`}
          >
            {autoPlayInline ? (
              <>
                <Pause className="w-3.5 h-3.5 text-gala-gold" />
                <span>Pausar Avance Automático</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-gala-gold" />
                <span>Pasar Fotos Automáticamente</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* CONTENIDO PRINCIPAL: VISOR UNA POR UNA O CUADRICULA PAGINADA */}
      {partyPhotos.length === 0 ? (
        <div className="py-16 text-center glass rounded-2xl space-y-3">
          <Camera className="w-8 h-8 text-gala-gold mx-auto" />
          <p className="text-base font-serif text-gala-ivory">
            Aún no hay fotos publicadas del Día de la Fiesta
          </p>
          <p className="text-xs text-gala-muted">
            Usa el botón "Subir Foto de la Fiesta" de arriba para inaugurar la noche.
          </p>
        </div>
      ) : filteredPartyPhotos.length === 0 ? (
        <div className="py-16 text-center glass rounded-2xl space-y-4">
          <Search className="w-9 h-9 text-gala-gold/70 mx-auto" />
          <div className="space-y-1">
            <p className="text-lg font-serif text-gala-ivory">
              No se encontraron fotos con los filtros seleccionados
            </p>
            <p className="text-xs text-gala-parchment/80 max-w-md mx-auto">
              No hay coincidencias para "{searchQuery}"{' '}
              {selectedMesa !== 'TODAS' ? `en ${selectedMesa}` : ''}. Prueba
              buscando con otro nombre o selecciona otra mesa.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClearFilters}
            className="px-4 py-2.5 rounded-xl btn-silver text-xs text-gala-champagne inline-flex items-center gap-2 transition"
          >
            <RotateCcw className="w-3.5 h-3.5 text-gala-gold" />
            <span>Restablecer y ver todas las fotos ({partyPhotos.length})</span>
          </button>
        </div>
      ) : viewMode === 'ONE_BY_ONE' && currentPhoto ? (
        /* VISTA 1: VER LAS FOTOS DE LA FIESTA UNA POR UNA CON CONTROLES GRANDES */
        <div className="glass rounded-2xl p-4 sm:p-6 space-y-5 shadow-2xl">
          <div className="flex items-center justify-between text-xs text-gala-silver">
            <span className="font-mono px-3 py-1 rounded-full bg-gala-obsidian border border-gala-silver/30 text-gala-champagne">
              Foto {currentPhotoIdx + 1} de {filteredPartyPhotos.length}
            </span>
            <span className="text-gala-gold font-medium">
              {currentPhoto.autor_mesa || 'En Vivo desde el Salón'}
            </span>
          </div>

          {/* Imagen o Video Central */}
          <div className="relative aspect-video bg-gala-obsidian rounded-xl overflow-hidden border border-gala-silver/25 flex items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentPhoto.id}
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                transition={{ duration: 0.35 }}
                className="w-full h-full flex items-center justify-center"
              >
                {currentPhoto.tipo_medio === 'VIDEO' ? (
                  <video
                    src={currentPhoto.archivo_url}
                    controls
                    autoPlay
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <img
                    src={currentPhoto.archivo_url}
                    alt={currentPhoto.pie_de_foto}
                    className="w-full h-full object-contain"
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Mensaje, Autor y Botones Grandes para Pasar Una por Una */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-2 border-t border-gala-silver/15">
            <div className="space-y-2.5">
              <div>
                <p className="font-serif italic text-xl sm:text-2xl text-gala-ivory">
                  "{currentPhoto.pie_de_foto}"
                </p>
                <p className="text-xs text-gala-gold mt-1">
                  Subida por: <strong>{currentPhoto.autor_nombre}</strong> ·{' '}
                  {currentPhoto.autor_mesa || currentPhoto.autor_distintivo}
                </p>
              </div>

              {/* Botones de Reacción en Vivo para Alumnos e Invitados (Límite: 1 reacción por persona) */}
              {(() => {
                const myReaction = myReactions[currentPhoto.id] ?? currentPhoto.mi_reaccion ?? null;
                const isHeartActive = myReaction === 'CORAZON';
                const isStarActive = myReaction === 'ESTRELLA';
                const counts = getReactionCounts(currentPhoto);

                return (
                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => handleReact(currentPhoto.id, 'CORAZON')}
                      className={`relative px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition active:scale-95 shadow group ${
                        isHeartActive
                          ? 'bg-rose-900/60 border-2 border-rose-400 text-rose-100 ring-2 ring-rose-500/40 shadow-[0_0_15px_rgba(244,63,94,0.45)]'
                          : 'bg-rose-950/40 hover:bg-rose-950/70 border border-rose-500/40 text-rose-300'
                      }`}
                      title={
                        isHeartActive
                          ? 'Tu reacción activa · Toca de nuevo para quitar'
                          : 'Dar corazón (máximo 1 reacción por persona)'
                      }
                    >
                      <Heart
                        className={`w-4 h-4 transition ${
                          isHeartActive
                            ? 'text-rose-400 fill-rose-400 scale-110 drop-shadow'
                            : 'text-rose-400 fill-rose-400/80 group-hover:scale-125'
                        }`}
                      />
                      <span className="font-mono">{counts.corazon}</span>
                      <span className="hidden sm:inline text-[11px] font-normal">
                        {isHeartActive ? 'Te encanta' : 'Me encanta'}
                      </span>

                      {/* Ráfaga animada al hacer clic */}
                      <AnimatePresence>
                        {bursts
                          .filter((b) => b.mediaId === currentPhoto.id && b.tipo === 'CORAZON')
                          .map((b) => (
                            <motion.div
                              key={b.id}
                              initial={{ opacity: 1, y: 0, scale: 0.8 }}
                              animate={{ opacity: 0, y: -40, scale: 1.4 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.8, ease: 'easeOut' }}
                              className="absolute -top-1 left-1/2 -translate-x-1/2 pointer-events-none"
                            >
                              <Heart className="w-5 h-5 text-rose-400 fill-rose-400" />
                            </motion.div>
                          ))}
                      </AnimatePresence>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleReact(currentPhoto.id, 'ESTRELLA')}
                      className={`relative px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition active:scale-95 shadow group ${
                        isStarActive
                          ? 'bg-amber-900/60 border-2 border-gala-gold text-gala-champagne ring-2 ring-gala-gold/40 shadow-[0_0_15px_rgba(212,175,55,0.45)]'
                          : 'bg-amber-950/40 hover:bg-amber-950/70 border border-gala-gold/40 text-gala-champagne'
                      }`}
                      title={
                        isStarActive
                          ? 'Tu reacción activa · Toca de nuevo para quitar'
                          : 'Dar estrella estelar (máximo 1 reacción por persona)'
                      }
                    >
                      <Sparkles
                        className={`w-4 h-4 transition ${
                          isStarActive
                            ? 'text-gala-gold fill-gala-gold scale-110 drop-shadow'
                            : 'text-gala-gold group-hover:scale-125'
                        }`}
                      />
                      <span className="font-mono">{counts.estrella}</span>
                      <span className="hidden sm:inline text-[11px] font-normal">
                        {isStarActive ? 'Estelar (Activa)' : 'Estelar'}
                      </span>

                      {/* Ráfaga animada al hacer clic */}
                      <AnimatePresence>
                        {bursts
                          .filter((b) => b.mediaId === currentPhoto.id && b.tipo === 'ESTRELLA')
                          .map((b) => (
                            <motion.div
                              key={b.id}
                              initial={{ opacity: 1, y: 0, scale: 0.8 }}
                              animate={{ opacity: 0, y: -40, scale: 1.4 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.8, ease: 'easeOut' }}
                              className="absolute -top-1 left-1/2 -translate-x-1/2 pointer-events-none"
                            >
                              <Sparkles className="w-5 h-5 text-gala-gold" />
                            </motion.div>
                          ))}
                      </AnimatePresence>
                    </button>

                    <span className="text-[10px] text-gala-silver/60 hidden md:inline ml-1 font-mono">
                      1 reacción por persona
                    </span>
                  </div>
                );
              })()}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() =>
                  setCurrentPhotoIdx((prev) =>
                    prev === 0 ? filteredPartyPhotos.length - 1 : prev - 1
                  )
                }
                className="px-4 py-3 rounded-xl btn-silver text-xs font-medium text-gala-ivory flex items-center gap-1.5 transition"
              >
                <SkipBack className="w-4 h-4 text-gala-gold" /> Anterior
              </button>

              <button
                type="button"
                onClick={() =>
                  setCurrentPhotoIdx(
                    (prev) => (prev + 1) % filteredPartyPhotos.length
                  )
                }
                className="px-5 py-3 rounded-xl btn-gold text-gala-obsidian font-semibold text-xs flex items-center gap-1.5 transition shadow"
              >
                Siguiente Foto <SkipForward className="w-4 h-4" />
              </button>

              <a
                href={currentPhoto.archivo_url}
                download={
                  currentPhoto.nombre_original || `Fiesta_${currentPhoto.id}`
                }
                className="p-3 rounded-xl btn-silver text-gala-champagne"
                title="Descargar esta foto"
              >
                <Download className="w-4 h-4" />
              </a>

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => handleQuickDiscard(currentPhoto.id)}
                  className="px-3.5 py-3 rounded-xl bg-red-950/80 hover:bg-red-900 border border-red-500/50 text-red-200 text-xs font-semibold flex items-center gap-1.5 transition"
                  title="Retirar foto inmediatamente del carrusel y proyector"
                >
                  <Trash2 className="w-4 h-4 text-red-400" />
                  <span className="hidden sm:inline">Quitar de Pantalla</span>
                </button>
              )}
            </div>
          </div>

          {/* Tira inferior de miniaturas para tocar cualquiera directamente */}
          <div className="flex gap-2.5 overflow-x-auto pt-2 pb-1">
            {filteredPartyPhotos.map((thumb, idx) => (
              <button
                key={thumb.id}
                type="button"
                onClick={() => setCurrentPhotoIdx(idx)}
                className={`relative w-24 h-16 rounded-lg overflow-hidden border shrink-0 transition ${
                  currentPhotoIdx === idx
                    ? 'border-2 border-gala-gold scale-105'
                    : 'border-gala-silver/20 opacity-60 hover:opacity-100'
                }`}
              >
                <img
                  src={thumb.archivo_url}
                  alt={thumb.pie_de_foto}
                  className="w-full h-full object-cover"
                />
                <span className="absolute bottom-1 left-1 px-1.5 bg-gala-obsidian/85 text-[10px] font-mono text-gala-champagne rounded">
                  {idx + 1}
                </span>
                {((thumb.reacciones_total || 0) > 0 ||
                  (localReactions[thumb.id]?.corazon || 0) > 0 ||
                  (localReactions[thumb.id]?.estrella || 0) > 0) && (
                  <span className="absolute top-1 right-1 px-1 py-0.5 rounded bg-gala-obsidian/90 border border-rose-500/40 text-[9px] font-mono text-rose-300 flex items-center gap-0.5">
                    <Heart className="w-2.5 h-2.5 text-rose-400 fill-rose-400" />
                    {(localReactions[thumb.id]?.corazon ?? thumb.reacciones_corazon ?? 0) +
                      (localReactions[thumb.id]?.estrella ?? thumb.reacciones_estrella ?? 0)}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* VISTA 2: TODAS LAS FOTOS DE LA FIESTA EN CUADRICULA PAGINADA */
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {paginatedPartyPhotos.map((item, idx) => {
              const globalIdx = (safePage - 1) * pageSize + idx;
              return (
                <div
                  key={item.id}
                  className="glass lift rounded-2xl overflow-hidden flex flex-col justify-between"
                >
                  <div>
                    <div
                      onClick={() => {
                        setCurrentPhotoIdx(globalIdx);
                        setViewMode('ONE_BY_ONE');
                      }}
                      className="relative aspect-[4/3] bg-gala-obsidian cursor-pointer overflow-hidden"
                    >
                      <img
                        src={item.archivo_url}
                        alt={item.pie_de_foto}
                        className="w-full h-full object-cover hover:scale-105 transition duration-500"
                      />
                      <span className="absolute top-3 left-3 px-2.5 py-0.5 rounded bg-gala-obsidian/90 border border-gala-silver/35 text-[10px] font-mono text-gala-champagne">
                        {item.autor_mesa || 'En Vivo'}
                      </span>
                    </div>
                    <div className="p-4 space-y-2">
                      <p className="font-serif italic text-lg text-gala-ivory">
                        "{item.pie_de_foto}"
                      </p>
                      <div className="flex items-center justify-between gap-2 pt-0.5">
                        <p className="text-xs text-gala-gold truncate">
                          {item.autor_nombre}
                        </p>
                        {/* Botones de Reacción compactos en cuadrícula (Límite: 1 por persona) */}
                        {(() => {
                          const itemMyReaction = myReactions[item.id] ?? item.mi_reaccion ?? null;
                          const isItemHeart = itemMyReaction === 'CORAZON';
                          const isItemStar = itemMyReaction === 'ESTRELLA';
                          const counts = getReactionCounts(item);

                          return (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReact(item.id, 'CORAZON');
                                }}
                                className={`relative px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition active:scale-90 ${
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
                                  handleReact(item.id, 'ESTRELLA');
                                }}
                                className={`relative px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition active:scale-90 ${
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
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentPhotoIdx(globalIdx);
                        setViewMode('ONE_BY_ONE');
                      }}
                      className="text-xs text-gala-champagne hover:underline flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5 text-gala-gold" /> Ver en grande
                    </button>
                    <div className="flex items-center gap-1.5">
                      <a
                        href={item.archivo_url}
                        download
                        className="px-3 py-1.5 rounded-lg bg-gala-gold/15 hover:bg-gala-gold text-gala-champagne hover:text-gala-obsidian text-xs font-medium flex items-center gap-1 transition"
                      >
                        <Download className="w-3.5 h-3.5" /> Descargar
                      </a>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => handleQuickDiscard(item.id)}
                          className="p-1.5 rounded-lg bg-red-950/70 hover:bg-red-900 border border-red-500/40 text-red-300"
                          title="Quitar foto de pantalla"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <PaginationBar
            currentPage={safePage}
            totalItems={filteredPartyPhotos.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            itemLabel="fotos de la fiesta"
          />
        </div>
      )}

      {/* Aviso si el alumno acaba de subir una foto de la fiesta y está en moderación */}
      {currentUser && myLiveUploads.some((i) => i.estado === 'PENDIENTE') && (
        <div className="p-4 rounded-2xl glass text-xs text-gala-champagne flex items-center gap-2">
          <Clock className="w-4 h-4 text-gala-gold shrink-0" />
          <span>
            Tienes{' '}
            {myLiveUploads.filter((i) => i.estado === 'PENDIENTE').length}{' '}
            foto(s) de la fiesta esperando aprobación rápida de las organizadoras.
          </span>
        </div>
      )}
    </div>
  );
};
