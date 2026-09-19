const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Complete CORS setup for mobile and web browsers
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  transports: ['websocket', 'polling']
});

const MAP_SIZE = 3000;
const INITIAL_FOODS = 250;

let players = {};
let foods = [];

function createFood() {
  return {
    id: Math.random().toString(36).substr(2, 9),
    x: Math.floor(Math.random() * (MAP_SIZE - 100)) + 50,
    y: Math.floor(Math.random() * (MAP_SIZE - 100)) + 50,
    size: Math.floor(Math.random() * 6) + 6,
    color: `hsl(${Math.floor(Math.random() * 360)}, 100%, 60%)`
  };
}

for (let i = 0; i < INITIAL_FOODS; i++) {
  foods.push(createFood());
}

const COLORS = ['#00ffcc', '#ff00ff', '#ffff00', '#00ff00', '#ff3366', '#3399ff', '#ff9900'];

io.on('connection', (socket) => {
  console.log('Player Connected:', socket.id);

  socket.on('joinGame', (name) => {
    const startX = Math.floor(Math.random() * (MAP_SIZE - 400)) + 200;
    const startY = Math.floor(Math.random() * (MAP_SIZE - 400)) + 200;

    players[socket.id] = {
      id: socket.id,
      name: name || 'Snake',
      x: startX,
      y: startY,
      angle: Math.random() * Math.PI * 2,
      speed: 3.5,
      score: 0,
      radius: 12,
      body: [],
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      alive: true
    };

    for (let i = 0; i < 25; i++) {
      players[socket.id].body.push({ x: startX - i * 5, y: startY });
    }

    socket.emit('init', { id: socket.id, mapSize: MAP_SIZE });
  });

  socket.on('inputAngle', (angle) => {
    if (players[socket.id] && players[socket.id].alive) {
      players[socket.id].angle = angle;
    }
  });

  socket.on('disconnect', () => {
    console.log('Player Disconnected:', socket.id);
    delete players[socket.id];
  });
});

setInterval(() => {
  while (foods.length < INITIAL_FOODS) {
    foods.push(createFood());
  }

  for (let id in players) {
    let p = players[id];
    if (!p.alive) continue;

    p.x += Math.cos(p.angle) * p.speed;
    p.y += Math.sin(p.angle) * p.speed;

    p.x = Math.max(p.radius, Math.min(MAP_SIZE - p.radius, p.x));
    p.y = Math.max(p.radius, Math.min(MAP_SIZE - p.radius, p.y));

    p.body.unshift({ x: p.x, y: p.y });
    let targetSegments = Math.floor(25 + p.score / 3);
    while (p.body.length > targetSegments) {
      p.body.pop();
    }
    p.radius = 12 + Math.min(25, Math.floor(p.score / 80));

    for (let i = foods.length - 1; i >= 0; i--) {
      let f = foods[i];
      if (Math.hypot(p.x - f.x, p.y - f.y) < p.radius + f.size) {
        p.score += 10;
        foods.splice(i, 1);
      }
    }
  }

  io.emit('gameState', { players, foods });
}, 1000 / 45);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
