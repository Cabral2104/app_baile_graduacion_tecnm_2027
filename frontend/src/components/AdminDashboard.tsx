import React, { useState, useEffect, useRef } from 'react';
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
  QrCode,
  Database,
  Pencil,
  Trash2,
  Check,
  FolderArchive,
  Camera,
  Shield,
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
import { TableQrKit } from './TableQrKit';
import { useGalaConfirm } from './GalaConfirmModal';

interface AdminDashboardProps {
  onConfigChanged: () => void;
  onOpenLiveScreen?: () => void;
  currentUserId?: string;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onConfigChanged,
  onOpenLiveScreen,
  currentUserId,
}) => {
  const confirm = useGalaConfirm();
  const [data, setData] = useState<AdminOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<
    'MODERATION' | 'STORYBOARD' | 'USERS' | 'QR_KIT' | 'CONFIG'
  >('MODERATION');
  const [statusFilter, setStatusFilter] = useState<
    'ALL' | 'PENDIENTE' | 'APROBADO_VIDEO' | 'APROBADO_GALERIA' | 'RECHAZADO' | 'RETIRO'
  >('PENDIENTE');
  const [mediaSearch, setMediaSearch] = useState('');
  const [mediaMesaFilter, setMediaMesaFilter] = useState<'TODAS' | string>('TODAS');
  const [storyboard, setStoryboard] = useState<StoryboardItem[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [exportingScope, setExportingScope] = useState<string | null>(null);
  const [downloadingBackup, setDownloadingBackup] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Edición en línea de invitados en Padrón
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editGuestName, setEditGuestName] = useState('');
  const [editGuestBadge, setEditGuestBadge] = useState('');
  const [editGuestMesa, setEditGuestMesa] = useState('');
  const [editGuestRole, setEditGuestRole] = useState<'ALUMNO' | 'ADMIN'>('ALUMNO');

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
  const [rehearsalVideoProgressPct, setRehearsalVideoProgressPct] = useState(0);
  const rehearsalVideoRef = useRef<HTMLVideoElement | null>(null);

  // Estado de Gestión de Usuarios y Pegado desde Excel
  const [userSearch, setUserSearch] = useState('');
  const [newGuestName, setNewGuestName] = useState('');
  const [newGuestBadge, setNewGuestBadge] = useState('');
  const [newGuestMesa, setNewGuestMesa] = useState('');
  const [newGuestRole, setNewGuestRole] = useState<'ALUMNO' | 'ADMIN'>('ALUMNO');
  const [excelBulkText, setExcelBulkText] = useState('');
  const [batchModerating, setBatchModerating] = useState(false);

  // Filtro de elementos multimedia según la pestaña de estado activa (Pendientes, Aprobadas Video, Aprobadas Fiesta, etc.)
  const currentStatusMedia = React.useMemo(() => {
    if (!data) return [];
    return data.mediaItems.filter((item) => {
      if (statusFilter === 'RETIRO') return Boolean(item.solicitud_retiro);
      if (statusFilter === 'ALL') return true;
      return item.estado === statusFilter;
    });
  }, [data, statusFilter]);

  // Mesas únicas disponibles y conteo exacto de fotos DENTRO de la pestaña de estado activa
  const availableMediaMesas = React.useMemo(() => {
    const mesaMap = new Map<string, number>();
    currentStatusMedia.forEach((item) => {
      const mesa = item.autor_mesa?.trim();
      if (mesa) {
        mesaMap.set(mesa, (mesaMap.get(mesa) || 0) + 1);
      }
    });
    return Array.from(mesaMap.entries()).sort(([a], [b]) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );
  }, [currentStatusMedia]);

  // Si se cambia de pestaña y la mesa seleccionada no tiene fotos en esa nueva categoría, se restablece a TODAS
  useEffect(() => {
    if (mediaMesaFilter !== 'TODAS') {
      const mesaExists = availableMediaMesas.some(([mesa]) => mesa === mediaMesaFilter);
      if (!mesaExists) {
        setMediaMesaFilter('TODAS');
      }
    }
  }, [availableMediaMesas, mediaMesaFilter]);

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
    setRehearsalVideoProgressPct(0);
  }, [rehearsalIndex, rehearsalOpen]);

  useEffect(() => {
    if (!rehearsalOpen || !currentRehearsalIsVideo || !rehearsalVideoRef.current) return;
    if (rehearsalPlaying) {
      rehearsalVideoRef.current.play().catch(() => { });
    } else {
      rehearsalVideoRef.current.pause();
    }
  }, [rehearsalOpen, rehearsalPlaying, rehearsalIndex, currentRehearsalIsVideo]);

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
    const confirmMeta =
      estado === 'RECHAZADO'
        ? {
          title: '¿Descartar fotografía?',
          description:
            'La fotografía se ocultará de las galerías públicas y dejará de proyectarse si estaba activa.',
          confirmText: 'Sí, descartar',
          variant: 'danger' as const,
        }
        : restaurarPrivacidad
          ? {
            title: '¿Restaurar fotografía?',
            description:
              'Se quitará el reporte de privacidad y el archivo volverá a mostrarse públicamente.',
            confirmText: 'Sí, restaurar',
            variant: 'warning' as const,
          }
          : estado === 'APROBADO_VIDEO'
            ? {
              title: '¿Aprobar para el Video (Modo Memoria)?',
              description:
                'Se publicará en Modo Memoria y se agregará automáticamente a la secuencia del video conmemorativo.',
              confirmText: 'Sí, enviar al video',
              variant: 'gold' as const,
            }
            : {
              title: '¿Publicar en Día de la Fiesta?',
              description:
                'Esta fotografía aparecerá inmediatamente en Día de la Fiesta y en el proyector en vivo del salón.',
              confirmText: 'Sí, publicar en vivo',
              variant: 'gold' as const,
            };

    const ok = await confirm(confirmMeta);
    if (!ok) return;

    try {
      const res = await api.moderateMedia(mediaId, estado, restaurarPrivacidad);
      showToast(res.message);
      await fetchOverview();
      onConfigChanged();
    } catch (err: any) {
      showToast(err.message || 'Error al moderar el elemento.');
    }
  };

  const handleBatchApprovePending = async (pendingItems: AdminOverviewResponse['mediaItems']) => {
    if (pendingItems.length === 0) return;

    const memCount = pendingItems.filter((i) => i.origen === 'PRE_EVENTO').length;
    const partyCount = pendingItems.length - memCount;
    const parts: string[] = [];
    if (memCount > 0) parts.push(`${memCount} a Modo Memoria (Video)`);
    if (partyCount > 0) parts.push(`${partyCount} a Día de la Fiesta`);

    const ok = await confirm({
      title: `¿Aprobar ${pendingItems.length} archivo(s) pendientes?`,
      description: `Se publicarán automáticamente según el apartado desde donde se subieron: ${parts.join(' y ')}.`,
      confirmText: `Sí, aprobar (${pendingItems.length})`,
      variant: 'gold',
    });
    if (!ok) return;

    setBatchModerating(true);
    try {
      const res = await api.moderateMediaBatch(
        pendingItems.map((i) => i.id),
        'BY_ORIGIN'
      );
      showToast(res.message);
      await fetchOverview();
      onConfigChanged();
    } catch (err: any) {
      showToast(err.message || 'Error al aprobar el lote pendiente.');
    } finally {
      setBatchModerating(false);
    }
  };

  const handleMoveStoryboardItem = async (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= storyboard.length) return;
    const targetItem = storyboard[fromIdx];
    const ok = await confirm({
      title: '¿Cambiar orden en el video?',
      description: `Se moverá "${targetItem?.pie_de_foto || 'esta escena'}" a la posición #${String(toIdx + 1).padStart(3, '0')} del Storyboard.`,
      confirmText: 'Sí, mover escena',
      variant: 'gold',
    });
    if (!ok) return;

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
    const ok = await confirm({
      title: '¿Modificar duración de escena?',
      description: `La escena #${String(idx + 1).padStart(3, '0')} permanecerá ${seconds} segundos en pantalla durante el video.`,
      confirmText: 'Sí, cambiar duración',
      variant: 'gold',
    });
    if (!ok) return;

    const updated = [...storyboard];
    updated[idx] = { ...updated[idx], duracion_display_seg: seconds };
    setStoryboard(updated);
    await api.reorderStoryboard(
      updated.map((item) => ({
        media_item_id: item.id,
        duracion_display_seg: item.duracion_display_seg,
      }))
    );
    showToast(`Duración actualizada a ${seconds} segundos.`);
  };

  const handleExportZip = async (scope: 'STORYBOARD' | 'FIESTA' | 'FOTOGRAFO' = 'STORYBOARD') => {
    setExportingScope(scope);
    try {
      await api.downloadSequentialZip(scope);
      const label =
        scope === 'FIESTA'
          ? 'Paquete ZIP de Día de la Fiesta descargado.'
          : scope === 'FOTOGRAFO'
            ? 'Paquete ZIP del Fotógrafo Oficial descargado.'
            : 'Archivo ZIP ordenado (001, 002...) descargado.';
      showToast(label);
    } catch (err: any) {
      showToast(err.message || 'Error al exportar el archivo ZIP.');
    } finally {
      setExportingScope(null);
    }
  };

  const handleDownloadBackup = async () => {
    setDownloadingBackup(true);
    try {
      await api.downloadDatabaseBackup();
      showToast('Respaldo íntegro de la base de datos (.db) descargado.');
    } catch (err: any) {
      showToast(err.message || 'No se pudo generar el respaldo de seguridad.');
    } finally {
      setDownloadingBackup(false);
    }
  };

  const handleStartEditUser = (u: AdminOverviewResponse['users'][number]) => {
    setEditingUserId(u.id);
    setEditGuestName(u.nombre_completo);
    setEditGuestBadge(u.distintivo_homonimo || '');
    setEditGuestMesa(u.mesa || '');
    setEditGuestRole(u.rol === 'ADMIN' ? 'ADMIN' : 'ALUMNO');
  };

  const handleSaveEditUser = async (userId: string) => {
    if (!editGuestName.trim()) return;
    const isSelf = userId === currentUserId;
    const targetRole: 'ALUMNO' | 'ADMIN' = isSelf ? 'ADMIN' : editGuestRole;
    const roleLabel =
      targetRole === 'ADMIN'
        ? 'Organizadora / Comité Admin'
        : 'Alumno / Graduado';
    const ok = await confirm({
      title: '¿Guardar cambios del invitado?',
      description: `Se actualizarán los datos de "${editGuestName.trim()}" (${roleLabel}) en "${editGuestMesa.trim() || 'Mesa por asignar'}".`,
      confirmText: 'Sí, guardar cambios',
      variant: 'gold',
    });
    if (!ok) return;

    try {
      const res = await api.updateUser(userId, {
        nombre_completo: editGuestName.trim(),
        distintivo_homonimo: editGuestBadge.trim(),
        mesa: editGuestMesa.trim(),
        rol: targetRole,
      });
      setEditingUserId(null);
      showToast(res.message);
      await fetchOverview();
    } catch (err: any) {
      showToast(err.message || 'Error al guardar cambios del invitado.');
    }
  };

  const handleDeleteUser = async (u: AdminOverviewResponse['users'][number]) => {
    const ok = await confirm({
      title: '¿Retirar invitado del padrón?',
      description: `Se retirará a "${u.nombre_completo}" del padrón oficial activo.`,
      confirmText: 'Sí, retirar',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      const res = await api.deleteUser(u.id);
      showToast(res.message);
      await fetchOverview();
    } catch (err: any) {
      showToast(err.message || 'No se pudo eliminar el registro.');
    }
  };

  const handleResetPin = async (userId: string) => {
    const targetUser = data?.users.find((u) => u.id === userId);
    const ok = await confirm({
      title: '¿Restablecer PIN de acceso?',
      description: `Se borrará el PIN actual de ${targetUser ? `"${targetUser.nombre_completo}"` : 'este invitado'
        }. En su próximo ingreso deberá registrar uno nuevo de 4 dígitos.`,
      confirmText: 'Sí, borrar PIN',
      variant: 'warning',
    });
    if (!ok) return;
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
    const roleLabel =
      newGuestRole === 'ADMIN'
        ? 'Organizadora / Comité Admin'
        : 'Alumno / Graduado';
    const ok = await confirm({
      title: '¿Agregar registro al padrón?',
      description: `Se agregará a "${newGuestName.trim()}" con rol ${roleLabel}${newGuestMesa.trim() ? ` en "${newGuestMesa.trim()}"` : ''
        }.`,
      confirmText: 'Sí, agregar',
      variant: 'gold',
    });
    if (!ok) return;
    try {
      const res = await api.createUser({
        nombre_completo: newGuestName.trim(),
        distintivo_homonimo: newGuestBadge.trim(),
        mesa: newGuestMesa.trim(),
        rol: newGuestRole,
      });
      setNewGuestName('');
      setNewGuestBadge('');
      setNewGuestMesa('');
      setNewGuestRole('ALUMNO');
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

    const batch = lines
      .map((line) => {
        const parts = line.includes('\t') ? line.split('\t') : line.split(',');
        return {
          nombre_completo: (parts[0] || '').trim(),
          distintivo_homonimo: (parts[1] || 'Graduado').trim(),
          mesa: (parts[2] || 'Mesa General').trim(),
          rol: 'ALUMNO' as const,
        };
      })
      .filter((entry) => entry.nombre_completo.length > 0);

    if (batch.length === 0) {
      showToast('No se detectaron nombres válidos en el texto pegado.');
      return;
    }

    const ok = await confirm({
      title: '¿Importar lista de invitados?',
      description: `Se agregarán ${batch.length} registro(s) al padrón oficial desde la lista pegada.`,
      confirmText: `Sí, importar (${batch.length})`,
      variant: 'gold',
    });
    if (!ok) return;

    try {
      const json = await api.createUsersBatch(batch);
      setExcelBulkText('');
      showToast(json.message || 'Lista de Excel importada correctamente.');
      await fetchOverview();
    } catch (err: any) {
      showToast(err.message || 'Error al importar la lista.');
    }
  };

  const handleUpdatePhase = async (fase: EventFase, subidasAbiertas: boolean) => {
    const phaseLabel =
      fase === 'EN_VIVO'
        ? 'Día de la Fiesta (En Vivo)'
        : fase === 'MEMORIA'
          ? 'Fiesta Terminada (Solo lectura invitados)'
          : 'Antes de la Fiesta (Solo Memorias)';

    const ok = await confirm({
      title: '¿Cambiar fase del evento?',
      description: `Se activará la fase "${phaseLabel}" para todos los invitados conectados. Esto abrirá y cerrará automáticamente los formularios de subida correspondientes.`,
      confirmText: 'Sí, cambiar fase',
      variant: 'warning',
    });
    if (!ok) return;

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
    const ok = await confirm({
      title: enabled
        ? '¿Activar publicación directa en la fiesta?'
        : '¿Desactivar publicación directa?',
      description: enabled
        ? 'Las fotos que suban los invitados durante la fiesta pasarán de inmediato al proyector gigante sin requerir aprobación previa.'
        : 'Las nuevas fotos de la fiesta quedarán pendientes hasta que una organizadora las autorice desde el panel.',
      confirmText: enabled ? 'Sí, activar directo' : 'Sí, desactivar',
      variant: 'warning',
    });
    if (!ok) return;

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

  const normalizeSearch = (text: string) =>
    (text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

  const filteredMedia = currentStatusMedia.filter((item) => {
    if (mediaMesaFilter !== 'TODAS') {
      const itemMesa = (item.autor_mesa || '').trim().toLowerCase();
      if (itemMesa !== mediaMesaFilter.trim().toLowerCase()) return false;
    }

    if (mediaSearch.trim()) {
      const term = normalizeSearch(mediaSearch);
      const nameMatch = normalizeSearch(item.autor_nombre || '').includes(term);
      const mesaMatch = normalizeSearch(item.autor_mesa || '').includes(term);
      const badgeMatch = normalizeSearch(item.autor_distintivo || '').includes(term);
      const captionMatch = normalizeSearch(item.pie_de_foto || '').includes(term);
      if (!nameMatch && !mesaMatch && !badgeMatch && !captionMatch) return false;
    }

    return true;
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

      {/* Cabecera Ejecutiva + Resumen Operativo de la Gala */}
      <div className="p-5 sm:p-6 rounded-2xl glass space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <span className="font-display text-[10.5px] uppercase tracking-[0.22em] text-gala-gold font-semibold inline-flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-gala-silver" />
              Centro de Control del Comité · TECNM
            </span>
            <h2 className="font-serif font-semibold text-2xl sm:text-3xl text-gala-ivory mt-1">
              Tablero Ejecutivo de la Graduación
            </h2>
            <p className="text-xs sm:text-sm text-gala-parchment/85 mt-0.5">
              Supervisa aprobaciones, ordena el video, administra mesas del padrón, genera carteles QR y descarga respaldos.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {onOpenLiveScreen && (
              <button
                type="button"
                onClick={onOpenLiveScreen}
                className="px-4 py-2.5 rounded-xl btn-gold text-xs font-semibold text-gala-obsidian flex items-center gap-2 shadow-lg transition"
                title="Abrir el carrusel en vivo para el proyector o pantalla gigante del salón"
              >
                <Tv className="w-4 h-4" />
                <span>Abrir Pantalla del Salón</span>
              </button>
            )}

            <button
              type="button"
              disabled={downloadingBackup}
              onClick={handleDownloadBackup}
              className="px-4 py-2.5 rounded-xl btn-silver text-xs font-semibold text-gala-champagne flex items-center gap-2 shrink-0 disabled:opacity-50"
              title="Descargar copia de seguridad completa de la base de datos"
            >
              <Database className="w-4 h-4 text-gala-gold" />
              <span>{downloadingBackup ? 'Respaldando...' : 'Respaldo DB (.db)'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            type="button"
            onClick={() => {
              setActiveSubTab('MODERATION');
              setStatusFilter('PENDIENTE');
            }}
            className="p-3.5 rounded-xl bg-gala-obsidian/70 hover:bg-gala-surface/70 border border-gala-silver/15 text-left transition"
          >
            <div className="flex items-center justify-between text-[11px] text-gala-muted uppercase tracking-wider">
              <span>Por revisar</span>
              {data.stats.pendientes > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              )}
            </div>
            <div className="font-mono tabular-nums text-2xl font-bold text-gala-champagne mt-1">
              {data.stats.pendientes}
            </div>
            <div className="text-[11px] text-gala-silver/75 mt-0.5">
              {data.stats.solicitudes_retiro > 0
                ? `${data.stats.solicitudes_retiro} retiro(s) pendiente(s)`
                : 'Fotos esperando revisión'}
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveSubTab('MODERATION');
              setStatusFilter('APROBADO_GALERIA');
            }}
            className="p-3.5 rounded-xl bg-gala-obsidian/70 hover:bg-gala-surface/70 border border-gala-silver/15 text-left transition"
          >
            <div className="flex items-center justify-between text-[11px] text-gala-muted uppercase tracking-wider">
              <span>En Vivo Fiesta</span>
              <Tv className="w-3.5 h-3.5 text-gala-gold" />
            </div>
            <div className="font-mono tabular-nums text-2xl font-bold text-gala-ivory mt-1">
              {data.stats.aprobados_galeria}
            </div>
            <div className="text-[11px] text-emerald-300/90 mt-0.5">
              {data.stats.pantallas_conectadas} pantalla(s) conectada(s)
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('STORYBOARD')}
            className="p-3.5 rounded-xl bg-gala-obsidian/70 hover:bg-gala-surface/70 border border-gala-silver/15 text-left transition"
          >
            <div className="flex items-center justify-between text-[11px] text-gala-muted uppercase tracking-wider">
              <span>Video Memoria</span>
              <Film className="w-3.5 h-3.5 text-gala-gold" />
            </div>
            <div className="font-mono tabular-nums text-2xl font-bold text-gala-ivory mt-1">
              {data.stats.aprobados_video}
            </div>
            <div className="text-[11px] text-gala-silver/75 mt-0.5">
              Escenas listas para proyectar
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('USERS')}
            className="p-3.5 rounded-xl bg-gala-obsidian/70 hover:bg-gala-surface/70 border border-gala-silver/15 text-left transition"
          >
            <div className="flex items-center justify-between text-[11px] text-gala-muted uppercase tracking-wider">
              <span>Padrón Activo</span>
              <Users className="w-3.5 h-3.5 text-gala-gold" />
            </div>
            <div className="font-mono tabular-nums text-2xl font-bold text-gala-ivory mt-1">
              {data.users.length}
            </div>
            <div className="text-[11px] text-gala-silver/75 mt-0.5">
              {data.users.filter((u) => u.tiene_pin).length} con PIN registrado
            </div>
          </button>
        </div>
      </div>

      {/* 5 Pestañas Numeradas y Claras */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
        <button
          type="button"
          onClick={() => setActiveSubTab('MODERATION')}
          className={`p-3 rounded-xl text-left border transition flex items-center gap-2.5 ${activeSubTab === 'MODERATION'
              ? 'btn-gold border-gala-gold font-semibold shadow-lg'
              : 'bg-gala-velvet text-gala-silver border-gala-silver/20 hover:border-gala-gold/45'
            }`}
        >
          <Sparkles className="w-4 h-4 shrink-0" />
          <div className="min-w-0">
            <div className="text-xs font-semibold truncate">1. Aprobar Fotos</div>
            <div className="text-[10px] opacity-80 font-mono">
              {data.stats.pendientes} por revisar
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('STORYBOARD')}
          className={`p-3 rounded-xl text-left border transition flex items-center gap-2.5 ${activeSubTab === 'STORYBOARD'
              ? 'btn-gold border-gala-gold font-semibold shadow-lg'
              : 'bg-gala-velvet text-gala-silver border-gala-silver/20 hover:border-gala-gold/45'
            }`}
        >
          <Layers className="w-4 h-4 shrink-0" />
          <div className="min-w-0">
            <div className="text-xs font-semibold truncate">2. Ordenar Video</div>
            <div className="text-[10px] opacity-80 font-mono">
              {storyboard.length} escenas
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('USERS')}
          className={`p-3 rounded-xl text-left border transition flex items-center gap-2.5 ${activeSubTab === 'USERS'
              ? 'btn-gold border-gala-gold font-semibold shadow-lg'
              : 'bg-gala-velvet text-gala-silver border-gala-silver/20 hover:border-gala-gold/45'
            }`}
        >
          <Users className="w-4 h-4 shrink-0" />
          <div className="min-w-0">
            <div className="text-xs font-semibold truncate">3. Invitados y PINs</div>
            <div className="text-[10px] opacity-80 font-mono">
              {data.users.length} en la lista
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('QR_KIT')}
          className={`p-3 rounded-xl text-left border transition flex items-center gap-2.5 ${activeSubTab === 'QR_KIT'
              ? 'btn-gold border-gala-gold font-semibold shadow-lg'
              : 'bg-gala-velvet text-gala-silver border-gala-silver/20 hover:border-gala-gold/45'
            }`}
        >
          <QrCode className="w-4 h-4 shrink-0" />
          <div className="min-w-0">
            <div className="text-xs font-semibold truncate">4. Carteles QR Mesas</div>
            <div className="text-[10px] opacity-80 font-mono text-gala-gold">
              Kit Imprimible
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('CONFIG')}
          className={`p-3 rounded-xl text-left border transition flex items-center gap-2.5 ${activeSubTab === 'CONFIG'
              ? 'btn-gold border-gala-gold font-semibold shadow-lg'
              : 'bg-gala-velvet text-gala-silver border-gala-silver/20 hover:border-gala-gold/45'
            }`}
        >
          <Settings className="w-4 h-4 shrink-0" />
          <div className="min-w-0">
            <div className="text-xs font-semibold truncate">5. Ajustes Evento</div>
            <div className="text-[10px] opacity-80 font-mono">
              {data.config.subidas_abiertas ? 'Abiertas' : 'Cerradas'}
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
                className={`px-3.5 py-2 rounded-xl text-xs border transition ${statusFilter === f.id
                    ? 'bg-gala-gold/20 border-gala-gold text-gala-champagne font-semibold'
                    : 'bg-gala-obsidian/85 border-gala-silver/20 text-gala-silver hover:border-gala-gold/45'
                  }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* BARRA DE BÚSQUEDA Y FILTRO POR MESA EN MODERACIÓN */}
          <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
            <div className="relative flex-1 sm:max-w-md">
              <Search className="w-4 h-4 text-gala-gold absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={mediaSearch}
                onChange={(e) => {
                  setMediaSearch(e.target.value);
                  setMediaPage(1);
                }}
                placeholder="Buscar por alumno, mesa o dedicatoria..."
                className="w-full pl-9 pr-8 py-2 rounded-xl bg-gala-obsidian border border-gala-silver/30 text-xs text-gala-ivory placeholder-gala-muted focus:border-gala-gold focus:outline-none transition"
              />
              {mediaSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setMediaSearch('');
                    setMediaPage(1);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gala-muted hover:text-gala-ivory"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={mediaMesaFilter}
                onChange={(e) => {
                  setMediaMesaFilter(e.target.value);
                  setMediaPage(1);
                }}
                className="px-3 py-2 rounded-xl bg-gala-obsidian border border-gala-silver/30 text-xs text-gala-ivory focus:border-gala-gold focus:outline-none cursor-pointer"
              >
                <option value="TODAS">Todas las mesas ({currentStatusMedia.length})</option>
                {availableMediaMesas.map(([mesa, count]) => (
                  <option key={mesa} value={mesa}>
                    {mesa} ({count} {count === 1 ? 'foto' : 'fotos'})
                  </option>
                ))}
              </select>

              {(mediaSearch.trim() || mediaMesaFilter !== 'TODAS') && (
                <button
                  type="button"
                  onClick={() => {
                    setMediaSearch('');
                    setMediaMesaFilter('TODAS');
                    setMediaPage(1);
                  }}
                  className="px-2.5 py-2 rounded-xl btn-silver text-xs text-gala-champagne flex items-center gap-1"
                  title="Restablecer filtros"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-gala-gold" />
                </button>
              )}

              {(() => {
                const pendingVisible = filteredMedia.filter(
                  (item) => item.estado === 'PENDIENTE'
                );
                if (pendingVisible.length === 0) return null;
                return (
                  <button
                    type="button"
                    disabled={batchModerating}
                    onClick={() => handleBatchApprovePending(pendingVisible)}
                    className="px-3.5 py-2 rounded-xl btn-gold text-gala-obsidian font-semibold text-xs flex items-center gap-1.5 shadow transition disabled:opacity-50"
                    title="Aprobar juntas todas las fotos pendientes mostradas según su apartado"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>
                      {batchModerating
                        ? 'Aprobando...'
                        : `Aprobar pendientes (${pendingVisible.length})`}
                    </span>
                  </button>
                );
              })()}
            </div>
          </div>

          {filteredMedia.length === 0 ? (
            <div className="py-12 text-center glass rounded-2xl space-y-2">
              <p className="text-sm text-gala-parchment">
                {mediaSearch.trim() || mediaMesaFilter !== 'TODAS'
                  ? 'No hay fotos que coincidan con la búsqueda o mesa seleccionada.'
                  : 'No hay fotos pendientes en esta categoría.'}
              </p>
              {(mediaSearch.trim() || mediaMesaFilter !== 'TODAS') && (
                <button
                  type="button"
                  onClick={() => {
                    setMediaSearch('');
                    setMediaMesaFilter('TODAS');
                    setMediaPage(1);
                  }}
                  className="px-3 py-1.5 rounded-lg btn-silver text-xs text-gala-gold inline-flex items-center gap-1 mt-1"
                >
                  <RotateCcw className="w-3 h-3" /> Limpiar búsqueda
                </button>
              )}
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
                        className={`py-2.5 px-2 rounded-xl text-[11px] font-medium flex flex-col items-center justify-center gap-1 border text-center transition ${item.estado === 'APROBADO_VIDEO'
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
                        className={`py-2.5 px-2 rounded-xl text-[11px] font-medium flex flex-col items-center justify-center gap-1 border text-center transition ${item.estado === 'APROBADO_GALERIA'
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
                        className={`py-2.5 px-2 rounded-xl text-[11px] font-medium flex flex-col items-center justify-center gap-1 border text-center transition ${item.estado === 'RECHAZADO'
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
                disabled={exportingScope !== null || storyboard.length === 0}
                onClick={() => handleExportZip('STORYBOARD')}
                className="px-4 py-2.5 rounded-xl btn-gold text-gala-obsidian font-semibold text-xs flex items-center gap-2 transition shadow-lg disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                {exportingScope === 'STORYBOARD' ? 'Creando ZIP...' : 'Descargar ZIP Ordenado'}
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
                      {item.tipo_medio === 'VIDEO' ? (
                        <video
                          src={`${item.archivo_url}#t=0.1`}
                          muted
                          playsInline
                          preload="metadata"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <img
                          src={item.archivo_url}
                          alt={item.pie_de_foto}
                          className="w-full h-full object-cover"
                        />
                      )}
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
                    {item.tipo_medio === 'VIDEO' ? (
                      <span className="px-2.5 py-1 rounded-lg bg-gala-obsidian border border-gala-gold/30 font-mono text-[11px] text-gala-champagne flex items-center gap-1">
                        <Film className="w-3 h-3 text-gala-gold" />
                        <span>Clip completo</span>
                      </span>
                    ) : (
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
                    )}

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
                placeholder="Mesa (ej. Mesa 05 o Comité)"
                className="w-full px-3.5 py-2.5 rounded-xl bg-gala-obsidian border border-gala-silver/30 text-xs text-gala-ivory"
              />
              <div className="space-y-1">
                <label className="text-[11px] text-gala-silver/85 flex items-center gap-1.5">
                  <Shield className="w-3 h-3 text-gala-gold" />
                  <span>Rol en la plataforma</span>
                </label>
                <select
                  value={newGuestRole}
                  onChange={(e) =>
                    setNewGuestRole(e.target.value === 'ADMIN' ? 'ADMIN' : 'ALUMNO')
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-gala-obsidian border border-gala-silver/30 text-xs text-gala-ivory"
                >
                  <option value="ALUMNO">Alumno / Graduado</option>
                  <option value="ADMIN">Organizadora / Comité Admin</option>
                </select>
              </div>
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
              {paginatedUsers.map((u) => {
                const isEditing = editingUserId === u.id;
                return (
                  <div
                    key={u.id}
                    className="p-3 rounded-xl bg-gala-obsidian/85 border border-gala-silver/15 flex flex-col gap-3"
                  >
                    {isEditing ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                        <input
                          type="text"
                          value={editGuestName}
                          onChange={(e) => setEditGuestName(e.target.value)}
                          placeholder="Nombre completo"
                          className="px-3 py-1.5 rounded-lg bg-gala-velvet border border-gala-gold/40 text-xs text-gala-ivory"
                        />
                        <input
                          type="text"
                          value={editGuestBadge}
                          onChange={(e) => setEditGuestBadge(e.target.value)}
                          placeholder="Carrera / Distintivo"
                          className="px-3 py-1.5 rounded-lg bg-gala-velvet border border-gala-silver/25 text-xs text-gala-ivory"
                        />
                        <input
                          type="text"
                          value={editGuestMesa}
                          onChange={(e) => setEditGuestMesa(e.target.value)}
                          placeholder="Mesa (ej. Mesa 04)"
                          className="px-3 py-1.5 rounded-lg bg-gala-velvet border border-gala-silver/25 text-xs text-gala-ivory"
                        />
                        <select
                          value={u.id === currentUserId ? 'ADMIN' : editGuestRole}
                          disabled={u.id === currentUserId}
                          onChange={(e) =>
                            setEditGuestRole(
                              e.target.value === 'ADMIN' ? 'ADMIN' : 'ALUMNO'
                            )
                          }
                          title={
                            u.id === currentUserId
                              ? 'No puedes retirar tu propio rol de Organizadora'
                              : 'Rol en la plataforma'
                          }
                          className="px-3 py-1.5 rounded-lg bg-gala-velvet border border-gala-silver/25 text-xs text-gala-ivory disabled:opacity-60"
                        >
                          <option value="ALUMNO">Alumno / Graduado</option>
                          <option value="ADMIN">Organizadora / Comité</option>
                        </select>
                      </div>
                    ) : null}

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      {!isEditing ? (
                        <div>
                          <div className="text-sm font-medium text-gala-ivory flex items-center gap-2">
                            <span>{u.nombre_completo}</span>
                            {u.rol === 'ADMIN' && (
                              <span className="px-1.5 py-0.5 rounded bg-gala-gold/20 border border-gala-gold/40 text-[9px] font-mono uppercase text-gala-champagne">
                                Comité
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gala-muted">
                            {u.distintivo_homonimo || 'Graduado'} ·{' '}
                            <strong className="text-gala-champagne/90">{u.mesa || 'Sin mesa'}</strong>
                          </div>
                        </div>
                      ) : (
                        <span className="text-[11px] text-gala-gold font-mono">
                          Editando datos de {u.nombre_completo}
                        </span>
                      )}

                      <div className="flex flex-wrap items-center gap-1.5">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleSaveEditUser(u.id)}
                              className="px-3 py-1.5 rounded-lg btn-gold text-gala-obsidian font-semibold text-xs flex items-center gap-1"
                            >
                              <Check className="w-3.5 h-3.5" /> Guardar
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingUserId(null)}
                              className="px-3 py-1.5 rounded-lg bg-gala-surface border border-gala-silver/25 text-xs text-gala-silver"
                            >
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <>
                            <span
                              className={`text-[11px] px-2.5 py-1 rounded-md border ${u.tiene_pin
                                  ? 'bg-emerald-950/60 border-emerald-500/30 text-emerald-300'
                                  : 'bg-gala-surface border-gala-silver/20 text-gala-muted'
                                }`}
                            >
                              {u.tiene_pin ? 'Tiene PIN' : 'Sin PIN'}
                            </span>

                            <button
                              type="button"
                              onClick={() => handleStartEditUser(u)}
                              className="p-1.5 rounded-lg bg-gala-surface hover:bg-gala-card border border-gala-silver/25 text-gala-champagne transition"
                              title="Editar nombre, carrera o mesa"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>

                            {u.tiene_pin && (
                              <button
                                type="button"
                                onClick={() => handleResetPin(u.id)}
                                className="px-2.5 py-1.5 rounded-lg bg-gala-surface hover:bg-red-950/80 border border-gala-silver/30 text-xs text-gala-champagne flex items-center gap-1 transition"
                              >
                                <RotateCcw className="w-3.5 h-3.5" /> Borrar PIN
                              </button>
                            )}

                            {u.rol !== 'ADMIN' && (
                              <button
                                type="button"
                                onClick={() => handleDeleteUser(u)}
                                className="p-1.5 rounded-lg bg-red-950/60 hover:bg-red-900 border border-red-500/30 text-red-300 transition"
                                title="Eliminar duplicado o dar de baja"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
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

      {/* PESTAÑA 4: KIT DE CARTELES QR PARA MESAS (IMPRIMIBLE) */}
      {activeSubTab === 'QR_KIT' && (
        <TableQrKit users={data.users} config={data.config} />
      )}

      {/* PESTAÑA 5: AJUSTES DEL EVENTO */}
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
                  className={`text-left p-5 rounded-2xl border transition flex flex-col justify-between gap-4 ${isCurrent
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
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${data.config.moderacion_automatica_qr
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
                className={`px-5 py-2.5 rounded-xl text-xs font-semibold shrink-0 transition shadow ${data.config.moderacion_automatica_qr
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

          {/* Exportación Completa Post-Evento (ZIPs por Categoría) y Respaldo de Base de Datos */}
          <div className="pt-6 border-t border-gala-silver/15 space-y-3">
            <div>
              <h3 className="font-serif text-xl text-gala-ivory">
                Exportación Masiva (ZIP) y Respaldo del Evento
              </h3>
              <p className="text-xs text-gala-parchment/80 mt-0.5">
                Descarga paquetes completos por sección en calidad original o guarda una copia íntegra de la base de datos.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <button
                type="button"
                disabled={exportingScope !== null || storyboard.length === 0}
                onClick={() => handleExportZip('STORYBOARD')}
                className="p-4 rounded-xl bg-gala-obsidian/80 hover:bg-gala-surface/70 border border-gala-silver/20 text-left space-y-1.5 transition disabled:opacity-45"
              >
                <div className="flex items-center justify-between text-gala-gold">
                  <Film className="w-4 h-4" />
                  <Download className="w-3.5 h-3.5" />
                </div>
                <div className="text-xs font-semibold text-gala-ivory">
                  {exportingScope === 'STORYBOARD' ? 'Comprimiendo...' : 'ZIP Video Memoria'}
                </div>
                <div className="text-[11px] text-gala-muted">
                  {storyboard.length} archivos numerados (001...)
                </div>
              </button>

              <button
                type="button"
                disabled={exportingScope !== null || data.stats.aprobados_galeria === 0}
                onClick={() => handleExportZip('FIESTA')}
                className="p-4 rounded-xl bg-gala-obsidian/80 hover:bg-gala-surface/70 border border-gala-silver/20 text-left space-y-1.5 transition disabled:opacity-45"
              >
                <div className="flex items-center justify-between text-gala-gold">
                  <FolderArchive className="w-4 h-4" />
                  <Download className="w-3.5 h-3.5" />
                </div>
                <div className="text-xs font-semibold text-gala-ivory">
                  {exportingScope === 'FIESTA' ? 'Comprimiendo...' : 'ZIP Día de la Fiesta'}
                </div>
                <div className="text-[11px] text-gala-muted">
                  {data.stats.aprobados_galeria} fotos de mesas en vivo
                </div>
              </button>

              <button
                type="button"
                disabled={exportingScope !== null}
                onClick={() => handleExportZip('FOTOGRAFO')}
                className="p-4 rounded-xl bg-gala-obsidian/80 hover:bg-gala-surface/70 border border-gala-silver/20 text-left space-y-1.5 transition disabled:opacity-45"
              >
                <div className="flex items-center justify-between text-gala-gold">
                  <Camera className="w-4 h-4" />
                  <Download className="w-3.5 h-3.5" />
                </div>
                <div className="text-xs font-semibold text-gala-ivory">
                  {exportingScope === 'FOTOGRAFO' ? 'Comprimiendo...' : 'ZIP Fotógrafo Oficial'}
                </div>
                <div className="text-[11px] text-gala-muted">
                  Todas las tomas profesionales HD
                </div>
              </button>

              <button
                type="button"
                disabled={downloadingBackup}
                onClick={handleDownloadBackup}
                className="p-4 rounded-xl bg-gala-obsidian/80 hover:bg-gala-surface/70 border border-gala-gold/30 text-left space-y-1.5 transition disabled:opacity-45"
              >
                <div className="flex items-center justify-between text-gala-champagne">
                  <Database className="w-4 h-4 text-gala-gold" />
                  <Download className="w-3.5 h-3.5" />
                </div>
                <div className="text-xs font-semibold text-gala-champagne">
                  {downloadingBackup ? 'Exportando DB...' : 'Respaldo Base de Datos'}
                </div>
                <div className="text-[11px] text-gala-muted">
                  Copia íntegra SQLite (.db)
                </div>
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
                        width: `${currentRehearsalIsVideo
                            ? rehearsalVideoProgressPct
                            : rehearsalProgressPct
                          }%`,
                      }}
                    />
                  </div>
                </div>

                <div className="relative z-20 flex-1 min-h-0 px-4 sm:px-8 py-2 flex items-center justify-center overflow-hidden">
                  {currentRehearsalIsVideo ? (
                    <video
                      key={currentRehearsalItem.id}
                      ref={rehearsalVideoRef}
                      src={currentRehearsalItem.archivo_url}
                      autoPlay
                      muted
                      playsInline
                      controls
                      onTimeUpdate={(e) => {
                        const v = e.currentTarget;
                        if (v.duration && Number.isFinite(v.duration) && v.duration > 0) {
                          setRehearsalVideoProgressPct(
                            Math.min(100, (v.currentTime / v.duration) * 100)
                          );
                        }
                      }}
                      onEnded={() => {
                        if (rehearsalPlaying) {
                          setRehearsalProgressPct(0);
                          setRehearsalVideoProgressPct(0);
                          setRehearsalIndex((prev) => (prev + 1) % storyboard.length);
                        }
                      }}
                      className="max-h-full max-w-full object-contain rounded-2xl border border-gala-silver/35 shadow-2xl"
                    />
                  ) : (
                    <img
                      src={currentRehearsalItem.archivo_url}
                      alt={currentRehearsalItem.pie_de_foto}
                      className="max-h-full max-w-full object-contain rounded-2xl border border-gala-silver/35 shadow-2xl"
                    />
                  )}
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
