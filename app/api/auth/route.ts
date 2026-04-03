import { NextResponse } from 'next/server';
import mongoose from 'mongoose';

const connectDB = async () => {
  if (mongoose.connections[0].readyState) return;
  await mongoose.connect(process.env.MONGODB_URI!);
};

const User = mongoose.models.User || mongoose.model('User', new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  balance: { type: Number, default: 50 },
}));

export async function POST(req: Request) {
  try {
    const { action, username, password } = await req.json();
    await connectDB();

    if (action === 'REGISTER') {
      const exists = await User.findOne({ username });
      if (exists) return NextResponse.json({ error: 'Username taken' }, { status: 400 });
      await User.create({ username, password });
      return NextResponse.json({ success: true, username });
    }

    if (action === 'LOGIN') {
      const user = await User.findOne({ username, password });
      if (!user) return NextResponse.json({ error: 'Wrong credentials' }, { status: 401 });
      return NextResponse.json({ success: true, username });
    }
  } catch (error) { return NextResponse.json({ error: 'Error' }, { status: 500 }); }
}