import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Film,
  Sparkles,
  Camera,
  ShieldCheck,
  UserCheck,
  LogOut,
  AlertCircle,
  RefreshCw,
  GraduationCap,
  QrCode,
  Plus,
  X,
} from 'lucide-react';
import { User, MediaItem, SystemConfig } from './types';
import {
  api,
  getStoredUser,
  getStoredToken,
  clearSession,
} from './services/api';
import { AmbientLeavesCanvas } from './components/AmbientLeavesCanvas';
import { AuthTypeaheadModal } from './components/AuthTypeaheadModal';
import { AdminDashboard } from './components/AdminDashboard';
import { LiveWallScreen } from './components/LiveWallScreen';
import { MemoryGallery } from './components/MemoryGallery';
import { PartyDaySection } from './components/PartyDaySection';
import { PhotographerSection } from './components/PhotographerSection';
import { StageBackground } from './components/StageBackground';
import { HeroBanner } from './components/HeroBanner';
import { useGalaConfirm } from './components/GalaConfirmModal';

type AppView =
  | 'MODO_MEMORIA'
  | 'DIA_DE_LA_FIESTA'
  | 'ALBUM_FOTOGRAFO'
  | 'ADMIN'
  | 'CARRUSEL_PANTALLA_GRANDE';

type GuestTabView = Exclude<AppView, 'CARRUSEL_PANTALLA_GRANDE' | 'ADMIN'>;
type TabView = Exclude<AppView, 'CARRUSEL_PANTALLA_GRANDE'>;

interface GuestTabDef {
  id: GuestTabView;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}

const GUEST_TABS: GuestTabDef[] = [
  { id: 'MODO_MEMORIA', label: 'Memorias', shortLabel: 'Memorias', icon: Film },
  { id: 'DIA_DE_LA_FIESTA', label: 'Día de la Fiesta', shortLabel: 'Fiesta', icon: Sparkles },
  { id: 'ALBUM_FOTOGRAFO', label: 'Fotógrafo', shortLabel: 'Fotógrafo', icon: Camera },
];

/** Texto de bienvenida que cambia según la fase del evento para que nadie se pierda. */
const PHASE_COPY: Record<
  string,
  { badge: string; title: string; text: string; cta: string; target: TabView }
> = {
  PRE_EVENTO: {
    badge: 'Antes de la fiesta',
    title: 'Ayúdanos a armar el video de nuestra generación',
    text: 'Sube tus mejores recuerdos de la carrera. Las organizadoras los revisarán y los pondrán en orden para el video de la noche.',
    cta: 'Ver y subir recuerdos',
    target: 'MODO_MEMORIA',
  },
  EN_VIVO: {
    badge: 'Esta noche · En Vivo',
    title: 'La fiesta está en marcha',
    text: 'Toma una foto desde tu mesa y mírala aparecer en la pantalla gigante del salón.',
    cta: 'Ir al Día de la Fiesta',
    target: 'DIA_DE_LA_FIESTA',
  },
  MEMORIA: {
    badge: 'Recuerdos para siempre',
    title: 'Gracias por ser parte de esta noche',
    text: 'Revive el video, la fiesta y las fotos del fotógrafo. Todo se puede descargar en su calidad original.',
    cta: 'Ver los recuerdos',
    target: 'MODO_MEMORIA',
  },
};

