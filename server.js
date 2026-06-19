const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  cors: {
    origin: "*", // Разрешаем подключение с твоего Vercel сайта
    methods: ["GET", "POST"]
  }
});

// Базовый роут, просто проверить что сервер жив
app.get('/', (req, res) => {
  res.send('Сервер revert.io работает!');
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

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
