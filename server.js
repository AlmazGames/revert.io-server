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
  res.send('Сервер Revert.io активен и управляет едой и битвами!');
});

const WORLD_SIZE = 4000;
const MAX_FOOD = 500;

let players = {};
let foods = [];

// Функция генерации одной сферы еды
function createFoodItem() {
  return {
    id: Math.random().toString(36).substring(2, 9),
    x: Math.random() * (WORLD_SIZE - 40) + 20,
    y: Math.random() * (WORLD_SIZE - 40) + 20,
    radius: Math.random() * 3 + 3,
    color: `hsl(${Math.random() * 360}, 100%, 60%)`
  };
}

// Заполняем мир едой при старте сервера
for (let i = 0; i < MAX_FOOD; i++) {
  foods.push(createFoodItem());
}

io.on('connection', (socket) => {
  console.log('Игрок подключился:', socket.id);

  // Сразу отправляем новичку текущую еду и список игроков в комнате
  socket.emit('init_data', { players, foods });

  // Регистрация игрока при нажатии PLAY
  socket.on('init_player', (data) => {
    players[socket.id] = {
      id: socket.id,
      name: data.name,
      x: data.x,
      y: data.y,
      angle: data.angle,
      score: data.score,
      skin: data.skin
    };
    socket.broadcast.emit('new_player', players[socket.id]);
  });

  // Обновление координат змейки
  socket.on('move', (data) => {
    if (players[socket.id]) {
      players[socket.id].x = data.x;
      players[socket.id].y = data.y;
      players[socket.id].angle = data.angle;
      players[socket.id].score = data.score;
      socket.broadcast.emit('player_moved', players[socket.id]);
    }
  });

  // Логика поедания корма
  socket.on('eat_food', (data) => {
    const idx = foods.findIndex(f => f.id === data.id);
    if (idx !== -1) {
      foods.splice(idx, 1);
      const newFood = createFoodItem();
      foods.push(newFood);
      
      // Говорим всем удалить съеденную и нарисовать новую сферу
      io.emit('food_update', { eatenId: data.id, newFood: newFood });
    }
  });

  // Обработка гибели змейки в бою
  function handleDeath(deadSnake, skin) {
    if (players[socket.id]) {
      let spawnedFoods = [];
      
      // Красивый разлет: превращаем сегменты хвоста в еду с небольшим случайным смещением
      if (deadSnake && deadSnake.length > 0) {
        for (let i = 0; i < deadSnake.length; i += 2) { // берем каждый второй сегмент, чтобы не спамить
          let seg = deadSnake[i];
          let scatterAngle = Math.random() * Math.PI * 2;
          let scatterDist = Math.random() * 35; // радиус разлета массы
          
          let f = {
            id: Math.random().toString(36).substring(2, 9),
            x: Math.max(20, Math.min(WORLD_SIZE - 20, seg.x + Math.cos(scatterAngle) * scatterDist)),
            y: Math.max(20, Math.min(WORLD_SIZE - 20, seg.y + Math.sin(scatterAngle) * scatterDist)),
            radius: Math.random() * 3 + 5, // еда из змеек чуть крупнее обычной
            color: skin ? skin.body[1] : '#66fcf1'
          };
          foods.push(f);
          spawnedFoods.push(f);
        }
        io.emit('foods_spawned', spawnedFoods);
      }

      // Отправляем сигнал для визуального взрыва частиц на экранах других игроков
      io.emit('player_exploded', { x: players[socket.id].x, y: players[socket.id].y, color: skin ? skin.head[1] : '#66fcf1' });

      delete players[socket.id];
      socket.broadcast.emit('player_disconnected', socket.id);
    }
  }

  socket.on('player_died', (data) => {
    handleDeath(data.snake, data.skin);
  });

  socket.on('disconnect', () => {
    console.log('Игрок отключился:', socket.id);
    handleDeath([], null);
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Сервер Revert.io запущен на порту ${PORT}`);
});
