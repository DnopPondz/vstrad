// server.ts
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import mongoose from 'mongoose';
import * as dotenv from 'dotenv';

dotenv.config();

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0'; // ใช้ 0.0.0.0 เพื่อให้เข้าถึงได้จากภายนอก
const port = parseInt(process.env.PORT || '3000', 10); // ดึง Port จาก Server

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// เชื่อมต่อ MongoDB (เพิ่มเงื่อนไขเช็ค URI)
const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.log("⚠️ MONGODB_URI not found, running without database.");
    return;
  }
  try {
    await mongoose.connect(uri);
    console.log("💾 MongoDB Connected!");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
  }
};

app.prepare().then(async () => {
  await connectDB();

  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  const io = new SocketIOServer(server, {
    cors: {
      origin: "*", // อนุญาตให้ต่อจากที่ไหนก็ได้
      methods: ["GET", "POST"]
    }
  });

  // --- Matchmaking & Socket Logic ---
  let waitingQueue: any[] = [];
  
  io.on('connection', (socket) => {
    console.log(`🟢 User Connected: ${socket.id}`);

    socket.on('login', (username) => {
      socket.emit('login_success', { username, balance: 1000 });
    });

    socket.on('find_match', (user) => {
      waitingQueue.push({ socketId: socket.id, user });
      if (waitingQueue.length >= 2) {
        const p1 = waitingQueue.shift();
        const p2 = waitingQueue.shift();
        const roomId = `arena_${Date.now()}`;
        
        io.to(p1.socketId).to(p2.socketId).emit('match_found', {
          roomId,
          players: [p1.user, p2.user],
          timeLeft: 300
        });

        // จัดการ Timer...
        let timeLeft = 300;
        const timer = setInterval(() => {
          timeLeft--;
          io.to(roomId).emit('timer_update', timeLeft);
          if (timeLeft <= 0) {
            clearInterval(timer);
            io.to(roomId).emit('game_over');
          }
        }, 1000);
      }
    });

    socket.on('update_pnl', (data) => {
        socket.broadcast.emit('opponent_pnl', data);
    });

    socket.on('disconnect', () => {
      waitingQueue = waitingQueue.filter(q => q.socketId !== socket.id);
    });
  });

  server.listen(port, () => {
    console.log(`> 🚀 Server listening on port ${port}`);
  });
});