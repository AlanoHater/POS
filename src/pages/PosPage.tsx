import { useEffect, useMemo, useState } from 'react';
import { api, Category, Customer, Product, Settings, Transaction } from '../api/client';
import { useAuth } from '../context/AuthContext';
import AppShell, { NavView } from '../layout/AppShell';
import TillView from './TillView';
import CatalogView from './CatalogView';
import SettingsView from './SettingsView';
import DashboardView from './DashboardView';
import SalesHistoryView from './SalesHistoryView';
import CustomersView from './CustomersView';
import TeamView from './TeamView';

export default function PosPage() {
  const { hasPerm } = useAuth();
  const [view, setView] = useState<NavView>('till');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [holdCount, setHoldCount] = useState(0);
  const [todayTotal, setTodayTotal] = useState(0);

  const symbol = settings?.symbol || '$';

  const loadAll = async () => {
    const [p, c, cust, s] = await Promise.all([
      api.getProducts(),
      api.getCategories(),
      api.getCustomers(),
      api.getSettings(),
    ]);
    setProducts(p);
    setCategories(c);
    setCustomers(cust);
    setSettings(s.settings);

    if (hasPerm('perm_transactions')) {
      try {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const sales = await api.getByDate({
          start: start.toISOString(),
          end: new Date().toISOString(),
          user: 0,
          till: 0,
          status: 1,
        });
        setTodayTotal(sales.reduce((sum: number, t: Transaction) => sum + Number(t.total || 0), 0));
      } catch {
        /* los cajeros sin permiso ya quedan filtrados */
      }
    }

    try {
      const holds = await api.getOnHold();
      setHoldCount(holds.length);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    loadAll().catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    // Solo manda a Ajustes cuando la tienda YA cargo y no tiene nombre (primer arranque).
    if (settings && !settings.store && hasPerm('perm_settings')) {
      setView('settings');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const title = useMemo(() => {
    switch (view) {
      case 'till':
        return 'Caja';
      case 'dashboard':
        return 'Panel de control';
      case 'catalog':
        return 'Catalogo';
      case 'sales':
        return 'Historial de ventas';
      case 'customers':
        return 'Clientes';
      case 'team':
        return 'Personal';
      case 'settings':
        return 'Ajustes';
      default:
        return 'Punto de Venta';
    }
  }, [view, settings]);

  return (
    <AppShell
      view={view}
      onNavigate={setView}
      title={title}
      logo={settings?.img || ''}
      storeName={settings?.store || ''}
      todaySales={
        hasPerm('perm_transactions')
          ? `${symbol}${todayTotal.toFixed(2)}`
          : undefined
      }
      stats={
        view === 'till' && holdCount > 0 ? (
          <span className="stat-pill">{holdCount} en espera</span>
        ) : null
      }
    >
      {error && (
        <div className="error">
          {error}{' '}
          <button type="button" className="btn btn-ghost" onClick={() => setError(null)}>
            cerrar
          </button>
        </div>
      )}

      {view === 'till' && (
        <TillView
          products={products}
          categories={categories}
          customers={customers}
          settings={settings}
          holdCount={holdCount}
          onHoldCount={setHoldCount}
          onRefresh={loadAll}
        />
      )}

      {view === 'catalog' && (
        <CatalogView
          products={products}
          categories={categories}
          symbol={symbol}
          canProducts={hasPerm('perm_products')}
          canCategories={hasPerm('perm_categories')}
          onChanged={loadAll}
        />
      )}

      {view === 'dashboard' && (
        <DashboardView symbol={symbol} storeName={settings?.store || ''} />
      )}

      {view === 'sales' && (
        <SalesHistoryView symbol={symbol} settings={settings} onChanged={loadAll} />
      )}

      {view === 'customers' && (
        <CustomersView customers={customers} onChanged={loadAll} />
      )}

      {view === 'team' && <TeamView />}

      {view === 'settings' && (
        <SettingsView settings={settings} onSaved={loadAll} />
      )}
    </AppShell>
  );
}
