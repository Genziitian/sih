import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'quiet' | 'alert'

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-primary text-white border-primary hover:bg-primary-ink disabled:bg-line disabled:text-muted disabled:border-line',
  secondary:
    'bg-surface text-ink border-line hover:border-ink disabled:text-muted disabled:border-line',
  quiet: 'bg-transparent text-muted border-transparent hover:text-ink',
  alert: 'bg-surface text-alert border-alert hover:bg-alert-wash',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  block?: boolean
  compact?: boolean
}

export function Button({
  variant = 'secondary',
  block,
  compact,
  className = '',
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      className={[
        'inline-flex items-center justify-center gap-2 border rounded-[4px] font-medium',
        'transition-colors disabled:cursor-not-allowed select-none',
        compact ? 'min-h-9 px-3 text-[13px]' : 'min-h-12 px-4 text-[15px]',
        block ? 'w-full' : '',
        VARIANTS[variant],
        className,
      ].join(' ')}
    />
  )
}

export function Panel({
  title,
  aside,
  children,
  className = '',
  bodyClass = 'p-4',
}: {
  title?: ReactNode
  aside?: ReactNode
  children: ReactNode
  className?: string
  bodyClass?: string
}) {
  return (
    <section className={`bg-surface hairline rounded-[4px] ${className}`}>
      {title && (
        <header className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="text-[13px] font-semibold tracking-[0.01em]">{title}</h2>
          {aside && <div className="label">{aside}</div>}
        </header>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  )
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: ReactNode
  hint?: string
}) {
  return (
    <label className="block">
      <span className="label block mb-1">{label}</span>
      {children}
      {hint && <span className="label block mt-1">{hint}</span>}
    </label>
  )
}

export const inputClass =
  'w-full min-h-12 px-3 bg-surface border border-line rounded-[4px] text-[15px] ' +
  'focus:border-primary outline-none'

export function Metric({
  label,
  value,
  note,
  tone,
}: {
  label: string
  value: ReactNode
  note?: string
  tone?: string
}) {
  return (
    <div className="py-4">
      <div className="label">{label}</div>
      <div
        className="tnum text-[30px] leading-[1.1] font-medium mt-1"
        style={tone ? { color: tone } : undefined}
      >
        {value}
      </div>
      {note && <div className="label mt-1">{note}</div>}
    </div>
  )
}

/** Inline, non-transient status. The brief rules out toasts. */
export function Note({
  tone = 'neutral',
  title,
  children,
}: {
  tone?: 'neutral' | 'good' | 'alert'
  title?: ReactNode
  children?: ReactNode
}) {
  const border =
    tone === 'alert' ? 'border-alert' : tone === 'good' ? 'border-primary' : 'border-line'
  const bg = tone === 'alert' ? 'bg-alert-wash' : tone === 'good' ? 'bg-primary-wash' : 'bg-surface'
  const ink = tone === 'alert' ? 'text-alert' : tone === 'good' ? 'text-primary-ink' : 'text-ink'
  return (
    <div className={`hairline ${border} ${bg} rounded-[4px] px-3 py-3`} role="status">
      {title && <div className={`text-[14px] font-medium ${ink}`}>{title}</div>}
      {children && <div className="text-[13px] text-muted mt-0.5">{children}</div>}
    </div>
  )
}

export function Tag({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[12px] leading-none py-1 px-2 rounded-[4px] hairline"
      style={color ? { color, borderColor: color } : undefined}
    >
      {children}
    </span>
  )
}

export function Bar({ value, color }: { value: number; color?: string }) {
  return (
    <div className="h-2 bg-canvas hairline rounded-[2px] overflow-hidden" aria-hidden>
      <div
        className="h-full"
        style={{
          width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`,
          background: color ?? 'var(--color-primary)',
        }}
      />
    </div>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="font-mono text-[11px] px-1.5 py-0.5 hairline rounded-[3px] bg-canvas text-muted">
      {children}
    </kbd>
  )
}

export function Row({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 border-b border-line last:border-0">
      <span className="label">{label}</span>
      <span className="text-[14px] tnum text-right">{value}</span>
    </div>
  )
}
