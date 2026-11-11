import React from 'react';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';

interface PaginationBarProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  itemLabel?: string;
}

export const PaginationBar: React.FC<PaginationBarProps> = ({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [3, 6, 9, 12],
  itemLabel = 'fotos',
}) => {
  if (totalItems === 0) return null;

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startItem = (safePage - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, safePage * pageSize);

  const getPageNumbers = (): number[] => {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, safePage - 2);
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  return (
    <div className="glass rounded-2xl px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 border border-gala-silver/25">
      {/* Indicador de rango y selector de cantidad por página */}
      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs text-gala-silver">
        <span className="inline-flex items-center gap-1.5 font-medium">
          <Sparkles className="w-3.5 h-3.5 text-gala-gold shrink-0" />
          <span>
            Mostrando <strong className="text-gala-ivory font-mono">{startItem}–{endItem}</strong> de{' '}
            <strong className="text-gala-champagne font-mono">{totalItems}</strong> {itemLabel}
          </span>
        </span>

        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 text-[11px] text-gala-muted">
            <span>· Ver:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value));
                onPageChange(1);
              }}
              aria-label="Elementos por página"
              className="bg-gala-obsidian border border-gala-silver/30 rounded-lg px-2 py-1 font-mono text-[11px] text-gala-champagne focus:border-gala-gold"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt} por pág.
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Controles de paginación */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          className="px-3 py-1.5 rounded-xl bg-gala-obsidian/90 hover:bg-gala-card border border-gala-silver/25 disabled:opacity-35 text-xs font-medium text-gala-silver flex items-center gap-1 transition"
        >
          <ChevronLeft className="w-3.5 h-3.5 text-gala-gold" />
          <span>Anterior</span>
        </button>

        <div className="flex items-center gap-1">
          {getPageNumbers().map((p) => {
            const isCurrent = p === safePage;
            return (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                className={`min-w-[32px] h-8 px-2 rounded-xl font-mono text-xs font-semibold border transition ${
                  isCurrent
                    ? 'btn-gold border-gala-gold text-gala-obsidian shadow'
                    : 'bg-gala-obsidian/80 border-gala-silver/20 text-gala-silver hover:border-gala-gold/50'
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
          className="px-3 py-1.5 rounded-xl bg-gala-obsidian/90 hover:bg-gala-card border border-gala-silver/25 disabled:opacity-35 text-xs font-medium text-gala-silver flex items-center gap-1 transition"
        >
          <span>Siguiente</span>
          <ChevronRight className="w-3.5 h-3.5 text-gala-gold" />
        </button>
      </div>
    </div>
  );
};

