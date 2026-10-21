const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const ws = new WebSocket(`${protocol}//${window.location.host}`);

let cursors;
let wasdKeys;
let myPlayer;
let otherPlayers = {};
let myId = null;

const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: 'game-container',
    physics: {
        default: 'arcade',
        arcade: { gravity: { y: 0 } }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

const game = new Phaser.Game(config);

function preload() {
    // Ingen eksterne billeder nødvendige endnu
}

function create() {
    const scene = this;

    // Tegn et simpelt gittermønster på gulvet
    const graphics = this.add.graphics();
    graphics.lineStyle(1, 0x333333, 0.8);
    for (let x = 0; x < 800; x += 40) {
        graphics.moveTo(x, 0); graphics.lineTo(x, 600);
    }
    for (let y = 0; y < 600; y += 40) {
        graphics.moveTo(0, y); graphics.lineTo(800, y);
    }
    graphics.strokePath();

    // Lav en midlertidig avatar-tekstur (blå cirkel)
    const avatarGraphics = this.make.graphics({x: 0, y: 0, add: false});
    avatarGraphics.fillStyle(0x3498db, 1);
    avatarGraphics.fillCircle(20, 20, 20);
    avatarGraphics.generateTexture('playerTex', 40, 40);

    cursors = this.input.keyboard.createCursorKeys();
    wasdKeys = this.input.keyboard.addKeys({
        up: Phaser.Input.Keyboard.KeyCodes.W,
        down: Phaser.Input.Keyboard.KeyCodes.S,
        left: Phaser.Input.Keyboard.KeyCodes.A,
        right: Phaser.Input.Keyboard.KeyCodes.D
    });

    // Håndter indkommende netværksbeskeder
    ws.onmessage = function(event) {
        const data = JSON.parse(event.data);

        if (data.type === 'INIT') {
            myId = data.id;
            // Opret dig selv
            myPlayer = scene.physics.add.sprite(data.players[myId].x, data.players[myId].y, 'playerTex');
            myPlayer.setCollideWorldBounds(true);

            // Opret alle andre spillere, der allerede er i rummet
            for (let id in data.players) {
                if (id !== myId) {
                    otherPlayers[id] = scene.add.sprite(data.players[id].x, data.players[id].y, 'playerTex');
                }
            }
        } 
        else if (data.type === 'PLAYER_JOINED') {
            otherPlayers[data.player.id] = scene.add.sprite(data.player.x, data.player.y, 'playerTex');
        } 
        else if (data.type === 'PLAYER_MOVED') {
            if (otherPlayers[data.id]) {
                otherPlayers[data.id].x = data.x;
                otherPlayers[data.id].y = data.y;
            }
        } 
        else if (data.type === 'PLAYER_LEFT') {
            if (otherPlayers[data.id]) {
                otherPlayers[data.id].destroy();
                delete otherPlayers[data.id];
            }
        }
        else if (data.type === 'CHAT_MESSAGE') {
            appendChatMessage(`Bruger (${data.id.slice(-4)}): ${data.text}`);
        }
    };

    // Send chatbeskeder
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = chatInput.value.trim();
        if (text && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'CHAT', text }));
            appendChatMessage(`Dig: ${text}`);
            chatInput.value = '';
        }
    });
}

function update() {
    if (!myPlayer) return;

    myPlayer.setVelocity(0);
    let speed = 200;
    let vx = 0;
    let vy = 0;

    if (cursors.left.isDown || wasdKeys.left.isDown) vx = -speed;
    else if (cursors.right.isDown || wasdKeys.right.isDown) vx = speed;

    if (cursors.up.isDown || wasdKeys.up.isDown) vy = -speed;
    else if (cursors.down.isDown || wasdKeys.down.isDown) vy = speed;

    myPlayer.setVelocityX(vx);
    myPlayer.setVelocityY(vy);
    myPlayer.body.velocity.normalize().scale(speed);

    // Send position til serveren hvis vi bevæger os
    if (vx !== 0 || vy !== 0) {
        ws.send(JSON.stringify({
            type: 'MOVE',
            x: myPlayer.x,
            y: myPlayer.y
        }));
    }
}

function appendChatMessage(message) {
    const chatMessages = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.textContent = message;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}
