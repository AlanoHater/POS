import './CatalogView.css';
import { useEffect, useState } from 'react';
import { api, Category, Product, getUploadsBase } from '../api/client';
import PhotoPicker from '../components/PhotoPicker';
import BarcodeScanner from '../components/BarcodeScanner';
import { ConfirmDialog, Drawer, EmptyState, Icon, Menu } from '../components/ui';
import { money } from '../lib/format';

type Props = {
  products: Product[];
  categories: Category[];
  symbol: string;
  canProducts: boolean;
  canCategories: boolean;
  onChanged: () => Promise<void>;
};

const emptyProduct = {
  id: '',
  name: '',
  price: '',
  category: '',
  quantity: '0',
  trackStock: true,
  img: '',
  barcode: '',
};

/** Accion destructiva pendiente de confirmar. */
type Pending =
  | { kind: 'product'; id: number; name: string }
  | { kind: 'bulk'; count: number }
  | { kind: 'category'; id: number; name: string };

export default function CatalogView({
  products,
  categories,
  symbol,
  canProducts,
  canCategories,
  onChanged,
}: Props) {
  const [tab, setTab] = useState<'products' | 'categories'>(
    canProducts ? 'products' : 'categories'
  );
  const [list, setList] = useState(products);
  const [cats, setCats] = useState(categories);
  const [form, setForm] = useState(emptyProduct);
  const [formOpen, setFormOpen] = useState(false);
  const [catName, setCatName] = useState('');
  const [editCatId, setEditCatId] = useState<number | null>(null);
  const [catOpen, setCatOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [scanFor, setScanFor] = useState<'form' | 'buscar' | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const uploads = getUploadsBase();

  useEffect(() => {
    setList(products);
    setCats(categories);
    setSelected((prev) => prev.filter((id) => products.some((p) => p.id === id)));
  }, [products, categories]);

  /* ---------------------------------------------------------------- Productos */

  const openNewProduct = () => {
    setForm(emptyProduct);
    setError(null);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setForm(emptyProduct);
    setError(null);
  };

  const saveProduct = async () => {
    if (!form.name.trim()) {
      setError('El nombre es obligatorio');
      return;
    }
    setError(null);
    const fd = new FormData();
    fd.append('id', form.id);
    fd.append('name', form.name.trim());
    fd.append('price', form.price || '0');
    fd.append('category', form.category);
    fd.append('quantity', form.quantity || '0');
    fd.append('stock', form.trackStock ? '1' : 'on');
    fd.append('img', form.img);
    fd.append('barcode', form.barcode.trim());
    try {
      await api.saveProduct(fd);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el producto');
      return;
    }
    setForm(emptyProduct);
    setFormOpen(false);
    await onChanged();
  };

  const editProduct = (p: Product) => {
    setForm({
      id: String(p.id),
      name: p.name,
      price: String(p.price),
      category: p.category,
      quantity: String(p.quantity),
      trackStock: !!p.stock,
      img: p.img || '',
      barcode: p.barcode || '',
    });
    setTab('products');
    setError(null);
    setFormOpen(true);
  };

  const toggleSelect = (id: number) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const visible = list.filter(
    (p) =>
      !filter ||
      p.name.toLowerCase().includes(filter.toLowerCase()) ||
      (p.category || '').toLowerCase().includes(filter.toLowerCase()) ||
      (p.barcode || '').toLowerCase().includes(filter.toLowerCase()) ||
      String(p.id).includes(filter)
  );

  const allVisibleSelected =
    visible.length > 0 && visible.every((p) => selected.includes(p.id));

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      const visibleIds = new Set(visible.map((p) => p.id));
      setSelected((prev) => prev.filter((id) => !visibleIds.has(id)));
    } else {
      setSelected((prev) => Array.from(new Set([...prev, ...visible.map((p) => p.id)])));
    }
  };

  const bulkDelete = async () => {
    if (!selected.length) return;
    setBusy(true);
    setError(null);
    try {
      await api.deleteProducts(selected);
      setSelected([]);
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron eliminar');
    } finally {
      setBusy(false);
    }
  };

  const seedDemo = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await api.seedDemo();
      await onChanged();
      setNotice(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la demostracion');
    } finally {
      setBusy(false);
    }
  };

  /* --------------------------------------------------------------- Categorias */

  const openNewCategory = () => {
    setCatName('');
    setEditCatId(null);
    setError(null);
    setCatOpen(true);
  };

  const editCategory = (c: Category) => {
    setEditCatId(c.id);
    setCatName(c.name);
    setError(null);
    setCatOpen(true);
  };

  const closeCategory = () => {
    setCatOpen(false);
    setCatName('');
    setEditCatId(null);
    setError(null);
  };

  const saveCategory = async () => {
    if (!catName.trim()) return;
    try {
      if (editCatId) {
        await api.updateCategory({ id: editCatId, name: catName.trim() });
      } else {
        await api.saveCategory({ name: catName.trim() });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la categoria');
      return;
    }
    setCatName('');
    setEditCatId(null);
    setCatOpen(false);
    await onChanged();
  };

  /* ------------------------------------------------------------ Confirmacion */

  const runPending = async () => {
    if (!pending) return;
    if (pending.kind === 'bulk') {
      await bulkDelete();
      setPending(null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (pending.kind === 'product') {
        await api.deleteProduct(pending.id);
        if (String(pending.id) === form.id) {
          setFormOpen(false);
          setForm(emptyProduct);
        }
      } else {
        await api.deleteCategory(pending.id);
      }
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar');
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  const confirmProps = (() => {
    if (!pending) return null;
    if (pending.kind === 'bulk') {
      return {
        title: `Eliminar ${pending.count} producto(s)`,
        message: 'Los productos seleccionados se borraran del catalogo. Esta accion no se puede deshacer.',
        confirmLabel: 'Eliminar seleccionados',
      };
    }
    if (pending.kind === 'product') {
      return {
        title: 'Eliminar producto',
        message: `"${pending.name}" dejara de aparecer en el catalogo y en la caja. Esta accion no se puede deshacer.`,
        confirmLabel: 'Eliminar',
      };
    }
    return {
      title: 'Eliminar categoria',
      message: `La categoria "${pending.name}" se borrara. Los productos que la usan quedaran sin categoria.`,
      confirmLabel: 'Eliminar',
    };
  })();

  const stockClass = (p: Product) =>
    p.quantity <= 0 ? 'stock-badge out' : p.quantity <= 5 ? 'stock-badge low' : 'stock-badge';

  const editing = !!form.id;
  const showProducts = tab === 'products' && canProducts;
  const showCategories = tab === 'categories' && canCategories;

  return (
    <div className="catalog">
      <div className="toolbar">
        <div className="segmented" role="group" aria-label="Seccion del catalogo">
          {canProducts && (
            <button
              type="button"
              aria-pressed={tab === 'products'}
              className={tab === 'products' ? 'active' : ''}
              onClick={() => setTab('products')}
            >
              Productos
            </button>
          )}
          {canCategories && (
            <button
              type="button"
              aria-pressed={tab === 'categories'}
              className={tab === 'categories' ? 'active' : ''}
              onClick={() => setTab('categories')}
            >
              Categorias
            </button>
          )}
        </div>

        {showProducts && (
          <>
            <div className="toolbar-search">
              <Icon name="search" size={16} />
              <input
                className="input"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Nombre, categoria, codigo o ID"
                aria-label="Buscar en el catalogo"
              />
            </div>
            <button
              type="button"
              className="btn btn-icon"
              onClick={() => setScanFor('buscar')}
              aria-label="Buscar con la camara"
              title="Buscar con la camara"
            >
              <Icon name="barcode" />
            </button>
          </>
        )}

        <div className="spacer" />

        {showProducts && (
          <button type="button" className="btn btn-primary" onClick={openNewProduct}>
            <Icon name="plus" size={16} />
            Nuevo producto
          </button>
        )}
        {showCategories && (
          <button type="button" className="btn btn-primary" onClick={openNewCategory}>
            <Icon name="plus" size={16} />
            Nueva categoria
          </button>
        )}
        {canProducts && (
          <Menu
            items={[
              {
                label: 'Cargar catalogo de ejemplo',
                icon: 'download',
                disabled: busy,
                onSelect: seedDemo,
              },
            ]}
          />
        )}
      </div>

      {notice && (
        <div className="notice">
          <Icon name="check" size={16} />
          <span>{notice}</span>
          <button type="button" className="btn btn-ghost" onClick={() => setNotice(null)}>
            Cerrar
          </button>
        </div>
      )}
      {error && !formOpen && !catOpen && (
        <div className="error">
          <Icon name="alert" size={16} />
          <span>{error}</span>
        </div>
      )}

      {showProducts && (
        <>
          <div className="card catalog-card">
            {!list.length ? (
              <EmptyState
                icon="box"
                title="Todavia no hay productos"
                hint="Agrega tu primer producto o carga el catalogo de ejemplo"
                action={
                  <button type="button" className="btn btn-primary" onClick={openNewProduct}>
                    <Icon name="plus" size={16} />
                    Nuevo producto
                  </button>
                }
              />
            ) : !visible.length ? (
              <EmptyState
                compact
                icon="search"
                title="Sin resultados"
                hint="Prueba con otro nombre, categoria o codigo"
              />
            ) : (
              <div className="table-wrap">
                <table className="table catalog-table">
                  <thead>
                    <tr>
                      <th className="col-check">
                        <input
                          type="checkbox"
                          checked={allVisibleSelected}
                          onChange={toggleSelectAllVisible}
                          title="Seleccionar todo lo visible"
                          aria-label="Seleccionar todo lo visible"
                        />
                      </th>
                      <th className="col-thumb" />
                      <th>Nombre</th>
                      <th>Codigo</th>
                      <th className="num">Precio</th>
                      <th className="num">Existencia</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((p) => (
                      <tr key={p.id} className="clickable" onClick={() => editProduct(p)}>
                        <td className="cell-check" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selected.includes(p.id)}
                            onChange={() => toggleSelect(p.id)}
                            aria-label={`Seleccionar ${p.name}`}
                          />
                        </td>
                        <td>
                          {p.img ? (
                            <img src={`${uploads}/${p.img}`} alt="" className="thumb" />
                          ) : (
                            <div className="thumb-empty">
                              <Icon name="image" size={16} />
                            </div>
                          )}
                        </td>
                        <td>
                          {p.name}
                          <span className="secondary">{p.category || 'Sin categoria'}</span>
                        </td>
                        <td>
                          {p.barcode ? (
                            <code className="barcode-cell">{p.barcode}</code>
                          ) : (
                            <span className="subtle">—</span>
                          )}
                        </td>
                        <td className="num">{money(Number(p.price), symbol)}</td>
                        <td className="num">
                          {p.stock ? (
                            <span className={stockClass(p)}>{p.quantity}</span>
                          ) : (
                            <span className="subtle">—</span>
                          )}
                        </td>
                        <td className="row-actions" onClick={(e) => e.stopPropagation()}>
                          <Menu
                            label={`Acciones de ${p.name}`}
                            items={[
                              { label: 'Editar', icon: 'edit', onSelect: () => editProduct(p) },
                              {
                                label: 'Eliminar',
                                icon: 'trash',
                                danger: true,
                                divider: true,
                                onSelect: () =>
                                  setPending({ kind: 'product', id: p.id, name: p.name }),
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

          {selected.length > 0 && (
            <div className="bulk-bar">
              <strong>{selected.length} seleccionados</strong>
              <button
                type="button"
                className="btn btn-danger-ghost"
                disabled={busy}
                onClick={() => setPending({ kind: 'bulk', count: selected.length })}
              >
                <Icon name="trash" size={16} />
                Eliminar seleccionados
              </button>
              <div className="spacer" />
              <button type="button" className="btn btn-ghost" onClick={() => setSelected([])}>
                Cancelar seleccion
              </button>
            </div>
          )}
        </>
      )}

      {showCategories && (
        <div className="card catalog-card">
          {!cats.length ? (
            <EmptyState
              icon="tag"
              title="Todavia no hay categorias"
              hint="Las categorias agrupan los productos en la caja"
              action={
                <button type="button" className="btn btn-primary" onClick={openNewCategory}>
                  <Icon name="plus" size={16} />
                  Nueva categoria
                </button>
              }
            />
          ) : (
            <div className="table-wrap">
              <table className="table catalog-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {cats.map((c) => (
                    <tr key={c.id} className="clickable" onClick={() => editCategory(c)}>
                      <td>{c.name}</td>
                      <td className="row-actions" onClick={(e) => e.stopPropagation()}>
                        <Menu
                          label={`Acciones de ${c.name}`}
                          items={[
                            { label: 'Editar', icon: 'edit', onSelect: () => editCategory(c) },
                            {
                              label: 'Eliminar',
                              icon: 'trash',
                              danger: true,
                              divider: true,
                              onSelect: () =>
                                setPending({ kind: 'category', id: c.id, name: c.name }),
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
      )}

      {/* Formulario de producto */}
      <Drawer
        open={formOpen}
        width={480}
        title={editing ? 'Editar producto' : 'Nuevo producto'}
        subtitle={editing ? form.name || undefined : undefined}
        onClose={() => {
          if (pending || scanFor) return; // Escape cierra primero la capa superior
          closeForm();
        }}
        footer={
          <>
            {editing && (
              <button
                type="button"
                className="btn btn-danger-ghost"
                disabled={busy}
                onClick={() =>
                  setPending({ kind: 'product', id: Number(form.id), name: form.name })
                }
              >
                <Icon name="trash" size={16} />
                Eliminar
              </button>
            )}
            <div className="spacer" />
            <button type="button" className="btn btn-ghost" onClick={closeForm}>
              Cancelar
            </button>
            <button type="button" className="btn btn-primary" onClick={saveProduct}>
              Guardar producto
            </button>
          </>
        }
      >
        <div className="catalog-form">
          {error && (
            <div className="error">
              <Icon name="alert" size={16} />
              <span>{error}</span>
            </div>
          )}

          <h4 className="section-title">Informacion basica</h4>
          <div className="field">
            <label htmlFor="cat-name">Nombre</label>
            <input
              id="cat-name"
              value={form.name}
              autoFocus
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="field-row cat-price">
            <div className="field">
              <label htmlFor="cat-category">Categoria</label>
              <select
                id="cat-category"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                <option value="">Sin categoria</option>
                {cats.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="cat-price">Precio</label>
              <input
                id="cat-price"
                type="number"
                step="0.01"
                min={0}
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </div>
          </div>

          <h4 className="section-title">Inventario</h4>
          <div className="field">
            <label htmlFor="cat-barcode">Codigo de barras</label>
            <div className="barcode-row">
              <input
                id="cat-barcode"
                value={form.barcode}
                onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                placeholder="Escanealo o escribelo"
                inputMode="numeric"
              />
              <button type="button" className="btn" onClick={() => setScanFor('form')}>
                <Icon name="camera" size={16} />
                Escanear
              </button>
            </div>
            <span className="hint">
              Se usa en la caja con lector fisico o con la camara. Dejalo vacio si el producto
              no tiene codigo.
            </span>
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={form.trackStock}
              onChange={(e) => setForm({ ...form, trackStock: e.target.checked })}
            />
            Controlar inventario
          </label>
          {form.trackStock && (
            <div className="field">
              <label htmlFor="cat-qty">Piezas en existencia</label>
              <input
                id="cat-qty"
                type="number"
                min={0}
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              />
            </div>
          )}

          <h4 className="section-title">Imagen</h4>
          <PhotoPicker
            value={form.img}
            onChange={(img) => setForm({ ...form, img })}
            suggestedQuery={form.name || form.category}
          />
        </div>
      </Drawer>

      {/* Formulario de categoria */}
      <Drawer
        open={catOpen}
        width={400}
        title={editCatId ? 'Editar categoria' : 'Nueva categoria'}
        onClose={() => {
          if (pending) return;
          closeCategory();
        }}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={closeCategory}>
              Cancelar
            </button>
            <button type="button" className="btn btn-primary" onClick={saveCategory}>
              Guardar
            </button>
          </>
        }
      >
        {error && (
          <div className="error">
            <Icon name="alert" size={16} />
            <span>{error}</span>
          </div>
        )}
        <div className="field">
          <label htmlFor="cat-cat-name">Nombre</label>
          <input
            id="cat-cat-name"
            value={catName}
            autoFocus
            onChange={(e) => setCatName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveCategory();
            }}
          />
        </div>
      </Drawer>

      <ConfirmDialog
        open={!!pending && !!confirmProps}
        title={confirmProps?.title ?? ''}
        message={confirmProps?.message ?? ''}
        confirmLabel={confirmProps?.confirmLabel}
        danger
        busy={busy}
        onConfirm={runPending}
        onCancel={() => setPending(null)}
      />

      <BarcodeScanner
        open={scanFor !== null}
        onClose={() => setScanFor(null)}
        onDetected={(code) => {
          if (scanFor === 'form') setForm((prev) => ({ ...prev, barcode: code }));
          else setFilter(code);
        }}
        title={
          scanFor === 'form' ? 'Asignar codigo al producto' : 'Buscar por codigo de barras'
        }
      />
    </div>
  );
}
