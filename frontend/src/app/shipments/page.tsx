'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { api, Shipment, ShipmentQuery } from '@/lib/api'
import { Plus, Search, RefreshCw, Trash2, Eye, RotateCw, ChevronUp, ChevronDown, Filter, X, Upload } from 'lucide-react'
import AddShipmentModal from '@/components/shipments/AddShipmentModal'
import { StatusBadge } from '@/components/ui/StatusBadge'

type SortField = 'created_at' | 'updated_at' | 'delivery_status' | 'carrier'

export default function ShipmentsPage() {
    const router = useRouter()
    const [shipments, setShipments] = useState<Shipment[]>([])
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(true)
    const [showAdd, setShowAdd] = useState(false)
    const [query, setQuery] = useState<ShipmentQuery>({
        page: 1, limit: 50, sortBy: 'created_at', sortDir: 'desc'
    })
    const [search, setSearch] = useState('')
    const [filterStatus, setFilterStatus] = useState('')
    const searchTimeout = useRef<NodeJS.Timeout>()

    const load = useCallback(async (q = query) => {
        setLoading(true)
        try {
            const res = await api.shipments.list(q)
            setShipments(res.data)
            setTotal(res.total)
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }, [query])

    useEffect(() => { load() }, [query])

    const handleSearch = (val: string) => {
        setSearch(val)
        clearTimeout(searchTimeout.current)
        searchTimeout.current = setTimeout(() => {
            setQuery(q => ({ ...q, search: val, page: 1 }))
        }, 400)
    }

    const handleSort = (field: SortField) => {
        setQuery(q => ({
            ...q, sortBy: field,
            sortDir: q.sortBy === field && q.sortDir === 'desc' ? 'asc' : 'desc'
        }))
    }

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        if (!confirm('Delete this shipment?')) return
        await api.shipments.delete(id)
        load()
    }

    const handleRefresh = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        await api.shipments.refresh(id)
        setTimeout(() => load(), 2000)
    }

    const SortIcon = ({ field }: { field: string }) => {
        if (query.sortBy !== field) return <ChevronUp size={12} className="text-gray-600" />
        return query.sortDir === 'asc' ? <ChevronUp size={12} className="text-indigo-400" /> : <ChevronDown size={12} className="text-indigo-400" />
    }

    const totalPages = Math.ceil(total / (query.limit || 50))

    return (
        <div className="space-y-5 fade-in-up">
            {/* Header */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="flex-1">
                    <h2 className="text-xl font-bold text-white">Shipments</h2>
                    <p className="text-xs text-gray-500">{total.toLocaleString()} total records</p>
                </div>
                <button onClick={() => setShowAdd(true)} className="btn-primary">
                    <Plus size={16} /> Add Shipment
                </button>
                <button onClick={() => load()} className="btn-ghost">
                    <RefreshCw size={15} /> Refresh
                </button>
            </div>

            {/* Filters */}
            <div className="card flex flex-wrap gap-3 items-center p-4">
                <div className="flex-1 min-w-48 relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                        className="input pl-9"
                        placeholder="Search tracking number, note..."
                        value={search}
                        onChange={e => handleSearch(e.target.value)}
                    />
                    {search && (
                        <button className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                            onClick={() => { setSearch(''); setQuery(q => ({ ...q, search: '', page: 1 })) }}>
                            <X size={14} />
                        </button>
                    )}
                </div>

                <select
                    className="select w-40"
                    value={filterStatus}
                    onChange={e => { setFilterStatus(e.target.value); setQuery(q => ({ ...q, status: e.target.value, page: 1 })) }}
                >
                    <option value="">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="delivering">Delivering</option>
                    <option value="delivered">Delivered</option>
                    <option value="failed">Failed</option>
                </select>

                <select className="select w-32"
                    value={query.limit}
                    onChange={e => setQuery(q => ({ ...q, limit: parseInt(e.target.value), page: 1 }))}>
                    <option value="25">25 / page</option>
                    <option value="50">50 / page</option>
                    <option value="100">100 / page</option>
                </select>
            </div>

            {/* Table */}
            <div className="card p-0 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th onClick={() => handleSort('created_at')} className="w-48">
                                    <div className="flex items-center gap-1">Tracking # <SortIcon field="created_at" /></div>
                                </th>
                                <th onClick={() => handleSort('carrier')}>
                                    <div className="flex items-center gap-1">Carrier <SortIcon field="carrier" /></div>
                                </th>
                                <th onClick={() => handleSort('delivery_status')}>
                                    <div className="flex items-center gap-1">Status <SortIcon field="delivery_status" /></div>
                                </th>
                                <th>Note</th>
                                <th>Platform</th>
                                <th onClick={() => handleSort('updated_at')}>
                                    <div className="flex items-center gap-1">Last Update <SortIcon field="updated_at" /></div>
                                </th>
                                <th className="w-24 text-right pr-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                [...Array(8)].map((_, i) => (
                                    <tr key={i}>
                                        {[...Array(7)].map((_, j) => (
                                            <td key={j}><div className="h-4 skeleton rounded w-3/4" /></td>
                                        ))}
                                    </tr>
                                ))
                            ) : shipments.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-16 text-gray-600">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center">
                                                <Search size={20} className="text-gray-600" />
                                            </div>
                                            <p>No shipments found</p>
                                            <button onClick={() => setShowAdd(true)} className="btn-primary text-xs">
                                                <Plus size={13} /> Add your first shipment
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                shipments.map(s => (
                                    <tr key={s.id}
                                        className="cursor-pointer"
                                        onClick={() => router.push(`/shipments/${s.id}`)}>
                                        <td>
                                            <div className="font-mono text-sm font-medium text-indigo-400">{s.tracking_number}</div>
                                        </td>
                                        <td>
                                            <span className="text-gray-300 text-xs">{s.carrier || '—'}</span>
                                        </td>
                                        <td><StatusBadge status={s.delivery_status} /></td>
                                        <td><span className="text-gray-400 text-xs truncate max-w-[140px] block">{s.note || '—'}</span></td>
                                        <td><span className="text-gray-500 text-xs">{s.source_platform || '—'}</span></td>
                                        <td>
                                            <span className="text-gray-500 text-xs">
                                                {s.last_tracking_update
                                                    ? new Date(s.last_tracking_update).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
                                                    : 'Never'}
                                            </span>
                                        </td>
                                        <td className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button className="p-1.5 hover:bg-gray-700 rounded text-gray-500 hover:text-indigo-400 transition-colors"
                                                    onClick={e => { e.stopPropagation(); router.push(`/shipments/${s.id}`) }}>
                                                    <Eye size={14} />
                                                </button>
                                                <button className="p-1.5 hover:bg-gray-700 rounded text-gray-500 hover:text-blue-400 transition-colors"
                                                    onClick={e => handleRefresh(s.id, e)}>
                                                    <RotateCw size={14} />
                                                </button>
                                                <button className="p-1.5 hover:bg-gray-700 rounded text-gray-500 hover:text-red-400 transition-colors"
                                                    onClick={e => handleDelete(s.id, e)}>
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
                        <span className="text-xs text-gray-500">
                            Page {query.page} of {totalPages} ({total.toLocaleString()} total)
                        </span>
                        <div className="flex gap-1">
                            <button disabled={query.page! <= 1}
                                onClick={() => setQuery(q => ({ ...q, page: q.page! - 1 }))}
                                className="btn-ghost text-xs px-3 py-1.5 disabled:opacity-40">
                                Previous
                            </button>
                            <button disabled={query.page! >= totalPages}
                                onClick={() => setQuery(q => ({ ...q, page: q.page! + 1 }))}
                                className="btn-ghost text-xs px-3 py-1.5 disabled:opacity-40">
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {showAdd && <AddShipmentModal onClose={() => setShowAdd(false)} onAdded={() => { setShowAdd(false); load() }} />}
        </div>
    )
}
