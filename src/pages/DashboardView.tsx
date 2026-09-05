import { useEffect, useMemo, useState } from 'react';
import './DashboardView.css';
import { api, ReportSummary, User } from '../api/client';
import { BarSeries, KpiCard, RankList, StatStrip } from '../components/Charts';
import { Disclosure, EmptyState, Icon, Menu } from '../components/ui';
import {
  PRESET_LABELS,
  RangePreset,
  dayLabel,
  decimal,
  downloadFile,
  fileStamp,
  formatDelta,
  hourLabel,
  localInputToIso,
  money,
  percentChange,
  presetRange,
  toCsv,
  toLocalInputValue,
} from '../lib/format';

type Props = {
  symbol: string;
  storeName: string;
};

type RankTab = 'productos' | 'categorias' | 'cajeros' | 'pagos';

const RANK_TABS: { id: RankTab; label: string }[] = [
  { id: 'productos', label: 'Productos' },
  { id: 'categorias', label: 'Categorias' },
  { id: 'cajeros', label: 'Cajeros' },
  { id: 'pagos', label: 'Pagos' },
];

const RANK_EMPTY: Record<RankTab, string> = {
  productos: 'Aun no hay productos vendidos',
  categorias: 'Sin categorias con ventas',
  cajeros: 'Sin ventas registradas',
  pagos: 'Sin ventas registradas',
};

const RANK_SHORT = 5;
const INVENTORY_ROWS = 6;

/** Tono del indicador: verde si sube, rojo si baja. */
function toneOf(change: number | null): 'up' | 'down' | 'flat' {
  if (change === null || Math.abs(change) < 0.05) return 'flat';
  return change > 0 ? 'up' : 'down';
}

