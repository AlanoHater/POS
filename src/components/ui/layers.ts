import { useEffect, useRef } from 'react';

const stack: number[] = [];
let seq = 0;

/**
 * Pila de capas superpuestas (modal, panel lateral, dialogo, menu). Solo la capa
 * de arriba responde a Escape, asi un modal abierto dentro de un panel lateral
 * cierra el modal y no tambien el panel con el formulario a medio llenar.
 */
export function useLayer(open: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const id = ++seq;
    stack.push(id);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (stack[stack.length - 1] !== id) return;
      e.preventDefault();
      onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      const i = stack.indexOf(id);
      if (i >= 0) stack.splice(i, 1);
    };
  }, [open]);
}
