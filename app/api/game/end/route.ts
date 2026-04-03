// app/api/game/end/route.ts
import { NextResponse } from 'next/server';
import mongoose from 'mongoose';

const connectDB = async () => {
  if (mongoose.connections[0].readyState) return;
  await mongoose.connect(process.env.MONGODB_URI!);
};

// เรียกใช้ Schema เดิมเพื่อป้องกัน Error
const User = mongoose.models.User || mongoose.model('User', new mongoose.Schema({
  username: { type: String, unique: true },
  password: { type: String },
  balance: { type: Number, default: 50 },
  winCount: { type: Number, default: 0 },
  totalMatches: { type: Number, default: 0 },
}));
const History = mongoose.models.History || mongoose.model('History');

export async function POST(req: Request) {
  try {
    const { username, opponent, pnl, result, symbol } = await req.json();
    await connectDB();

    const isWin = result === 'WIN';
    await User.findOneAndUpdate(
      { username }, 
      { $inc: { balance: pnl, winCount: isWin ? 1 : 0, totalMatches: 1 } }
    );
    await History.create({ username, opponent, pnl, result, symbol });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}