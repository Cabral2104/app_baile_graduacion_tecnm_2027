import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Upload,
  Camera,
  Film,
  CheckCircle2,
  Clock,
  Sparkles,
  AlertCircle,
  FileCheck2,
  Trash2,
  Lock,
} from 'lucide-react';
import {
  User,
  MediaItem,
  MediaOrigen,
  MediaEtapa,
  SystemConfig,
} from '../types';
import { api } from '../services/api';
import {
  compressImageClientSide,
  getVideoDurationSeconds,
  formatBytes,
} from '../utils/imageCompression';

interface UploadMediaCardProps {
  user: User | null;
  config: SystemConfig | null;
  onRequireAuth: () => void;
  onUploadSuccess: (item: MediaItem) => void;
}

const ETAPA_OPTIONS: Array<{
  value: MediaEtapa;
  label: string;
  subtitle: string;
}> = [
  {
    value: 'INICIO',
    label: 'El Inicio',
    subtitle: 'Primeros semestres, bienvenida e integración',
  },
  {
    value: 'SUPERVIVENCIA',
    label: 'Supervivencia',
    subtitle: 'Proyectos, desvelos, viajes y exámenes',
  },
  {
    value: 'RECTA_FINAL',
    label: 'Recta Final',
    subtitle: 'Último año, foto de toga y cierre de ciclo',
  },
];

