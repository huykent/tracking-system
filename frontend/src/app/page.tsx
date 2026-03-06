"use client";

import { useEffect, useState } from 'react';
import axios from 'axios';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { useLanguage } from '@/lib/LanguageContext';
import { Plus, Trash2, Eye, X } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

interface SummaryData {
  total_shipments: string | number;
  delivered_shipments: string | number;
  delivering_shipments: string | number;
  failed_shipments: string | number;
  fake_tracking: string | number;
}

interface ShipmentData {
  id: number;
  tracking_number: string;
  carrier: string;
  delivery_status: string;
}

export default function Home() {
  const { t } = useLanguage();
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [shipments, setShipments] = useState<ShipmentData[]>([]);
  const [newTracking, setNewTracking] = useState('');
  const [newCarrier, setNewCarrier] = useState('');

  const [selectedShipment, setSelectedShipment] = useState<ShipmentData | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [shipmentEvents, setShipmentEvents] = useState<any[]>([]);

  const fetchData = async () => {
    try {
      const [sumRes, shipRes] = await Promise.all([
        axios.get('http://localhost:3001/api/analytics/summary'),
        axios.get('http://localhost:3001/api/shipments')
      ]);
      setSummary(sumRes.data);
      setShipments(shipRes.data);
    } catch (err) {
      console.error('Failed to fetch data', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const addTracking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTracking) return;
    try {
      await axios.post('http://localhost:3001/api/shipments', {
        tracking_number: newTracking,
        carrier: newCarrier,
      });
      setNewTracking('');
      setNewCarrier('');
      fetchData();
    } catch {
      alert('Error adding tracking');
    }
  };

  const deleteTracking = async (tracking_number: string) => {
    if (!confirm('Are you sure?')) return;
    try {
      await axios.delete(`http://localhost:3001/api/shipments/${tracking_number}`);
      fetchData();
    } catch {
      alert('Error deleting tracking');
    }
  };

  const openShipment = async (shipment: ShipmentData) => {
    try {
      const res = await axios.get(`http://localhost:3001/api/shipments/${shipment.tracking_number}`);
      setSelectedShipment(shipment);
      setShipmentEvents(res.data.events || []);
    } catch {
      alert('Error fetching tracking events');
    }
  };

  return (
    <main className="min-h-screen bg-transparent text-white p-8 font-sans">
      <h1 className="text-4xl font-bold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
        {t('app_title')}
      </h1>

      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          <StatCard title={t('total_shipments')} value={summary.total_shipments} />
          <StatCard title={t('delivered')} value={summary.delivered_shipments} color="text-green-400" />
          <StatCard title={t('delivering')} value={summary.delivering_shipments} color="text-yellow-400" />
          <StatCard title={t('failed_fake')} value={Number(summary.failed_shipments) + Number(summary.fake_tracking)} color="text-red-400" />
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 mb-12">
        <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl shadow-xl">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold">{t('recent_shipments')}</h2>
          </div>

          <form onSubmit={addTracking} className="flex gap-2 mb-6">
            <input
              type="text"
              placeholder={t('tracking_number')}
              value={newTracking}
              onChange={(e) => setNewTracking(e.target.value)}
              className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 text-white outline-none focus:border-blue-500"
            />
            <input
              type="text"
              placeholder={t('carrier')}
              value={newCarrier}
              onChange={(e) => setNewCarrier(e.target.value)}
              className="w-1/3 bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 text-white outline-none focus:border-blue-500"
            />
            <button type="submit" className="bg-blue-600 hover:bg-blue-500 p-2 rounded-lg text-white transition-colors">
              <Plus size={24} />
            </button>
          </form>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-800 text-neutral-400">
                  <th className="py-3 px-4">{t('tracking_number')}</th>
                  <th className="py-3 px-4">{t('carrier')}</th>
                  <th className="py-3 px-4">{t('status')}</th>
                  <th className="py-3 px-4 text-center">{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {shipments.map((s: ShipmentData) => (
                  <tr key={s.id} className="border-b border-neutral-800 hover:bg-neutral-800/50 transition-colors">
                    <td className="py-3 px-4 font-mono">{s.tracking_number}</td>
                    <td className="py-3 px-4">{s.carrier}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded text-xs uppercase font-medium tracking-wider
                        ${s.delivery_status === 'delivered' ? 'bg-green-500/20 text-green-400' :
                          s.delivery_status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-blue-500/20 text-blue-400'}`}>
                        {s.delivery_status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => openShipment(s)} className="text-blue-500 hover:text-blue-400 transition-colors p-2 rounded-lg hover:bg-blue-500/10">
                          <Eye size={18} />
                        </button>
                        <button onClick={() => deleteTracking(s.tracking_number)} className="text-red-500 hover:text-red-400 transition-colors p-2 rounded-lg hover:bg-red-500/10">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {shipments.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-6 text-neutral-500">No shipments tracking found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedShipment && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-neutral-800 flex justify-between items-center bg-neutral-950">
              <div>
                <h2 className="text-xl font-bold">{t('tracking_number')}: <span className="text-blue-400">{selectedShipment.tracking_number}</span></h2>
                <p className="text-sm text-neutral-400 mt-1">{t('carrier')}: {selectedShipment.carrier.toUpperCase()}</p>
              </div>
              <button onClick={() => setSelectedShipment(null)} className="text-neutral-400 hover:text-white transition-colors bg-neutral-800 p-2 rounded-full hover:bg-neutral-700">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <div className="space-y-6">
                {shipmentEvents.length === 0 ? (
                  <p className="text-center text-neutral-500 py-8">No tracking events yet.</p>
                ) : (
                  shipmentEvents.map((evt, idx) => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    let parsedData: any = null;
                    try { if (evt.raw_data) parsedData = JSON.parse(evt.raw_data); } catch { }
                    return (
                      <div key={idx} className="flex gap-4 relative">
                        {idx !== shipmentEvents.length - 1 && (
                          <div className="absolute top-8 left-[11px] bottom-0 w-[2px] bg-neutral-800 -mb-6"></div>
                        )}
                        <div className="w-6 h-6 rounded-full bg-blue-500/20 border-4 border-blue-500 flex-shrink-0 z-10 mt-1"></div>
                        <div className="flex-1 pb-6">
                          <p className="font-semibold text-lg text-white mb-1">{evt.status}</p>
                          <p className="text-neutral-400 text-sm">{evt.location}</p>
                          <p className="text-neutral-500 text-xs mt-1">{new Date(evt.event_time).toLocaleString()}</p>

                          {parsedData?.proof_url && (
                            <div className="mt-4">
                              <p className="text-sm text-neutral-400 mb-2">Proof of Delivery:</p>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={parsedData.proof_url} alt="Proof" className="rounded-lg object-cover w-full max-w-sm h-48 border border-neutral-700" />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function StatCard({ title, value, color = "text-white" }: { title: string, value: string | number, color?: string }) {
  return (
    <div className="bg-neutral-900 p-6 rounded-2xl shadow-xl shadow-black/50 border border-neutral-800 hover:border-blue-500/50 transition-colors group">
      <h3 className="text-neutral-400 text-sm font-medium tracking-wide border-b border-neutral-800 pb-2 uppercase mb-4">{title}</h3>
      <p className={`text-5xl font-bold ${color} group-hover:scale-105 transform origin-left transition-transform`}>{value}</p>
    </div>
  );
}
