import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Film,
  Tv,
  Play,
  Pause,
  Download,
  GripVertical,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  UserPlus,
  ShieldAlert,
  Settings,
  CheckCircle2,
  Clock,
  Users,
  Layers,
  Sparkles,
  Maximize2,
  SkipForward,
  SkipBack,
  Search,
  FileSpreadsheet,
} from 'lucide-react';
import {
  AdminOverviewResponse,
  MediaEstado,
  StoryboardItem,
  EventFase,
} from '../types';
import { api } from '../services/api';
import { PaginationBar } from './PaginationBar';
import { StageBackground } from './StageBackground';

interface AdminDashboardProps {
  onConfigChanged: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onConfigChanged,
}) => {
  const [data, setData] = useState<AdminOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<
    'MODERATION' | 'STORYBOARD' | 'USERS' | 'CONFIG'
  >('MODERATION');
  const [statusFilter, setStatusFilter] = useState<
    'ALL' | 'PENDIENTE' | 'APROBADO_VIDEO' | 'APROBADO_GALERIA' | 'RECHAZADO' | 'RETIRO'
  >('PENDIENTE');
  const [storyboard, setStoryboard] = useState<StoryboardItem[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [exportingZip, setExportingZip] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Paginación para moderación de fotos y lista de invitados
  const [mediaPage, setMediaPage] = useState(1);
  const [mediaPageSize, setMediaPageSize] = useState(6);
  const [usersPage, setUsersPage] = useState(1);
  const [usersPageSize, setUsersPageSize] = useState(8);

  // Estado del Reproductor Modo Ensayo a Pantalla Completa
  const [rehearsalOpen, setRehearsalOpen] = useState(false);
  const [rehearsalIndex, setRehearsalIndex] = useState(0);
  const [rehearsalPlaying, setRehearsalPlaying] = useState(true);
  const [rehearsalProgressPct, setRehearsalProgressPct] = useState(0);

  // Estado de Gestión de Usuarios y Pegado desde Excel
  const [userSearch, setUserSearch] = useState('');
  const [newGuestName, setNewGuestName] = useState('');
  const [newGuestBadge, setNewGuestBadge] = useState('');
  const [newGuestMesa, setNewGuestMesa] = useState('');
  const [excelBulkText, setExcelBulkText] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const fetchOverview = async () => {
    try {
      const res = await api.getAdminOverview();
      setData(res);
      setStoryboard(res.storyboard);
    } catch (err: any) {
      showToast(err.message || 'Error al cargar el panel administrativo.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  useEffect(() => {
    if (rehearsalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [rehearsalOpen]);

  const currentRehearsalItem = storyboard[rehearsalIndex] || storyboard[0] || null;
  const currentRehearsalDurationSec = currentRehearsalItem?.duracion_display_seg || 4;
  const currentRehearsalIsVideo = currentRehearsalItem?.tipo_medio === 'VIDEO';

  useEffect(() => {
    setRehearsalProgressPct(0);
  }, [rehearsalIndex, rehearsalOpen]);

  // Avance automático fluido en Modo Ensayo
  useEffect(() => {
    if (
      !rehearsalOpen ||
      !rehearsalPlaying ||
      storyboard.length === 0 ||
      currentRehearsalIsVideo
    ) {
      return;
    }

    const stepMs = 80;
    const totalMs = currentRehearsalDurationSec * 1000;
    const increment = (stepMs / totalMs) * 100;

    const interval = setInterval(() => {
      setRehearsalProgressPct((prev) => {
        if (prev + increment >= 100) {
          setRehearsalIndex((idx) => (idx + 1) % storyboard.length);
          return 0;
        }
        return prev + increment;
      });
    }, stepMs);

    return () => clearInterval(interval);
  }, [
    rehearsalOpen,
    rehearsalPlaying,
    rehearsalIndex,
    storyboard.length,
    currentRehearsalDurationSec,
    currentRehearsalIsVideo,
  ]);

  const handleModerate = async (
    mediaId: string,
    estado: MediaEstado,
    restaurarPrivacidad = false
  ) => {
    try {
      const res = await api.moderateMedia(mediaId, estado, restaurarPrivacidad);
      showToast(res.message);
      await fetchOverview();
      onConfigChanged();
    } catch (err: any) {
      showToast(err.message || 'Error al moderar el elemento.');
    }
  };

  const handleMoveStoryboardItem = async (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= storyboard.length) return;
    const updated = [...storyboard];
    const [moved] = updated.splice(fromIdx, 1);
    updated.splice(toIdx, 0, moved);
    const reindexed = updated.map((item, idx) => ({ ...item, orden: idx + 1 }));
    setStoryboard(reindexed);

    setSavingOrder(true);
    try {
      await api.reorderStoryboard(
        reindexed.map((item) => ({
          media_item_id: item.id,
          duracion_display_seg: item.duracion_display_seg,
          transicion: item.transicion,
        }))
      );
      showToast('Orden del video actualizado.');
      onConfigChanged();
    } finally {
      setSavingOrder(false);
    }
  };

  const handleDurationChange = async (idx: number, seconds: number) => {
    const updated = [...storyboard];
    updated[idx] = { ...updated[idx], duracion_display_seg: seconds };
    setStoryboard(updated);
    await api.reorderStoryboard(
      updated.map((item) => ({
        media_item_id: item.id,
        duracion_display_seg: item.duracion_display_seg,
      }))
    );
  };

  const handleExportZip = async () => {
    setExportingZip(true);
    try {
      await api.downloadSequentialZip();
      showToast('Archivo ZIP ordenado (001, 002...) descargado.');
    } catch (err: any) {
      showToast(err.message || 'Error al exportar el archivo ZIP.');
    } finally {
      setExportingZip(false);
    }
  };

  const handleResetPin = async (userId: string) => {
    try {
      const res = await api.resetUserPin(userId);
      showToast(res.message);
      await fetchOverview();
    } catch (err: any) {
      showToast(err.message || 'No se pudo restablecer el PIN.');
    }
  };

  const handleAddGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGuestName.trim()) return;
    try {
      const res = await api.createUser({
        nombre_completo: newGuestName.trim(),
        distintivo_homonimo: newGuestBadge.trim(),
        mesa: newGuestMesa.trim(),
        rol: 'ALUMNO',
      });
      setNewGuestName('');
      setNewGuestBadge('');
      setNewGuestMesa('');
      showToast(res.message);
      await fetchOverview();
    } catch (err: any) {
      showToast(err.message || 'Error al agregar invitado.');
    }
  };

  const handleBulkExcelImport = async (e: React.FormEvent) => {
    e.preventDefault();
    const lines = excelBulkText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;

    const batch = lines.map((line) => {
      const parts = line.includes('\t') ? line.split('\t') : line.split(',');
      return {
        nombre_completo: (parts[0] || '').trim(),
        distintivo_homonimo: (parts[1] || 'Graduado').trim(),
        mesa: (parts[2] || 'Mesa General').trim(),
        rol: 'ALUMNO' as const,
      };
    });

    try {
      const token = localStorage.getItem('gala_graduacion_jwt_token_v1');
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ batch }),
      });
      const json = await res.json();
      setExcelBulkText('');
      showToast(json.message || 'Lista de Excel importada correctamente.');
      await fetchOverview();
    } catch {
      showToast('Error al importar la lista.');
    }
  };

  const handleUpdatePhase = async (fase: EventFase, subidasAbiertas: boolean) => {
    try {
      const res = await api.updateConfig({
        fase_actual: fase,
        subidas_abiertas: subidasAbiertas,
      });
      showToast(res.message);
      await fetchOverview();
      onConfigChanged();
    } catch (err: any) {
      showToast(err.message || 'Error al cambiar la fase del sistema.');
    }
  };

  const handleToggleAutoModeration = async (enabled: boolean) => {
    try {
      const res = await api.updateConfig({
        moderacion_automatica_qr: enabled,
      });
      showToast(res.message);
      await fetchOverview();
      onConfigChanged();
    } catch (err: any) {
      showToast(err.message || 'Error al actualizar la moderación de la fiesta.');
    }
  };

  if (loading || !data) {
    return (
      <div className="py-16 text-center text-sm text-gala-parchment">
        Cargando Panel de Organizadoras...
      </div>
    );
  }

  const filteredMedia = data.mediaItems.filter((item) => {
    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'RETIRO') return Boolean(item.solicitud_retiro);
    return item.estado === statusFilter;
  });

  const totalMediaPages = Math.max(1, Math.ceil(filteredMedia.length / mediaPageSize));
  const safeMediaPage = Math.min(mediaPage, totalMediaPages);
  const paginatedMedia = filteredMedia.slice(
    (safeMediaPage - 1) * mediaPageSize,
    safeMediaPage * mediaPageSize
  );

  const filteredUsers = data.users.filter((u) =>
    `${u.nombre_completo} ${u.distintivo_homonimo || ''} ${u.mesa || ''}`
      .toLowerCase()
      .includes(userSearch.toLowerCase())
  );

  const totalUserPages = Math.max(1, Math.ceil(filteredUsers.length / usersPageSize));
  const safeUsersPage = Math.min(usersPage, totalUserPages);
  const paginatedUsers = filteredUsers.slice(
    (safeUsersPage - 1) * usersPageSize,
    safeUsersPage * usersPageSize
  );

  return (
    <div className="space-y-6">
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="fixed top-20 right-4 z-[130] px-4 py-3 rounded-xl bg-gala-surface border border-gala-gold text-xs text-gala-ivory shadow-2xl flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 text-gala-gold shrink-0" />
            <span>{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cabecera clara del Panel de Organizadoras */}
      <div className="p-6 rounded-2xl glass">
        <span className="text-[11px] uppercase tracking-[0.25em] text-gala-gold font-semibold inline-flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-gala-silver" />
          Exclusivo para Organizadoras · El inicio de nuestra historia
        </span>
        <h2 className="font-serif text-3xl text-gala-ivory mt-1">
          Centro de Control de la Graduación
        </h2>
        <p className="text-xs sm:text-sm text-gala-parchment/85 mt-1">
          Elige abajo qué tarea quieres realizar: aprobar fotos recibidas, ordenar el video conmemorativo, borrar un PIN olvidado o abrir/cerrar las subidas.
        </p>
      </div>

      {/* 4 Pestañas Numeradas y Claras */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        <button
          type="button"
          onClick={() => setActiveSubTab('MODERATION')}
          className={`p-3.5 rounded-xl text-left border transition flex items-center gap-3 ${
            activeSubTab === 'MODERATION'
              ? 'btn-gold border-gala-gold font-semibold shadow-lg'
              : 'bg-gala-velvet text-gala-silver border-gala-silver/20 hover:border-gala-gold/45'
          }`}
        >
          <Sparkles className="w-5 h-5 shrink-0" />
          <div>
            <div className="text-xs">1. Aprobar Fotos Recibidas</div>
            <div className="text-[11px] opacity-80 font-mono">
              {data.stats.pendientes} por revisar
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('STORYBOARD')}
          className={`p-3.5 rounded-xl text-left border transition flex items-center gap-3 ${
            activeSubTab === 'STORYBOARD'
              ? 'btn-gold border-gala-gold font-semibold shadow-lg'
              : 'bg-gala-velvet text-gala-silver border-gala-silver/20 hover:border-gala-gold/45'
          }`}
        >
          <Layers className="w-5 h-5 shrink-0" />
          <div>
            <div className="text-xs">2. Ordenar Video y ZIP</div>
            <div className="text-[11px] opacity-80 font-mono">
              {storyboard.length} escenas en el video
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('USERS')}
          className={`p-3.5 rounded-xl text-left border transition flex items-center gap-3 ${
            activeSubTab === 'USERS'
              ? 'btn-gold border-gala-gold font-semibold shadow-lg'
              : 'bg-gala-velvet text-gala-silver border-gala-silver/20 hover:border-gala-gold/45'
          }`}
        >
          <Users className="w-5 h-5 shrink-0" />
          <div>
            <div className="text-xs">3. Invitados y PINs</div>
            <div className="text-[11px] opacity-80 font-mono">
              {data.users.length} en la lista
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('CONFIG')}
          className={`p-3.5 rounded-xl text-left border transition flex items-center gap-3 ${
            activeSubTab === 'CONFIG'
              ? 'btn-gold border-gala-gold font-semibold shadow-lg'
              : 'bg-gala-velvet text-gala-silver border-gala-silver/20 hover:border-gala-gold/45'
          }`}
        >
          <Settings className="w-5 h-5 shrink-0" />
          <div>
            <div className="text-xs">4. Ajustes del Evento</div>
            <div className="text-[11px] opacity-80 font-mono">
              {data.config.subidas_abiertas ? 'Subidas Abiertas' : 'Cerradas'}
            </div>
          </div>
        </button>
      </div>

      {/* PESTAÑA 1: APROBAR FOTOS RECIBIDAS (PAGINADA) */}
      {activeSubTab === 'MODERATION' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { id: 'PENDIENTE', label: `Nuevas por revisar (${data.stats.pendientes})` },
                { id: 'APROBADO_VIDEO', label: `En Modo Memoria / Video (${data.stats.aprobados_video})` },
                { id: 'APROBADO_GALERIA', label: `En Día de la Fiesta (${data.stats.aprobados_galeria})` },
                { id: 'RETIRO', label: `Solicitudes de Retiro (${data.stats.solicitudes_retiro})` },
                { id: 'RECHAZADO', label: `Descartadas (${data.stats.rechazados})` },
                { id: 'ALL', label: `Ver Todas (${data.mediaItems.length})` },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setStatusFilter(f.id);
                  setMediaPage(1);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs border transition ${
                  statusFilter === f.id
                    ? 'bg-gala-gold/20 border-gala-gold text-gala-champagne font-semibold'
                    : 'bg-gala-obsidian/85 border-gala-silver/20 text-gala-silver hover:border-gala-gold/45'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {filteredMedia.length === 0 ? (
            <div className="py-12 text-center glass rounded-2xl">
              <p className="text-sm text-gala-parchment">
                No hay fotos pendientes en esta categoría.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {paginatedMedia.map((item) => (
                  <div
                    key={item.id}
                    className="glass lift rounded-2xl overflow-hidden flex flex-col justify-between"
                  >
                    <div>
                      <div className="relative aspect-video bg-gala-obsidian flex items-center justify-center">
                        {item.tipo_medio === 'VIDEO' ? (
                          <video
                            src={item.archivo_url}
                            controls
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <img
                            src={item.archivo_url}
                            alt={item.pie_de_foto}
                            className="w-full h-full object-cover"
                          />
                        )}
                        <div className="absolute top-2.5 left-2.5">
                          <span className="px-2.5 py-1 rounded bg-gala-obsidian/90 border border-gala-silver/35 text-[10px] font-mono text-gala-champagne">
                            {item.origen === 'EN_VIVO'
                              ? 'Subida en: Día de la Fiesta'
                              : `Subida para Video (${item.etapa})`}
                          </span>
                        </div>
                        {Boolean(item.solicitud_retiro) && (
                          <div className="absolute bottom-2 left-2 right-2 p-2 rounded bg-red-950/90 border border-red-500 text-[11px] text-red-200 flex items-center gap-1.5">
                            <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
                            <span className="truncate">
                              Pidieron retirar: {item.motivo_retiro}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="p-4 space-y-2">
                        <p className="text-sm text-gala-ivory leading-snug">
                          "{item.pie_de_foto}"
                        </p>
                        <div className="pt-2 border-t border-gala-silver/15 text-xs text-gala-silver space-y-0.5">
                          <div className="font-medium text-gala-champagne">
                            Alumno: {item.autor_nombre}
                          </div>
                          <div className="text-[11px] text-gala-muted">
                            {item.autor_distintivo} · {item.autor_mesa || 'Sin mesa'}
                          </div>
                          <div className="text-[11px] font-mono text-gala-muted flex items-center gap-1 pt-0.5">
                            <Clock className="w-3 h-3" />
                            {new Date(item.created_at).toLocaleString('es-MX')}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 3 Botones Claros: A Modo Memoria (Video), A Día de la Fiesta, o Descartar */}
                    <div className="p-3 bg-gala-obsidian/85 border-t border-gala-silver/15 grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => handleModerate(item.id, 'APROBADO_VIDEO', true)}
                        className={`py-2.5 px-2 rounded-xl text-[11px] font-medium flex flex-col items-center justify-center gap-1 border text-center transition ${
                          item.estado === 'APROBADO_VIDEO'
                            ? 'btn-gold border-gala-gold font-bold'
                            : 'bg-gala-surface hover:bg-gala-gold/20 text-gala-champagne border-gala-silver/30'
                        }`}
                      >
                        <Film className="w-4 h-4" />
                        <span>Modo Memoria (Video)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleModerate(item.id, 'APROBADO_GALERIA', true)}
                        className={`py-2.5 px-2 rounded-xl text-[11px] font-medium flex flex-col items-center justify-center gap-1 border text-center transition ${
                          item.estado === 'APROBADO_GALERIA'
                            ? 'bg-emerald-500 text-gala-obsidian border-emerald-400 font-bold'
                            : 'bg-gala-surface hover:bg-emerald-950/60 text-emerald-300 border-emerald-500/30'
                        }`}
                      >
                        <Tv className="w-4 h-4" />
                        <span>Día de la Fiesta</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleModerate(item.id, 'RECHAZADO', false)}
                        className={`py-2.5 px-2 rounded-xl text-[11px] font-medium flex flex-col items-center justify-center gap-1 border text-center transition ${
                          item.estado === 'RECHAZADO'
                            ? 'bg-red-600 text-white border-red-500 font-bold'
                            : 'bg-gala-surface hover:bg-red-950/60 text-red-300 border-red-500/30'
                        }`}
                      >
                        <X className="w-4 h-4" />
                        <span>Descartar</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <PaginationBar
                currentPage={safeMediaPage}
                totalItems={filteredMedia.length}
                pageSize={mediaPageSize}
                onPageChange={setMediaPage}
                onPageSizeChange={setMediaPageSize}
                itemLabel="fotos en bandeja"
              />
            </div>
          )}
        </div>
      )}

      {/* PESTAÑA 2: ORDENAR VIDEO Y DESCARGAR ZIP */}
      {activeSubTab === 'STORYBOARD' && (
        <div className="space-y-5">
          <div className="p-5 rounded-2xl glass flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-serif text-2xl text-gala-ivory">
                Orden de las Fotos del Video (Modo Memoria)
              </h3>
              <p className="text-xs text-gala-parchment/85 mt-0.5">
                Cambia el orden con las flechas o arrastrando, ensaya cómo se verá en pantalla grande y descarga el paquete ZIP numerado (001, 002, 003...).
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                disabled={storyboard.length === 0}
                onClick={() => {
                  setRehearsalIndex(0);
                  setRehearsalProgressPct(0);
                  setRehearsalPlaying(true);
                  setRehearsalOpen(true);
                }}
                className="px-4 py-2.5 rounded-xl btn-silver text-xs font-medium text-gala-champagne flex items-center gap-2 transition"
              >
                <Maximize2 className="w-4 h-4 text-gala-gold" /> Presentar Video (Modo Ensayo)
              </button>

              <button
                type="button"
                disabled={exportingZip || storyboard.length === 0}
                onClick={handleExportZip}
                className="px-4 py-2.5 rounded-xl btn-gold text-gala-obsidian font-semibold text-xs flex items-center gap-2 transition shadow-lg"
              >
                <Download className="w-4 h-4" />
                {exportingZip ? 'Creando ZIP...' : 'Descargar ZIP Ordenado'}
              </button>
            </div>
          </div>

          {savingOrder && (
            <div className="text-xs text-gala-gold font-mono">
              Guardando nuevo orden...
            </div>
          )}

          <div className="space-y-3">
            {storyboard.map((item, idx) => {
              const seqCode = String(idx + 1).padStart(3, '0');
              return (
                <div
                  key={item.id}
                  draggable
                  onDragStart={() => setDraggedIndex(idx)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (draggedIndex !== null && draggedIndex !== idx) {
                      handleMoveStoryboardItem(draggedIndex, idx);
                    }
                    setDraggedIndex(null);
                  }}
                  className="p-3.5 rounded-xl glass flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <GripVertical className="w-5 h-5 text-gala-muted shrink-0 hidden sm:block" />
                    <div className="w-11 h-11 rounded-lg bg-gala-gold/15 border border-gala-gold/40 flex items-center justify-center font-mono text-sm font-semibold text-gala-champagne shrink-0">
                      {seqCode}
                    </div>
                    <div className="w-20 h-14 rounded-lg overflow-hidden bg-gala-obsidian border border-gala-silver/25 shrink-0">
                      <img
                        src={item.archivo_url}
                        alt={item.pie_de_foto}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-gala-obsidian border border-gala-silver/25 text-gala-champagne">
                        {item.etapa}
                      </span>
                      <p className="text-xs text-gala-ivory truncate mt-1">
                        {item.pie_de_foto}
                      </p>
                      <p className="text-[11px] text-gala-muted">
                        Subida por: {item.autor_nombre}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    <div className="flex items-center gap-1.5 text-xs text-gala-silver">
                      <span>Segundos:</span>
                      <select
                        value={item.duracion_display_seg || 4}
                        onChange={(e) =>
                          handleDurationChange(idx, Number(e.target.value))
                        }
                        className="bg-gala-obsidian border border-gala-silver/30 rounded-lg px-2 py-1 font-mono text-xs text-gala-champagne"
                      >
                        <option value={3}>3 seg</option>
                        <option value={4}>4 seg</option>
                        <option value={5}>5 seg</option>
                        <option value={6}>6 seg</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMoveStoryboardItem(idx, idx - 1)}
                        className="p-2 rounded-lg bg-gala-obsidian border border-gala-silver/25 disabled:opacity-30 text-gala-champagne"
                        title="Subir"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === storyboard.length - 1}
                        onClick={() => handleMoveStoryboardItem(idx, idx + 1)}
                        className="p-2 rounded-lg bg-gala-obsidian border border-gala-silver/25 disabled:opacity-30 text-gala-champagne"
                        title="Bajar"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Interruptor de Publicación Automática en Fiesta */}
          <div className="pt-6 border-t border-gala-silver/15 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-gala-obsidian/85 border border-gala-silver/20">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-serif text-lg text-gala-ivory">
                    Publicación Directa en la Fiesta (Sin revisión previa)
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                      data.config.moderacion_automatica_qr
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    }`}
                  >
                    {data.config.moderacion_automatica_qr ? 'Activada' : 'Desactivada'}
                  </span>
                </div>
                <p className="text-xs text-gala-parchment/80 max-w-xl">
                  {data.config.moderacion_automatica_qr
                    ? 'Recomendado para la noche del evento: las fotos que suban los invitados entran de inmediato al carrusel y al proyector sin que las organizadoras tengan que autorizarlas una por una.'
                    : 'Modo seguro: cada foto de la fiesta queda pendiente hasta que una organizadora la autorice desde la pestaña 1.'}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  handleToggleAutoModeration(!data.config.moderacion_automatica_qr)
                }
                className={`px-5 py-2.5 rounded-xl text-xs font-semibold shrink-0 transition shadow ${
                  data.config.moderacion_automatica_qr
                    ? 'btn-silver text-gala-ivory'
                    : 'btn-gold text-gala-obsidian'
                }`}
              >
                {data.config.moderacion_automatica_qr
                  ? 'Desactivar Publicación Directa'
                  : 'Activar Publicación Directa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA 3: LISTA DE INVITADOS, PEGADO DE EXCEL Y BORRADO DE PIN (PAGINADA) */}
      {activeSubTab === 'USERS' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-4">
            <form
              onSubmit={handleAddGuest}
              className="p-5 rounded-2xl glass space-y-3"
            >
              <div className="flex items-center gap-2 text-gala-gold">
                <UserPlus className="w-4 h-4" />
                <h3 className="font-serif text-xl text-gala-ivory">
                  Agregar un Invitado
                </h3>
              </div>
              <input
                type="text"
                required
                value={newGuestName}
                onChange={(e) => setNewGuestName(e.target.value)}
                placeholder="Nombre completo"
                className="w-full px-3.5 py-2.5 rounded-xl bg-gala-obsidian border border-gala-silver/30 text-xs text-gala-ivory"
              />
              <input
                type="text"
                value={newGuestBadge}
                onChange={(e) => setNewGuestBadge(e.target.value)}
                placeholder="Carrera / Grupo (para distinguir homónimos)"
                className="w-full px-3.5 py-2.5 rounded-xl bg-gala-obsidian border border-gala-silver/30 text-xs text-gala-ivory"
              />
              <input
                type="text"
                value={newGuestMesa}
                onChange={(e) => setNewGuestMesa(e.target.value)}
                placeholder="Mesa (ej. Mesa 05)"
                className="w-full px-3.5 py-2.5 rounded-xl bg-gala-obsidian border border-gala-silver/30 text-xs text-gala-ivory"
              />
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl btn-gold text-gala-obsidian font-semibold text-xs"
              >
                Agregar a la Lista
              </button>
            </form>

            {/* Pegar desde Excel */}
            <form
              onSubmit={handleBulkExcelImport}
              className="p-5 rounded-2xl glass space-y-3"
            >
              <div className="flex items-center gap-2 text-gala-gold">
                <FileSpreadsheet className="w-4 h-4" />
                <h3 className="font-serif text-xl text-gala-ivory">
                  Pegar Lista desde Excel
                </h3>
              </div>
              <p className="text-[11px] text-gala-muted">
                Un alumno por renglón: Nombre, Carrera, Mesa
              </p>
              <textarea
                rows={3}
                value={excelBulkText}
                onChange={(e) => setExcelBulkText(e.target.value)}
                placeholder="Ana Sofía Ruiz, Arquitectura, Mesa 03&#10;Carlos Daniel Soto, Derecho, Mesa 08"
                className="w-full p-3 rounded-xl bg-gala-obsidian border border-gala-silver/30 text-xs text-gala-ivory"
              />
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl btn-silver text-xs text-gala-champagne font-medium"
              >
                Importar Renglones de Excel
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 p-5 rounded-2xl glass space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-serif text-xl text-gala-ivory">
                  Lista Oficial y Restablecimiento de PIN
                </h3>
                <p className="text-xs text-gala-muted">
                  Si alguien olvidó sus 4 números, toca "Borrar PIN" junto a su nombre.
                </p>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-gala-gold absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => {
                    setUserSearch(e.target.value);
                    setUsersPage(1);
                  }}
                  placeholder="Buscar alumno..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-gala-obsidian border border-gala-silver/25 text-xs text-gala-ivory"
                />
              </div>
            </div>

            <div className="space-y-2">
              {paginatedUsers.map((u) => (
                <div
                  key={u.id}
                  className="p-3 rounded-xl bg-gala-obsidian/85 border border-gala-silver/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="text-sm font-medium text-gala-ivory">
                      {u.nombre_completo}
                    </div>
                    <div className="text-xs text-gala-muted">
                      {u.distintivo_homonimo} · {u.mesa}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[11px] px-2.5 py-1 rounded-md border ${
                        u.tiene_pin
                          ? 'bg-emerald-950/60 border-emerald-500/30 text-emerald-300'
                          : 'bg-gala-surface border-gala-silver/20 text-gala-muted'
                      }`}
                    >
                      {u.tiene_pin ? 'Tiene PIN' : 'Sin PIN todavía'}
                    </span>

                    {u.tiene_pin && (
                      <button
                        type="button"
                        onClick={() => handleResetPin(u.id)}
                        className="px-3 py-1.5 rounded-lg bg-gala-surface hover:bg-red-950/80 border border-gala-silver/30 text-xs text-gala-champagne flex items-center gap-1.5 transition"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Borrar PIN
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <PaginationBar
              currentPage={safeUsersPage}
              totalItems={filteredUsers.length}
              pageSize={usersPageSize}
              onPageChange={setUsersPage}
              onPageSizeChange={setUsersPageSize}
              pageSizeOptions={[4, 8, 12, 20]}
              itemLabel="invitados"
            />
          </div>
        </div>
      )}

      {/* PESTAÑA 4: AJUSTES DEL EVENTO */}
      {activeSubTab === 'CONFIG' && (
        <div className="p-6 rounded-2xl glass space-y-6">
          <div>
            <h3 className="font-serif text-2xl text-gala-ivory">
              Abrir o Cerrar Recepción de Fotos por Fase
            </h3>
            <p className="text-xs text-gala-parchment/85 mt-1">
              Cada fase habilita únicamente el apartado que le corresponde: en Antes de la Fiesta solo se suben Memorias, en Día de la Fiesta solo fotos en vivo de ese día, y en Fiesta Terminada solo las Organizadoras (Admin) pueden subir archivos.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(
              [
                {
                  fase: 'PRE_EVENTO' as EventFase,
                  title: 'Antes de la Fiesta (Solo Memorias)',
                  desc: 'Habilita únicamente las subidas en 1. Modo Memoria para armar el video. El apartado Día de la Fiesta permanece cerrado para subir.',
                  openUploads: true,
                },
                {
                  fase: 'EN_VIVO' as EventFase,
                  title: 'Día de la Fiesta (Solo Fiesta en Vivo)',
                  desc: 'Cierra las subidas de Modo Memoria y habilita únicamente las subidas en el apartado 2. Día de la Fiesta.',
                  openUploads: true,
                },
                {
                  fase: 'MEMORIA' as EventFase,
                  title: 'Fiesta Terminada (Solo Organizadoras)',
                  desc: 'Cierra las subidas para todos los invitados (solo ver y descargar). Únicamente las usuarias con rol Admin pueden subir fotos.',
                  openUploads: false,
                },
              ] as const
            ).map((card) => {
              const isCurrent = data.config.fase_actual === card.fase;
              return (
                <button
                  key={card.fase}
                  type="button"
                  onClick={() => handleUpdatePhase(card.fase, card.openUploads)}
                  className={`text-left p-5 rounded-2xl border transition flex flex-col justify-between gap-4 ${
                    isCurrent
                      ? 'bg-gala-gold/15 border-gala-gold shadow-xl'
                      : 'bg-gala-obsidian/85 border-gala-silver/20 hover:border-gala-gold/50'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-serif text-xl text-gala-ivory">
                        {card.title}
                      </span>
                      {isCurrent && (
                        <span className="px-2.5 py-0.5 rounded-full bg-gala-gold text-gala-obsidian text-[10px] font-bold uppercase">
                          Activo
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gala-parchment/85 mt-2">
                      {card.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Interruptor de Publicación Automática en Fiesta */}
          <div className="pt-6 border-t border-gala-silver/15 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-gala-obsidian/85 border border-gala-silver/20">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-serif text-lg text-gala-ivory">
                    Publicación Directa en la Fiesta (Sin revisión previa)
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                      data.config.moderacion_automatica_qr
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    }`}
                  >
                    {data.config.moderacion_automatica_qr ? 'Activada' : 'Desactivada'}
                  </span>
                </div>
                <p className="text-xs text-gala-parchment/80 max-w-xl">
                  {data.config.moderacion_automatica_qr
                    ? 'Recomendado para la noche del evento: las fotos que suban los invitados entran de inmediato al carrusel y al proyector sin que las organizadoras tengan que autorizarlas una por una.'
                    : 'Modo seguro: cada foto de la fiesta queda pendiente hasta que una organizadora la autorice desde la pestaña 1.'}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  handleToggleAutoModeration(!data.config.moderacion_automatica_qr)
                }
                className={`px-5 py-2.5 rounded-xl text-xs font-semibold shrink-0 transition shadow ${
                  data.config.moderacion_automatica_qr
                    ? 'btn-silver text-gala-ivory'
                    : 'btn-gold text-gala-obsidian'
                }`}
              >
                {data.config.moderacion_automatica_qr
                  ? 'Desactivar Publicación Directa'
                  : 'Activar Publicación Directa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REPRODUCTOR MODO ENSAYO MEDIANTE PORTAL */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {rehearsalOpen && storyboard.length > 0 && currentRehearsalItem && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[120] h-[100dvh] w-screen bg-gala-obsidian text-gala-ivory flex flex-col justify-between overflow-hidden select-none"
              >
                <StageBackground />
                <div className="pointer-events-none fixed inset-2 sm:inset-4 border border-gala-silver/25 rounded-2xl z-10" />

                <div className="relative z-20 px-4 sm:px-8 pt-4 sm:pt-6 pb-2 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-3 py-1 rounded-full bg-gala-surface/90 border border-gala-gold/50 text-xs font-mono text-gala-champagne flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-gala-gold" />
                      <span>
                        ENSAYO DEL VIDEO · ESCENA {rehearsalIndex + 1} DE{' '}
                        {storyboard.length}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setRehearsalOpen(false)}
                      className="px-3.5 py-2 rounded-xl bg-gala-surface border border-gala-silver/40 text-xs font-semibold text-gala-ivory flex items-center gap-1.5"
                    >
                      <X className="w-4 h-4 text-gala-gold" /> Cerrar Ensayo
                    </button>
                  </div>

                  <div className="w-full h-1.5 rounded-full bg-gala-surface/80 overflow-hidden border border-gala-silver/20">
                    <div
                      className="h-full bg-gradient-to-r from-gala-silver via-gala-gold to-gala-champagne transition-all duration-100 ease-linear"
                      style={{
                        width: `${
                          currentRehearsalIsVideo ? 100 : rehearsalProgressPct
                        }%`,
                      }}
                    />
                  </div>
                </div>

                <div className="relative z-20 flex-1 min-h-0 px-4 sm:px-8 py-2 flex items-center justify-center overflow-hidden">
                  <img
                    src={currentRehearsalItem.archivo_url}
                    alt={currentRehearsalItem.pie_de_foto}
                    className="max-h-full max-w-full object-contain rounded-2xl border border-gala-silver/35 shadow-2xl"
                  />
                </div>

                <div className="relative z-20 px-4 sm:px-8 pb-5 pt-2 max-w-2xl mx-auto w-full text-center space-y-3">
                  <div className="p-3.5 rounded-2xl glass">
                    <p className="font-serif italic text-base sm:text-xl text-gala-ivory line-clamp-2">
                      "{currentRehearsalItem.pie_de_foto}"
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setRehearsalProgressPct(0);
                        setRehearsalIndex((prev) =>
                          prev === 0 ? storyboard.length - 1 : prev - 1
                        );
                      }}
                      className="px-4 py-2.5 rounded-xl btn-silver text-xs font-semibold text-gala-ivory flex items-center gap-1.5"
                    >
                      <SkipBack className="w-4 h-4 text-gala-gold" /> Anterior
                    </button>
                    <button
                      type="button"
                      onClick={() => setRehearsalPlaying((p) => !p)}
                      className="px-6 py-2.5 rounded-xl btn-gold text-gala-obsidian font-semibold text-xs flex items-center gap-2 shadow-lg"
                    >
                      {rehearsalPlaying ? (
                        <>
                          <Pause className="w-4 h-4 fill-current" /> Pausar
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 fill-current" /> Reproducir
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRehearsalProgressPct(0);
                        setRehearsalIndex(
                          (prev) => (prev + 1) % storyboard.length
                        );
                      }}
                      className="px-4 py-2.5 rounded-xl btn-silver text-xs font-semibold text-gala-ivory flex items-center gap-1.5"
                    >
                      Siguiente <SkipForward className="w-4 h-4 text-gala-gold" />
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
