const express = require('express');
const app = express();
const http = require('http').createServer(app);

const io = require('socket.io')(http, {
  cors: {
    origin: "https://almazgames.github.io", // Замените на свой URL GitHub Pages
    methods: ["GET", "POST"],
    credentials: true
  },
  allowEIO3: true
});

app.get('/', (req, res) => {
  res.send('Сервер Revert.io активен: Логика на сервере. ИИ бота оптимизирован (10 FPS)!');
});

const WORLD_SIZE = 4000;
const MAX_FOOD = 500;
const TARGET_DIST = 9;
const MAX_SEGMENT_RADIUS = 14;

// Скины для бота
const BOT_SKINS = [
    { head: ["#ffffff", "#bd00ff", "#4b0082"], body: ["#df80ff", "#8a2be2", "#1f0033"], tail: ["#ffffff", "#00ffff", "#008b8b"] },
    { head: ["#ffffff", "#ff4500", "#8b0000"], body: ["#ffa07a", "#d2691e", "#3a1200"], tail: ["#ffffff", "#ffcc00", "#8b6508"] }
];

let players = {};
let foods = [];
let botId = "SERVER_BOT_01"; 

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

// Функция для создания/возрождения бота
function spawnServerBot() {
    let startX = WORLD_SIZE / 2 + (Math.random() * 1000 - 500);
    let startY = WORLD_SIZE / 2 + (Math.random() * 1000 - 500);
    let initialScore = 50; 
    let initialSnake = [];
    let startAngle = Math.random() * Math.PI * 2;
    
    for (let i = 0; i < initialScore; i++) {
      initialSnake.push({ x: startX, y: startY + (i * TARGET_DIST), angle: startAngle });
    }

    players[botId] = {
      id: botId,
      name: "OptimizedBot [BOT]",
      x: startX,
      y: startY,
      angle: startAngle,
      targetAngle: startAngle,
      score: initialScore,
      skin: BOT_SKINS[Math.floor(Math.random() * BOT_SKINS.length)],
      snake: initialSnake,
      isBoosting: false,
      boostTimer: 0,
      spawnProtection: 2000, 
      isBot: true 
    };
    
    io.emit('new_player', players[botId]);
    console.log("Серверный бот заспавнен.");
}

spawnServerBot();


function dropFoodOnDeath(snake, skin) {
  let spawnedFoods = [];
  if (snake && snake.length > 0) {
    for (let i = 0; i < snake.length; i += 3) {
      if (Math.random() < 0.4) {
        spawnedFoods.push({
          id: Math.random().toString(36).substring(2, 9),
          x: snake[i].x + (Math.random() * 20 - 10),
          y: snake[i].y + (Math.random() * 20 - 10),
          radius: Math.random() * 2 + 4,
          color: skin ? skin.body[1] : `hsl(${Math.random() * 360}, 100%, 60%)`
        });
      }
    }
  }
  return spawnedFoods;
}

io.on('connection', (socket) => {
  console.log(`Игрок подключился: ${socket.id}`);

  socket.emit('init_data', { foods: foods, players: players });

  socket.on('init_player', (data) => {
    let startX = WORLD_SIZE / 2 + (Math.random() * 400 - 200);
    let startY = WORLD_SIZE / 2 + (Math.random() * 400 - 200);
    let initialScore = 35;
    let initialSnake = [];
    
    for (let i = 0; i < initialScore; i++) {
      initialSnake.push({ x: startX, y: startY + (i * TARGET_DIST), angle: -Math.PI / 2 });
    }

    players[socket.id] = {
      id: socket.id,
      name: data.name || "Player",
      x: startX,
      y: startY,
      angle: -Math.PI / 2,
      targetAngle: -Math.PI / 2,
      score: initialScore,
      skin: data.skin,
      snake: initialSnake,
      isBoosting: false,
      boostTimer: 0,
      spawnProtection: 1500,
      isBot: false 
    };

    socket.emit('spawned', players[socket.id]);
    io.emit('new_player', players[socket.id]);
  });

  socket.on('update_input', (data) => {
    if (players[socket.id] && !players[socket.id].isBot) { 
      players[socket.id].targetAngle = data.targetAngle;
      players[socket.id].isBoosting = data.isBoosting;
    }
  });

  socket.on('quantum_shift', () => {
    let p = players[socket.id];
    if (p && !p.isBot && p.snake && p.snake.length > 1) { 
      p.snake.reverse();
      p.x = p.snake[0].x;
      p.y = p.snake[0].y;
      p.angle = Math.atan2(p.snake[0].y - p.snake[1].y, p.snake[0].x - p.snake[1].x);
      p.targetAngle = p.angle;
    }
  });

  socket.on('disconnect', () => {
    console.log(`Игрок отключился: ${socket.id}`);
    delete players[socket.id];
    io.emit('player_disconnected', socket.id);
  });
});

// [ИЗМЕНЕНО ДЛЯ ЭКОНОМИИ] ОТДЕЛЬНЫЙ ЦИКЛ ДЛЯ ИИ БОТА (10 FPS / каждые 100мс)
const AI_DT = 1000 / 10;
setInterval(() => {
    if (!players[botId] || !players[botId].isBot) return;
    let p = players[botId];

    // Вся тяжелая логика поиска ближайшей еды теперь здесь
    if (foods.length > 0) {
        let minDistSq = Infinity;
        let targetFood = null;
        for (let f of foods) {
            let dx = f.x - p.x;
            let dy = f.y - p.y;
            let distSq = dx*dx + dy*dy;
            if (distSq < minDistSq) {
                minDistSq = distSq;
                targetFood = f;
            }
        }
        
        // Поворачиваем к еде
        if (targetFood) {
            p.targetAngle = Math.atan2(targetFood.y - p.y, targetFood.x - p.x);
        }
        
        // Бот никогда не ускоряется, чтобы не тратить массу
        p.isBoosting = false; 
    }
}, AI_DT);


