import { useEffect, useMemo, useRef, useState } from 'react';
import './TillView.css';
import {
  api,
  CartItem,
  Category,
  Customer,
  Product,
  Settings,
  Transaction,
  getUploadsBase,
} from '../api/client';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import PaymentPad from '../components/PaymentPad';
import CustomerSelect from '../components/CustomerSelect';
import BarcodeScanner from '../components/BarcodeScanner';
import { ConfirmDialog, EmptyState, Icon, Menu, useToast } from '../components/ui';
import { money } from '../lib/format';

type Props = {
  products: Product[];
  categories: Category[];
  customers: Customer[];
  settings: Settings | null;
  onRefresh: () => Promise<void>;
  holdCount: number;
  onHoldCount: (n: number) => void;
};

export default function TillView({
  products,
  categories,
  customers,
  settings,
  onRefresh,
  holdCount,
  onHoldCount,
}: Props) {
  const { user, apiInfo } = useAuth();
  const { toast } = useToast();
  const scanRef = useRef<HTMLInputElement>(null);
  // Evita cobrar dos veces con Enter repetido o un doble clic mientras responde la API.
  const [paying, setPaying] = useState(false);
  // Rafaga de un lector de codigos: digitos con milisegundos de separacion y un Enter final.
  const lastDigitAt = useRef(0);
  const burst = useRef(0);
  // Cambia cada vez que el carrito se reemplaza: los "Deshacer" antiguos dejan de aplicar.
  const cartEpoch = useRef(0);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [customerId, setCustomerId] = useState('0');
  const [discount, setDiscount] = useState(0);
  const [showDiscount, setShowDiscount] = useState(false);
  const [activeHoldId, setActiveHoldId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHolds, setShowHolds] = useState(false);
  const [holds, setHolds] = useState<Transaction[]>([]);
  const [holdToDelete, setHoldToDelete] = useState<number | null>(null);
  const [deletingHold, setDeletingHold] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [paid, setPaid] = useState('');
  const [paymentType, setPaymentType] = useState(1);
  const [receipt, setReceipt] = useState('');
  const [showCamera, setShowCamera] = useState(false);

  const symbol = settings?.symbol || '$';
  const taxRate = settings?.charge_tax ? Number(settings.percentage) || 0 : 0;
  const uploads = getUploadsBase();

  const refreshHolds = async () => {
    const list = await api.getOnHold();
    setHolds(list);
    onHoldCount(list.length);
  };

  useEffect(() => {
    refreshHolds().catch(() => undefined);
    scanRef.current?.focus();
  }, []);

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      const catOk = categoryFilter === 'all' || p.category === categoryFilter;
      if (!q) return catOk;
      return (
        catOk &&
        (p.name.toLowerCase().includes(q) ||
          String(p.id).includes(q) ||
          (p.barcode || '').toLowerCase().includes(q))
      );
    });
  }, [products, query, categoryFilter]);

  const subtotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const discountAmount = Number(discount) || 0;
  const afterDiscount = Math.max(0, subtotal - discountAmount);
  // Importes en centavos: evita que 11.6348 quede "por debajo" de 11.63 al cobrar con tarjeta.
  const tax = Math.round(afterDiscount * (taxRate / 100) * 100) / 100;
  const total = Math.round((afterDiscount + tax) * 100) / 100;
  const itemCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  const tendered = parseFloat(paid) || 0;
  const enough = Math.round(tendered * 100) >= Math.round(total * 100);
  const canConfirm = showPay && cart.length > 0 && enough && !paying;

  /** Solo se avisa cuando importa: pocas piezas o agotado. */
  const stockOverlay = (p: Product) => {
    if (!p.stock) return null;
    if (p.quantity <= 0) return { text: 'Agotado', className: 'stock-badge overlay out' };
    if (p.quantity <= 5)
      return { text: `Quedan ${p.quantity}`, className: 'stock-badge overlay low' };
    return null;
  };

  const addToCart = (product: Product) => {
    if (product.stock && product.quantity <= 0) {
      setError(`${product.name} esta agotado`);
      return;
    }
    setError(null);
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        if (product.stock && existing.quantity >= product.quantity) {
          setError(`Solo hay ${product.quantity} piezas de ${product.name}`);
          return prev;
        }
        return prev.map((i) =>
          i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          id: product.id,
          name: product.name,
          price: Number(product.price),
          quantity: 1,
          stock: product.quantity,
        },
      ];
    });
  };

  const setQty = (id: number, quantity: number) => {
    setCart((prev) =>
      prev
        .map((i) => (i.id === id ? { ...i, quantity } : i))
        .filter((i) => i.quantity > 0)
    );
  };

  const clearCart = () => {
    cartEpoch.current += 1;
    setCart([]);
    setDiscount(0);
    setShowDiscount(false);
    setActiveHoldId(null);
    setCustomerId('0');
    setError(null);
    scanRef.current?.focus();
  };

  /** Busca un codigo (de barras, id o nombre exacto) y lo agrega al carrito. */
  const addByCode = async (raw: string) => {
    const code = raw.trim();
    if (!code) return;
    try {
      const product = await api.findBySku(code);
      if (product) {
        addToCart(product);
        setQuery('');
        scanRef.current?.focus();
        return;
      }
      // Respaldo local: codigo de barras, id o nombre exacto ya cargados en memoria.
      const local =
        products.find((p) => p.barcode && p.barcode === code) ||
        products.find((p) => String(p.id) === code) ||
        products.find((p) => p.name.toLowerCase() === code.toLowerCase());
      if (local) {
        addToCart(local);
        setQuery('');
        scanRef.current?.focus();
      } else {
        setError(`No hay ningun producto con el codigo "${code}"`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo leer el codigo');
    }
  };

  const onScan = () => addByCode(query);

  const buildTransaction = (status: number, paidAmount: number, changeAmt: number) => {
    const customer = customers.find((c) => String(c.id) === customerId);
    return {
      ref_number: status === 0 ? `H-${Date.now().toString().slice(-6)}` : '',
      customer: customerId,
      customer_name: customer?.name || 'Publico en general',
      status,
      user_id: user?._id || 0,
      user: user?.fullname || '',
      till: apiInfo?.till || settings?.till || 1,
      discount: Number(discount) || 0,
      subtotal,
      tax,
      total,
      paid: paidAmount,
      change: changeAmt,
      payment_type: paymentType,
      items: cart,
      date: new Date().toISOString(),
    };
  };

  /** Actualiza la venta en espera si sigue existiendo; si ya la borraron, la guarda como nueva. */
  const persistSale = async (body: Record<string, unknown>) => {
    if (activeHoldId !== null) {
      try {
        await api.updateTransaction({ ...body, _id: activeHoldId });
        return;
      } catch (err) {
        if (!(err instanceof Error && /ya no existe/i.test(err.message))) throw err;
        setActiveHoldId(null);
      }
    }
    await api.createTransaction(body);
  };

  const holdSale = async () => {
    if (!cart.length) return;
    try {
      const body = buildTransaction(0, 0, 0);
      await persistSale(body);
      clearCart();
      await refreshHolds();
      toast('Venta guardada en espera', { tone: 'ok' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo dejar la venta en espera');
    }
  };

  const openPay = () => {
    // En efectivo se empieza vacio para que el teclado arme el monto recibido, no el total.
    setPaid('');
    setPaymentType(1);
    setShowPay(true);
  };

  const closePay = () => {
    setShowPay(false);
    scanRef.current?.focus();
  };

  const choosePayment = (type: number) => {
    setPaymentType(type);
    if (type === 3) setPaid(total.toFixed(2));
    else setPaid('');
  };

  const sanitizeTendered = (raw: string) => {
    let next = raw.replace(/[^\d.]/g, '');
    const firstDot = next.indexOf('.');
    if (firstDot !== -1) {
      next =
        next.slice(0, firstDot + 1) + next.slice(firstDot + 1).replace(/\./g, '');
      const [whole, dec = ''] = next.split('.');
      next = `${whole}.${dec.slice(0, 2)}`;
    }
    return next;
  };

  const completeSale = async () => {
    if (paying) return;
    const paidNum = parseFloat(paid) || 0;
    if (Math.round(paidNum * 100) < Math.round(total * 100)) {
      setError('El monto recibido es menor que el total');
      return;
    }
    const changeAmt = Math.max(0, Math.round((paidNum - total) * 100) / 100);
    const body = buildTransaction(1, paidNum, changeAmt);
    setPaying(true);
    try {
      await persistSale({ ...body, ref_number: '' });
      const lines = [
        settings?.store || 'Punto de Venta',
        settings?.address_one || '',
        settings?.contact || '',
        '--------------------------------',
        ...cart.map(
          (i) =>
            `${i.quantity} x ${i.name}`.padEnd(24) + money(i.price * i.quantity, symbol)
        ),
        '--------------------------------',
        `Subtotal ${money(subtotal, symbol)}`,
        taxRate ? `${settings?.tax || 'Impuesto'} ${taxRate}% ${money(tax, symbol)}` : '',
        discount ? `Descuento -${money(Number(discount), symbol)}` : '',
        `TOTAL ${money(total, symbol)}`,
        `${paymentType === 3 ? 'Tarjeta' : 'Efectivo'} ${money(paidNum, symbol)}`,
        `Cambio ${money(changeAmt, symbol)}`,
        `Caja ${apiInfo?.till || 1} · ${user?.fullname || ''}`,
        settings?.footer || 'Gracias por su compra',
        new Date().toLocaleString('es-MX'),
      ]
        .filter(Boolean)
        .join('\n');
      setReceipt(lines);
      clearCart();
      setShowPay(false);
      await onRefresh();
      await refreshHolds();
      toast(`Venta cobrada · Cambio ${money(changeAmt, symbol)}`, { tone: 'ok' });
      setTimeout(() => window.print(), 150);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo completar la venta');
    } finally {
      setPaying(false);
    }
  };

  // Ultima version de los manejadores para los atajos globales sin re-suscribir en cada tecla.
  const latest = useRef({ completeSale, canConfirm });
  latest.current = { completeSale, canConfirm };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ventas en espera o su confirmacion por encima del cobro: los atajos del cobro se apagan.
      const layerAbovePay = showHolds || holdToDelete !== null;
      if (e.key === 'F2') {
        e.preventDefault();
        if (cart.length && !showPay && !layerAbovePay) openPay();
        return;
      }
      if (e.key === 'F4') {
        e.preventDefault();
        if (!showPay) openHolds();
        return;
      }
      if (!showPay || layerAbovePay) return;
      // Escape lo resuelve el propio modal (capa superior); aqui solo Enter y la rafaga del lector.
      if (/^[\d.]$/.test(e.key)) {
        const now = Date.now();
        burst.current = now - lastDigitAt.current < 60 ? burst.current + 1 : 1;
        lastDigitAt.current = now;
        return;
      }
      if (e.key === 'Enter') {
        // Enter mantenido: una sola confirmacion.
        if (e.repeat) {
          e.preventDefault();
          return;
        }
        // Cancelar / Confirmar del pie responden solos a Enter.
        const target = e.target as HTMLElement | null;
        if (target?.closest?.('.modal-footer')) return;
        // Tres o mas digitos seguidos y Enter en < 60 ms: es un lector de codigos, no el cajero.
        if (burst.current >= 3 && Date.now() - lastDigitAt.current < 60) {
          e.preventDefault();
          burst.current = 0;
          return;
        }
        // Cualquier otro boton con foco (billete, numpad, forma de pago) no debe re-dispararse.
        e.preventDefault();
        if (latest.current.canConfirm) latest.current.completeSale();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cart, showPay, showHolds, holdToDelete]);

  const openHolds = async () => {
    await refreshHolds();
    setShowHolds(true);
  };

  const restoreHold = (order: Transaction) => {
    cartEpoch.current += 1;
    setCart(order.items || []);
    setCustomerId(String(order.customer || '0'));
    setDiscount(order.discount || 0);
    setShowDiscount(false);
    setActiveHoldId(order.id);
    setShowHolds(false);
    scanRef.current?.focus();
  };

  const discardHold = async (id: number) => {
    setDeletingHold(true);
    try {
      await api.deleteTransaction(id);
      // Si era la venta que estaba retomada en el carrito, ya no existe: la siguiente venta se crea nueva.
      if (activeHoldId === id) setActiveHoldId(null);
      await refreshHolds();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la venta en espera');
    } finally {
      setDeletingHold(false);
      setHoldToDelete(null);
    }
  };

  /** Limpiar desde el boton: reversible durante unos segundos. */
  const clearCartWithUndo = () => {
    if (!cart.length) return;
    const snapshot = { cart, discount, customerId, activeHoldId };
    clearCart();
    const epoch = cartEpoch.current;
    toast('Carrito vaciado', {
      action: {
        label: 'Deshacer',
        onClick: () => {
          if (cartEpoch.current !== epoch) {
            toast('Ya no se puede deshacer: el carrito cambio');
            return;
          }
          setCart(snapshot.cart);
          setDiscount(snapshot.discount);
          setCustomerId(snapshot.customerId);
          setActiveHoldId(snapshot.activeHoldId);
        },
      },
    });
  };

  const removeLine = (item: CartItem) => {
    const epoch = cartEpoch.current;
    setQty(item.id, 0);
    toast(`${item.name} quitado del carrito`, {
      action: {
        label: 'Deshacer',
        onClick: () => {
          if (cartEpoch.current !== epoch) {
            toast('Ya no se puede deshacer: el carrito cambio');
            return;
          }
          setCart((prev) =>
            prev.some((i) => i.id === item.id)
              ? prev.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity + item.quantity } : i))
              : [...prev, item]
          );
        },
      },
    });
  };

  const showAllProducts = () => {
    setQuery('');
    setCategoryFilter('all');
    scanRef.current?.focus();
  };

  const removeDiscount = () => {
    setDiscount(0);
    setShowDiscount(false);
    scanRef.current?.focus();
  };

  return (
    <>
      <div className="till">
        <section className="panel till-left">
          <div className="scan-bar">
            <div className="scan-field">
              <Icon name="search" />
              <input
                ref={scanRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onScan();
                }}
                placeholder="Escanea o busca un producto — Enter para agregar"
                aria-label="Codigo de barras o busqueda"
                autoFocus
              />
            </div>
            {query.trim() && (
              <button type="button" className="btn btn-ghost scan-add" onClick={onScan}>
                Agregar
              </button>
            )}
            <button
              type="button"
              className="btn btn-icon"
              onClick={() => setShowCamera(true)}
              title="Escanear con la camara"
              aria-label="Escanear con la camara"
            >
              <Icon name="camera" />
            </button>
          </div>
          <div className="chips">
            <button
              type="button"
              className={`chip ${categoryFilter === 'all' ? 'active' : ''}`}
              onClick={() => setCategoryFilter('all')}
            >
              Todas
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`chip ${categoryFilter === c.name ? 'active' : ''}`}
                onClick={() => setCategoryFilter(c.name)}
              >
                {c.name}
              </button>
            ))}
          </div>
          <div className="product-grid">
            {filteredProducts.map((p) => {
              const overlay = stockOverlay(p);
              return (
                <button
                  key={p.id}
                  type="button"
                  className="product-tile"
                  onClick={() => addToCart(p)}
                  disabled={!!p.stock && p.quantity <= 0}
                >
                  <div className="product-thumb-wrap">
                    {p.img ? (
                      <img className="product-thumb" src={`${uploads}/${p.img}`} alt="" />
                    ) : (
                      <div className="product-thumb placeholder">
                        <Icon name="box" size={24} />
                      </div>
                    )}
                    {overlay && <span className={overlay.className}>{overlay.text}</span>}
                  </div>
                  <div className="product-tile-body">
                    <strong>{p.name}</strong>
                    <span className="price">{money(Number(p.price), symbol)}</span>
                  </div>
                </button>
              );
            })}
            {!filteredProducts.length &&
              (products.length === 0 ? (
                <EmptyState
                  compact
                  icon="box"
                  title="Todavia no hay productos"
                  hint="Agregalos en Catalogo para verlos aqui"
                />
              ) : (
                <EmptyState
                  compact
                  icon="search"
                  title={
                    query.trim()
                      ? `Sin resultados para "${query.trim()}"`
                      : `Sin productos en ${categoryFilter}`
                  }
                  hint={query.trim() ? 'Revisa el codigo o el nombre' : 'Esta categoria no tiene productos'}
                  action={
                    <button type="button" className="btn btn-sm" onClick={showAllProducts}>
                      Ver todos
                    </button>
                  }
                />
              ))}
          </div>
        </section>

        <section className="panel till-right">
          {error && (
            <div className="error" role="alert">
              {error}
              <button type="button" className="btn btn-ghost" onClick={() => setError(null)}>
                cerrar
              </button>
            </div>
          )}

          <div className="cart-head">
            <CustomerSelect
              customers={customers}
              value={customerId}
              onChange={setCustomerId}
              onCustomersChanged={onRefresh}
            />
            <button type="button" className="btn" onClick={openHolds}>
              En espera {holdCount ? `(${holdCount})` : ''}
              <span className="kbd">F4</span>
            </button>
          </div>

          <div className="cart-list">
            {cart.map((item) => (
              <div className="cart-row" key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <div className="muted num">
                    {item.quantity} x {money(item.price, symbol)}
                  </div>
                </div>
                <div className="qty">
                  <button
                    type="button"
                    onClick={() => setQty(item.id, item.quantity - 1)}
                    aria-label="Quitar una pieza"
                  >
                    <Icon name="minus" size={16} />
                  </button>
                  <span>{item.quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQty(item.id, item.quantity + 1)}
                    aria-label="Agregar una pieza"
                  >
                    <Icon name="plus" size={16} />
                  </button>
                </div>
                <span className="line-total num">{money(item.price * item.quantity, symbol)}</span>
                <button
                  type="button"
                  className="btn btn-icon btn-ghost btn-sm remove"
                  onClick={() => removeLine(item)}
                  aria-label={`Quitar ${item.name}`}
                  title="Quitar del carrito"
                >
                  <Icon name="x" size={16} />
                </button>
              </div>
            ))}
            {!cart.length && (
              <EmptyState
                compact
                icon="cash"
                title="Carrito vacio"
                hint="Escanea un codigo o toca un producto"
              />
            )}
          </div>

          <div className="totals">
            {showDiscount ? (
              <div className="discount-row">
                <div className="field">
                  <label htmlFor="till-discount">Descuento ({symbol})</label>
                  <input
                    id="till-discount"
                    type="number"
                    min={0}
                    step="0.01"
                    value={discount}
                    onChange={(e) => setDiscount(Number(e.target.value))}
                    autoFocus
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-icon btn-ghost"
                  onClick={removeDiscount}
                  aria-label="Quitar descuento"
                  title="Quitar descuento"
                >
                  <Icon name="x" size={16} />
                </button>
              </div>
            ) : (
              <button type="button" className="link" onClick={() => setShowDiscount(true)}>
                <Icon name="percent" size={14} />
                {discountAmount > 0 ? 'Editar descuento' : 'Agregar descuento'}
              </button>
            )}
            <div className="row">
              <span>
                {itemCount} articulo{itemCount === 1 ? '' : 's'}
              </span>
              <span className="num">{money(subtotal, symbol)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="row discount">
                <span>Descuento</span>
                <span className="num">-{money(discountAmount, symbol)}</span>
              </div>
            )}
            {!!taxRate && (
              <div className="row">
                <span>
                  {settings?.tax || 'Impuesto'} {taxRate}%
                </span>
                <span className="num">{money(tax, symbol)}</span>
              </div>
            )}
            <div className="row grand">
              <span>Total</span>
              <span className="num">{money(total, symbol)}</span>
            </div>
          </div>

          <div className="cart-actions">
            <button
              type="button"
              className="btn btn-primary btn-lg pay"
              onClick={openPay}
              disabled={!cart.length}
            >
              Cobrar {money(total, symbol)}
              <span className="kbd">F2</span>
            </button>
            <button type="button" className="btn" onClick={holdSale} disabled={!cart.length}>
              Dejar en espera
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={clearCartWithUndo}
              disabled={!cart.length}
            >
              Limpiar
            </button>
          </div>
        </section>
      </div>

      <pre id="receipt-print" className="receipt" style={{ display: receipt ? 'block' : 'none' }}>
        {receipt}
      </pre>

      <Modal
        title="Cobro"
        open={showPay}
        onClose={paying ? () => undefined : closePay}
        compact
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={closePay} disabled={paying}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={completeSale}
              disabled={!canConfirm}
            >
              {paying ? 'Cobrando…' : 'Confirmar cobro'}
            </button>
          </>
        }
      >
        <div className="pay-due">
          <span className="label">Total a cobrar</span>
          <strong>{money(total, symbol)}</strong>
        </div>
        <div className="pay-methods" role="group" aria-label="Forma de pago">
          <button
            type="button"
            className={`btn ${paymentType === 1 ? 'active' : ''}`}
            onClick={() => choosePayment(1)}
            aria-pressed={paymentType === 1}
          >
            <Icon name="cash" size={16} />
            Efectivo
          </button>
          <button
            type="button"
            className={`btn ${paymentType === 3 ? 'active' : ''}`}
            onClick={() => choosePayment(3)}
            aria-pressed={paymentType === 3}
          >
            <Icon name="card" size={16} />
            Tarjeta
          </button>
        </div>
        {paymentType === 1 ? (
          <>
            <div className="field">
              <label htmlFor="till-tendered">Recibido</label>
              <input
                id="till-tendered"
                value={paid}
                onChange={(e) => setPaid(sanitizeTendered(e.target.value))}
                placeholder="Monto recibido"
                inputMode="decimal"
                className="num"
                autoFocus
              />
            </div>
            <PaymentPad value={paid} onChange={setPaid} due={total} symbol={symbol} />
          </>
        ) : (
          <p className="pay-card-note muted">Se cobrara el importe exacto con tarjeta</p>
        )}
        <p className={`pay-change ${enough ? '' : 'due'}`}>
          {enough ? 'Cambio' : 'Falta'}
          <strong>{money(Math.abs(tendered - total), symbol)}</strong>
        </p>
      </Modal>

      <Modal title="Ventas en espera" open={showHolds} onClose={() => setShowHolds(false)} wide>
        {holds.length ? (
          <div className="table-wrap">
            <table className="table compact holds-table">
              <thead>
                <tr>
                  <th>Ref</th>
                  <th>Cliente</th>
                  <th className="num">Articulos</th>
                  <th className="num">Total</th>
                  <th>Cuando</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {holds.map((h) => (
                  <tr key={h.id}>
                    <td>{h.ref_number || h.id}</td>
                    <td>{h.customer_name}</td>
                    <td className="num">{(h.items || []).reduce((n, i) => n + i.quantity, 0)}</td>
                    <td className="num">{money(Number(h.total), symbol)}</td>
                    <td>{new Date(h.date).toLocaleString('es-MX')}</td>
                    <td className="row-actions">
                      <button type="button" className="btn btn-sm" onClick={() => restoreHold(h)}>
                        Retomar
                      </button>
                      <Menu
                        label="Mas acciones"
                        items={[
                          {
                            label: 'Eliminar',
                            icon: 'trash',
                            danger: true,
                            onSelect: () => setHoldToDelete(h.id),
                          },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            compact
            icon="pause"
            title="No hay ventas en espera"
            hint="Usa Dejar en espera para guardar un carrito y retomarlo despues"
          />
        )}
      </Modal>

      <ConfirmDialog
        open={holdToDelete !== null}
        title="Eliminar la venta en espera?"
        message="El carrito guardado se perdera y no se podra retomar."
        confirmLabel="Eliminar"
        danger
        busy={deletingHold}
        onConfirm={() => {
          if (holdToDelete !== null) discardHold(holdToDelete);
        }}
        onCancel={() => setHoldToDelete(null)}
      />

      <BarcodeScanner
        open={showCamera}
        onClose={() => setShowCamera(false)}
        onDetected={(code) => addByCode(code)}
        title="Escanear producto"
        continuous
      />
    </>
  );
}
