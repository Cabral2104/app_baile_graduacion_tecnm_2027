import React, { useState, useEffect, useRef } from 'react';
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

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const totalPages = Math.max(1, Math.ceil(partyPhotos.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedPartyPhotos = partyPhotos.slice(
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
    if (!autoPlayInline || partyPhotos.length === 0) return;
    const timer = setTimeout(() => {
      setCurrentPhotoIdx((prev) => (prev + 1) % partyPhotos.length);
    }, 4500);
    return () => clearTimeout(timer);
  }, [autoPlayInline, currentPhotoIdx, partyPhotos.length]);

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

  const currentPhoto = partyPhotos[currentPhotoIdx] || partyPhotos[0] || null;

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

      {/* BARRA DE MODO DE VISTA: VER UNA POR UNA O VER CUADRICULA PAGINADA */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl bg-gala-velvet p-1 border border-gala-silver/25">
          <button
            type="button"
            onClick={() => setViewMode('ONE_BY_ONE')}
            className={`px-4 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition ${viewMode === 'ONE_BY_ONE'
              ? 'btn-gold text-gala-obsidian font-semibold'
              : 'text-gala-silver hover:text-gala-ivory'
              }`}
          >
            <Eye className="w-3.5 h-3.5" /> Ver Fotos Una por Una ({partyPhotos.length})
          </button>
          <button
            type="button"
            onClick={() => setViewMode('GRID')}
            className={`px-4 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition ${viewMode === 'GRID'
              ? 'btn-gold text-gala-obsidian font-semibold'
              : 'text-gala-silver hover:text-gala-ivory'
              }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" /> Ver Todas las Fotos
          </button>
        </div>

        {viewMode === 'ONE_BY_ONE' && partyPhotos.length > 1 && (
          <button
            type="button"
            onClick={() => setAutoPlayInline((prev) => !prev)}
            className={`px-4 py-2 rounded-xl text-xs font-medium border flex items-center gap-2 transition ${autoPlayInline
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
      ) : viewMode === 'ONE_BY_ONE' && currentPhoto ? (
        /* VISTA 1: VER LAS FOTOS DE LA FIESTA UNA POR UNA CON CONTROLES GRANDES */
        <div className="glass rounded-2xl p-4 sm:p-6 space-y-5 shadow-2xl">
          <div className="flex items-center justify-between text-xs text-gala-silver">
            <span className="font-mono px-3 py-1 rounded-full bg-gala-obsidian border border-gala-silver/30 text-gala-champagne">
              Foto {currentPhotoIdx + 1} de {partyPhotos.length}
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-gala-silver/15">
            <div>
              <p className="font-serif italic text-xl sm:text-2xl text-gala-ivory">
                "{currentPhoto.pie_de_foto}"
              </p>
              <p className="text-xs text-gala-gold mt-1">
                Subida por: <strong>{currentPhoto.autor_nombre}</strong> ·{' '}
                {currentPhoto.autor_mesa || currentPhoto.autor_distintivo}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() =>
                  setCurrentPhotoIdx((prev) =>
                    prev === 0 ? partyPhotos.length - 1 : prev - 1
                  )
                }
                className="px-4 py-3 rounded-xl btn-silver text-xs font-medium text-gala-ivory flex items-center gap-1.5 transition"
              >
                <SkipBack className="w-4 h-4 text-gala-gold" /> Anterior
              </button>

              <button
                type="button"
                onClick={() =>
                  setCurrentPhotoIdx((prev) => (prev + 1) % partyPhotos.length)
                }
                className="px-5 py-3 rounded-xl btn-gold text-gala-obsidian font-semibold text-xs flex items-center gap-1.5 transition shadow"
              >
                Siguiente Foto <SkipForward className="w-4 h-4" />
              </button>

              <a
                href={currentPhoto.archivo_url}
                download={currentPhoto.nombre_original || `Fiesta_${currentPhoto.id}`}
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
            {partyPhotos.map((thumb, idx) => (
              <button
                key={thumb.id}
                type="button"
                onClick={() => setCurrentPhotoIdx(idx)}
                className={`relative w-24 h-16 rounded-lg overflow-hidden border shrink-0 transition ${currentPhotoIdx === idx
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
                    <div className="p-4 space-y-1.5">
                      <p className="font-serif italic text-lg text-gala-ivory">
                        "{item.pie_de_foto}"
                      </p>
                      <p className="text-xs text-gala-gold">
                        {item.autor_nombre}
                      </p>
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
            totalItems={partyPhotos.length}
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
