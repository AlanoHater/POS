/** Utilidades de formato y exportacion compartidas por el panel y el historial. */

export function money(value: number, symbol = '$') {
  const n = Number(value) || 0;
  return `${symbol}${n.toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function decimal(value: number) {
  return (Number(value) || 0).toLocaleString('es-MX');
}

export function percentChange(current: number, previous: number): number | null {
  if (!previous) return current ? null : 0; // sin base de comparacion
  return ((current - previous) / previous) * 100;
}

export function formatDelta(change: number | null) {
  if (change === null) return 'sin periodo previo';
  const sign = change > 0 ? '+' : '';
  return `${sign}${change.toFixed(1)}% vs. periodo anterior`;
}

export function dateTime(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('es-MX');
}

export function dayLabel(isoDay: string) {
  // isoDay viene como YYYY-MM-DD; se construye en local para no correr un dia.
  const [y, m, d] = isoDay.split('-').map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1);
  return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
}

export function hourLabel(hour: number) {
  return `${String(hour).padStart(2, '0')}:00`;
}

export const SALE_STATUS_LABEL: Record<number, string> = {
  0: 'En espera',
  1: 'Pagada',
  2: 'Cancelada',
};

export const PAYMENT_LABEL: Record<number, string> = {
  1: 'Efectivo',
  3: 'Tarjeta',
};

export function paymentLabel(type: number) {
  return PAYMENT_LABEL[type] || 'Otro';
}

export function statusLabel(status: number) {
  return SALE_STATUS_LABEL[status] ?? 'Desconocido';
}

/** Escapa un valor para CSV (separador ; para que Excel en espanol lo abra en columnas). */
function csvCell(value: unknown) {
  const text = value == null ? '' : String(value);
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: (string | number | null | undefined)[][]) {
  return rows.map((row) => row.map(csvCell).join(';')).join('\r\n');
}

/** Descarga un archivo generado en el navegador (funciona igual dentro de Electron). */
export function downloadFile(filename: string, content: string, mime = 'text/csv') {
  // El BOM hace que Excel reconozca los acentos como UTF-8.
  const blob = new Blob([`\uFEFF${content}`], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Sufijo de archivo con la fecha actual: reporte-ventas-2026-09-04.csv */
export function fileStamp(date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Valor para <input type="datetime-local"> en hora local. */
export function toLocalInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

/** Convierte el valor local del input a ISO UTC para la API. */
export function localInputToIso(value: string, endOfMinute = false) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  if (endOfMinute) d.setSeconds(59, 999);
  return d.toISOString();
}

/** Rangos rapidos usados por el panel y el historial. */
export type RangePreset = 'hoy' | 'ayer' | '7dias' | '30dias' | 'mes' | 'mesPasado';

export function presetRange(preset: RangePreset): { start: Date; end: Date } {
  const start = new Date();
  const end = new Date();
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 0, 0);

  switch (preset) {
    case 'hoy':
      break;
    case 'ayer':
      start.setDate(start.getDate() - 1);
      end.setDate(end.getDate() - 1);
      break;
    case '7dias':
      start.setDate(start.getDate() - 6);
      break;
    case '30dias':
      start.setDate(start.getDate() - 29);
      break;
    case 'mes':
      start.setDate(1);
      break;
    case 'mesPasado':
      start.setDate(1);
      start.setMonth(start.getMonth() - 1);
      end.setDate(0); // ultimo dia del mes anterior
      end.setHours(23, 59, 0, 0);
      break;
  }
  return { start, end };
}

export const PRESET_LABELS: { id: RangePreset; label: string }[] = [
  { id: 'hoy', label: 'Hoy' },
  { id: 'ayer', label: 'Ayer' },
  { id: '7dias', label: '7 dias' },
  { id: '30dias', label: '30 dias' },
  { id: 'mes', label: 'Este mes' },
  { id: 'mesPasado', label: 'Mes pasado' },
];
