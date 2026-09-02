import { useEffect, useRef, useState, type ReactNode } from 'react'

/* ---------------------------------------------------------------------------
   A very small motion layer. No animation library — scroll reveals and count-ups
   are a few lines each, and every one of them checks prefers-reduced-motion and
   degrades to "just show the finished state".
--------------------------------------------------------------------------- */

export const reducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Fires once when the element first scrolls into view. */
export function useInView<T extends HTMLElement>(rootMargin = '0px 0px -12% 0px') {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    // No observer (SSR, jsdom, very old browsers) means show it immediately.
    if (!el || typeof IntersectionObserver === 'undefined' || reducedMotion()) {
      setInView(true)
      return
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          io.disconnect()
        }
      },
      { rootMargin, threshold: 0.08 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [rootMargin])

  return { ref, inView }
}

type RevealProps = {
  children: ReactNode
  delay?: number
  y?: number
  className?: string
  as?: 'div' | 'section' | 'li' | 'article' | 'span' | 'p' | 'h2'
}

export function Reveal({ children, delay = 0, y = 18, className = '', as = 'div' }: RevealProps) {
  const { ref, inView } = useInView<HTMLDivElement>()
  const Tag = as as 'div'
  return (
    <Tag
      ref={ref}
      className={className}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? 'none' : `translate3d(0, ${y}px, 0)`,
        transition: `opacity 620ms cubic-bezier(.16,1,.3,1) ${delay}ms, transform 620ms cubic-bezier(.16,1,.3,1) ${delay}ms`,
        willChange: inView ? undefined : 'opacity, transform',
      }}
    >
      {children}
    </Tag>
  )
}

/** Counts up to `value` the first time it is seen. */
export function CountUp({
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
  duration = 1100,
}: {
  value: number
  decimals?: number
  prefix?: string
  suffix?: string
  duration?: number
}) {
  const { ref, inView } = useInView<HTMLSpanElement>()
  const [shown, setShown] = useState(0)

  useEffect(() => {
    if (!inView) return
    if (reducedMotion()) {
      setShown(value)
      return
    }
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setShown(value * eased)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [inView, value, duration])

  return (
    <span ref={ref} className="tnum">
      {prefix}
      {shown.toLocaleString('en-IN', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  )
}
