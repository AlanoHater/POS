/** Graficas minimas hechas con CSS: sin librerias extra y responsivas. */

type Point = { label: string; value: number; hint?: string };

type BarSeriesProps = {
  data: Point[];
  format: (value: number) => string;
  /** Muestra solo una etiqueta cada N columnas cuando hay muchos dias. */
  labelEvery?: number;
  /** Indice de la barra que se pinta con el acento (mejor dia, hora pico). */
  highlightIndex?: number;
  empty?: string;
};

export function BarSeries({
  data,
  format,
  labelEvery = 1,
  highlightIndex,
  empty = 'Sin datos',
}: BarSeriesProps) {
  const max = Math.max(...data.map((d) => d.value), 0);

  if (!data.length || max <= 0) {
    return <div className="empty">{empty}</div>;
  }

  return (
    <div className="chart-bars" role="img" aria-label="Grafica de barras">
      {data.map((point, index) => (
        <div className="chart-bar-col" key={`${point.label}-${index}`}>
          <div className="chart-bar-track">
            <div
              className={`chart-bar-fill ${index === highlightIndex ? 'highlight' : ''}`}
              style={{ height: `${Math.max((point.value / max) * 100, point.value > 0 ? 2 : 0)}%` }}
              title={`${point.label}: ${format(point.value)}${point.hint ? ` · ${point.hint}` : ''}`}
            />
          </div>
          <span className="chart-bar-label">
            {index % labelEvery === 0 ? point.label : ''}
          </span>
        </div>
      ))}
    </div>
  );
}

type RankListProps = {
  data: { label: string; value: number; meta?: string }[];
  format: (value: number) => string;
  empty?: string;
};

export function RankList({ data, format, empty = 'Sin datos' }: RankListProps) {
  const max = Math.max(...data.map((d) => d.value), 0);

  if (!data.length || max <= 0) {
    return <div className="empty">{empty}</div>;
  }

  return (
    <ul className="rank-list">
      {data.map((row, index) => (
        <li key={`${row.label}-${index}`}>
          <div className="rank-head">
            <span className="rank-label" title={row.label}>
              {row.label}
            </span>
            <span className="rank-value">{format(row.value)}</span>
          </div>
          <div className="rank-track">
            <div
              className={`rank-fill ${index === 0 ? 'highlight' : ''}`}
              style={{ width: `${(row.value / max) * 100}%` }}
            />
          </div>
          {row.meta && <span className="rank-meta">{row.meta}</span>}
        </li>
      ))}
    </ul>
  );
}

type KpiCardProps = {
  label: string;
  value: string;
  delta?: string;
  tone?: 'up' | 'down' | 'flat' | 'warn';
  hint?: string;
  /** Indicador principal: mas grande y con fondo suave. */
  hero?: boolean;
};

export function KpiCard({ label, value, delta, tone = 'flat', hint, hero }: KpiCardProps) {
  return (
    <div className={`kpi-card ${hero ? 'hero' : ''}`}>
      <span className="kpi-label">{label}</span>
      <strong className="kpi-value">{value}</strong>
      {delta && <span className={`kpi-delta ${tone}`}>{delta}</span>}
      {hint && <span className="kpi-hint">{hint}</span>}
    </div>
  );
}

export type StatItem = {
  label: string;
  value: string;
  /** Resalta el valor en ambar (p. ej. cancelaciones pendientes). */
  warn?: boolean;
  hint?: string;
};

/** Fila de indicadores secundarios en texto plano, sin tarjetas. */
export function StatStrip({ items }: { items: StatItem[] }) {
  return (
    <div className="stat-strip">
      {items.map((item) => (
        <div key={item.label}>
          <span>{item.label}</span>
          <strong className={item.warn ? 'warn' : undefined}>{item.value}</strong>
          {item.hint && <span>{item.hint}</span>}
        </div>
      ))}
    </div>
  );
}
