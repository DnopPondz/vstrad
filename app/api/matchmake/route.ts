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
  await mongoose.connect(process.env.MONGODB_URI!);
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

    // ลบคิวเก่าตัวเอง
    await Match.deleteOne({ username, status: 'waiting' });

    // หาคนอื่นที่รออยู่
    const waitingPlayer = await Match.findOne({ status: 'waiting', username: { $ne: username } });

    if (waitingPlayer) {
      const roomId = `room_${Date.now()}`;
      await Match.findByIdAndUpdate(waitingPlayer._id, { status: 'matched', opponent: username, roomId });
      
      await pusher.trigger('lobby-channel', `matched-${waitingPlayer.username}`, {
        roomId,
        opponent: { username }
      });

      return NextResponse.json({ status: 'matched', roomId, opponent: { username: waitingPlayer.username } });
    } else {
      await Match.create({ username, status: 'waiting' });
      return NextResponse.json({ status: 'waiting' });
    }
  } catch (error) {
    return NextResponse.json({ error: 'DB Error' }, { status: 500 });
  }
}