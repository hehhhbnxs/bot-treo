const mineflayer = require('mineflayer');
const { pathfinder } = require('mineflayer-pathfinder');
const express = require('express');
const { Octokit } = require('@octokit/rest');

// ================= CẤU HÌNH CỦA BẠN =================
const GITHUB_TOKEN = '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';
const GH_OWNER = 'hehhhbnxs';
const GH_REPO = 'bot-treo';
const GH_FILE_PATH = 'data.json';
// ===================================================

const octokit = new Octokit({ auth: GITHUB_TOKEN });
let bot = null;
let botData = { status: "offline", lastJoined: "", currentServer: "", behavior: "" };
let behaviorInterval = null;
let lastConfig = null;
let isManualDisconnect = false;
let reconnectTimeout = null;

async function saveDataToGitHub(newData) {
    try {
        const fileInfo = await octokit.repos.getContent({ owner: GH_OWNER, repo: GH_REPO, path: GH_FILE_PATH });
        await octokit.repos.createOrUpdateFileContents({
            owner: GH_OWNER, repo: GH_REPO, path: GH_FILE_PATH,
            message: "Update",
            content: Buffer.from(JSON.stringify(newData, null, 2)).toString('base64'),
            sha: fileInfo.data.sha
        });
    } catch (e) {}
}

function startBot(ip, botName, version, behaviorStr) {
    if (bot) return;
    lastConfig = { ip, botName, version, behaviorStr };
    isManualDisconnect = false;

    bot = mineflayer.createBot({ host: ip, username: botName, version: version });
    bot.loadPlugin(pathfinder);

    bot.on('login', () => {
        botData.status = "online";
        botData.currentServer = ip;
        botData.behavior = behaviorStr;
        botData.lastJoined = new Date().toLocaleString();
        saveDataToGitHub(botData);
        if (reconnectTimeout) clearTimeout(reconnectTimeout);
    });

    bot.on('spawn', () => {
        behaviorInterval = setInterval(() => {
            if (!bot || !bot.entity) return;
            const player = bot.nearestEntity(e => e.type === 'player' && e.position.distanceTo(bot.entity.position) < 6);
            if (botData.behavior === 'afk_interact' && player) {
                bot.lookAt(player.position.offset(0, 1.6, 0));
                bot.swingArm('right');
            } else if (Math.random() > 0.8) bot.look(Math.random() * 6, 0, true);
        }, 2000);
    });

    bot.on('chat', (username, message) => {
        if (username !== bot.username && message.toLowerCase().includes(bot.username.toLowerCase())) {
            setTimeout(() => bot.chat("Mình đang treo máy nha!"), 1500);
        }
    });

    bot.on('end', () => {
        bot = null;
        if (!isManualDisconnect) {
            botData.status = "Đang kết nối lại...";
            saveDataToGitHub(botData);
            reconnectTimeout = setTimeout(() => startBot(lastConfig.ip, lastConfig.botName, lastConfig.version, lastConfig.behaviorStr), 60000);
        }
    });
}

const app = express();
app.get('/', (req, res) => {
    res.send(`
        <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <style>
                    body { background: #0f172a; color: #f8fafc; font-family: 'Segoe UI', sans-serif; padding: 20px; }
                    .card { background: #1e293b; padding: 20px; border-radius: 15px; border: 1px solid #334155; }
                    .btn { width: 100%; padding: 15px; border: none; border-radius: 10px; font-weight: bold; cursor: pointer; margin-top: 10px; }
                    .start { background: #10b981; color: white; }
                    .stop { background: #ef4444; color: white; }
                    select, input { width: 100%; padding: 12px; margin: 5px 0; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: white; }
                </style>
            </head>
            <body>
                <div class="card">
                    <h2>🎮 MC Bot Control</h2>
                    <p>Trạng thái: <b>${botData.status}</b></p>
                    <button class="btn stop" onclick="fetch('/stop').then(()=>location.reload())">🛑 TẮT BOT</button>
                </div>
                <div class="card" style="margin-top: 20px;">
                    <input type="text" id="botName" placeholder="Tên Bot">
                    <select id="botVersion">
                        <option value="1.21.11">1.21.11 (Mới nhất)</option>
                        <option value="1.21.10">1.21.10</option>
                        <option value="1.20.1">1.20.1</option>
                        <option value="1.19.4">1.19.4</option>
                        <option value="1.16.5">1.16.5</option>
                    </select>
                    <select id="botBehavior">
                        <option value="afk_interact">Tương tác người chơi</option>
                        <option value="afk_survival">Sinh tồn cơ bản</option>
                    </select>
                    <input type="text" id="serverIp" placeholder="Nhập IP Server...">
                    <button class="btn start" onclick="startBot()">🚀 KHỞI ĐỘNG</button>
                </div>
                <script>
                    function startBot() {
                        const ip = document.getElementById('serverIp').value;
                        const name = document.getElementById('botName').value;
                        const ver = document.getElementById('botVersion').value;
                        const beh = document.getElementById('botBehavior').value;
                        fetch('/start?ip='+ip+'&name='+name+'&version='+ver+'&behavior='+beh).then(()=>location.reload());
                    }
                </script>
            </body>
        </html>
    `);
});

app.get('/start', (req, res) => { startBot(req.query.ip, req.query.name, req.query.version, req.query.behavior); res.send('ok'); });
app.get('/stop', (req, res) => { isManualDisconnect = true; if(bot) bot.quit(); res.send('ok'); });
app.listen(process.env.PORT || 3000);
