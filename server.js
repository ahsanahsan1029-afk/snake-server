const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

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

// Generate Initial Foods
for (let i = 0; i < INITIAL_FOODS; i++) {
  foods.push(createFood());
}

const COLORS = ['#00ffcc', '#ff00ff', '#ffff00', '#00ff00', '#ff3366', '#3399ff', '#ff9900'];

io.on('connection', (socket) => {
  socket.on('joinGame', (name) => {
    const startX = Math.floor(Math.random() * (MAP_SIZE - 400)) + 200;
    const startY = Math.floor(Math.random() * (MAP_SIZE - 400)) + 200;
    const baseColor = COLORS[Math.floor(Math.random() * COLORS.length)];

    players[socket.id] = {
      id: socket.id,
      name: name || 'Snake',
      x: startX,
      y: startY,
      angle: Math.random() * Math.PI * 2,
      speed: 3.5,
      score: 0,
      radius: 12, // Snake base thickness
      length: 25, // Number of body segments
      body: [],
      color: baseColor,
      alive: true
    };

    // Fill initial body segments
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
    delete players[socket.id];
  });
});

// Game Server Loop (60 Updates/sec for Smooth Physics)
setInterval(() => {
  // Maintain Food Count
  while (foods.length < INITIAL_FOODS) {
    foods.push(createFood());
  }

  for (let id in players) {
    let p = players[id];
    if (!p.alive) continue;

    // Smooth Forward Movement in 360-Degree Angle
    p.x += Math.cos(p.angle) * p.speed;
    p.y += Math.sin(p.angle) * p.speed;

    // Keep Snake inside Map Boundary
    p.x = Math.max(p.radius, Math.min(MAP_SIZE - p.radius, p.x));
    p.y = Math.max(p.radius, Math.min(MAP_SIZE - p.radius, p.y));

    // Smooth Segment Tracking (Slither.io Chain Physics)
    p.body.unshift({ x: p.x, y: p.y });
    
    // Dynamic Length & Radius Growth Calculation
    let targetSegments = Math.floor(25 + p.score / 3);
    while (p.body.length > targetSegments) {
      p.body.pop();
    }
    p.radius = 12 + Math.min(25, Math.floor(p.score / 80)); // Snake Motaai (Thickness)

    // Food Collision Detection
    for (let i = foods.length - 1; i >= 0; i--) {
      let f = foods[i];
      let dist = Math.hypot(p.x - f.x, p.y - f.y);
      if (dist < p.radius + f.size) {
        p.score += 10;
        foods.splice(i, 1);
      }
    }

    // Snake vs Snake Collision Physics
    for (let otherId in players) {
      if (otherId === id) continue;
      let other = players[otherId];
      if (!other.alive) continue;

      // Check collision with other snake's body segments
      for (let i = 5; i < other.body.length; i++) {
        let seg = other.body[i];
        let hitDist = Math.hypot(p.x - seg.x, p.y - seg.y);
        if (hitDist < p.radius + other.radius * 0.8) {
          // Snake dies & converts to food
          p.alive = false;
          for (let b = 0; b < p.body.length; b += 2) {
            foods.push({
              id: Math.random().toString(36).substr(2, 9),
              x: p.body[b].x + (Math.random() * 20 - 10),
              y: p.body[b].y + (Math.random() * 20 - 10),
              size: 10,
              color: p.color
            });
          }
          delete players[id];
          break;
        }
      }
    }
  }

  io.emit('gameState', { players, foods });
}, 1000 / 45);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Professional Snake.io Server on port ${PORT}`));
