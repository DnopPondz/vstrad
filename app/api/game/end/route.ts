import { NextResponse } from 'next/server';
import mongoose from 'mongoose';

const User = mongoose.models.User || mongoose.model('User', new mongoose.Schema({
  username: String,
  balance: { type: Number, default: 1000 },
  winCount: { type: Number, default: 0 },
}));

export async function POST(req: Request) {
  try {
    const { username, pnl, isWin } = await req.json();
    if (!mongoose.connections[0].readyState) await mongoose.connect(process.env.MONGODB_URI!);

    // บันทึกเงินใหม่: เงินเดิม + กำไร/ขาดทุน
    const updatedUser = await User.findOneAndUpdate(
      { username },
      { $inc: { balance: pnl, winCount: isWin ? 1 : 0 } },
      { new: true }
    );

    return NextResponse.json({ success: true, newBalance: updatedUser.balance });
  } catch (error) {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}