import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FundusViewer, type OverlayMode } from '../components/FundusViewer'
import { FundusExplorer } from '../components/FundusExplorer'
import { demoCase, MODEL_VERSION, VALIDATION } from '../demo/cases'
import { buildFundus, specToUrl } from '../demo/fundus'
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

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[11.5px] font-semibold uppercase tracking-[0.1em] text-accent">
      {children}
    </span>
  )
}

const FEATURES = [
  {
    icon: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
    title: 'Explainability at the point of care',
    body: 'Every grade ships with an attention map, outlined lesions and a confidence band. A worker sees what the model looked at before acting on it.',
  },
  {
    icon: 'M12 3v4 M12 17v4 M3 12h4 M17 12h4 M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
    title: 'Quality gate before inference',
    body: 'Focus, illumination and field of view are scored on capture. A dark frame gets a retake prompt in seconds, not a wrong grade three weeks later.',
  },
  {
    icon: 'M4 7h16 M4 12h10 M4 17h13 M18 15l3 3-3 3',
    title: 'Priority triage, not a flat list',
    body: 'The queue orders itself: referable, then low confidence, then ungradable. Low-confidence reads never reach a patient as a grade.',
  },
  {
    icon: 'M12 2a10 10 0 1 0 10 10 M12 6v6l4 2 M21 3v6h-6',
    title: 'Built for no signal',
    body: 'Captures queue on the device and sync when connectivity returns. A camp in a village hall behaves like a district hospital.',
  },
  {
    icon: 'M9 11l3 3L22 4 M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
    title: 'An audit trail that means something',
    body: 'When a clinician overrules the model they record why. Those disagreements are the dataset that tells you where it is actually wrong.',
  },
  {
    icon: 'M3 3v18h18 M7 15l4-5 4 3 5-7',
    title: 'Capacity you can plan',
    body: 'Move the operating point and watch referrals, missed cases, clinician hours and the twelve-week backlog move with it.',
  },
]

const STEPS = [
  { n: '01', title: 'Capture', body: 'A CHO or ASHA worker records the patient, selects the eye, and captures both fundus images on a handheld camera.' },
  { n: '02', title: 'Check', body: 'Image quality is scored on the spot. Poor frames are retaken while the patient is still in the chair.' },
  { n: '03', title: 'Explain', body: 'The model returns a grade, a confidence, lesion counts and an attention map — labelled as screening, never diagnosis.' },
  { n: '04', title: 'Confirm', body: 'An ophthalmologist works the priority queue and confirms or overrules every referral, on the keyboard, in seconds.' },
]

const ROLES = [
  { to: '/screening', label: 'Field worker', body: 'Capture a screening, run the quality check and read an explainable result.', cta: 'Start a scan' },
  { to: '/queue', label: 'Ophthalmologist', body: 'Work the priority queue and confirm referrals with keyboard shortcuts.', cta: 'Open the review queue' },
  { to: '/dashboard', label: 'Programme officer', body: 'Track district metrics and simulate the referral backlog against capacity.', cta: 'Open the dashboard' },
]

const HONESTY = [
  { is: true, text: 'A screening triage tool that decides who needs a specialist.' },
  { is: true, text: 'An assistant that shows its evidence and records when a clinician disagrees.' },
  { is: true, text: 'Usable by a health worker with an afternoon of training.' },
  { is: false, text: 'A diagnosis. No referral reaches a patient without a clinician confirming it.' },
  { is: false, text: 'A replacement for dilated examination in symptomatic eyes.' },
  { is: false, text: 'A reason to skip follow-up when the model says grade 0.' },
]

