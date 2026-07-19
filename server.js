const mineflayer = require('mineflayer');
const { pathfinder } = require('mineflayer-pathfinder');
const express = require('express');
const { Octokit } = require('@octokit/rest');

// ================= 1. CẤU HÌNH GITHUB CỦA BẠN =================
const GITHUB_TOKEN = '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';
const GH_OWNER = 'hehhhbnxs';
const GH_REPO = 'bot-treo'; // Đổi nếu bạn đặt tên kho lưu trữ khác
const GH_FILE_PATH = 'data.json';
// ==============================================================

const octokit = new Octokit({ auth: GITHUB_TOKEN });
let bot = null;
let botData = { status: "offline", lastJoined: "", currentServer: "", behavior: "" };
let behaviorInterval = null;

// Biến phục vụ Auto-Reconnect
let lastConfig = null;           
let isManualDisconnect = false;  
let reconnectTimeout = null;     

// Hàm đồng bộ lên GitHub
async function saveDataToGitHub(newData) {
    try {
        const fileInfo = await octokit.repos.getContent({ owner: GH_OWNER, repo: GH_REPO, path: GH_FILE_PATH });
        await octokit.repos.createOrUpdateFileContents({
            owner: GH_OWNER, repo: GH_REPO, path: GH_FILE_PATH,
            message: "Cập nhật dữ liệu từ Web UI",
            content: Buffer.from(JSON.stringify(newData, null, 2)).toString('base64'),
            sha: fileInfo.data.sha
        });
    } catch (e) {}
}

// ================= 2. LOGIC BOT MINECRAFT =================
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
        botData.lastJoined = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
        saveDataToGitHub(botData);
        if (reconnectTimeout) clearTimeout(reconnectTimeout); 
    });

    bot.on('spawn', () => {
        behaviorInterval = setInterval(() => {
            if (!bot || !bot.entity) return;
            const player = bot.nearestEntity(entity => entity.type === 'player' && entity.position.distanceTo(bot.entity.position) < 6);

            if (botData.behavior === 'afk_interact') {
                if (player) {
                    bot.lookAt(player.position.offset(0, 1.6, 0));
                    bot.setControlState('sneak', true);
                    setTimeout(() => bot.setControlState('sneak', false), 300);
                    bot.swingArm('right');
                } else if (Math.random() > 0.7) {
                    bot.look(Math.random() * Math.PI * 2, 0, true);
                }
            } 
            else if (botData.behavior === 'afk_survival') {
                if (player) {
                    bot.lookAt(player.position.offset(0, 1.6, 0));
                    bot.setControlState('sneak', true);
                    setTimeout(() => bot.setControlState('sneak', false), 400);
                    const items = bot.inventory.items();
                    if (items.length > 0 && Math.random() > 0.5) bot.tossStack(items[0]).catch(()=>{});
                } else {
                    bot.setControlState('forward', true);
                    bot.setControlState('sprint', true);
                    if (bot.entity.isCollidedHorizontally) {
                        bot.setControlState('jump', true);
                        setTimeout(() => bot.setControlState('jump', false), 500);
                    }
                    setTimeout(() => { 
                        if(bot) { bot.setControlState('forward', false); bot.setControlState('sprint', false); }
                    }, 2000);
                }
            }
        }, 1500);
    });

    // Tự động trả lời Chat
    bot.on('chat', (username, message) => {
        if (!bot || username === bot.username) return;
        if (message.toLowerCase().includes(bot.username.toLowerCase())) {
            const replies = [
                `Chào ${username}, mình đang treo máy nha!`,
                `Mình đang AFK, lát nữa xem chat sau.`,
                `Mình là bot giữ rank thôi ~`,
                `Chủ acc đi ngủ rồi ${username} ơi.`
            ];
            const randomReply = replies[Math.floor(Math.random() * replies.length)];
            setTimeout(() => { if (bot) bot.chat(randomReply); }, Math.floor(Math.random() * 2000) + 1500);
        }
    });

    bot.on('end', () => { 
        bot = null; 
        if (behaviorInterval) clearInterval(behaviorInterval); 
        
        if (isManualDisconnect) {
            botData.status = "offline"; 
            botData.currentServer = "";
            saveDataToGitHub(botData);
        } else {
            botData.status = "Đang chờ kết nối lại (2 phút)..."; 
            saveDataToGitHub(botData);
            
            reconnectTimeout = setTimeout(() => {
                if (!isManualDisconnect && lastConfig) {
                    startBot(lastConfig.ip, lastConfig.botName, lastConfig.version, lastConfig.behaviorStr);
                }
            }, 120000); 
        }
    });
}

