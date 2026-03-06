'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Trash2, Eye, X, Terminal, Clock, RefreshCw } from 'lucide-react'

export default function LogsPage() {
    const [logs, setLogs] = useState<any[]>([])
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    const [loading, setLoading] = useState(true)
    const [clearing, setClearing] = useState(false)
    const limit = 50

    const [selectedLog, setSelectedLog] = useState<any>(null)

    const fetchLogs = async () => {
        setLoading(true)
        try {
            const res = await api.logs.list({ page, limit })
            setLogs(res.data)
            setTotal(res.total)
        } catch (err) {
            console.error('Failed to load logs', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchLogs()
    }, [page])

    const clearLogs = async () => {
        if (!confirm('Are you sure you want to delete all debug logs?')) return
        setClearing(true)
        try {
            await api.logs.clear()
            setPage(1)
            fetchLogs()
        } catch (err) {
            console.error(err)
        } finally {
            setClearing(false)
        }
    }

    return (
        <div className="space-y-6 fade-in-up">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Terminal size={24} className="text-indigo-400" />
                        API Debug Logs
                    </h1>
                    <p className="text-sm text-gray-400 mt-1 flex items-center gap-1.5">
                        View raw outgoing requests to tracking providers. Enable in Settings.
                    </p>
                </div>

                <div className="flex gap-3">
                    <button onClick={fetchLogs} disabled={loading} className="btn-secondary">
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
                    </button>
                    <button onClick={clearLogs} disabled={clearing || logs.length === 0} className="btn-danger flex items-center gap-2">
                        <Trash2 size={16} /> {clearing ? 'Clearing...' : 'Clear All'}
                    </button>
                </div>
            </div>

            <div className="card p-0 overflow-hidden relative">
                {loading && <div className="absolute inset-0 bg-gray-900/50 flex items-center justify-center z-10"><RefreshCw size={24} className="animate-spin text-indigo-500" /></div>}

                <div className="overflow-x-auto">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Local Time</th>
                                <th>Tracking #</th>
                                <th>Provider</th>
                                <th>Request</th>
                                <th>Status</th>
                                <th className="text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={6} className="text-center py-10 text-gray-500">
                                        No logs found. Make sure Debug Mode is enabled.
                                    </td>
                                </tr>
                            )}
                            {logs.map(log => (
                                <tr key={log.id} className="hover:bg-gray-800/50">
                                    <td className="whitespace-nowrap">
                                        <div className="flex items-center gap-1.5 text-gray-300">
                                            <Clock size={12} className="text-gray-500" />
                                            {new Date(log.created_at).toLocaleString()}
                                        </div>
                                    </td>
                                    <td className="font-medium text-white">{log.tracking_number}</td>
                                    <td>
                                        <span className="badge badge-delivering">{log.provider}</span>
                                    </td>
                                    <td className="text-xs text-gray-400 max-w-xs truncate" title={log.request_url}>
                                        <span className="font-semibold text-indigo-400 mr-1">{log.request_method}</span>
                                        {log.request_url === 'API' ? 'Error internally' : log.request_url}
                                    </td>
                                    <td>
                                        {log.response_status ? (
                                            <span className={`badge ${log.response_status >= 200 && log.response_status < 300 ? 'badge-delivered' : 'badge-failed'}`}>
                                                {log.response_status}
                                            </span>
                                        ) : (
                                            <span className="badge badge-pending">ERR</span>
                                        )}
                                    </td>
                                    <td className="text-right">
                                        <button onClick={() => setSelectedLog(log)} className="btn-ghost">
                                            <Eye size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {total > limit && (
                    <div className="flex items-center justify-between px-6 py-4 border-t border-gray-800 bg-gray-900/50">
                        <span className="text-sm text-gray-400">
                            Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total}
                        </span>
                        <div className="flex gap-1">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-sm font-medium transition-colors"
                            >
                                Prev
                            </button>
                            <button
                                onClick={() => setPage(p => p + 1)}
                                disabled={page * limit >= total}
                                className="px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-sm font-medium transition-colors"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal */}
            {selectedLog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedLog(null)} />

                    {/* Dialog */}
                    <div className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col scale-in">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
                            <div>
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    <Terminal size={18} className="text-indigo-400" />
                                    Log Details
                                </h3>
                                <p className="text-xs text-gray-500 tracking-wide mt-0.5">
                                    {selectedLog.tracking_number} — {selectedLog.provider}
                                </p>
                            </div>
                            <button onClick={() => setSelectedLog(null)} className="text-gray-400 hover:text-white transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 overflow-y-auto space-y-6">

                            {(selectedLog.error_message) && (
                                <div className="bg-red-900/20 border border-red-800 text-red-400 px-4 py-3 rounded-lg text-sm">
                                    <strong>Internal Error / Exception:</strong>
                                    <pre className="mt-1 whitespace-pre-wrap font-mono text-xs">{selectedLog.error_message}</pre>
                                </div>
                            )}

                            <div>
                                <h4 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                                    <span className="badge bg-indigo-500/20 text-indigo-300">{selectedLog.request_method || 'REQ'}</span>
                                    Request Payload
                                </h4>
                                <div className="bg-gray-950 border border-gray-800 rounded-lg p-4 font-mono text-xs text-gray-300 overflow-x-auto">
                                    {selectedLog.request_url && <div className="mb-2 pb-2 border-b border-gray-800 text-gray-500 break-all">{selectedLog.request_url}</div>}
                                    <pre>{selectedLog.request_payload ? JSON.stringify(selectedLog.request_payload, null, 2) : '(none)'}</pre>
                                </div>
                            </div>

                            <div>
                                <h4 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                                    <span className={`badge ${selectedLog.response_status >= 200 && selectedLog.response_status < 300 ? 'badge-delivered' : 'badge-failed'}`}>
                                        RES {selectedLog.response_status || 'ERR'}
                                    </span>
                                    Response Payload
                                </h4>
                                <div className="bg-gray-950 border border-gray-800 rounded-lg p-4 font-mono text-xs text-gray-300 overflow-x-auto">
                                    <pre>{selectedLog.response_payload ? JSON.stringify(selectedLog.response_payload, null, 2) : '(none)'}</pre>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
