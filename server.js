// --- 1. 引入套件 (Import) ---
const express = require('express');
const sqlite3 = require('sqlite3').verbose();

// [!新增!] 'path' 是 Node.js 內建的套件，用來處理檔案路徑
const path = require('path');

// --- 2. 建立伺服器和資料庫 ---
const app = express();
const port = 3000; // 我們的後端伺服器將跑在 3000 埠

// [!新增!] 告訴 Express 我們要用 JSON 來溝通
app.use(express.json());

// [!新增!] 告訴 Express 靜態檔案 (html, css, js) 放在哪裡
// '.' 代表「目前資料夾」，也就是 TetrisGame/
app.use(express.static('.'));

// --- 3. 連接資料庫 ---
// 這會在你的資料夾建立一個叫 'scores.db' 的檔案
const db = new sqlite3.Database('./scores.db', sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) {
        console.error("資料庫連線失敗:", err.message);
    } else {
        console.log("成功連線到 'scores.db' 資料庫。");

        // [!新增!] 伺服器一啟動，就建立「排行榜」表格 (如果它還不存在)
        db.run(`CREATE TABLE IF NOT EXISTS highscores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            score INTEGER NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) {
                console.error("建立表格失敗:", err.message);
            } else {
                console.log("'highscores' 表格已準備就緒。");
            }
        });
    }
});

// --- 4. [!核心!] 建立 API 路由 (Routes) ---

/**
 * API 1: 讀取排行榜 (GET)
 * 網址: /api/scores
 */
app.get('/api/scores', (req, res) => {
    // 從資料庫抓取分數最高的前 10 名
    const sql = `SELECT name, score FROM highscores ORDER BY score DESC LIMIT 10`;

    db.all(sql, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        // 成功 -> 回傳 JSON 格式的排行榜
        res.json({
            message: 'success',
            data: rows
        });
    });
});

/**
 * API 2: 上傳新分數 (POST)
 * 網址: /api/scores
 */
app.post('/api/scores', (req, res) => {
    const { name, score } = req.body; // 讀取從前端傳來的 JSON

    if (!name || score === undefined) {
        return res.status(400).json({ error: "請提供 'name' 和 'score'" });
    }

    const sql = `INSERT INTO highscores (name, score) VALUES (?, ?)`;

    db.run(sql, [name, score], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        // 成功 -> 回傳剛剛新增的這筆資料 ID
        res.json({
            message: 'success',
            id: this.lastID
        });
    });
});

// --- 5. 啟動伺服器 ---
app.listen(port, () => {
    console.log(`================================================`);
    console.log(`🚀 你的「全端」伺服器已經啟動了！`);
    console.log(`🎮 請在瀏覽器打開: http://localhost:${port}`);
    console.log(`================================================`);
});
