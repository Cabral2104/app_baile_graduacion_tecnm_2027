import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, ShieldCheck, Sparkles, Trash2, X } from 'lucide-react';

export type GalaDialogVariant = 'danger' | 'warning' | 'gold';

export interface GalaConfirmOptions {
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: GalaDialogVariant;
  /** Si es false, funciona como alerta informativa de un solo botón */
  showCancel?: boolean;
}

interface GalaDialogContextValue {
  confirm: (options: GalaConfirmOptions) => Promise<boolean>;
  alert: (options: Omit<GalaConfirmOptions, 'showCancel' | 'cancelText'>) => Promise<void>;
}

const GalaDialogContext = createContext<GalaDialogContextValue | null>(null);

export const useGalaConfirm = () => {
  const ctx = useContext(GalaDialogContext);
  if (!ctx) {
    throw new Error('useGalaConfirm debe usarse dentro de GalaDialogProvider');
  }
  return ctx.confirm;
};

export const useGalaAlert = () => {
  const ctx = useContext(GalaDialogContext);
  if (!ctx) {
    throw new Error('useGalaAlert debe usarse dentro de GalaDialogProvider');
  }
  return ctx.alert;
};

interface PendingDialog {
  options: GalaConfirmOptions;
  resolve: (value: boolean) => void;
}

/**
 * Proveedor global de diálogos y confirmaciones estilizados con la temática
 * "La Noche Estrellada", reemplazando las alertas nativas del navegador.
 */
export const GalaDialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dialog, setDialog] = useState<PendingDialog | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: GalaConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setDialog({ options, resolve });
    });
  }, []);

  const alert = useCallback(
    async (options: Omit<GalaConfirmOptions, 'showCancel' | 'cancelText'>): Promise<void> => {
      await confirm({
        ...options,
        confirmText: options.confirmText || 'Entendido',
        showCancel: false,
      });
    },
    [confirm]
  );

  const closeWithResult = useCallback((result: boolean) => {
    setDialog((current) => {
      if (current) {
        current.resolve(result);
      }
      return null;
    });
    resolverRef.current = null;
  }, []);

  useEffect(() => {
    if (!dialog) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeWithResult(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dialog, closeWithResult]);

  const variant: GalaDialogVariant = dialog?.options.variant || 'gold';
  const showCancel = dialog?.options.showCancel !== false;

  const IconComponent =
    variant === 'danger'
      ? Trash2
      : variant === 'warning'
      ? AlertTriangle
      : dialog?.options.showCancel === false
      ? Sparkles
      : ShieldCheck;

  return (
    <GalaDialogContext.Provider value={{ confirm, alert }}>
      {children}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {dialog && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => closeWithResult(false)}
                className="fixed inset-0 z-[200] bg-gala-obsidian/80 backdrop-blur-md flex items-center justify-center p-4"
                role="dialog"
                aria-modal="true"
                aria-labelledby="gala-dialog-title"
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.94, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 8 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full max-w-md glass glass-ornate rounded-2xl p-6 space-y-5 shadow-2xl border border-gala-gold/30"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${
                          variant === 'danger'
                            ? 'bg-red-950/80 border-red-500/45 text-red-300 shadow-[0_0_16px_rgba(239,68,68,0.22)]'
                            : variant === 'warning'
                            ? 'bg-amber-950/80 border-amber-400/45 text-amber-300 shadow-[0_0_16px_rgba(245,158,11,0.22)]'
                            : 'bg-gala-gold/15 border-gala-gold/45 text-gala-gold shadow-[0_0_16px_rgba(229,184,91,0.22)]'
                        }`}
                      >
                        <IconComponent className="w-5 h-5" />
                      </div>

                      <div className="min-w-0">
                        <span className="font-display text-[10px] uppercase tracking-[0.22em] text-gala-gold/90 block">
                          Graduación TECNM
                        </span>
                        <h3
                          id="gala-dialog-title"
                          className="font-serif font-semibold text-xl sm:text-2xl text-gala-ivory leading-tight mt-0.5"
                        >
                          {dialog.options.title}
                        </h3>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => closeWithResult(false)}
                      className="p-1.5 rounded-lg text-gala-muted hover:text-gala-ivory hover:bg-gala-surface/70 transition shrink-0"
                      aria-label="Cerrar diálogo"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <p className="text-xs sm:text-sm text-gala-parchment/90 leading-relaxed pl-0 sm:pl-[58px]">
                    {dialog.options.description}
                  </p>

                  <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-gala-silver/15">
                    {showCancel && (
                      <button
                        type="button"
                        onClick={() => closeWithResult(false)}
                        className="px-4 py-2.5 rounded-xl btn-silver text-xs font-semibold text-gala-silver hover:text-gala-ivory transition"
                      >
                        {dialog.options.cancelText || 'Cancelar'}
                      </button>
                    )}

                    <button
                      type="button"
                      autoFocus
                      onClick={() => closeWithResult(true)}
                      className={`px-5 py-2.5 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
                        variant === 'danger'
                          ? 'bg-red-600 hover:bg-red-500 text-white border border-red-400/50 shadow-[0_6px_20px_-6px_rgba(220,38,38,0.65)]'
                          : 'btn-gold text-gala-obsidian shadow-lg'
                      }`}
                    >
                      {dialog.options.confirmText || 'Confirmar'}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </GalaDialogContext.Provider>
  );
};

