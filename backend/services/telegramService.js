const TelegramBot = require('node-telegram-bot-api');
const { query } = require('../db');

let bot = null;
let chatId = null;

async function loadConfig() {
    const { rows } = await query(
        `SELECT key, value FROM settings WHERE key IN ('telegram_bot_token', 'telegram_chat_id', 'telegram_enabled')`
    );
    const cfg = Object.fromEntries(rows.map(r => [r.key, r.value]));
    return cfg;
}

async function getBot() {
    const cfg = await loadConfig();
    if (cfg.telegram_enabled !== 'true' || !cfg.telegram_bot_token) return null;

    if (!bot || chatId !== cfg.telegram_chat_id) {
        try {
            bot = new TelegramBot(cfg.telegram_bot_token, { polling: false });
            chatId = cfg.telegram_chat_id;
        } catch (err) {
            console.error('[Telegram] Failed to init bot:', err.message);
            return null;
        }
    }
    return { bot, chatId };
}

async function sendMessage(text) {
    try {
        const instance = await getBot();
        if (!instance) return;
        await instance.bot.sendMessage(instance.chatId, text, { parse_mode: 'HTML' });
    } catch (err) {
        console.error('[Telegram] Send message failed:', err.message);
    }
}

async function notifyNewEvent(trackingNumber, carrier, event) {
    const date = event?.event_time
        ? new Date(event.event_time).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
        : 'N/A';

    const text = [
        `📦 <b>Cập nhật vận đơn mới</b>`,
        ``,
        `🔢 Tracking: <code>${trackingNumber}</code>`,
        `🚚 Hãng: <b>${carrier || 'Unknown'}</b>`,
        ``,
        `🕐 ${date}`,
        `📍 ${event?.location || ''}`,
        `📝 ${event?.description || event?.status || ''}`,
    ].join('\n');

    await sendMessage(text);
}

async function notifyDelivered(trackingNumber, carrier) {
    const text = [
        `✅ <b>Đã giao hàng thành công!</b>`,
        ``,
        `🔢 Tracking: <code>${trackingNumber}</code>`,
        `🚚 Hãng: <b>${carrier || 'Unknown'}</b>`,
        `🎉 Kiện hàng đã được giao thành công.`,
    ].join('\n');

    await sendMessage(text);
}

async function notifyFailed(trackingNumber, carrier, reason) {
    const text = [
        `❌ <b>Giao hàng thất bại</b>`,
        ``,
        `🔢 Tracking: <code>${trackingNumber}</code>`,
        `🚚 Hãng: <b>${carrier || 'Unknown'}</b>`,
        `📝 ${reason || 'Không rõ lý do'}`,
    ].join('\n');

    await sendMessage(text);
}

module.exports = { sendMessage, notifyNewEvent, notifyDelivered, notifyFailed };
