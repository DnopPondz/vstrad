// app/api/matchmake/route.ts
import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import Pusher from 'pusher';

// เชื่อมต่อ Pusher
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
});

// สร้าง Schema ง่ายๆ สำหรับคิว
const MatchSchema = new mongoose.Schema({
  username: String,
  status: { type: String, default: 'waiting' }, // waiting, matched
  matchedWith: String,
  roomId: String,
  createdAt: { type: Date, default: Date.now, expires: 60 } // ให้คิวหายไปเองใน 60 วิถ้าไม่มีคนมาจอย
});

const Match = mongoose.models.Match || mongoose.model('Match', MatchSchema);

export async function POST(req: Request) {
  const { username } = await req.json();
  
  if (!mongoose.connections[0].readyState) {
    await mongoose.connect(process.env.MONGODB_URI!);
  }

  // 1. หาคนอื่นที่กำลังรออยู่ (ที่ไม่ใช่ตัวเราเอง)
  const waitingPlayer = await Match.findOne({ 
    status: 'waiting', 
    username: { $ne: username } 
  });

  if (waitingPlayer) {
    // 2. ถ้าเจอคนรออยู่ -> จับคู่เลย!
    const roomId = `room_${Date.now()}`;
    
    // อัปเดตสถานะคนรอเดิม
    await Match.findByIdAndUpdate(waitingPlayer._id, { 
      status: 'matched', 
      matchedWith: username, 
      roomId 
    });

    // ส่งสัญญาณ Pusher ไปหาคนรอ (คนแรก)
    await pusher.trigger('lobby-channel', `matched-${waitingPlayer.username}`, {
      roomId,
      opponent: { username }
    });

    // ตอบกลับคนกด (คนที่สอง)
    return NextResponse.json({ 
      status: 'matched', 
      roomId, 
      opponent: { username: waitingPlayer.username } 
    });
  } else {
    // 3. ถ้าไม่มีคนรอ -> เราลงคิวเอง
    await Match.findOneAndUpdate(
      { username }, 
      { status: 'waiting', createdAt: new Date() }, 
      { upsert: true }
    );
    return NextResponse.json({ status: 'waiting' });
  }
}