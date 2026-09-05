import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, BrowserCodeReader } from '@zxing/browser';
import type { IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import Modal from './Modal';

type Props = {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
  title?: string;
  /** Si es true la camara sigue leyendo despues de cada codigo (util en la caja). */
  continuous?: boolean;
};

/** Formatos habituales de retail: acota la busqueda y acelera la lectura. */
const FORMATS = [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.ITF,
  BarcodeFormat.QR_CODE,
];

const CAMERA_KEY = 'pos_camara_preferida';

export default function BarcodeScanner({
  open,
  onClose,
  onDetected,
  title = 'Escanear codigo de barras',
  continuous = false,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  // Evita que un mismo codigo se dispare varias veces por segundo.
  const lastRef = useRef<{ code: string; at: number }>({ code: '', at: 0 });

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string>(
    () => localStorage.getItem(CAMERA_KEY) || ''
  );
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('Iniciando camara…');
  const [lastCode, setLastCode] = useState('');

  // Enumera las camaras disponibles al abrir.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await BrowserCodeReader.listVideoInputDevices();
        if (cancelled) return;
        setDevices(list);
        if (!list.length) {
          setError('No se detecto ninguna camara en este equipo.');
          return;
        }
        setDeviceId((current) =>
          current && list.some((d) => d.deviceId === current)
            ? current
            : list[list.length - 1].deviceId
        );
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? `No se pudo acceder a la camara: ${err.message}`
              : 'No se pudo acceder a la camara.'
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Arranca (y reinicia al cambiar de camara) el lector continuo.
  useEffect(() => {
    if (!open || !deviceId) return;

    let cancelled = false;
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, FORMATS);
    hints.set(DecodeHintType.TRY_HARDER, true);
    const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120 });

    (async () => {
      try {
        setError(null);
        setStatus('Apunta el codigo hacia la camara…');
        const controls = await reader.decodeFromVideoDevice(
          deviceId,
          videoRef.current || undefined,
          (result) => {
            if (!result) return; // sin lectura en este cuadro: es lo normal
            const code = result.getText().trim();
            if (!code) return;

            const now = Date.now();
            if (lastRef.current.code === code && now - lastRef.current.at < 1500) return;
            lastRef.current = { code, at: now };

            setLastCode(code);
            onDetected(code);
            if (!continuous) {
              controls.stop();
              controlsRef.current = null;
              onClose();
            }
          }
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
        localStorage.setItem(CAMERA_KEY, deviceId);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setError(
          /permission|denied|notallowed/i.test(message)
            ? 'Permiso de camara denegado. Habilitalo y vuelve a intentar.'
            : `No se pudo iniciar la camara: ${message}`
        );
      }
    })();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [open, deviceId, continuous]);

  // Libera la camara al cerrar el modal.
  useEffect(() => {
    if (open) return;
    controlsRef.current?.stop();
    controlsRef.current = null;
    setLastCode('');
    lastRef.current = { code: '', at: 0 };
  }, [open]);

  return (
    <Modal
      title={title}
      open={open}
      onClose={onClose}
      footer={
        <button type="button" className="btn" onClick={onClose}>
          Cerrar
        </button>
      }
    >
      {error ? (
        <div className="error">{error}</div>
      ) : (
        <p className="muted" style={{ marginTop: 0 }}>
          {status}
        </p>
      )}

      <div className="scanner-frame">
        <video ref={videoRef} muted playsInline />
        <div className="scanner-guide" aria-hidden />
      </div>

      {devices.length > 1 && (
        <div className="field" style={{ marginTop: '0.75rem' }}>
          <label>Camara</label>
          <select value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
            {devices.map((d, i) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Camara ${i + 1}`}
              </option>
            ))}
          </select>
        </div>
      )}

      {lastCode && (
        <p className="scanner-last">
          Ultimo codigo leido: <strong>{lastCode}</strong>
        </p>
      )}

      <p className="muted" style={{ fontSize: '0.85rem', marginBottom: 0 }}>
        Tambien puedes usar un lector fisico USB: escribe el codigo en el campo de busqueda
        y funciona sin abrir la camara.
      </p>
    </Modal>
  );
}
