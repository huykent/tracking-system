import { Clock, CheckCircle2, Truck, AlertCircle } from 'lucide-react'

type Status = 'pending' | 'delivering' | 'delivered' | 'failed'

const statusConfig: Record<Status, { label: string; className: string; icon: React.ElementType }> = {
    pending: { label: 'Pending', className: 'badge-pending', icon: Clock },
    delivering: { label: 'Delivering', className: 'badge-delivering', icon: Truck },
    delivered: { label: 'Delivered', className: 'badge-delivered', icon: CheckCircle2 },
    failed: { label: 'Failed', className: 'badge-failed', icon: AlertCircle },
}

interface Props {
    status: string
    size?: 'sm' | 'md' | 'lg'
}

export function StatusBadge({ status, size = 'md' }: Props) {
    const config = statusConfig[status as Status] || {
        label: status, className: 'badge-pending', icon: Clock
    }
    const Icon = config.icon
    const iconSize = size === 'sm' ? 10 : size === 'lg' ? 14 : 12

    return (
        <span className={`badge ${config.className} ${size === 'lg' ? 'text-sm px-3 py-1' : ''}`}>
            <Icon size={iconSize} />
            {config.label}
        </span>
    )
}
