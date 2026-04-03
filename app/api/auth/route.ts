// app/api/auth/route.ts
import { NextResponse } from 'next/server';
import mongoose from 'mongoose';

const connectDB = async () => {
  if (mongoose.connections[0].readyState) return;
  await mongoose.connect(process.env.MONGODB_URI!);
};

// อัปเดต Schema ให้มีรหัสผ่าน (ใช้การเก็บเบื้องต้นสำหรับเกม)
const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  balance: { type: Number, default: 50 }, // ให้ทุนเริ่มต้น 50 USD (ต้องฟาร์มอีก 50 ถึงจะเล่น VS ได้)
  winCount: { type: Number, default: 0 },
  totalMatches: { type: Number, default: 0 },
});

const User = mongoose.models.User || mongoose.model('User', UserSchema);

export async function POST(req: Request) {
  try {
    const { action, username, password } = await req.json();
    await connectDB();

    if (!username || !password) {
      return NextResponse.json({ error: 'Please enter username and password' }, { status: 400 });
    }

    if (action === 'REGISTER') {
      const exists = await User.findOne({ username });
      if (exists) return NextResponse.json({ error: 'Username already taken!' }, { status: 400 });
      
      const newUser = await User.create({ username, password });
      return NextResponse.json({ success: true, username: newUser.username });
    }

    if (action === 'LOGIN') {
      const user = await User.findOne({ username, password });
      if (!user) return NextResponse.json({ error: 'Invalid username or password!' }, { status: 401 });
      
      return NextResponse.json({ success: true, username: user.username });
    }

  } catch (error) {
    return NextResponse.json({ error: 'System Error' }, { status: 500 });
  }
}