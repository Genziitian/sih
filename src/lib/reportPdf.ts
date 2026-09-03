import type { jsPDF } from 'jspdf'
import type { EyeExam, Screening } from '../types'
import {
  DME_LABELS,
  DME_SHORT,
  GRADES,
  LESION_LABELS,
  LESION_ORDER,
  followUp,
  gradeMeta,
} from './grading'
import { CLINICIAN_NAME, FACILITY, MODEL_VERSION } from '../demo/cases'
import { OPERATING_POINTS, DEFAULT_THRESHOLD_INDEX } from './simulation'
import { resolveFundusSrc } from '../demo/fundus'

/* ---------------------------------------------------------------------------
   The referral document.

   Drawn with jsPDF's vector API rather than screenshotting the page, so the
   text stays selectable and searchable and the sheet is laid out to A4 instead
   of being a rasterised copy of a browser window. Only the two fundus
   photographs are rasterised, because they genuinely are images.
--------------------------------------------------------------------------- */

const PAGE = { w: 210, h: 297 }
const M = 15
const W = PAGE.w - M * 2

const INK = '#12201b'
const MUTED = '#5d6b64'
const LINE = '#cdd3c9'
const OK = '#175f49'
const ALERT = '#b3401c'

const GRADE_HEX = ['#175f49', '#7a6410', '#a9591a', '#b3401c', '#7f2412']

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

/**
 * Rasterise one fundus frame. SVG data URIs load into an Image without
 * tainting the canvas. The load is raced against a timeout because an image
 * that fires neither onload nor onerror would otherwise hang the download
 * forever — the report is worth more without a picture than not at all.
 */
const IMAGE_TIMEOUT_MS = 6000

async function toPng(src: string, px = 520): Promise<string | null> {
  try {
    const img = new Image()
    img.decoding = 'sync'
    const loaded = new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('image load failed'))
      img.src = resolveFundusSrc(src)
    })
    await Promise.race([
      loaded,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('image load timed out')), IMAGE_TIMEOUT_MS),
      ),
    ])
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = px
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = '#080603'
    ctx.fillRect(0, 0, px, px)
    // Cover-fit, matching how the frame is displayed on screen.
    const scale = Math.max(px / (img.width || px), px / (img.height || px))
    const w = (img.width || px) * scale
    const h = (img.height || px) * scale
    ctx.drawImage(img, (px - w) / 2, (px - h) / 2, w, h)
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}

class Sheet {
  y = M

  constructor(readonly doc: jsPDF) {
    doc.setFont('helvetica', 'normal')
  }

  room(mm: number) {
    if (this.y + mm > PAGE.h - M - 8) {
      this.doc.addPage()
      this.y = M
    }
  }

  rule(gap = 3) {
    this.doc.setDrawColor(LINE)
    this.doc.setLineWidth(0.2)
    this.doc.line(M, this.y, M + W, this.y)
    this.y += gap
  }

  /** Numbered section heading, matching the on-screen report. */
  section(n: string, title: string, aside?: string) {
    this.room(16)
    this.y += 4
    this.doc.setFontSize(7)
    this.doc.setTextColor(MUTED)
    this.doc.text(n, M, this.y)
    this.doc.setFont('helvetica', 'bold')
    this.doc.setFontSize(8.5)
    this.doc.setTextColor(INK)
    this.doc.text(title.toUpperCase(), M + 7, this.y)
    if (aside) {
      this.doc.setFont('helvetica', 'normal')
      this.doc.setFontSize(7.5)
      this.doc.setTextColor(MUTED)
      this.doc.text(aside, M + W, this.y, { align: 'right' })
    }
    this.doc.setFont('helvetica', 'normal')
    this.y += 2.5
    this.rule(5)
  }

  /** A row of label/value pairs across the full width. */
  facts(items: [string, string][], cols = 4) {
    const colW = W / cols
    const rows = Math.ceil(items.length / cols)
    this.room(rows * 10 + 2)
    items.forEach(([k, v], i) => {
      const x = M + (i % cols) * colW
      const y = this.y + Math.floor(i / cols) * 10
      this.doc.setFontSize(6.8)
      this.doc.setTextColor(MUTED)
      this.doc.text(k.toUpperCase(), x, y)
      this.doc.setFontSize(9)
      this.doc.setTextColor(INK)
      this.doc.text(this.doc.splitTextToSize(v, colW - 3)[0] ?? v, x, y + 4.2)
    })
    this.y += rows * 10
  }

