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
  res.send('Сервер Revert.io активен: Умные боты вышли на охоту!');
});

const WORLD_SIZE = 4000;
const MAX_FOOD = 500;
const BOT_RESPAWN_DELAY = 4000; // Задержка перед возрождением бота (4 секунды)

let players = {};
let foods = [];

// Набор скинов на сервере, чтобы боты выглядели уникально
const SKINS = [
  { head: ["#ffffff", "#ff4500", "#8b0000"], body: ["#ffa07a", "#d2691e", "#3a1200"] },
  { head: ["#ffffff", "#00ff00", "#006400"], body: ["#adff2f", "#32cd32", "#0b2000"] },
  { head: ["#ffffff", "#da70d6", "#4b0082"], body: ["#e6a8f7", "#8a2be2", "#1f0033"] },
  { head: ["#ffffff", "#ffd700", "#b8860b"], body: ["#fff0a5", "#daa520", "#2c1d00"] }
];

// ════════════ БАЗА НИКОВ ДЛЯ БОТОВ ════════════
const BOT_NICKNAMES = [
  'KILLER', 'VIPER', 'COBRA', 'SHADOW', 'GHOST', 'DEMON', 'RAZOR', 'VENOM',
  'NOOB', 'SLIMY', 'WIGGLE', 'NOODLE', 'ZIGZAG', 'SQUISHY', 'WOBBLY',
  'RIDER', 'HUNTER', 'WARRIOR', 'NINJA', 'PHANTOM', 'STEALTH', 'BLADE',
  'DRAGON', 'PHOENIX', 'THUNDER', 'INFERNO', 'FROST', 'NEBULA', 'ORION',
  'DEVOUR', 'FEAST', 'HUNGRY', 'GLUTTON', 'SWALLOW', 'CHOMP', 'BITE'
];

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

// ════════════ ФУНКЦИЯ ДИНАМИЧЕСКОГО СПАВНА БОТА ════════════
function spawnBot(botId) {
  const randomNick = BOT_NICKNAMES[Math.floor(Math.random() * BOT_NICKNAMES.length)];
  const randomSkin = SKINS[Math.floor(Math.random() * SKINS.length)];
  
  const startX = Math.random() * (WORLD_SIZE - 600) + 300;
  const startY = Math.random() * (WORLD_SIZE - 600) + 300;

  players[botId] = {
    id: botId,
    isBot: true,
    name: `${randomNick} [Bot]`,
    x: startX,
    y: startY,
    angle: Math.random() * Math.PI * 2,
    score: 35,
    skin: randomSkin,
    snake: [] 
  };

  // Генерируем хвост для бота
  for (let j = 0; j < players[botId].score; j++) {
    players[botId].snake.push({ x: startX, y: startY });
  }

  // Оповещаем всех игроков
  io.emit('new_player', players[botId]);
  console.log(`[BOT] Возродился: ${players[botId].name} (${botId})`);
}

// ИНИЦИАЛИЗАЦИЯ 4 БОТОВ ПРИ СТАРТЕ СЕРВЕРА
for (let i = 0; i < 4; i++) {
  spawnBot(`bot_${i}`);
}

// Функция обработки смерти игрока или бота
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

    if (players[deadId].isBot) {
      console.log(`[BOT] ${players[deadId].name} погиб. Перерождение через 4 сек...`);
      delete players[deadId];
      io.emit('player_disconnected', deadId); 
      
      setTimeout(() => {
        spawnBot(deadId);
      }, BOT_RESPAWN_DELAY);
    } else {
      delete players[deadId];
      io.emit('player_disconnected', deadId);
    }
  }
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
      snake: [] 
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
          current.x = prev.x - (dx / dist) * 9; 
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

  socket.on('player_died', (data) => {
    handleDeath(socket.id, data.snake, data.skin);
  });

  socket.on('disconnect', () => {
    if (players[socket.id]) {
      handleDeath(socket.id, [], null);
    }
  });
});

