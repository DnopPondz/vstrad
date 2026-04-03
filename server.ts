// server.ts
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import mongoose from 'mongoose';
import * as dotenv from 'dotenv';

dotenv.config();

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("⚠️ MONGODB_URI is missing in .env");
    await mongoose.connect(uri);
    console.log("💾 MongoDB Connected Successfully!");
  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error);
    process.exit(1);
  }
};

let waitingQueue: { socketId: string; user: any }[] = [];

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

  const io = new SocketIOServer(server);
  

  io.on('connection', (socket) => {
    console.log(`🟢 Socket Connected: ${socket.id}`);

    socket.on('login', (username: string) => {
      const userData = { id: socket.id, username, balance: 1000 };
      socket.emit('login_success', userData);
    });
    socket.on('update_pnl', (data) => {
  // หาว่า socket นี้อยู่ในห้องไหน
  const rooms = Array.from(socket.rooms);
  const arenaRoom = rooms.find(r => r.startsWith('arena_'));

  if (arenaRoom) {
    // ส่งคะแนนไปให้คนอื่นในห้อง (ยกเว้นตัวเอง)
    socket.to(arenaRoom).emit('opponent_pnl', data);
  }
});

    socket.on('find_match', (user: any) => {
      console.log(`🔍 ${user.username} is looking for a match...`);
      waitingQueue.push({ socketId: socket.id, user });

      if (waitingQueue.length >= 2) {
        const player1 = waitingQueue.shift()!;
        const player2 = waitingQueue.shift()!;
        const roomId = `arena_${Date.now()}`;

        const p1Socket = io.sockets.sockets.get(player1.socketId);
        const p2Socket = io.sockets.sockets.get(player2.socketId);
        
        if (p1Socket) p1Socket.join(roomId);
        if (p2Socket) p2Socket.join(roomId);

        console.log(`⚔️ Match Started: ${player1.user.username} vs ${player2.user.username}`);

        io.to(roomId).emit('match_found', {
          roomId,
          players: [player1.user, player2.user]
        });
      }
    });

    socket.on('disconnect', () => {
      console.log(`🔴 Socket Disconnected: ${socket.id}`);
      waitingQueue = waitingQueue.filter(p => p.socketId !== socket.id);
    });
  });

  server.listen(port, () => {
    console.log(`> 🚀 Ready on http://${hostname}:${port}`);
  });
});