const nodemailer = require('nodemailer');
const https = require('https');

// ✅ SendEMail: sends an email notification when EMA cross occurs                                                                                                                      
async function SendEmail(trend, timestamp, symbol) {
    const to = process.env.EMAIL_TO;
    const from = process.env.EMAIL_FROM || process.env.SMTP_USER;
    if (!to) {
        console.warn('⚠️ EMAIL_TO not set. Skipping email send.');
        return;
    }
    if (!process.env.SMTP_HOST) {
        console.warn('⚠️ SMTP configuration missing (SMTP_HOST). Skipping email send.');
        return;
    }
    try {
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587', 10),
            secure: (process.env.SMTP_SECURE === 'true'),
            auth: process.env.SMTP_USER ? {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            } : undefined
        });

        const subject = `EMA cross detected: ${trend} (${symbol})`;
        const text = `EMA cross detected for ${symbol}.\nTrend: ${trend}\nTime: ${timestamp}`;
        const html = `<p>EMA cross detected for <strong>${symbol}</strong>.</p><p>Trend: <strong>${trend}</strong></p><p>Time: ${timestamp}</p>`;

        const info = await transporter.sendMail({ from, to, subject, text, html });
        console.log('📧 Email sent:', info.messageId || info.response);
    } catch (err) {
        console.error('❗ Failed to send email:', err.message || err);
    }
}
        
  // ✅ SendTelegram: sends a message via Telegram bot when EMA cross occurs
function SendTelegram(trend, timestamp, symbol) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.warn('⚠️ TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set. Skipping Telegram send.');
    return;
  }

  const text = `EMA cross detected for ${symbol}.\nTrend: ${trend}\nTime: ${timestamp}`;
  const payload = JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' });

  const options = {
    hostname: 'api.telegram.org',
    path: `/bot${token}/sendMessage`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  const req = https.request(options, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      try {
        const json = JSON.parse(body);
        if (json && json.ok) {
          console.log('💬 Telegram sent:', json.result?.message_id);
        } else {
          console.error('❗ Telegram API error:', json && json.description ? json.description : body);
        }
      } catch (e) {
        console.error('❗ Failed parsing Telegram response:', e.message);
      }
    });
  });

  req.on('error', (err) => {
    console.error('❗ Failed to send Telegram message:', err.message);
  });

  req.write(payload);
  req.end();
}

  module.exports = { SendEmail, SendTelegram };  