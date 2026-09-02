import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FundusViewer, type OverlayMode } from '../components/FundusViewer'
import { FundusExplorer } from '../components/FundusExplorer'
import { CountUp, Reveal, reducedMotion, useInView } from '../components/motion'
import { demoCase, MODEL_VERSION, VALIDATION } from '../demo/cases'
import { buildFundus, specToUrl } from '../demo/fundus'
import { simulate } from '../lib/simulation'
import { Button } from '../components/ui'

const CASE = demoCase('g2')!
const SPEC = { seed: CASE.seed, side: 'right' as const, flavour: CASE.flavour, counts: CASE.counts }
const URL = specToUrl(SPEC)
const BUILD = buildFundus(SPEC)

function Icon({ path, size = 20 }: { path: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d={path} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Mark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="10" fill="none" stroke="var(--color-primary)" strokeWidth="1.7" />
      <circle cx="15.5" cy="12" r="3.6" fill="var(--color-primary)" />
    </svg>
  )
}

function Head({
  eyebrow,
  title,
  sub,
  className = '',
}: {
  eyebrow: string
  title: string
  sub?: string
  className?: string
}) {
  return (
    <div className={`max-w-2xl ${className}`}>
      <Reveal>
        <span className="block text-[11.5px] font-semibold uppercase tracking-[0.11em] text-accent">
          {eyebrow}
        </span>
      </Reveal>
      <Reveal delay={60}>
        <h2 className="display text-[30px] sm:text-[40px] mt-3 mb-0">{title}</h2>
      </Reveal>
      {sub && (
        <Reveal delay={120}>
          <p className="text-[17px] text-muted mt-3 mb-0">{sub}</p>
        </Reveal>
      )}
    </div>
  )
}

/* --- content ------------------------------------------------------------- */

const METRICS = [
  { value: 90.2, decimals: 1, suffix: '%', label: 'Sensitivity' },
  { value: 85.1, decimals: 1, suffix: '%', label: 'Specificity' },
  { value: 4812, decimals: 0, suffix: '', label: 'Validation images' },
  { value: 18, decimals: 0, suffix: ' min', label: 'To clinician review' },
]

const STEPS = [
  { n: '01', title: 'Capture', body: 'Both eyes, on a handheld camera.' },
  { n: '02', title: 'Check', body: 'Quality scored on the spot. Bad frames get retaken.' },
  { n: '03', title: 'Explain', body: 'Grade, confidence, lesion counts, attention map.' },
  { n: '04', title: 'Confirm', body: 'A clinician approves or overrules. Seconds each.' },
]

/* Case studies are computed by the same simulator that ships on the dashboard,
   so the numbers on the marketing page and in the product cannot drift apart. */
const SCENARIOS = [
  {
    name: 'District baseline',
    setting: '180 screenings a day · 45 reviews a day',
    inputs: { arrivalsPerDay: 180, reviewsPerDay: 45, thresholdIndex: 6 },
    takeaway: 'Steady state. The clinic absorbs everything the cameras send it.',
    tone: 'good' as const,
  },
  {
    name: 'Camp week',
    setting: '320 screenings a day · same clinic',
    inputs: { arrivalsPerDay: 320, reviewsPerDay: 45, thresholdIndex: 6 },
    takeaway: 'Outreach nearly doubles volume and the queue never recovers.',
    tone: 'bad' as const,
  },
  {
    name: 'Camp week, threshold loosened',
    setting: '320 a day · model tuned to refer less',
    inputs: { arrivalsPerDay: 320, reviewsPerDay: 45, thresholdIndex: 0 },
    takeaway: 'The backlog clears — by missing 28 in 100. A staffing problem in disguise.',
    tone: 'warn' as const,
  },
]

