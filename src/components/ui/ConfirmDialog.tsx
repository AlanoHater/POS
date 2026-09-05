import { ReactNode, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon';
import { useLayer } from './layers';

type Props = {
  open: boolean;
  title: string;
  /** Explica la consecuencia, no repitas la pregunta. */
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Pinta el boton de confirmar en rojo: la accion no se puede deshacer. */
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
};

/**
 * Sustituye a window.confirm(): mismo flujo, pero con jerarquia visual clara
 * (accion destructiva en rojo, cancelar neutro) y foco en el boton seguro.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger,
  busy,
  onConfirm,
  onCancel,
  children,
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Mientras la accion esta en curso el dialogo no se puede descartar (ni Escape ni el fondo).
  useLayer(open, () => {
    if (!busy) onCancel();
  });

  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={() => {
        if (!busy) onCancel();
      }}
    >
      <div
        className="modal modal-confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-body confirm-body">
          <div className={`confirm-icon ${danger ? 'danger' : ''}`}>
            <Icon name={danger ? 'alert' : 'info'} size={20} />
          </div>
          <div className="confirm-text">
            <h3 id="confirm-title">{title}</h3>
            <p>{message}</p>
            {children}
          </div>
        </div>
        <div className="modal-footer">
          <button ref={cancelRef} type="button" className="btn" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Un momento…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
