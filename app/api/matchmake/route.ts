import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import Pusher from 'pusher';

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
});

const connectDB = async () => {
  if (mongoose.connections[0].readyState) return;
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
  } catch (error) {
    console.error("MongoDB Connect Error:", error);
  }
};

const MatchSchema = new mongoose.Schema({
  username: String,
  status: { type: String, default: 'waiting' },
  roomId: String,
  opponent: String,
  createdAt: { type: Date, default: Date.now, expires: 60 }
});

const Match = mongoose.models.Match || mongoose.model('Match', MatchSchema);

export async function POST(req: Request) {
  try {
    const { username } = await req.json();
    await connectDB();

    // 1. ลบคิวเก่าที่ค้างของตัวเอง (ถ้ามี)
    await Match.deleteOne({ username, status: 'waiting' });

    // 2. หาคนอื่นที่รออยู่
    const waitingPlayer = await Match.findOne({ status: 'waiting', username: { $ne: username } });

    if (waitingPlayer) {
      const roomId = `room_${Date.now()}`;
      // อัปเดตฝั่งคนรอ
      await Match.findByIdAndUpdate(waitingPlayer._id, { status: 'matched', opponent: username, roomId });
      
      // ยิง Pusher แจ้งคนรอ
      await pusher.trigger('lobby-channel', `matched-${waitingPlayer.username}`, {
        roomId,
        opponent: { username }
      });

      return NextResponse.json({ status: 'matched', roomId, opponent: { username: waitingPlayer.username } });
    } else {
      // ไม่มีคนรอ -> ลงชื่อรอเอง
      await Match.create({ username, status: 'waiting' });
      return NextResponse.json({ status: 'waiting' });
    }
  } catch (error) {
    console.error("Matchmake API Error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}