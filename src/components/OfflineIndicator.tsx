import { useStore } from '../store'
import { Button } from './ui'

export function OfflineIndicator() {
  const online = useStore((s) => s.online)
  const syncing = useStore((s) => s.syncing)
  const pending = useStore((s) => s.outbox.length)
  const goOnline = useStore((s) => s.goOnline)
  const goOffline = useStore((s) => s.goOffline)

  return (
    <div className="flex items-center gap-2">
      <span
        className="flex items-center gap-2 text-[13px] font-medium"
        aria-live="polite"
      >
        <span
          aria-hidden
          className="w-2 h-2 rounded-full"
          style={{ background: online ? 'var(--color-primary)' : 'var(--color-alert)' }}
        />
        {online ? 'Online' : 'Offline'}
      </span>

      {pending > 0 && (
        <span className="label tnum">
          {syncing ? 'Syncing — ' : ''}
          {pending} {pending === 1 ? 'screening' : 'screenings'} waiting to sync
        </span>
      )}

      {online ? (
        <Button compact onClick={goOffline} disabled={syncing}>
          Go offline
        </Button>
      ) : (
        <Button compact variant="primary" onClick={() => void goOnline()} disabled={syncing}>
          Go online
        </Button>
      )}
    </div>
  )
}
