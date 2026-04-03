"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Pusher from "pusher-js";
import TradingChart from "@/components/TradingChart";
import { TrendingUp, TrendingDown, Users, Trophy, XCircle, Loader2, Swords, Clock } from "lucide-react";

type GameState = 'LOBBY' | 'SEARCHING' | 'ARENA';

export default function ArenaPage() {
  const [gameState, setGameState] = useState<GameState>('LOBBY');
  const [myUser, setMyUser] = useState<any>(null);
  const [opponent, setOpponent] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState<number>(300);
  const [isGameOver, setIsGameOver] = useState(false);
  const [roomId, setRoomId] = useState<string>("");

  // Trading States
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [position, setPosition] = useState<'NONE' | 'LONG' | 'SHORT'>('NONE');
  const [entryPrice, setEntryPrice] = useState<number>(0);
  const [unrealizedPnl, setUnrealizedPnl] = useState<number>(0);
  const [balance, setBalance] = useState<number>(1000);

  // 1. Pusher Setup
  useEffect(() => {
    // จำลอง Login
    const name = `Trader_${Math.floor(Math.random() * 1000)}`;
    setMyUser({ username: name, balance: 1000 });

    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    });

    // ระบบ Matchmaking แบบ Serverless (ใช้ Public Channel)
    const lobbyChannel = pusher.subscribe('lobby');
    
    lobbyChannel.bind('match_start', (data: any) => {
      const isMe = data.players.some((p: any) => p.username === name);
      if (isMe) {
        const enemy = data.players.find((p: any) => p.username !== name);
        setOpponent({ ...enemy, currentPnl: 0 });
        setRoomId(data.roomId);
        setGameState('ARENA');
      }
    });

    return () => {
      pusher.unsubscribe('lobby');
    };
  }, []);

  // 2. Room Channel Setup (เมื่อเข้าห้องแข่งแล้ว)
  useEffect(() => {
    if (!roomId) return;

    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    });

    const channel = pusher.subscribe(roomId);

    channel.bind('opponent_pnl', (data: any) => {
      if (data.username !== myUser?.username) {
        setOpponent((prev: any) => ({ ...prev, currentPnl: data.pnl }));
      }
    });

    // ระบบนับเวลาจำลอง (เพราะไม่มี Server คุม ต้องใช้ Client ตัวหลักเป็นคนส่ง)
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setIsGameOver(true);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      pusher.unsubscribe(roomId);
      clearInterval(timer);
    };
  }, [roomId, myUser?.username]);

  // 3. ส่ง PnL ไปให้คู่แข่งผ่าน API
  useEffect(() => {
    if (gameState === 'ARENA' && !isGameOver) {
      let pnl = 0;
      if (position === 'LONG') pnl = (currentPrice - entryPrice) * 10;
      else if (position === 'SHORT') pnl = (entryPrice - currentPrice) * 10;
      setUnrealizedPnl(pnl);

      // ส่งคะแนนผ่าน API Route
      fetch('/api/pusher', {
        method: 'POST',
        body: JSON.stringify({
          event: 'opponent_pnl',
          channel: roomId,
          data: { username: myUser?.username, pnl: pnl }
        })
      });
    }
  }, [currentPrice, position, entryPrice, gameState, isGameOver, roomId, myUser?.username]);

  // ฟังก์ชันช่วย
  const findMatch = async () => {
    setGameState('SEARCHING');
    // ในระบบจริงตรงนี้ควรมี Server เช็คคิว แต่เพื่อ Vercel 
    // เราจะส่งเหตุการณ์ "หาคู่" ไปที่ Lobby
    await fetch('/api/pusher', {
      method: 'POST',
      body: JSON.stringify({
        event: 'match_start',
        channel: 'lobby',
        data: {
          roomId: `room_${Date.now()}`,
          players: [myUser, { username: 'Waiting...' }] // ระบบจำลอง
        }
      })
    });
  };

  // ... (UI เหมือนเดิมทั้งหมด) ...
  return (
    <div className="min-h-screen bg-[#13131a] text-white p-4 flex flex-col font-sans">
      {/* ส่วน Header, Chart และ Scoreboard เหมือนโค้ดเดิมที่คุณมี */}
      {gameState === 'LOBBY' || gameState === 'SEARCHING' ? (
        <div className="flex flex-col items-center justify-center h-full gap-6">
          <Trophy className="text-yellow-500 w-20 h-20" />
          <h1 className="text-4xl font-bold">VS TRAD : VERCEL MODE</h1>
          <button onClick={findMatch} className="bg-blue-600 px-10 py-4 rounded-xl font-bold text-xl active:scale-95">
            {gameState === 'SEARCHING' ? 'SEARCHING...' : 'FIND MATCH'}
          </button>
        </div>
      ) : (
        /* UI Arena ของคุณ */
        <div className="flex flex-col gap-4">
           {/* กราฟและปุ่มกดเทรด */}
           <TradingChart onPriceChange={(p) => setCurrentPrice(p)} />
           <div className="text-center font-mono text-2xl">Time: {timeLeft}s</div>
           {isGameOver && <div className="text-5xl text-center">GAME OVER!</div>}
        </div>
      )}
    </div>
  );
}