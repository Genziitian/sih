import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FundusViewer, type OverlayMode } from '../components/FundusViewer'
import { FundusExplorer } from '../components/FundusExplorer'
import { CountUp, Reveal, reducedMotion, useInView } from '../components/motion'
import { demoCase, MODEL_VERSION, VALIDATION } from '../demo/cases'
import { buildFundus, specToUrl } from '../demo/fundus'
import { GRADES } from '../lib/grading'
import { simulate } from '../lib/simulation'

const CASE = demoCase('g2')!
const SPEC = { seed: CASE.seed, side: 'right' as const, flavour: CASE.flavour, counts: CASE.counts }
const URL = specToUrl(SPEC)
const BUILD = buildFundus(SPEC)

const LILAC = 'var(--lilac)'
const CREAM = 'var(--cream)'
const FOREST = 'var(--forest)'
const SLATE = 'var(--slate)'
const LIME = 'var(--color-primary)'
const ONLIME = 'var(--on-lime)'

function Icon({ path, size = 18 }: { path: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d={path} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
const ARROW = 'M5 12h14 M13 6l6 6-6 6'

function Mark({ size = 26, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="9.5" fill="none" stroke={color} strokeWidth="1.9" />
      <circle cx="15.5" cy="12" r="3.6" fill={color} />
    </svg>
  )
}

/* Types out real outputs the system produces, so the hero box shows the
   product's own vocabulary rather than a placeholder. */
const PHRASES = [
  'Grade 2 — moderate · 12 microaneurysms',
  'Confidence 0.61 — escalate for review',
  'Ungradable — refer for manual examination',
  'Grade 0 — rescreen in 12 months',
]

function Typewriter() {
  const [text, setText] = useState(reducedMotion() ? PHRASES[0] : '')
  const { ref, inView } = useInView<HTMLSpanElement>()

  useEffect(() => {
    if (!inView || reducedMotion()) return
    let phrase = 0
    let char = 0
    let hold = 0
    let erasing = false
    const id = setInterval(() => {
      const target = PHRASES[phrase]
      if (hold > 0) {
        hold -= 1
        return
      }
      if (!erasing) {
        char += 1
        setText(target.slice(0, char))
        if (char === target.length) {
          hold = 26
          erasing = true
        }
      } else {
        char -= 2
        setText(target.slice(0, Math.max(0, char)))
        if (char <= 0) {
          erasing = false
          char = 0
          phrase = (phrase + 1) % PHRASES.length
        }
      }
    }, 45)
    return () => clearInterval(id)
  }, [inView])

  return (
    <span ref={ref}>
      {text}
      <span className="inline-block w-[3px] h-[0.95em] align-[-0.1em] ml-1 bg-current animate-pulse" />
    </span>
  )
}

/* --- content ------------------------------------------------------------- */

const STATS = [
  { v: 1284, suffix: '', label: 'Screenings this week', bg: LILAC, fg: '#1a1c1a', accent: '#2c4a24', rot: -7, dy: 22 },
  { v: 12.4, dec: 1, suffix: '%', label: 'Referral rate', bg: FOREST, fg: '#eef4e8', accent: LIME, rot: -2.5, dy: 0 },
  { v: 18, suffix: ' min', label: 'To clinician review', bg: SLATE, fg: '#f2f4f0', accent: LIME, rot: 2.5, dy: 0 },
  { v: 7.8, dec: 1, suffix: '%', label: 'Images rejected', bg: CREAM, fg: '#1a1c1a', accent: '#2c4a24', rot: 7, dy: 22 },
]

const PILE = [
  {
    n: '01',
    title: 'Capture',
    body: 'A health worker records the patient, picks the eye, and shoots both fundi on a handheld camera.',
    bg: CREAM,
    fg: '#14170f',
    sub: 'rgba(20,23,15,.66)',
  },
  {
    n: '02',
    title: 'Check the image',
    body: 'Focus, illumination and field of view are scored before anything is graded. A dark frame gets retaken while the patient is still in the chair.',
    bg: SLATE,
    fg: '#f2f4f0',
    sub: 'rgba(242,244,240,.66)',
  },
  {
    n: '03',
    title: 'Grade and explain',
    body: 'A grade, a confidence, lesion counts, and the attention map behind them. Nothing is reported that cannot be inspected.',
    bg: LIME,
    fg: '#0e2a10',
    sub: 'rgba(14,42,16,.7)',
  },
  {
    n: '04',
    title: 'Confirm',
    body: 'The ophthalmologist confirms or overrules on the keyboard. Disagreeing with the model requires a recorded reason.',
    bg: FOREST,
    fg: '#eef4e8',
    sub: 'rgba(238,244,232,.66)',
  },
]

const GRADE_FILL = [
  { bg: FOREST, fg: '#eef4e8', sub: 'rgba(238,244,232,.68)' },
  { bg: CREAM, fg: '#14170f', sub: 'rgba(20,23,15,.66)' },
  { bg: LILAC, fg: '#1a1220', sub: 'rgba(26,18,32,.66)' },
  { bg: SLATE, fg: '#f2f4f0', sub: 'rgba(242,244,240,.66)' },
  { bg: LIME, fg: '#0e2a10', sub: 'rgba(14,42,16,.7)' },
]

const GRADE_NOTE = [
  'A clean retina. The finding is that there is nothing to find.',
  'Microaneurysms only — the earliest thing the eye shows.',
  'Haemorrhages and exudates appear. This is where referral starts.',
  'Extensive bleeding across quadrants. Ischaemia is advancing.',
  'New vessels growing. This bleeds and it detaches retinas.',
]

const SCENARIOS = [
  {
    name: 'District baseline',
    setting: '180 screenings a day · 45 reviews a day',
    inputs: { arrivalsPerDay: 180, reviewsPerDay: 45, thresholdIndex: 6 },
    takeaway: 'Steady state. The clinic absorbs everything the cameras send it.',
  },
  {
    name: 'Camp week',
    setting: '320 screenings a day · same clinic',
    inputs: { arrivalsPerDay: 320, reviewsPerDay: 45, thresholdIndex: 6 },
    takeaway: 'Outreach nearly doubles volume and the queue never recovers.',
  },
  {
    name: 'Threshold loosened',
    setting: '320 a day · model tuned to refer less',
    inputs: { arrivalsPerDay: 320, reviewsPerDay: 45, thresholdIndex: 0 },
    takeaway: 'The backlog clears — by missing 28 in 100. A staffing problem in disguise.',
  },
]

const CLOSING = [
  { v: '< 3 s', l: 'Capture to explainable grade' },
  { v: '100%', l: 'Referrals confirmed by a clinician' },
  { v: '0', l: 'Screenings lost with no signal' },
  { v: '5', l: 'ICDR grades, each with an action' },
]

/* --- pieces -------------------------------------------------------------- */

function MiniStrip({ grade, fg }: { grade: number; fg: string }) {
  return (
    <div className="flex gap-1" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="h-1.5 flex-1 rounded-full"
          style={{ background: fg, opacity: i === grade ? 1 : 0.22 }}
        />
      ))}
    </div>
  )
}

