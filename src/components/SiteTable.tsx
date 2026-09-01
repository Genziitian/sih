import { useState } from 'react'
import type { Site } from '../types'
import { pct } from '../lib/grading'

type Key = 'name' | 'volume' | 'rejectionRate'

export function SiteTable({ sites }: { sites: Site[] }) {
  const [sort, setSort] = useState<{ key: Key; dir: 1 | -1 }>({ key: 'rejectionRate', dir: -1 })

  const rows = [...sites].sort((a, b) => {
    const va = a[sort.key]
    const vb = b[sort.key]
    if (typeof va === 'string' && typeof vb === 'string') return va.localeCompare(vb) * sort.dir
    return ((va as number) - (vb as number)) * sort.dir
  })

  const header = (key: Key, label: string, align = 'left') => (
    <th
      scope="col"
      className={`py-2 px-3 label font-normal ${align === 'right' ? 'text-right' : 'text-left'}`}
      aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}
    >
      <button
        className="inline-flex items-center gap-1 hover:text-ink"
        onClick={() =>
          setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: -1 }))
        }
      >
        {label}
        <span aria-hidden className="text-[10px]">
          {sort.key === key ? (sort.dir === 1 ? '▲' : '▼') : '·'}
        </span>
      </button>
    </th>
  )

  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="border-b border-line">
          {header('name', 'Site')}
          {header('volume', 'Volume', 'right')}
          {header('rejectionRate', 'Rejection rate', 'right')}
        </tr>
      </thead>
      <tbody>
        {rows.map((s) => {
          const high = s.rejectionRate >= 0.1
          return (
            <tr key={s.id} className="border-b border-line last:border-0">
              <td className="py-2.5 px-3 text-[14px]">{s.name}</td>
              <td className="py-2.5 px-3 text-[14px] tnum text-right">{s.volume}</td>
              <td
                className="py-2.5 px-3 text-[14px] tnum text-right font-medium"
                style={{ color: high ? 'var(--color-alert)' : undefined }}
              >
                {pct(s.rejectionRate)}
                {high && <span className="ml-2 label">needs attention</span>}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
