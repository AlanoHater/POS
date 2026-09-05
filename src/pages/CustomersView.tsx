import { useEffect, useMemo, useState } from 'react';
import { api, Customer } from '../api/client';
import { ConfirmDialog, Drawer, EmptyState, Icon, Menu } from '../components/ui';
import './CustomersView.css';

/** Cliente por defecto de las ventas sin cliente: no se lista. */
const GUEST_NAME = 'Walk-in Customer';

type CustomerForm = {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
};

const EMPTY_FORM: CustomerForm = { id: '', name: '', phone: '', email: '', address: '' };

export default function CustomersView({
  customers,
  onChanged,
}: {
  customers: Customer[];
  onChanged: () => Promise<void>;
}) {
  return (
    <CustomersPanel customers={customers} onChanged={onChanged} />
  );
}

function initial(name: string) {
  return (name.trim().charAt(0) || '?').toUpperCase();
}

function CustomersPanel({
  customers,
  onChanged,
}: {
  customers: Customer[];
  onChanged: () => Promise<void>;
}) {
  const [list, setList] = useState(customers);
  const [query, setQuery] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState<CustomerForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setList(customers), [customers]);

  const visible = useMemo(() => list.filter((c) => c.name !== GUEST_NAME), [list]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return visible;
    return visible.filter((c) =>
      [c.name, c.phone, c.email].some((v) => (v || '').toLowerCase().includes(q))
    );
  }, [visible, query]);

  const openNew = () => {
    setForm(EMPTY_FORM);
    setFormError(null);
    setDrawerOpen(true);
  };

  const openEdit = (c: Customer) => {
    setForm({
      id: String(c.id),
      name: c.name,
      phone: c.phone,
      email: c.email,
      address: c.address,
    });
    setFormError(null);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    if (saving) return;
    setDrawerOpen(false);
  };

  const save = async () => {
    if (!form.name.trim()) {
      setFormError('El nombre es obligatorio');
      return;
    }
    setFormError(null);
    setSaving(true);
    try {
      if (form.id) {
        await api.updateCustomer({
          _id: form.id,
          id: Number(form.id),
          name: form.name,
          phone: form.phone,
          email: form.email,
          address: form.address,
        });
      } else {
        await api.saveCustomer({
          name: form.name,
          phone: form.phone,
          email: form.email,
          address: form.address,
        });
      }
      setForm(EMPTY_FORM);
      setDrawerOpen(false);
      await onChanged();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar el cliente');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    setDeleting(true);
    setError(null);
    try {
      await api.deleteCustomer(toDelete.id);
      setToDelete(null);
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el cliente');
      setToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="customers">
      <div className="toolbar">
        <div className="toolbar-search">
          <Icon name="search" size={16} />
          <input
            className="input"
            placeholder="Buscar por nombre, telefono o correo"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Buscar cliente"
          />
        </div>
        {visible.length > 0 && (
          <span className="customers-count">
            {filtered.length === visible.length
              ? `${visible.length} ${visible.length === 1 ? 'cliente' : 'clientes'}`
              : `${filtered.length} de ${visible.length}`}
          </span>
        )}
        <div className="spacer" />
        <button type="button" className="btn btn-primary" onClick={openNew}>
          <Icon name="plus" size={16} />
          Nuevo cliente
        </button>
      </div>

      {error && (
        <div className="error">
          <span>{error}</span>
          <button type="button" className="btn" onClick={() => setError(null)}>
            Cerrar
          </button>
        </div>
      )}

      <div className="card customers-card">
        {visible.length === 0 ? (
          <EmptyState
            icon="users"
            title="Todavia no hay clientes"
            hint="Los clientes te sirven para ligar ventas y ver su historial"
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            compact
            icon="search"
            title="Sin resultados"
            hint="Prueba con otro nombre, telefono o correo"
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Telefono</th>
                  <th>Direccion</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="clickable" onClick={() => openEdit(c)}>
                    <td>
                      <div className="customers-name">
                        <span className="avatar small">{initial(c.name)}</span>
                        <div>
                          <strong>{c.name}</strong>
                          {c.email && <span className="secondary">{c.email}</span>}
                        </div>
                      </div>
                    </td>
                    <td>{c.phone || <span className="subtle">—</span>}</td>
                    <td>
                      {c.address ? (
                        <span className="customers-address" title={c.address}>
                          {c.address}
                        </span>
                      ) : (
                        <span className="subtle">—</span>
                      )}
                    </td>
                    <td className="row-actions">
                      <Menu
                        label={`Acciones de ${c.name}`}
                        items={[
                          { label: 'Editar', icon: 'edit', onSelect: () => openEdit(c) },
                          {
                            label: 'Eliminar',
                            icon: 'trash',
                            danger: true,
                            divider: true,
                            onSelect: () => setToDelete(c),
                          },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Drawer
        open={drawerOpen}
        width={440}
        title={form.id ? 'Editar cliente' : 'Nuevo cliente'}
        onClose={closeDrawer}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={closeDrawer} disabled={saving}>
              Cancelar
            </button>
            <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar cliente'}
            </button>
          </>
        }
      >
        {formError && <div className="error">{formError}</div>}
        <div className="field">
          <label htmlFor="customer-name">Nombre</label>
          <input
            id="customer-name"
            autoFocus
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="customer-phone">Telefono</label>
          <input
            id="customer-phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="customer-email">Correo</label>
          <input
            id="customer-email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="customer-address">Direccion</label>
          <textarea
            id="customer-address"
            rows={3}
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </div>
      </Drawer>

      <ConfirmDialog
        open={toDelete !== null}
        danger
        busy={deleting}
        title="Eliminar cliente"
        message={
          toDelete
            ? `Se eliminara a ${toDelete.name}. Sus ventas anteriores se conservan, pero ya no podras ligarle ventas nuevas.`
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