const FEATURES = [
  {
    icon: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
    title: 'Shows its evidence',
    body: 'Attention map, outlined lesions, confidence band — with every grade.',
  },
  {
    icon: 'M12 3v4 M12 17v4 M3 12h4 M17 12h4 M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
    title: 'Catches bad frames first',
    body: 'A retake prompt in seconds beats a wrong grade in three weeks.',
  },
  {
    icon: 'M4 7h16 M4 12h10 M4 17h13 M18 15l3 3-3 3',
    title: 'Triages itself',
    body: 'Referable, then low confidence, then ungradable. Never a flat list.',
  },
  {
    icon: 'M12 2a10 10 0 1 0 10 10 M12 6v6l4 2 M21 3v6h-6',
    title: 'Works with no signal',
    body: 'Captures queue on the device and sync when the bars come back.',
  },
  {
    icon: 'M9 11l3 3L22 4 M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
    title: 'Records disagreement',
    body: 'Overrule the model and it asks why. That answer is the training set.',
  },
  {
    icon: 'M3 3v18h18 M7 15l4-5 4 3 5-7',
    title: 'Plans capacity',
    body: 'Move the operating point, watch the backlog move with it.',
  },
]

const SCOPE = [
  { is: true, text: 'Triage that decides who needs a specialist.' },
  { is: true, text: 'An assistant that shows its work and logs every override.' },
  { is: true, text: 'Learnable in an afternoon.' },
  { is: false, text: 'A diagnosis. A clinician confirms every referral.' },
  { is: false, text: 'A substitute for dilated examination.' },
  { is: false, text: 'A reason to skip follow-up on a grade 0.' },
]

const ROLES = [
  { to: '/screening', label: 'Field worker', body: 'Capture, check, read the result.', cta: 'Start a scan' },
  { to: '/queue', label: 'Ophthalmologist', body: 'Work the queue on the keyboard.', cta: 'Open the queue' },
  { to: '/dashboard', label: 'Programme officer', body: 'Watch the district, model the backlog.', cta: 'Open the dashboard' },
]

/* --- hero product shot --------------------------------------------------- */

const MODES: { id: OverlayMode; label: string }[] = [
  { id: 'original', label: 'Original' },
  { id: 'attention', label: 'Attention' },
  { id: 'lesions', label: 'Lesions' },
]

