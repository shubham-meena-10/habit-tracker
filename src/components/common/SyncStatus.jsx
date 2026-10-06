import { useAppState } from '../../store/AppContext';

export default function SyncStatus() {
  const { sync } = useAppState();
  const { phase, pending, failed, error } = sync;
  const waiting = `${pending} action${pending === 1 ? '' : 's'} waiting to sync`;

  let label;
  let tone = 'ok';
  if (phase === 'syncing') { label = 'Syncing…'; tone = 'info'; }
  else if (phase === 'offline') { label = pending ? `Offline · ${waiting}` : 'Offline'; tone = 'warn'; }
  else if (phase === 'error') { label = pending ? `Sync problem · ${waiting}` : 'Sync problem'; tone = 'danger'; }
  else if (pending > 0) { label = waiting; tone = 'info'; }
  else { label = '✓ Synced'; }

  return (
    <div className="sync-bar">
      <span className={`sync-pill sync-pill--${tone}`} role="status" aria-live="polite" title={error || ''}>
        {label}
        {failed > 0 && ` · ${failed} rejected`}
      </span>
    </div>
  );
}