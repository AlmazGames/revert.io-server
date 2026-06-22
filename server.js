const express = require('express');
const app = express();
const http = require('http').createServer(app);

const io = require('socket.io')(http, {
  cors: {
    origin: "https://almazgames.github.io", // Твой URL на GitHub Pages
    methods: ["GET", "POST"],
    credentials: true
  },
  allowEIO3: true
});

app.get('/', (req, res) => {
  res.send('Сервер Revert.io активен: Боты поумнели, хвост безопасен, ТОП раз в 2 секунды!');
});

// ИГРОВЫЕ НАСТРОЙКИ
const WORLD_SIZE = 4000;
const MAX_FOOD = 500;
const TARGET_DIST = 9;
const MAX_SEGMENT_RADIUS = 14;

// НАСТРОЙКИ БОТОВ
const MAX_SERVER_BOTS = 4; 
const BOT_NAMES = [
    "Viper", "Shadow", "Neon_Glitch", "Alpha_Zero", "CyberGhost", 
    "Apex", "Rogue_Wave", "Phantom", "Slayer", "Matrix_9", 
    "GridRunner", "Maverick", "X_Pulse", "Zenith", "Quantum"
];

const BOT_SKINS = [
    { head: ["#ffffff", "#bd00ff", "#4b0082"], body: ["#df80ff", "#8a2be2", "#1f0033"], tail: ["#ffffff", "#00ffff", "#008b8b"] },
    { head: ["#ffffff", "#ff4500", "#8b0000"], body: ["#ffa07a", "#d2691e", "#3a1200"], tail: ["#ffffff", "#ffcc00", "#8b6508"] },
    { head: ["#ffffff", "#00ff00", "#006400"], body: ["#adff2f", "#32cd32", "#0b2000"], tail: ["#ffffff", "#ff00ff", "#8b008b"] }
];

let players = {};
let foods = [];

// ГЕНЕРАЦИЯ ЕДЫ
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

// СПАВН СЕРВЕРНОГО БОТА
function spawnServerBot() {
    let botId = "bot_" + Math.random().toString(36).substring(2, 9);
    let startX = WORLD_SIZE / 2 + (Math.random() * 1600 - 800);
    let startY = WORLD_SIZE / 2 + (Math.random() * 1600 - 800);
    let initialScore = Math.floor(Math.random() * 15) + 35; 
    let initialSnake = [];
    let startAngle = Math.random() * Math.PI * 2;
    
    for (let i = 0; i < initialScore; i++) {
      initialSnake.push({ x: startX, y: startY + (i * TARGET_DIST), angle: startAngle });
    }

    let randomName = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];

    players[botId] = {
      id: botId,
      name: randomName, 
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
      isBot: true,
      // Поля умного сдерживания зацикливания:
      stuckTimer: 0,
      ignoredFoodId: null,
      lastFoodId: null,
      foodTargetTicks: 0
    };
    
    io.emit('new_player', players[botId]);
}

// Заполняем карту ботами при старте
for (let i = 0; i < MAX_SERVER_BOTS; i++) {
    spawnServerBot();
}

// СПАВН МАССЫ ПРИ СМЕРТИ
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

// ОБРАБОТКА ПОДКЛЮЧЕНИЙ
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

// [ОБНОВЛЕНО] ЦИКЛ МОЗГОВ ДЛЯ ВСЕХ БОТОВ (10 FPS) — С АНТИ-ОРБИТАЛЬНОЙ СИСТЕМОЙ
const AI_DT = 1000 / 10;
setInterval(() => {
    for (let id in players) {
        let p = players[id];
        if (!p.isBot) continue; 

        // Если запущен маневр отъезда от заклинившей еды
        if (p.stuckTimer > 0) {
            p.stuckTimer--;
            if (p.stuckTimer === 0) {
                p.ignoredFoodId = null; // Разбаниваем недоступную еду после отхода
            }
            continue; // Не меняем курс во время спасительного отворота
        }

        if (foods.length > 0) {
            let minDistSq = Infinity;
            let targetFood = null;
            
            // Ищем ближайшую еду (игнорируем ту, вокруг которой крутились)
            for (let f of foods) {
                if (f.id === p.ignoredFoodId) continue;
                
                let dx = f.x - p.x;
                let dy = f.y - p.y;
                let distSq = dx*dx + dy*dy;
                if (distSq < minDistSq) {
                    minDistSq = distSq;
                    targetFood = f;
                }
            }

            if (targetFood) {
                // Считаем тики удержания одной и той же цели
                if (targetFood.id === p.lastFoodId) {
                    p.foodTargetTicks = (p.foodTargetTicks || 0) + 1;
                } else {
                    p.lastFoodId = targetFood.id;
                    p.foodTargetTicks = 0;
                }

                // Если бот кружится у точки больше 2.5 секунд (25 тиков ИИ) и не съел её
                if (p.foodTargetTicks > 25) {
                    p.ignoredFoodId = targetFood.id; // Временный бан точки
                    p.stuckTimer = 15; // 1.5 секунды летим прочь (15 тиков)
                    
                    // Резко отворачиваем влево или вправо на 100 градусов, ломая круг вращения
                    p.targetAngle = p.angle + (Math.random() > 0.5 ? Math.PI / 1.8 : -Math.PI / 1.8);
                    p.foodTargetTicks = 0;
                } else {
                    // Обычное следование к еде
                    p.targetAngle = Math.atan2(targetFood.y - p.y, targetFood.x - p.x);
                }
            }
            
            p.isBoosting = (p.score > 50 && Math.random() < 0.05); 
        }
    }
}, AI_DT);