/** Hero product shot: real components inside a window frame. */
function ProductFrame() {
  const [mode, setMode] = useState<OverlayMode>('attention')
  const modes: { id: OverlayMode; label: string }[] = [
    { id: 'original', label: 'Original' },
    { id: 'attention', label: 'Attention' },
    { id: 'lesions', label: 'Lesions' },
  ]
  return (
    <div className="bg-surface hairline rounded-xl lift overflow-hidden">
      <div className="flex items-center gap-2 px-3.5 h-10 border-b border-line bg-sunken/60">
        <span className="flex gap-1.5" aria-hidden>
          {['#dcdfd9', '#dcdfd9', '#dcdfd9'].map((c, i) => (
            <span key={i} className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
          ))}
        </span>
        <span className="label font-mono mx-auto">SCR-2026-00421 · right eye</span>
      </div>

      <div className="p-3.5 sm:p-4">
        <div className="inline-flex bg-sunken rounded-control p-0.5 mb-3">
          {modes.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              aria-pressed={mode === m.id}
              className={[
                'min-h-9 px-3 text-[13px] font-medium rounded-[6px] transition-colors',
                mode === m.id ? 'bg-surface text-ink shadow-[0_1px_2px_rgb(18_32_27/0.08)]' : 'text-muted hover:text-ink',
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
          <div>
            <div className="label">Result</div>
            <div className="text-[15px] font-semibold leading-tight" style={{ color: 'var(--color-g2)' }}>
              Grade 2
            </div>
          </div>
          <div>
            <div className="label">Confidence</div>
            <div className="text-[15px] font-semibold tnum leading-tight">0.87</div>
          </div>
          <div>
            <div className="label">Action</div>
            <div className="text-[15px] font-semibold leading-tight">Refer</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function Landing() {
  return (
    <div className="min-h-dvh bg-canvas">
      {/* --- nav --- */}
      <header className="sticky top-0 z-30 bg-canvas/80 backdrop-blur-md border-b border-line">
        <div className="shell h-16 flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2.5 shrink-0 no-underline text-ink">
            <Mark />
            <span className="text-[15px] font-semibold tracking-[-0.01em]">Retinal screening</span>
          </Link>

          <nav className="hidden md:flex items-center gap-0.5 ml-2">
            {[
              ['#explore', 'Explore a fundus'],
              ['#how', 'How it works'],
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
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 -z-10"
          aria-hidden
          style={{
            background:
              'radial-gradient(70% 55% at 15% 0%, #eaf2ee 0%, rgba(234,242,238,0) 70%), radial-gradient(50% 40% at 95% 10%, #f0f4ea 0%, rgba(240,244,234,0) 70%)',
          }}
        />
        <div
          className="absolute inset-0 -z-10 opacity-[0.5]"
          aria-hidden
          style={{
            backgroundImage: 'radial-gradient(var(--color-line) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
            maskImage: 'linear-gradient(to bottom, #000, transparent 70%)',
            WebkitMaskImage: 'linear-gradient(to bottom, #000, transparent 70%)',
          }}
        />

        <div className="shell pt-14 pb-16 lg:pt-20 lg:pb-24">
          <div className="grid lg:grid-cols-[1.05fr_1fr] gap-10 lg:gap-14 items-center">
            <div>
              <span className="inline-flex items-center gap-2 text-[12.5px] font-medium text-primary-ink bg-surface hairline rounded-full pl-2 pr-3 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-accent" aria-hidden />
                Screening prototype · Vellore district
              </span>

              <h1 className="display text-[40px] sm:text-[52px] lg:text-[60px] mt-5 mb-0">
                Catch diabetic retinopathy where the ophthalmologist isn’t.
              </h1>

              <p className="text-[17px] sm:text-[18px] text-muted mt-5 mb-0 max-w-xl">
                A screening workflow for CHO and ASHA teams: capture a fundus image on a handheld
                camera, get an explainable grade in under three seconds, and put only the cases that
                need a specialist in front of one.
              </p>

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

              <p className="label mt-5 max-w-md">
                AI-assisted screening, not a diagnosis. A clinician confirms every referral before a
                patient is contacted.
              </p>
            </div>

            <ProductFrame />
          </div>
        </div>
      </section>

      {/* --- validation band --- */}
      <section className="border-y border-line bg-surface">
        <div className="shell py-9 grid grid-cols-2 lg:grid-cols-4 gap-y-7 lg:divide-x lg:divide-line">
          {[
            ['90.2%', 'Sensitivity', 'Referable disease caught'],
            ['85.1%', 'Specificity', 'Healthy eyes not referred'],
            ['4,812', 'Images', 'Held-out validation set'],
            ['18 min', 'Median', 'Capture to clinician decision'],
          ].map(([a, b, c], i) => (
            <div key={c} className={i === 0 ? 'lg:pr-6' : 'lg:px-6'}>
              <div className="text-[28px] font-semibold tnum leading-none tracking-[-0.02em]">{a}</div>
              <div className="text-[13px] font-medium mt-2">{b}</div>
              <div className="label mt-0.5">{c}</div>
            </div>
          ))}
        </div>
      </section>

      {/* --- explore a fundus --- */}
      <section id="explore" className="shell py-16 lg:py-24 scroll-mt-20">
        <div className="max-w-2xl">
          <Eyebrow>Explore a fundus</Eyebrow>
          <h2 className="display text-[30px] sm:text-[38px] mt-3 mb-0">
            A number nobody can question is a number nobody should trust.
          </h2>
          <p className="text-[17px] text-muted mt-4 mb-0">
            This is a real result from the prototype. Click any marker to zoom in on what the model
            claims to have found and why it moves the grade — or switch to the attention map to see
            which regions carried the decision.
          </p>
        </div>

        <div className="mt-10">
          <FundusExplorer
            src={URL}
            lesions={BUILD.lesions}
            attention={BUILD.attention}
            findings={CASE.counts}
          />
        </div>

        <p className="label mt-5 max-w-2xl">
          Fundus images throughout this prototype are synthetic. Lesion positions are generated
          alongside the image, which is what lets the overlays line up with something genuinely
          visible instead of floating over a stock photograph.
        </p>
      </section>

      {/* --- how it works --- */}
      <section id="how" className="bg-surface border-y border-line scroll-mt-20">
        <div className="shell py-16 lg:py-24">
          <div className="max-w-2xl">
            <Eyebrow>Workflow</Eyebrow>
            <h2 className="display text-[30px] sm:text-[38px] mt-3 mb-0">
              Four steps, one patient visit.
            </h2>
            <p className="text-[17px] text-muted mt-4 mb-0">
              The whole point is that the patient does not come back. Capture, quality check, grade
              and referral all happen while they are still in the chair.
            </p>
          </div>

          <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-line hairline rounded-xl overflow-hidden mt-10 m-0 p-0 list-none">
            {STEPS.map((s) => (
              <li key={s.n} className="bg-surface p-6">
                <span className="font-mono text-[12px] text-accent">{s.n}</span>
                <h3 className="text-[17px] font-semibold mt-2 mb-2">{s.title}</h3>
                <p className="text-[14px] text-muted m-0">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* --- features --- */}
      <section className="shell py-16 lg:py-24">
        <div className="max-w-2xl">
          <Eyebrow>Capabilities</Eyebrow>
          <h2 className="display text-[30px] sm:text-[38px] mt-3 mb-0">
            Designed around how district screening actually fails.
          </h2>
          <p className="text-[17px] text-muted mt-4 mb-0">
            Unusable images, patients lost to follow-up, a specialist buried under a flat worklist,
            and no connectivity. Each of those has a screen.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-10">
          {FEATURES.map((f) => (
            <article
              key={f.title}
              className="bg-surface hairline rounded-xl p-6 hover:border-line-strong transition-colors"
            >
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-control bg-primary-wash text-primary">
                <Icon path={f.icon} />
              </span>
              <h3 className="text-[16px] font-semibold mt-4 mb-2">{f.title}</h3>
              <p className="text-[14px] text-muted m-0">{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* --- what it is / isn't --- */}
      <section className="bg-surface border-y border-line">
        <div className="shell py-16 lg:py-24 grid lg:grid-cols-[0.9fr_1.1fr] gap-10 lg:gap-16">
          <div>
            <Eyebrow>Scope</Eyebrow>
            <h2 className="display text-[30px] sm:text-[38px] mt-3 mb-0">
              What this is, and what it is not.
            </h2>
            <p className="text-[17px] text-muted mt-4 mb-0">
              Screening tools earn trust by being precise about their limits. These are ours.
            </p>
          </div>

          <ul className="m-0 p-0 list-none grid gap-px bg-line hairline rounded-xl overflow-hidden self-start">
            {HONESTY.map((h) => (
              <li key={h.text} className="bg-surface flex gap-3 items-start px-5 py-4">
                <span
                  className="shrink-0 mt-0.5"
                  style={{ color: h.is ? 'var(--color-primary)' : 'var(--color-alert)' }}
                >
                  <Icon path={h.is ? 'M20 6 9 17l-5-5' : 'M18 6 6 18 M6 6l12 12'} size={18} />
                </span>
                <span className="text-[14.5px]">{h.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* --- roles --- */}
      <section id="districts" className="shell py-16 lg:py-24 scroll-mt-20">
        <div className="max-w-2xl">
          <Eyebrow>Three surfaces</Eyebrow>
          <h2 className="display text-[30px] sm:text-[38px] mt-3 mb-0">
            Three people, three screens.
          </h2>
          <p className="text-[17px] text-muted mt-4 mb-0">
            Open any of them directly — the prototype carries live state between all three.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mt-10">
          {ROLES.map((r) => (
            <Link
              key={r.to}
              to={r.to}
              className="group no-underline text-ink bg-surface hairline rounded-xl p-6 flex flex-col hover:border-line-strong hover:lift transition-all"
            >
              <h3 className="text-[17px] font-semibold m-0">{r.label}</h3>
              <p className="text-[14px] text-muted mt-2 mb-6 flex-1">{r.body}</p>
              <span className="inline-flex items-center gap-2 text-[14px] font-medium text-primary">
                {r.cta}
                <span className="transition-transform group-hover:translate-x-0.5">
                  <Icon path="M5 12h14 M13 6l6 6-6 6" size={16} />
                </span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* --- closing --- */}
      <section className="shell pb-16 lg:pb-24">
        <div className="bg-primary text-white rounded-xl p-8 sm:p-12 lg:p-16">
          <h2 className="display text-[28px] sm:text-[38px] m-0 max-w-2xl">
            Screening is only useful if the referral arrives.
          </h2>
          <p className="text-[17px] text-white/80 mt-4 mb-8 max-w-xl">
            Capture a screening now, review it as the ophthalmologist, then watch what it does to the
            district backlog. The whole loop takes about two minutes.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/screening" className="no-underline">
              <span className="inline-flex items-center justify-center min-h-12 px-5 rounded-control bg-white text-primary-ink font-medium text-[15px] hover:bg-white/90 transition-colors">
                Start a scan
              </span>
            </Link>
            <Link to="/dashboard" className="no-underline">
              <span className="inline-flex items-center justify-center min-h-12 px-5 rounded-control border border-white/35 text-white font-medium text-[15px] hover:bg-white/10 transition-colors">
                Open the district dashboard
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* --- footer --- */}
      <footer className="border-t border-line bg-surface">
        <div className="shell py-10 grid gap-6 sm:grid-cols-[1fr_auto] items-start">
          <div className="max-w-xl">
            <div className="flex items-center gap-2.5">
              <Mark size={20} />
              <span className="text-[14px] font-semibold">Retinal screening</span>
            </div>
            <p className="label mt-3 m-0">
              AI-assisted diabetic retinopathy screening prototype. Results are not a diagnosis and a
              clinician confirms every referral. Fundus images shown throughout are synthetic and no
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
