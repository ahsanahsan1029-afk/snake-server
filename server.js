const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

const CANVAS_SIZE = 800;
const GRID_SIZE = 20;

let players = {};
let food = generateFood();

function generateFood() {
  return {
    x: Math.floor(Math.random() * (CANVAS_SIZE / GRID_SIZE)) * GRID_SIZE,
    y: Math.floor(Math.random() * (CANVAS_SIZE / GRID_SIZE)) * GRID_SIZE,
    color: '#ff0055'
  };
}

const COLORS = ['#00ffcc', '#ff00ff', '#ffff00', '#00ff00', '#ff9900'];

io.on('connection', (socket) => {
  socket.on('joinGame', (name) => {
    players[socket.id] = {
      id: socket.id,
      name: name || 'Player',
      x: Math.floor(Math.random() * 30) * GRID_SIZE,
      y: Math.floor(Math.random() * 30) * GRID_SIZE,
      dx: GRID_SIZE,
      dy: 0,
      tail: [],
      score: 0,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      alive: true
    };
    socket.emit('init', { id: socket.id });
  });

  socket.on('direction', (dir) => {
    const p = players[socket.id];
    if (!p || !p.alive) return;
    if (dir === 'UP' && p.dy === 0) { p.dx = 0; p.dy = -GRID_SIZE; }
    if (dir === 'DOWN' && p.dy === 0) { p.dx = 0; p.dy = GRID_SIZE; }
    if (dir === 'LEFT' && p.dx === 0) { p.dx = -GRID_SIZE; p.dy = 0; }
    if (dir === 'RIGHT' && p.dx === 0) { p.dx = GRID_SIZE; p.dy = 0; }
  });

  socket.on('disconnect', () => {
    delete players[socket.id];
  });
});

setInterval(() => {
  for (let id in players) {
    let p = players[id];
    if (!p.alive) continue;

    p.tail.push({ x: p.x, y: p.y });
    while (p.tail.length > p.score + 3) {
      p.tail.shift();
    }

    p.x += p.dx;
    p.y += p.dy;

    // Teleport Physics (Deewar se paar nikalna)
    if (p.x < 0) p.x = CANVAS_SIZE - GRID_SIZE;
    if (p.x >= CANVAS_SIZE) p.x = 0;
    if (p.y < 0) p.y = CANVAS_SIZE - GRID_SIZE;
    if (p.y >= CANVAS_SIZE) p.y = 0;

    // Food Physics
    if (p.x === food.x && p.y === food.y) {
      p.score += 10;
      food = generateFood();
    }

    // Collision Physics
    for (let otherId in players) {
      let other = players[otherId];
      if (!other.alive) continue;
      for (let segment of other.tail) {
        if (p.x === segment.x && p.y === segment.y) {
          p.score = 0;
          p.tail = [];
          p.x = Math.floor(Math.random() * 30) * GRID_SIZE;
          p.y = Math.floor(Math.random() * 30) * GRID_SIZE;
        }
      }
    }
  }

  io.emit('gameState', { players, food });
}, 100);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