export const App: React.FC = () => {
  const confirm = useGalaConfirm();
  const [user, setUser] = useState<User | null>(() => getStoredUser());
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [publicItems, setPublicItems] = useState<MediaItem[]>([]);
  const [backendError, setBackendError] = useState<boolean>(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [ambientLeaves, setAmbientLeaves] = useState(true);

  const [heroCollapsed, setHeroCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem('gala_hero_collapsed') === '1';
  });

  const [uploadMemoryTrigger, setUploadMemoryTrigger] = useState(0);
  const [uploadPartyTrigger, setUploadPartyTrigger] = useState(0);
  const pendingUploadTargetRef = useRef<'MODO_MEMORIA' | 'DIA_DE_LA_FIESTA' | null>(null);

  const hasUserNavigatedRef = useRef(false);
  const initialAutoPhaseAppliedRef = useRef(false);

  const [activeView, setActiveView] = useState<AppView>(() => {
    if (window.location.pathname === '/pantalla-en-vivo') {
      return 'CARRUSEL_PANTALLA_GRANDE';
    }
    if (new URLSearchParams(window.location.search).get('mesa')) {
      return 'DIA_DE_LA_FIESTA';
    }
    return 'MODO_MEMORIA';
  });

  // Detección automática de Mesa escaneada por código QR (?mesa=Mesa+04)
  const [scannedMesa, setScannedMesa] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const m = params.get('mesa');
      if (m) {
        localStorage.setItem('gala_guest_mesa', m);
        localStorage.setItem('gala_qr_scanned', '1');
        return m;
      }
      return localStorage.getItem('gala_guest_mesa');
    }
    return null;
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mesaParam = params.get('mesa');
    if (mesaParam) {
      setScannedMesa(mesaParam);
      localStorage.setItem('gala_guest_mesa', mesaParam);
      localStorage.setItem('gala_qr_scanned', '1');
      hasUserNavigatedRef.current = true;
      setActiveView('DIA_DE_LA_FIESTA');
    }
  }, []);

  useEffect(() => {
    localStorage.removeItem('gala_livewall_offline_cache_v1');
  }, []);

  const fetchPublicState = useCallback(async () => {
    try {
      const res = await api.getPublicMediaAndConfig();
      setConfig(res.config);
      setPublicItems(res.items);
      setBackendError(false);

      // Si el usuario no ha navegado manualmente ni entró por URL especial, ir directo al apartado de la fase activa
      if (
        !initialAutoPhaseAppliedRef.current &&
        !hasUserNavigatedRef.current &&
        window.location.pathname !== '/pantalla-en-vivo'
      ) {
        initialAutoPhaseAppliedRef.current = true;
        if (res.config.fase_actual === 'EN_VIVO') {
          setActiveView('DIA_DE_LA_FIESTA');
        }
      }
    } catch {
      setBackendError(true);
    }
  }, []);

  const navigateView = (view: AppView) => {
    hasUserNavigatedRef.current = true;
    setActiveView(view);
    fetchPublicState();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (view === 'CARRUSEL_PANTALLA_GRANDE') {
      window.history.pushState({}, '', '/pantalla-en-vivo');
    } else if (window.location.pathname === '/pantalla-en-vivo') {
      window.history.pushState({}, '', '/');
    }
  };

  const toggleHeroCollapsed = () => {
    setHeroCollapsed((prev) => {
      const next = !prev;
      sessionStorage.setItem('gala_hero_collapsed', next ? '1' : '0');
      return next;
    });
  };

  const triggerUploadForTarget = (target: 'MODO_MEMORIA' | 'DIA_DE_LA_FIESTA') => {
    hasUserNavigatedRef.current = true;
    setActiveView(target);
    if (!heroCollapsed) {
      setHeroCollapsed(true);
      sessionStorage.setItem('gala_hero_collapsed', '1');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (target === 'DIA_DE_LA_FIESTA') {
      setUploadPartyTrigger((n) => n + 1);
    } else {
      setUploadMemoryTrigger((n) => n + 1);
    }
  };

  const handleQuickUploadClick = () => {
    const fase = config?.fase_actual || 'PRE_EVENTO';
    const target: 'MODO_MEMORIA' | 'DIA_DE_LA_FIESTA' =
      fase === 'EN_VIVO' ? 'DIA_DE_LA_FIESTA' : 'MODO_MEMORIA';

    if (!user) {
      pendingUploadTargetRef.current = target;
      setAuthModalOpen(true);
      return;
    }
    triggerUploadForTarget(target);
  };

  useEffect(() => {
    fetchPublicState();

    if (getStoredToken()) {
      api
        .getCurrentUser()
        .then((res) => setUser(res.user))
        .catch(() => {
          // Mantiene la sesión local si el fallo es de red
        });
    }

    const eventSource = new EventSource('/api/live/stream');
    eventSource.addEventListener('CONNECTED', () => {
      setBackendError(false);
      fetchPublicState();
    });
    eventSource.addEventListener('MEDIA_APPROVED', () => fetchPublicState());
    eventSource.addEventListener('MEDIA_MODERATED', () => fetchPublicState());
    eventSource.addEventListener('SEQUENCE_UPDATED', () => fetchPublicState());
    eventSource.addEventListener('CONFIG_UPDATED', () => fetchPublicState());
    eventSource.addEventListener('REACTION', (e) => {
      try {
        const payload = JSON.parse(e.data)?.payload;
        if (payload?.media_id && payload?.counts) {
          setPublicItems((prev) =>
            prev.map((item) =>
              item.id === payload.media_id
                ? {
                    ...item,
                    reacciones_corazon: payload.counts.corazon,
                    reacciones_estrella: payload.counts.estrella,
                    reacciones_total: payload.counts.total,
                  }
                : item
            )
          );
        }
      } catch {
        // Ignorar error de parsing
      }
    });

    const syncTimer = setInterval(fetchPublicState, 15000);

    const handlePopState = () => {
      setActiveView(
        window.location.pathname === '/pantalla-en-vivo'
          ? 'CARRUSEL_PANTALLA_GRANDE'
          : 'MODO_MEMORIA'
      );
      fetchPublicState();
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      eventSource.close();
      clearInterval(syncTimer);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [fetchPublicState]);

  const handleLogout = async () => {
    const ok = await confirm({
      title: '¿Cerrar sesión?',
      description: 'Saldrás de tu perfil actual. Podrás volver a entrar cuando quieras con tu nombre y PIN.',
      confirmText: 'Sí, salir',
      variant: 'warning',
    });
    if (!ok) return;
    clearSession();
    setUser(null);
    if (activeView === 'ADMIN') setActiveView('MODO_MEMORIA');
  };

  // Contadores exactos por estatus (coinciden con el panel de organizadoras)
  const counts: Record<GuestTabView, number> = {
    MODO_MEMORIA: publicItems.filter((i) => i.estado === 'APROBADO_VIDEO').length,
    DIA_DE_LA_FIESTA: publicItems.filter((i) => i.estado === 'APROBADO_GALERIA').length,
    ALBUM_FOTOGRAFO: publicItems.filter(
      (i) =>
        i.estado === 'APROBADO_FOTOGRAFO' ||
        (i.origen === 'FOTOGRAFO' &&
          i.estado !== 'APROBADO_VIDEO' &&
          i.estado !== 'APROBADO_GALERIA')
    ).length,
  };

  if (activeView === 'CARRUSEL_PANTALLA_GRANDE') {
    return <LiveWallScreen onExit={() => navigateView('DIA_DE_LA_FIESTA')} />;
  }

  const phase = PHASE_COPY[config?.fase_actual || 'PRE_EVENTO'];
  const firstName = user?.nombre_completo.split(' ')[0];
  const isAdminUser = user?.rol === 'ADMIN';
  const canQuickUpload =
    (config?.fase_actual !== 'MEMORIA' && config?.subidas_abiertas !== false) ||
    isAdminUser;

  return (
    <div className="min-h-screen text-gala-ivory flex flex-col pb-24 md:pb-10 relative">
      {/* Fondo animado y estrellas */}
      <StageBackground />
      <AmbientLeavesCanvas enabled={ambientLeaves} density="subtle" />

      {backendError && (
        <div className="relative z-40 bg-gala-rose/15 border-b border-gala-rose/40 px-4 py-2 text-xs text-gala-rose flex items-center justify-center gap-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Reconectando con el servidor...</span>
          <button
            type="button"
            onClick={fetchPublicState}
            className="px-2.5 py-1 rounded-lg bg-gala-rose/20 hover:bg-gala-rose/30 font-medium flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" /> Reintentar
          </button>
        </div>
      )}

      {/* ENCABEZADO LIMPIO Y COMPACTO */}
      <header className="sticky top-0 z-30 glass !rounded-none !border-x-0 !border-t-0">
        <div className="max-w-6xl mx-auto px-3.5 sm:px-6 h-16 sm:h-[70px] flex items-center justify-between gap-2.5 sm:gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() =>
                navigateView(
                  config?.fase_actual === 'EN_VIVO' ? 'DIA_DE_LA_FIESTA' : 'MODO_MEMORIA'
                )
              }
              className="flex items-center gap-2.5 sm:gap-3 min-w-0 text-left"
              aria-label="Ir al inicio"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl btn-gold flex items-center justify-center shrink-0">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[9.5px] sm:text-[10px] uppercase tracking-[0.16em] sm:tracking-[0.22em] text-gala-silver/85 font-semibold truncate">
                  Generación 2022 – 2026
                </div>
                <h1 className="font-display font-bold text-sm sm:text-xl leading-tight text-gala-ivory truncate">
                  Graduación <span className="text-shimmer">TECNM</span>
                </h1>
              </div>
            </button>

            {/* Píldora integrada de Mesa QR (ahorra el banner superior completo) */}
            {scannedMesa && (
              <div className="hidden sm:inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full bg-gala-gold/15 border border-gala-gold/40 text-[11px] text-gala-champagne shrink-0">
                <QrCode className="w-3.5 h-3.5 text-gala-gold" />
                <span className="font-semibold">{scannedMesa}</span>
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await confirm({
                      title: '¿Desvincular mesa?',
                      description: `Dejarás de estar vinculado a ${scannedMesa}. Puedes volver a escanear el código QR de tu mesa en cualquier momento.`,
                      confirmText: 'Sí, desvincular',
                      variant: 'warning',
                    });
                    if (!ok) return;
                    setScannedMesa(null);
                    localStorage.removeItem('gala_guest_mesa');
                    localStorage.removeItem('gala_qr_scanned');
                  }}
                  className="p-0.5 rounded-full hover:bg-gala-obsidian/40 text-gala-silver/80 hover:text-gala-ivory transition"
                  title="Desvincular mesa QR"
                  aria-label="Cambiar de mesa"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {/* Navegación escritorio enfocada 100% en invitados */}
          <nav
            className="hidden md:flex items-center gap-1 p-1 rounded-2xl bg-gala-obsidian/60 border border-gala-silver/20"
            aria-label="Apartados principales"
          >
            {GUEST_TABS.map((tab) => {
              const active = activeView === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => navigateView(tab.id)}
                  className={`relative px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                    active ? 'text-gala-obsidian' : 'text-gala-silver hover:text-gala-ivory'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="desktop-tab-pill"
                      className="absolute inset-0 rounded-xl btn-gold"
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    />
                  )}
                  <Icon className="w-3.5 h-3.5 relative z-10" />
                  <span className="relative z-10">{tab.label}</span>
                  <span
                    className={`relative z-10 min-w-[20px] px-1.5 py-0.5 rounded-full text-[10px] font-mono tabular-nums text-center ${
                      active
                        ? 'bg-gala-obsidian/15'
                        : 'bg-gala-gold/15 text-gala-champagne'
                    }`}
                  >
                    {counts[tab.id]}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Controles derechos: Mesa móvil, Comité discreto, Estrellas, Sesión */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {scannedMesa && (
              <div className="sm:hidden inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gala-gold/15 border border-gala-gold/40 text-[10px] font-semibold text-gala-champagne">
                <QrCode className="w-3 h-3 text-gala-gold" />
                <span className="max-w-[58px] truncate">{scannedMesa}</span>
              </div>
            )}

            <button
              type="button"
              onClick={() => navigateView('ADMIN')}
              className={`p-2 sm:px-2.5 sm:py-2 rounded-xl border flex items-center gap-1.5 text-xs font-semibold transition ${
                activeView === 'ADMIN'
                  ? 'btn-gold border-gala-gold text-gala-obsidian'
                  : isAdminUser
                  ? 'bg-gala-gold/15 border-gala-gold/45 text-gala-champagne hover:bg-gala-gold/25'
                  : 'bg-gala-obsidian/50 border-gala-silver/20 text-gala-muted hover:text-gala-ivory hover:border-gala-silver/40'
              }`}
              title="Panel de Organizadoras / Comité"
              aria-label="Panel de Organizadoras"
            >
              <ShieldCheck className="w-4 h-4" />
              {isAdminUser && <span className="hidden lg:inline">Comité</span>}
            </button>

            <button
              type="button"
              onClick={() => setAmbientLeaves((prev) => !prev)}
              className={`p-2 sm:p-2.5 rounded-xl border transition ${
                ambientLeaves
                  ? 'bg-gala-gold/15 border-gala-gold/40 text-gala-champagne'
                  : 'bg-gala-velvet border-gala-silver/20 text-gala-muted'
              }`}
              title={ambientLeaves ? 'Apagar estrellas animadas' : 'Encender estrellas animadas'}
              aria-label="Encender o apagar cielo estrellado"
            >
              <Sparkles className="w-4 h-4" />
            </button>

            {user ? (
              <div className="flex items-center gap-1 bg-gala-obsidian/65 pl-2.5 sm:pl-3 pr-1 py-1 rounded-xl border border-gala-gold/25">
                <div className="text-right hidden sm:block leading-tight mr-1">
                  <div className="text-xs font-semibold text-gala-ivory">{firstName}</div>
                  <div className="text-[10px] text-gala-gold">
                    {user.rol === 'ADMIN' ? 'Organizadora' : user.mesa || 'Invitado'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAuthModalOpen(true)}
                  className="px-2 py-1.5 rounded-lg bg-gala-surface hover:bg-gala-card text-[11px] text-gala-champagne border border-gala-gold/20"
                >
                  Cambiar
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="p-1.5 rounded-lg text-gala-muted hover:text-gala-rose"
                  title="Salir"
                  aria-label="Cerrar sesión"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="btn-gold px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl font-semibold text-xs flex items-center gap-1.5 animate-glow-pulse"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Entrar</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="relative z-20 flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 pt-4 sm:pt-6">
        {/* BIENVENIDA: compacta cuando navegas o en la fiesta, monumental expandible en Memorias */}
        {activeView !== 'ADMIN' && (
          <HeroBanner
            key={`${
              activeView === 'MODO_MEMORIA' && !heroCollapsed ? 'full' : 'compact'
            }-${config?.fase_actual}`}
            phase={phase}
            firstName={firstName}
            compact={activeView !== 'MODO_MEMORIA' || heroCollapsed}
            canExpand={activeView === 'MODO_MEMORIA'}
            onToggleCompact={toggleHeroCollapsed}
            showCta={activeView !== phase.target}
            onCta={() => navigateView(phase.target)}
          />
        )}

        {/* Cambio de apartado con transición suave */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeView}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            {activeView === 'MODO_MEMORIA' && (
              <MemoryGallery
                items={publicItems}
                config={config}
                currentUser={user}
                onRequireAuth={() => setAuthModalOpen(true)}
                onRefresh={fetchPublicState}
                openUploadTrigger={uploadMemoryTrigger}
              />
            )}

            {activeView === 'DIA_DE_LA_FIESTA' && (
              <PartyDaySection
                items={publicItems}
                config={config}
                currentUser={user}
                onRequireAuth={() => setAuthModalOpen(true)}
                onOpenFullCarousel={() => navigateView('CARRUSEL_PANTALLA_GRANDE')}
                onRefresh={fetchPublicState}
                openUploadTrigger={uploadPartyTrigger}
              />
            )}

            {activeView === 'ALBUM_FOTOGRAFO' && (
              <PhotographerSection
                items={publicItems}
                currentUser={user}
                onRefresh={fetchPublicState}
              />
            )}

            {activeView === 'ADMIN' &&
              (user?.rol === 'ADMIN' ? (
                <AdminDashboard onConfigChanged={fetchPublicState} />
              ) : (
                <div className="max-w-md mx-auto py-12 text-center space-y-4 glass glass-ornate rounded-3xl p-8">
                  <div className="w-14 h-14 mx-auto rounded-2xl btn-gold flex items-center justify-center animate-float">
                    <ShieldCheck className="w-7 h-7" />
                  </div>
                  <h2 className="font-display text-2xl sm:text-3xl text-gala-ivory">
                    Solo para organizadoras
                  </h2>
                  <p className="text-sm text-gala-parchment/85 leading-relaxed">
                    Aquí se aprueban las fotos, se ordena el video y se ayuda a quien olvidó su PIN. Entra con tu cuenta del comité.
                  </p>
                  <button
                    type="button"
                    onClick={() => setAuthModalOpen(true)}
                    className="btn-gold px-6 py-3 rounded-xl font-semibold text-sm"
                  >
                    Entrar como organizadora
                  </button>
                </div>
              ))}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* NAVEGACIÓN INFERIOR PARA CELULAR: Enfocada en Invitados + Botón Subir */}
      <nav
        className={`md:hidden fixed bottom-3 inset-x-3 z-40 glass rounded-2xl grid ${
          canQuickUpload ? 'grid-cols-4' : 'grid-cols-3'
        } gap-1 p-1.5 shadow-2xl`}
        aria-label="Apartados"
      >
        {GUEST_TABS.slice(0, 2).map((tab) => {
          const active = activeView === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => navigateView(tab.id)}
              className={`relative py-2 rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold ${
                active ? 'text-gala-obsidian' : 'text-gala-silver/85'
              }`}
            >
              {active && (
                <motion.span
                  layoutId="mobile-tab-pill"
                  className="absolute inset-0 rounded-xl btn-gold"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1">
                <Icon className="w-[18px] h-[18px]" />
                <span className="text-[10px] font-mono tabular-nums">{counts[tab.id]}</span>
              </span>
              <span className="relative z-10">{tab.shortLabel}</span>
            </button>
          );
        })}

        {canQuickUpload && (
          <button
            type="button"
            onClick={handleQuickUploadClick}
            className="relative py-2 rounded-xl btn-gold text-gala-obsidian flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold shadow-lg"
            aria-label="Subir foto rápida"
          >
            <Plus className="w-[18px] h-[18px] stroke-[2.5]" />
            <span>Subir</span>
          </button>
        )}

        {GUEST_TABS.slice(2).map((tab) => {
          const active = activeView === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => navigateView(tab.id)}
              className={`relative py-2 rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold ${
                active ? 'text-gala-obsidian' : 'text-gala-silver/85'
              }`}
            >
              {active && (
                <motion.span
                  layoutId="mobile-tab-pill"
                  className="absolute inset-0 rounded-xl btn-gold"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1">
                <Icon className="w-[18px] h-[18px]" />
                <span className="text-[10px] font-mono tabular-nums">{counts[tab.id]}</span>
              </span>
              <span className="relative z-10">{tab.shortLabel}</span>
            </button>
          );
        })}
      </nav>

      <AuthTypeaheadModal
        isOpen={authModalOpen}
        onClose={() => {
          pendingUploadTargetRef.current = null;
          setAuthModalOpen(false);
        }}
        onSuccess={(loggedInUser) => {
          setUser(loggedInUser);
          setAuthModalOpen(false);
          fetchPublicState();
          if (pendingUploadTargetRef.current) {
            const target = pendingUploadTargetRef.current;
            pendingUploadTargetRef.current = null;
            triggerUploadForTarget(target);
          }
        }}
      />
    </div>
  );
};
