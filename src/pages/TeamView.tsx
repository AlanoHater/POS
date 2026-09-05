import { useEffect, useState } from 'react';
import { api, User } from '../api/client';
import { ConfirmDialog, Drawer, Icon, Menu } from '../components/ui';
import './TeamView.css';

const PERMS = [
  ['perm_products', 'Productos del catalogo'],
  ['perm_categories', 'Categorias'],
  ['perm_transactions', 'Historial y panel'],
  ['perm_users', 'Personal'],
  ['perm_settings', 'Ajustes'],
] as const;

type PermKey = (typeof PERMS)[number][0];

type UserForm = {
  id: string;
  username: string;
  password: string;
  fullname: string;
} & Record<PermKey, boolean>;

const EMPTY_FORM: UserForm = {
  id: '',
  username: '',
  password: '',
  fullname: '',
  perm_products: true,
  perm_categories: true,
  perm_transactions: true,
  perm_users: false,
  perm_settings: false,
};

export default function TeamView() {
  return <UsersPanel />;
}

function initial(name: string) {
  return (name.trim().charAt(0) || '?').toUpperCase();
}

function permSummary(u: User) {
  if (u.id === 1) return 'Acceso total';
  const labels = PERMS.filter(([key]) => !!u[key]).map(([, label]) => label);
  return labels.length ? labels.join(', ') : 'Solo caja';
}

function UsersPanel() {
  const [list, setList] = useState<Awaited<ReturnType<typeof api.getUsers>>>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState<UserForm>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => setList(await api.getUsers());

  useEffect(() => {
    load().catch((err) => setLoadError(err.message));
  }, []);

  const openNew = () => {
    setForm(EMPTY_FORM);
    setError(null);
    setDrawerOpen(true);
  };

  const openEdit = (u: User) => {
    setForm({
      id: String(u.id),
      username: u.username,
      password: '',
      fullname: u.fullname,
      perm_products: !!u.perm_products,
      perm_categories: !!u.perm_categories,
      perm_transactions: !!u.perm_transactions,
      perm_users: !!u.perm_users,
      perm_settings: !!u.perm_settings,
    });
    setError(null);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    if (saving) return;
    setDrawerOpen(false);
  };

  const save = async () => {
    setError(null);
    if (!form.username.trim() || !form.fullname.trim()) {
      setError('El usuario y el nombre completo son obligatorios');
      return;
    }
    if (!form.id && !form.password) {
      setError('La contrasena es obligatoria para usuarios nuevos');
      return;
    }
    setSaving(true);
    try {
      await api.saveUser({ ...form });
      await load();
      setForm(EMPTY_FORM);
      setDrawerOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    setDeleting(true);
    setLoadError(null);
    try {
      await api.deleteUser(toDelete.id);
      setToDelete(null);
      await load();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'No se pudo eliminar el usuario');
      setToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="team">
      <div className="toolbar">
        {list.length > 0 && (
          <span className="team-count">
            {list.length} {list.length === 1 ? 'usuario' : 'usuarios'}
          </span>
        )}
        <div className="spacer" />
        <button type="button" className="btn btn-primary" onClick={openNew}>
          <Icon name="plus" size={16} />
          Nuevo usuario
        </button>
      </div>

      {loadError && (
        <div className="error">
          <span>{loadError}</span>
          <button type="button" className="btn" onClick={() => setLoadError(null)}>
            Cerrar
          </button>
        </div>
      )}

      <div className="card team-card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Permisos</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((u) => (
                <tr key={u.id} className="clickable" onClick={() => openEdit(u)}>
                  <td>
                    <div className="team-user">
                      <span className="avatar small">{initial(u.fullname || u.username)}</span>
                      <div>
                        <strong>{u.fullname}</strong>
                        <span className="secondary">{u.username}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`team-perms ${u.id === 1 ? 'all' : ''}`}>{permSummary(u)}</span>
                  </td>
                  <td className="row-actions">
                    <Menu
                      label={`Acciones de ${u.username}`}
                      items={[
                        { label: 'Editar', icon: 'edit', onSelect: () => openEdit(u) },
                        ...(u.id === 1
                          ? []
                          : [
                              {
                                label: 'Eliminar',
                                icon: 'trash' as const,
                                danger: true,
                                divider: true,
                                onSelect: () => setToDelete(u),
                              },
                            ]),
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Drawer
        open={drawerOpen}
        width={440}
        title={form.id ? 'Editar usuario' : 'Nuevo usuario'}
        onClose={closeDrawer}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={closeDrawer} disabled={saving}>
              Cancelar
            </button>
            <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar usuario'}
            </button>
          </>
        }
      >
        <div className="team-drawer">
          {error && <div className="error">{error}</div>}
          <div className="field">
            <label htmlFor="user-username">Usuario</label>
            <input
              id="user-username"
              autoFocus
              autoComplete="off"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="user-fullname">Nombre completo</label>
            <input
              id="user-fullname"
              value={form.fullname}
              onChange={(e) => setForm({ ...form, fullname: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="user-password">Contrasena</label>
            <input
              id="user-password"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            {form.id && <span className="hint">Dejalo vacio para no cambiarla</span>}
          </div>

          <div className="section-title">Permisos</div>
          {PERMS.map(([key, label]) => (
            <label key={key} className="check">
              <input
                type="checkbox"
                checked={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
              />
              {label}
            </label>
          ))}
        </div>
      </Drawer>

      <ConfirmDialog
        open={toDelete !== null}
        danger
        busy={deleting}
        title="Eliminar usuario"
        message={
          toDelete
            ? `${toDelete.fullname} (${toDelete.username}) dejara de poder entrar al sistema. Sus ventas registradas se conservan.`
            : ''
        }
        confirmLabel="Eliminar"
        onConfirm={remove}
        onCancel={() => {
          if (!deleting) setToDelete(null);
        }}
      />
    </div>
  );
}