export const UploadMediaCard: React.FC<UploadMediaCardProps> = ({
  user,
  config,
  onRequireAuth,
  onUploadSuccess,
}) => {
  const [origen, setOrigen] = useState<MediaOrigen>('PRE_EVENTO');
  const [etapa, setEtapa] = useState<MediaEtapa>('INICIO');
  const [pieDeFoto, setPieDeFoto] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [compressionStats, setCompressionStats] = useState<{
    original: number;
    compressed: number;
  } | null>(null);
  const [processingFile, setProcessingFile] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [myUploads, setMyUploads] = useState<MediaItem[]>([]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (config?.fase_actual === 'EN_VIVO') {
      setOrigen('EN_VIVO');
      setEtapa('GALA');
    } else {
      setOrigen('PRE_EVENTO');
      setEtapa('INICIO');
    }
  }, [config?.fase_actual]);

  const loadMyUploads = () => {
    if (!user) return;
    api
      .getMyUploads()
      .then((res) => setMyUploads(res.items))
      .catch(() => {});
  };

  useEffect(() => {
    loadMyUploads();
  }, [user?.id]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;

    setError(null);
    setSuccessMsg(null);

    if (rawFile.size > 50 * 1024 * 1024) {
      setError('El archivo supera el límite máximo permitido de 50 MB.');
      return;
    }

    const fileIsVideo =
      rawFile.type.startsWith('video/') ||
      /\.(mp4|mov|webm)$/i.test(rawFile.name);

    setProcessingFile(true);
    try {
      if (fileIsVideo) {
        const duration = await getVideoDurationSeconds(rawFile).catch(() => 15);
        if (duration > 45) {
          setError(
            `El video dura ${duration}s. El límite para clips en vivo o retrospectiva es de 45 segundos.`
          );
          setProcessingFile(false);
          return;
        }
        setIsVideo(true);
        setVideoDuration(duration);
        setSelectedFile(rawFile);
        setCompressionStats(null);
        setPreviewUrl(URL.createObjectURL(rawFile));
      } else {
        setIsVideo(false);
        setVideoDuration(null);
        const compressed = await compressImageClientSide(rawFile, 1920, 0.84);
        setSelectedFile(compressed.file);
        setCompressionStats({
          original: compressed.originalBytes,
          compressed: compressed.compressedBytes,
        });
        setPreviewUrl(URL.createObjectURL(compressed.file));
      }
    } catch (err: any) {
      setError(err.message || 'No fue posible procesar el archivo seleccionado.');
    } finally {
      setProcessingFile(false);
    }
  };

  const clearSelectedFile = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    setCompressionStats(null);
    setVideoDuration(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onRequireAuth();
      return;
    }
    if (!selectedFile) {
      setError('Por favor selecciona una fotografía o un video corto.');
      return;
    }
    if (!pieDeFoto.trim()) {
      setError('Escribe un breve pie de foto para contextualizar este recuerdo.');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const formData = new FormData();
      formData.append('archivo', selectedFile);
      formData.append('origen', origen);
      formData.append('etapa', origen === 'EN_VIVO' ? 'GALA' : etapa);
      formData.append('pie_de_foto', pieDeFoto.trim());
      if (videoDuration) {
        formData.append('duracion_seg', String(videoDuration));
      }

      const res = await api.uploadMedia(formData);
      setSuccessMsg(res.message);
      setPieDeFoto('');
      clearSelectedFile();
      loadMyUploads();
      onUploadSuccess(res.item);
    } catch (err: any) {
      setError(err.message || 'Error al subir el archivo.');
    } finally {
      setUploading(false);
    }
  };

  const uploadsClosed =
    config && (!config.subidas_abiertas || config.fase_actual === 'MEMORIA') && user?.rol !== 'ADMIN';

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Tarjeta Principal de Subida */}
      <div className="bg-gala-velvet/95 border border-gala-gold/25 rounded-2xl p-5 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gala-gold/15">
          <div>
            <span className="text-[11px] uppercase tracking-[0.25em] text-gala-gold font-medium">
              {origen === 'EN_VIVO'
                ? 'Fase II · Noche de Gala en Vivo (QR)'
                : 'Fase I · Cápsula Conmemorativa de la Carrera'}
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl text-gala-ivory mt-1">
              Comparte un Recuerdo con la Generación
            </h2>
          </div>

          {/* Selector de Modalidad (Pre-evento vs En Vivo) */}
          <div className="inline-flex rounded-xl bg-gala-obsidian p-1 border border-gala-gold/25 self-start">
            <button
              type="button"
              onClick={() => {
                setOrigen('PRE_EVENTO');
                setEtapa('INICIO');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                origen === 'PRE_EVENTO'
                  ? 'bg-gala-gold text-gala-obsidian'
                  : 'text-gala-parchment hover:text-gala-ivory'
              }`}
            >
              Pre-Evento
            </button>
            <button
              type="button"
              onClick={() => {
                setOrigen('EN_VIVO');
                setEtapa('GALA');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                origen === 'EN_VIVO'
                  ? 'bg-gala-gold text-gala-obsidian'
                  : 'text-gala-parchment hover:text-gala-ivory'
              }`}
            >
              En Vivo (Salón)
            </button>
          </div>
        </div>

        {uploadsClosed ? (
          <div className="py-12 text-center space-y-3">
            <Lock className="w-8 h-8 text-gala-gold mx-auto" />
            <h3 className="font-serif text-2xl text-gala-ivory">
              Recepción de Archivos Cerrada
            </h3>
            <p className="text-sm text-gala-parchment/80 max-w-md mx-auto">
              El evento ha pasado al Modo Memoria Permanente. Explora la galería oficial para descargar tus recuerdos en alta resolución.
            </p>
          </div>
        ) : !user ? (
          <div className="py-10 text-center space-y-4">
            <p className="text-sm text-gala-parchment max-w-md mx-auto">
              Para subir fotografías o videos cortos y mantener la trazabilidad por mesa y generación, selecciona tu nombre en la lista oficial.
            </p>
            <button
              type="button"
              onClick={onRequireAuth}
              className="px-6 py-3.5 rounded-xl btn-gold text-gala-obsidian font-semibold text-sm transition shadow-lg"
            >
              Buscar mi Nombre en la Lista
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-6">
            {/* Selector de Etapa de la Carrera (solo cuando es Pre-Evento) */}
            {origen === 'PRE_EVENTO' && (
              <div>
                <label className="block text-xs uppercase tracking-wider text-gala-gold mb-2.5">
                  1. Clasifica la Etapa Universitaria
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {ETAPA_OPTIONS.map((opt) => {
                    const active = etapa === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setEtapa(opt.value)}
                        className={`text-left p-3.5 rounded-xl border transition ${
                          active
                            ? 'bg-gala-gold/15 border-gala-gold text-gala-ivory shadow-md'
                            : 'bg-gala-obsidian/70 border-gala-gold/20 text-gala-parchment hover:border-gala-gold/40'
                        }`}
                      >
                        <div className="font-serif text-lg font-semibold text-gala-champagne">
                          {opt.label}
                        </div>
                        <div className="text-xs text-gala-parchment/75 mt-0.5 leading-snug">
                          {opt.subtitle}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Zona de Selección / Captura Multimedia */}
            <div>
              <label className="block text-xs uppercase tracking-wider text-gala-gold mb-2.5">
                {origen === 'PRE_EVENTO'
                  ? '2. Selecciona tu Fotografía o Video Corto (máx. 45s)'
                  : '1. Captura o Selecciona tu Foto / Clip desde tu Mesa'}
              </label>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,video/mp4,video/quicktime,video/webm"
                onChange={handleFileChange}
                className="hidden"
              />

              {!selectedFile ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={processingFile}
                  className="w-full py-10 px-6 rounded-2xl border-2 border-dashed border-gala-gold/35 hover:border-gala-gold bg-gala-obsidian/60 hover:bg-gala-obsidian transition flex flex-col items-center justify-center gap-3 text-center group"
                >
                  <div className="w-12 h-12 rounded-full bg-gala-gold/15 border border-gala-gold/40 flex items-center justify-center group-hover:scale-105 transition">
                    <Camera className="w-5 h-5 text-gala-gold" />
                  </div>
                  <div>
                    <p className="text-sm sm:text-base font-medium text-gala-ivory">
                      {processingFile
                        ? 'Optimizando archivo para transmisión rápida...'
                        : 'Toca aquí para elegir desde tu galería o abrir la cámara'}
                    </p>
                    <p className="text-xs text-gala-muted mt-1">
                      Soporta Fotos (JPG, PNG, HEIC con compresión WebP automática) y Videos Cortos (MP4, MOV máx. 45s / 50MB)
                    </p>
                  </div>
                </button>
              ) : (
                <div className="rounded-2xl overflow-hidden border border-gala-gold/35 bg-gala-obsidian">
                  <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
                    {isVideo ? (
                      <video
                        src={previewUrl || undefined}
                        controls
                        className="max-h-72 w-full object-contain"
                      />
                    ) : (
                      <img
                        src={previewUrl || undefined}
                        alt="Vista previa"
                        className="max-h-72 w-full object-contain"
                      />
                    )}
                    <button
                      type="button"
                      onClick={clearSelectedFile}
                      className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-black/80 hover:bg-red-950 text-xs text-gala-ivory border border-gala-gold/30 flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-400" /> Cambiar archivo
                    </button>
                  </div>

                  {/* Barra de Diagnóstico de Optimización */}
                  <div className="px-4 py-2.5 bg-gala-surface border-t border-gala-gold/20 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 text-gala-champagne">
                      {isVideo ? (
                        <>
                          <Film className="w-4 h-4" />
                          <span>
                            Video corto ({videoDuration}s · {formatBytes(selectedFile.size)})
                          </span>
                        </>
                      ) : (
                        <>
                          <FileCheck2 className="w-4 h-4" />
                          <span>
                            Optimizado en cliente:{' '}
                            {compressionStats
                              ? `${formatBytes(compressionStats.original)} → ${formatBytes(
                                  compressionStats.compressed
                                )}`
                              : formatBytes(selectedFile.size)}
                          </span>
                        </>
                      )}
                    </div>
                    <span className="text-gala-muted font-mono truncate max-w-[200px]">
                      {selectedFile.name}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Pie de foto obligatorio */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs uppercase tracking-wider text-gala-gold">
                  {origen === 'PRE_EVENTO'
                    ? '3. Pie de Foto / Historia del Recuerdo'
                    : '2. Mensaje para la Pantalla del Salón'}
                </label>
                <span className="text-[11px] font-mono text-gala-muted">
                  {pieDeFoto.length}/160
                </span>
              </div>
              <textarea
                rows={2}
                maxLength={160}
                value={pieDeFoto}
                onChange={(e) => setPieDeFoto(e.target.value)}
                placeholder="Ej. Última entrega de taller a las 3 AM o Brindis desde la Mesa 4..."
                required
                className="w-full p-3.5 rounded-xl bg-gala-obsidian border border-gala-gold/30 text-sm text-gala-ivory placeholder:text-gala-muted focus:outline-none focus:border-gala-gold"
              />
            </div>

            {error && (
              <div className="p-3.5 rounded-xl bg-red-950/60 border border-red-500/40 flex items-center gap-2.5 text-xs text-red-200">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 flex items-center gap-2.5 text-xs text-emerald-200"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{successMsg}</span>
              </motion.div>
            )}

            <button
              type="submit"
              disabled={uploading || !selectedFile}
              className="w-full py-4 px-6 rounded-xl btn-gold disabled:opacity-40 text-gala-obsidian font-semibold text-sm tracking-wide transition flex items-center justify-center gap-2 shadow-lg"
            >
              <Upload className="w-4 h-4" />
              {uploading
                ? 'Transmitiendo archivo al servidor...'
                : origen === 'EN_VIVO'
                ? 'Enviar a la Pantalla del Salón'
                : 'Guardar en el Archivo de Generación'}
            </button>
          </form>
        )}
      </div>

      {/* Mis Subidas Recientes y Estado de Moderación */}
      {user && myUploads.length > 0 && (
        <div className="bg-gala-velvet/90 border border-gala-gold/20 rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-serif text-xl text-gala-ivory">
                Mis Recuerdos Enviados ({myUploads.length})
              </h3>
              <p className="text-xs text-gala-muted">
                Seguimiento en tiempo real de la moderación del comité organizador
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {myUploads.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-xl bg-gala-obsidian border border-gala-gold/15 flex items-center gap-3"
              >
                <div className="w-16 h-16 rounded-lg overflow-hidden bg-gala-surface shrink-0 border border-gala-gold/20">
                  {item.tipo_medio === 'VIDEO' ? (
                    <video
                      src={item.archivo_url}
                      className="w-full h-full object-cover"
                      muted
                    />
                  ) : (
                    <img
                      src={item.archivo_url}
                      alt={item.pie_de_foto}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-gala-surface text-gala-gold border border-gala-gold/25">
                      {item.etapa}
                    </span>
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded inline-flex items-center gap-1 ${
                        item.estado === 'PENDIENTE'
                          ? 'bg-amber-950/70 text-amber-300 border border-amber-500/30'
                          : item.estado === 'RECHAZADO'
                          ? 'bg-red-950/70 text-red-300 border border-red-500/30'
                          : 'bg-emerald-950/70 text-emerald-300 border border-emerald-500/30'
                      }`}
                    >
                      {item.estado === 'PENDIENTE' ? (
                        <>
                          <Clock className="w-3 h-3" /> En revisión
                        </>
                      ) : item.estado === 'APROBADO_VIDEO' ? (
                        <>
                          <Sparkles className="w-3 h-3" /> En Video (#{item.storyboard_orden})
                        </>
                      ) : item.estado === 'APROBADO_GALERIA' ? (
                        <>
                          <CheckCircle2 className="w-3 h-3" /> Aprobado en Pantalla
                        </>
                      ) : (
                        'No seleccionado'
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-gala-ivory truncate mt-1.5">
                    {item.pie_de_foto}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

