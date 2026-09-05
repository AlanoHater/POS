import { ReactNode } from 'react';
import Icon, { IconName } from './Icon';

type Props = {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  icon?: IconName;
  /** Numero que se muestra junto a la etiqueta (p. ej. filtros activos). */
  count?: number;
  /** Elementos a la derecha de la barra (acciones). */
  aside?: ReactNode;
};

/**
 * Bloque plegable para opciones secundarias (filtros avanzados, ajustes
 * raros). Cerrado por defecto: lo que no se usa a diario no ocupa pantalla.
 */
export default function Disclosure({
  label,
  open,
  onToggle,
  children,
  icon,
  count,
  aside,
}: Props) {
  return (
    <div className={`disclosure ${open ? 'open' : ''}`}>
      <div className="disclosure-bar">
        <button
          type="button"
          className={`btn ${open ? 'btn-soft' : ''}`}
          onClick={onToggle}
          aria-expanded={open}
        >
          {icon && <Icon name={icon} size={16} />}
          <span>{label}</span>
          {!!count && <span className="count">{count}</span>}
          <Icon name="chevron-down" size={16} className={`icon chevron ${open ? 'up' : ''}`} />
        </button>
        {aside && <div className="disclosure-aside">{aside}</div>}
      </div>
      {open && <div className="disclosure-body">{children}</div>}
    </div>
  );
}