// СЕРВЕРНЫЙ ИГРОВОЙ ЦИКЛ ДЛЯ ВЫЧИСЛЕНИЯ УМНЫХ БОТОВ
setInterval(() => {
  for (let id in players) {
    if (!players[id].isBot) continue;
    let bot = players[id];

    let danger = false;
    let lookAheadDist = 65; 
    let checkX = bot.x + Math.cos(bot.angle) * lookAheadDist;
    let checkY = bot.y + Math.sin(bot.angle) * lookAheadDist;

    if (checkX < 120 || checkX > WORLD_SIZE - 120 || checkY < 120 || checkY > WORLD_SIZE - 120) {
      danger = true;
    }

    if (!danger) {
      for (let pId in players) {
        let p = players[pId];
        if (!p.snake || p.snake.length === 0) continue;

        let startIdx = (pId === id) ? 5 : 0;

        for (let i = startIdx; i < p.snake.length; i++) {
          let seg = p.snake[i];
          let dx = checkX - seg.x;
          let dy = checkY - seg.y;
          if (Math.sqrt(dx * dx + dy * dy) < 28) { 
            danger = true;
            break;
          }
        }
        if (danger) break;
      }
    }

    if (danger) {
      bot.angle += 0.25;
    } else {
      if (foods.length > 0) {
        let nearestFood = null;
        let minDist = Infinity;

        let searchLimit = Math.min(foods.length, 100);
        for (let i = 0; i < searchLimit; i++) {
          let f = foods[i];
          let dx = f.x - bot.x;
          let dy = f.y - bot.y;
          let dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < minDist) {
            minDist = dist;
            nearestFood = f;
          }
        }

        if (nearestFood) {
          let targetAngle = Math.atan2(nearestFood.y - bot.y, nearestFood.x - bot.x);
          let angleDiff = targetAngle - bot.angle;

          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

          let maxTurn = 0.06;
          if (angleDiff > maxTurn) angleDiff = maxTurn;
          if (angleDiff < -maxTurn) angleDiff = -maxTurn;
          bot.angle += angleDiff;
        }
      }
    }

    let speed = 3.6; 
    bot.x += Math.cos(bot.angle) * speed;
    bot.y += Math.sin(bot.angle) * speed;

    if (!bot.snake) bot.snake = [];
    if (bot.snake.length > 0) {
      bot.snake[0] = { x: bot.x, y: bot.y };
      for (let i = bot.snake.length - 1; i > 0; i--) {
        let current = bot.snake[i];
        let prev = bot.snake[i - 1];
        if (current && prev) {
          let dx = prev.x - current.x;
          let dy = prev.y - current.y;
          let dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0) {
            current.x = prev.x - (dx / dist) * 9;
            current.y = prev.y - (dy / dist) * 9;
          }
        }
      }
    }

    for (let i = foods.length - 1; i >= 0; i--) {
      let f = foods[i];
      let dx = bot.x - f.x;
      let dy = bot.y - f.y;
      if (Math.sqrt(dx * dx + dy * dy) < 14 + f.radius) {
        foods.splice(i, 1);
        bot.score++;
        if (bot.snake && bot.snake.length > 0) {
          bot.snake.push({ x: bot.snake[bot.snake.length - 1].x, y: bot.snake[bot.snake.length - 1].y });
        }
        
        let newFood = createFoodItem();
        foods.push(newFood);
        io.emit('food_update', { eatenId: f.id, newFood: newFood });
      }
    }

    let botDied = false;
    for (let pId in players) {
      if (pId === id) continue;
      let p = players[pId];
      if (!p.snake) continue;

      for (let i = 0; i < p.snake.length; i++) {
        let seg = p.snake[i];
        let dx = bot.x - seg.x;
        let dy = bot.y - seg.y;
        if (Math.sqrt(dx * dx + dy * dy) < 22) { 
          botDied = true;
          break;
        }
      }
      if (botDied) break;
    }

    if (botDied) {
      handleDeath(id, bot.snake, bot.skin);
    } else {
      io.emit('player_moved', {
        id: bot.id,
        name: bot.name,
        x: bot.x,
        y: bot.y,
        angle: bot.angle,
        score: bot.score,
        skin: bot.skin
      });
    }
  }
}, 40); 

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Сервер Revert.io запущен на порту ${PORT}`);
});