function DotMatrix() {
  const cells = []
  let seed = 7
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
  for (let r = 0; r < 13; r++) {
    for (let c = 0; c < 17; c++) {
      const v = rnd()
      cells.push(
        <span
          key={`${r}-${c}`}
          className="rounded-full"
          style={{
            width: v > 0.72 ? 3 : 6,
            height: 6,
            background: LIME,
            opacity: 0.25 + v * 0.6,
            justifySelf: 'center',
          }}
        />,
      )
    }
  }
  return (
    <div
      aria-hidden
      className="grid gap-y-3"
      style={{ gridTemplateColumns: 'repeat(17, 1fr)', alignItems: 'center' }}
    >
      {cells}
    </div>
  )
}

function HeroFundus() {
  const [mode, setMode] = useState<OverlayMode>('original')
  const [touched, setTouched] = useState(false)
  const { ref, inView } = useInView<HTMLDivElement>()
  const modes: OverlayMode[] = ['original', 'attention', 'lesions']

  useEffect(() => {
    if (!inView || touched || reducedMotion()) return
    let i = 0
    const id = setInterval(() => {
      i += 1
      setMode(modes[i % 3])
      if (i >= 5) clearInterval(id)
    }, 1900)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, touched])

  return (
    <div ref={ref}>
      <div className="flex gap-1.5 mb-3">
        {modes.map((m) => (
          <button
            key={m}
            onClick={() => {
              setTouched(true)
              setMode(m)
            }}
            aria-pressed={mode === m}
            className="min-h-8 px-3 rounded-full text-[12.5px] font-semibold capitalize transition-colors"
            style={
              mode === m
                ? { background: '#0e2a10', color: LIME }
                : { background: 'rgba(14,42,16,.12)', color: 'rgba(14,42,16,.7)' }
            }
          >
            {m}
          </button>
        ))}
      </div>
      <FundusViewer
        src={URL}
        lesions={BUILD.lesions}
        attention={BUILD.attention}
        mode={mode}
        opacity={0.78}
        caption="Synthetic right eye fundus photograph"
      />
    </div>
  )
}

