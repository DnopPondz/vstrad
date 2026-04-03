import { NextResponse } from 'next/server';
import Pusher from 'pusher';

// ใช้ค่าจาก Environment Variables ที่เราตั้งใน Vercel
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
});

export async function POST(req: Request) {
  try {
    const { event, channel, data } = await req.json();
    
    // สั่งให้ Pusher กระจายข้อมูลไปหาคู่แข่ง
    await pusher.trigger(channel, event, data);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error }, { status: 500 });
  }
}