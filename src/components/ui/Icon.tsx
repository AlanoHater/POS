import type { SVGProps } from 'react';

/**
 * Iconos de linea (estilo Lucide) dibujados inline: sin dependencias y con el
 * mismo grosor en toda la app. `name` se limita al set que la interfaz usa.
 */
export type IconName =
  | 'search'
  | 'camera'
  | 'plus'
  | 'minus'
  | 'more'
  | 'chevron-down'
  | 'chevron-right'
  | 'chevron-left'
  | 'trash'
  | 'edit'
  | 'printer'
  | 'download'
  | 'filter'
  | 'x'
  | 'check'
  | 'user'
  | 'users'
  | 'box'
  | 'chart'
  | 'clock'
  | 'settings'
  | 'logout'
  | 'power'
  | 'receipt'
  | 'tag'
  | 'image'
  | 'alert'
  | 'info'
  | 'pause'
  | 'play'
  | 'refresh'
  | 'barcode'
  | 'cash'
  | 'card'
  | 'eye'
  | 'ban'
  | 'store'
  | 'percent'
  | 'grid'
  | 'list';

const PATHS: Record<IconName, string> = {
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-3.5-3.5',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4z M12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  more: 'M6 12h.01M12 12h.01M18 12h.01',
  'chevron-down': 'M6 9l6 6 6-6',
  'chevron-right': 'M9 6l6 6-6 6',
  'chevron-left': 'M15 6l-6 6 6 6',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  edit: 'M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17z M13 6l3 3',
  printer: 'M6 9V3h12v6M6 18H4v-7h16v7h-2M6 14h12v7H6z',
  download: 'M12 4v11M7 10l5 5 5-5M4 20h16',
  filter: 'M4 5h16l-6 8v6l-4-2v-4z',
  x: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12l4 4L19 7',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  users: 'M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M16 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-5-6.7',
  box: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9',
  chart: 'M4 20V10M10 20V4M16 20v-8M22 20H2',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  logout: 'M10 4H5v16h5M14 8l5 4-5 4M19 12H9',
  power: 'M12 3v9M6.3 6.3a8 8 0 1 0 11.4 0',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
  tag: 'M3 12V4h8l10 10-8 8zM7.5 8.5h.01',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01',
  alert: 'M12 3l10 18H2zM12 10v4M12 17.5h.01',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01',
  pause: 'M8 5v14M16 5v14',
  play: 'M7 4l12 8-12 8z',
  refresh: 'M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5',
  barcode: 'M4 6v12M8 6v12M11 6v12M14 6v12M17 6v12M20 6v12',
  cash: 'M2 7h20v10H2zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 12h.01M18 12h.01',
  card: 'M2 6h20v12H2zM2 10h20M6 15h4',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  ban: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM5.6 5.6l12.8 12.8',
  store: 'M3 9l2-5h14l2 5M3 9h18v3a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0zM5 14v6h14v-6M10 20v-4h4v4',
  percent: 'M19 5L5 19M7.5 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM16.5 18a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
  grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
};

type Props = SVGProps<SVGSVGElement> & {
  name: IconName;
  size?: number;
  /** Texto accesible; sin el, el icono es decorativo. */
  label?: string;
};

export default function Icon({ name, size = 18, label, ...rest }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      className="icon"
      {...rest}
    >
      {label && <title>{label}</title>}
      <path d={PATHS[name]} />
    </svg>
  );
}
