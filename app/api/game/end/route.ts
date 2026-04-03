import { NextResponse } from 'next/server';
import mongoose from 'mongoose';

const connectDB = async () => {
  if (mongoose.connections[0].readyState) return;
  await mongoose.connect(process.env.MONGODB_URI!);
};

// 🛑 ต้องประกาศ Schema ให้ครบป้องกัน Error ตอน Build
const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: { type: String },
  balance: { type: Number, default: 50 },
  winCount: { type: Number, default: 0 },
  totalMatches: { type: Number, default: 0 },
});
const User = mongoose.models.User || mongoose.model('User', UserSchema);

export async function POST(req: Request) {
  try {
    const { username, pnl, isMidGame } = await req.json();
    await connectDB();

    // อัปเดตเงิน และขอข้อมูลใหม่กลับมาทันที
    const updatedUser = await User.findOneAndUpdate(
      { username }, 
      { $inc: { balance: pnl, totalMatches: isMidGame ? 0 : 1 } },
      { new: true }
    );

    return NextResponse.json({ 
      success: true, 
      newBalance: updatedUser.balance 
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'System Error' }, { status: 500 });
  }
}