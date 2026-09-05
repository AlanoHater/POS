import { ReactNode, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { getPosBridge } from '../bridge';
import { getUploadsBase } from '../api/client';
import { Icon, IconName, Menu } from '../components/ui';

/** Etiquetas en espanol para los modos; el valor guardado en la BD no cambia. */
const MODE_LABELS: Record<string, string> = {
  'Standalone Point of Sale': 'Independiente',
  'Network Point of Sale Server': 'Servidor',
  'Network Point of Sale Terminal': 'Terminal',
};

export type NavView =
  | 'till'
  | 'dashboard'
  | 'catalog'
  | 'sales'
  | 'customers'
  | 'team'
  | 'settings';

type Props = {
  view: NavView;
  onNavigate: (view: NavView) => void;
  title: string;
  /** Linea corta junto al titulo (contexto, no datos). */
  subtitle?: string;
  stats?: ReactNode;
  children: ReactNode;
  todaySales?: string;
  logo?: string;
  storeName?: string;
};

export default function AppShell({
  view,
  onNavigate,
  title,
  subtitle,
  stats,
  children,
  todaySales,
  logo,
  storeName,
}: Props) {
  const { user, logout, hasPerm, apiInfo } = useAuth();
  const mainRef = useRef<HTMLElement>(null);

  // Cada vista empieza arriba: el scroll de la anterior no se hereda.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [view]);

  const logoSrc = logo ? `${getUploadsBase()}/${logo}` : '';

  // Dos grupos: lo que se usa todo el dia (operar) y lo que se abre de vez en cuando (administrar).
  const operate: { id: NavView; label: string; icon: IconName; show: boolean }[] = [
    { id: 'till', label: 'Caja', icon: 'cash', show: true },
    { id: 'dashboard', label: 'Panel', icon: 'chart', show: hasPerm('perm_transactions') },
    { id: 'sales', label: 'Historial', icon: 'receipt', show: hasPerm('perm_transactions') },
  ];
  const manage: { id: NavView; label: string; icon: IconName; show: boolean }[] = [
    { id: 'catalog', label: 'Catalogo', icon: 'box', show: hasPerm('perm_products') || hasPerm('perm_categories') },
    { id: 'customers', label: 'Clientes', icon: 'users', show: true },
    { id: 'team', label: 'Personal', icon: 'user', show: hasPerm('perm_users') },
    { id: 'settings', label: 'Ajustes', icon: 'settings', show: hasPerm('perm_settings') },
  ];

  const renderItems = (items: typeof operate) =>
    items
      .filter((i) => i.show)
      .map((item) => (
        <button
          key={item.id}
          type="button"
          className={`nav-btn ${view === item.id ? 'active' : ''}`}
          onClick={() => onNavigate(item.id)}
          aria-current={view === item.id ? 'page' : undefined}
        >
          <Icon name={item.icon} />
          {item.label}
        </button>
      ));

  const initials = (user?.fullname || user?.username || '?').slice(0, 1).toUpperCase();

  return (
    <div className="app">
      <aside className="nav no-print">
        <div className="nav-brand">
          {logoSrc ? (
            <img className="nav-logo" src={logoSrc} alt="" />
          ) : (
            <div className="nav-logo nav-logo-fallback" aria-hidden>
              <Icon name="store" size={18} />
            </div>
          )}
          <div className="nav-brand-text">
            <strong title={storeName || 'Punto de Venta'}>{storeName || 'Punto de Venta'}</strong>
            <span>
              {MODE_LABELS[apiInfo?.mode || ''] || 'Independiente'} · Caja {apiInfo?.till || 1}
            </span>
          </div>
        </div>

        {renderItems(operate)}
        {manage.some((i) => i.show) && <div className="nav-section">Administrar</div>}
        {renderItems(manage)}

        <div className="nav-spacer" />

        <div className="nav-user">
          <div className="avatar" aria-hidden>
            {initials}
          </div>
          <div className="nav-user-meta">
            <strong>{user?.fullname}</strong>
            <span>{user?.username}</span>
          </div>
          <Menu
            label="Opciones de sesion"
            items={[
              { label: 'Cerrar sesion', icon: 'logout', onSelect: () => logout() },
              { label: 'Salir de la aplicacion', icon: 'power', onSelect: () => getPosBridge().quit(), divider: true },
            ]}
          />
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar no-print">
          <h1>{title}</h1>
          {subtitle && <span className="topbar-sub">{subtitle}</span>}
          {stats}
          <div className="spacer" />
          {todaySales != null && (
            <div className="topbar-stat" title="Ventas cobradas hoy">
              <span>Hoy</span>
              <strong>{todaySales}</strong>
            </div>
          )}
        </header>
        <main ref={mainRef} className="main">{children}</main>
      </div>
    </div>
  );
}