// ================= 3. GIAO DIỆN WEB =================
const app = express();
app.get('/', (req, res) => {
    let statusColor = '#e74c3c'; 
    if (botData.status === 'online') statusColor = '#2ecc71'; 
    else if (botData.status.includes('chờ')) statusColor = '#f39c12'; 

    res.send(`
        <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <title>MC Bot Pro</title>
                <style>
                    body { font-family: Arial; text-align: center; padding: 15px; background: #2c3e50; color: white; margin: 0;}
                    .btn { padding: 12px 20px; font-size: 16px; border: none; border-radius: 8px; margin: 5px 0; cursor: pointer; width: 100%; box-sizing: border-box;}
                    .start { background: #27ae60; color: white; font-weight: bold;}
                    .stop { background: #c0392b; color: white; font-weight: bold;}
                    .check { background: #2980b9; color: white; }
                    .card { background: #34495e; padding: 20px; border-radius: 12px; margin-bottom: 15px; box-shadow: 0 4px 6px rgba(0,0,0,0.3);}
                    .input-box { width: 100%; padding: 10px; margin-bottom: 10px; border-radius: 5px; border: none; box-sizing: border-box; font-size: 15px;}
                    .info-box { background: #1a252f; padding: 10px; border-radius: 5px; text-align: left; font-size: 14px; margin-bottom: 10px; min-height: 40px;}
                </style>
            </head>
            <body>
                <div class="card">
                    <h2 style="margin-top: 0;">Trạng Thái Bot</h2>
                    <p>Trạng thái: <b style="color:${statusColor}">${botData.status.toUpperCase()}</b></p>
                    <p>Server: <b>${botData.currentServer || 'Không có'}</b></p>
                    <p>Hành vi: <b>${botData.behavior === 'afk_interact' ? 'AFK + Tương tác' : (botData.behavior === 'afk_survival' ? 'AFK + Sinh tồn' : 'Chưa chạy')}</b></p>
                    <p style="font-size: 12px; color: #95a5a6;">Cập nhật: ${botData.lastJoined || 'Chưa có'}</p>
                    <button class="btn stop" onclick="fetch('/stop').then(()=>setTimeout(()=>location.reload(), 1000))">🛑 TẮT BOT & HUỶ KẾT NỐI LẠI</button>
                </div>

                <div class="card">
                    <h2 style="margin-top: 0;">Cài Đặt Chạy Bot</h2>
                    <input type="text" id="botName" placeholder="Tên Bot (VD: TreoXuyenDem)" class="input-box">
                    
                    <select id="botVersion" class="input-box">
                        <option value="1.16.5">Phiên bản: 1.16.5</option>
                        <option value="1.12.2">Phiên bản: 1.12.2</option>
                        <option value="1.19.4">Phiên bản: 1.19.4</option>
                        <option value="1.20.1">Phiên bản: 1.20.1</option>
                    </select>

                    <select id="botBehavior" class="input-box" style="background: #f1c40f; color: #2c3e50; font-weight: bold;">
                        <option value="afk_interact">Hành vi: Đứng im + Nhìn theo người</option>
                        <option value="afk_survival">Hành vi: Chạy nhảy + Vứt đồ cho người</option>
                    </select>

                    <select id="platform" class="input-box">
                        <option value="java">Loại Server: PC (Java)</option>
                        <option value="bedrock">Loại Server: PE (Bedrock/Geyser)</option>
                    </select>

                    <input type="text" id="serverIp" placeholder="Nhập IP Server (VD: mc.hypixel.net)" class="input-box">
                    
                    <button class="btn check" onclick="checkServer()">🔍 KIỂM TRA SERVER</button>
                    <div id="serverInfo" class="info-box">Thông tin server sẽ hiện ở đây...</div>

                    <button class="btn start" onclick="startBotUI()">🚀 KHỞI ĐỘNG BOT</button>
                </div>

                <script>
                    async function checkServer() {
                        const ip = document.getElementById('serverIp').value.trim();
                        const platform = document.getElementById('platform').value;
                        const infoDiv = document.getElementById('serverInfo');
                        
                        if(!ip) return infoDiv.innerHTML = "⚠️ Vui lòng nhập IP Server!";
                        infoDiv.innerHTML = "⏳ Đang kiểm tra...";

                        const apiUrl = platform === 'bedrock' ? 'https://api.mcsrvstat.us/bedrock/2/' + ip : 'https://api.mcsrvstat.us/2/' + ip;
                        
                        try {
                            const res = await fetch(apiUrl);
                            const data = await res.json();
                            
                            if(data.online) {
                                let players = data.players ? (data.players.list || []) : [];
                                let playerList = players.length > 0 ? players.map(p => p.name || p).join(', ') : 'Ẩn danh sách';
                                infoDiv.innerHTML = \`<span style="color:#2ecc71"><b>🟢 Đang Mở</b></span> | <b>Ping:</b> \${data.debug ? data.debug.ping : '?'}ms<br>
                                <b>Người chơi:</b> \${data.players.online}/\${data.players.max}<br>
                                <span style="color: #bdc3c7; font-size: 12px;">\${playerList}</span>\`;
                            } else {
                                infoDiv.innerHTML = \`<span style="color:#e74c3c"><b>🔴 Server đang tắt</b></span>\`;
                            }
                        } catch(e) { infoDiv.innerHTML = "❌ Lỗi mạng!"; }
                    }

                    function startBotUI() {
                        const ip = document.getElementById('serverIp').value.trim();
                        const name = document.getElementById('botName').value.trim();
                        const version = document.getElementById('botVersion').value;
                        const behavior = document.getElementById('botBehavior').value;
                        
                        if(!ip || !name) return alert("Vui lòng nhập Tên Bot và IP Server!");
                        
                        fetch(\`/start?ip=\${ip}&name=\${name}&version=\${version}&behavior=\${behavior}\`)
                            .then(() => {
                                alert("Lệnh đã được gửi! Chờ trang tải lại...");
                                setTimeout(() => location.reload(), 2000);
                            });
                    }
                </script>
            </body>
        </html>
    `);
});

app.get('/start', (req, res) => { 
    const { ip, name, version, behavior } = req.query;
    if(ip && name && version && behavior) startBot(ip, name, version, behavior);
    res.send('ok'); 
});

app.get('/stop', (req, res) => { 
    isManualDisconnect = true; 
    if (reconnectTimeout) clearTimeout(reconnectTimeout); 
    if (bot) { bot.quit(); bot = null; } 
    else { botData.status = "offline"; botData.currentServer = ""; saveDataToGitHub(botData); }
    res.send('ok'); 
});

app.listen(process.env.PORT || 3000, () => console.log('Web sẵn sàng!'));
