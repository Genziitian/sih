import { useMemo, useState } from 'react'
import type { AttentionBlob, Findings, Lesion, LesionType } from '../types'
import { LESION_COLORS, LESION_LABELS, LESION_ORDER } from '../lib/grading'
import { resolveFundusSrc } from '../demo/fundus'
import type { OverlayMode } from './FundusViewer'

/* ---------------------------------------------------------------------------
   Click-to-explore fundus.

   The landing page's argument is that the model shows its work, so the visitor
   should be able to poke at the evidence rather than read a claim about it.
   Selecting a finding zooms the frame onto that lesion and explains what it is
   and why it moves the grade.
--------------------------------------------------------------------------- */

interface LesionNote {
  what: string
  why: string
}

const NOTES: Record<LesionType, LesionNote> = {
  microaneurysm: {
    what: 'Tiny bulges in weakened capillary walls, roughly 15–100 µm across.',
    why: 'The earliest visible sign of diabetic retinopathy. Counting them — not merely spotting one — is what separates grade 1 from grade 2.',
  },
  haemorrhage: {
    what: 'Blood that has escaped a damaged vessel into the retina.',
    why: 'Deep dot-blot bleeds signal worsening ischaemia. Their number and spread across quadrants push a case toward severe disease.',
  },
  hard_exudate: {
    what: 'Yellow lipid and protein residue left behind where vessels leak.',
    why: 'Harmless at the periphery, sight-threatening near the macula. Position matters as much as count.',
  },
  neovascularisation: {
    what: 'Fragile new vessels growing across the retina or optic disc.',
    why: 'This is proliferative disease. It bleeds and it detaches retinas, and it is the reason grade 4 is a same-week referral.',
  },
}

const MODES: { id: OverlayMode; label: string }[] = [
  { id: 'original', label: 'Original' },
  { id: 'attention', label: 'Attention' },
  { id: 'lesions', label: 'Lesions' },
]

function heatColor(weight: number) {
  if (weight >= 0.78) return '#d92b1c'
  if (weight >= 0.6) return '#e8801f'
  if (weight >= 0.45) return '#dfc41f'
  return '#2f6fbf'
}

