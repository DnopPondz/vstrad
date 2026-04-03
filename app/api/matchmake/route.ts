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

// Schema สำหรับ User
const UserSchema = new mongoose.Schema({
  username: String,
  balance: { type: Number, default: 1000 },
  winCount: { type: Number, default: 0 },
});
const User = mongoose.models.User || mongoose.model('User', UserSchema);

// Schema สำหรับ Matchmaking
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

    // เช็คหรือสร้าง User เพื่อดึงยอดเงินปัจจุบัน
    let userData = await User.findOne({ username });
    if (!userData) userData = await User.create({ username });

    await Match.deleteOne({ username, status: 'waiting' });
    const waitingPlayer = await Match.findOne({ status: 'waiting', username: { $ne: username } });

    if (waitingPlayer) {
      const roomId = `room_${Date.now()}`;
      await Match.findByIdAndUpdate(waitingPlayer._id, { status: 'matched', opponent: username, roomId });
      
      await pusher.trigger('lobby-channel', `matched-${waitingPlayer.username}`, {
        roomId,
        opponent: { username, balance: userData.balance }
      });

      return NextResponse.json({ status: 'matched', roomId, opponent: { username: waitingPlayer.username }, balance: userData.balance });
    } else {
      await Match.create({ username, status: 'waiting' });
      return NextResponse.json({ status: 'waiting', balance: userData.balance });
    }
  } catch (error) {
    return NextResponse.json({ error: 'System Error' }, { status: 500 });
  }
}