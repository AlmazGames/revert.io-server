const express = require('express');
const app = express();
const http = require('http').createServer(app);

// Настраиваем CORS для твоего GitHub Pages
const io = require('socket.io')(http, {
  cors: {
    origin: "https://almazgames.github.io", // Твой фронтенд
    methods: ["GET", "POST"],
    credentials: true
  },
  allowEIO3: true
});

app.get('/', (req, res) => {
  res.send('Сервер Revert.io активен: Только реальные игроки, только хардкор!');
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

// Заполняем мир едой
for (let i = 0; i < MAX_FOOD; i++) {
  foods.push(createFoodItem());
}

io.on('connection', (socket) => {
  console.log('Игрок подключился:', socket.id);

  // Отправляем игроку текущую карту при подключении
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
      snake: data.snake || [] // Получаем хвост сразу от клиента
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
      
      // Синхронизируем хвост живого игрока на сервере
      if (!p.snake) p.snake = [];
      p.snake[0] = { x: p.x, y: p.y };
      while (p.snake.length < p.score) p.snake.push({ x: p.x, y: p.y });
      while (p.snake.length > p.score) p.snake.pop();
      
      for (let i = 1; i < p.snake.length; i++) {
        let current = p.snake[i];
        let prev = p.snake[i - 1];
        let dx = prev.x - current.x;
        let dy = prev.y - current.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0) {
          current.x = prev.x - (dx / dist) * 9; // targetDist = 9
          current.y = prev.y - (dy / dist) * 9;
        }
      }

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

  function handleDeath(deadId, deadSnake, skin) {
    if (players[deadId]) {
      let spawnedFoods = [];
      if (deadSnake && deadSnake.length > 0) {
        for (let i = 0; i < deadSnake.length; i += 2) {
          let seg = deadSnake[i];
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
        io.emit('foods_spawned', spawnedFoods);
      }

      io.emit('player_exploded', { x: players[deadId].x, y: players[deadId].y, color: skin ? skin.head[1] : '#66fcf1' });

      // Так как ботов нет, просто удаляем игрока из базы комнаты
      delete players[deadId];
      socket.broadcast.emit('player_disconnected', deadId);
    }
  }

  socket.on('player_died', (data) => {
    handleDeath(socket.id, data.snake, data.skin);
  });

  socket.on('disconnect', () => {
    if (players[socket.id]) {
      handleDeath(socket.id, [], null);
    }
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Сервер Revert.io запущен на порту ${PORT}`);
});
