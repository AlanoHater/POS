import { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon';
import { useLayer } from './layers';

type Props = {
  open: boolean;
  title: string;
  /** Linea secundaria bajo el titulo. */
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** Ancho del panel; por defecto 460px. */
  width?: number;
};

/**
 * Panel lateral para formularios de alta/edicion: deja la lista visible
 * detras y se cierra con Escape (solo si es la capa superior), con el fondo
 * o con la X.
 */
export default function Drawer({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  width = 460,
}: Props) {
  useLayer(open, onClose);

  if (!open) return null;

  return createPortal(
    <div className="drawer-backdrop" onMouseDown={onClose}>
      <aside
        className="drawer"
        style={{ width: `min(${width}px, 100vw)` }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="drawer-header">
          <div>
            <h2>{title}</h2>
            {subtitle && <p className="muted">{subtitle}</p>}
          </div>
          <button type="button" className="btn btn-icon btn-ghost" onClick={onClose} aria-label="Cerrar">
            <Icon name="x" />
          </button>
        </header>
        <div className="drawer-body">{children}</div>
        {footer && <footer className="drawer-footer">{footer}</footer>}
      </aside>
    </div>,
    document.body
  );
}
