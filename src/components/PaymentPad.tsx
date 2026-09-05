import { useMemo, useRef } from 'react';

type Props = {
  value: string;
  onChange: (value: string) => void;
  due: number;
  symbol: string;
};

// Billetes de uso comun; el simbolo de moneda viene de Ajustes.
const BILLETES = [20, 50, 100, 200, 500, 1000];
// Exacto + los billetes que superan el total, sin pasar de este numero de botones.
const MAX_QUICK = 5;

function formatAmount(n: number) {
  return n.toFixed(2);
}

/** Montos rapidos: "Exacto" y los siguientes billetes redondos por encima del total. */
export function quickCashOptions(due: number) {
  const above = BILLETES.filter((note) => note > due + 0.0001);
  return Array.from(new Set(above)).slice(0, MAX_QUICK - 1);
}

export default function PaymentPad({ value, onChange, due, symbol }: Props) {
  // Tras elegir Exacto o un billete, el siguiente digito reemplaza en vez de sumarse.
  const replaceNext = useRef(false);
  const notes = useMemo(() => quickCashOptions(due), [due]);

  const setAmount = (amount: number) => {
    onChange(formatAmount(amount));
    replaceNext.current = true;
  };

  const append = (key: string) => {
    if (key === 'C') {
      onChange('');
      replaceNext.current = false;
      return;
    }
    if (key === '⌫') {
      onChange(value.slice(0, -1));
      replaceNext.current = false;
      return;
    }

    if (key === '.') {
      if (replaceNext.current || !value) {
        onChange('0.');
        replaceNext.current = false;
        return;
      }
      if (value.includes('.')) return;
      onChange(`${value}.`);
      return;
    }

    if (replaceNext.current || value === '' || value === '0') {
      onChange(key);
      replaceNext.current = false;
      return;
    }

    const next = value + key;
    const [, dec] = next.split('.');
    if (dec && dec.length > 2) return;
    onChange(next);
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];
  const quickCount = notes.length + 1;

  return (
    <>
      <div className={`quick-cash count-${quickCount}`}>
        <button type="button" className="btn" onClick={() => setAmount(due)}>
          Exacto
        </button>
        {notes.map((note) => (
          <button
            key={note}
            type="button"
            className="btn num"
            onClick={() => setAmount(note)}
          >
            {symbol}
            {note}
          </button>
        ))}
      </div>
      <div className="numpad">
        {keys.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => append(k)}
            aria-label={k === '⌫' ? 'Borrar' : undefined}
          >
            {k}
          </button>
        ))}
        <button type="button" className="numpad-clear" onClick={() => append('C')}>
          Limpiar
        </button>
      </div>
    </>
  );
}
