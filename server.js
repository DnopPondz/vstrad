// server.js
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

// นำเข้า mongoose และ dotenv
const mongoose = require('mongoose');
require('dotenv').config();

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// --- ฟังก์ชันเชื่อมต่อ MongoDB ---
const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("⚠️ MONGODB_URI is missing in .env file");
    }
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("💾 MongoDB Connected Successfully!");
  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error);
    process.exit(1);
  }
};

app.prepare().then(async () => {
  // เรียกฟังก์ชันต่อ Database ก่อนเปิดเซิร์ฟเวอร์
  await connectDB();

  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  const io = new Server(server);

  io.on('connection', (socket) => {
    console.log(`🟢 User Connected: ${socket.id}`);

    socket.on('join_match', (roomId) => {
      socket.join(roomId);
      console.log(`User ${socket.id} joined room: ${roomId}`);
      io.to(roomId).emit('message', `User ${socket.id} joined the arena!`);
    });

    socket.on('disconnect', () => {
      console.log(`🔴 User Disconnected: ${socket.id}`);
    });
  });

  server
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> 🚀 Ready on http://${hostname}:${port} (Next.js + Socket.io + MongoDB)`);
    });
});