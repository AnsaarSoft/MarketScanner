const express = require('express');
const ws = require('ws');
const dbContext = require('./dbContext');
const prdMsg = require('./productMessages');
const path = require('path');
const dotenvResult = require('dotenv').config({ path: path.join(__dirname, 'EnvironmentVariable.env') });
if (dotenvResult.error) {
    console.warn('⚠️ dotenv: failed to load EnvironmentVariable.env -', dotenvResult.error.message || dotenvResult.error);
} else {
    console.log('✅ dotenv loaded env from EnvironmentVariable.env');
}
// debug-print presence of key SMTP vars (do NOT log secrets in production)
console.log(`SMTP_HOST: ${process.env.SMTP_HOST ? process.env.SMTP_HOST : '<not set>'}`);
console.log(`EMAIL_TO: ${process.env.EMAIL_TO ? process.env.EMAIL_TO : '<not set>'}`);
const nodemailer = require('nodemailer');


const app = express();
const Port = process.env.Port || 3000;
const HostedUrl =  process.env.HostedUrl || "http://localhost";
    

app.get('/', (req, res) => {
    res.send("Screener is running.");
});

app.listen(Port, () => {
    console.log(`🚀 Server running on ${HostedUrl}:${Port}`);
});

const symbol = process.env.Symbol || "btcusdt";
const interval = process.env.Period || "1m";
const binanceWsUrl = `wss://stream.binance.com:9443/ws/${symbol}@kline_${interval}`;

const wss = new ws(binanceWsUrl);

wss.on("message", async (msg) => {
    try {
        const message = JSON.parse(msg);
        //console.log( message);
        const kline = message.k;
        if (!kline) return;
        const candle = {
            bardate: dbContext.formatDate(new Date(kline.t)),
            bartime: new Date(kline.T).toLocaleTimeString("en-GB", { hour12: false }),
            symbol: message.s,
            interval: kline.i,
            open: parseFloat(kline.o),
            close: parseFloat(kline.c),
            high: parseFloat(kline.h),
            low: parseFloat(kline.l),
            volume: parseFloat(kline.v),
            isClosed: kline.x,
        };
        if (candle.isClosed) {
            dbContext.insertCandle(candle);
            dbContext.calculateAndUpdateEMA();
            const hasCrossed = dbContext.CrossOccured();
            if (hasCrossed) {
                const trend = dbContext.direction === 1 ? "bullish" : "bearish";
                const timestamp = `${candle.bardate} ${candle.bartime}`;
                console.log(`[${timestamp}] EMA cross detected: ${trend}.`);
                // send email notification (if configured)
                SendEMail(trend, timestamp, message.s).catch(err => console.error('❗ SendEMail error:', err.message));
            }
            else{
                const trend = dbContext.direction === 1 ? "bullish" : "bearish";
                const timestamp = `${candle.bardate} ${candle.bartime}`;
                console.log(`[${timestamp}] Trend Continues: ${trend}.`);
            }
        }
    } catch (e) {
        console.error("ℹ️ Failed to parse msg", e.message);
    }


});

// ✅ SendEMail: sends an email notification when EMA cross occurs
async function SendEMail(trend, timestamp, symbol) {
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

// continue with websocket events
wss.on("open", () => {
    console.log("✅ Connected.");
});

wss.on("close", () => {
    console.log("❌ Disconnected.");
});

wss.on("error", (err) => {
    console.error("🤦‍♂️ Websocket error: ", err.message);
});
