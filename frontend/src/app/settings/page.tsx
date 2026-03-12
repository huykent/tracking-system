'use client'
import { useEffect, useState } from 'react'
import { api, Provider } from '@/lib/api'
import { Key, ToggleLeft, ToggleRight, RotateCw, Save, CheckCircle, AlertCircle, MessageCircle, Zap, ChevronUp, ChevronDown, Settings as SettingsIcon, Terminal } from 'lucide-react'

function ProviderRow({ provider, onSave }: { provider: Provider; onSave: () => void }) {
    const [apiKey, setApiKey] = useState(provider.api_key || '');
    const [enabled, setEnabled] = useState(provider.enabled);
    const [dailyLimit, setDailyLimit] = useState(provider.daily_limit);
    const [priority, setPriority] = useState(provider.priority);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    // Multi-key support
    const isMultiKey = provider.name === 'trackingmore';
    const [multiKeys, setMultiKeys] = useState<{ key: string, used: number, limit: number, month: number }[]>([]);

    useEffect(() => {
        if (isMultiKey && provider.api_key) {
            try {
                const parsed = JSON.parse(provider.api_key);
                setMultiKeys(Array.isArray(parsed) ? parsed : []);
            } catch (e) {
                const parts = provider.api_key.split(',').filter(Boolean);
                setMultiKeys(parts.map(k => ({ key: k.trim(), used: 0, limit: 50, month: new Date().getMonth() })));
            }
        }
    }, [provider.api_key, isMultiKey]);

    const usagePct = Math.min(100, Math.round((provider.used_today / provider.daily_limit) * 100))
    const usageColor = usagePct > 80 ? 'bg-red-500' : usagePct > 60 ? 'bg-yellow-500' : 'bg-green-500'

    const save = async () => {
        setSaving(true)
        try {
            const finalApiKey = isMultiKey ? JSON.stringify(multiKeys) : (apiKey || provider.api_key || undefined);
            await api.providers.update(provider.name, {
                api_key: finalApiKey,
                enabled, daily_limit: dailyLimit, priority,
            })
            setSaved(true)
            setTimeout(() => setSaved(false), 2000)
            onSave()
        } catch (err) {
            console.error(err)
        } finally {
            setSaving(false)
        }
    }

    const reset = async () => {
        await api.providers.reset(provider.name)
        onSave()
    }

    return (
        <div className={`card transition-colors duration-200 ${enabled ? 'border-gray-700' : 'border-gray-800 opacity-60'}`}>
            <div className="flex flex-wrap items-start gap-4">
                {/* Provider info */}
                <div className="flex-1 min-w-48">
                    <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold
              ${enabled ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-500'}`}>
                            {provider.label.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <p className="font-semibold text-sm text-white">{provider.label}</p>
                                {provider.has_key && (
                                    <span className="badge badge-delivering text-xs">
                                        <Key size={10} /> API Key Set
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-gray-500">Priority: {provider.priority}</p>
                        </div>
                    </div>

                    {/* Usage bar */}
                    <div className="mt-3">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>Usage today</span>
                            <span>{provider.used_today} / {provider.daily_limit}</span>
                        </div>
                        <div className="h-1.5 bg-gray-800 rounded-full">
                            <div className={`h-full ${usageColor} rounded-full transition-all duration-500`} style={{ width: `${usagePct}%` }} />
                        </div>
                    </div>
                </div>

                {/* Controls */}
                <div className="flex flex-col gap-3 flex-1 min-w-full xl:min-w-0">
                    <div className="flex flex-wrap gap-3 items-end">
                        {/* API Key input */}
                        {!isMultiKey && (
                            <div className="w-56">
                                <label className="text-xs text-gray-500 mb-1 block">API Key</label>
                                <input
                                    type={provider.name === 'kuaidi100' ? 'text' : 'password'}
                                    className="input"
                                    placeholder={provider.has_key ? '******** (Hidden)' : 'Enter API key...'}
                                    value={apiKey}
                                    onChange={e => setApiKey(e.target.value)}
                                />
                            </div>
                        )}

                        {/* Daily Limit */}
                        <div className="w-24">
                            <label className="text-xs text-gray-500 mb-1 block">Daily Limit</label>
                            <input type="number" className="input" value={dailyLimit}
                                onChange={e => setDailyLimit(parseInt(e.target.value))} />
                        </div>

                        {/* Priority */}
                        <div className="w-20">
                            <label className="text-xs text-gray-500 mb-1 block">Priority</label>
                            <input type="number" className="input" value={priority} min={1} max={99}
                                onChange={e => setPriority(parseInt(e.target.value))} />
                        </div>

                        {/* Toggle */}
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">Enabled</label>
                            <button onClick={() => setEnabled(!enabled)}
                                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-all duration-200 border
                ${enabled ? 'bg-green-900/30 text-green-400 border-green-800/50' : 'bg-gray-800 text-gray-500 border-gray-700'}`}>
                                {enabled ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                                {enabled ? 'On' : 'Off'}
                            </button>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                            <button onClick={reset} className="btn-ghost" title="Reset daily counter">
                                <RotateCw size={14} />
                            </button>
                            <button onClick={save} disabled={saving} className="btn-primary">
                                {saved ? <CheckCircle size={14} /> : <Save size={14} />}
                                {saved ? 'Saved!' : saving ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    </div>

                    {isMultiKey && (
                        <div className="bg-gray-950 p-4 rounded-lg border border-gray-800 mt-2">
                            <div className="flex items-center justify-between mb-3">
                                <label className="text-sm text-gray-300 font-semibold flex items-center gap-2">
                                    <Key size={14} className="text-indigo-400" /> Quản lý API Keys
                                </label>
                                <button onClick={() => setMultiKeys([...multiKeys, { key: '', used: 0, limit: 50, month: new Date().getMonth() }])} className="text-xs text-indigo-400 hover:text-indigo-300 bg-indigo-900/20 px-3 py-1.5 rounded">
                                    + Thêm Key
                                </button>
                            </div>
                            <div className="space-y-2">
                                {multiKeys.map((mk, i) => (
                                    <div key={i} className="flex flex-wrap gap-2 items-center">
                                        <input type="text" className="input flex-1 min-w-[200px] text-xs py-2" placeholder="TrackingMore API Key" value={mk.key} onChange={e => {
                                            const n = [...multiKeys]; n[i].key = e.target.value; setMultiKeys(n);
                                        }} />
                                        <div className="w-24">
                                            <div className="text-[10px] text-gray-500 mb-0.5">Giới hạn/tháng:</div>
                                            <input type="number" className="input text-xs py-1.5 px-2" placeholder="Limit" value={mk.limit} onChange={e => {
                                                const n = [...multiKeys]; n[i].limit = parseInt(e.target.value) || 0; setMultiKeys(n);
                                            }} />
                                        </div>
                                        <div className="w-20 pl-2">
                                            <div className="text-[10px] text-gray-500 mb-0.5">Đã dùng:</div>
                                            <span className={`text-xs font-semibold ${mk.used >= mk.limit ? 'text-red-400' : 'text-gray-300'}`}>{mk.used} / {mk.limit}</span>
                                        </div>
                                        <div className="mt-4">
                                            <button onClick={() => setMultiKeys(multiKeys.filter((_, idx) => i !== idx))} className="text-red-500 hover:bg-red-500/20 p-2 rounded transition-colors">
                                                <AlertCircle size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {multiKeys.length === 0 && <p className="text-xs text-gray-600">Chưa có key nào. Hãy bấm thêm key!</p>}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default function SettingsPage() {
    const [providers, setProviders] = useState<Provider[]>([])
    const [settings, setSettings] = useState<Record<string, string>>({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [testResult, setTestResult] = useState<string | null>(null)

    const load = async () => {
        const [p, s] = await Promise.all([api.providers.list(), api.settings.get()])
        setProviders(p)
        setSettings(s)
        setLoading(false)
    }

    useEffect(() => { load() }, [])

    const saveSettings = async () => {
        setSaving(true)
        try {
            await api.settings.save(settings)
            setSaved(true)
            setTimeout(() => setSaved(false), 2000)
        } catch (err) { console.error(err) }
        finally { setSaving(false) }
    }

    const testTelegram = async () => {
        try {
            await api.settings.testTelegram()
            setTestResult('✅ Message sent! Check your Telegram.')
        } catch (err: any) {
            setTestResult(`❌ Failed: ${err.message}`)
        }
        setTimeout(() => setTestResult(null), 4000)
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6 fade-in-up">

            {/* API Providers */}
            <div>
                <div className="flex items-center gap-2 mb-4">
                    <Zap size={18} className="text-indigo-400" />
                    <h2 className="text-lg font-bold text-white">API Providers</h2>
                </div>
                <p className="text-xs text-gray-500 mb-4">
                    Configure tracking API providers. The system automatically falls back to the next provider if one is at its limit.
                </p>

                {loading ? (
                    <div className="space-y-4">
                        {[...Array(3)].map((_, i) => <div key={i} className="card h-28 skeleton" />)}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Summary table */}
                        <div className="card p-0 overflow-hidden">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Provider</th>
                                        <th>Status</th>
                                        <th>Daily Limit</th>
                                        <th>Used Today</th>
                                        <th>Priority</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {providers.map(p => (
                                        <tr key={p.name}>
                                            <td className="font-medium text-white">{p.label}</td>
                                            <td>
                                                <span className={`badge ${p.enabled ? 'badge-delivered' : 'badge-pending'}`}>
                                                    {p.enabled ? 'Active' : 'Disabled'}
                                                </span>
                                            </td>
                                            <td className="text-gray-300">{p.daily_limit.toLocaleString()}</td>
                                            <td>
                                                <span className={p.used_today / p.daily_limit > 0.8 ? 'text-red-400' : 'text-gray-300'}>
                                                    {p.used_today.toLocaleString()}
                                                </span>
                                            </td>
                                            <td className="text-gray-300">{p.priority}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Provider config cards */}
                        {providers.map(p => <ProviderRow key={p.name} provider={p} onSave={load} />)}
                    </div>
                )}
            </div>

            {/* Telegram Settings */}
            <div>
                <div className="flex items-center gap-2 mb-4">
                    <MessageCircle size={18} className="text-indigo-400" />
                    <h2 className="text-lg font-bold text-white">Telegram Notifications</h2>
                </div>
                <div className="card space-y-4">
                    <div>
                        <label className="text-xs text-gray-400 mb-1.5 block">Bot Token</label>
                        <input type="password" className="input"
                            placeholder="Enter Telegram Bot Token from @BotFather"
                            value={settings.telegram_bot_token !== '***' ? settings.telegram_bot_token || '' : ''}
                            onChange={e => setSettings(s => ({ ...s, telegram_bot_token: e.target.value }))} />
                    </div>
                    <div>
                        <label className="text-xs text-gray-400 mb-1.5 block">Chat ID</label>
                        <input type="text" className="input"
                            placeholder="Your chat ID or group ID  (e.g. -100123456)"
                            value={settings.telegram_chat_id || ''}
                            onChange={e => setSettings(s => ({ ...s, telegram_chat_id: e.target.value }))} />
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <label className="text-sm text-gray-300">Enable Notifications</label>
                            <button
                                onClick={() => setSettings(s => ({ ...s, telegram_enabled: s.telegram_enabled === 'true' ? 'false' : 'true' }))}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all duration-200 border
                  ${settings.telegram_enabled === 'true'
                                        ? 'bg-green-900/30 text-green-400 border-green-800/50'
                                        : 'bg-gray-800 text-gray-500 border-gray-700'}`}>
                                {settings.telegram_enabled === 'true' ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                                {settings.telegram_enabled === 'true' ? 'Enabled' : 'Disabled'}
                            </button>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={testTelegram} className="btn-ghost">
                                <MessageCircle size={14} /> Test
                            </button>
                            <button onClick={saveSettings} disabled={saving} className="btn-primary">
                                {saved ? <CheckCircle size={14} /> : <Save size={14} />}
                                {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Settings'}
                            </button>
                        </div>
                    </div>
                    {testResult && (
                        <div className="mt-2 text-sm text-gray-300 bg-gray-800 rounded-lg p-3">{testResult}</div>
                    )}
                </div>
            </div>

            {/* Advanced / System Settings */}
            <div>
                <div className="flex items-center gap-2 mb-4">
                    <Terminal size={18} className="text-indigo-400" />
                    <h2 className="text-lg font-bold text-white">System Settings</h2>
                </div>
                <div className="card space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <label className="text-sm text-gray-300">API Debug Mode</label>
                            <p className="text-xs text-gray-500">Log all API provider requests and responses. Can consume database space quickly.</p>
                        </div>
                        <div className="flex gap-2 items-center">
                            <button
                                onClick={() => setSettings(s => ({ ...s, debug_mode: s.debug_mode === 'true' ? 'false' : 'true' }))}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all duration-200 border
                                    ${settings.debug_mode === 'true'
                                        ? 'bg-green-900/30 text-green-400 border-green-800/50'
                                        : 'bg-gray-800 text-gray-500 border-gray-700'}`}>
                                {settings.debug_mode === 'true' ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                                {settings.debug_mode === 'true' ? 'Enabled' : 'Disabled'}
                            </button>
                        </div>
                    </div>
                    <div className="flex justify-end border-t border-gray-800 pt-3">
                        <button onClick={saveSettings} disabled={saving} className="btn-primary">
                            {saved ? <CheckCircle size={14} /> : <Save size={14} />}
                            {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Settings'}
                        </button>
                    </div>
                </div>
            </div>

        </div>
    )
}
