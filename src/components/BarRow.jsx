import { fmt } from '../lib/utils'

export default function BarRow({ label, amount, total, color = 'bg-accent', renderLabel }) {
  const pct = total > 0 ? (amount / total) * 100 : 0
  return (
    <div className="mb-3">
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm">{renderLabel ? renderLabel() : label}</span>
        <span className="text-sm font-semibold text-danger">{fmt(amount)}</span>
      </div>
      <div className="bg-bg rounded-full h-2 overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-500`}
          style={{ width: `${pct.toFixed(1)}%` }}
        />
      </div>
    </div>
  )
}
