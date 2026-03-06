const API_URL = typeof window !== 'undefined' ? '' : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000')

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
    })
    if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
    }
    return res.json()
}

// ─── Dashboard ────────────────────────────────────────────
export const api = {
    dashboard: {
        stats: () => fetchAPI<DashboardStats>('/api/dashboard/stats'),
        providers: () => fetchAPI<Provider[]>('/api/dashboard/providers'),
    },

    shipments: {
        list: (params: ShipmentQuery) => fetchAPI<ShipmentListResponse>(`/api/shipments?${new URLSearchParams(params as any)}`),
        get: (id: string) => fetchAPI<Shipment>(`/api/shipments/${id}`),
        create: (data: CreateShipment) => fetchAPI<{ shipment: Shipment; carrier_detected: CarrierInfo }>('/api/shipments', { method: 'POST', body: JSON.stringify(data) }),
        bulk: (numbers: string[]) => fetchAPI('/api/shipments/bulk', { method: 'POST', body: JSON.stringify({ numbers }) }),
        update: (id: string, data: any) => fetchAPI(`/api/shipments/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
        delete: (id: string) => fetchAPI(`/api/shipments/${id}`, { method: 'DELETE' }),
        refresh: (id: string) => fetchAPI(`/api/shipments/${id}/refresh`, { method: 'POST' }),
    },

    providers: {
        list: () => fetchAPI<Provider[]>('/api/providers'),
        update: (name: string, data: any) => fetchAPI(`/api/providers/${name}`, { method: 'PATCH', body: JSON.stringify(data) }),
        reset: (name: string) => fetchAPI(`/api/providers/${name}/reset`, { method: 'POST' }),
    },

    settings: {
        get: () => fetchAPI<Record<string, string>>('/api/settings'),
        save: (data: any) => fetchAPI('/api/settings', { method: 'PATCH', body: JSON.stringify(data) }),
        testTelegram: () => fetchAPI('/api/settings/telegram/test', { method: 'POST' }),
    },
}

// ─── Types ────────────────────────────────────────────────
export interface DashboardStats {
    total: number; pending: number; delivering: number; delivered: number; failed: number
    carriers: { carrier: string; count: number }[]
    daily: { date: string; count: number }[]
    queue: { waiting: number; active: number; completed: number; failed: number; delayed: number }
}

export interface Shipment {
    id: string; tracking_number: string; carrier: string; carrier_key?: number
    delivery_status: 'pending' | 'delivering' | 'delivered' | 'failed'
    note?: string; source_platform?: string; ship_time?: string
    last_tracking_update?: string; api_provider?: string
    created_at: string; updated_at: string
    events?: TrackingEvent[]
}

export interface TrackingEvent {
    id: string; event_time: string; status: string; location: string; description: string
}

export interface Provider {
    id: number; name: string; label: string; enabled: boolean
    daily_limit: number; used_today: number; priority: number; has_key: boolean
}

export interface CarrierInfo { name: string; label: string; carrierKey: number }

export interface ShipmentQuery {
    page?: number; limit?: number; status?: string; carrier?: string
    search?: string; sortBy?: string; sortDir?: string
}

export interface ShipmentListResponse {
    data: Shipment[]; total: number; page: number; limit: number
}

export interface CreateShipment {
    tracking_number: string; note?: string; source_platform?: string; ship_time?: string
}
