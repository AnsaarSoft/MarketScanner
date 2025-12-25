//import the package
const database = require("better-sqlite3");
const { EMA } = require("technicalindicators");
//create database or open.
const db = new database("./database/crypto.db");
let direction = 0;
let crossed = false;
//create table if not exist.
db.prepare(
    `CREATE TABLE IF NOT EXISTS btcusdt1m(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bardate TEXT,
    bartime TEXT,
    open REAL,
    high REAL,
    low REAL,
    close REAL,
    volume REAL,
    ema20 REAL,
    ema50 REAL,
    ema200 REAL,
    crossover BOOLEAN NOT NULL DEFAULT 0,
    direction BOOLEAN NOT NULL DEFAULT 0
)
`
).run();

// ✅ Function to insert candle
function insertCandle(candle) {
    try {
        const stmt = db.prepare(`
    INSERT INTO btcusdt1m (bardate, bartime, open, high, low, close, volume, ema20, ema50, ema200, crossover, direction)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

        stmt.run(
            candle.bardate,
            candle.bartime,
            candle.open,
            candle.high,
            candle.low,
            candle.close,
            candle.volume,
            null,
            null,
            null,
            0,
            0
        );

        console.log(`💾 Saved Candle at ${candle.bartime}`);
    } catch (err) {
        console.log("Error in insert: ", err.message);
    }

}

// ✅ Get last N candles
function getLastCandles(limit) {
    return db.prepare("SELECT * FROM btcusdt1m ORDER BY id DESC LIMIT ?").all(limit).reverse();
}

// ✅ Calculate EMA20 EMA50 & EMA200 (if enough candles)
function calculateAndUpdateEMA() {
    try {
        const last200 = getLastCandles(200);
        if (last200.length < 20) {
            console.log("⚠️ Not enough candles for EMA20");
            return;
        }
        if (last200.length < 50) {
            console.log("⚠️ Not enough candles for EMA50");
            return;
        }
        if (last200.length < 200) {
            console.log("⚠️ Not enough candles for EMA200");
            return;
        }

        const closes = last200.map(c => c.close);

        let ema20 = null;
        let ema50 = null;
        let ema200 = null;

        if (last200.length >= 20) {
            ema20 = EMA.calculate({ period: 20, values: closes }).slice(-1)[0];
        }
        if (last200.length >= 50) {
            ema50 = EMA.calculate({ period: 50, values: closes }).slice(-1)[0];
        }
        if (last200.length >= 200) {
            ema200 = EMA.calculate({ period: 200, values: closes }).slice(-1)[0];
        }

        let crossover = 0;
        let direction = 0;

        if (ema20 != null && ema50 != null && ema200 != null) {
            if (ema20 > ema50 && ema50 > ema200) {
                direction = 1; // bullish
            } else if (ema20 < ema50 && ema50 < ema200) {
                direction = -1; // bearish
            } else {
                direction = 0;
            }
        }

        if (last200.length >= 2) {
            const last = last200[last200.length - 2];
            if (last.ema20 != null && last.ema50 != null && ema20 != null && ema50 != null) {
                if (last.ema20 <= last.ema50 && ema20 > ema50) {
                    crossover = 1;
                } else if (last.ema20 >= last.ema50 && ema20 < ema50) {
                    crossover = 1;
                } else {
                    crossover = 0;
                }
            }
        }

        const latest = last200[last200.length - 1];
        const ema20Formatted = parseFloat(ema20).toFixed(2);
        const ema50Formatted = parseFloat(ema50).toFixed(2);
        const ema200Formatted = parseFloat(ema200).toFixed(2);
        db.prepare(`UPDATE btcusdt1m SET ema20 = ?,ema50 = ?, ema200 = ?, crossover = ?, direction = ? WHERE id = ?`)
            .run(ema20Formatted, ema50Formatted, ema200Formatted, crossover, direction, latest.id);

        console.log(`📊 Updated EMA → Candle ID ${latest.id} | EMA20: ${ema20} | EMA50: ${ema50} | EMA200: ${ema200}`);
    }
    catch (err) {
        console.log("Error in calculateAndUpdateEMA: ", err.message);
    }

}

function formatDate(date) {
    try {
        const day = date.getDate();
        const monthNames = [
            "Jan", "Feb", "Mar", "Apr", "May", "Jun",
            "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"
        ];
        const month = monthNames[date.getMonth()];
        const year = date.getFullYear();

        return `${day}-${month}-${year}`;
    }
    catch (err) {
        console.log("Error in formatDate: ", err.message);
    }
}

function CrossOccured() {
    try {
        const lastCandles = getLastCandles(2);
        crossed = false;
        direction = 0;
        if (lastCandles.length < 2) {
            return false;
        }

        const previousCandle = lastCandles[0];
        const latestCandle = lastCandles[1];

        if (latestCandle.ema20 != null && latestCandle.ema50 != null) {
            direction = latestCandle.ema20 > latestCandle.ema50 ? 1 : 0;
        }

        if (previousCandle.crossover == null || latestCandle.crossover == null) {
            return false;
        }

        crossed = previousCandle.crossover !== latestCandle.crossover;
        return crossed;
    }
    catch (err) {
        console.log("Error in CrossOccured: ", err.message);
    }

    crossed = false;
    direction = 0;
    return false;
}

module.exports = {
    insertCandle,
    calculateAndUpdateEMA,
    formatDate,
    CrossOccured,
    get direction() {
        return direction;
    },
    get crossed() {
        return crossed;
    }
};
