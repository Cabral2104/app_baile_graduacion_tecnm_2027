import React, { useState, useMemo } from 'react';
import {
  Printer,
  QrCode,
  Sparkles,
  Download,
  Copy,
  Check,
  Plus,
  Trash2,
  RefreshCw,
  Sliders,
  Eye,
  FileText,
  ExternalLink,
  Layers,
} from 'lucide-react';
import { QrCodeMatrix } from './QrCodeMatrix';
import { User, SystemConfig } from '../types';

interface TableQrKitProps {
  users: User[];
  config: SystemConfig;
}

export type TableFormat = 'TENT' | 'SINGLE_A5' | 'MINI_CARDS';
export type TableTheme = 'LIGHT_GOLD' | 'STARRY_NIGHT';

export const TableQrKit: React.FC<TableQrKitProps> = ({ users, config }) => {
  // 1. Detección automática de mesas presentes en la lista de alumnos
  const detectedMesas = useMemo(() => {
    const set = new Set<string>();
    users.forEach((u) => {
      const m = u.mesa?.trim();
      if (m) set.add(m);
    });
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );
  }, [users]);

  // Lista activa de mesas a imprimir
  const [mesas, setMesas] = useState<string[]>(() => {
    if (detectedMesas.length > 0) return detectedMesas;
    return Array.from({ length: 20 }, (_, i) => `Mesa ${String(i + 1).padStart(2, '0')}`);
  });

  // Estado para agregar mesa individual o por rango
  const [newMesaName, setNewMesaName] = useState('');
  const [rangeStart, setRangeStart] = useState(1);
  const [rangeEnd, setRangeEnd] = useState(25);
  const [rangePrefix, setRangePrefix] = useState('Mesa ');

  // Formato y tema
  const [format, setFormat] = useState<TableFormat>('TENT');
  const [theme, setTheme] = useState<TableTheme>('LIGHT_GOLD');

  // Textos personalizables del cartel
  const [institucion, setInstitucion] = useState('Graduación TECNM');
  const [generacion, setGeneracion] = useState(config.nombre_generacion || 'Generación 2022 – 2026');
  const [lema, setLema] = useState('Donde termina el aula y comienza nuestra historia');
  const [instruccion, setInstruccion] = useState(
    'Escanea con tu celular para compartir fotos y recuerdos de esta noche. Aparecerán en vivo en la pantalla gigante.'
  );

  // URL base para el QR
  const [customOrigin, setCustomOrigin] = useState<string>(() => {
    if (typeof window !== 'undefined') return window.location.origin;
    return 'http://10.52.106.7:5173';
  });

  // Mesa seleccionada en la vista previa
  const [previewMesaIndex, setPreviewMesaIndex] = useState(0);
  const [copiedMesa, setCopiedMesa] = useState<string | null>(null);

  // Generador de URL para cada mesa
  const getTableUrl = (mesa: string) => {
    const cleanOrigin = customOrigin.replace(/\/+$/, '');
    return `${cleanOrigin}/?mesa=${encodeURIComponent(mesa)}`;
  };

  // Handlers para administración de mesas
  const handleLoadDetected = () => {
    if (detectedMesas.length > 0) {
      setMesas(detectedMesas);
      setPreviewMesaIndex(0);
    }
  };

  const handleGenerateRange = () => {
    const start = Math.max(1, rangeStart);
    const end = Math.max(start, rangeEnd);
    const list: string[] = [];
    for (let i = start; i <= end; i++) {
      list.push(`${rangePrefix}${String(i).padStart(2, '0')}`);
    }
    setMesas(list);
    setPreviewMesaIndex(0);
  };

  const handleAddSingleMesa = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newMesaName.trim();
    if (!clean) return;
    if (!mesas.includes(clean)) {
      setMesas((prev) => [...prev, clean]);
      setPreviewMesaIndex(mesas.length);
    }
    setNewMesaName('');
  };

  const handleRemoveMesa = (mesaToRemove: string) => {
    setMesas((prev) => {
      const next = prev.filter((m) => m !== mesaToRemove);
      if (previewMesaIndex >= next.length) {
        setPreviewMesaIndex(Math.max(0, next.length - 1));
      }
      return next;
    });
  };

  const handleCopyLink = (mesa: string) => {
    const url = getTableUrl(mesa);
    navigator.clipboard.writeText(url);
    setCopiedMesa(mesa);
    setTimeout(() => setCopiedMesa(null), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  const activeMesa = mesas[previewMesaIndex] || mesas[0] || 'Mesa 01';

  return (
    <div className="space-y-6">
      {/* SECCIÓN 1: PANEL DE CONTROL Y PERSONALIZACIÓN (Oculto al imprimir) */}
      <div className="no-print space-y-6">
        <div className="p-6 rounded-2xl glass border border-gala-silver/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.25em] text-gala-gold font-semibold flex items-center gap-1.5">
              <QrCode className="w-4 h-4 text-gala-gold" />
              Kit de Carteles QR para Mesas de Gala
            </div>
            <h3 className="font-serif text-2xl text-gala-ivory mt-1">
              Impresión y Personalización de Carteles
            </h3>
            <p className="text-xs text-gala-parchment/85 mt-1 max-w-2xl">
              Genera tarjetas de mesa con el código QR exacto para cada número de mesa. Al escanear con la cámara del celular, los invitados entran directo a la fiesta y suben fotos etiquetadas con su mesa en la pantalla gigante.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handlePrint}
              disabled={mesas.length === 0}
              className="px-5 py-3 rounded-xl btn-gold text-gala-obsidian font-semibold text-xs flex items-center gap-2 shadow-xl hover:scale-105 transition disabled:opacity-40"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Carteles ({mesas.length})</span>
            </button>
          </div>
        </div>

        {/* Aviso de configuración para impresión perfecta */}
        <div className="p-3.5 rounded-xl bg-amber-950/40 border border-gala-gold/30 text-xs text-gala-champagne flex items-center gap-2.5">
          <Sparkles className="w-4 h-4 text-gala-gold shrink-0" />
          <span>
            <strong>Ajuste de Impresión Recomendado:</strong> Cada mesa está calibrada para caber exactamente en <strong>1 sola hoja Carta sin cortarse</strong>. Si imprimes en modo <em>Noche Estrellada</em>, asegúrate de marcar la casilla <strong>"Gráficos en segundo plano" (Background graphics)</strong> en la ventana de impresión de tu navegador para que el fondo azul medianoche se imprima completo.
          </span>
        </div>

        {/* Panel en cuadrícula: Configuración de Mesas a la izquierda, Estilos a la derecha */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Columna Izquierda: Configuración de Mesas (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="glass p-5 rounded-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-gala-champagne flex items-center gap-2">
                  <Layers className="w-4 h-4 text-gala-gold" />
                  Mesas a Generar ({mesas.length})
                </h4>
                {detectedMesas.length > 0 && (
                  <button
                    type="button"
                    onClick={handleLoadDetected}
                    className="text-[11px] text-gala-gold hover:underline flex items-center gap-1"
                    title="Cargar las mesas detectadas en la lista de alumnos"
                  >
                    <RefreshCw className="w-3 h-3" /> Detectar del Padrón ({detectedMesas.length})
                  </button>
                )}
              </div>

              {/* Generador por Rango Numérico */}
              <div className="p-3.5 rounded-xl bg-gala-obsidian/70 border border-gala-silver/20 space-y-2.5">
                <label className="text-xs text-gala-silver font-medium block">
                  Generar por Rango Rápido
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <span className="text-[10px] text-gala-muted block mb-0.5">Prefijo</span>
                    <input
                      type="text"
                      value={rangePrefix}
                      onChange={(e) => setRangePrefix(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-gala-surface border border-gala-silver/25 text-xs text-gala-ivory"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-gala-muted block mb-0.5">Desde #</span>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={rangeStart}
                      onChange={(e) => setRangeStart(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-gala-surface border border-gala-silver/25 text-xs text-gala-ivory"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-gala-muted block mb-0.5">Hasta #</span>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={rangeEnd}
                      onChange={(e) => setRangeEnd(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-gala-surface border border-gala-silver/25 text-xs text-gala-ivory"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateRange}
                  className="w-full py-1.5 rounded-lg btn-silver text-xs font-semibold text-gala-ivory flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-3 h-3 text-gala-gold" /> Reemplazar con este Rango
                </button>
              </div>

              {/* Agregar mesa individual personalizada */}
              <form onSubmit={handleAddSingleMesa} className="flex gap-2">
                <input
                  type="text"
                  value={newMesaName}
                  onChange={(e) => setNewMesaName(e.target.value)}
                  placeholder="Ej. Mesa de Honor o Mesa 26"
                  className="flex-1 px-3 py-2 rounded-xl bg-gala-obsidian/80 border border-gala-silver/25 text-xs text-gala-ivory"
                />
                <button
                  type="submit"
                  disabled={!newMesaName.trim()}
                  className="px-3.5 py-2 rounded-xl btn-gold text-gala-obsidian text-xs font-semibold disabled:opacity-40 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Agregar
                </button>
              </form>

              {/* Lista de fichas de mesa para navegar o eliminar */}
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                <div className="flex flex-wrap gap-1.5">
                  {mesas.map((m, idx) => (
                    <div
                      key={m}
                      onClick={() => setPreviewMesaIndex(idx)}
                      className={`group cursor-pointer px-2.5 py-1 rounded-lg text-xs font-mono flex items-center gap-1.5 border transition ${previewMesaIndex === idx
                          ? 'bg-gala-gold text-gala-obsidian border-gala-gold font-bold shadow'
                          : 'bg-gala-obsidian/70 text-gala-silver border-gala-silver/20 hover:border-gala-gold/40'
                        }`}
                    >
                      <span>{m}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveMesa(m);
                        }}
                        className="opacity-50 group-hover:opacity-100 hover:text-red-400 p-0.5"
                        title="Quitar mesa"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Ajuste de Dominio / URL Base */}
            <div className="glass p-4 rounded-2xl space-y-2">
              <label className="text-xs font-semibold text-gala-champagne flex items-center gap-1.5">
                <ExternalLink className="w-3.5 h-3.5 text-gala-gold" />
                Dirección Web (URL Base del QR)
              </label>
              <input
                type="text"
                value={customOrigin}
                onChange={(e) => setCustomOrigin(e.target.value)}
                placeholder="http://192.168.1.50:5173 o https://midominio.com"
                className="w-full px-3 py-2 rounded-xl bg-gala-obsidian/80 border border-gala-silver/25 text-xs text-gala-ivory font-mono"
              />
              <p className="text-[11px] text-gala-muted">
                Tip: En el salón, si los celulares se conectan por WiFi o datos, coloca la IP local de tu laptop (ej. <code className="text-gala-champagne">http://192.168.1.X:5173</code>) o el dominio público.
              </p>
            </div>
          </div>

          {/* Columna Derecha: Opciones de Formato y Estilo + Vista Previa (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Opciones de Formato y Tema */}
            <div className="glass p-5 rounded-2xl space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Formato de Impresión */}
                <div>
                  <label className="text-xs font-semibold text-gala-champagne block mb-2">
                    Formato de Plegado / Impresión
                  </label>
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setFormat('TENT')}
                      className={`w-full p-2.5 rounded-xl border text-left text-xs transition flex items-center gap-2.5 ${format === 'TENT'
                          ? 'btn-gold border-gala-gold text-gala-obsidian font-semibold'
                          : 'bg-gala-obsidian/70 border-gala-silver/20 text-gala-silver'
                        }`}
                    >
                      <Layers className="w-4 h-4 shrink-0" />
                      <div>
                        <div>Carpa Triangular (Table Tent)</div>
                        <div className="text-[10px] opacity-80">2 caras en 1 hoja carta. Se dobla y se para sola.</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormat('SINGLE_A5')}
                      className={`w-full p-2.5 rounded-xl border text-left text-xs transition flex items-center gap-2.5 ${format === 'SINGLE_A5'
                          ? 'btn-gold border-gala-gold text-gala-obsidian font-semibold'
                          : 'bg-gala-obsidian/70 border-gala-silver/20 text-gala-silver'
                        }`}
                    >
                      <FileText className="w-4 h-4 shrink-0" />
                      <div>
                        <div>Media Carta / A5 (1 por página)</div>
                        <div className="text-[10px] opacity-80">Ideal para marcos de acrílico o portaretratos.</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Estilo de Color */}
                <div>
                  <label className="text-xs font-semibold text-gala-champagne block mb-2">
                    Estilo de Color y Tinta
                  </label>
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setTheme('LIGHT_GOLD')}
                      className={`w-full p-2.5 rounded-xl border text-left text-xs transition flex items-center gap-2.5 ${theme === 'LIGHT_GOLD'
                          ? 'bg-amber-100 border-amber-400 text-amber-950 font-semibold shadow-sm'
                          : 'bg-gala-obsidian/70 border-gala-silver/20 text-gala-silver'
                        }`}
                    >
                      <div className="w-4 h-4 rounded-full bg-[#FAF7F2] border border-amber-500 shrink-0" />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span>Elegante Claro / Tinta Económica</span>
                          <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 font-bold">
                            Óptimo B/N y Copiadoras
                          </span>
                        </div>
                        <div className="text-[10px] opacity-80">Fondo blanco marfil con detalles oro (ahorra tóner y máxima legibilidad).</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTheme('STARRY_NIGHT')}
                      className={`w-full p-2.5 rounded-xl border text-left text-xs transition flex items-center gap-2.5 ${theme === 'STARRY_NIGHT'
                          ? 'btn-gold border-gala-gold text-gala-obsidian font-semibold shadow-sm'
                          : 'bg-gala-obsidian/70 border-gala-silver/20 text-gala-silver'
                        }`}
                    >
                      <div className="w-4 h-4 rounded-full bg-[#0A1536] border border-gala-gold shrink-0" />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span>Noche Estrellada (Azul Real & Oro)</span>
                          <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-blue-900/40 text-blue-200 border border-blue-400/30 font-bold">
                            Impresora Color / PDF
                          </span>
                        </div>
                        <div className="text-[10px] opacity-80">Fondo azul medianoche profundo con oro radiante de alta luminosidad.</div>
                      </div>
                    </button>
                  </div>
                </div>
              </div>

              {/* Textos del Cartel */}
              <div className="pt-2 border-t border-gala-silver/20 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-gala-muted block mb-1">Encabezado de Gala</label>
                  <input
                    type="text"
                    value={institucion}
                    onChange={(e) => setInstitucion(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-gala-obsidian border border-gala-silver/20 text-xs text-gala-ivory"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-gala-muted block mb-1">Generación</label>
                  <input
                    type="text"
                    value={generacion}
                    onChange={(e) => setGeneracion(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-gala-obsidian border border-gala-silver/20 text-xs text-gala-ivory"
                  />
                </div>
              </div>
            </div>

            {/* Vista Previa Interactiva */}
            <div className="glass p-5 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-gala-gold font-semibold flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5" />
                  Vista Previa en Pantalla: <strong>{activeMesa}</strong>
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyLink(activeMesa)}
                    className="px-2.5 py-1 rounded-lg bg-gala-surface hover:bg-gala-card text-[11px] text-gala-champagne border border-gala-silver/25 flex items-center gap-1"
                  >
                    {copiedMesa === activeMesa ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" /> Copiado
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" /> Copiar Enlace
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Tarjeta de Muestra Renderizada */}
              <div className="flex justify-center p-4 bg-gala-obsidian/90 rounded-xl overflow-hidden border border-gala-silver/20">
                <div className="w-full max-w-sm scale-95 origin-top transition duration-300">
                  <TableCardSingle
                    mesa={activeMesa}
                    url={getTableUrl(activeMesa)}
                    institucion={institucion}
                    generacion={generacion}
                    lema={lema}
                    instruccion={instruccion}
                    theme={theme}
                    compact={format === 'TENT'}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECCIÓN 2: HOJAS DE IMPRESIÓN (Visible al imprimir window.print() o en vista previa completa) */}
      <div id="print-root" className="print-only">
        {format === 'TENT' ? (
          // FORMATO CARPA: EXACTAMENTE 1 HOJA CARTA POR MESA CON 2 CARAS OPUESTAS Y LÍNEA DE PLIEGUE
          mesas.map((mesa) => (
            <div
              key={`tent-${mesa}`}
              className="print-page print-tent-sheet"
              style={{
                pageBreakAfter: 'always',
                breakAfter: 'page',
                pageBreakInside: 'avoid',
                breakInside: 'avoid',
                width: '100%',
                maxHeight: '248mm',
                height: '248mm',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '2mm 4mm',
                boxSizing: 'border-box',
                overflow: 'hidden',
                WebkitPrintColorAdjust: 'exact',
                printColorAdjust: 'exact',
              }}
            >
              {/* Cara Superior (Invertida para doblarse hacia el otro lado de la mesa) */}
              <div
                className="tent-side tent-side-top"
                style={{
                  transform: 'rotate(180deg)',
                  maxHeight: '116mm',
                  boxSizing: 'border-box',
                }}
              >
                <TableCardSingle
                  mesa={mesa}
                  url={getTableUrl(mesa)}
                  institucion={institucion}
                  generacion={generacion}
                  lema={lema}
                  instruccion={instruccion}
                  theme={theme}
                  compact={true}
                />
              </div>

              {/* Línea Guía de Pliegue (Marca sutil punteada de plegado, sin texto para evitar cortes al doblar) */}
              <div
                style={{
                  borderTop: theme === 'LIGHT_GOLD' ? '1px dashed rgba(197, 155, 39, 0.45)' : '1px dashed rgba(245, 208, 97, 0.45)',
                  margin: '2mm 10mm',
                  height: '0',
                }}
              />

              {/* Cara Inferior (De frente) */}
              <div
                className="tent-side tent-side-bottom"
                style={{
                  maxHeight: '116mm',
                  boxSizing: 'border-box',
                }}
              >
                <TableCardSingle
                  mesa={mesa}
                  url={getTableUrl(mesa)}
                  institucion={institucion}
                  generacion={generacion}
                  lema={lema}
                  instruccion={instruccion}
                  theme={theme}
                  compact={true}
                />
              </div>
            </div>
          ))
        ) : (
          // FORMATO MEDIA CARTA / A5: 1 CARTEL POR PÁGINA
          mesas.map((mesa) => (
            <div
              key={`single-${mesa}`}
              className="print-page print-single-sheet"
              style={{
                pageBreakAfter: 'always',
                breakAfter: 'page',
                pageBreakInside: 'avoid',
                breakInside: 'avoid',
                width: '100%',
                maxHeight: '248mm',
                height: '248mm',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8mm',
                boxSizing: 'border-box',
                overflow: 'hidden',
                WebkitPrintColorAdjust: 'exact',
                printColorAdjust: 'exact',
              }}
            >
              <div style={{ width: '100%', maxWidth: '14.5cm' }}>
                <TableCardSingle
                  mesa={mesa}
                  url={getTableUrl(mesa)}
                  institucion={institucion}
                  generacion={generacion}
                  lema={lema}
                  instruccion={instruccion}
                  theme={theme}
                  compact={false}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

interface TableCardSingleProps {
  mesa: string;
  url: string;
  institucion: string;
  generacion: string;
  lema: string;
  instruccion: string;
  theme: TableTheme;
  compact?: boolean;
}

const TableCardSingle: React.FC<TableCardSingleProps> = ({
  mesa,
  url,
  institucion,
  generacion,
  lema,
  instruccion,
  theme,
  compact = false,
}) => {
  const isLight = theme === 'LIGHT_GOLD';
  const qrSize = compact ? 104 : 148;

  // Paleta de Colores de Alta Fidelidad y Luminosidad para Impresión y Pantalla
  const colors = isLight
    ? {
      bg: '#FAF8F5',
      bgImage: 'none',
      border: '2px solid #C59B27',
      filigree: '1px solid rgba(197, 155, 39, 0.45)',
      header: '#9E7817',
      gen: '#5C4E40',
      badgeBg: '#F3EDE2',
      badgeBorder: '1.5px solid #C59B27',
      badgeText: '#2B2118',
      badgeShadow: 'none',
      lema: '#5C4E40',
      qrBoxBg: '#FFFFFF',
      qrBoxBorder: '1.5px solid #C59B27',
      qrDark: '#1A1815',
      qrLight: '#FFFFFF',
      instrTitle: '#9E7817',
      instrText: '#3D342B',
      footerBorder: '1px solid rgba(197, 155, 39, 0.35)',
      footerText: '#736354',
      footerTag: '#9E7817',
    }
    : {
      bg: '#0A1536',
      bgImage: 'radial-gradient(ellipse at 50% 18%, #162E6E 0%, #0C1A3F 60%, #060D20 100%)',
      border: '2.5px solid #F5D061',
      filigree: '1px solid rgba(245, 208, 97, 0.55)',
      header: '#FFDF78',
      gen: '#FFE89E',
      badgeBg: '#132557',
      badgeBorder: '2px solid #F5D061',
      badgeText: '#FFF5D6',
      badgeShadow: '0 0 10px rgba(245, 208, 97, 0.35)',
      lema: '#F1F5F9',
      qrBoxBg: '#FFFFFF',
      qrBoxBorder: '2px solid #F5D061',
      qrDark: '#08101D',
      qrLight: '#FFFFFF',
      instrTitle: '#FFDF78',
      instrText: '#E2E8F0',
      footerBorder: '1px solid rgba(245, 208, 97, 0.4)',
      footerText: '#CBD5E1',
      footerTag: '#FFDF78',
    };

  return (
    <div
      className={isLight ? 'print-card-light' : 'print-card-starry'}
      style={{
        backgroundColor: colors.bg,
        backgroundImage: colors.bgImage,
        color: isLight ? '#1A1815' : '#FAF7F2',
        border: colors.border,
        borderRadius: compact ? '12px' : '16px',
        padding: compact ? '10px 16px 8px 16px' : '22px 26px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
        maxHeight: compact ? '116mm' : 'auto',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
        fontFamily: 'serif',
      }}
    >
      {/* Marco de Esquinas de Gala (Ornamentos dorados) */}
      <div
        style={{
          position: 'absolute',
          top: '4px',
          left: '4px',
          right: '4px',
          bottom: '4px',
          border: colors.filigree,
          borderRadius: compact ? '9px' : '12px',
          pointerEvents: 'none',
        }}
      />

      {/* Encabezado Institucional */}
      <div style={{ marginBottom: compact ? '2px' : '6px' }}>
        <div
          style={{
            fontSize: compact ? '9px' : '11px',
            textTransform: 'uppercase',
            letterSpacing: '0.2em',
            color: colors.header,
            fontWeight: 700,
          }}
        >
          {institucion}
        </div>
        <div
          style={{
            fontSize: compact ? '10px' : '12.5px',
            color: colors.gen,
            letterSpacing: '0.06em',
            marginTop: '1px',
          }}
        >
          {generacion}
        </div>
      </div>

      {/* Título de Mesa Destacado */}
      <div
        className={isLight ? 'print-badge-light' : 'print-badge-starry'}
        style={{
          margin: compact ? '3px 0 3px 0' : '10px 0 8px 0',
          padding: compact ? '2px 14px' : '5px 16px',
          borderRadius: '8px',
          display: 'inline-block',
          backgroundColor: colors.badgeBg,
          border: colors.badgeBorder,
          color: colors.badgeText,
          boxShadow: colors.badgeShadow,
          WebkitPrintColorAdjust: 'exact',
          printColorAdjust: 'exact',
        }}
      >
        <span
          style={{
            fontSize: compact ? '18px' : '23px',
            fontWeight: 800,
            letterSpacing: '0.05em',
            fontFamily: 'sans-serif',
          }}
        >
          {mesa.toUpperCase()}
        </span>
      </div>

      {/* Lema o Frase Conmemorativa */}
      <div
        style={{
          fontSize: compact ? '9.5px' : '11.5px',
          fontStyle: 'italic',
          color: colors.lema,
          marginBottom: compact ? '5px' : '12px',
          lineHeight: '1.3',
        }}
      >
        "{lema}"
      </div>

      {/* Código QR Central de Alta Resolución */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          margin: compact ? '0 auto 4px auto' : '0 auto 10px auto',
        }}
      >
        <div
          className="print-qr-box"
          style={{
            padding: compact ? '5px' : '7px',
            borderRadius: '10px',
            backgroundColor: colors.qrBoxBg,
            border: colors.qrBoxBorder,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            display: 'inline-block',
            WebkitPrintColorAdjust: 'exact',
            printColorAdjust: 'exact',
          }}
        >
          <QrCodeMatrix value={url} size={qrSize} darkColor={colors.qrDark} lightColor={colors.qrLight} />
        </div>
      </div>

      {/* Instrucciones de Escaneo */}
      <div
        style={{
          fontSize: compact ? '8.5px' : '10.5px',
          fontFamily: 'sans-serif',
          color: colors.instrText,
          lineHeight: '1.3',
          maxWidth: compact ? '260px' : '300px',
          margin: '0 auto',
        }}
      >
        <strong style={{ color: colors.instrTitle, display: 'block', marginBottom: '1px' }}>
          ¡Comparte tus fotos en vivo!
        </strong>
        {instruccion}
      </div>

      {/* Pie con URL y Logotipo Simbólico */}
      <div
        style={{
          marginTop: compact ? '4px' : '10px',
          paddingTop: compact ? '3px' : '6px',
          borderTop: colors.footerBorder,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: compact ? '8px' : '9px',
          fontFamily: 'monospace',
          color: colors.footerText,
        }}
      >
        <span>Mesa Vinculada: {mesa}</span>
        <span style={{ color: colors.footerTag }}>
          {theme === 'STARRY_NIGHT' ? 'Noche de Gala' : 'Graduación 2026'}
        </span>
      </div>
    </div>
  );
};