// ОСНОВНОЙ ИГРОВОЙ ЦИКЛ (60 FPS - Физика и Движение)
const dt = 1000 / 60;
setInterval(() => {
  let deadPlayers = [];

  for (let id in players) {
    let p = players[id];
    
    if (p.spawnProtection > 0) p.spawnProtection -= dt;

    // Плавный поворот головы к целевому углу
    // targetAngle вычисляется либо из ввода игрока, либо в медленном цикле ИИ для бота
    let angleDiff = p.targetAngle - p.angle;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

    const maxTurnSpeed = 0.08;
    if (angleDiff > maxTurnSpeed) angleDiff = maxTurnSpeed;
    if (angleDiff < -maxTurnSpeed) angleDiff = -maxTurnSpeed;
    p.angle += angleDiff;

    // Расчет скорости
    let canBoost = p.isBoosting && p.score > 10;
    let currentSpeed = canBoost ? 4 * 1.4 : 4;

    if (canBoost) {
      p.boostTimer += dt;
      if (p.boostTimer >= 1000) {
        p.score--;
        if (p.snake.length > 0) p.snake.pop();
        p.boostTimer %= 1000;
      }
    } else {
      p.boostTimer = 0;
    }

    // Движение головы змейки
    p.x += Math.cos(p.angle) * currentSpeed;
    p.y += Math.sin(p.angle) * currentSpeed;

    // Обновление головы в массиве тела
    if (p.snake.length > 0) {
      p.snake[0].x = p.x;
      p.snake[0].y = p.y;
      p.snake[0].angle = p.angle;
    }

    // Проверка выхода за границы карты
    if (p.x < 0 || p.x > WORLD_SIZE || p.y < 0 || p.y > WORLD_SIZE) {
      deadPlayers.push({ id: id, x: p.x, y: p.y, skin: p.skin, snake: p.snake });
      continue;
    }

    // Движение хвоста за головой
    for (let i = 1; i < p.snake.length; i++) {
      let current = p.snake[i];
      let prev = p.snake[i - 1];
      let dx = prev.x - current.x;
      let dy = prev.y - current.y;
      let dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0) {
        current.x = prev.x - (dx / dist) * TARGET_DIST;
        current.y = prev.y - (dy / dist) * TARGET_DIST;
      }
      current.angle = Math.atan2(dy, dx);
    }

    // Доращивание хвоста, если score вырос
    while (p.snake.length < p.score) {
      let last = p.snake[p.snake.length - 1] || { x: p.x, y: p.y, angle: p.angle };
      p.snake.push({ x: last.x, y: last.y, angle: last.angle });
    }
    // Обрезка, если уменьшился
    while (p.snake.length > p.score) {
      p.snake.pop();
    }

    // Поедание еды (с увеличенным на 20px радиусом засасывания)
    for (let i = foods.length - 1; i >= 0; i--) {
      let f = foods[i];
      let fDx = p.x - f.x;
      let fDy = p.y - f.y;
      let fDist = Math.sqrt(fDx * fDx + fDy * fDy);

      if (fDist < MAX_SEGMENT_RADIUS + f.radius + 20) {
        p.score++;
        let eatenId = f.id;
        foods.splice(i, 1);
        let newFood = createFoodItem();
        foods.push(newFood);
        io.emit('food_update', { eatenId: eatenId, newFood: newFood });
      }
    }
  }

  // БИТВА: Проверка столкновений
  for (let id in players) {
    let p = players[id];
    if (p.spawnProtection > 0) continue;

    for (let otherId in players) {
      let other = players[otherId];
      // Проверяем столкновение головы p с телом other
      // Если врезался в себя, проверяем только сегменты начиная с 4-го
      let startIdx = (id === otherId) ? 4 : 0; // Эта логика сохраняет отключенную смерть об себя

      for (let i = startIdx; i < other.snake.length; i++) {
        let seg = other.snake[i];
        let hitDx = p.x - seg.x;
        let hitDy = p.y - seg.y;
        let hitDist = Math.sqrt(hitDx * hitDx + hitDy * hitDy);

        if (hitDist < MAX_SEGMENT_RADIUS + 8) {
          if (!deadPlayers.some(d => d.id === id)) {
            deadPlayers.push({ id: id, x: p.x, y: p.y, skin: p.skin, snake: p.snake });
          }
          break;
        }
      }
    }
  }

  // Обработка смертей
  deadPlayers.forEach(d => {
    if (players[d.id]) {
      const droppedFoods = dropFoodOnDeath(d.snake, d.skin);
      foods = foods.concat(droppedFoods);
      io.emit('foods_spawned', droppedFoods);
      io.emit('player_exploded', { x: d.x, y: d.y, color: d.skin ? d.skin.head[1] : '#66fcf1' });
      io.emit('player_died_notification', d.id);
      
      // Если умер бот, сразу возрождаем его
      if (players[d.id].isBot) {
          delete players[d.id];
          spawnServerBot(); // Респавн бота
      } else {
          delete players[d.id];
      }
    }
  });

  // Отправляем всем игрокам глобальное состояние мира
  io.emit('heartbeat', players);
}, dt);

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Сервер запущен. ИИ бота работает на 10 FPS.`);
});
