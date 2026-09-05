import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon, { IconName } from './Icon';
import { useLayer } from './layers';

export type MenuItem = {
  label: string;
  onSelect: () => void;
  icon?: IconName;
  /** Accion destructiva: se pinta en rojo y se coloca al final por convencion. */
  danger?: boolean;
  disabled?: boolean;
  /** Dibuja un separador antes de este elemento. */
  divider?: boolean;
};

type Props = {
  items: MenuItem[];
  /** Texto accesible del boton (por defecto "Mas acciones"). */
  label?: string;
  /** Contenido del boton; si se omite se usa el icono de tres puntos. */
  trigger?: ReactNode;
  /** Clases del boton disparador; por defecto un boton de icono fantasma. */
  buttonClassName?: string;
  /** Clase extra que se suma a las del disparador. */
  className?: string;
  disabled?: boolean;
  align?: 'start' | 'end';
};

/**
 * Menu desplegable de acciones secundarias. Se renderiza en un portal con
 * posicion fija para que no lo recorten contenedores con overflow.
 */
export default function Menu({
  items,
  label = 'Mas acciones',
  trigger,
  buttonClassName = 'btn btn-icon btn-ghost',
  className = '',
  disabled,
  align = 'end',
}: Props) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; right: number }>({
    top: 0,
    left: 0,
    right: 0,
  });
  const [active, setActive] = useState(-1);

  const close = () => {
    setOpen(false);
    btnRef.current?.focus();
  };

  useLayer(open, close);

  const place = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const panelH = panelRef.current?.offsetHeight ?? 0;
    const below = r.bottom + 6;
    const fitsBelow = below + panelH <= window.innerHeight - 8;
    setPos({
      top: fitsBelow ? below : Math.max(8, r.top - panelH - 6),
      left: r.left,
      right: window.innerWidth - r.right,
    });
  };

  useLayoutEffect(() => {
    if (open) place();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !btnRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const enabled = items.map((it, i) => (it.disabled ? -1 : i)).filter((i) => i >= 0);
        if (!enabled.length) return;
        const idx = enabled.indexOf(active);
        const next =
          e.key === 'ArrowDown'
            ? enabled[(idx + 1) % enabled.length]
            : enabled[(idx - 1 + enabled.length) % enabled.length];
        setActive(next);
        (panelRef.current?.querySelectorAll<HTMLButtonElement>('button')[next])?.focus();
      }
    };
    const onScroll = () => place();
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onScroll);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, items, active]);

  const style: React.CSSProperties =
    align === 'end'
      ? { position: 'fixed', top: pos.top, right: pos.right }
      : { position: 'fixed', top: pos.top, left: pos.left };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`${buttonClassName} ${className}`.trim()}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={trigger ? undefined : label}
        title={trigger ? undefined : label}
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          setActive(-1);
          setOpen((v) => !v);
        }}
      >
        {trigger ?? <Icon name="more" />}
      </button>
      {open &&
        createPortal(
          <div ref={panelRef} className="menu" role="menu" style={style}>
            {items.map((it, i) => (
              <div key={`${it.label}-${i}`}>
                {it.divider && <div className="menu-divider" />}
                <button
                  type="button"
                  role="menuitem"
                  className={`menu-item ${it.danger ? 'danger' : ''}`}
                  disabled={it.disabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(false);
                    it.onSelect();
                  }}
                >
                  {it.icon && <Icon name={it.icon} size={16} />}
                  <span>{it.label}</span>
                </button>
              </div>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}
