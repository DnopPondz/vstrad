// app/api/matchmake/route.ts
import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import Pusher from 'pusher';

// ตั้งค่า Pusher (Backend)
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
});

// เชื่อมต่อ MongoDB
const connectDB = async () => {
  if (mongoose.connections[0].readyState) return;
  await mongoose.connect(process.env.MONGODB_URI!);
};

// สร้าง Schema สำหรับคิวรอ
const MatchSchema = new mongoose.Schema({
  username: String,
  status: { type: String, default: 'waiting' }, // waiting, matched
  roomId: String,
  opponent: String,
  createdAt: { type: Date, default: Date.now, expires: 60 } // ลบคิวทิ้งเองใน 60 วินาที
});

const Match = mongoose.models.Match || mongoose.model('Match', MatchSchema);

export async function POST(req: Request) {
  try {
    const { username } = await req.json();
    await connectDB();

    // 1. หาว่ามีคนอื่น "รอ" อยู่ไหม (ที่ไม่ใช่เรา)
    const waitingPlayer = await Match.findOne({ 
      status: 'waiting', 
      username: { $ne: username } 
    });

    if (waitingPlayer) {
      // 2. ถ้าเจอคนรอ -> จับคู่!
      const roomId = `room_${Date.now()}`;
      
      // อัปเดตสถานะคนแรก (คนรอ)
      await Match.findByIdAndUpdate(waitingPlayer._id, { 
        status: 'matched', 
        opponent: username, 
        roomId 
      });

      // ส่งสัญญาณผ่าน Pusher ไปบอกคนแรกว่า "เจอคู่แล้วนะ"
      await pusher.trigger('lobby-channel', `matched-${waitingPlayer.username}`, {
        roomId,
        opponent: { username }
      });

      // ตอบกลับเรา (คนที่สอง) ว่า "จับคู่สำเร็จ"
      return NextResponse.json({ 
        status: 'matched', 
        roomId, 
        opponent: { username: waitingPlayer.username } 
      });
    } else {
      // 3. ถ้าไม่มีคนรอ -> เราลงชื่อรอเอง
      await Match.findOneAndUpdate(
        { username }, 
        { status: 'waiting', createdAt: new Date() }, 
        { upsert: true }
      );
      return NextResponse.json({ status: 'waiting' });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}