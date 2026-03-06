'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { api, Shipment } from '@/lib/api'
import { ArrowLeft, RefreshCw, MapPin, Clock, Package, Truck, RotateCw } from 'lucide-react'
import { StatusBadge } from '@/components/ui/StatusBadge'

function TimelineItem({ event, isFirst }: { event: any; isFirst: boolean }) {
    const colors = {
        delivered: 'border-green-500 bg-green-500/20',
        delivering: 'border-blue-500 bg-blue-500/20',
        failed: 'border-red-500 bg-red-500/20',
        default: 'border-gray-600 bg-gray-800',
    }
    const dotColor = colors[event.status as keyof typeof colors] || colors.default

    return (
        <div className="timeline-item">
            <div className={`timeline-dot border-2 w-5 h-5 ${dotColor} ${isFirst ? 'pulse-glow' : ''}`} />
            <div className={`ml-2 p-3 rounded-lg border ${isFirst ? 'border-indigo-500/30 bg-indigo-900/10' : 'border-gray-800 bg-gray-900/50'}`}>
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className={`text-sm font-medium ${isFirst ? 'text-indigo-300' : 'text-gray-200'}`}>
                            {event.description || event.status || 'Status update'}
                        </p>
                        {event.location && (
                            <div className="flex items-center gap-1 mt-1">
                                <MapPin size={11} className="text-gray-500" />
                                <span className="text-xs text-gray-500">{event.location}</span>
                            </div>
                        )}
                    </div>
                    {event.event_time && (
                        <span className="text-xs text-gray-600 whitespace-nowrap">
                            {new Date(event.event_time).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                    )}
                </div>
            </div>
        </div>
    )
}

export default function ShipmentDetailPage() {
    const { id } = useParams<{ id: string }>()
    const router = useRouter()
    const [shipment, setShipment] = useState<Shipment | null>(null)
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)

    const load = async () => {
        try {
            const data = await api.shipments.get(id)
            setShipment(data)
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const handleRefresh = async () => {
        setRefreshing(true)
        await api.shipments.refresh(id)
        setTimeout(async () => {
            await load()
            setRefreshing(false)
        }, 3000)
    }

    useEffect(() => { load() }, [id])

    if (loading) {
        return (
            <div className="space-y-4">
                <div className="h-8 skeleton rounded w-48" />
                <div className="card h-40 skeleton" />
                <div className="card h-64 skeleton" />
            </div>
        )
    }

    if (!shipment) {
        return (
            <div className="text-center py-16">
                <p className="text-gray-500">Shipment not found</p>
                <button onClick={() => router.back()} className="btn-ghost mt-4">Go back</button>
            </div>
        )
    }

    const events = shipment.events || []

    return (
        <div className="max-w-3xl mx-auto space-y-5 fade-in-up">
            {/* Back + Actions */}
            <div className="flex items-center gap-3">
                <button onClick={() => router.back()} className="btn-ghost">
                    <ArrowLeft size={15} /> Back
                </button>
                <div className="flex-1" />
                <button onClick={handleRefresh} disabled={refreshing} className="btn-primary">
                    <RotateCw size={15} className={refreshing ? 'animate-spin' : ''} />
                    {refreshing ? 'Updating...' : 'Refresh Tracking'}
                </button>
            </div>

            {/* Shipment info card */}
            <div className="card">
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <Package size={18} className="text-indigo-400" />
                            <h2 className="text-xl font-bold text-white font-mono">{shipment.tracking_number}</h2>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                            <Truck size={13} className="text-gray-500" />
                            <span className="text-sm text-gray-400">{shipment.carrier || 'Unknown Carrier'}</span>
                        </div>
                    </div>
                    <StatusBadge status={shipment.delivery_status} size="lg" />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-gray-800">
                    {[
                        { label: 'Platform', value: shipment.source_platform || '—' },
                        { label: 'Note', value: shipment.note || '—' },
                        { label: 'API Used', value: shipment.api_provider || '—' },
                        {
                            label: 'Last Update', value: shipment.last_tracking_update
                                ? new Date(shipment.last_tracking_update).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
                                : 'Never'
                        },
                    ].map(({ label, value }) => (
                        <div key={label}>
                            <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
                            <p className="text-sm text-gray-200 mt-0.5">{value}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Timeline */}
            <div className="card">
                <div className="flex items-center gap-2 mb-5">
                    <Clock size={16} className="text-indigo-400" />
                    <h3 className="font-semibold text-white">Tracking Timeline</h3>
                    <span className="ml-auto text-xs text-gray-500">{events.length} events</span>
                </div>

                {events.length === 0 ? (
                    <div className="text-center py-10 text-gray-600">
                        <Clock size={32} className="mx-auto mb-3 opacity-30" />
                        <p className="text-sm">No tracking events yet.</p>
                        <p className="text-xs mt-1">Click "Refresh Tracking" to fetch latest status.</p>
                    </div>
                ) : (
                    <div>
                        {events.map((event, i) => (
                            <TimelineItem key={event.id || i} event={event} isFirst={i === 0} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
