const mineflayer = require('mineflayer');
const { pathfinder } = require('mineflayer-pathfinder');
const express = require('express');
const { Octokit } = require('@octokit/rest');

const GITHUB_TOKEN = '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';
const GH_OWNER = 'hehhhbnxs';
const GH_REPO = 'bot-treo';
const GH_FILE_PATH = 'data.json';

const octokit = new Octokit({ auth: GITHUB_TOKEN });
let bot = null;
let lastConfig = null;
let isManualDisconnect = false;

// Hàm lưu trạng thái
async function updateStatus(status, ip = "", behavior = "") {
    try {
        await octokit.repos.createOrUpdateFileContents({
            owner: GH_OWNER, repo: GH_REPO, path: GH_FILE_PATH,
            message: "Update",
            content: Buffer.from(JSON.stringify({ status, ip, behavior, time: new Date().toLocaleTimeString() }, null, 2)).toString('base64'),
            sha: (await octokit.repos.getContent({ owner: GH_OWNER, repo: GH_REPO, path: GH_FILE_PATH })).data.sha
        });
    } catch (e) {}
}

function startBot(ip, botName, version, behavior) {
    if (bot) return;
    isManualDisconnect = false;
    lastConfig = { ip, botName, version, behavior };

    bot = mineflayer.createBot({ host: ip, username: botName, version: version });
    bot.loadPlugin(pathfinder);

    bot.on('login', () => updateStatus("Online", ip, behavior));
    
    bot.on('spawn', () => {
        setInterval(() => {
            if (!bot) return;
            // Behavior Logic
            if (behavior === 'afk_interact') {
                const player = bot.nearestEntity(e => e.type === 'player' && e.position.distanceTo(bot.entity.position) < 5);
                if (player) { bot.lookAt(player.position.offset(0, 1.6, 0)); bot.swingArm('right'); }
            }
        }, 3000);
    });

    bot.on('end', () => {
        bot = null;
        if (!isManualDisconnect) {
            updateStatus("Reconnect in 2m...");
            setTimeout(() => startBot(lastConfig.ip, lastConfig.botName, lastConfig.version, lastConfig.behavior), 120000);
        } else {
            updateStatus("Offline");
        }
    });
}

const app = express();
app.get('/', (req, res) => {
    res.send(`
    <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <link href="https://fonts.googleapis.com/css2?family=Orbitron&display=swap" rel="stylesheet">
            <style>
                body { background: #050505; color: #00ff41; font-family: 'Orbitron', sans-serif; padding: 10px; }
                .panel { background: #111; border: 2px solid #00ff41; padding: 15px; border-radius: 10px; box-shadow: 0 0 15px #00ff4133; }
                input, select { background: #000; color: #00ff41; border: 1px solid #00ff41; padding: 10px; width: 100%; margin: 5px 0; }
                button { background: #00ff41; color: #000; border: none; padding: 15px; width: 100%; font-weight: bold; cursor: pointer; }
                .status { color: #fff; font-size: 1.2em; text-align: center; margin-bottom: 10px; }
            </style>
        </head>
        <body>
            <div class="panel">
                <div class="status" id="stat">LOADING...</div>
                <input type="text" id="ip" placeholder="Server IP">
                <input type="text" id="name" placeholder="Tên Bot">
                <select id="ver">
                    <option value="1.21.11">1.21.11 (Latest)</option>
                    <option value="1.21.10">1.21.10</option>
                    <option value="1.20.1">1.20.1</option>
                    <option value="1.16.5">1.16.5</option>
                </select>
                <select id="beh">
                    <option value="afk_interact">AFK Interactive</option>
                    <option value="afk_survival">AFK Survival</option>
                </select>
                <button onclick="cmd('/start')">KHỞI ĐỘNG HỆ THỐNG</button>
                <button onclick="cmd('/stop')" style="background:#ff3333; margin-top:10px;">DỪNG TOÀN BỘ</button>
                <div id="srvInfo" style="margin-top:15px; font-size: 0.8em;"></div>
            </div>
            <script>
                async function cmd(path) {
                    const data = {ip:document.getElementById('ip').value, name:document.getElementById('name').value, ver:document.getElementById('ver').value, beh:document.getElementById('beh').value};
                    fetch(path + '?ip='+data.ip+'&name='+data.name+'&version='+data.ver+'&behavior='+data.beh).then(() => location.reload());
                }
                fetch('https://api.mcsrvstat.us/2/'+document.getElementById('ip').value).then(r=>r.json()).then(d => {
                    document.getElementById('srvInfo').innerHTML = d.online ? "🟢 Server Online | Ping: "+d.debug.ping : "🔴 Server Offline";
                });
            </script>
        </body>
    </html>
    `);
});

app.get('/start', (req, res) => { startBot(req.query.ip, req.query.name, req.query.version, req.query.behavior); res.send('ok'); });
app.get('/stop', (req, res) => { isManualDisconnect = true; if(bot) bot.quit(); res.send('ok'); });
app.listen(process.env.PORT || 3000);
