import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Camera,
  Download,
  Upload,
  CheckCircle2,
  Eye,
  SkipBack,
  SkipForward,
  Sparkles,
  X,
} from 'lucide-react';
import { MediaItem, User } from '../types';
import { api } from '../services/api';
import { PaginationBar } from './PaginationBar';
import { StageBackground } from './StageBackground';

interface PhotographerSectionProps {
  items: MediaItem[];
  currentUser: User | null;
  onRefresh: () => void;
}

export const PhotographerSection: React.FC<PhotographerSectionProps> = ({
  items,
  currentUser,
  onRefresh,
}) => {
  const studioPhotos = items.filter(
    (i) =>
      i.estado === 'APROBADO_FOTOGRAFO' ||
      (i.origen === 'FOTOGRAFO' &&
        i.estado !== 'APROBADO_VIDEO' &&
        i.estado !== 'APROBADO_GALERIA')
  );

  // Paginación para evitar saturación visual cuando el fotógrafo suba muchas fotos
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [showAdminUpload, setShowAdminUpload] = useState(false);
  const [caption, setCaption] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const totalPages = Math.max(1, Math.ceil(studioPhotos.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedStudioPhotos = studioPhotos.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  useEffect(() => {
    if (viewerIndex !== null) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [viewerIndex]);

  const handleUploadOfficial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !caption.trim()) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('archivo', file);
      formData.append('origen', 'FOTOGRAFO');
      formData.append('etapa', 'GALA');
      formData.append('pie_de_foto', caption.trim());
      await api.uploadMedia(formData);
      setFile(null);
      setCaption('');
      setShowAdminUpload(false);
      setMsg('Fotografía oficial publicada directamente en el álbum.');
      onRefresh();
      setTimeout(() => setMsg(null), 4000);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {msg && (
        <div className="p-4 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-xs text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{msg}</span>
        </div>
      )}

      <div className="p-6 sm:p-8 rounded-2xl glass flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] uppercase tracking-[0.25em] text-gala-gold font-semibold inline-flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-gala-silver" />
            Apartado 3 · Alta Resolución
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl text-gala-ivory mt-1">
            Álbum del Fotógrafo Oficial
          </h2>
          <p className="text-xs sm:text-sm text-gala-parchment/90 mt-1 max-w-2xl">
            Fotografías profesionales de estudio y cobertura oficial donde termina el aula y comienza nuestra historia, listas para descargar en calidad original.
          </p>
        </div>

        {currentUser?.rol === 'ADMIN' && (
          <button
            type="button"
            onClick={() => setShowAdminUpload((p) => !p)}
            className="px-5 py-3 rounded-xl btn-gold text-gala-obsidian font-semibold text-xs flex items-center gap-2 shrink-0"
          >
            <Upload className="w-4 h-4" />
            <span>Subir Foto Oficial</span>
          </button>
        )}
      </div>

      {showAdminUpload && currentUser?.rol === 'ADMIN' && (
        <form
          onSubmit={handleUploadOfficial}
          className="p-5 rounded-2xl glass space-y-4"
        >
          <h3 className="font-serif text-xl text-gala-ivory">
            Publicar Fotografía del Fotógrafo Oficial
          </h3>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block w-full text-xs text-gala-parchment"
          />
          <input
            type="text"
            required
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Título o descripción de la toma oficial..."
            className="w-full px-4 py-2.5 rounded-xl bg-gala-obsidian border border-gala-silver/30 text-xs text-gala-ivory"
          />
          <button
            type="submit"
            disabled={uploading || !file}
            className="px-5 py-2.5 rounded-xl btn-gold text-gala-obsidian font-semibold text-xs"
          >
            {uploading ? 'Publicando...' : 'Publicar en Álbum Oficial'}
          </button>
        </form>
      )}

      {studioPhotos.length === 0 ? (
        <div className="py-16 text-center glass rounded-2xl">
          <Camera className="w-8 h-8 text-gala-gold mx-auto mb-2" />
          <p className="text-sm text-gala-parchment">
            Las fotografías del estudio oficial se publicarán en este apartado.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {paginatedStudioPhotos.map((item, idx) => {
              const globalIdx = (safePage - 1) * pageSize + idx;
              return (
                <div
                  key={item.id}
                  className="glass lift rounded-2xl overflow-hidden flex flex-col justify-between"
                >
                  <div>
                    <div
                      onClick={() => setViewerIndex(globalIdx)}
                      className="aspect-[4/3] bg-gala-obsidian cursor-pointer overflow-hidden"
                    >
                      <img
                        src={item.archivo_url}
                        alt={item.pie_de_foto}
                        className="w-full h-full object-cover hover:scale-105 transition duration-500"
                      />
                    </div>
                    <div className="p-4">
                      <p className="font-serif italic text-lg text-gala-ivory">
                        "{item.pie_de_foto}"
                      </p>
                      <p className="text-xs text-gala-gold mt-1">
                        Fotografía Oficial de Generación
                      </p>
                    </div>
                  </div>
                  <div className="px-4 py-3 bg-gala-obsidian/85 border-t border-gala-silver/15 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setViewerIndex(globalIdx)}
                      className="text-xs text-gala-champagne flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5 text-gala-gold" /> Ver en grande
                    </button>
                    <a
                      href={item.archivo_url}
                      download={item.nombre_original || `Oficial_${item.id}`}
                      className="px-3.5 py-1.5 rounded-lg btn-gold text-gala-obsidian font-semibold text-xs flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" /> Descargar HD
                    </a>
                  </div>
                </div>
              );
            })}
          </div>

          <PaginationBar
            currentPage={safePage}
            totalItems={studioPhotos.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            itemLabel="fotografías oficiales"
          />
        </div>
      )}

      {/* Visor de pantalla completa mediante Portal */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {viewerIndex !== null && studioPhotos[viewerIndex] && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[120] h-[100dvh] w-screen bg-gala-obsidian/95 backdrop-blur-xl flex flex-col justify-between p-4 sm:p-8 overflow-hidden"
              >
                <StageBackground />
                <div className="relative z-20 flex items-center justify-between">
                  <span className="px-3 py-1 rounded-full bg-gala-surface border border-gala-silver/30 text-xs font-mono text-gala-champagne">
                    Foto Oficial {viewerIndex + 1} de {studioPhotos.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => setViewerIndex(null)}
                    className="px-3.5 py-2 rounded-xl bg-gala-surface border border-gala-silver/35 text-xs font-semibold text-gala-ivory flex items-center gap-1.5"
                  >
                    <X className="w-4 h-4 text-gala-gold" /> Cerrar
                  </button>
                </div>

                <div className="relative z-20 flex-1 min-h-0 flex items-center justify-center my-3 overflow-hidden">
                  <img
                    src={studioPhotos[viewerIndex].archivo_url}
                    alt={studioPhotos[viewerIndex].pie_de_foto}
                    className="max-h-full max-w-full object-contain rounded-2xl border border-gala-silver/35 shadow-2xl"
                  />
                </div>

                <div className="relative z-20 max-w-2xl mx-auto w-full text-center space-y-3">
                  <div className="p-3.5 rounded-2xl glass">
                    <p className="font-serif italic text-lg sm:text-xl text-gala-ivory">
                      "{studioPhotos[viewerIndex].pie_de_foto}"
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-2.5">
                    <button
                      type="button"
                      disabled={viewerIndex === 0}
                      onClick={() =>
                        setViewerIndex((i) => Math.max(0, (i || 0) - 1))
                      }
                      className="px-3.5 py-2.5 rounded-xl btn-silver text-xs font-semibold text-gala-ivory disabled:opacity-35 flex items-center gap-1"
                    >
                      <SkipBack className="w-3.5 h-3.5 text-gala-gold" /> Anterior
                    </button>
                    <a
                      href={studioPhotos[viewerIndex].archivo_url}
                      download
                      className="px-5 py-2.5 rounded-xl btn-gold text-gala-obsidian font-semibold text-xs flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" /> Descargar Original
                    </a>
                    <button
                      type="button"
                      disabled={viewerIndex === studioPhotos.length - 1}
                      onClick={() =>
                        setViewerIndex((i) =>
                          Math.min(studioPhotos.length - 1, (i || 0) + 1)
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
    </div>
  );
};
