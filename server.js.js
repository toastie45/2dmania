const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Tving serveren til at bruge 'public'-mappen i samme bibliotek
app.use(express.static(path.join(__dirname, 'public')));

const players = {};

wss.on('connection', (ws) => {
    const id = Date.now().toString();
    players[id] = { id, x: 400, y: 300 };

    ws.send(JSON.stringify({ type: 'INIT', id, players }));
    broadcast({ type: 'PLAYER_JOINED', player: players[id] }, ws);

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        if (data.type === 'MOVE') {
            players[id].x = data.x;
            players[id].y = data.y;
            broadcast({ type: 'PLAYER_MOVED', id, x: data.x, y: data.y }, ws);
        }
        if (data.type === 'CHAT') {
            broadcast({ type: 'CHAT_MESSAGE', id, text: data.text });
        }
    });

    ws.on('close', () => {
        delete players[id];
        broadcast({ type: 'PLAYER_LEFT', id });
    });
});

function broadcast(data, ignoreWs = null) {
    wss.clients.forEach(client => {
        if (client !== ignoreWs && client.readyState === 1) {
            client.send(JSON.stringify(data));
        }
    });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server kører på http://localhost:${PORT}`));