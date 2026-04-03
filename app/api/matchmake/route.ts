import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import Pusher from 'pusher';

const connectDB = async () => {
  if (mongoose.connections[0].readyState) return;
  await mongoose.connect(process.env.MONGODB_URI!);
};

// 1. Schemas
const User = mongoose.models.User || mongoose.model('User', new mongoose.Schema({
  username: String,
  balance: { type: Number, default: 1000 },
  winCount: { type: Number, default: 0 },
  totalMatches: { type: Number, default: 0 },
}));

const History = mongoose.models.History || mongoose.model('History', new mongoose.Schema({
  username: String, opponent: String, pnl: Number, result: String, symbol: String, date: { type: Date, default: Date.now }
}));

// ระบบห้อง (Room) แทนการสุ่ม
const Room = mongoose.models.Room || mongoose.model('Room', new mongoose.Schema({
  roomId: String,
  host: String,
  status: { type: String, default: 'waiting' }, // 'waiting' หรือ 'playing'
  symbol: String,
  leverage: Number,
  createdAt: { type: Date, default: Date.now, expires: 600 } // ห้องหมดอายุใน 10 นาทีถ้าไม่มีคนเข้า
}));

export async function POST(req: Request) {
  try {
    const { action, username, symbol, leverage, roomId } = await req.json();
    await connectDB();

    // เช็คประวัติและโปรไฟล์
    let userData = await User.findOne({ username });
    if (!userData) userData = await User.create({ username });

    const pusher = new Pusher({
      appId: process.env.PUSHER_APP_ID!,
      key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
      secret: process.env.PUSHER_SECRET!,
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      useTLS: true,
    });

    // ACTION: โหลดข้อมูลเข้า Lobby (ห้องทั้งหมด, สถิติ)
    if (action === 'FETCH_LOBBY') {
      const activeRooms = await Room.find({ status: 'waiting' }).sort({ createdAt: -1 });
      const leaderboard = await User.find().sort({ balance: -1 }).limit(5).select('username balance');
      const history = await History.find({ username }).sort({ date: -1 }).limit(5);
      return NextResponse.json({ 
        rooms: activeRooms, leaderboard, history, 
        stats: { wins: userData.winCount, total: userData.totalMatches }, balance: userData.balance 
      });
    }

    // ACTION: สร้างห้องใหม่
    if (action === 'CREATE_ROOM') {
      const newRoomId = `room_${Date.now()}`;
      await Room.create({ roomId: newRoomId, host: username, symbol, leverage });
      return NextResponse.json({ roomId: newRoomId });
    }

    // ACTION: กด Join ห้องเพื่อน
    if (action === 'JOIN_ROOM') {
      const room = await Room.findOne({ roomId, status: 'waiting' });
      if (!room) return NextResponse.json({ error: 'Room not found or full' });
      
      // ปิดห้องไม่ให้คนอื่นเข้า
      room.status = 'playing';
      await room.save();

      // ยิง Pusher ไปบอก Host และตัวเองว่า "เกมเริ่มแล้ว"
      await pusher.trigger(`room-${roomId}`, 'game-start', {
        host: room.host,
        challenger: username,
        symbol: room.symbol,
        leverage: room.leverage
      });

      return NextResponse.json({ success: true });
    }

    // ACTION: ยกเลิกห้อง
    if (action === 'CANCEL_ROOM') {
      await Room.deleteOne({ roomId, host: username });
      return NextResponse.json({ success: true });
    }

  } catch (error) {
    return NextResponse.json({ error: 'System Error' }, { status: 500 });
  }
}