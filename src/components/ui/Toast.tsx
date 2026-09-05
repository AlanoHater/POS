import { createContext, ReactNode, useCallback, useContext, useMemo, useRef, useState } from 'react';
import Icon from './Icon';

type ToastTone = 'default' | 'ok' | 'danger';

export type ToastOptions = {
  tone?: ToastTone;
  /** Accion opcional (p. ej. "Deshacer"). Al pulsarla el aviso se cierra. */
  action?: { label: string; onClick: () => void };
  /** Milisegundos en pantalla; 5 s por defecto, un poco mas si hay accion. */
  duration?: number;
};

type ToastItem = ToastOptions & { id: number; message: string };

type ToastApi = {
  toast: (message: string, options?: ToastOptions) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const MAX_VISIBLE = 3;

/**
 * Un solo contenedor de avisos breves, anclado abajo a la izquierda del area
 * de trabajo (lejos del carrito y del boton Cobrar). Para confirmaciones de
 * acciones reversibles: "Linea quitada · Deshacer".
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, options: ToastOptions = {}) => {
      const id = nextId.current++;
      const duration = options.duration ?? (options.action ? 6000 : 4000);
      setItems((prev) => [...prev.slice(-(MAX_VISIBLE - 1)), { id, message, ...options }]);
      window.setTimeout(() => dismiss(id), duration);
    },
    [dismiss]
  );

  const api = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toaster" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.tone || 'default'}`} role="status">
            {t.tone === 'ok' && <Icon name="check" size={16} />}
            {t.tone === 'danger' && <Icon name="alert" size={16} />}
            <span className="toast-text">{t.message}</span>
            {t.action && (
              <button
                type="button"
                className="toast-action"
                onClick={() => {
                  t.action?.onClick();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
            <button
              type="button"
              className="toast-close"
              onClick={() => dismiss(t.id)}
              aria-label="Cerrar aviso"
            >
              <Icon name="x" size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fuera del proveedor (p. ej. pruebas) los avisos se ignoran en vez de fallar.
    return { toast: () => undefined };
  }
  return ctx;
}