  note(text: string, color = MUTED, size = 7.5) {
    const lines = this.doc.splitTextToSize(text, W)
    this.room(lines.length * 3.6 + 2)
    this.doc.setFontSize(size)
    this.doc.setTextColor(color)
    this.doc.text(lines, M, this.y + 2)
    this.y += lines.length * 3.6 + 2
    this.doc.setTextColor(INK)
  }
}

function eyeColumn(
  s: Sheet,
  exam: EyeExam | undefined,
  png: string | null,
  x: number,
  colW: number,
  top: number,
) {
  const d = s.doc
  let y = top

  d.setFont('helvetica', 'bold')
  d.setFontSize(8.5)
  d.setTextColor(INK)
  d.text(exam ? (exam.side === 'right' ? 'RIGHT EYE (OD)' : 'LEFT EYE (OS)') : 'NOT CAPTURED', x, y)
  d.setFont('helvetica', 'normal')
  y += 3

  const img = colW
  if (png) {
    d.addImage(png, 'PNG', x, y, img, img)
  } else {
    d.setFillColor('#f1f3f0')
    d.rect(x, y, img, img, 'F')
    d.setFontSize(8)
    d.setTextColor(MUTED)
    d.text('No image on file', x + img / 2, y + img / 2, { align: 'center' })
  }
  y += img + 5

  if (!exam) return y

  const a = exam.analysis
  const q = exam.quality
  const gradable = !!a && !a.ungradable

  const rows: [string, string][] = [
    ['Visual acuity', exam.visualAcuity],
    ['Gradable', !a ? 'Not analysed' : a.ungradable ? 'No' : 'Yes'],
    ['DR grade', !a ? '—' : a.ungradable ? 'Ungradable' : a.gradeLabel],
    ['Macular oedema', gradable ? DME_SHORT[a!.dme] : '—'],
    ['Central subfield', gradable ? (a!.maculaInvolved ? 'Involved' : 'Clear') : '—'],
    ['Model confidence', a ? a.confidence.toFixed(2) : '—'],
    ['Focus', `${Math.round(q.focus * 100)}%`],
    ['Illumination', `${Math.round(q.illumination * 100)}%`],
    ['Field of view', `${Math.round(q.fieldOfView * 100)}%`],
    [
      'Quality flag',
      q.overridden ? 'Operator override' : q.verdict === 'good' ? 'Passed' : 'Failed',
    ],
  ]

  if (gradable) {
    rows.push(['—', '—'])
    for (const t of LESION_ORDER) rows.push([LESION_LABELS[t], String(a!.findings[t])])
  }

  for (const [k, v] of rows) {
    if (k === '—') {
      d.setDrawColor(LINE)
      d.line(x, y - 1, x + colW, y - 1)
      y += 2
      continue
    }
    d.setFontSize(7.6)
    d.setTextColor(MUTED)
    d.text(k, x, y)
    d.setTextColor(INK)
    d.text(v, x + colW, y, { align: 'right' })
    d.setDrawColor('#e8ebe6')
    d.line(x, y + 1.4, x + colW, y + 1.4)
    y += 5
  }
  return y
}

