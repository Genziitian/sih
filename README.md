# Retinal screening — explainable AI DR screening prototype

A working V1 prototype of a diabetic retinopathy screening workflow for rural
district programmes. It demonstrates one path end to end:

**Capture → quality check → AI analysis → explainability → priority queue →
clinician decision → district impact → printable report.**

Everything in it works. There are no dead buttons and no static mock screens.

```bash
npm install
npm run dev      # http://localhost:5173
```

No configuration, no backend and no network are needed to run it. Supabase is
optional and additive — see below.

The app opens on a landing page. **Start a scan** goes to the capture screen;
the three role cards further down open the clinician queue and the district
dashboard directly.

Its **Explore a fundus** section is not a screenshot — it is the live result
from demo case `g2`. Click any lesion marker to zoom the frame onto it and read
what the finding is and why it moves the grade, filter by finding type, or
switch to the attention map to see which regions carried the decision.

### Using a real camera

The capture screen's **Use camera** button opens a live `getUserMedia` preview
with an alignment ring, a device picker when more than one camera is attached,
and a shutter that centre-crops the frame to a square JPEG.

Browsers only expose a camera on a **secure context**, so use
`http://localhost:5173` (allowed) or serve over https. Opening the dev server
by LAN IP will show a clear message instead of a broken button, and every
failure mode — permission denied, no camera, camera busy — falls back to
choosing a saved image or a demo image.

---

## The two-minute demo

Open **Prototype** in the top-right of the header. Each button drops you onto
the capture screen in a specific state:

| Button | What it shows |
| --- | --- |
| Demo: Good image | Clean capture, Grade 0, no referral |
| Demo: Poor image | Quality gate blocks analysis, offers retake or override |
| Demo: Grade 2 | The core story — lesions, attention map, referral |
| Demo: Low confidence | Worker sees no grade; case is escalated to priority review |
| Demo: Ungradable | Model declines to grade rather than guess |
| Demo: Both eyes ungradable | Routes to manual examination instead of a dead end |
| Demo: Backend unavailable | Inference is down; images are kept, nothing is lost |

A full run for a judge:

1. **Prototype → Demo: Grade 2.** Watch the quality bars, press *Run analysis*.
2. On the result, switch **Original / Attention map / Lesions**, drag the
   opacity slider, and click a finding to outline just that lesion type.
3. Press **Go offline** in the header, then *Send for review* — the capture
   lands in **Pending sync**. Press **Go online** and watch the queue drain.
4. Switch **Role → Ophthalmologist**. The queue is ordered referable → low
   confidence → ungradable. Open the top case.
5. Use the keyboard: `O` `A` `L` to switch overlays, `R` to confirm the
   referral. It advances to the next case automatically.
6. Open a *referable* case and press `N` instead — you cannot save until you
   record why you differ from the model. That is the audit trail.
7. Switch **Role → Programme officer**. Drag the operating-threshold slider and
   watch the backlog chart, the missed-case count and the clinician hours move
   together.
8. From any decided case, **Open report → Print / Save as PDF.**

---

## What it is built from

| Layer | Choice |
| --- | --- |
| UI | React 19, TypeScript, Tailwind v4, React Router 7 |
| State | Zustand, one store in [`src/store.ts`](src/store.ts) |
| Charts | Recharts |
| Offline queue | IndexedDB via `idb-keyval` |
| Persistence | Pluggable — browser store or Supabase |
| Model | Pluggable — mock analyser or an HTTP inference service |

### The two seams that matter

Everything the app knows about "AI" is one interface, in
[`src/services/ai.ts`](src/services/ai.ts):

```ts
interface FundusAnalyser {
  assessQuality(req: AnalysisRequest): Promise<ImageQuality>
  analyzeFundusImage(req: AnalysisRequest): Promise<AnalysisResult>
}
```

`MockFundusAnalyser` returns deterministic scripted results. `HttpFundusAnalyser`
posts to a real endpoint and is selected automatically when
`VITE_ANALYSIS_API_URL` is set — that is where a MATLAB bridge or a Python
inference server plugs in. No screen changes, no state changes.

Everything the app knows about storage is one interface, in
[`src/services/repo/types.ts`](src/services/repo/types.ts), with a
[local](src/services/repo/local.ts) and a
[Supabase](src/services/repo/supabase.ts) implementation.

### The fundus images

The demo images are generated, not photographed —
[`src/demo/fundus.ts`](src/demo/fundus.ts) draws a retina, optic disc, vessel
arcades and lesions into a 1000×1000 SVG from a seed. That is what makes the
explainability honest inside a prototype: the lesion outlines and the attention
map sit on the lesions that were actually drawn, because the same seed produced
both. Real uploads are analysed too, and their overlay geometry is labelled as
illustrative on screen.

Seeded images are stored as a `fundus://seed/side/flavour/counts` reference
rather than a 20 KB data URI, so the whole 23-case queue persists in ~85 KB.

---

## Using Supabase

The prototype runs on the browser store by default. To put it on Supabase:

1. Create a project, then run
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) and
   [`supabase/seed.sql`](supabase/seed.sql) in the SQL editor
   (or `supabase db push` with the CLI).
2. Copy `.env.example` to `.env` and fill in:

   ```
   VITE_SUPABASE_URL=https://<project>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon key>
   ```

3. Restart `npm run dev`. The header's **Prototype** panel reports which backend
   is live.

If Supabase is configured but unreachable, the app falls back to the browser
store and says so rather than failing — a demo should not die because a network
is missing.

**Two things to know before this touches real data.** V1 has no authentication
by design, so the shipped RLS policies let the anon key read and write
everything; the migration carries the hardened shape in comments. And uploaded
images are stored inline as data URIs — a real deployment moves them to a
private Storage bucket and keeps only the object path.

---

## Deliberately not built

Authentication, a real patient master index, MATLAB integration, production
inference, cloud deployment, admin permissions, analytics. V1 spends its effort
on the ten things a judge actually sees: capture, quality feedback, explainable
results, offline behaviour, the clinician queue, the decision workflow, the
audit trail, the district simulation, the printable report and role switching.

---

## Design notes

One dark register across the whole app: near-black ground with a dot field,
lime accent, and lilac / cream / forest card fills. It is applied by a single
`.night` class that redefines the same tokens every component already reads, so
nothing is themed twice.

Two exceptions, both deliberate. The **report sheet** carries a `.paper` class
that restores the light clinical palette wherever it sits — it is the one thing
that reaches a printer. And the **fundus frame** stays near-black in every
theme, because it is a photograph mount.

Severity is never carried by colour alone: every grade colour is paired with the
grade number and the action text. Text on a filled swatch comes from
`--color-on-primary` / `--color-on-severity` rather than a hardcoded white, which
is what lets the same components work in both registers.

Severity is never carried by colour alone — every grade colour is paired with
the grade number and the action text. Focus rings are a 2px green outline,
`prefers-reduced-motion` is honoured, and the report view is the only thing that
reaches paper.