function ProductFrame() {
  const [mode, setMode] = useState<OverlayMode>('original')
  const [touched, setTouched] = useState(false)
  const { ref, inView } = useInView<HTMLDivElement>()

  // Demo itself once, then hand over the moment anyone touches it.
  useEffect(() => {
    if (!inView || touched || reducedMotion()) return
    let i = 0
    const id = setInterval(() => {
      i += 1
      setMode(MODES[i % MODES.length].id)
      if (i >= 5) clearInterval(id)
    }, 1900)
    return () => clearInterval(id)
  }, [inView, touched])

  return (
    <div ref={ref} className="bg-surface hairline rounded-xl lift overflow-hidden">
      <div className="flex items-center gap-2 px-3.5 h-10 border-b border-line bg-sunken/60">
        <span className="flex gap-1.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className="w-2.5 h-2.5 rounded-full bg-line-strong" />
          ))}
        </span>
        <span className="label font-mono mx-auto">SCR-2026-00421 · right eye</span>
      </div>

      <div className="p-3.5 sm:p-4">
        <div className="inline-flex bg-sunken rounded-control p-0.5 mb-3">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                setTouched(true)
                setMode(m.id)
              }}
              aria-pressed={mode === m.id}
              className={[
                'min-h-9 px-3 text-[13px] font-medium rounded-[6px] transition-all duration-200',
                mode === m.id
                  ? 'bg-surface text-ink shadow-[0_1px_2px_rgb(18_32_27/0.08)]'
                  : 'text-muted hover:text-ink',
              ].join(' ')}
            >
              {m.label}
            </button>
          ))}
        </div>

        <FundusViewer
          src={URL}
          lesions={BUILD.lesions}
          attention={BUILD.attention}
          mode={mode}
          opacity={0.75}
          caption="Synthetic right eye fundus photograph"
        />

        <div className="grid grid-cols-3 gap-3 mt-4 pt-3.5 border-t border-line">
          {[
            ['Result', 'Grade 2', 'var(--color-g2)'],
            ['Confidence', '0.87', undefined],
            ['Action', 'Refer', undefined],
          ].map(([k, v, c]) => (
            <div key={k}>
              <div className="label">{k}</div>
              <div
                className="text-[15px] font-semibold leading-tight tnum"
                style={c ? { color: c } : undefined}
              >
                {v}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* --- page ---------------------------------------------------------------- */

export function Landing() {
  return (
    <div className="min-h-dvh bg-canvas overflow-x-hidden">
      <header className="sticky top-0 z-30 bg-canvas/80 backdrop-blur-md border-b border-line">
        <div className="shell h-16 flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2.5 shrink-0 no-underline text-ink">
            <Mark />
            <span className="text-[15px] font-semibold tracking-[-0.01em]">Retinal screening</span>
          </Link>

          <nav className="hidden md:flex items-center gap-0.5 ml-2">
            {[
              ['#explore', 'Explore'],
              ['#how', 'How it works'],
              ['#scenarios', 'Scenarios'],
              ['#districts', 'For districts'],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="min-h-9 px-3 flex items-center text-[14px] text-muted hover:text-ink no-underline rounded-control hover:bg-sunken transition-colors"
              >
                {label}
              </a>
            ))}
          </nav>

          <div className="flex-1" />

          <Link to="/queue" className="hidden sm:block no-underline">
            <Button compact variant="quiet">Clinician sign in</Button>
          </Link>
          <Link to="/screening" className="no-underline">
            <Button compact variant="primary">Start a scan</Button>
          </Link>
        </div>
      </header>

      {/* --- hero --- */}
      <section className="relative">
        <div
          className="absolute inset-0 -z-10"
          aria-hidden
          style={{
            background:
              'radial-gradient(70% 55% at 12% 0%, #e9f2ed 0%, rgba(233,242,237,0) 68%), radial-gradient(48% 40% at 96% 8%, #f0f4e9 0%, rgba(240,244,233,0) 70%)',
          }}
        />
        <div
          className="absolute inset-0 -z-10 opacity-60"
          aria-hidden
          style={{
            backgroundImage: 'radial-gradient(var(--color-line) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
            maskImage: 'linear-gradient(to bottom, #000, transparent 72%)',
            WebkitMaskImage: 'linear-gradient(to bottom, #000, transparent 72%)',
          }}
        />

        <div className="shell pt-14 pb-16 lg:pt-20 lg:pb-24">
          <div className="grid lg:grid-cols-[1.05fr_1fr] gap-10 lg:gap-14 items-center">
            <div>
              <Reveal>
                <span className="inline-flex items-center gap-2 text-[12.5px] font-medium text-primary-ink bg-surface hairline rounded-full pl-2 pr-3 py-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent" aria-hidden />
                  Vellore district · screening prototype
                </span>
              </Reveal>

              <Reveal delay={90}>
                <h1 className="display text-[42px] sm:text-[54px] lg:text-[62px] mt-5 mb-0">
                  Catch diabetic retinopathy where the ophthalmologist isn’t.
                </h1>
              </Reveal>

              <Reveal delay={170}>
                <p className="text-[18px] text-muted mt-5 mb-0 max-w-lg">
                  Fundus image in. Explainable grade out. Only the eyes that need a specialist
                  reach one.
                </p>
              </Reveal>

              <Reveal delay={250}>
                <div className="flex flex-wrap gap-3 mt-8">
                  <Link to="/screening" className="no-underline">
                    <Button variant="primary">Start a scan</Button>
                  </Link>
                  <a href="#explore" className="no-underline">
                    <Button>
                      Explore a fundus
                      <Icon path="M12 5v14 M5 12l7 7 7-7" size={16} />
                    </Button>
                  </a>
                </div>
              </Reveal>

              <Reveal delay={320}>
                <p className="label mt-5">
                  Screening, not diagnosis. A clinician confirms every referral.
                </p>
              </Reveal>
            </div>

            <Reveal delay={180} y={26}>
              <ProductFrame />
            </Reveal>
          </div>
        </div>
      </section>

      {/* --- metrics --- */}
      <section className="border-y border-line bg-surface">
        <div className="shell py-9 grid grid-cols-2 lg:grid-cols-4 gap-y-7 lg:divide-x lg:divide-line">
          {METRICS.map((m, i) => (
            <Reveal key={m.label} delay={i * 80} className={i === 0 ? 'lg:pr-6' : 'lg:px-6'}>
              <div className="text-[30px] font-semibold leading-none tracking-[-0.025em]">
                <CountUp value={m.value} decimals={m.decimals} suffix={m.suffix} />
              </div>
              <div className="text-[13px] font-medium mt-2">{m.label}</div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* --- explore --- */}
      <section id="explore" className="shell py-16 lg:py-24 scroll-mt-20">
        {/* Heading and card share one measure so their left edges line up. */}
        <div className="mx-auto max-w-[940px]">
          <Head
            eyebrow="Explainability"
            title="Ask the model why."
            sub="Click any finding to zoom in on the evidence behind the grade."
          />
          <Reveal delay={100} y={24} className="mt-9">
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

      {/* --- how it works --- */}
      <section id="how" className="bg-surface border-y border-line scroll-mt-20">
        <div className="shell py-16 lg:py-24">
          <Head eyebrow="Workflow" title="One visit. Four steps." />
          <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-line hairline rounded-xl overflow-hidden mt-10 m-0 p-0 list-none">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 90} as="li" className="bg-surface p-6">
                <span className="font-mono text-[12px] text-accent">{s.n}</span>
                <h3 className="text-[17px] font-semibold mt-2 mb-1.5">{s.title}</h3>
                <p className="text-[14px] text-muted m-0">{s.body}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* --- scenarios --- */}
      <section id="scenarios" className="shell py-16 lg:py-24 scroll-mt-20">
        <Head
          eyebrow="Scenarios"
          title="Capacity, modelled before it breaks."
          sub="Every figure below is computed live by the same simulator that ships on the dashboard."
        />

        <div className="grid md:grid-cols-3 gap-4 mt-10">
          {SCENARIOS.map((s, i) => {
            const sim = simulate(s.inputs)
            const accent =
              s.tone === 'good'
                ? 'var(--color-primary)'
                : s.tone === 'bad'
                  ? 'var(--color-alert)'
                  : 'var(--color-g2)'
            return (
              <Reveal
                key={s.name}
                delay={i * 100}
                y={22}
                as="article"
                className="bg-surface hairline rounded-xl p-6 flex flex-col hover:border-line-strong transition-colors"
              >
                <span
                  className="inline-flex self-start items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.08em]"
                  style={{ color: accent }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: accent }} />
                  {sim.clears ? 'Queue clears' : 'Queue grows'}
                </span>

                <h3 className="text-[18px] font-semibold mt-3 mb-1">{s.name}</h3>
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
                      <dd className="m-0 text-[19px] font-semibold tnum leading-tight">{v}</dd>
                    </div>
                  ))}
                </dl>

                <p className="text-[14px] text-muted m-0 mt-auto pt-4 border-t border-line">
                  {s.takeaway}
                </p>
              </Reveal>
            )
          })}
        </div>

        <Reveal delay={80}>
          <p className="label mt-5 max-w-xl">
            Modelled, not deployment data. Open the dashboard to move the sliders yourself.
          </p>
        </Reveal>
      </section>

      {/* --- features --- */}
      <section className="bg-surface border-y border-line">
        <div className="shell py-16 lg:py-24">
          <Head eyebrow="Capabilities" title="Built for how screening fails." />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-10">
            {FEATURES.map((f, i) => (
              <Reveal
                key={f.title}
                delay={(i % 3) * 80}
                as="article"
                className="bg-canvas hairline rounded-xl p-6 transition-all duration-200 hover:border-line-strong hover:-translate-y-0.5"
              >
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-control bg-primary-wash text-primary">
                  <Icon path={f.icon} />
                </span>
                <h3 className="text-[16px] font-semibold mt-4 mb-1.5">{f.title}</h3>
                <p className="text-[14px] text-muted m-0">{f.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* --- scope --- */}
      <section className="shell py-16 lg:py-24">
        <div className="grid lg:grid-cols-[0.85fr_1.15fr] gap-10 lg:gap-16">
          <Head eyebrow="Scope" title="Precise about its limits." />
          <ul className="m-0 p-0 list-none grid gap-px bg-line hairline rounded-xl overflow-hidden self-start">
            {SCOPE.map((h, i) => (
              <Reveal
                key={h.text}
                delay={i * 55}
                y={12}
                as="li"
                className="bg-surface flex gap-3 items-start px-5 py-4"
              >
                <span
                  className="shrink-0 mt-0.5"
                  style={{ color: h.is ? 'var(--color-primary)' : 'var(--color-alert)' }}
                >
                  <Icon path={h.is ? 'M20 6 9 17l-5-5' : 'M18 6 6 18 M6 6l12 12'} size={18} />
                </span>
                <span className="text-[14.5px]">{h.text}</span>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* --- roles --- */}
      <section id="districts" className="bg-surface border-y border-line scroll-mt-20">
        <div className="shell py-16 lg:py-24">
          <Head eyebrow="Three surfaces" title="Three people. Three screens." />
          <div className="grid md:grid-cols-3 gap-4 mt-10">
            {ROLES.map((r, i) => (
              <Reveal key={r.to} delay={i * 90} y={22}>
                <Link
                  to={r.to}
                  className="group no-underline text-ink bg-canvas hairline rounded-xl p-6 flex flex-col h-full transition-all duration-200 hover:border-line-strong hover:-translate-y-0.5"
                >
                  <h3 className="text-[17px] font-semibold m-0">{r.label}</h3>
                  <p className="text-[14px] text-muted mt-2 mb-6 flex-1">{r.body}</p>
                  <span className="inline-flex items-center gap-2 text-[14px] font-medium text-primary">
                    {r.cta}
                    <span className="transition-transform duration-200 group-hover:translate-x-1">
                      <Icon path="M5 12h14 M13 6l6 6-6 6" size={16} />
                    </span>
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* --- closing --- */}
      <section className="shell py-16 lg:py-24">
        <Reveal y={24}>
          <div className="bg-primary text-white rounded-xl p-8 sm:p-12 lg:p-16">
            <h2 className="display text-[30px] sm:text-[42px] m-0 max-w-2xl">
              See the whole loop in two minutes.
            </h2>
            <p className="text-[17px] text-white/80 mt-4 mb-8 max-w-md">
              Capture, review, decide, and watch it land on the district backlog.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/screening" className="no-underline">
                <span className="inline-flex items-center justify-center min-h-12 px-5 rounded-control bg-white text-primary-ink font-medium text-[15px] hover:bg-white/90 transition-colors">
                  Start a scan
                </span>
              </Link>
              <Link to="/dashboard" className="no-underline">
                <span className="inline-flex items-center justify-center min-h-12 px-5 rounded-control border border-white/35 text-white font-medium text-[15px] hover:bg-white/10 transition-colors">
                  Open the dashboard
                </span>
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* --- footer --- */}
      <footer className="border-t border-line bg-surface">
        <div className="shell py-10 grid gap-6 sm:grid-cols-[1fr_auto] items-start">
          <div className="max-w-lg">
            <div className="flex items-center gap-2.5">
              <Mark size={20} />
              <span className="text-[14px] font-semibold">Retinal screening</span>
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
