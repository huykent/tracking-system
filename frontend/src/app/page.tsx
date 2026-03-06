'use client'
import { useEffect, useState } from 'react'
import { api, DashboardStats, Provider } from '@/lib/api'
import {
  Package, TrendingUp, Clock, AlertCircle, CheckCircle2,
  Zap, Activity, RefreshCw, BarChart2, ArrowUpRight
} from 'lucide-react'

// ─── Chart component (simple bar chart without external deps) ─
function SimpleBarChart({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(...data.map(d => d.count), 1)
  return (
    <div className="flex items-end gap-1 h-24 mt-2">
      {data.slice(-30).map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
          <div
            className="w-full bg-indigo-600/60 hover:bg-indigo-500 rounded-sm transition-all duration-200 cursor-default"
            style={{ height: `${(d.count / max) * 100}%`, minHeight: d.count > 0 ? 3 : 0 }}
          />
          <div className="absolute bottom-full mb-1 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10">
            {new Date(d.date).toLocaleDateString('vi-VN')}: {d.count}
          </div>
        </div>
      ))}
    </div>
  )
}

function DonutChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  let offset = 0
  const r = 40, cx = 50, cy = 50, circumference = 2 * Math.PI * r

  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 100 100" className="w-24 h-24 -rotate-90">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e293b" strokeWidth="12" />
        {data.map((d, i) => {
          const fraction = d.value / total
          const dash = fraction * circumference
          const el = (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none"
              stroke={d.color} strokeWidth="12"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset * circumference}
              strokeLinecap="round"
            />
          )
          offset += fraction
          return el
        })}
      </svg>
      <div className="space-y-2">
        {data.map(d => (
          <div key={d.label} className="flex items-center gap-2 text-xs">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
            <span className="text-gray-400">{d.label}</span>
            <span className="text-gray-200 font-medium ml-auto pl-4">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function StatCard({ label, value, icon: Icon, color, sub }: {
  label: string; value: number; icon: React.ElementType; color: string; sub?: string
}) {
  return (
    <div className="stat-card fade-in-up">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">{label}</p>
          <p className="text-3xl font-bold text-white mt-1">{value.toLocaleString()}</p>
          {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
        </div>
        <div className={`p-2.5 rounded-xl ${color}`}>
          <Icon size={20} className="text-white" />
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const loadStats = async () => {
    try {
      const data = await api.dashboard.stats()
      setStats(data)
      setLastUpdated(new Date())
    } catch (err) {
      console.error('Failed to load stats', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStats()
    const interval = setInterval(loadStats, 30000) // Refresh every 30s
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card h-28 skeleton" />
        ))}
      </div>
    )
  }

  const successRate = stats ? Math.round((stats.delivered / (stats.total || 1)) * 100) : 0

  return (
    <div className="space-y-6 fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Overview</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Last updated: {lastUpdated?.toLocaleTimeString('vi-VN') || '—'}
          </p>
        </div>
        <button onClick={loadStats} className="btn-ghost">
          <RefreshCw size={15} />
          Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Shipments" value={stats?.total || 0} icon={Package} color="bg-indigo-600" />
        <StatCard label="Delivering" value={stats?.delivering || 0} icon={TrendingUp} color="bg-blue-600" sub={`${stats?.pending || 0} pending`} />
        <StatCard label="Delivered" value={stats?.delivered || 0} icon={CheckCircle2} color="bg-green-600" sub={`${successRate}% success rate`} />
        <StatCard label="Failed" value={stats?.failed || 0} icon={AlertCircle} color="bg-red-600" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Daily shipments */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BarChart2 size={16} className="text-indigo-400" />
              <h3 className="font-semibold text-sm text-white">Shipments per Day</h3>
            </div>
            <span className="text-xs text-gray-500">Last 30 days</span>
          </div>
          {stats?.daily && stats.daily.length > 0
            ? <SimpleBarChart data={stats.daily} />
            : <div className="h-24 flex items-center justify-center text-gray-600 text-sm">No data yet</div>
          }
        </div>

        {/* Status breakdown */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={16} className="text-indigo-400" />
            <h3 className="font-semibold text-sm text-white">Status Breakdown</h3>
          </div>
          <DonutChart data={[
            { label: 'Delivering', value: stats?.delivering || 0, color: '#3b82f6' },
            { label: 'Delivered', value: stats?.delivered || 0, color: '#22c55e' },
            { label: 'Pending', value: stats?.pending || 0, color: '#6b7280' },
            { label: 'Failed', value: stats?.failed || 0, color: '#ef4444' },
          ]} />
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top carriers */}
        <div className="card">
          <h3 className="font-semibold text-sm text-white mb-4">Top Carriers</h3>
          <div className="space-y-3">
            {(stats?.carriers || []).slice(0, 6).map((c, i) => {
              const pct = Math.round((c.count / (stats?.total || 1)) * 100)
              return (
                <div key={i}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-300">{c.carrier || 'Unknown'}</span>
                    <span className="text-gray-500">{c.count} ({pct}%)</span>
                  </div>
                  <div className="h-1.5 bg-gray-800 rounded-full">
                    <div className="h-full bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
            {(!stats?.carriers || stats.carriers.length === 0) && (
              <p className="text-gray-600 text-sm">No data yet</p>
            )}
          </div>
        </div>

        {/* Queue stats */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Zap size={16} className="text-indigo-400" />
            <h3 className="font-semibold text-sm text-white">Background Queue</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Waiting', value: stats?.queue?.waiting, color: 'text-yellow-400 bg-yellow-900/20' },
              { label: 'Active', value: stats?.queue?.active, color: 'text-blue-400 bg-blue-900/20' },
              { label: 'Completed', value: stats?.queue?.completed, color: 'text-green-400 bg-green-900/20' },
              { label: 'Failed', value: stats?.queue?.failed, color: 'text-red-400 bg-red-900/20' },
            ].map(q => (
              <div key={q.label} className={`rounded-lg px-3 py-2.5 ${q.color}`}>
                <p className="text-2xl font-bold">{q.value ?? 0}</p>
                <p className="text-xs opacity-70 mt-0.5">{q.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
