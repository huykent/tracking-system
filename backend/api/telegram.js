const express = require('express');
const TelegramBot = require('node-telegram-bot-api');

module.exports = (db) => {
    const router = express.Router();
    let bot = null;
    let currentToken = null;

    async function initBot() {
        try {
            const result = await db.query("SELECT value FROM settings WHERE key = 'botToken'");
            const token = result.rows.length > 0 ? result.rows[0].value : null;

            if (token && token !== currentToken) {
                if (bot) {
                    try {
                        await bot.stopPolling();
                    } catch (e) {
                        console.log("Stopped previous polling.");
                    }
                }

                currentToken = token;
                bot = new TelegramBot(token, { polling: true });
                console.log("Telegram Bot started with new token!");

                bot.onText(/\/start|\/help/, (msg) => {
                    bot.sendMessage(msg.chat.id, "🤖 <b>Hệ Thống Theo Dõi Vận Đơn</b>\n\n<b>Các lệnh hỗ trợ:</b>\n/add &lt;mã_vận_đơn&gt; - <i>Thêm vận đơn mới</i>\n/track &lt;mã_vận_đơn&gt; - <i>Xem hành trình chi tiết</i>\n/list - <i>Liệt kê các vận đơn của bạn</i>", { parse_mode: 'HTML' });
                });

                bot.onText(/\/list/, async (msg) => {
                    const chatId = msg.chat.id;
                    try {
                        const shipments = await db.query('SELECT * FROM shipments WHERE source_platform = ?', [chatId.toString()]);
                        if (shipments.rows.length === 0) return bot.sendMessage(chatId, "📭 <i>Bạn chưa theo dõi vận đơn nào.</i>", { parse_mode: 'HTML' });

                        let text = "📋 <b>DANH SÁCH VẬN ĐƠN CỦA BẠN</b>\n\n";
                        shipments.rows.forEach(s => {
                            let icon = '📦';
                            if (s.delivery_status === 'delivered') icon = '✅';
                            if (s.delivery_status === 'failed') icon = '❌';
                            if (s.delivery_status === 'delivering') icon = '🚚';

                            text += `${icon} <code>${s.tracking_number}</code> - <b>${s.delivery_status.toUpperCase()}</b> (${s.carrier})\n`;
                        });
                        bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
                    } catch (e) {
                        bot.sendMessage(chatId, `⚠️ <b>Lỗi:</b> ${e.message}`, { parse_mode: 'HTML' });
                    }
                });

                bot.onText(/\/track (.+)/, async (msg, match) => {
                    const chatId = msg.chat.id;
                    const trackingNumber = match[1];

                    try {
                        const shipment = await db.query('SELECT * FROM shipments WHERE tracking_number = ?', [trackingNumber]);
                        if (shipment.rows.length === 0) {
                            return bot.sendMessage(chatId, `❌ <b>Không tìm thấy mã vận đơn:</b> <code>${trackingNumber}</code>`, { parse_mode: 'HTML' });
                        }

                        const s = shipment.rows[0];
                        const events = await db.query('SELECT * FROM tracking_events WHERE tracking_number = ? ORDER BY event_time DESC', [trackingNumber]);

                        let statusEmoji = '📦';
                        if (s.delivery_status === 'delivered') statusEmoji = '✅';
                        if (s.delivery_status === 'failed') statusEmoji = '❌';
                        if (s.delivery_status === 'delivering') statusEmoji = '🚚';

                        let response = `📦 <b>CHI TIẾT VẬN ĐƠN</b>\n`;
                        response += `━━━━━━━━━━━━━━━━━━━━━\n`;
                        response += `🔖 <b>Mã:</b> <code>${trackingNumber}</code>\n`;
                        response += `🏢 <b>Hãng:</b> ${s.carrier ? s.carrier.toUpperCase() : 'Unknown'}\n`;
                        response += `📌 <b>Trạng thái:</b> ${statusEmoji} <b>${s.delivery_status.toUpperCase()}</b>\n`;
                        response += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
                        response += `📍 <b>HÀNH TRÌNH TÓM TẮT:</b>\n`;

                        if (events.rows.length === 0) {
                            response += `<i>Chưa có thông tin cập nhật...</i>`;
                        } else {
                            events.rows.slice(0, 5).forEach((e, idx) => {
                                response += `🔹 <b>${new Date(e.event_time).toLocaleString('vi-VN')}</b>\n`;
                                response += `   📝 ${e.status}\n`;
                                if (e.location) response += `   📍 <i>${e.location}</i>\n`;
                                if (idx < events.rows.slice(0, 5).length - 1) response += `\n`;
                            });
                            if (events.rows.length > 5) {
                                response += `\n<i>...(Còn ${events.rows.length - 5} sự kiện nữa)</i>`;
                            }
                        }

                        bot.sendMessage(chatId, response, { parse_mode: 'HTML' });
                    } catch (err) {
                        bot.sendMessage(chatId, `⚠️ <b>Lỗi:</b> ${err.message}`, { parse_mode: 'HTML' });
                    }
                });

                bot.onText(/\/add (.+)(?: (.+))?/, async (msg, match) => {
                    const chatId = msg.chat.id;
                    const trackingNumber = match[1];
                    const note = match[2] || '';

                    try {
                        await db.run(
                            'INSERT INTO shipments (tracking_number, note, source_platform, delivery_status) VALUES (?, ?, ?, ?)',
                            [trackingNumber, note, chatId.toString(), 'pending']
                        );
                        bot.sendMessage(chatId, `✅ <b>Đã thêm thành công:</b> <code>${trackingNumber}</code>\n<i>Hệ thống sẽ cập nhật thông tin trong giây lát.</i>`, { parse_mode: 'HTML' });
                    } catch (err) {
                        if (err.message.includes('UNIQUE')) {
                            bot.sendMessage(chatId, `⚠️ <b>Vận đơn này đã tồn tại:</b> <code>${trackingNumber}</code>`, { parse_mode: 'HTML' });
                        } else {
                            bot.sendMessage(chatId, `⚠️ <b>Lỗi:</b> ${err.message}`, { parse_mode: 'HTML' });
                        }
                    }
                });
            } else if (!token && bot) {
                await bot.stopPolling();
                bot = null;
                currentToken = null;
                console.log("Telegram Bot stopped (no token).");
            }
        } catch (err) {
            console.error("Telegram bot init err:", err);
        }
    }

    // Call it right away
    initBot();

    // Endpoints
    router.post('/reinit', async (req, res) => {
        await initBot();
        res.json({ success: true, message: 'Bot re-initialized' });
    });

    // Provide a way to send notification manually if needed
    router.post('/notify', async (req, res) => {
        const { chat_id, message } = req.body;
        if (bot && chat_id) {
            bot.sendMessage(chat_id, message, { parse_mode: 'Markdown' });
            res.json({ success: true });
        } else {
            res.status(400).json({ error: 'Bot is offline or no chat_id' });
        }
    });

    return router;
};
