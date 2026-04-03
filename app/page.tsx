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

  // 1. Initial Setup: จำลอง Login เมื่อเปิดหน้าเว็บ
  useEffect(() => {
    const name = `Trader_${Math.floor(Math.random() * 1000)}`;
    setMyUser({ username: name, balance: 1000 });
  }, []);

  // 2. Arena Match: เมื่อจับคู่ได้แล้ว ให้ฟังคะแนนจากคู่แข่งและเริ่มนับเวลา
  useEffect(() => {
    if (!roomId || gameState !== 'ARENA') return;

    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    });

    const channel = pusher.subscribe(roomId);

    // รับคะแนน Real-time จากคู่แข่ง
    channel.bind('opponent-update', (data: any) => {
      if (data.username !== myUser?.username) {
        setOpponent((prev: any) => prev ? { ...prev, currentPnl: data.pnl } : prev);
      }
    });

    // ตัวนับเวลาถอยหลัง (ฝั่ง Client)
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
  }, [roomId, gameState, myUser?.username]);

  // 3. Sync PnL: ส่งคะแนนของเราไปให้คู่แข่งผ่าน API Pusher
  useEffect(() => {
    if (gameState === 'ARENA' && !isGameOver && roomId) {
      let pnl = 0;
      if (position === 'LONG') pnl = (currentPrice - entryPrice) * 10;
      else if (position === 'SHORT') pnl = (entryPrice - currentPrice) * 10;
      setUnrealizedPnl(pnl);

      // ส่งคะแนนผ่าน API Route (เพื่อให้ Pusher กระจายต่อ)
      fetch('/api/pusher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'opponent-update',
          channel: roomId,
          data: { username: myUser?.username, pnl: pnl }
        })
      });
    }
  }, [currentPrice, position, entryPrice, gameState, isGameOver, roomId, myUser?.username]);

  // 4. Matchmaking: ค้นหาคนเล่นจริงๆ จากคิวใน MongoDB
  const findMatch = async () => {
    if (!myUser) return;
    setGameState('SEARCHING');

    try {
      // เรียก API Matchmake เพื่อลงคิวหรือจับคู่
      const res = await fetch('/api/matchmake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: myUser.username }),
      });
      const data = await res.json();

      if (data.status === 'matched') {
        // กรณีเรามาทีหลังและจับคู่ได้ทันที
        setOpponent({ username: data.opponent.username, currentPnl: 0 });
        setRoomId(data.roomId);
        setGameState('ARENA');
      } else {
        // กรณีเราเป็นคนแรกที่รอ -> ต้องฟัง Pusher ว่าจะมีคนมาจอยไหม
        const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
          cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
        });
        
        const lobbyChannel = pusher.subscribe('lobby-channel');
        
        // ฟัง Event เฉพาะชื่อของเรา (matched-ชื่อเรา)
        lobbyChannel.bind(`matched-${myUser.username}`, (matchData: any) => {
          setOpponent({ username: matchData.opponent.username, currentPnl: 0 });
          setRoomId(matchData.roomId);
          setGameState('ARENA');
          pusher.unsubscribe('lobby-channel');
        });
      }
    } catch (error) {
      console.error("Matchmaking error:", error);
      setGameState('LOBBY');
    }
  };

  const handlePriceChange = useCallback((p: number) => setCurrentPrice(p), []);

  // UI: หน้าจอ Game Over
  if (isGameOver) {
    const oppPnl = opponent?.currentPnl || 0;
    const win = unrealizedPnl > oppPnl;
    return (
      <div className="fixed inset-0 bg-black/95 flex flex-col items-center justify-center z-50 p-6 text-white text-center">
        <Trophy className={`w-24 h-24 mb-6 ${win ? 'text-yellow-500 animate-bounce' : 'text-gray-700'}`} />
        <h2 className="text-6xl font-black mb-4 tracking-tighter">{win ? "YOU WIN!" : "YOU LOSE!"}</h2>
        <div className="bg-[#1e1e24] p-8 rounded-3xl w-full max-w-md border border-gray-800 shadow-2xl space-y-4">
          <div className="flex justify-between"><span>Your PnL:</span><span className={unrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}>${unrealizedPnl.toFixed(2)}</span></div>
          <div className="flex justify-between"><span>Opponent:</span><span className={oppPnl >= 0 ? 'text-green-400' : 'text-red-400'}>${oppPnl.toFixed(2)}</span></div>
          <button onClick={() => window.location.reload()} className="w-full bg-white text-black py-4 rounded-2xl font-bold mt-4">PLAY AGAIN</button>
        </div>
      </div>
    );
  }

  // UI: หน้าจอ Lobby / Searching
  if (gameState !== 'ARENA') {
    return (
      <div className="min-h-screen bg-[#13131a] text-white flex flex-col items-center justify-center p-4">
        <Trophy className="text-yellow-500 w-20 h-20 mb-6" />
        <h1 className="text-4xl font-bold mb-8">VS TRAD</h1>
        <div className="bg-[#1e1e24] p-8 rounded-3xl border border-gray-800 w-full max-w-sm text-center">
          <p className="text-blue-400 font-bold mb-2 uppercase text-xs tracking-widest">{myUser?.username || 'Connecting...'}</p>
          <p className="text-3xl font-mono text-green-400 mb-8">${balance.toFixed(2)}</p>
          {gameState === 'LOBBY' ? (
            <button onClick={findMatch} className="w-full bg-blue-600 py-4 rounded-xl font-bold text-xl hover:bg-blue-500 active:scale-95 transition-all">
              <Swords className="inline mr-2" /> FIND MATCH
            </button>
          ) : (
            <div className="flex flex-col items-center gap-4 text-blue-400">
              <Loader2 className="animate-spin" />
              <p className="animate-pulse">Searching for real player...</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // UI: หน้าจอ Arena (Battle)
  return (
    <div className="min-h-screen bg-[#13131a] text-white p-4 flex flex-col overflow-hidden">
      <header className="flex justify-between items-center bg-[#1e1e24] p-4 rounded-2xl border border-gray-800 mb-4">
        <div className="flex items-center gap-2 font-bold uppercase text-xs tracking-widest text-yellow-500"><Trophy className="w-4 h-4" /> Arena Match</div>
        <div className="bg-black/40 px-6 py-2 rounded-xl border border-red-500/20 font-mono text-red-400 font-bold flex items-center gap-2">
          <Clock className="w-4 h-4" /> {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
        </div>
      </header>

      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* Left: Chart */}
        <div className="flex-[3] bg-[#1e1e24] rounded-2xl border border-gray-800 p-2 flex flex-col">
          <div className="flex justify-between items-center px-4 py-2 border-b border-gray-800 mb-2 font-mono font-bold text-xl">
            BTC/USDT: {currentPrice.toFixed(2)}
          </div>
          <div className="flex-1 relative">
            <TradingChart onPriceChange={handlePriceChange} />
          </div>
        </div>

        {/* Right: Scoreboard & Actions */}
        <div className="flex-[1] flex flex-col gap-4">
          <div className="flex-1 bg-[#1e1e24] rounded-2xl border border-gray-800 p-4">
            <h3 className="text-gray-500 text-[10px] font-black uppercase mb-4 tracking-widest">Live Score</h3>
            <div className="space-y-3">
              <div className={`flex justify-between p-4 rounded-xl border ${unrealizedPnl >= 0 ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                <span className="text-xs font-bold uppercase">You</span>
                <span className={`font-mono font-bold ${unrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {unrealizedPnl.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between p-4 rounded-xl border border-gray-700 bg-gray-800/20">
                <span className="text-xs font-bold uppercase opacity-50 truncate max-w-[80px]">{opponent?.username}</span>
                <span className={`font-mono font-bold ${(opponent?.currentPnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {(opponent?.currentPnl || 0).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-[#1e1e24] rounded-2xl border border-gray-800 p-4">
            {position === 'NONE' ? (
              <div className="flex gap-3 h-20">
                <button onClick={() => { setPosition('SHORT'); setEntryPrice(currentPrice); }} className="flex-1 bg-red-600/10 text-red-500 border border-red-500/30 rounded-xl font-black text-lg hover:bg-red-600/20 transition-all">SELL</button>
                <button onClick={() => { setPosition('LONG'); setEntryPrice(currentPrice); }} className="flex-1 bg-green-600/10 text-green-500 border border-green-500/30 rounded-xl font-black text-lg hover:bg-green-600/20 transition-all">BUY</button>
              </div>
            ) : (
              <button onClick={() => { setBalance(b => b + unrealizedPnl); setPosition('NONE'); setUnrealizedPnl(0); }} className="w-full bg-yellow-500/10 text-yellow-500 border border-yellow-500/30 py-6 rounded-xl font-black text-xl flex items-center justify-center gap-2 hover:bg-yellow-500/20 transition-all active:scale-95"><XCircle /> CLOSE POSITION</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}