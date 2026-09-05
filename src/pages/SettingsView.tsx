import { useEffect, useState } from 'react';
import { api, Settings } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { getPosBridge } from '../bridge';
import PhotoPicker from '../components/PhotoPicker';
import { ConfirmDialog } from '../components/ui';
import './SettingsView.css';

type Props = {
  settings: Settings | null;
  onSaved: () => Promise<void>;
};

const MODES = [
  'Standalone Point of Sale',
  'Network Point of Sale Server',
  'Network Point of Sale Terminal',
] as const;

/** Etiquetas visibles; el valor guardado en la BD no cambia. */
const MODE_LABELS: Record<string, string> = {
  'Standalone Point of Sale': 'Independiente',
  'Network Point of Sale Server': 'Servidor de red',
  'Network Point of Sale Terminal': 'Terminal de red',
};

const CLEAR_WARNING =
  'Esto borra TODOS los productos, categorias, historial de ventas y clientes. No se puede deshacer.';

export default function SettingsView({ settings, onSaved }: Props) {
  const { apiInfo, refreshApiInfo } = useAuth();
  const [form, setForm] = useState({
    app: MODES[0] as string,
    store: '',
    address_one: '',
    address_two: '',
    contact: '',
    tax: '',
    symbol: '$',
    percentage: '0',
    charge_tax: false,
    footer: '',
    img: '',
    till: '1',
    ip: '',
    pexels_api_key: '',
  });
  const [lanIp, setLanIp] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [demoBusy, setDemoBusy] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    (async () => {
      const info = await refreshApiInfo();
      setLanIp(info.lanIp);
      const s = settings;
      setForm({
        app: s?.app || MODES[0],
        store: s?.store || '',
        address_one: s?.address_one || '',
        address_two: s?.address_two || '',
        contact: s?.contact || '',
        tax: s?.tax || '',
        symbol: s?.symbol || '$',
        percentage: String(s?.percentage ?? 0),
        charge_tax: !!s?.charge_tax,
        footer: s?.footer || '',
        img: s?.img || '',
        till: String(s?.till || info.till || 1),
        ip: s?.ip || info.serverIp || '',
        pexels_api_key: s?.pexels_api_key || '',
      });
    })();
  }, [settings]);

  const save = async () => {
    setError(null);
    setMessage(null);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (k === 'charge_tax') fd.append(k, form.charge_tax ? '1' : '0');
        else fd.append(k, String(v));
      });

      await getPosBridge().setLocalConfig({
        mode: form.app,
        serverIp: form.ip,
        till: parseInt(form.till, 10) || 1,
      });

      if (form.app !== 'Network Point of Sale Terminal') {
        await api.saveSettings(fd);
      } else {
        try {
          await api.saveSettings(fd);
        } catch {
          /* local prefs still saved */
        }
      }

      setMessage('Guardado. Reinicia la aplicacion si cambiaste el modo Independiente / Servidor / Terminal.');
      await refreshApiInfo();
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar');
    }
  };

  const isTerminal = form.app === 'Network Point of Sale Terminal';
  const isServer = form.app === 'Network Point of Sale Server';

  const seedDemo = async () => {
    setError(null);
    setMessage(null);
    setDemoBusy(true);
    try {
      const result = await api.seedDemo();
      setMessage(result.message);
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la demostracion');
    } finally {
      setDemoBusy(false);
    }
  };

  const clearDemo = async () => {
    setError(null);
    setMessage(null);
    setDemoBusy(true);
    try {
      const result = await api.clearDemo();
      setMessage(result.message);
      setConfirmClear(false);
      await onSaved();
    } catch (err) {
      setConfirmClear(false);
      setError(err instanceof Error ? err.message : 'No se pudo borrar');
    } finally {
      setDemoBusy(false);
    }
  };

  return (
    <div className="settings">
      {error && <div className="error">{error}</div>}
      {message && <div className="notice">{message}</div>}

      <section className="card settings-section">
        <header>
          <h2>Tienda</h2>
          <p>Nombre, direccion y datos que aparecen en el ticket.</p>
        </header>
        <div className="field">
          <label htmlFor="st-store">Nombre de la tienda</label>
          <input
            id="st-store"
            value={form.store}
            onChange={(e) => setForm({ ...form, store: e.target.value })}
          />
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="st-addr1">Direccion</label>
            <input
              id="st-addr1"
              value={form.address_one}
              onChange={(e) => setForm({ ...form, address_one: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="st-addr2">Direccion (linea 2)</label>
            <input
              id="st-addr2"
              value={form.address_two}
              onChange={(e) => setForm({ ...form, address_two: e.target.value })}
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="st-contact">Contacto</label>
          <input
            id="st-contact"
            value={form.contact}
            onChange={(e) => setForm({ ...form, contact: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="st-footer">Pie del ticket</label>
          <input
            id="st-footer"
            value={form.footer}
            onChange={(e) => setForm({ ...form, footer: e.target.value })}
          />
        </div>
        <PhotoPicker
          label="Logo de la tienda"
          value={form.img}
          onChange={(img) => setForm({ ...form, img })}
          suggestedQuery={form.store || 'logo de tienda'}
        />
      </section>

      <section className="card settings-section">
        <header>
          <h2>Impuestos y moneda</h2>
          <p>Como se calculan y se muestran los importes.</p>
        </header>
        <div className="field settings-narrow">
          <label htmlFor="st-symbol">Simbolo de moneda</label>
          <input
            id="st-symbol"
            value={form.symbol}
            onChange={(e) => setForm({ ...form, symbol: e.target.value })}
          />
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={form.charge_tax}
            onChange={(e) => setForm({ ...form, charge_tax: e.target.checked })}
          />
          Cobrar impuesto en las ventas
        </label>
        {form.charge_tax && (
          <div className="field-row">
            <div className="field">
              <label htmlFor="st-tax">Nombre del impuesto</label>
              <input
                id="st-tax"
                value={form.tax}
                onChange={(e) => setForm({ ...form, tax: e.target.value })}
                placeholder="IVA"
              />
            </div>
            <div className="field">
              <label htmlFor="st-pct">Impuesto %</label>
              <input
                id="st-pct"
                type="number"
                min={0}
                step="0.01"
                value={form.percentage}
                onChange={(e) => setForm({ ...form, percentage: e.target.value })}
              />
            </div>
          </div>
        )}
      </section>

      <section className="card settings-section">
        <header>
          <h2>Caja y red</h2>
          <p>Modo de trabajo de esta caja y conexion con otras terminales.</p>
        </header>
        <div className="field">
          <label htmlFor="st-mode">Modo</label>
          <select
            id="st-mode"
            value={form.app}
            onChange={(e) => setForm({ ...form, app: e.target.value })}
          >
            {MODES.map((m) => (
              <option key={m} value={m}>
                {MODE_LABELS[m]}
              </option>
            ))}
          </select>
        </div>
        {isTerminal && (
          <div className="field">
            <label htmlFor="st-ip">IP del servidor</label>
            <input
              id="st-ip"
              value={form.ip}
              onChange={(e) => setForm({ ...form, ip: e.target.value })}
              placeholder="192.168.1.10"
            />
          </div>
        )}
        {isServer && (
          <div className="banner info">
            <span>
              Las terminales deben conectarse a <strong>{lanIp}</strong> en el puerto 8001.
            </span>
          </div>
        )}
        <div className="field settings-narrow">
          <label htmlFor="st-till">Numero de caja</label>
          <input
            id="st-till"
            type="number"
            min={1}
            value={form.till}
            onChange={(e) => setForm({ ...form, till: e.target.value })}
          />
          {apiInfo && <span className="hint">API {apiInfo.baseUrl}</span>}
        </div>
      </section>

      <section className="card settings-section">
        <header>
          <h2>Imagenes</h2>
          <p>Fotos de productos desde una biblioteca local del servidor.</p>
        </header>
        <div className="field">
          <label htmlFor="st-pexels">Llave de Pexels</label>
          <input
            id="st-pexels"
            type="password"
            value={form.pexels_api_key}
            onChange={(e) => setForm({ ...form, pexels_api_key: e.target.value })}
            placeholder="Pega la llave de pexels.com/api"
            autoComplete="off"
          />
          <span className="hint">
            Sirve para buscar y descargar fotos de productos. Consigue una llave gratis en{' '}
            <a href="https://www.pexels.com/api/" target="_blank" rel="noreferrer">
              pexels.com/api
            </a>
            .
          </span>
        </div>
      </section>

      <div className="settings-actions">
        <button type="button" className="btn btn-primary" onClick={save}>
          Guardar ajustes
        </button>
      </div>

      <section className="card settings-section danger-zone">
        <header>
          <h2>Datos de demostracion</h2>
          <p>
            Carga un catalogo de ejemplo (categorias, productos y clientes) o borra el catalogo y
            las ventas para empezar de cero. El personal y los ajustes se conservan.
          </p>
        </header>
        <div className="settings-demo-actions">
          <button type="button" className="btn" disabled={demoBusy} onClick={seedDemo}>
            Cargar catalogo de ejemplo
          </button>
          <button
            type="button"
            className="btn btn-danger-ghost"
            disabled={demoBusy}
            onClick={() => setConfirmClear(true)}
          >
            Borrar catalogo y ventas
          </button>
        </div>
      </section>

      <ConfirmDialog
        open={confirmClear}
        title="Borrar catalogo y ventas?"
        message={CLEAR_WARNING}
        confirmLabel="Borrar todo"
        danger
        busy={demoBusy}
        onConfirm={clearDemo}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  );
}
