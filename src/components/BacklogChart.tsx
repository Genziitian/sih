import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { SimOutput } from '../lib/simulation'

const AXIS = { fontSize: 12, fill: 'var(--color-muted)' }

export function BacklogChart({ sim }: { sim: SimOutput }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="label">Referral backlog — 12 simulated weeks</span>
        <span className="label tnum">
          {sim.clears ? 'Backlog clears each week' : `${sim.finalBacklog} cases waiting at week 12`}
        </span>
      </div>
      <div className="h-56 -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={sim.backlog} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
            <CartesianGrid stroke="var(--color-line)" vertical={false} />
            <XAxis dataKey="week" tick={AXIS} tickLine={false} axisLine={{ stroke: 'var(--color-line)' }} />
            <YAxis
              tick={AXIS}
              tickLine={false}
              axisLine={false}
              width={48}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ stroke: 'var(--color-line)' }}
              contentStyle={{
                border: '1px solid var(--color-line)',
                borderRadius: 4,
                fontSize: 13,
                boxShadow: 'none',
              }}
              formatter={(v) => [`${Number(v)} cases`, 'Waiting']}
            />
            <ReferenceLine y={0} stroke="var(--color-line)" />
            <Line
              type="monotone"
              dataKey="backlog"
              stroke={sim.clears ? 'var(--color-primary)' : 'var(--color-alert)'}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
