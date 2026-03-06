'use client'
import { useState } from 'react'
import { api } from '@/lib/api'
import { X, Plus, Upload, Package, ChevronDown } from 'lucide-react'

interface Props {
    onClose: () => void
    onAdded: () => void
}

export default function AddShipmentModal({ onClose, onAdded }: Props) {
    const [mode, setMode] = useState<'single' | 'bulk'>('single')
    const [tracking_number, setTrackingNumber] = useState('')
    const [note, setNote] = useState('')
    const [source_platform, setSourcePlatform] = useState('')
    const [bulkText, setBulkText] = useState('')
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState<{ carrier_detected?: any } | null>(null)
    const [error, setError] = useState('')

    const handleSingle = async () => {
        if (!tracking_number.trim()) { setError('Tracking number is required'); return }
        setLoading(true); setError('')
        try {
            const r = await api.shipments.create({ tracking_number: tracking_number.trim(), note, source_platform })
            setResult(r)
            setTimeout(onAdded, 1200)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleBulk = async () => {
        const numbers = bulkText.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean)
        if (numbers.length === 0) { setError('Enter at least one tracking number'); return }
        setLoading(true); setError('')
        try {
            await api.shipments.bulk(numbers)
            onAdded()
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden fade-in-up">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
                    <div className="flex items-center gap-2">
                        <Package size={18} className="text-indigo-400" />
                        <h2 className="font-semibold text-white">Add Shipment</h2>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Mode tabs */}
                <div className="flex border-b border-gray-800">
                    {(['single', 'bulk'] as const).map(m => (
                        <button key={m} onClick={() => setMode(m)}
                            className={`flex-1 py-3 text-sm font-medium transition-colors ${mode === m
                                ? 'text-indigo-400 border-b-2 border-indigo-500'
                                : 'text-gray-500 hover:text-gray-300'}`}>
                            {m === 'single' ? '📦 Single Number' : '📋 Bulk Import'}
                        </button>
                    ))}
                </div>

                <div className="p-5 space-y-4">
                    {mode === 'single' ? (
                        <>
                            <div>
                                <label className="text-xs text-gray-400 mb-1.5 block">Tracking Number *</label>
                                <input className="input font-mono" placeholder="e.g. SF1234567890123"
                                    value={tracking_number} onChange={e => setTrackingNumber(e.target.value.toUpperCase())}
                                    onKeyDown={e => e.key === 'Enter' && handleSingle()} autoFocus />
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 mb-1.5 block">Platform</label>
                                <select className="select" value={source_platform} onChange={e => setSourcePlatform(e.target.value)}>
                                    <option value="">Select platform...</option>
                                    <option>Shopee</option><option>Lazada</option><option>TikTok Shop</option>
                                    <option>Taobao</option><option>1688</option><option>Manual</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 mb-1.5 block">Note (optional)</label>
                                <input className="input" placeholder="Customer name, order ID, etc."
                                    value={note} onChange={e => setNote(e.target.value)} />
                            </div>
                        </>
                    ) : (
                        <div>
                            <label className="text-xs text-gray-400 mb-1.5 block">
                                Tracking Numbers (one per line, or comma-separated, max 200)
                            </label>
                            <textarea className="input h-40 resize-none font-mono text-xs"
                                placeholder={"SF1234567890123\nYT123456789012345678\nJT123456789012"}
                                value={bulkText} onChange={e => setBulkText(e.target.value)} />
                            <p className="text-xs text-gray-600 mt-1">
                                {bulkText.split(/[\n,;]+/).filter(s => s.trim()).length} tracking numbers entered
                            </p>
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-900/30 border border-red-800/50 text-red-400 text-sm rounded-lg px-3 py-2">
                            {error}
                        </div>
                    )}

                    {result && (
                        <div className="bg-green-900/30 border border-green-800/50 text-green-400 text-sm rounded-lg px-3 py-2">
                            ✅ Added! Carrier detected: <strong>{result.carrier_detected?.label || 'Unknown'}</strong>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex gap-3 px-5 pb-5">
                    <button onClick={onClose} className="btn-ghost flex-1 justify-center">
                        Cancel
                    </button>
                    <button onClick={mode === 'single' ? handleSingle : handleBulk}
                        disabled={loading} className="btn-primary flex-1 justify-center">
                        <Plus size={15} />
                        {loading ? 'Adding...' : mode === 'single' ? 'Add Shipment' : 'Import All'}
                    </button>
                </div>
            </div>
        </div>
    )
}
