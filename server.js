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
  res.send('Сервер revert.io работает и управляет мультиплеером!');
});

// Хранилище всех активных игроков на сервере
const players = {};

io.on('connection', (socket) => {
  console.log('Новое сокет-подключение:', socket.id);

  // 1. Игрок ввёл ник, выбрал скин и нажал PLAY
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

    // Отправляем новому игроку список ВСЕХ, кто уже играет
    socket.emit('current_players', players);

    // Всем остальным сообщаем, что подключился новый игрок
    socket.broadcast.emit('new_player', players[socket.id]);
  });

  // 2. Игрок движется или растет
  socket.on('move', (data) => {
    if (players[socket.id]) {
      players[socket.id].x = data.x;
      players[socket.id].y = data.y;
      players[socket.id].angle = data.angle;
      players[socket.id].score = data.score;

      // Рассылаем обновленные координаты этого игрока всем остальным
      socket.broadcast.emit('player_moved', players[socket.id]);
    }
  });

  // 3. Игрок врезался в стену (или погиб) и вернулся в меню
  socket.on('player_died', () => {
    if (players[socket.id]) {
      delete players[socket.id];
      io.emit('player_disconnected', socket.id);
    }
  });

  // 4. Игрок просто закрыл вкладку браузера
  socket.on('disconnect', () => {
    console.log('Игрок отключился:', socket.id);
    if (players[socket.id]) {
      delete players[socket.id];
      io.emit('player_disconnected', socket.id);
    }
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
