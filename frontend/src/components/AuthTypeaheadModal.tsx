import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  KeyRound,
  UserCheck,
  ShieldCheck,
  ChevronRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Users,
  QrCode,
} from 'lucide-react';
import { User } from '../types';
import { api, saveSession } from '../services/api';
import { normalizeClientText } from '../utils/imageCompression';

interface AuthTypeaheadModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onSuccess: (user: User) => void;
}

export const AuthTypeaheadModal: React.FC<AuthTypeaheadModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modo de ingreso: Alumno del padrón o Acompañante de Mesa (QR)
  const [authMode, setAuthMode] = useState<'STUDENT' | 'GUEST'>('STUDENT');
  const [guestName, setGuestName] = useState('');
  const [guestMesa, setGuestMesa] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('gala_guest_mesa') || 'Mesa 01';
    }
    return 'Mesa 01';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('gala_guest_mesa');
      if (saved) setGuestMesa(saved);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    api
      .searchUsers('')
      .then((res) => setAllUsers(res.users))
      .catch(() => setError('No fue posible cargar el padrón oficial de invitados.'));
  }, [isOpen]);

  const filteredUsers = useMemo(() => {
    const q = normalizeClientText(searchQuery);
    if (!q) return allUsers.slice(0, 8);
    const terms = q.split(' ').filter(Boolean);
    return allUsers.filter((u) => {
      const target = normalizeClientText(
        `${u.nombre_completo} ${u.distintivo_homonimo || ''} ${u.mesa || ''}`
      );
      return terms.every((t) => target.includes(t));
    });
  }, [allUsers, searchQuery]);

  const handleSelectUser = (user: User) => {
    setSelectedUser(user);
    setPin('');
    setConfirmPin('');
    setError(null);
  };

  const handleQuickDemoSelect = (targetId: string, presetPin?: string) => {
    const found = allUsers.find((u) => u.id === targetId);
    if (found) {
      setSelectedUser(found);
      setPin(presetPin || '');
      setConfirmPin(presetPin || '');
      setError(null);
    }
  };

  const handleSubmitPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    if (!/^\d{4}$/.test(pin)) {
      setError('El PIN debe estar formado exactamente por 4 dígitos numéricos.');
      return;
    }

    if (!selectedUser.tiene_pin && pin !== confirmPin) {
      setError('Los 4 dígitos de confirmación no coinciden con el PIN elegido.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await api.verifyOrCreatePin(selectedUser.id, pin);
      saveSession(res.token, res.user);
      onSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Error al validar tu acceso.');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = guestName.trim();
    if (!cleanName) {
      setError('Por favor escribe tu nombre o el de tu familia.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.guestAccess(cleanName, guestMesa);
      saveSession(res.token, res.user);
      onSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Error al iniciar acceso como invitado.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-gala-obsidian/85 backdrop-blur-md p-0 sm:p-4">
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="w-full max-w-lg bg-gala-velvet border-t sm:border border-gala-gold/30 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
      >
        {/* Cabecera Editorial */}
        <div className="px-6 pt-6 pb-4 border-b border-gala-gold/15 bg-gradient-to-b from-gala-surface to-gala-velvet">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-[0.25em] text-gala-gold font-medium">
              Padrón Oficial de Generación
            </span>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="text-xs text-gala-muted hover:text-gala-ivory px-2 py-1 rounded border border-gala-gold/20"
              >
                Cerrar
              </button>
            )}
          </div>
          <h2 className="font-serif text-2xl sm:text-3xl text-gala-ivory mt-1 font-normal">
            {selectedUser
              ? 'Confirmación de Identidad'
              : authMode === 'GUEST'
              ? 'Acceso Rápido de Mesa'
              : 'Identifícate en la Lista'}
          </h2>
          <p className="text-xs sm:text-sm text-gala-parchment/80 mt-1">
            {selectedUser
              ? selectedUser.tiene_pin
                ? 'Ingresa tu PIN personal de 4 dígitos para continuar.'
                : 'Primer ingreso detectado: crea un PIN de 4 dígitos para proteger tus subidas.'
              : authMode === 'GUEST'
              ? 'Si eres acompañante o familiar, no necesitas PIN. Ingresa tu nombre para comenzar.'
              : 'Busca tu nombre en la lista sin necesidad de matrícula ni correo electrónico.'}
          </p>
        </div>

        {/* Contenido dinámico */}
        <div className="p-6 overflow-y-auto space-y-5">
          <AnimatePresence mode="wait">
            {!selectedUser ? (
              <motion.div
                key="step-search"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                className="space-y-4"
              >
                {/* Selector de Modo: Alumno o Acompañante de Mesa (QR) */}
                <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-gala-obsidian border border-gala-gold/25">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('STUDENT');
                      setError(null);
                    }}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold transition ${
                      authMode === 'STUDENT'
                        ? 'bg-gala-gold text-gala-obsidian shadow'
                        : 'text-gala-silver hover:text-gala-ivory'
                    }`}
                  >
                    Alumno / Graduado
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('GUEST');
                      setError(null);
                    }}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
                      authMode === 'GUEST'
                        ? 'bg-gala-gold text-gala-obsidian shadow'
                        : 'text-gala-silver hover:text-gala-ivory'
                    }`}
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>Acompañante de Mesa</span>
                  </button>
                </div>

                {authMode === 'GUEST' ? (
                  /* Formulario de Acompañante de Mesa */
                  <form onSubmit={handleGuestSubmit} className="space-y-4 pt-1">
                    <div className="p-3.5 rounded-xl bg-gala-obsidian/90 border border-gala-gold/30 space-y-1">
                      <div className="text-xs text-gala-champagne font-semibold flex items-center gap-1.5">
                        <QrCode className="w-4 h-4 text-gala-gold" />
                        Acceso por Código QR de Mesa
                      </div>
                      <p className="text-[11px] text-gala-silver/80">
                        Como acompañante o familiar no requieres PIN. Tus fotos se proyectarán en la pantalla con el distintivo de tu mesa.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs uppercase tracking-wider text-gala-gold mb-1.5">
                        Tu Nombre o el de tu Familia
                      </label>
                      <input
                        type="text"
                        required
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        placeholder="Ej. Familia Morales, Carlos Vega, etc."
                        className="w-full px-4 py-3 bg-gala-obsidian border border-gala-gold/30 rounded-xl text-sm text-gala-ivory placeholder:text-gala-muted focus:outline-none focus:border-gala-gold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs uppercase tracking-wider text-gala-gold mb-1.5">
                        Mesa Asignada
                      </label>
                      <input
                        type="text"
                        required
                        value={guestMesa}
                        onChange={(e) => setGuestMesa(e.target.value)}
                        placeholder="Ej. Mesa 04"
                        className="w-full px-4 py-3 bg-gala-obsidian border border-gala-gold/30 rounded-xl text-sm text-gala-ivory font-mono focus:outline-none focus:border-gala-gold"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading || !guestName.trim()}
                      className="w-full py-3.5 rounded-xl btn-gold text-gala-obsidian font-bold text-sm shadow-xl hover:scale-[1.01] transition disabled:opacity-40"
                    >
                      {loading ? 'Accediendo...' : 'Entrar a la Fiesta sin PIN'}
                    </button>
                  </form>
                ) : (
                  <>
                    {/* Buscador Predictivo Typeahead para Alumnos */}
                    <div className="relative">
                      <Search className="w-4 h-4 text-gala-gold absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Escribe tu nombre o apellido (ej. maria, alejandro, sofia)..."
                        autoFocus
                        className="w-full pl-11 pr-4 py-3.5 bg-gala-obsidian border border-gala-gold/30 rounded-xl text-sm text-gala-ivory placeholder:text-gala-muted focus:outline-none focus:border-gala-gold transition"
                      />
                    </div>

                {/* Lista de Coincidencias con Distintivo Homónimo */}
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {filteredUsers.length === 0 ? (
                    <div className="text-center py-8 border border-dashed border-gala-gold/20 rounded-xl">
                      <Users className="w-6 h-6 text-gala-muted mx-auto mb-2" />
                      <p className="text-sm text-gala-parchment">
                        No se encontraron coincidencias para "{searchQuery}".
                      </p>
                      <p className="text-xs text-gala-muted mt-1">
                        Intenta buscar únicamente por tu primer apellido.
                      </p>
                    </div>
                  ) : (
                    filteredUsers.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => handleSelectUser(u)}
                        className="w-full text-left p-3.5 rounded-xl bg-gala-surface/80 hover:bg-gala-card border border-gala-gold/15 hover:border-gala-gold/45 transition flex items-center justify-between group"
                      >
                        <div className="pr-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm sm:text-base text-gala-ivory group-hover:text-gala-champagne transition">
                              {u.nombre_completo}
                            </span>
                            {u.rol === 'ADMIN' && (
                              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-gala-gold/20 text-gala-champagne border border-gala-gold/40">
                                <ShieldCheck className="w-3 h-3" /> Comité
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-gala-parchment/75">
                            <span>{u.distintivo_homonimo || 'Graduado'}</span>
                            {u.mesa && (
                              <>
                                <span className="text-gala-gold/50">·</span>
                                <span className="text-gala-gold/90">{u.mesa}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`text-[11px] px-2.5 py-1 rounded-md border ${
                              u.tiene_pin
                                ? 'bg-gala-obsidian/80 border-gala-gold/25 text-gala-parchment'
                                : 'bg-gala-gold/10 border-gala-gold/40 text-gala-champagne'
                            }`}
                          >
                            {u.tiene_pin ? 'PIN activo' : 'Crear PIN'}
                          </span>
                          <ChevronRight className="w-4 h-4 text-gala-gold group-hover:translate-x-0.5 transition" />
                        </div>
                      </button>
                    ))
                  )}
                </div>

                {/* Atajos de Prueba Rápida para Desarrollo */}
                <div className="pt-3 border-t border-gala-gold/15">
                  <p className="text-[11px] uppercase tracking-wider text-gala-muted mb-2">
                    Accesos rápidos para prueba inmediata:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => handleQuickDemoSelect('usr-maria-ind')}
                      className="text-left p-2.5 rounded-lg bg-gala-obsidian border border-gala-gold/20 hover:border-gala-gold/50 text-xs transition"
                    >
                      <div className="font-medium text-gala-champagne">Alumno Homónimo</div>
                      <div className="text-[11px] text-gala-muted truncate">
                        María F. López (Primer ingreso)
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickDemoSelect('usr-alejandro', '1234')}
                      className="text-left p-2.5 rounded-lg bg-gala-obsidian border border-gala-gold/20 hover:border-gala-gold/50 text-xs transition"
                    >
                      <div className="font-medium text-gala-champagne">Alumno con PIN</div>
                      <div className="text-[11px] text-gala-muted truncate">
                        Alejandro M. (PIN: 1234)
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickDemoSelect('usr-admin-sofia', '2026')}
                      className="text-left p-2.5 rounded-lg bg-gala-obsidian border border-gala-gold/20 hover:border-gala-gold/50 text-xs transition"
                    >
                      <div className="font-medium text-gala-champagne">Organizadora Admin</div>
                      <div className="text-[11px] text-gala-muted truncate">
                        Sofía V. (PIN: 2026)
                      </div>
                    </button>
                  </div>
                </div>
              </>
            )}
          </motion.div>
            ) : (
              <motion.form
                key="step-pin"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                onSubmit={handleSubmitPin}
                className="space-y-5"
              >
                {/* Tarjeta del Invitado Seleccionado */}
                <div className="p-4 rounded-xl bg-gala-obsidian border border-gala-gold/30 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-widest text-gala-gold">
                      {selectedUser.rol === 'ADMIN' ? 'Comité Organizador' : 'Invitado Oficial'}
                    </div>
                    <div className="font-serif text-xl text-gala-ivory mt-0.5">
                      {selectedUser.nombre_completo}
                    </div>
                    <div className="text-xs text-gala-parchment/80 mt-0.5">
                      {selectedUser.distintivo_homonimo}
                      {selectedUser.mesa ? ` · ${selectedUser.mesa}` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedUser(null)}
                    className="inline-flex items-center gap-1 text-xs text-gala-gold hover:text-gala-champagne px-2.5 py-1.5 rounded-lg border border-gala-gold/25 shrink-0"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Cambiar
                  </button>
                </div>

                {/* Campos de PIN de 4 dígitos */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-gala-parchment mb-2">
                      {selectedUser.tiene_pin
                        ? 'Ingresa tu PIN de 4 dígitos'
                        : 'Define tu nuevo PIN de 4 dígitos'}
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-gala-gold absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={4}
                        pattern="\d{4}"
                        value={pin}
                        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="0000"
                        autoFocus
                        required
                        className="w-full pl-11 pr-4 py-3.5 bg-gala-obsidian border border-gala-gold/35 rounded-xl font-mono text-xl tracking-[0.5em] text-center text-gala-ivory focus:outline-none focus:border-gala-gold"
                      />
                    </div>
                  </div>

                  {!selectedUser.tiene_pin && (
                    <div>
                      <label className="block text-xs uppercase tracking-wider text-gala-parchment mb-2">
                        Confirma tus 4 dígitos
                      </label>
                      <div className="relative">
                        <CheckCircle2 className="w-4 h-4 text-gala-gold absolute left-4 top-1/2 -translate-y-1/2" />
                        <input
                          type="password"
                          inputMode="numeric"
                          maxLength={4}
                          pattern="\d{4}"
                          value={confirmPin}
                          onChange={(e) =>
                            setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))
                          }
                          placeholder="0000"
                          required
                          className="w-full pl-11 pr-4 py-3.5 bg-gala-obsidian border border-gala-gold/35 rounded-xl font-mono text-xl tracking-[0.5em] text-center text-gala-ivory focus:outline-none focus:border-gala-gold"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {error && (
                  <div className="p-3.5 rounded-xl bg-red-950/60 border border-red-500/40 flex items-start gap-2.5 text-xs text-red-200">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || pin.length !== 4}
                  className="w-full py-3.5 px-6 rounded-xl btn-gold disabled:opacity-40 text-gala-obsidian font-semibold text-sm tracking-wide transition flex items-center justify-center gap-2 shadow-lg"
                >
                  <UserCheck className="w-4 h-4" />
                  {loading
                    ? 'Verificando...'
                    : selectedUser.tiene_pin
                    ? 'Acceder a la Plataforma'
                    : 'Registrar PIN e Ingresar'}
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

