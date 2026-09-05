import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getPosBridge } from '../bridge';
import { Disclosure, Icon } from '../components/ui';
import './LoginPage.css';

const MODES = [
  'Standalone Point of Sale',
  'Network Point of Sale Server',
  'Network Point of Sale Terminal',
] as const;

/** Etiquetas visibles; los valores guardados siguen siendo los originales. */
const MODE_LABELS: Record<string, string> = {
  'Standalone Point of Sale': 'Independiente',
  'Network Point of Sale Server': 'Servidor de red',
  'Network Point of Sale Terminal': 'Terminal de red',
};

export default function LoginPage() {
  const { login, serverError, apiInfo, refreshApiInfo } = useAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showConn, setShowConn] = useState(false);
  const [mode, setMode] = useState(apiInfo?.mode || MODES[0]);
  const [serverIp, setServerIp] = useState(apiInfo?.serverIp || '');
  const [connMsg, setConnMsg] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await refreshApiInfo();
      await login(username.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesion');
    } finally {
      setBusy(false);
    }
  };

  const saveConnection = async () => {
    setConnMsg(null);
    await getPosBridge().setLocalConfig({
      mode,
      serverIp,
      till: apiInfo?.till || 1,
    });
    setConnMsg('Guardado. Reinicia la aplicacion si cambiaste el modo Servidor / Terminal.');
    await refreshApiInfo();
  };

  const needsConn =
    Boolean(serverError) ||
    apiInfo?.mode === 'Network Point of Sale Terminal';

  return (
    <div className="login-wrap">
      <form className="panel login-card" onSubmit={onSubmit}>
        <div className="login-logo">
          <Icon name="store" size={22} />
        </div>
        <h1>Punto de Venta</h1>
        <p>Inicia sesion para abrir la caja</p>

        {(serverError || error) && <div className="error">{serverError || error}</div>}

        <div className="field">
          <label htmlFor="username">Usuario</label>
          <input
            id="username"
            spellCheck={false}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            autoComplete="username"
          />
        </div>
        <div className="field">
          <label htmlFor="password">Contrasena</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
          {busy ? 'Entrando…' : 'Entrar'}
        </button>

        {(needsConn || showConn) && (
          <div className="login-conn">
            <Disclosure
              label="Conexion de red"
              icon="settings"
              open={showConn}
              onToggle={() => setShowConn((v) => !v)}
            >
              <div className="field">
                <label htmlFor="conn-mode">Modo</label>
                <select id="conn-mode" value={mode} onChange={(e) => setMode(e.target.value)}>
                  {MODES.map((m) => (
                    <option key={m} value={m}>
                      {MODE_LABELS[m]}
                    </option>
                  ))}
                </select>
              </div>
              {mode === 'Network Point of Sale Terminal' && (
                <div className="field">
                  <label htmlFor="conn-ip">IP del servidor</label>
                  <input
                    id="conn-ip"
                    value={serverIp}
                    onChange={(e) => setServerIp(e.target.value)}
                    placeholder="192.168.1.10"
                  />
                </div>
              )}
              {connMsg && <div className="notice">{connMsg}</div>}
              <div className="login-conn-actions">
                <button type="button" className="btn btn-soft" onClick={saveConnection}>
                  Guardar
                </button>
                <button type="button" className="btn" onClick={() => refreshApiInfo()}>
                  <Icon name="refresh" size={16} />
                  Reintentar
                </button>
              </div>
            </Disclosure>
          </div>
        )}
      </form>
    </div>
  );
}
