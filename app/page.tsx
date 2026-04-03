"use client";

import { useState, useCallback, useEffect } from "react";
import Pusher from "pusher-js";
import TradingChart from "@/components/TradingChart";
import { Trophy, Loader2, Swords, Clock, XCircle } from "lucide-react";

export default function ArenaPage() {
  const [gameState, setGameState] = useState<'LOBBY' | 'SEARCHING' | 'ARENA'>('LOBBY');
  const [myUser, setMyUser] = useState<any>(null);
  const [opponent, setOpponent] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState(300);
  const [isGameOver, setIsGameOver] = useState(false);
  const [roomId, setRoomId] = useState("");

  const [currentPrice, setCurrentPrice] = useState(0);
  const [position, setPosition] = useState<'NONE' | 'LONG' | 'SHORT'>('NONE');
  const [entryPrice, setEntryPrice] = useState(0);
  const [unrealizedPnl, setUnrealizedPnl] = useState(0);

  useEffect(() => {
    // กำหนดชื่อสุ่มครั้งเดียวเมื่อโหลดหน้า
    const name = `Trader_${Math.floor(Math.random() * 1000)}`;
    setMyUser({ username: name });
  }, []);

  // เมื่อเข้าห้อง Arena
  useEffect(() => {
    if (!roomId || gameState !== 'ARENA') return;

    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    });

    const channel = pusher.subscribe(roomId);
    channel.bind('opponent-update', (data: any) => {
      if (data.username !== myUser?.username) {
        setOpponent((prev: any) => ({ ...prev, currentPnl: data.pnl }));
      }
    });

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

  // ส่ง PnL ไปให้คู่แข่ง
  useEffect(() => {
    if (gameState === 'ARENA' && !isGameOver && roomId) {
      let pnl = 0;
      if (position === 'LONG') pnl = (currentPrice - entryPrice) * 10;
      else if (position === 'SHORT') pnl = (entryPrice - currentPrice) * 10;
      
      setUnrealizedPnl(pnl);

      fetch('/api/pusher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'opponent-update',
          channel: roomId,
          data: { username: myUser?.username, pnl }
        })
      });
    }
  }, [currentPrice, position, entryPrice, gameState, isGameOver, roomId, myUser?.username]);

  const findMatch = async () => {
    if (!myUser) return;
    setGameState('SEARCHING');

    try {
      const res = await fetch('/api/matchmake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: myUser.username }),
      });
      const data = await res.json();

      if (data.status === 'matched') {
        setOpponent({ username: data.opponent.username, currentPnl: 0 });
        setRoomId(data.roomId);
        setGameState('ARENA');
      } else {
        const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
          cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
        });
        const lobby = pusher.subscribe('lobby-channel');
        
        lobby.bind(`matched-${myUser.username}`, (matchData: any) => {
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

  if (isGameOver) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center">
        <Trophy className="w-20 h-20 text-yellow-500 mb-4" />
        <h2 className="text-5xl font-black mb-8">MATCH ENDED</h2>
        <div className="bg-[#1e1e24] p-8 rounded-2xl border border-gray-800 w-full max-w-sm">
          <div className="flex justify-between mb-4"><span>YOU:</span><span className="font-bold text-green-400">${unrealizedPnl.toFixed(2)}</span></div>
          <div className="flex justify-between mb-8"><span>OPPONENT:</span><span className="font-bold text-red-400">${(opponent?.currentPnl || 0).toFixed(2)}</span></div>
          <button onClick={() => window.location.reload()} className="w-full bg-white text-black py-4 rounded-xl font-bold hover:bg-gray-200 transition-all">BACK TO LOBBY</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#13131a] text-white p-4 font-sans">
      {gameState !== 'ARENA' ? (
        <div className="flex flex-col items-center justify-center h-[80vh]">
          <Trophy className="text-yellow-500 w-20 h-20 mb-6 animate-pulse" />
          <h1 className="text-5xl font-black mb-8 tracking-tighter italic">VS TRAD</h1>
          <div className="bg-[#1e1e24] p-8 rounded-3xl border border-gray-800 w-full max-w-sm text-center shadow-2xl">
             <p className="text-blue-400 font-bold mb-4 uppercase tracking-widest">{myUser?.username || 'Connecting...'}</p>
             {gameState === 'LOBBY' ? (
                <button onClick={findMatch} className="w-full bg-blue-600 py-5 rounded-2xl font-black text-xl hover:bg-blue-500 transition-all active:scale-95 shadow-lg shadow-blue-900/20">
                  <Swords className="inline mr-2" /> FIND MATCH
                </button>
             ) : (
                <div className="flex flex-col items-center gap-4 text-blue-400 py-4">
                  <Loader2 className="animate-spin w-10 h-10" />
                  <p className="font-bold animate-pulse">Searching for real player...</p>
                </div>
             )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4 max-w-6xl mx-auto">
          <header className="flex justify-between items-center bg-[#1e1e24] p-4 rounded-2xl border border-gray-800 shadow-lg">
            <div className="flex items-center gap-3 bg-black/40 px-5 py-2 rounded-xl border border-red-500/20 font-mono text-red-400 font-bold">
              <Clock className="w-5 h-5" /> {Math.floor(timeLeft/60)}:{(timeLeft%60).toString().padStart(2,'0')}
            </div>
            <div className="flex gap-4">
               <div className="bg-green-500/10 px-4 py-2 rounded-xl border border-green-500/20 text-green-400 font-bold">YOU: {unrealizedPnl.toFixed(2)}</div>
               <div className="bg-blue-500/10 px-4 py-2 rounded-xl border border-blue-500/20 text-blue-400 font-bold truncate max-w-[150px]">{opponent?.username}: {opponent?.currentPnl?.toFixed(2) || '0.00'}</div>
            </div>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-3 h-[65vh] bg-[#1e1e24] rounded-2xl border border-gray-800 p-2 relative shadow-inner overflow-hidden">
               <div className="absolute top-4 left-4 z-10 bg-black/60 px-3 py-1 rounded text-xs font-mono font-bold border border-white/10">BTC / USDT: {currentPrice.toFixed(2)}</div>
               <TradingChart onPriceChange={setCurrentPrice} />
            </div>

            <div className="flex flex-col gap-4">
              <div className="bg-[#1e1e24] p-6 rounded-2xl border border-gray-800 flex-1 flex flex-col justify-center">
                 <p className="text-gray-500 text-[10px] font-black uppercase mb-4 tracking-widest">Trade Control</p>
                 {position === 'NONE' ? (
                   <div className="flex flex-col gap-3">
                     <button onClick={() => {setPosition('LONG'); setEntryPrice(currentPrice);}} className="bg-green-600 py-6 rounded-2xl font-black text-2xl hover:bg-green-500 transition-all active:scale-95 shadow-lg shadow-green-900/20">BUY</button>
                     <button onClick={() => {setPosition('SHORT'); setEntryPrice(currentPrice);}} className="bg-red-600 py-6 rounded-2xl font-black text-2xl hover:bg-red-500 transition-all active:scale-95 shadow-lg shadow-red-900/20">SELL</button>
                   </div>
                 ) : (
                   <button onClick={() => {setPosition('NONE'); setUnrealizedPnl(0);}} className="w-full bg-yellow-600/10 text-yellow-500 border border-yellow-500/30 py-8 rounded-2xl font-black text-xl flex items-center justify-center gap-2 hover:bg-yellow-500/20 transition-all active:scale-95">
                     <XCircle className="w-6 h-6" /> CLOSE POSITION
                   </button>
                 )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}