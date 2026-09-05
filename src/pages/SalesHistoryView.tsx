import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './SalesHistoryView.css';
import { api, Settings, Transaction, User } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { ConfirmDialog, Disclosure, Drawer, EmptyState, Icon, Menu, MenuItem } from '../components/ui';
import {
  PRESET_LABELS,
  RangePreset,
  dateTime,
  decimal,
  downloadFile,
  fileStamp,
  localInputToIso,
  money,
  paymentLabel,
  presetRange,
  statusLabel,
  toCsv,
  toLocalInputValue,
} from '../lib/format';

type Props = {
  symbol: string;
  settings: Settings | null;
  /** Se llama cuando una cancelacion devuelve piezas al inventario. */
  onChanged: () => Promise<void>;
};

const STATUS_OPTIONS = [
  { value: -1, label: 'Todas' },
  { value: 1, label: 'Pagadas' },
  { value: 0, label: 'En espera' },
  { value: 2, label: 'Canceladas' },
];

function unitsOf(t: Transaction) {
  return (t.items || []).reduce((n, i) => n + (Number(i.quantity) || 0), 0);
}

export default function SalesHistoryView({ symbol, settings, onChanged }: Props) {
  const { user } = useAuth();
  const initial = presetRange('30dias');

  const [preset, setPreset] = useState<RangePreset | 'personalizado'>('30dias');
  const [start, setStart] = useState(toLocalInputValue(initial.start));
  const [end, setEnd] = useState(toLocalInputValue(initial.end));
  const [userId, setUserId] = useState(0);
  const [till, setTill] = useState(0);
  const [status, setStatus] = useState(-1);
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [rows, setRows] = useState<Transaction[]>([]);
  // Rango de la ultima consulta: el encabezado impreso debe coincidir con las filas.
  const [applied, setApplied] = useState({ start: initial.start, end: initial.end, status: -1 });
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [detail, setDetail] = useState<Transaction | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Transaction | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [busy, setBusy] = useState(false);
  const [printMode, setPrintMode] = useState<'reporte' | 'ticket'>('reporte');
  const [ticket, setTicket] = useState<Transaction | null>(null);
  const reasonRef = useRef<HTMLInputElement>(null);

  const fmt = (v: number) => money(v, symbol);

  const load = async (
    from = start,
    to = end,
    u = userId,
    t = till,
    st = status
  ) => {
    setLoading(true);
    setError(null);
    try {
      const [list, allUsers] = await Promise.all([
        api.getByDate({
          start: localInputToIso(from),
          end: localInputToIso(to, true),
          user: u,
          till: t,
          status: st,
        }),
        api.getUsers().catch(() => [] as User[]),
      ]);
      setRows(list);
      setUsers(allUsers);
      setApplied({
        start: new Date(localInputToIso(from)),
        end: new Date(localInputToIso(to, true)),
        status: st,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el historial');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- carga inicial; los filtros recargan solos
  }, []);

  // El dialogo de anulacion enfoca su boton seguro al abrir; el motivo debe quedar listo para escribir.
  useEffect(() => {
    if (cancelTarget) reasonRef.current?.focus();
  }, [cancelTarget]);

  const applyPreset = (id: RangePreset) => {
    const range = presetRange(id);
    const from = toLocalInputValue(range.start);
    const to = toLocalInputValue(range.end);
    setPreset(id);
    setStart(from);
    setEnd(to);
    load(from, to);
  };

  // La busqueda por texto se aplica sobre lo ya cargado: es instantanea.
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        String(r.id).includes(q) ||
        (r.customer_name || '').toLowerCase().includes(q) ||
        (r.user || '').toLowerCase().includes(q) ||
        (r.ref_number || '').toLowerCase().includes(q)
    );
  }, [rows, search]);

  const totals = useMemo(() => {
    const paid = visible.filter((r) => r.status === 1);
    const revenue = paid.reduce((s, r) => s + Number(r.total || 0), 0);
    return {
      count: visible.length,
      paidCount: paid.length,
      revenue,
      average: paid.length ? revenue / paid.length : 0,
      cancelled: visible.filter((r) => r.status === 2).length,
      units: paid.reduce((s, r) => s + unitsOf(r), 0),
    };
  }, [visible]);

  // Filtros secundarios activos: fechas fuera de un preset, cajero o caja concretos.
  const activeFilters =
    (preset === 'personalizado' ? 1 : 0) + (userId ? 1 : 0) + (till ? 1 : 0);

  const rangeText = `${applied.start.toLocaleString('es-MX')} — ${applied.end.toLocaleString(
    'es-MX'
  )}`;

  // --- Exportaciones -------------------------------------------------------

  const exportSales = () => {
    const header = [
      'Folio',
      'Fecha',
      'Cajero',
      'Caja',
      'Cliente',
      'Piezas',
      'Subtotal',
      'Descuento',
      'Impuesto',
      'Total',
      'Pagado',
      'Cambio',
      'Forma de pago',
      'Estado',
      'Cancelada el',
      'Cancelada por',
      'Motivo',
    ];
    const body = visible.map((r) => [
      r.id,
      dateTime(r.date),
      r.user,
      r.till,
      r.customer_name,
      unitsOf(r),
      Number(r.subtotal || 0).toFixed(2),
      Number(r.discount || 0).toFixed(2),
      Number(r.tax || 0).toFixed(2),
      Number(r.total || 0).toFixed(2),
      Number(r.paid || 0).toFixed(2),
      Number(r.change || 0).toFixed(2),
      paymentLabel(r.payment_type),
      statusLabel(r.status),
      r.cancelled_at ? dateTime(r.cancelled_at) : '',
      r.cancelled_by || '',
      r.cancel_reason || '',
    ]);
    downloadFile(`ventas-${fileStamp()}.csv`, toCsv([header, ...body]));
  };

  const exportLines = () => {
    const header = [
      'Folio',
      'Fecha',
      'Estado',
      'Cajero',
      'Cliente',
      'Producto',
      'Cantidad',
      'Precio unitario',
      'Importe',
    ];
    const body = visible.flatMap((r) =>
      (r.items || []).map((i) => [
        r.id,
        dateTime(r.date),
        statusLabel(r.status),
        r.user,
        r.customer_name,
        i.name,
        i.quantity,
        Number(i.price || 0).toFixed(2),
        (Number(i.price || 0) * Number(i.quantity || 0)).toFixed(2),
      ])
    );
    downloadFile(`ventas-detalle-${fileStamp()}.csv`, toCsv([header, ...body]));
  };

  // --- Acciones sobre una venta -------------------------------------------

  const askCancel = (row: Transaction) => {
    setCancelTarget(row);
    setCancelReason('');
    setDetail(null);
  };

  // Estables: los dialogos re-enfocan su boton cada vez que cambia onCancel.
  const closeCancel = useCallback(() => {
    setCancelTarget(null);
    setCancelReason('');
  }, []);
  const closeDelete = useCallback(() => setDeleteTarget(null), []);
  const closeDetail = useCallback(() => setDetail(null), []);

  const confirmCancel = async () => {
    if (!cancelTarget) return;
    setBusy(true);
    setError(null);
    try {
      await api.cancelTransaction(
        cancelTarget.id,
        cancelReason.trim(),
        user?.fullname || user?.username || ''
      );
      setNotice(`Venta #${cancelTarget.id} cancelada. El inventario fue restituido.`);
      setCancelTarget(null);
      setCancelReason('');
      await load();
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cancelar la venta');
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const row = deleteTarget;
    setBusy(true);
    setError(null);
    try {
      await api.deleteTransaction(row.id);
      setNotice(`Venta #${row.id} eliminada del historial.`);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la venta');
    } finally {
      setBusy(false);
    }
  };

  const printReport = () => {
    setPrintMode('reporte');
    setTicket(null);
    setTimeout(() => window.print(), 100);
  };

  const printTicket = (row: Transaction) => {
    setPrintMode('ticket');
    setTicket(row);
    setTimeout(() => window.print(), 100);
  };

  const rowMenu = (r: Transaction): MenuItem[] => [
    { label: 'Ver detalle', icon: 'eye', onSelect: () => setDetail(r) },
    { label: 'Reimprimir ticket', icon: 'printer', onSelect: () => printTicket(r) },
    ...(r.status !== 2
      ? [
          {
            label: 'Anular venta',
            icon: 'ban' as const,
            divider: true,
            disabled: busy,
            onSelect: () => askCancel(r),
          },
        ]
      : []),
    {
      label: 'Eliminar registro',
      icon: 'trash',
      danger: true,
      divider: r.status === 2,
      disabled: busy,
      onSelect: () => setDeleteTarget(r),
    },
  ];

  const exportMenu: MenuItem[] = [
    { label: 'Exportar ventas (CSV)', icon: 'download', disabled: !visible.length, onSelect: exportSales },
    { label: 'Exportar detalle (CSV)', icon: 'download', disabled: !visible.length, onSelect: exportLines },
    { label: 'Imprimir reporte', icon: 'printer', disabled: !visible.length, onSelect: printReport },
  ];

  // --- Ticket reimprimible -------------------------------------------------

  const ticketText = (t: Transaction) => {
    const taxRate = settings?.charge_tax ? Number(settings.percentage) || 0 : 0;
    return [
      settings?.store || 'Punto de Venta',
      settings?.address_one || '',
      settings?.address_two || '',
      settings?.contact || '',
      '--------------------------------',
      `REIMPRESION · Folio ${t.id}`,
      `${dateTime(t.date)}`,
      `Cajero: ${t.user || '—'}   Caja: ${t.till}`,
      `Cliente: ${t.customer_name || 'Publico en general'}`,
      '--------------------------------',
      ...(t.items || []).map(
        (i) =>
          `${i.quantity} x ${i.name}`.padEnd(24) +
          money(Number(i.price) * Number(i.quantity), symbol)
      ),
      '--------------------------------',
      `Subtotal ${money(t.subtotal, symbol)}`,
      Number(t.discount) ? `Descuento -${money(t.discount, symbol)}` : '',
      taxRate ? `${settings?.tax || 'Impuesto'} ${taxRate}% ${money(t.tax, symbol)}` : '',
      `TOTAL ${money(t.total, symbol)}`,
      `${paymentLabel(t.payment_type)} ${money(t.paid, symbol)}`,
      `Cambio ${money(t.change, symbol)}`,
      t.status === 2 ? '*** VENTA CANCELADA ***' : '',
      t.status === 2 && t.cancel_reason ? `Motivo: ${t.cancel_reason}` : '',
      t.status === 0 ? '*** VENTA EN ESPERA (NO PAGADA) ***' : '',
      '--------------------------------',
      settings?.footer || 'Gracias por su compra',
      `Reimpreso ${new Date().toLocaleString('es-MX')}`,
    ]
      .filter(Boolean)
      .join('\n');
  };

  return (
    <>
      <div className="history">
        {error && <div className="error">{error}</div>}
        {notice && (
          <div className="notice">
            {notice}
            <button type="button" className="btn btn-ghost" onClick={() => setNotice(null)}>
              Cerrar
            </button>
          </div>
        )}

        {/* ---------- Barra de herramientas ---------- */}
        <div className="toolbar">
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
          <div className="toolbar-search">
            <Icon name="search" size={16} />
            <input
              className="input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Folio, cliente o cajero"
              aria-label="Buscar"
            />
          </div>
          <div className="segmented" role="group" aria-label="Estado">
            {STATUS_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                className={status === o.value ? 'active' : ''}
                aria-pressed={status === o.value}
                onClick={() => {
                  setStatus(o.value);
                  load(start, end, userId, till, o.value);
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
          <div className="spacer" />
          <Menu
            label="Exportar"
            buttonClassName="btn"
            disabled={!visible.length}
            items={exportMenu}
            trigger={
              <>
                <Icon name="download" size={16} /> Exportar <Icon name="chevron-down" size={16} />
              </>
            }
          />
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
              <label htmlFor="history-start">Desde</label>
              <input
                id="history-start"
                type="datetime-local"
                value={start}
                onChange={(e) => {
                  setStart(e.target.value);
                  setPreset('personalizado');
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="history-end">Hasta</label>
              <input
                id="history-end"
                type="datetime-local"
                value={end}
                onChange={(e) => {
                  setEnd(e.target.value);
                  setPreset('personalizado');
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="history-user">Cajero</label>
              <select
                id="history-user"
                value={userId}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  setUserId(value);
                  load(start, end, value, till, status);
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
              <label htmlFor="history-till">Caja (0 = todas)</label>
              <input
                id="history-till"
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

        {/* ---------- Resumen ---------- */}
        <div className="history-summary">
          <div>
            <span className="muted">Ventas</span>
            <strong>{decimal(totals.count)}</strong>
          </div>
          <div>
            <span className="muted">Ingresos</span>
            <strong>{fmt(totals.revenue)}</strong>
          </div>
          <div>
            <span className="muted">Ticket promedio</span>
            <strong>{fmt(totals.average)}</strong>
          </div>
          <div>
            <span className="muted">Canceladas</span>
            <strong className={totals.cancelled > 0 ? 'warn' : ''}>
              {decimal(totals.cancelled)}
            </strong>
          </div>
          <div className="history-loading" aria-live="polite">
            {loading && rows.length > 0 ? 'Actualizando…' : ''}
          </div>
        </div>

        {/* ---------- Tabla ---------- */}
        <div className="card history-card" aria-busy={loading}>
          {visible.length > 0 && (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Folio</th>
                    <th>Cliente</th>
                    <th className="num">Piezas</th>
                    <th>Pago</th>
                    <th className="num">Total</th>
                    <th>Estado</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => (
                    <tr
                      key={r.id}
                      className={`clickable ${r.status === 2 ? 'row-cancelled' : ''}`}
                      onClick={() => setDetail(r)}
                    >
                      <td>
                        <strong>{r.id}</strong>
                        <span className="secondary">{dateTime(r.date)}</span>
                      </td>
                      <td>
                        {r.customer_name || 'Publico en general'}
                        <span className="secondary">
                          Cajero: {r.user || '—'} · Caja {r.till}
                        </span>
                      </td>
                      <td className="num">{unitsOf(r)}</td>
                      <td>{paymentLabel(r.payment_type)}</td>
                      <td className="num">
                        <span className="money">{fmt(r.total)}</span>
                      </td>
                      <td>
                        <span className={`badge status-${r.status}`}>{statusLabel(r.status)}</span>
                      </td>
                      <td className="row-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="btn btn-icon btn-ghost btn-sm"
                          aria-label="Reimprimir ticket"
                          title="Reimprimir ticket"
                          onClick={() => printTicket(r)}
                        >
                          <Icon name="printer" size={16} />
                        </button>
                        <Menu className="btn-sm" items={rowMenu(r)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!visible.length && loading && <div className="empty">Cargando…</div>}
          {!visible.length && !loading && (
            <EmptyState
              icon="receipt"
              title="No hay ventas con estos filtros"
              hint="Cambia el periodo o el estado para ver mas resultados"
            />
          )}
        </div>
      </div>

      {/* ---------- Detalle de una venta ---------- */}
      <Drawer
        open={!!detail}
        title={detail ? `Venta #${detail.id}` : 'Venta'}
        subtitle={detail ? dateTime(detail.date) : undefined}
        onClose={closeDetail}
        width={520}
        footer={
          detail ? (
            <>
              <button type="button" className="btn" onClick={() => printTicket(detail)}>
                <Icon name="printer" size={16} /> Reimprimir ticket
              </button>
              {detail.status !== 2 && (
                <button
                  type="button"
                  className="btn btn-danger-ghost"
                  disabled={busy}
                  onClick={() => askCancel(detail)}
                >
                  <Icon name="ban" size={16} /> Anular venta
                </button>
              )}
            </>
          ) : null
        }
      >
        {detail && (
          <div className="history-detail">
            <div className="detail-grid">
              <div>
                <span className="muted">Cajero</span>
                <strong>{detail.user || '—'}</strong>
              </div>
              <div>
                <span className="muted">Caja</span>
                <strong>{detail.till}</strong>
              </div>
              <div>
                <span className="muted">Cliente</span>
                <strong>{detail.customer_name || 'Publico en general'}</strong>
              </div>
              <div>
                <span className="muted">Forma de pago</span>
                <strong>{paymentLabel(detail.payment_type)}</strong>
              </div>
              <div>
                <span className="muted">Estado</span>
                <strong>
                  <span className={`badge status-${detail.status}`}>
                    {statusLabel(detail.status)}
                  </span>
                </strong>
              </div>
            </div>

            {detail.status === 2 && (
              <div className="notice">
                Cancelada el {dateTime(detail.cancelled_at || '')} por{' '}
                {detail.cancelled_by || 'un usuario'}.
                {detail.cancel_reason ? ` Motivo: ${detail.cancel_reason}` : ''}
              </div>
            )}

            <div className="table-wrap">
              <table className="table compact">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th className="num">Cantidad</th>
                    <th className="num">Precio</th>
                    <th className="num">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {(detail.items || []).map((i, index) => (
                    <tr key={`${i.id}-${index}`}>
                      <td>{i.name}</td>
                      <td className="num">{i.quantity}</td>
                      <td className="num">{fmt(i.price)}</td>
                      <td className="num">{fmt(Number(i.price) * Number(i.quantity))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="totals">
              <div className="row">
                <span>Subtotal</span>
                <span>{fmt(detail.subtotal)}</span>
              </div>
              {!!Number(detail.discount) && (
                <div className="row">
                  <span>Descuento</span>
                  <span>-{fmt(detail.discount)}</span>
                </div>
              )}
              {!!Number(detail.tax) && (
                <div className="row">
                  <span>{settings?.tax || 'Impuesto'}</span>
                  <span>{fmt(detail.tax)}</span>
                </div>
              )}
              <div className="row grand">
                <span>Total</span>
                <span>{fmt(detail.total)}</span>
              </div>
              <div className="row">
                <span>Pagado</span>
                <span>{fmt(detail.paid)}</span>
              </div>
              <div className="row">
                <span>Cambio</span>
                <span>{fmt(detail.change)}</span>
              </div>
            </div>
          </div>
        )}
      </Drawer>

      {/* ---------- Confirmacion de anulacion ---------- */}
      <ConfirmDialog
        open={!!cancelTarget}
        danger
        title={`Anular la venta #${cancelTarget?.id ?? ''}?`}
        message={
          cancelTarget ? (
            <>
              La venta <strong>#{cancelTarget.id}</strong> por{' '}
              <strong>{fmt(cancelTarget.total)}</strong> quedara marcada como cancelada.{' '}
              {cancelTarget.status === 1
                ? 'Las piezas vendidas regresaran al inventario. La venta se conserva en el historial para auditoria.'
                : 'La venta se conserva en el historial. No habia inventario descontado.'}
            </>
          ) : (
            ''
          )
        }
        confirmLabel="Anular venta"
        cancelLabel="Conservar venta"
        busy={busy}
        onConfirm={confirmCancel}
        onCancel={closeCancel}
      >
        <div className="field">
          <label htmlFor="history-cancel-reason">Motivo (opcional)</label>
          <input
            id="history-cancel-reason"
            ref={reasonRef}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Devolucion, error de cobro…"
            autoFocus
          />
        </div>
      </ConfirmDialog>

      {/* ---------- Confirmacion de eliminacion ---------- */}
      <ConfirmDialog
        open={!!deleteTarget}
        danger
        title={`Eliminar el registro #${deleteTarget?.id ?? ''}?`}
        message={
          'Esta accion no se puede deshacer y no devuelve piezas al inventario. ' +
          'Si solo quieres anularla, usa Anular venta.'
        }
        confirmLabel="Eliminar registro"
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={closeDelete}
      />

      {/* ---------- Area imprimible (solo visible al imprimir) ---------- */}
      <div id="print-area" className="print-only">
        {printMode === 'ticket' && ticket ? (
          <pre className="receipt receipt-80">{ticketText(ticket)}</pre>
        ) : (
          <div className="print-report">
            <h2>{settings?.store || 'Punto de Venta'} · Historial de ventas</h2>
            <p>
              Periodo: {rangeText}
              <br />
              Estado: {STATUS_OPTIONS.find((o) => o.value === applied.status)?.label}
              {userId ? ` · Cajero: ${users.find((u) => u.id === userId)?.fullname || ''}` : ''}
              {till ? ` · Caja: ${till}` : ''}
              <br />
              Generado el {new Date().toLocaleString('es-MX')}
            </p>
            <table className="table">
              <thead>
                <tr>
                  <th>Folio</th>
                  <th>Fecha</th>
                  <th>Cajero</th>
                  <th>Cliente</th>
                  <th>Piezas</th>
                  <th>Pago</th>
                  <th>Estado</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    <td>{dateTime(r.date)}</td>
                    <td>{r.user || '—'}</td>
                    <td>{r.customer_name || 'Publico en general'}</td>
                    <td>{unitsOf(r)}</td>
                    <td>{paymentLabel(r.payment_type)}</td>
                    <td>{statusLabel(r.status)}</td>
                    <td>{fmt(r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="print-totals">
              <div>
                Ventas: <strong>{decimal(totals.count)}</strong> (pagadas{' '}
                {decimal(totals.paidCount)}, canceladas {decimal(totals.cancelled)})
              </div>
              <div>
                Piezas vendidas: <strong>{decimal(totals.units)}</strong>
              </div>
              <div>
                Ticket promedio: <strong>{fmt(totals.average)}</strong>
              </div>
              <div className="print-grand">
                Total cobrado: <strong>{fmt(totals.revenue)}</strong>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