export async function buildReportPdf(screening: Screening): Promise<jsPDF> {
  // Loaded on demand — jsPDF is ~350 kB and most visitors never open a report.
  const { jsPDF: JsPDF } = await import('jspdf')
  const s = new Sheet(new JsPDF({ unit: 'mm', format: 'a4', compress: true }))
  const d = s.doc
  const p = screening.patient

  const [rightPng, leftPng] = await Promise.all([
    screening.eyes.right ? toPng(screening.eyes.right.imageSrc) : Promise.resolve(null),
    screening.eyes.left ? toPng(screening.eyes.left.imageSrc) : Promise.resolve(null),
  ])

  /* --- masthead --- */
  d.setFont('helvetica', 'bold')
  d.setFontSize(13)
  d.setTextColor(INK)
  d.text(FACILITY, M, s.y + 4)
  d.setFont('helvetica', 'normal')
  d.setFontSize(8)
  d.setTextColor(MUTED)
  d.text('Diabetic retinopathy screening report · ICDR severity scale', M, s.y + 9)

  d.setFontSize(7)
  d.text('SCREENING ID', M + W, s.y + 1.5, { align: 'right' })
  d.setFont('helvetica', 'bold')
  d.setFontSize(10)
  d.setTextColor(INK)
  d.text(screening.id, M + W, s.y + 6, { align: 'right' })
  d.setFont('helvetica', 'normal')
  d.setFontSize(7.5)
  d.setTextColor(MUTED)
  d.text(
    `${fmtDate(screening.createdAt)} · ${fmtTime(screening.createdAt)}`,
    M + W,
    s.y + 10,
    { align: 'right' },
  )
  s.y += 13
  d.setDrawColor(INK)
  d.setLineWidth(0.5)
  d.line(M, s.y, M + W, s.y)
  s.y += 2

  /* --- 01 patient --- */
  s.section('01', 'Patient', screening.site)
  s.facts([
    ['Name', p.name],
    ['Patient ref', p.patientRef],
    ['Age / sex', `${p.age} / ${p.sex}`],
    ['Diabetes duration', `${p.yearsSinceDiagnosis} years`],
  ])

  /* --- 02 risk factors --- */
  s.section('02', 'Risk factors', 'Recorded at the camera')
  s.facts([
    ['HbA1c', p.hba1c !== null ? `${p.hba1c.toFixed(1)} %` : 'Not recorded'],
    [
      'Blood pressure',
      p.systolic && p.diastolic ? `${p.systolic} / ${p.diastolic} mmHg` : 'Not recorded',
    ],
    ['Hypertension', p.hypertension ? 'Yes' : 'No'],
    ['Smoker', p.smoker ? 'Yes' : 'No'],
  ])
  if (p.hba1c !== null && p.hba1c >= 8) {
    s.note(
      'HbA1c above 8.0% — glycaemic control is a contributing factor and should be addressed alongside any ophthalmic referral.',
      ALERT,
    )
  }

  /* --- 03 examination --- */
  s.section('03', 'Examination', 'Both eyes')
  const gap = 8
  const colW = (W - gap) / 2
  const top = s.y
  const endR = eyeColumn(s, screening.eyes.right, rightPng, M, colW, top)
  const endL = eyeColumn(s, screening.eyes.left, leftPng, M + colW + gap, colW, top)
  s.y = Math.max(endR, endL) + 2

  /* --- 04 assessment --- */
  const worst = screening.worstGrade
  const meta = worst !== null ? gradeMeta(worst) : null
  const analyses = Object.values(screening.eyes)
    .map((e) => e?.analysis)
    .filter(Boolean)
  const worstDme =
    (['severe', 'moderate', 'mild', 'none'] as const).find((g) =>
      analyses.some((a) => a!.dme === g && !a!.ungradable),
    ) ?? 'none'

  s.section('04', 'Assessment', 'Worst-eye rule')

  const bw = W / 5
  s.room(16)
  GRADES.forEach((g, i) => {
    const x = M + i * bw
    const active = worst === g.grade
    if (active) {
      d.setFillColor(GRADE_HEX[i])
      d.rect(x, s.y, bw, 11, 'F')
    }
    d.setDrawColor(LINE)
    d.rect(x, s.y, bw, 11)
    d.setFont('helvetica', 'bold')
    d.setFontSize(10)
    d.setTextColor(active ? '#ffffff' : INK)
    d.text(String(g.grade), x + bw / 2, s.y + 5, { align: 'center' })
    d.setFont('helvetica', 'normal')
    d.setFontSize(6.4)
    d.setTextColor(active ? '#ffffff' : MUTED)
    d.text(g.label, x + bw / 2, s.y + 9, { align: 'center' })
  })
  s.y += 15

  s.room(22)
  d.setFontSize(6.8)
  d.setTextColor(MUTED)
  d.text('RETINOPATHY', M, s.y)
  d.text('MACULAR OEDEMA', M + W / 2, s.y)
  d.setFont('helvetica', 'bold')
  d.setFontSize(11)
  d.setTextColor(worst !== null ? GRADE_HEX[worst] : MUTED)
  d.text(meta ? `${meta.short} — ${meta.label.toLowerCase()}` : 'Ungradable', M, s.y + 5.5)
  d.setTextColor(worstDme === 'none' ? OK : worstDme === 'severe' ? ALERT : '#a9591a')
  d.text(DME_SHORT[worstDme], M + W / 2, s.y + 5.5)
  d.setFont('helvetica', 'normal')
  d.setFontSize(8)
  d.setTextColor(INK)
  d.text(
    d.splitTextToSize(
      meta ? meta.action : 'Neither eye could be graded — refer for manual examination.',
      W / 2 - 6,
    ),
    M,
    s.y + 10,
  )
  d.text(d.splitTextToSize(DME_LABELS[worstDme], W / 2 - 6), M + W / 2, s.y + 10)
  s.y += 20

  s.note(
    `Lowest model confidence across both eyes: ${
      screening.lowestConfidence !== null ? screening.lowestConfidence.toFixed(2) : '—'
    }${
      screening.lowestConfidence !== null && screening.lowestConfidence < 0.7
        ? ' — below the reporting threshold, escalated for clinician review.'
        : ''
    }`,
  )

  /* --- 05 referral --- */
  const plan = followUp(worst, worstDme, new Date(screening.createdAt))
  s.section('05', 'Referral and follow-up')
  s.facts([
    ['Urgency', plan.urgency],
    ['To be seen within', plan.within],
    ['Next screening due', plan.nextScreening],
    ['Priority band', screening.priority.replace('_', ' ')],
  ])

  /* --- 06 decision --- */
  const review = screening.review
  s.section('06', 'Clinician decision')
  if (review) {
    s.facts([
      [
        'Decision',
        review.decision === 'refer'
          ? 'Referral confirmed'
          : review.decision === 'no_refer'
            ? 'No referral'
            : 'Ungradable — manual examination',
      ],
      ['Agrees with model', review.disagreedWithModel ? 'No' : 'Yes'],
      ['Reason for difference', review.reason ?? '—'],
      ['Decided', `${fmtDate(review.decidedAt)} · ${fmtTime(review.decidedAt)}`],
    ])
    s.note(`Signed by ${review.clinicianName}`, INK, 8.5)
  } else {
    s.note('Awaiting clinician review. This report is not valid for referral until signed below.')
    s.room(20)
    s.y += 12
    const sigW = (W - 16) / 3
    ;['Clinician signature', 'Registration no.', 'Date'].forEach((label, i) => {
      const x = M + i * (sigW + 8)
      d.setDrawColor(INK)
      d.setLineWidth(0.3)
      d.line(x, s.y, x + sigW, s.y)
      d.setFontSize(6.8)
      d.setTextColor(MUTED)
      d.text(label.toUpperCase(), x, s.y + 3.5)
    })
    s.y += 8
  }

  /* --- 07 audit --- */
  const analysedAt = analyses
    .map((a) => a!.analysedAt)
    .sort()
    .pop()
  const turnaround =
    review != null
      ? Math.max(
          0,
          Math.round(
            (new Date(review.decidedAt).getTime() - new Date(screening.createdAt).getTime()) / 60000,
          ),
        )
      : null
  const op = OPERATING_POINTS[DEFAULT_THRESHOLD_INDEX]

  s.section('07', 'Model and audit trail')
  s.facts(
    [
      ['Model version', MODEL_VERSION],
      [
        'Target operating point',
        `Sens ${(op.sensitivity * 100).toFixed(0)}% / Spec ${(op.specificity * 100).toFixed(0)}%`,
      ],
      ['Reporting threshold', 'Confidence >= 0.70'],
      ['Captured', fmtTime(screening.createdAt)],
      ['Analysed', analysedAt ? fmtTime(analysedAt) : 'Not analysed'],
      ['Reviewed', review ? fmtTime(review.decidedAt) : 'Pending'],
      ['Turnaround', turnaround !== null ? `${turnaround} min` : '—'],
      ['Upload state', screening.synced ? 'Synced' : 'Held on device'],
    ],
    4,
  )

  /* --- footer on every page --- */
  const pages = d.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    d.setPage(i)
    d.setDrawColor(LINE)
    d.setLineWidth(0.2)
    d.line(M, PAGE.h - M - 8, M + W, PAGE.h - M - 8)
    d.setFontSize(6.5)
    d.setTextColor(MUTED)
    d.text(
      'AI-assisted screening result, not a diagnosis. A clinician confirms every referral. Grading follows the ICDR severity scale. Fundus images in this prototype are synthetic.',
      M,
      PAGE.h - M - 4,
    )
    d.text(
      `${screening.id} · reference clinician ${CLINICIAN_NAME} · page ${i} of ${pages}`,
      M,
      PAGE.h - M - 1,
    )
  }

  return d
}

export const reportFilename = (screening: Screening) =>
  `${screening.id}-${screening.patient.patientRef}-DR-screening.pdf`

export async function downloadReportPdf(screening: Screening) {
  const doc = await buildReportPdf(screening)
  doc.save(reportFilename(screening))
}

export async function openReportPdf(screening: Screening) {
  const doc = await buildReportPdf(screening)
  const url = URL.createObjectURL(doc.output('blob'))
  window.open(url, '_blank', 'noopener')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
