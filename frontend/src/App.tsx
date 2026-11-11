import React, { useState, useEffect, useCallback } from 'react';
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

type AppView =
  | 'MODO_MEMORIA'
  | 'DIA_DE_LA_FIESTA'
  | 'ALBUM_FOTOGRAFO'
  | 'ADMIN'
  | 'CARRUSEL_PANTALLA_GRANDE';

type TabView = Exclude<AppView, 'CARRUSEL_PANTALLA_GRANDE'>;

interface TabDef {
  id: TabView;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TABS: TabDef[] = [
  { id: 'MODO_MEMORIA', label: 'Modo Memoria', shortLabel: 'Memoria', icon: Film },
  { id: 'DIA_DE_LA_FIESTA', label: 'Día de la Fiesta', shortLabel: 'Fiesta', icon: Sparkles },
  { id: 'ALBUM_FOTOGRAFO', label: 'Álbum Fotógrafo', shortLabel: 'Fotógrafo', icon: Camera },
  { id: 'ADMIN', label: 'Organizadoras', shortLabel: 'Comité', icon: ShieldCheck },
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
    badge: 'Esta noche',
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
  const [user, setUser] = useState<User | null>(() => getStoredUser());
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [publicItems, setPublicItems] = useState<MediaItem[]>([]);
  const [backendError, setBackendError] = useState<boolean>(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [ambientLeaves, setAmbientLeaves] = useState(true);

  const [activeView, setActiveView] = useState<AppView>(() => {
    if (window.location.pathname === '/pantalla-en-vivo') {
      return 'CARRUSEL_PANTALLA_GRANDE';
    }
    return 'MODO_MEMORIA';
  });

  useEffect(() => {
    localStorage.removeItem('gala_livewall_offline_cache_v1');
  }, []);

  const fetchPublicState = useCallback(async () => {
    try {
      const res = await api.getPublicMediaAndConfig();
      setConfig(res.config);
      setPublicItems(res.items);
      setBackendError(false);
    } catch {
      setBackendError(true);
    }
  }, []);

  const navigateView = (view: AppView) => {
    setActiveView(view);
    fetchPublicState();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (view === 'CARRUSEL_PANTALLA_GRANDE') {
      window.history.pushState({}, '', '/pantalla-en-vivo');
    } else if (window.location.pathname === '/pantalla-en-vivo') {
      window.history.pushState({}, '', '/');
    }
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

  const handleLogout = () => {
    clearSession();
    setUser(null);
    if (activeView === 'ADMIN') setActiveView('MODO_MEMORIA');
  };

  // Contadores exactos por estatus (coinciden con el panel de organizadoras)
  const counts: Record<TabView, number | null> = {
    MODO_MEMORIA: publicItems.filter((i) => i.estado === 'APROBADO_VIDEO').length,
    DIA_DE_LA_FIESTA: publicItems.filter((i) => i.estado === 'APROBADO_GALERIA').length,
    ALBUM_FOTOGRAFO: publicItems.filter(
      (i) =>
        i.estado === 'APROBADO_FOTOGRAFO' ||
        (i.origen === 'FOTOGRAFO' &&
          i.estado !== 'APROBADO_VIDEO' &&
          i.estado !== 'APROBADO_GALERIA')
    ).length,
    ADMIN: null,
  };

  if (activeView === 'CARRUSEL_PANTALLA_GRANDE') {
    return <LiveWallScreen onExit={() => navigateView('DIA_DE_LA_FIESTA')} />;
  }

  const phase = PHASE_COPY[config?.fase_actual || 'PRE_EVENTO'];
  const firstName = user?.nombre_completo.split(' ')[0];

  return (
    <div className="min-h-screen text-gala-ivory flex flex-col pb-24 md:pb-10 relative">
      {/* Fondo animado y hojas */}
      <StageBackground />
      <AmbientLeavesCanvas enabled={ambientLeaves} density="subtle" />

      {backendError && (
        <div className="relative z-40 bg-gala-rose/15 border-b border-gala-rose/40 px-4 py-2.5 text-xs text-gala-rose flex items-center justify-center gap-3">
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

      {/* ENCABEZADO */}
      <header className="sticky top-0 z-30 glass !rounded-none !border-x-0 !border-t-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 sm:h-[72px] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigateView('MODO_MEMORIA')}
            className="flex items-center gap-3 min-w-0 text-left"
            aria-label="Ir al inicio"
          >
            <div className="w-10 h-10 rounded-xl btn-gold flex items-center justify-center shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.16em] sm:tracking-[0.22em] text-gala-silver font-semibold truncate">
                Generación 2022 – 2026
              </div>
              <h1 className="font-serif text-base sm:text-2xl leading-tight text-gala-ivory truncate">
                Graduación <span className="text-shimmer">TECNM</span>
              </h1>
            </div>
          </button>

          {/* Navegación escritorio con indicador que se desliza */}
          <nav className="hidden md:flex items-center gap-1 p-1 rounded-2xl bg-gala-obsidian/60 border border-gala-silver/25">
            {TABS.map((tab) => {
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
                  {counts[tab.id] !== null && (
                    <span
                      className={`relative z-10 min-w-[20px] px-1.5 py-0.5 rounded-full text-[10px] font-mono text-center ${
                        active
                          ? 'bg-gala-obsidian/15'
                          : 'bg-gala-gold/15 text-gala-champagne'
                      }`}
                    >
                      {counts[tab.id]}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setAmbientLeaves((prev) => !prev)}
              className={`p-2.5 rounded-xl border ${
                ambientLeaves
                  ? 'bg-gala-gold/15 border-gala-gold/45 text-gala-champagne'
                  : 'bg-gala-velvet border-gala-silver/20 text-gala-muted'
              }`}
              title={ambientLeaves ? 'Apagar estrellas animadas' : 'Encender estrellas animadas'}
              aria-label="Encender o apagar cielo estrellado"
            >
              <Sparkles className="w-4 h-4" />
            </button>

            {user ? (
              <div className="flex items-center gap-1.5 bg-gala-obsidian/60 pl-3 pr-1.5 py-1.5 rounded-xl border border-gala-gold/25">
                <div className="text-right hidden sm:block leading-tight">
                  <div className="text-xs font-semibold text-gala-ivory">{firstName}</div>
                  <div className="text-[10px] text-gala-gold">
                    {user.rol === 'ADMIN' ? 'Organizadora' : user.mesa || 'Invitado'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAuthModalOpen(true)}
                  className="px-2.5 py-1.5 rounded-lg bg-gala-surface hover:bg-gala-card text-[11px] text-gala-champagne border border-gala-gold/25"
                >
                  Cambiar
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="p-2 rounded-lg text-gala-muted hover:text-gala-rose"
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
                className="btn-gold px-4 py-2.5 rounded-xl font-semibold text-xs flex items-center gap-1.5 animate-glow-pulse"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Entrar</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="relative z-20 flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 pt-6 sm:pt-8">
        {/* BIENVENIDA: explica en una frase qué hacer según la fase */}
        {activeView !== 'ADMIN' && (
          <HeroBanner
            key={`${activeView === 'MODO_MEMORIA' ? 'full' : 'compact'}-${config?.fase_actual}`}
            phase={phase}
            firstName={firstName}
            compact={activeView !== 'MODO_MEMORIA'}
            showCta={activeView !== phase.target}
            onCta={() => navigateView(phase.target)}
          />
        )}

        {/* Cambio de apartado con transición suave */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeView}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            {activeView === 'MODO_MEMORIA' && (
              <MemoryGallery
                items={publicItems}
                config={config}
                currentUser={user}
                onRequireAuth={() => setAuthModalOpen(true)}
                onRefresh={fetchPublicState}
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
                <div className="max-w-md mx-auto py-12 text-center space-y-4 glass rounded-3xl p-8">
                  <div className="w-14 h-14 mx-auto rounded-2xl btn-gold flex items-center justify-center animate-float">
                    <ShieldCheck className="w-7 h-7" />
                  </div>
                  <h2 className="font-serif text-3xl text-gala-ivory">
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

      {/* NAVEGACIÓN INFERIOR PARA CELULAR */}
      <nav
        className="md:hidden fixed bottom-3 inset-x-3 z-40 glass rounded-2xl grid grid-cols-4 p-1.5"
        aria-label="Apartados"
      >
        {TABS.map((tab) => {
          const active = activeView === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => navigateView(tab.id)}
              className={`relative py-2 rounded-xl flex flex-col items-center gap-0.5 text-[10px] font-semibold ${
                active ? 'text-gala-obsidian' : 'text-gala-muted'
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
                {counts[tab.id] !== null && (
                  <span className="text-[10px] font-mono">{counts[tab.id]}</span>
                )}
              </span>
              <span className="relative z-10">{tab.shortLabel}</span>
            </button>
          );
        })}
      </nav>

      <AuthTypeaheadModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={(loggedInUser) => {
          setUser(loggedInUser);
          setAuthModalOpen(false);
          fetchPublicState();
        }}
      />
    </div>
  );
};
