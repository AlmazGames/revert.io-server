const express = require('express');
const app = express();
const http = require('http').createServer(app);

// Настраиваем Socket.io с жестким разрешением для твоего GitHub Pages
const io = require('socket.io')(http, {
  cors: {
    origin: "https://almazgames.github.io", // Твой фронтенд
    methods: ["GET", "POST"],
    credentials: true
  },
  allowEIO3: true // Для совместимости версий
});

// Базовый роут, чтобы проверить в браузере
app.get('/', (req, res) => {
  res.send('Сервер revert.io работает и ждет игроков с GitHub Pages!');
});

io.on('connection', (socket) => {
  console.log('Игрок подключился:', socket.id);

  // Когда кто-то двигается, пересылаем это всем остальным
  socket.on('move', (data) => {
    socket.broadcast.emit('player_moved', { id: socket.id, x: data.x, y: data.y });
  });

  socket.on('disconnect', () => {
    console.log('Игрок отключился:', socket.id);
    io.emit('player_disconnected', socket.id);
  });
});

// Автоматический порт от Render или 3000 локально
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Сервер успешно запущен на порту ${PORT}`);
});
