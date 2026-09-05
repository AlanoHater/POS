import { ReactNode } from 'react';
import Icon, { IconName } from './Icon';

type Props = {
  icon?: IconName;
  title: string;
  /** Una sola frase: que hacer para que deje de estar vacio. */
  hint?: string;
  action?: ReactNode;
  compact?: boolean;
};

export default function EmptyState({ icon = 'box', title, hint, action, compact }: Props) {
  return (
    <div className={`empty-state ${compact ? 'compact' : ''}`}>
      <div className="empty-icon">
        <Icon name={icon} size={compact ? 20 : 26} />
      </div>
      <strong>{title}</strong>
      {hint && <p>{hint}</p>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}
