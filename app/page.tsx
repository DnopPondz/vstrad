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
    setMyUser({ username: `Trader_${Math.floor(Math.random() * 1000)}` });
  }, []);

  useEffect(() => {
    if (!roomId || gameState !== 'ARENA') return;
    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, { cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER! });
    const channel = pusher.subscribe(roomId);
    channel.bind('opponent-update', (data: any) => {
      if (data.username !== myUser?.username) setOpponent((prev: any) => ({ ...prev, currentPnl: data.pnl }));
    });
    const timer = setInterval(() => setTimeLeft(p => p <= 1 ? (setIsGameOver(true), 0) : p - 1), 1000);
    return () => { pusher.unsubscribe(roomId); clearInterval(timer); };
  }, [roomId, gameState, myUser?.username]);

  useEffect(() => {
    if (gameState === 'ARENA' && !isGameOver) {
      let pnl = position === 'LONG' ? (currentPrice - entryPrice) * 10 : position === 'SHORT' ? (entryPrice - currentPrice) * 10 : 0;
      setUnrealizedPnl(pnl);
      fetch('/api/pusher', { method: 'POST', body: JSON.stringify({ event: 'opponent-update', channel: roomId, data: { username: myUser?.username, pnl } }) });
    }
  }, [currentPrice, position, entryPrice, gameState, isGameOver, roomId, myUser?.username]);

  const findMatch = async () => {
    setGameState('SEARCHING');
    const res = await fetch('/api/matchmake', { method: 'POST', body: JSON.stringify({ username: myUser.username }) });
    const data = await res.json();
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
        pusher.unsubscribe('lobby-channel');
      });
    }
  };

  if (isGameOver) return <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center"><h2>GAME OVER</h2><button onClick={() => window.location.reload()}>RETRY</button></div>;

  return (
    <div className="min-h-screen bg-[#13131a] text-white p-4">
      {gameState !== 'ARENA' ? (
        <div className="flex flex-col items-center justify-center h-[80vh]">
          <Trophy className="text-yellow-500 w-20 h-20 mb-4" />
          <h1 className="text-4xl font-bold mb-8">VS TRAD</h1>
          {gameState === 'LOBBY' ? (
            <button onClick={findMatch} className="bg-blue-600 px-12 py-4 rounded-xl font-bold text-xl flex items-center gap-2"><Swords /> FIND MATCH</button>
          ) : (
            <div className="flex flex-col items-center gap-4"><Loader2 className="animate-spin" /><p>Searching for real player...</p></div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center bg-[#1e1e24] p-4 rounded-xl border border-gray-800">
            <span className="text-red-400 font-mono text-xl font-bold"><Clock className="inline mr-2" /> {Math.floor(timeLeft/60)}:{(timeLeft%60).toString().padStart(2,'0')}</span>
            <div className="flex gap-4">
              <div className="bg-green-500/10 p-2 rounded-lg border border-green-500/20 text-green-400">YOU: {unrealizedPnl.toFixed(2)}</div>
              <div className="bg-blue-500/10 p-2 rounded-lg border border-blue-500/20 text-blue-400">{opponent?.username}: {opponent?.currentPnl?.toFixed(2) || '0.00'}</div>
            </div>
          </div>
          <div className="h-[60vh] bg-[#1e1e24] rounded-xl border border-gray-800 p-2 relative">
            <TradingChart onPriceChange={setCurrentPrice} />
          </div>
          <div className="flex gap-4">
            <button onClick={() => {setPosition('SHORT'); setEntryPrice(currentPrice);}} className="flex-1 bg-red-600 py-6 rounded-xl font-bold text-xl">SELL</button>
            <button onClick={() => {setPosition('LONG'); setEntryPrice(currentPrice);}} className="flex-1 bg-green-600 py-6 rounded-xl font-bold text-xl">BUY</button>
          </div>
        </div>
      )}
    </div>
  );
}