"use client";

import { useEffect, useState } from 'react';
import axios from 'axios';
import { useLanguage } from '@/lib/LanguageContext';
import { Save } from 'lucide-react';

export default function SettingsPage() {
    const { t } = useLanguage();
    const [domain, setDomain] = useState('');
    const [botToken, setBotToken] = useState('');
    const [ship24Key, setShip24Key] = useState('');
    const [track17Key, setTrack17Key] = useState('');
    const [apiProvider, setApiProvider] = useState('ship24');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadSettings() {
            try {
                const res = await axios.get('http://localhost:3001/api/settings');
                if (res.data.domain) setDomain(res.data.domain);
                if (res.data.botToken) setBotToken(res.data.botToken);
                if (res.data.ship24Key) setShip24Key(res.data.ship24Key);
                if (res.data['17trackKey']) setTrack17Key(res.data['17trackKey']);
                if (res.data.apiProvider) setApiProvider(res.data.apiProvider);
            } catch {
                console.error('Failed to load settings');
            } finally {
                setLoading(false);
            }
        }
        loadSettings();
    }, []);

    const saveSetting = async (key: string, value: string) => {
        try {
            await axios.post('http://localhost:3001/api/settings', { key, value });

            if (key === 'botToken') {
                try {
                    await axios.post('http://localhost:3001/api/telegram/reinit');
                } catch (err) {
                    console.log("Could not reinit bot", err);
                }
            }

            alert(t('save') + ' OK!');
        } catch {
            alert('Error saving');
        }
    };

    if (loading) return null;

    return (
        <div className="min-h-screen bg-neutral-950 text-white p-8">
            <h1 className="text-3xl font-bold mb-8">{t('admin_panel')}</h1>

            <div className="max-w-2xl space-y-8">
                <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl shadow-lg">
                    <h2 className="text-xl font-semibold mb-4 text-neutral-200">{t('domain_config')}</h2>
                    <div className="flex gap-4">
                        <input
                            type="text"
                            value={domain}
                            onChange={e => setDomain(e.target.value)}
                            placeholder="https://example.com"
                            className="flex-1 bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors"
                        />
                        <button
                            onClick={() => saveSetting('domain', domain)}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors flex items-center gap-2">
                            <Save size={18} /> {t('save')}
                        </button>
                    </div>
                </div>

                <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl shadow-lg">
                    <h2 className="text-xl font-semibold mb-4 text-neutral-200">{t('telegram_bot')}</h2>
                    <div className="flex gap-4">
                        <input
                            type="password"
                            value={botToken}
                            onChange={e => setBotToken(e.target.value)}
                            placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                            className="flex-1 bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors"
                        />
                        <button
                            onClick={() => saveSetting('botToken', botToken)}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors flex items-center gap-2">
                            <Save size={18} /> {t('save')}
                        </button>
                    </div>
                    <p className="mt-3 text-sm text-neutral-500">Find your bot via Telegram, type /start to get your tracking updates instantly. The bot re-initializes itself automatically!</p>
                </div>
                <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl shadow-lg">
                    <h2 className="text-xl font-semibold mb-4 text-neutral-200">Tracking API Provider</h2>

                    <div className="flex gap-4 mb-6">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="apiProvider"
                                value="ship24"
                                checked={apiProvider === 'ship24'}
                                onChange={(e) => {
                                    setApiProvider(e.target.value);
                                    saveSetting('apiProvider', e.target.value);
                                }}
                                className="w-4 h-4 text-blue-600 bg-neutral-950 border-neutral-700"
                            />
                            <span className="text-neutral-300">Ship24</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="apiProvider"
                                value="17track"
                                checked={apiProvider === '17track'}
                                onChange={(e) => {
                                    setApiProvider(e.target.value);
                                    saveSetting('apiProvider', e.target.value);
                                }}
                                className="w-4 h-4 text-blue-600 bg-neutral-950 border-neutral-700"
                            />
                            <span className="text-neutral-300">17Track</span>
                        </label>
                    </div>

                    <div className="space-y-6">
                        {apiProvider === 'ship24' && (
                            <div>
                                <h3 className="text-sm font-medium mb-2 text-neutral-400">{t('ship24_api_key')}</h3>
                                <div className="flex gap-4">
                                    <input
                                        type="password"
                                        value={ship24Key}
                                        onChange={e => setShip24Key(e.target.value)}
                                        placeholder="apik_..."
                                        className="flex-1 bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors"
                                    />
                                    <button
                                        onClick={() => saveSetting('ship24Key', ship24Key)}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors flex items-center gap-2">
                                        <Save size={18} /> {t('save')}
                                    </button>
                                </div>
                                <p className="mt-2 text-xs text-neutral-500">Create an account on Ship24 to get a public API key for comprehensive tracking.</p>
                            </div>
                        )}

                        {apiProvider === '17track' && (
                            <div>
                                <h3 className="text-sm font-medium mb-2 text-neutral-400">17Track API Key</h3>
                                <div className="flex gap-4">
                                    <input
                                        type="password"
                                        value={track17Key}
                                        onChange={e => setTrack17Key(e.target.value)}
                                        placeholder="API Token from 17track..."
                                        className="flex-1 bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors"
                                    />
                                    <button
                                        onClick={() => saveSetting('17trackKey', track17Key)}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors flex items-center gap-2">
                                        <Save size={18} /> {t('save')}
                                    </button>
                                </div>
                                <p className="mt-2 text-xs text-neutral-500">Register on 17Track Developer Portal for the API Key.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
