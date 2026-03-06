"use client";

import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';
import L from 'leaflet';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function Map({ data = [] }: { data?: any[] }) {
    useEffect(() => {
        // Fix leafet icon issues in next.js
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
            iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
            iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
            shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
        });
    }, []);

    // Get the latest coordinates to center the map, fallback to world center
    let center: [number, number] = [39.9042, 116.4074];
    if (data.length > 0) {
        const lastShipment = data[data.length - 1];
        if (lastShipment.locations && lastShipment.locations.length > 0) {
            const lastLoc = lastShipment.locations[lastShipment.locations.length - 1];
            center = [lastLoc.lat, lastLoc.lng];
        }
    }

    return (
        <div style={{ height: '100%', width: '100%' }}>
            <MapContainer center={center} zoom={4} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                />

                {data.map((shipment, sIdx) => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const positions: [number, number][] = shipment.locations.map((loc: any) => [loc.lat, loc.lng]);
                    const color = shipment.delivery_status === 'delivered' ? '#4ade80' :
                        shipment.delivery_status === 'failed' ? '#f87171' : '#3b82f6';

                    return (
                        <div key={sIdx}>
                            <Polyline positions={positions} color={color} weight={3} opacity={0.7} />

                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            {shipment.locations.map((loc: any, lIdx: number) => (
                                <Marker key={`${sIdx}-${lIdx}`} position={[loc.lat, loc.lng]}>
                                    <Popup>
                                        <div className="text-gray-900 font-sans">
                                            <p className="font-bold text-sm mb-1">{shipment.tracking_number}</p>
                                            <p className="text-xs">{loc.name}</p>
                                            <p className="text-xs text-gray-500 mt-1">{loc.status}</p>
                                            <p className="text-xs text-gray-400 mt-1">{new Date(loc.time).toLocaleString()}</p>
                                        </div>
                                    </Popup>
                                </Marker>
                            ))}
                        </div>
                    );
                })}
            </MapContainer>
        </div>
    );
}