// ЯДРО ФИЗИКИ СЕРВЕРА (60 FPS)
const dt = 1000 / 60;
setInterval(() => {
  let deadPlayers = [];

  for (let id in players) {
    let p = players[id];
    if (p.spawnProtection > 0) p.spawnProtection -= dt;

    let angleDiff = p.targetAngle - p.angle;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

    const maxTurnSpeed = 0.08;
    if (angleDiff > maxTurnSpeed) angleDiff = maxTurnSpeed;
    if (angleDiff < -maxTurnSpeed) angleDiff = -maxTurnSpeed;
    p.angle += angleDiff;

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

    p.x += Math.cos(p.angle) * currentSpeed;
    p.y += Math.sin(p.angle) * currentSpeed;

    if (p.snake.length > 0) {
      p.snake[0].x = p.x;
      p.snake[0].y = p.y;
      p.snake[0].angle = p.angle;
    }

    // Границы карты
    if (p.x < 0 || p.x > WORLD_SIZE || p.y < 0 || p.y > WORLD_SIZE) {
      deadPlayers.push({ id: id, x: p.x, y: p.y, skin: p.skin, snake: p.snake });
      continue;
    }

    // Передвижение хвоста
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

    while (p.snake.length < p.score) {
      let last = p.snake[p.snake.length - 1] || { x: p.x, y: p.y, angle: p.angle };
      p.snake.push({ x: last.x, y: last.y, angle: last.angle });
    }
    while (p.snake.length > p.score) {
      p.snake.pop();
    }

    // Сбор корма
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

  // ОБСЛУЖИВАНИЕ СТОЛКНОВЕНИЙ
  for (let id in players) {
    let p = players[id];
    if (p.spawnProtection > 0) continue;

    for (let otherId in players) {
      // Игнорируем себя — смерть о свой хвост выключена!
      if (id === otherId) continue; 

      let other = players[otherId];

      for (let i = 0; i < other.snake.length; i++) {
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

  // Смерти
  deadPlayers.forEach(d => {
    if (players[d.id]) {
      const droppedFoods = dropFoodOnDeath(d.snake, d.skin);
      foods = foods.concat(droppedFoods);
      io.emit('foods_spawned', droppedFoods);
      io.emit('player_exploded', { x: d.x, y: d.y, color: d.skin ? d.skin.head[1] : '#66fcf1' });
      io.emit('player_died_notification', d.id);
      
      let wasBot = players[d.id].isBot;
      delete players[d.id];

      if (wasBot) {
          spawnServerBot(); 
      }
    }
  });
}, dt);


// СЕТЕВЫЕ ИНТЕРВАЛЫ
// 1. Позиции игроков (20 FPS / Каждые 50мс для плавной интерполяции)
setInterval(() => {
  if (Object.keys(players).length > 0) {
    io.emit('heartbeat', players);
  }
}, 50);

// 2. Поток ЛИДЕРБОРДА (Каждые 2 секунды / 2000мс)
setInterval(() => {
  if (Object.keys(players).length === 0) return;

  const leaderboardData = Object.values(players)
    .map(p => ({ id: p.id, name: p.name, score: p.score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10); 

  io.emit('leaderboard_update', leaderboardData);
}, 2000);


const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Сервер перезапущен. Умный ИИ ботов активен на порту: ${PORT}`);
});
