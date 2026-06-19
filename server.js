const express = require('express');
const app = express();
const http = require('http').createServer(app);

const io = require('socket.io')(http, {
  cors: {
    origin: "https://almazgames.github.io",
    methods: ["GET", "POST"],
    credentials: true
  },
  allowEIO3: true
});

app.get('/', (req, res) => {
  res.send('Сервер Revert.io активен: Чистый мультиплеер.');
});

const WORLD_SIZE = 4000;
const MAX_FOOD = 500;

let players = {};
let foods = [];

function createFoodItem() {
  return {
    id: Math.random().toString(36).substring(2, 9),
    x: Math.random() * (WORLD_SIZE - 40) + 20,
    y: Math.random() * (WORLD_SIZE - 40) + 20,
    radius: Math.random() * 3 + 3,
    color: `hsl(${Math.random() * 360}, 100%, 60%)`
  };
}

for (let i = 0; i < MAX_FOOD; i++) {
  foods.push(createFoodItem());
}

// ФУНКЦИЯ ВЫПАДЕНИЯ ЕДЫ (ВОЗВРАЩЕНА!)
function dropFoodOnDeath(snake, skin) {
  let spawnedFoods = [];
  if (snake && snake.length > 0) {
    for (let i = 0; i < snake.length; i += 2) {
      let seg = snake[i];
      let scatterAngle = Math.random() * Math.PI * 2;
      let scatterDist = Math.random() * 35;
      
      let f = {
        id: Math.random().toString(36).substring(2, 9),
        x: Math.max(20, Math.min(WORLD_SIZE - 20, seg.x + Math.cos(scatterAngle) * scatterDist)),
        y: Math.max(20, Math.min(WORLD_SIZE - 20, seg.y + Math.sin(scatterAngle) * scatterDist)),
        radius: Math.random() * 3 + 5,
        color: skin ? skin.body[1] : '#66fcf1'
      };
      foods.push(f);
      spawnedFoods.push(f);
    }
  }
  return spawnedFoods;
}

io.on('connection', (socket) => {
  console.log('Игрок подключился:', socket.id);
  socket.emit('init_data', { players, foods });

  socket.on('init_player', (data) => {
    players[socket.id] = {
      id: socket.id,
      isBot: false,
      name: data.name,
      x: data.x,
      y: data.y,
      angle: data.angle,
      score: data.score,
      skin: data.skin,
      snake: data.snake || []
    };
    socket.broadcast.emit('new_player', players[socket.id]);
  });

  socket.on('move', (data) => {
    if (players[socket.id]) {
      let p = players[socket.id];
      p.x = data.x;
      p.y = data.y;
      p.angle = data.angle;
      p.score = data.score;
      p.snake = data.snake;
      socket.broadcast.emit('player_moved', players[socket.id]);
    }
  });

  socket.on('eat_food', (data) => {
    const idx = foods.findIndex(f => f.id === data.id);
    if (idx !== -1) {
      foods.splice(idx, 1);
      const newFood = createFoodItem();
      foods.push(newFood);
      io.emit('food_update', { eatenId: data.id, newFood: newFood });
    }
  });

  socket.on('player_died', (data) => {
    if (players[socket.id]) {
      // 1. Высыпаем еду из погибшего игрока
      const droppedFoods = dropFoodOnDeath(data.snake, data.skin);
      io.emit('foods_spawned', droppedFoods); // Отправляем еду всем
      
      // 2. Отправляем эффект взрыва
      io.emit('player_exploded', { x: players[socket.id].x, y: players[socket.id].y, color: data.skin ? data.skin.head[1] : '#66fcf1' });
      
      // 3. Удаляем игрока
      delete players[socket.id];
      socket.broadcast.emit('player_disconnected', socket.id);
    }
  });

  socket.on('disconnect', () => {
    if (players[socket.id]) {
      delete players[socket.id];
      socket.broadcast.emit('player_disconnected', socket.id);
    }
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Сервер запущен. Еда при смерти работает!`);
});
