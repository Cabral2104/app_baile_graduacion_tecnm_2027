import React, { useState, useRef } from 'react';
import {
  Camera,
  Download,
  Upload,
  CheckCircle2,
  Eye,
  Sparkles,
  FolderArchive,
  AlertCircle,
} from 'lucide-react';
import { MediaItem, User } from '../types';
import { api } from '../services/api';
import { PaginationBar } from './PaginationBar';
import { EditorialLightbox } from './EditorialLightbox';
import { useGalaConfirm } from './GalaConfirmModal';

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
  const confirm = useGalaConfirm();
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
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const totalPages = Math.max(1, Math.ceil(studioPhotos.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedStudioPhotos = studioPhotos.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  const handleUploadOfficial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !caption.trim()) return;
    setUploading(true);
    setErrMsg(null);
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
    } catch (err: any) {
      setErrMsg(err.message || 'No se pudo publicar la fotografía oficial.');
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadFullAlbum = async () => {
    setDownloadingZip(true);
    setErrMsg(null);
    try {
      await api.downloadPhotographerAlbumZip();
      setMsg('Álbum completo descargado en archivo ZIP.');
      setTimeout(() => setMsg(null), 4000);
    } catch (err: any) {
      setErrMsg(err.message || 'No fue posible descargar el álbum en ZIP.');
    } finally {
      setDownloadingZip(false);
    }
  };

  const handleDeleteOfficial = async (item: MediaItem) => {
    const ok = await confirm({
      title: '¿Eliminar fotografía oficial?',
      description: `Se eliminará "${item.pie_de_foto}" del álbum del fotógrafo oficial.`,
      confirmText: 'Sí, eliminar',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await api.deleteMyMedia(item.id);
      setViewerIndex(null);
      setMsg('Fotografía oficial eliminada.');
      onRefresh();
      setTimeout(() => setMsg(null), 3500);
    } catch (err: any) {
      setErrMsg(err.message || 'No se pudo eliminar la fotografía.');
    }
  };

  return (
    <div className="space-y-5">
      {msg && (
        <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-xs text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{msg}</span>
        </div>
      )}

      {errMsg && (
        <div className="p-3.5 rounded-xl bg-red-950/80 border border-red-500/40 text-xs text-red-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errMsg}</span>
        </div>
      )}

      <div className="p-5 sm:p-6 rounded-2xl glass flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <span className="font-display text-[10.5px] uppercase tracking-[0.22em] text-gala-gold font-semibold inline-flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-gala-silver" />
            Cobertura Oficial · Alta Resolución
          </span>
          <h2 className="font-serif font-semibold text-2xl sm:text-4xl text-gala-ivory mt-1">
            Álbum del Fotógrafo Oficial
          </h2>
          <p className="text-xs sm:text-sm text-gala-parchment/85 mt-1 max-w-2xl leading-relaxed">
            Fotografías profesionales de estudio y cobertura oficial listas para descargar de forma individual o en paquete completo.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {studioPhotos.length > 0 && (
            <button
              type="button"
              disabled={downloadingZip}
              onClick={handleDownloadFullAlbum}
              className="px-4 py-2.5 rounded-xl btn-silver text-xs font-semibold text-gala-champagne flex items-center gap-2 disabled:opacity-50"
            >
              <FolderArchive className="w-4 h-4 text-gala-gold" />
              <span>{downloadingZip ? 'Preparando ZIP...' : 'Descargar Álbum (.zip)'}</span>
            </button>
          )}

          {currentUser?.rol === 'ADMIN' && (
            <button
              type="button"
              onClick={() => setShowAdminUpload((p) => !p)}
              className="px-4 py-2.5 rounded-xl btn-gold text-gala-obsidian font-semibold text-xs flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              <span>Subir Foto Oficial</span>
            </button>
          )}
        </div>
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
            className="w-full px-4 py-2.5 rounded-xl bg-gala-obsidian border border-gala-silver/25 text-xs text-gala-ivory"
          />
          <button
            type="submit"
            disabled={uploading || !file}
            className="px-5 py-2.5 rounded-xl btn-gold text-gala-obsidian font-semibold text-xs disabled:opacity-40"
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
                <article
                  key={item.id}
                  className="glass lift rounded-2xl overflow-hidden flex flex-col justify-between group"
                >
                  <div>
                    <div
                      onClick={() => setViewerIndex(globalIdx)}
                      className="relative aspect-[4/3] bg-gala-obsidian cursor-pointer overflow-hidden"
                    >
                      <img
                        src={item.archivo_url}
                        alt={item.pie_de_foto}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                      />
                      <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-gala-obsidian/80 to-transparent pointer-events-none" />
                      <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-gala-obsidian/70 backdrop-blur-md border border-gala-silver/20 text-[10px] font-display uppercase tracking-wider text-gala-champagne">
                        Oficial #{globalIdx + 1}
                      </span>
                    </div>
                    <div className="p-4">
                      <p className="font-serif italic text-lg text-gala-ivory leading-snug">
                        "{item.pie_de_foto}"
                      </p>
                      <p className="text-[11px] text-gala-gold/90 mt-1">
                        Fotografía Oficial · Generación 2022 – 2026
                      </p>
                    </div>
                  </div>
                  <div className="px-4 py-2.5 bg-gala-obsidian/70 border-t border-gala-silver/10 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setViewerIndex(globalIdx)}
                      className="text-xs text-gala-champagne hover:text-gala-gold flex items-center gap-1.5 transition"
                    >
                      <Eye className="w-3.5 h-3.5 text-gala-gold" /> Ampliar
                    </button>
                    <a
                      href={item.archivo_url}
                      download={item.nombre_original || `Oficial_${item.id}`}
                      className="px-3 py-1.5 rounded-lg btn-gold text-gala-obsidian font-semibold text-xs flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" /> Descargar HD
                    </a>
                  </div>
                </article>
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

      {/* Visor Editorial con Swipe táctil y teclado */}
      <EditorialLightbox
        items={studioPhotos}
        activeIndex={viewerIndex}
        onClose={() => setViewerIndex(null)}
        onChangeIndex={setViewerIndex}
        badgeLabel={() => 'Fotografía Oficial HD'}
        subtitleLabel={() => 'Estudio Fotográfico · Graduación TECNM'}
        canDelete={() => currentUser?.rol === 'ADMIN'}
        onDelete={handleDeleteOfficial}
      />
    </div>
  );
};