function QualityBars() {
  const rows: [string, number, boolean][] = [
    ['Focus', 0.9, true],
    ['Illumination', 0.27, false],
    ['Field of view', 0.72, true],
  ]
  return (
    <div className="w-full max-w-sm">
      {rows.map(([label, v, ok]) => (
        <div key={label} className="mb-4 last:mb-0">
          <div className="flex justify-between text-[13px] mb-1.5">
            <span>{label}</span>
            <span className="tnum" style={{ opacity: 0.7 }}>
              {Math.round(v * 100)}%
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,.12)' }}>
            <div
              className="h-full rounded-full"
              style={{ width: `${v * 100}%`, background: ok ? LIME : 'var(--color-alert)' }}
            />
          </div>
        </div>
      ))}
      <p className="text-[13.5px] mt-5 mb-0" style={{ color: 'var(--color-alert)' }}>
        Image too dark — move the lamp closer and retake.
      </p>
    </div>
  )
}

/* --- page ---------------------------------------------------------------- */

export function Landing() {
  // overflow-x: clip, never hidden — `hidden` makes a scroll container and kills
  // every position:sticky inside it, which is the header and the card pile.
  return (
    <div className="night min-h-dvh overflow-x-clip">
      {/* --- nav --- */}
      <header
        className="sticky top-0 z-40 border-b border-line"
        style={{ background: 'rgba(16,17,16,.82)', backdropFilter: 'blur(12px)' }}
      >
        <div className="shell h-[68px] flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2.5 no-underline text-ink shrink-0">
            <Mark />
            <span className="text-[19px] font-semibold tracking-[-0.02em]">retina</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1 mx-auto" aria-label="Primary">
            {[
              ['#how', 'How it works'],
              ['#explore', 'Explore'],
              ['#scale', 'Grades'],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="min-h-9 px-3.5 flex items-center text-[15px] text-muted hover:text-ink no-underline rounded-full transition-colors"
              >
                {label}
              </a>
            ))}
          </nav>

          <div className="flex-1 md:hidden" />

          <Link
            to="/queue"
            className="hidden sm:flex items-center min-h-9 px-3 text-[15px] text-muted hover:text-ink no-underline transition-colors"
          >
            Open the app
          </Link>
          <Link to="/screening" className="no-underline">
            <span className="pill" style={{ minHeight: 42, fontSize: 15, paddingInline: 20 }}>
              Start a scan
            </span>
          </Link>
        </div>
      </header>

      {/* --- hero --- */}
      <section className="relative">
        <div className="absolute inset-0 dotfield opacity-70" aria-hidden />
        <div className="relative shell pt-16 pb-20 lg:pt-24 text-center">
          <Reveal>
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-[14px] text-muted">
              <span className="flex items-center gap-3">
                Graded on the ICDR scale
                <span className="flex -space-x-1.5" aria-hidden>
                  {GRADES.map((g) => (
                    <span
                      key={g.grade}
                      className="w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-bold"
                      style={{
                        background: g.colorVar,
                        borderColor: 'var(--color-canvas)',
                        color: '#0e1a10',
                      }}
                    >
                      {g.grade}
                    </span>
                  ))}
                </span>
              </span>
              <span>
                Prototype build ·{' '}
                <span className="text-ink font-medium">Vellore district</span>
              </span>
            </div>
          </Reveal>

          <Reveal delay={80}>
            <h1 className="display text-[clamp(38px,6.4vw,74px)] mt-7 mb-0">
              Screen the eye where the doctor isn’t.
            </h1>
          </Reveal>

          <Reveal delay={150}>
            <p className="m-0 mt-3">
              <span
                className="display inline-block text-[clamp(34px,5.8vw,68px)] px-5 py-1.5 rounded-2xl"
                style={{ background: FOREST, color: LIME }}
              >
                Explainable. Offline. In seconds.
              </span>
            </p>
          </Reveal>

          <Reveal delay={220}>
            <p className="text-[17px] text-muted mt-7 mb-0 mx-auto max-w-xl">
              Capture a fundus image, grade it, show the evidence — and send only what needs a
              specialist.
            </p>
          </Reveal>

          <Reveal delay={290}>
            <Link to="/screening" className="no-underline block">
              <div
                className="mx-auto max-w-3xl mt-10 rounded-[26px] px-7 py-9 text-left hairline transition-colors hover:border-line-strong"
                style={{ background: 'rgba(255,255,255,.03)' }}
              >
                <span className="label block mb-3">Result</span>
                <span className="display text-[clamp(20px,3.2vw,34px)] text-ink">
                  <Typewriter />
                </span>
              </div>
            </Link>
          </Reveal>

          <Reveal delay={350}>
            <div className="flex flex-wrap justify-center gap-3 mt-9">
              <Link to="/screening" className="no-underline">
                <span className="pill">
                  <Icon path={ARROW} /> Start a scan
                </span>
              </Link>
              <a href="#explore" className="no-underline">
                <span className="pill-ghost">Explore a fundus</span>
              </a>
            </div>
          </Reveal>

          <Reveal delay={410}>
            <p className="label mt-6">
              Screening, not diagnosis. A clinician confirms every referral.
            </p>
          </Reveal>
        </div>
      </section>

      {/* --- stat fan --- */}
      <section className="shell pb-20 lg:pb-28">
        <div className="fanrow">
          {STATS.map((s, i) => (
            <Reveal key={s.label} delay={i * 90} y={26}>
              <div
                className="rounded-[26px] p-7 h-[300px] flex flex-col"
                style={{
                  background: s.bg,
                  color: s.fg,
                  transform: `rotate(${s.rot}deg) translateY(${s.dy}px)`,
                  marginInline: -10,
                }}
              >
                <div className="text-[38px] font-semibold leading-none tracking-[-0.03em]">
                  <CountUp value={s.v} decimals={s.dec ?? 0} suffix={s.suffix} />
                </div>
                <div className="text-[15px] font-medium mt-2" style={{ color: s.accent }}>
                  {s.label}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
        <p className="label text-center mt-14">
          Figures from the prototype’s simulated district — Vellore, week 23.
        </p>
      </section>

      {/* --- how it works --- */}
      <section id="how" className="shell pb-8 scroll-mt-24">
        <Reveal>
          <div className="flex justify-center gap-1.5 mb-8">
            {[
              { t: 'How', bg: FOREST, fg: LILAC, rot: -3 },
              { t: 'it', bg: LILAC, fg: FOREST, rot: 2, round: true },
              { t: 'works', bg: LIME, fg: ONLIME, rot: -1.5 },
            ].map((c) => (
              <span
                key={c.t}
                className={`display text-[clamp(24px,4vw,40px)] px-5 py-1 ${c.round ? 'rounded-full' : 'rounded-xl'}`}
                style={{ background: c.bg, color: c.fg, transform: `rotate(${c.rot}deg)` }}
              >
                {c.t}
              </span>
            ))}
          </div>
        </Reveal>
        <Reveal delay={80}>
          <h2 className="display text-[clamp(28px,4.6vw,50px)] text-center m-0 mb-12 mx-auto max-w-3xl">
            One visit. Four steps. No dead ends.
          </h2>
        </Reveal>

        <div className="relative">
          {PILE.map((c, i) => (
            <div
              key={c.n}
              className="pilecard"
              style={{ top: 88 + i * 16, background: c.bg, color: c.fg, marginBottom: 20 }}
            >
              <div className="grid lg:grid-cols-2 gap-8 p-8 lg:p-12 min-h-[420px] items-center">
                <div>
                  <span className="font-mono text-[13px] font-semibold" style={{ color: c.sub }}>
                    {c.n}
                  </span>
                  <h3 className="display text-[clamp(26px,3.4vw,40px)] mt-2 mb-3">{c.title}</h3>
                  <p className="text-[16px] m-0 max-w-md" style={{ color: c.sub }}>
                    {c.body}
                  </p>
                </div>

                <div className="flex justify-center lg:justify-end">
                  {i === 0 && (
                    <div
                      className="w-full max-w-xs rounded-2xl p-4"
                      style={{ background: 'rgba(20,23,15,.07)' }}
                    >
                      <div className="grid grid-cols-2 gap-3 text-[13px]">
                        {[
                          ['Screening', 'SCR-2026-00421'],
                          ['Patient', 'Demo Patient · 56'],
                          ['Eye', 'Right'],
                          ['Site', 'Vellore PHC'],
                        ].map(([k, v]) => (
                          <div key={k}>
                            <div className="text-[11px]" style={{ color: c.sub }}>
                              {k}
                            </div>
                            <div className="font-medium">{v}</div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 aspect-square rounded-xl overflow-hidden">
                        <FundusViewer src={URL} mode="original" opacity={0} />
                      </div>
                    </div>
                  )}
                  {i === 1 && <QualityBars />}
                  {i === 2 && (
                    <div className="w-full max-w-xs">
                      <HeroFundus />
                    </div>
                  )}
                  {i === 3 && (
                    <div className="w-full max-w-sm">
                      <div className="grid gap-2">
                        {[
                          ['Confirm referral', 'R', true],
                          ['Confirm no referral', 'N', false],
                          ['Mark ungradable', 'U', false],
                        ].map(([label, key, primary]) => (
                          <div
                            key={label as string}
                            className="flex items-center justify-between min-h-12 px-4 rounded-xl text-[15px] font-medium"
                            style={
                              primary
                                ? { background: LIME, color: ONLIME }
                                : { border: '1px solid rgba(238,244,232,.25)' }
                            }
                          >
                            {label}
                            <span
                              className="font-mono text-[11px] px-1.5 py-0.5 rounded"
                              style={{
                                border: `1px solid ${primary ? 'rgba(14,42,16,.3)' : 'rgba(238,244,232,.3)'}`,
                              }}
                            >
                              {key}
                            </span>
                          </div>
                        ))}
                      </div>
                      <p className="text-[13px] mt-4 mb-0" style={{ color: c.sub }}>
                        Overruling the model opens a required reason: interpretation, image quality,
                        clinical context, model error, other.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* --- explore --- */}
      <section id="explore" className="shell py-20 lg:py-28 scroll-mt-24">
        <div className="mx-auto max-w-[940px]">
          <Reveal>
            <span className="block text-[12px] font-semibold uppercase tracking-[0.12em] text-primary">
              Explainability
            </span>
          </Reveal>
          <Reveal delay={70}>
            <h2 className="display text-[clamp(28px,4.4vw,46px)] mt-3 mb-3">Ask the model why.</h2>
          </Reveal>
          <Reveal delay={130}>
            <p className="text-[17px] text-muted m-0">
              Click any finding to zoom in on the evidence behind the grade.
            </p>
          </Reveal>
          <Reveal delay={190} y={24} className="mt-9">
            <FundusExplorer
              src={URL}
              lesions={BUILD.lesions}
              attention={BUILD.attention}
              findings={CASE.counts}
            />
          </Reveal>
          <Reveal delay={60}>
            <p className="label mt-4">
              Synthetic image. Lesion positions are generated with it, so every circle marks
              something genuinely there.
            </p>
          </Reveal>
        </div>
      </section>

      {/* --- grade scale fan --- */}
      <section id="scale" className="pb-20 lg:pb-28 scroll-mt-24 overflow-x-clip">
        <div className="shell">
          <Reveal>
            <h2 className="display text-[clamp(28px,4.4vw,46px)] text-center m-0 mx-auto max-w-2xl">
              Five grades. Each one is an instruction.
            </h2>
          </Reveal>
          <Reveal delay={80}>
            <p className="text-[17px] text-muted text-center mt-4 mb-12 mx-auto max-w-xl">
              A severity number nobody can act on is trivia. Every grade carries what happens next.
            </p>
          </Reveal>

          <div className="fanrow items-end">
            {GRADES.map((g, i) => {
              const fill = GRADE_FILL[i]
              return (
                <Reveal key={g.grade} delay={i * 80} y={26}>
                  <div
                    className="rounded-[26px] p-6 w-full min-h-[320px] flex flex-col"
                    style={{
                      background: fill.bg,
                      color: fill.fg,
                      transform: `rotate(${(i - 2) * 3}deg) translateY(${Math.abs(i - 2) * 14}px)`,
                      marginInline: -14,
                      position: 'relative',
                      zIndex: i,
                    }}
                  >
                    <MiniStrip grade={g.grade} fg={fill.fg} />
                    <div className="text-[34px] font-semibold leading-none tracking-[-0.03em] mt-5">
                      {g.grade}
                    </div>
                    <div className="text-[17px] font-semibold mt-1">{g.label}</div>
                    <p className="text-[13.5px] mt-3 mb-0" style={{ color: fill.sub }}>
                      {GRADE_NOTE[i]}
                    </p>
                    <p className="text-[14px] font-medium mt-auto pt-4 m-0">{g.action}</p>
                  </div>
                </Reveal>
              )
            })}
          </div>
        </div>
      </section>

      {/* --- scenarios --- */}
      <section className="shell pb-20 lg:pb-28">
        <Reveal>
          <h2 className="display text-[clamp(28px,4.4vw,46px)] m-0 max-w-2xl">
            Capacity, modelled before it breaks.
          </h2>
        </Reveal>
        <Reveal delay={70}>
          <p className="text-[17px] text-muted mt-4 mb-10 max-w-xl">
            Computed live by the same simulator that ships on the district dashboard.
          </p>
        </Reveal>

        <div className="grid md:grid-cols-3 gap-4">
          {SCENARIOS.map((s, i) => {
            const sim = simulate(s.inputs)
            return (
              <Reveal key={s.name} delay={i * 100} y={22}>
                <article className="bg-surface hairline rounded-[22px] p-6 h-full flex flex-col">
                  <span
                    className="inline-flex self-start items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.08em] px-2.5 py-1 rounded-full"
                    style={
                      sim.clears
                        ? { background: 'var(--color-primary-wash)', color: LIME }
                        : { background: 'var(--color-alert-wash)', color: 'var(--color-alert)' }
                    }
                  >
                    {sim.clears ? 'Queue clears' : 'Queue grows'}
                  </span>
                  <h3 className="text-[19px] font-semibold mt-4 mb-1">{s.name}</h3>
                  <p className="label m-0">{s.setting}</p>

                  <dl className="grid grid-cols-2 gap-x-4 gap-y-3 mt-5 mb-5 m-0">
                    {[
                      ['Referred / week', sim.referralsPerWeek.toLocaleString('en-IN')],
                      ['Clinician hours', `${sim.clinicianHoursPerWeek} h`],
                      ['Missed per 100', `${sim.missedPer100}`],
                      ['Backlog, week 12', sim.finalBacklog.toLocaleString('en-IN')],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <dt className="label">{k}</dt>
                        <dd className="m-0 text-[20px] font-semibold tnum leading-tight">{v}</dd>
                      </div>
                    ))}
                  </dl>

                  <p className="text-[14px] text-muted m-0 mt-auto pt-4 border-t border-line">
                    {s.takeaway}
                  </p>
                </article>
              </Reveal>
            )
          })}
        </div>
      </section>

      {/* --- closing --- */}
      <section className="shell pb-16">
        <Reveal y={26}>
          <div
            className="rounded-[32px] p-8 sm:p-12 lg:p-16 grid lg:grid-cols-2 gap-10"
            style={{ background: FOREST }}
          >
            <div className="flex flex-col">
              <h2
                className="display text-[clamp(30px,4.6vw,50px)] m-0"
                style={{ color: LIME }}
              >
                Stop guessing who needs a specialist.
              </h2>
              <p className="text-[17px] mt-4 mb-0" style={{ color: 'rgba(238,244,232,.7)' }}>
                Capture, review, decide, and watch it land on the district backlog. Two minutes.
              </p>
              <div className="mt-auto pt-12">
                <p className="text-[16px] mb-4" style={{ color: 'rgba(238,244,232,.7)' }}>
                  Ready when you are.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link to="/screening" className="no-underline">
                    <span className="pill">
                      <Icon path={ARROW} /> Start a scan
                    </span>
                  </Link>
                  <Link to="/dashboard" className="no-underline">
                    <span
                      className="pill-ghost"
                      style={{ borderColor: 'rgba(238,244,232,.3)', color: '#eef4e8' }}
                    >
                      District dashboard
                    </span>
                  </Link>
                </div>
              </div>
            </div>

            <div>
              <div className="grid grid-cols-2 gap-x-8 gap-y-8">
                {CLOSING.map((c) => (
                  <div key={c.l}>
                    <div
                      className="text-[30px] font-semibold tnum leading-none tracking-[-0.025em]"
                      style={{ color: LILAC }}
                    >
                      {c.v}
                    </div>
                    <div className="text-[14px] mt-2" style={{ color: 'rgba(238,244,232,.72)' }}>
                      {c.l}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-12 hidden sm:block">
                <DotMatrix />
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* --- footer --- */}
      <footer className="border-t border-line">
        <div className="shell py-10 grid gap-8 sm:grid-cols-[1fr_auto] items-start">
          <div className="max-w-lg">
            <div className="flex items-center gap-2.5">
              <Mark size={22} />
              <span className="text-[17px] font-semibold tracking-[-0.02em]">retina</span>
            </div>
            <p className="label mt-3 m-0">
              AI-assisted screening prototype. Not a diagnosis. Fundus images are synthetic and no
              record here describes a real person.
            </p>
          </div>
          <dl className="m-0 sm:text-right">
            <dt className="label">Model</dt>
            <dd className="m-0 text-[13px] font-mono">{MODEL_VERSION}</dd>
            <dt className="label mt-2">Validation</dt>
            <dd className="m-0 text-[13px]">{VALIDATION.dataset}</dd>
          </dl>
        </div>
      </footer>
    </div>
  )
}
