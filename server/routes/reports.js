import { Router } from 'express';
import { getDb } from '../db.js';
import { requirePerm } from '../auth.js';

const router = Router();

const PAYMENT_LABELS = { 1: 'Efectivo', 3: 'Tarjeta' };

/** Clave YYYY-MM-DD en hora local del equipo (la tienda razona en su propio horario). */
function dayKey(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseItems(row) {
  try {
    const items = JSON.parse(row.items_json || '[]');
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

function unitsOf(items) {
  return items.reduce((sum, i) => sum + (parseInt(i.quantity, 10) || 0), 0);
}

/** Lee las ventas de un rango aplicando los mismos filtros de caja y cajero. */
function loadRows(start, end, { userId, till }) {
  let sql = 'SELECT * FROM transactions WHERE date >= ? AND date <= ?';
  const params = [start, end];
  if (userId) {
    sql += ' AND user_id = ?';
    params.push(userId);
  }
  if (till) {
    sql += ' AND till = ?';
    params.push(till);
  }
  return getDb().prepare(sql).all(...params);
}

/** Indicadores base de un conjunto de ventas pagadas. */
function totalsOf(rows) {
  const paid = rows.filter((r) => r.status === 1);
  const revenue = paid.reduce((s, r) => s + Number(r.total || 0), 0);
  const units = paid.reduce((s, r) => s + unitsOf(parseItems(r)), 0);
  return {
    revenue,
    tickets: paid.length,
    units,
    avgTicket: paid.length ? revenue / paid.length : 0,
    discounts: paid.reduce((s, r) => s + Number(r.discount || 0), 0),
    tax: paid.reduce((s, r) => s + Number(r.tax || 0), 0),
  };
}

function sortDesc(map, key = 'revenue') {
  return Array.from(map.values()).sort((a, b) => b[key] - a[key]);
}

router.get('/summary', requirePerm('perm_transactions'), (req, res) => {
  const startDate = new Date(String(req.query.start || ''));
  const endDate = new Date(String(req.query.end || ''));
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return res.status(400).json({ error: 'Fecha inicial o final no valida' });
  }

  const userId = parseInt(String(req.query.user), 10) || 0;
  const till = parseInt(String(req.query.till), 10) || 0;
  const filters = { userId, till };

  const rows = loadRows(startDate.toISOString(), endDate.toISOString(), filters);

  // Periodo anterior de la misma duracion, para comparar contra el actual.
  const span = Math.max(1, endDate.getTime() - startDate.getTime());
  const prevEnd = new Date(startDate.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - span);
  const prevRows = loadRows(prevStart.toISOString(), prevEnd.toISOString(), filters);

  const paidRows = rows.filter((r) => r.status === 1);
  const cancelledRows = rows.filter((r) => r.status === 2);
  const heldRows = rows.filter((r) => r.status === 0);

  // --- Serie por dia (rellena los dias sin ventas para que la grafica no mienta)
  const dayMap = new Map();
  for (
    let d = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    d <= endDate;
    d.setDate(d.getDate() + 1)
  ) {
    dayMap.set(dayKey(d), { date: dayKey(d), revenue: 0, tickets: 0, units: 0 });
  }

  // --- Serie por hora del dia (para ver las horas pico)
  const hourMap = new Map();
  for (let h = 0; h < 24; h += 1) hourMap.set(h, { hour: h, revenue: 0, tickets: 0 });

  const productMap = new Map();
  const categoryMap = new Map();
  const userMap = new Map();
  const paymentMap = new Map();
  const tillMap = new Map();

  // Categoria de cada producto vendido (los borrados quedan como "Sin categoria").
  const categoryByProduct = new Map(
    getDb()
      .prepare('SELECT id, category FROM products')
      .all()
      .map((p) => [p.id, p.category || 'Sin categoria'])
  );

  for (const row of paidRows) {
    const when = new Date(row.date);
    const items = parseItems(row);
    const units = unitsOf(items);
    const total = Number(row.total || 0);

    const day = dayMap.get(dayKey(when));
    if (day) {
      day.revenue += total;
      day.tickets += 1;
      day.units += units;
    }

    const hour = hourMap.get(when.getHours());
    if (hour) {
      hour.revenue += total;
      hour.tickets += 1;
    }

    const userKey = row.user_id || 0;
    if (!userMap.has(userKey)) {
      userMap.set(userKey, {
        userId: userKey,
        name: row.user_name || 'Sin asignar',
        tickets: 0,
        revenue: 0,
      });
    }
    const userEntry = userMap.get(userKey);
    userEntry.tickets += 1;
    userEntry.revenue += total;

    const payKey = row.payment_type || 1;
    if (!paymentMap.has(payKey)) {
      paymentMap.set(payKey, {
        type: payKey,
        label: PAYMENT_LABELS[payKey] || 'Otro',
        tickets: 0,
        revenue: 0,
      });
    }
    const payEntry = paymentMap.get(payKey);
    payEntry.tickets += 1;
    payEntry.revenue += total;

    const tillKey = row.till || 1;
    if (!tillMap.has(tillKey)) {
      tillMap.set(tillKey, { till: tillKey, tickets: 0, revenue: 0 });
    }
    const tillEntry = tillMap.get(tillKey);
    tillEntry.tickets += 1;
    tillEntry.revenue += total;

    for (const item of items) {
      const id = parseInt(item.id ?? item._id, 10) || 0;
      const qty = parseInt(item.quantity, 10) || 0;
      const lineRevenue = (Number(item.price) || 0) * qty;
      const name = item.name || `Producto ${id}`;

      const pKey = id || name;
      if (!productMap.has(pKey)) {
        productMap.set(pKey, { id, name, units: 0, revenue: 0 });
      }
      const product = productMap.get(pKey);
      product.units += qty;
      product.revenue += lineRevenue;

      const category = categoryByProduct.get(id) || 'Sin categoria';
      if (!categoryMap.has(category)) {
        categoryMap.set(category, { category, units: 0, revenue: 0 });
      }
      const cat = categoryMap.get(category);
      cat.units += qty;
      cat.revenue += lineRevenue;
    }
  }

  // --- Inventario accionable
  const products = getDb().prepare('SELECT * FROM products').all();
  const tracked = products.filter((p) => p.stock);
  const outOfStock = tracked
    .filter((p) => (p.quantity || 0) <= 0)
    .map((p) => ({ id: p.id, name: p.name, quantity: p.quantity, category: p.category }));
  const lowStock = tracked
    .filter((p) => (p.quantity || 0) > 0 && (p.quantity || 0) <= 5)
    .sort((a, b) => a.quantity - b.quantity)
    .map((p) => ({ id: p.id, name: p.name, quantity: p.quantity, category: p.category }));
  const stockValue = tracked.reduce(
    (s, p) => s + (Number(p.price) || 0) * (p.quantity || 0),
    0
  );

  const current = totalsOf(rows);
  const previous = totalsOf(prevRows);

  const byDay = Array.from(dayMap.values());
  const bestDay = byDay.reduce(
    (best, d) => (!best || d.revenue > best.revenue ? d : best),
    null
  );
  const byHour = Array.from(hourMap.values());
  const peakHour = byHour.reduce(
    (best, h) => (!best || h.revenue > best.revenue ? h : best),
    null
  );

  res.json({
    range: {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      previousStart: prevStart.toISOString(),
      previousEnd: prevEnd.toISOString(),
    },
    kpis: {
      ...current,
      cancelledCount: cancelledRows.length,
      cancelledAmount: cancelledRows.reduce((s, r) => s + Number(r.total || 0), 0),
      heldCount: heldRows.length,
      heldAmount: heldRows.reduce((s, r) => s + Number(r.total || 0), 0),
      productsSold: productMap.size,
    },
    previous,
    byDay,
    byHour,
    bestDay,
    peakHour,
    topProducts: sortDesc(productMap).slice(0, 10),
    slowProducts: sortDesc(productMap).slice(-5).reverse(),
    byCategory: sortDesc(categoryMap),
    byUser: sortDesc(userMap),
    byPayment: sortDesc(paymentMap),
    byTill: sortDesc(tillMap),
    inventory: {
      totalProducts: products.length,
      trackedProducts: tracked.length,
      outOfStock,
      lowStock,
      stockValue,
    },
  });
});

export default router;