export default function DashboardView({ symbol, storeName }: Props) {
  const initial = presetRange('7dias');
  const [preset, setPreset] = useState<RangePreset | 'personalizado'>('7dias');
  const [start, setStart] = useState(toLocalInputValue(initial.start));
  const [end, setEnd] = useState(toLocalInputValue(initial.end));
  const [userId, setUserId] = useState(0);
  const [till, setTill] = useState(0);
  const [users, setUsers] = useState<User[]>([]);
  const [data, setData] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [rankTab, setRankTab] = useState<RankTab>('productos');
  const [rankExpanded, setRankExpanded] = useState(false);
  const [inventoryExpanded, setInventoryExpanded] = useState(false);

  const fmtMoney = (v: number) => money(v, symbol);

  const load = async (from = start, to = end, u = userId, t = till) => {
    setLoading(true);
    setError(null);
    try {
      const [summary, allUsers] = await Promise.all([
        api.getReport({
          start: localInputToIso(from),
          end: localInputToIso(to, true),
          user: u,
          till: t,
        }),
        api.getUsers().catch(() => [] as User[]),
      ]);
      setData(summary);
      setUsers(allUsers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el panel');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- carga inicial; los filtros recargan solos
  }, []);

  const applyPreset = (id: RangePreset) => {
    const range = presetRange(id);
    const from = toLocalInputValue(range.start);
    const to = toLocalInputValue(range.end);
    setPreset(id);
    setStart(from);
    setEnd(to);
    load(from, to);
  };

  const deltas = useMemo(() => {
    if (!data) return null;
    return {
      revenue: percentChange(data.kpis.revenue, data.previous.revenue),
      tickets: percentChange(data.kpis.tickets, data.previous.tickets),
      avgTicket: percentChange(data.kpis.avgTicket, data.previous.avgTicket),
      units: percentChange(data.kpis.units, data.previous.units),
    };
  }, [data]);

  const exportCsv = () => {
    if (!data) return;
    const rows: (string | number)[][] = [
      [`Reporte de ${storeName || 'la tienda'}`],
      ['Del', new Date(data.range.start).toLocaleString('es-MX')],
      ['Al', new Date(data.range.end).toLocaleString('es-MX')],
      [],
      ['Indicador', 'Valor'],
      ['Ingresos', data.kpis.revenue.toFixed(2)],
      ['Tickets', data.kpis.tickets],
      ['Ticket promedio', data.kpis.avgTicket.toFixed(2)],
      ['Piezas vendidas', data.kpis.units],
      ['Descuentos', data.kpis.discounts.toFixed(2)],
      ['Impuestos', data.kpis.tax.toFixed(2)],
      ['Ventas canceladas', data.kpis.cancelledCount],
      ['Importe cancelado', data.kpis.cancelledAmount.toFixed(2)],
      ['Ventas en espera', data.kpis.heldCount],
      ['Valor del inventario', data.inventory.stockValue.toFixed(2)],
      [],
      ['Ventas por dia', 'Ingresos', 'Tickets', 'Piezas'],
      ...data.byDay.map((d) => [d.date, d.revenue.toFixed(2), d.tickets, d.units]),
      [],
      ['Ventas por hora', 'Ingresos', 'Tickets'],
      ...data.byHour
        .filter((h) => h.tickets > 0)
        .map((h) => [hourLabel(h.hour), h.revenue.toFixed(2), h.tickets]),
      [],
      ['Producto', 'Piezas', 'Ingresos'],
      ...data.topProducts.map((p) => [p.name, p.units, p.revenue.toFixed(2)]),
      [],
      ['Categoria', 'Piezas', 'Ingresos'],
      ...data.byCategory.map((c) => [c.category, c.units, c.revenue.toFixed(2)]),
      [],
      ['Cajero', 'Tickets', 'Ingresos'],
      ...data.byUser.map((u) => [u.name, u.tickets, u.revenue.toFixed(2)]),
      [],
      ['Forma de pago', 'Tickets', 'Ingresos'],
      ...data.byPayment.map((p) => [p.label, p.tickets, p.revenue.toFixed(2)]),
      [],
      ['Producto agotado', 'Categoria'],
      ...data.inventory.outOfStock.map((p) => [p.name, p.category || 'Sin categoria']),
      [],
      ['Producto con stock bajo', 'Piezas', 'Categoria'],
      ...data.inventory.lowStock.map((p) => [p.name, p.quantity, p.category || 'Sin categoria']),
    ];
    downloadFile(`panel-${fileStamp()}.csv`, toCsv(rows));
  };

  const rangeText = data
    ? `${new Date(data.range.start).toLocaleDateString('es-MX')} — ${new Date(
        data.range.end
      ).toLocaleDateString('es-MX')}`
    : '';

  /** Filtros fuera de su valor por defecto: cajero, caja y rango personalizado. */
  const activeFilters =
    (userId !== 0 ? 1 : 0) + (till !== 0 ? 1 : 0) + (preset === 'personalizado' ? 1 : 0);

  const bestDayIndex = useMemo(() => {
    if (!data || !data.bestDay || data.bestDay.revenue <= 0) return undefined;
    const idx = data.byDay.findIndex((d) => d.date === data.bestDay?.date);
    return idx >= 0 ? idx : undefined;
  }, [data]);

  const peakHourIndex = useMemo(() => {
    if (!data || !data.peakHour || data.peakHour.revenue <= 0) return undefined;
    const idx = data.byHour.findIndex((h) => h.hour === data.peakHour?.hour);
    return idx >= 0 ? idx : undefined;
  }, [data]);

  /** Filas del ranking para una pestana; la impresion las necesita todas. */
  const rowsFor = (tab: RankTab) => {
    if (!data) return [];
    switch (tab) {
      case 'productos':
        return data.topProducts.map((p) => ({
          label: p.name,
          value: p.revenue,
          meta: `${decimal(p.units)} piezas`,
        }));
      case 'categorias':
        return data.byCategory.map((c) => ({
          label: c.category,
          value: c.revenue,
          meta: `${decimal(c.units)} piezas`,
        }));
      case 'cajeros':
        return data.byUser.map((u) => ({
          label: u.name,
          value: u.revenue,
          meta: `${decimal(u.tickets)} tickets · ${fmtMoney(
            u.tickets ? u.revenue / u.tickets : 0
          )} promedio`,
        }));
      case 'pagos':
        return data.byPayment.map((p) => ({
          label: p.label,
          value: p.revenue,
          meta: `${decimal(p.tickets)} tickets · ${
            data.kpis.revenue ? ((p.revenue / data.kpis.revenue) * 100).toFixed(1) : '0.0'
          }% del total`,
        }));
      default:
        return [];
    }
  };

  const rankRows = rowsFor(rankTab);
  const visibleRank = rankExpanded ? rankRows : rankRows.slice(0, RANK_SHORT);

  // Inventario: agotados primero y luego stock bajo, sin que un grupo largo oculte al otro.
  const inventoryAll = useMemo(() => {
    if (!data) return [];
    const out = data.inventory.outOfStock.map((p) => ({ ...p, out: true }));
    const low = data.inventory.lowStock.map((p) => ({ ...p, out: false }));
    return [...out, ...low];
  }, [data]);
  const inventoryCollapsed = useMemo(() => {
    const out = inventoryAll.filter((r) => r.out);
    const low = inventoryAll.filter((r) => !r.out);
    const half = Math.ceil(INVENTORY_ROWS / 2);
    const o = out.slice(0, Math.max(half, INVENTORY_ROWS - low.length));
    const l = low.slice(0, INVENTORY_ROWS - o.length);
    return [...o, ...l];
  }, [inventoryAll]);
  const inventoryRows = inventoryExpanded ? inventoryAll : inventoryCollapsed;

  return (
    <div id="print-area" className="dashboard">
      <div className="print-only print-header">
        <h2>{storeName || 'Tienda'} · Panel de ventas</h2>
        <p>
          Periodo {rangeText} · Generado el {new Date().toLocaleString('es-MX')}
        </p>
      </div>

      <div className="toolbar dash-bar no-print">
        <div className="chips">
          {PRESET_LABELS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`chip ${preset === p.id ? 'active' : ''}`}
              onClick={() => applyPreset(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>

        <Disclosure
          label="Filtros"
          icon="filter"
          count={activeFilters}
          open={filtersOpen}
          onToggle={() => setFiltersOpen((v) => !v)}
        >
          <div className="filters">
            <div className="field">
              <label htmlFor="dash-start">Desde</label>
              <input
                id="dash-start"
                type="datetime-local"
                value={start}
                onChange={(e) => {
                  setStart(e.target.value);
                  setPreset('personalizado');
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="dash-end">Hasta</label>
              <input
                id="dash-end"
                type="datetime-local"
                value={end}
                onChange={(e) => {
                  setEnd(e.target.value);
                  setPreset('personalizado');
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="dash-user">Cajero</label>
              <select
                id="dash-user"
                value={userId}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  setUserId(value);
                  load(start, end, value, till);
                }}
              >
                <option value={0}>Todos</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullname}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="dash-till">Caja (0 = todas)</label>
              <input
                id="dash-till"
                type="number"
                min={0}
                value={till}
                onChange={(e) => setTill(Number(e.target.value))}
              />
            </div>
            <button type="button" className="btn" onClick={() => load()} disabled={loading}>
              {loading ? 'Cargando…' : 'Aplicar'}
            </button>
          </div>
        </Disclosure>

        <div className="spacer" />

        <Menu
          buttonClassName="btn"
          label="Exportar"
          align="end"
          disabled={!data}
          trigger={
            <>
              <Icon name="download" size={16} />
              Exportar
              <Icon name="chevron-down" size={16} />
            </>
          }
          items={[
            { label: 'Exportar CSV', icon: 'download', onSelect: exportCsv, disabled: !data },
            { label: 'Imprimir', icon: 'printer', onSelect: () => window.print(), disabled: !data },
          ]}
        />
      </div>

      {error && <div className="error">{error}</div>}

      {loading && !data && <div className="empty">Cargando…</div>}

      {data && (
        <>
          <div className="kpi-grid">
            <KpiCard
              hero
              label="Ingresos"
              value={fmtMoney(data.kpis.revenue)}
              delta={formatDelta(deltas?.revenue ?? null)}
              tone={toneOf(deltas?.revenue ?? null)}
            />
            <KpiCard
              label="Tickets"
              value={decimal(data.kpis.tickets)}
              delta={formatDelta(deltas?.tickets ?? null)}
              tone={toneOf(deltas?.tickets ?? null)}
            />
            <KpiCard
              label="Ticket promedio"
              value={fmtMoney(data.kpis.avgTicket)}
              delta={formatDelta(deltas?.avgTicket ?? null)}
              tone={toneOf(deltas?.avgTicket ?? null)}
            />
            <KpiCard
              label="Piezas vendidas"
              value={decimal(data.kpis.units)}
              delta={formatDelta(deltas?.units ?? null)}
              tone={toneOf(deltas?.units ?? null)}
            />
          </div>

          <div className="card stat-card">
            <StatStrip
              items={[
                { label: 'Descuentos otorgados', value: fmtMoney(data.kpis.discounts) },
                { label: 'Impuestos cobrados', value: fmtMoney(data.kpis.tax) },
                {
                  label: 'Ventas canceladas',
                  value: decimal(data.kpis.cancelledCount),
                  warn: data.kpis.cancelledCount > 0,
                  hint: `${fmtMoney(data.kpis.cancelledAmount)} anulados`,
                },
                {
                  label: 'Ventas en espera',
                  value: decimal(data.kpis.heldCount),
                  warn: data.kpis.heldCount > 0,
                  hint: `${fmtMoney(data.kpis.heldAmount)} sin cobrar`,
                },
                {
                  label: 'Valor del inventario',
                  value: fmtMoney(data.inventory.stockValue),
                  hint: `${data.inventory.trackedProducts} de ${data.inventory.totalProducts} con control de stock`,
                },
              ]}
            />
          </div>

          <div className="dash-grid">
            <section className="card dash-card span-2">
              <header>
                <h3>Ventas por dia</h3>
                {data.bestDay && data.bestDay.revenue > 0 && (
                  <span className="muted">
                    Mejor dia: {dayLabel(data.bestDay.date)} · {fmtMoney(data.bestDay.revenue)}
                  </span>
                )}
              </header>
              <BarSeries
                data={data.byDay.map((d) => ({
                  label: dayLabel(d.date),
                  value: d.revenue,
                  hint: `${d.tickets} tickets`,
                }))}
                format={fmtMoney}
                labelEvery={data.byDay.length > 14 ? Math.ceil(data.byDay.length / 10) : 1}
                highlightIndex={bestDayIndex}
                empty="Sin ventas en este periodo"
              />
            </section>

            <section className="card dash-card">
              <header>
                <h3>Ventas por hora</h3>
                {data.peakHour && data.peakHour.revenue > 0 && (
                  <span className="muted">
                    Hora pico: {hourLabel(data.peakHour.hour)} · {fmtMoney(data.peakHour.revenue)}
                  </span>
                )}
              </header>
              <BarSeries
                data={data.byHour.map((h) => ({
                  label: String(h.hour).padStart(2, '0'),
                  value: h.revenue,
                  hint: `${h.tickets} tickets`,
                }))}
                format={fmtMoney}
                labelEvery={3}
                highlightIndex={peakHourIndex}
                empty="Sin ventas en este periodo"
              />
            </section>

            <section className="card dash-card no-print">
              <header>
                <h3>Ranking</h3>
                <div className="segmented" role="group" aria-label="Tipo de ranking">
                  {RANK_TABS.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      aria-pressed={rankTab === tab.id}
                      className={rankTab === tab.id ? 'active' : ''}
                      onClick={() => setRankTab(tab.id)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </header>
              <RankList data={visibleRank} format={fmtMoney} empty={RANK_EMPTY[rankTab]} />
              <div className="rank-foot">
                <span className="muted">por ingresos</span>
                <div className="spacer" />
                {rankRows.length > RANK_SHORT && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setRankExpanded((v) => !v)}
                  >
                    {rankExpanded ? `Mostrar ${RANK_SHORT}` : `Mostrar todos (${rankRows.length})`}
                  </button>
                )}
              </div>
            </section>

            <section className="card dash-card no-print">
              <header>
                <h3>Inventario</h3>
                <span className="muted">
                  {data.inventory.outOfStock.length} agotados · {data.inventory.lowStock.length}{' '}
                  con stock bajo
                </span>
              </header>
              {inventoryRows.length ? (
                <table className="table compact inventory-table">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th className="num">Piezas</th>
                      <th>Categoria</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventoryRows.map((p) => (
                      <tr key={`${p.out ? 'out' : 'low'}-${p.id}`}>
                        <td>{p.name}</td>
                        <td className="num">
                          {p.out ? (
                            <span className="badge status-2 plain">Agotado</span>
                          ) : (
                            <span className="stock-badge low">{p.quantity}</span>
                          )}
                        </td>
                        <td className="muted">{p.category || 'Sin categoria'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <EmptyState
                  compact
                  icon="box"
                  title="Inventario en orden"
                  hint="Ningun producto agotado ni con stock bajo"
                />
              )}
              {inventoryAll.length > inventoryCollapsed.length && (
                <div className="rank-foot">
                  <div className="spacer" />
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setInventoryExpanded((v) => !v)}
                  >
                    {inventoryExpanded ? 'Mostrar menos' : `Mostrar todos (${inventoryAll.length})`}
                  </button>
                </div>
              )}
            </section>
          </div>

          {/* Al imprimir: los cuatro rankings completos y todo el inventario, sin controles. */}
          <div className="print-only print-detail">
            {RANK_TABS.map((tab) => (
              <section key={tab.id} className="print-block">
                <h3>{tab.label}</h3>
                <RankList data={rowsFor(tab.id)} format={fmtMoney} empty={RANK_EMPTY[tab.id]} />
              </section>
            ))}
            <section className="print-block">
              <h3>
                Inventario · {data.inventory.outOfStock.length} agotados ·{' '}
                {data.inventory.lowStock.length} con stock bajo
              </h3>
              {inventoryAll.length ? (
                <table className="table compact">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th className="num">Piezas</th>
                      <th>Categoria</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventoryAll.map((p) => (
                      <tr key={`print-${p.out ? 'out' : 'low'}-${p.id}`}>
                        <td>{p.name}</td>
                        <td className="num">{p.out ? 'Agotado' : p.quantity}</td>
                        <td>{p.category || 'Sin categoria'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="muted">Ningun producto agotado ni con stock bajo</p>
              )}
            </section>
          </div>
        </>
      )}

      {!data && !loading && !error && <div className="empty">Sin datos para mostrar</div>}
    </div>
  );
}
