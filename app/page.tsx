"use client";

import { useState, useCallback, useEffect } from "react";
import Pusher from "pusher-js";
import TradingChart from "@/components/TradingChart";
import { Trophy, Loader2, Swords, Clock, XCircle, Wallet, Snowflake } from "lucide-react";

export default function ArenaPage() {
  const [gameState, setGameState] = useState<'LOBBY' | 'SEARCHING' | 'ARENA'>('LOBBY');
  const [myUser, setMyUser] = useState<any>(null);
  const [opponent, setOpponent] = useState<any>(null);
  const [balance, setBalance] = useState(0);
  const [timeLeft, setTimeLeft] = useState(300);
  const [isGameOver, setIsGameOver] = useState(false);
  const [roomId, setRoomId] = useState("");
  
  const [currentPrice, setCurrentPrice] = useState(0);
  const [position, setPosition] = useState<'NONE' | 'LONG' | 'SHORT'>('NONE');
  const [entryPrice, setEntryPrice] = useState(0);
  const [unrealizedPnl, setUnrealizedPnl] = useState(0);

  useEffect(() => {
    const name = localStorage.getItem('vstrad_user') || `Trader_${Math.floor(Math.random() * 1000)}`;
    localStorage.setItem('vstrad_user', name);
    setMyUser({ username: name });
  }, []);

  // ฟังก์ชันบันทึกเงินลง DB
  const saveGameResult = async (finalPnl: number) => {
    const isWin = finalPnl > (opponent?.currentPnl || 0);
    try {
      const res = await fetch('/api/game/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: myUser.username, pnl: finalPnl, isWin })
      });
      const data = await res.json();
      if (data.success) setBalance(data.newBalance);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (!roomId || gameState !== 'ARENA') return;
    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, { cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER! });
    const channel = pusher.subscribe(roomId);
    
    channel.bind('opponent-update', (data: any) => {
      if (data.username !== myUser?.username) setOpponent((prev: any) => ({ ...prev, currentPnl: data.pnl }));
    });

    const timer = setInterval(() => {
      setTimeLeft(p => {
        if (p <= 1) {
          clearInterval(timer);
          setIsGameOver(true);
          return 0;
        }
        return p - 1;
      });
    }, 1000);

    return () => { pusher.unsubscribe(roomId); clearInterval(timer); };
  }, [roomId, gameState]);

  // เมื่อเกมจบ (เวลาหมด) ให้เซฟเงิน
  useEffect(() => {
    if (isGameOver && gameState === 'ARENA') {
      saveGameResult(unrealizedPnl);
    }
  }, [isGameOver]);

  const findMatch = async () => {
    setGameState('SEARCHING');
    const res = await fetch('/api/matchmake', { method: 'POST', body: JSON.stringify({ username: myUser.username }) });
    const data = await res.json();
    setBalance(data.balance); // ดึงเงินจาก DB มาโชว์
    if (data.status === 'matched') {
      setOpponent({ username: data.opponent.username, currentPnl: 0 });
      setRoomId(data.roomId);
      setGameState('ARENA');
    } else {
      const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, { cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER! });
      const lobby = pusher.subscribe('lobby-channel');
      lobby.bind(`matched-${myUser.username}`, (d: any) => {
        setOpponent({ username: d.opponent.username, currentPnl: 0 });
        setRoomId(d.roomId);
        setGameState('ARENA');
        setBalance(d.balance);
        pusher.unsubscribe('lobby-channel');
      });
    }
  };

  // UI ส่วนที่โชว์ยอดเงินใน Lobby
  if (gameState !== 'ARENA' && !isGameOver) {
    return (
      <div className="min-h-screen bg-[#0f0f15] text-white flex flex-col items-center justify-center p-4">
        <div className="bg-green-500/10 px-6 py-2 rounded-full border border-green-500/20 text-green-400 font-bold mb-4 flex items-center gap-2">
          <Wallet size={18} /> Balance: ${balance.toFixed(2)}
        </div>
        <h1 className="text-6xl font-black mb-10 italic text-blue-500">VS TRAD</h1>
        {gameState === 'LOBBY' ? (
          <button onClick={findMatch} className="bg-blue-600 px-12 py-5 rounded-2xl font-black text-2xl active:scale-95 shadow-xl shadow-blue-900/40">FIND MATCH</button>
        ) : (
          <div className="flex flex-col items-center gap-4"><Loader2 className="animate-spin w-10 h-10" /><p>Searching for players...</p></div>
        )}
      </div>
    );
  }

  // UI ส่วน Arena และ Game Over (เหมือนเดิมที่คุณมี แต่เพิ่มการโชว์ Balance)
  return (
    <div className="min-h-screen bg-[#13131a] text-white p-4">
      {/* ... โค้ด Arena เดิมของคุณ ... */}
      {isGameOver && (
        <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-50">
          <Trophy size={80} className="text-yellow-500 mb-4" />
          <h2 className="text-5xl font-black mb-4">MATCH ENDED</h2>
          <p className="text-xl mb-8">New Balance: <span className="text-green-400">${balance.toFixed(2)}</span></p>
          <button onClick={() => window.location.reload()} className="bg-white text-black px-10 py-4 rounded-xl font-bold">LOBBY</button>
        </div>
      )}
      
      {/* ส่วนเทรด */}
      {!isGameOver && (
        <div className="max-w-6xl mx-auto flex flex-col gap-4">
            <div className="flex justify-between bg-[#1e1e24] p-4 rounded-2xl border border-gray-800">
                <span className="font-mono text-red-400 text-xl font-bold"><Clock className="inline mr-2" /> {Math.floor(timeLeft/60)}:{(timeLeft%60).toString().padStart(2,'0')}</span>
                <div className="flex gap-4">
                    <div className="text-green-400">YOU: {unrealizedPnl.toFixed(2)}</div>
                    <div className="text-blue-400">ENEMY: {opponent?.currentPnl?.toFixed(2) || '0.00'}</div>
                </div>
            </div>
            <div className="h-[60vh] bg-[#1e1e24] rounded-2xl border border-gray-800 overflow-hidden relative">
                <TradingChart onPriceChange={(p) => {
                    setCurrentPrice(p);
                    if (position === 'LONG') setUnrealizedPnl((p - entryPrice) * 10);
                    if (position === 'SHORT') setUnrealizedPnl((entryPrice - p) * 10);
                }} />
            </div>
            <div className="flex gap-4">
                <button onClick={() => {setPosition('SHORT'); setEntryPrice(currentPrice);}} className="flex-1 bg-red-600 py-6 rounded-2xl font-black text-2xl">SELL</button>
                <button onClick={() => {setPosition('LONG'); setEntryPrice(currentPrice);}} className="flex-1 bg-green-600 py-6 rounded-2xl font-black text-2xl">BUY</button>
            </div>
        </div>
      )}
    </div>
  );
}