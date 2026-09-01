import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { PRIORITY_LABELS, elapsedLabel } from '../lib/grading'
import { resolveFundusSrc } from '../demo/fundus'
import { Button, Note, Panel } from '../components/ui'

export function PendingSync() {
  const navigate = useNavigate()
  const outbox = useStore((s) => s.outbox)
  const online = useStore((s) => s.online)
  const syncing = useStore((s) => s.syncing)
  const goOnline = useStore((s) => s.goOnline)
  const syncNow = useStore((s) => s.syncNow)
  // Select state, derive here: a selector that builds a new array each call
  // re-fires useSyncExternalStore forever.
  const screenings = useStore((s) => s.screenings)
  const recent = useMemo(() => screenings.filter((x) => x.synced).slice(0, 5), [screenings])

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Panel
        title="Pending sync"
        aside={`${outbox.length} waiting`}
        bodyClass={outbox.length ? 'p-0' : 'p-4'}
      >
        {outbox.length === 0 ? (
          <Note tone="good" title="Nothing waiting">
            Every screening captured on this device has reached the server.
          </Note>
        ) : (
          <ul className="m-0 p-0 list-none">
            {outbox.map((s) => {
              const eye = s.eyes.right ?? s.eyes.left
              return (
                <li
                  key={s.id}
                  className="flex items-center gap-3 px-4 py-3 border-b border-line last:border-0"
                >
                  {eye && (
                    <img
                      src={resolveFundusSrc(eye.imageSrc)}
                      alt=""
                      className="w-14 h-14 object-cover hairline shrink-0"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-[13px]">{s.id}</div>
                    <div className="label truncate">
                      {s.patient.name} · {s.patient.age} · {s.site}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[13px]">{PRIORITY_LABELS[s.priority]}</div>
                    <div className="label tnum">held {elapsedLabel(s.createdAt)}</div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>

      <div className="space-y-4">
        <Panel title="Connection">
          <p className="text-[14px] m-0">
            {online
              ? 'This device is online. Captures upload as soon as they are sent.'
              : 'This device is offline. Captures are stored here and nothing is lost.'}
          </p>
          <div className="grid gap-2 mt-4">
            {online ? (
              <Button
                variant="primary"
                block
                disabled={syncing || outbox.length === 0}
                onClick={() => void syncNow()}
              >
                {syncing ? 'Syncing…' : 'Sync now'}
              </Button>
            ) : (
              <Button variant="primary" block disabled={syncing} onClick={() => void goOnline()}>
                Go online
              </Button>
            )}
            <Button block onClick={() => navigate('/screening')}>
              New screening
            </Button>
          </div>
        </Panel>

        <Panel title="Recently uploaded">
          {recent.length === 0 ? (
            <p className="label m-0">Nothing uploaded from this device yet.</p>
          ) : (
            <ul className="m-0 p-0 list-none">
              {recent.map((s) => (
                <li
                  key={s.id}
                  className="flex items-baseline justify-between gap-3 py-2 border-b border-line last:border-0"
                >
                  <span className="font-mono text-[13px]">{s.id}</span>
                  <span className="label">{PRIORITY_LABELS[s.priority]}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  )
}