export function FundusExplorer({
  src,
  lesions,
  attention,
  findings,
}: {
  src: string
  lesions: Lesion[]
  attention: AttentionBlob[]
  findings: Findings
}) {
  const [mode, setMode] = useState<OverlayMode>('lesions')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<LesionType | null>(null)

  const resolved = useMemo(() => resolveFundusSrc(src), [src])
  const selected = lesions.find((l) => l.id === selectedId) ?? null
  const zoom = selected ? 2.6 : 1

  const present = LESION_ORDER.filter((t) => findings[t] > 0)
  const visible = filter ? lesions.filter((l) => l.type === filter) : lesions

  const pick = (l: Lesion) => {
    setMode('lesions')
    setSelectedId((cur) => (cur === l.id ? null : l.id))
  }

  const stroke = selected ? 3 / (zoom * 0.55) : 3

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_330px] gap-5">
      {/* --- frame --- */}
      <div>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="inline-flex bg-sunken rounded-control p-0.5">
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                aria-pressed={mode === m.id}
                className={[
                  'min-h-9 px-3 text-[13px] font-medium rounded-[6px] transition-colors',
                  mode === m.id
                    ? 'bg-surface text-ink shadow-[0_1px_2px_rgb(18_32_27/0.08)]'
                    : 'text-muted hover:text-ink',
                ].join(' ')}
              >
                {m.label}
              </button>
            ))}
          </div>
          {selected && (
            <button
              onClick={() => setSelectedId(null)}
              className="min-h-9 px-3 text-[13px] font-medium text-primary hover:bg-primary-wash rounded-control"
            >
              Zoom out
            </button>
          )}
          <span className="label ml-auto hidden sm:block">
            {selected ? 'Showing one finding' : 'Select a marker to zoom in'}
          </span>
        </div>

        <div className="relative aspect-square w-full bg-[#080603] overflow-hidden rounded-panel hairline">
          <div
            className="absolute inset-0 transition-transform duration-500 ease-out"
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: selected ? `${selected.x / 10}% ${selected.y / 10}%` : '50% 50%',
            }}
          >
            <img
              src={resolved}
              alt="Synthetic fundus photograph with detected lesions"
              className="absolute inset-0 w-full h-full object-cover"
              draggable={false}
            />

            {mode === 'attention' && (
              <svg viewBox="0 0 1000 1000" className="absolute inset-0 w-full h-full" aria-hidden>
                <defs>
                  <filter id="ex-blur">
                    <feGaussianBlur stdDeviation="26" />
                  </filter>
                  {attention.map((b, i) => (
                    <radialGradient key={i} id={`ex-heat-${i}`} cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor={heatColor(b.weight)} stopOpacity={b.weight} />
                      <stop offset="55%" stopColor={heatColor(b.weight)} stopOpacity={b.weight * 0.45} />
                      <stop offset="100%" stopColor={heatColor(b.weight)} stopOpacity="0" />
                    </radialGradient>
                  ))}
                  <clipPath id="ex-clip">
                    <circle cx="500" cy="500" r="470" />
                  </clipPath>
                </defs>
                <g clipPath="url(#ex-clip)" filter="url(#ex-blur)" opacity="0.8">
                  {attention.map((b, i) => (
                    <circle key={i} cx={b.x} cy={b.y} r={b.r} fill={`url(#ex-heat-${i})`} />
                  ))}
                </g>
              </svg>
            )}

            {mode === 'lesions' && (
              <svg viewBox="0 0 1000 1000" className="absolute inset-0 w-full h-full">
                {visible.map((l) => {
                  const isSel = selectedId === l.id
                  const dim = selectedId !== null && !isSel
                  const r = Math.max(l.r + 7, 13)
                  return (
                    <g
                      key={l.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`${LESION_LABELS[l.type]} finding`}
                      aria-pressed={isSel}
                      onClick={() => pick(l)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          pick(l)
                        }
                      }}
                      className="cursor-pointer outline-none"
                      opacity={dim ? 0.18 : 1}
                    >
                      <circle cx={l.x} cy={l.y} r={r + 10} fill="transparent" />
                      <circle
                        cx={l.x}
                        cy={l.y}
                        r={r}
                        fill="none"
                        stroke={LESION_COLORS[l.type]}
                        strokeWidth={isSel ? stroke * 1.6 : stroke}
                      />
                      {isSel && (
                        <circle
                          cx={l.x}
                          cy={l.y}
                          r={r + 11}
                          fill="none"
                          stroke={LESION_COLORS[l.type]}
                          strokeWidth={stroke * 0.6}
                          strokeDasharray="7 7"
                          opacity="0.85"
                        />
                      )}
                    </g>
                  )
                })}
              </svg>
            )}
          </div>

          {mode === 'lesions' && (
            <div className="absolute left-3 bottom-3 flex flex-wrap gap-x-3 gap-y-1 px-2.5 py-1.5 rounded-control bg-black/55 backdrop-blur-sm">
              {present.map((t) => (
                <span key={t} className="flex items-center gap-1.5 text-[11px] text-white/90">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full border-2"
                    style={{ borderColor: LESION_COLORS[t] }}
                  />
                  {LESION_LABELS[t]}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* --- panel --- */}
      <div className="flex flex-col gap-3">
        <div className="bg-surface hairline rounded-panel p-4">
          <div className="flex items-baseline justify-between">
            <span className="label">Model result</span>
            <span className="label tnum">confidence 0.87</span>
          </div>
          <div className="text-[20px] font-semibold mt-1" style={{ color: 'var(--color-g2)' }}>
            Grade 2 — moderate
          </div>
          <p className="text-[13px] text-muted m-0 mt-1">
            Refer to ophthalmologist. A clinician confirms before the patient is contacted.
          </p>
        </div>

        <div className="bg-surface hairline rounded-panel p-4">
          <span className="label">Findings — select one to filter</span>
          <ul className="m-0 p-0 mt-2 list-none">
            {LESION_ORDER.map((t) => {
              const count = findings[t]
              const active = filter === t
              return (
                <li key={t}>
                  <button
                    disabled={count === 0}
                    onClick={() => {
                      setFilter(active ? null : t)
                      setSelectedId(null)
                      setMode('lesions')
                    }}
                    aria-pressed={active}
                    className={[
                      'w-full min-h-11 flex items-center gap-3 px-2 -mx-2 rounded-control text-left transition-colors',
                      count === 0 ? 'text-faint cursor-default' : 'hover:bg-sunken',
                      active ? 'bg-sunken' : '',
                    ].join(' ')}
                  >
                    <span
                      className="inline-block w-3 h-3 rounded-full border-2 shrink-0"
                      style={{ borderColor: count === 0 ? 'var(--color-line)' : LESION_COLORS[t] }}
                    />
                    <span className="flex-1 text-[14px]">{LESION_LABELS[t]}</span>
                    <span className="tnum text-[15px] font-medium">{count}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        <div
          className="bg-surface hairline rounded-panel p-4 flex-1"
          aria-live="polite"
        >
          {selected ? (
            <>
              <span
                className="inline-flex items-center gap-2 text-[12px] font-medium rounded-full px-2.5 py-1"
                style={{
                  color: LESION_COLORS[selected.type],
                  background: 'var(--color-sunken)',
                }}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: LESION_COLORS[selected.type] }}
                />
                {LESION_LABELS[selected.type]}
              </span>
              <p className="text-[14px] mt-3 mb-2">{NOTES[selected.type].what}</p>
              <p className="text-[13.5px] text-muted m-0">{NOTES[selected.type].why}</p>
            </>
          ) : (
            <>
              <p className="text-[14px] m-0">
                Every circle is something the model claims to have found.
              </p>
              <p className="text-[13.5px] text-muted mt-2 mb-0">
                Click one to zoom in on it, or switch to <strong>Attention</strong> to see which
                regions carried the grade. A screening result you cannot interrogate is one nobody
                should act on.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
