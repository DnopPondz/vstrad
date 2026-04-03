import { NextResponse } from 'next/server';
import mongoose from 'mongoose';

const connectDB = async () => {
  if (mongoose.connections[0].readyState) return;
  await mongoose.connect(process.env.MONGODB_URI!);
};

const User = mongoose.models.User || mongoose.model('User');
const History = mongoose.models.History || mongoose.model('History');

export async function POST(req: Request) {
  try {
    const { username, opponent, pnl, result, symbol } = await req.json();
    await connectDB();

    const isWin = result === 'WIN';

    // อัปเดตเงิน + ชนะ + จำนวนเกมทั้งหมด
    await User.findOneAndUpdate(
      { username }, 
      { 
        $inc: { 
          balance: pnl,
          winCount: isWin ? 1 : 0,
          totalMatches: 1
        } 
      }
    );
    
    await History.create({ username, opponent, pnl, result, symbol });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}