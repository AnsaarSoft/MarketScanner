const express = require('express');
const ws = require('ws');
const dbContext = require('./dbContext');
const prdMsg = require('./productMessages');
const path = require('path');
const nodemailer = require('nodemailer');
const dotenvResult = require('dotenv').config({ path: path.join(__dirname, 'EnvironmentVariable.env') });


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
//const binanceWsUrl = `wss://stream.binance.us:9443/ws/${symbol}@kline_${interval}`;

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
            if (candle.isClosed) {
                const trend = dbContext.direction === 1 ? "bullish" : "bearish";
                const timestamp = `${candle.bardate} ${candle.bartime}`;
                console.log(`[${timestamp}] EMA cross detected: ${trend}.`);
                // send email notification (if configured)
                const currentPrice = parseFloat(candle.close.toFixed(2));
                const entry = parseFloat(candle.close.toFixed(2));
                const takeProfit = parseFloat((candle.close + (candle.close * 0.0015)).toFixed(2));
                const stopLoss = parseFloat((candle.close - (candle.close * 0.0015)).toFixed(2));
                await prdMsg.SendEmail(trend, timestamp, message.s, currentPrice, entry, takeProfit, stopLoss).catch(err => console.error('❗ SendEmail error:', err.message));
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
