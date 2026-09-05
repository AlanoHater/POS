import { useEffect, useState } from 'react';
import { api, getUploadsBase, MediaItem, PexelsPhoto } from '../api/client';
import Modal from './Modal';
import { ConfirmDialog, EmptyState, Icon } from './ui';

type Props = {
  value: string;
  onChange: (path: string) => void;
  suggestedQuery?: string;
  label?: string;
};

type Tab = 'library' | 'pexels' | 'upload';

const TABS: { id: Tab; label: string }[] = [
  { id: 'library', label: 'Biblioteca' },
  { id: 'pexels', label: 'Pexels' },
  { id: 'upload', label: 'Subir' },
];

export default function PhotoPicker({
  value,
  onChange,
  suggestedQuery = '',
  label = 'Foto',
}: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('library');
  const [library, setLibrary] = useState<MediaItem[]>([]);
  const [query, setQuery] = useState(suggestedQuery);
  const [photos, setPhotos] = useState<PexelsPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);

  const uploads = getUploadsBase();
  const previewSrc = value ? `${uploads}/${value}` : '';

  const loadLibrary = async () => {
    const items = await api.getMediaLibrary();
    setLibrary(items);
  };

  useEffect(() => {
    if (!open) return;
    setQuery(suggestedQuery);
    setError(null);
    loadLibrary().catch((err) => setError(err.message));
    api
      .getSettings()
      .then((s) => setHasKey(Boolean(s.settings.pexels_api_key)))
      .catch(() => undefined);
  }, [open, suggestedQuery]);

  const searchPexels = async () => {
    setError(null);
    setBusy(true);
    try {
      const result = await api.searchPexels(query.trim() || suggestedQuery || 'product');
      setPhotos(result.photos);
      if (!result.photos.length) setError('No se encontraron fotos');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo buscar');
      setPhotos([]);
    } finally {
      setBusy(false);
    }
  };

  const downloadPhoto = async (photo: PexelsPhoto) => {
    setBusy(true);
    setError(null);
    try {
      const item = await api.downloadPexels({
        photoId: photo.id,
        imageUrl: photo.download,
        photographer: photo.photographer,
        alt: photo.alt,
      });
      await loadLibrary();
      onChange(item.path);
      setTab('library');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo descargar');
    } finally {
      setBusy(false);
    }
  };

  const uploadFile = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const item = await api.uploadMedia(file);
      await loadLibrary();
      onChange(item.path);
      setTab('library');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir la imagen');
    } finally {
      setBusy(false);
    }
  };

  const removeFromLibrary = async () => {
    if (pendingDelete === null) return;
    setBusy(true);
    setError(null);
    try {
      await api.deleteMedia(pendingDelete);
      await loadLibrary();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo quitar la imagen');
    } finally {
      setBusy(false);
      setPendingDelete(null);
    }
  };

  return (
    <div className="field">
      <span className="label">{label}</span>
      <div className="photo-picker-row">
        <div className={`photo-preview ${value ? '' : 'empty'}`}>
          {value ? <img src={previewSrc} alt="" /> : <span>Sin foto</span>}
        </div>
        <div className="stack">
          <button type="button" className="btn" onClick={() => setOpen(true)}>
            <Icon name="image" size={16} />
            Elegir {label.toLowerCase()}
          </button>
          {value && (
            <button type="button" className="btn btn-ghost" onClick={() => onChange('')}>
              Quitar
            </button>
          )}
        </div>
      </div>

      <Modal
        title="Biblioteca de imagenes"
        open={open}
        onClose={() => {
          if (pendingDelete !== null) return; // Escape cierra primero la confirmacion
          setOpen(false);
        }}
        wide
        footer={
          <button type="button" className="btn" onClick={() => setOpen(false)}>
            Listo
          </button>
        }
      >
        <div className="toolbar">
          <div className="segmented" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className={tab === t.id ? 'active' : ''}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="error">
            <Icon name="alert" size={16} />
            <span>{error}</span>
          </div>
        )}

        {tab === 'library' &&
          (library.length ? (
            <div className="media-grid">
              {library.map((item) => (
                <div
                  key={item.id}
                  className={`media-tile ${value === item.path ? 'selected' : ''}`}
                  onClick={() => onChange(item.path)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') onChange(item.path);
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <img src={`${uploads}/${item.path}`} alt={item.alt || ''} />
                  <span>{item.source === 'pexels' ? 'Pexels' : 'Subida'}</span>
                  <button
                    type="button"
                    className="media-del"
                    aria-label="Quitar de la biblioteca"
                    title="Quitar de la biblioteca"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPendingDelete(item.id);
                    }}
                  >
                    <Icon name="x" size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              compact
              icon="image"
              title="La biblioteca esta vacia"
              hint="Busca en Pexels o sube un archivo"
            />
          ))}

        {tab === 'pexels' && (
          <div>
            {!hasKey && (
              <div className="banner info">
                <Icon name="info" size={16} />
                <span>Agrega tu llave de Pexels en Ajustes → Imagenes antes de buscar.</span>
              </div>
            )}
            <div className="toolbar">
              <div className="toolbar-search">
                <Icon name="search" size={16} />
                <input
                  className="input"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') searchPexels();
                  }}
                  placeholder={suggestedQuery || 'cafe, fruta, sandwich…'}
                  aria-label="Buscar en Pexels"
                />
              </div>
              <button
                type="button"
                className="btn"
                onClick={searchPexels}
                disabled={busy || !hasKey}
              >
                {busy ? 'Buscando…' : 'Buscar'}
              </button>
            </div>
            <div className="stack">
              {photos.length > 0 && (
                <div className="media-grid">
                  {photos.map((photo) => (
                    <button
                      key={photo.id}
                      type="button"
                      className="media-tile"
                      disabled={busy}
                      onClick={() => downloadPhoto(photo)}
                      title={`Foto de ${photo.photographer}`}
                    >
                      <img src={photo.preview} alt={photo.alt} />
                      <span>Guardar · {photo.photographer}</span>
                    </button>
                  ))}
                </div>
              )}
              <p className="subtle text-xs">
                Las fotos se descargan a tu biblioteca local y despues funcionan sin internet en
                la caja.
              </p>
            </div>
          </div>
        )}

        {tab === 'upload' && (
          <div className="field">
            <label htmlFor="photo-upload">Subir imagen a la biblioteca</label>
            <input
              id="photo-upload"
              type="file"
              accept="image/*"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadFile(file);
              }}
            />
            <span className="hint">La imagen se guarda en la biblioteca y se asigna a este producto.</span>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Quitar imagen"
        message="La imagen se borrara de la biblioteca. Los productos que la usan se quedaran sin foto."
        confirmLabel="Quitar"
        danger
        busy={busy}
        onConfirm={removeFromLibrary}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
