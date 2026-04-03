// app/page.tsx
"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import TradingChart from "@/components/TradingChart";
import { TrendingUp, TrendingDown, Users, Trophy, XCircle, Loader2, Swords, Clock } from "lucide-react";

type GameState = 'LOBBY' | 'SEARCHING' | 'ARENA';

export default function ArenaPage() {
  const [gameState, setGameState] = useState<GameState>('LOBBY');
  const [myUser, setMyUser] = useState<any>(null);
  const [opponent, setOpponent] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState<number>(300);
  const [isGameOver, setIsGameOver] = useState(false);

  const socketRef = useRef<Socket | null>(null);

  // Trading States
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [position, setPosition] = useState<'NONE' | 'LONG' | 'SHORT'>('NONE');
  const [entryPrice, setEntryPrice] = useState<number>(0);
  const [unrealizedPnl, setUnrealizedPnl] = useState<number>(0);
  const [balance, setBalance] = useState<number>(1000);

  useEffect(() => {
    if (!socketRef.current) {
      const socket = io();
      socketRef.current = socket;

      socket.on("connect", () => {
        const randomName = `Trader_${Math.floor(Math.random() * 1000)}`;
        socket.emit("login", randomName);
      });

      socket.on("login_success", (userData) => {
        setMyUser(userData);
        setBalance(userData.balance);
      });

      socket.on("match_found", (data) => {
        setMyUser((prev: any) => {
          const enemy = data.players.find((p: any) => p.username !== prev?.username);
          if (enemy) setOpponent({ ...enemy, currentPnl: 0 });
          return prev;
        });
        setTimeLeft(data.timeLeft);
        setGameState('ARENA');
      });

      socket.on("opponent_pnl", (data) => {
        setOpponent((prev: any) => (prev ? { ...prev, currentPnl: data.pnl } : prev));
      });

      socket.on("timer_update", (time: number) => setTimeLeft(time));
      socket.on("game_over", () => setIsGameOver(true));
    }
    return () => { socketRef.current?.disconnect(); socketRef.current = null; };
  }, []);

  // ส่งคะแนนให้คู่แข่งเมื่อ PnL เปลี่ยน
  useEffect(() => {
    let pnl = 0;
    if (position === 'LONG') pnl = (currentPrice - entryPrice) * 10;
    else if (position === 'SHORT') pnl = (entryPrice - currentPrice) * 10;
    setUnrealizedPnl(pnl);

    if (socketRef.current && gameState === 'ARENA' && !isGameOver) {
      socketRef.current.emit('update_pnl', { pnl, username: myUser?.username });
    }
  }, [currentPrice, position, entryPrice, gameState, myUser?.username, isGameOver]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  const handlePriceChange = useCallback((p: number) => setCurrentPrice(p), []);

  if (isGameOver) {
    const win = unrealizedPnl > (opponent?.currentPnl || 0);
    return (
      <div className="fixed inset-0 bg-black/95 flex flex-col items-center justify-center z-50 p-6 text-white text-center">
        <Trophy className={`w-20 h-20 mb-4 ${win ? 'text-yellow-500' : 'text-gray-600'}`} />
        <h2 className="text-6xl font-black mb-6">{win ? "YOU WIN!" : "YOU LOSE!"}</h2>
        <div className="bg-[#1e1e24] p-8 rounded-3xl w-full max-w-sm border border-gray-800">
          <p className="text-gray-400 mb-4">Final Score</p>
          <div className="flex justify-between mb-2"><span>You:</span><span className="font-bold text-green-400">${unrealizedPnl.toFixed(2)}</span></div>
          <div className="flex justify-between mb-8"><span>Opponent:</span><span className="font-bold text-red-400">${(opponent?.currentPnl || 0).toFixed(2)}</span></div>
          <button onClick={() => window.location.reload()} className="w-full bg-white text-black py-4 rounded-xl font-bold">PLAY AGAIN</button>
        </div>
      </div>
    );
  }

  if (gameState !== 'ARENA') {
    return (
      <div className="min-h-screen bg-[#13131a] text-white flex flex-col items-center justify-center p-4">
        <Trophy className="text-yellow-500 w-16 h-16 mb-4" />
        <h1 className="text-4xl font-bold mb-8">VS TRAD</h1>
        <div className="bg-[#1e1e24] p-8 rounded-3xl border border-gray-800 w-full max-w-sm text-center shadow-2xl">
          <p className="text-blue-400 font-bold mb-2">{myUser?.username || 'Connecting...'}</p>
          <p className="text-3xl font-mono text-green-400 mb-8">${balance.toFixed(2)}</p>
          {gameState === 'LOBBY' ? (
            <button onClick={() => socketRef.current?.emit('find_match', myUser)} className="w-full bg-blue-600 py-4 rounded-xl font-bold text-xl active:scale-95 transition-all">FIND MATCH</button>
          ) : (
            <div className="flex flex-col items-center gap-4 text-blue-400"><Loader2 className="animate-spin" /><p className="animate-pulse">Searching...</p></div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#13131a] text-white p-4 flex flex-col">
      <header className="flex justify-between items-center bg-[#1e1e24] p-4 rounded-2xl border border-gray-800 mb-4">
        <div className="flex items-center gap-2 font-bold tracking-widest text-xs uppercase"><Trophy className="w-4 h-4 text-yellow-500" /> Arena Match</div>
        <div className="bg-black/40 px-6 py-2 rounded-xl border border-red-500/20 font-mono text-red-400 font-bold flex items-center gap-2"><Clock className="w-4 h-4" /> {formatTime(timeLeft)}</div>
      </header>
      <div className="flex flex-1 gap-4 overflow-hidden">
        <div className="flex-[3] bg-[#1e1e24] rounded-2xl border border-gray-800 p-2 flex flex-col">
          <div className="flex justify-between items-center px-4 py-2 border-b border-gray-800 mb-2 font-mono font-bold text-xl">BTC/USDT: {currentPrice.toFixed(2)}</div>
          <div className="flex-1 relative"><TradingChart onPriceChange={handlePriceChange} /></div>
        </div>
        <div className="flex-[1] flex flex-col gap-4">
          <div className="flex-1 bg-[#1e1e24] rounded-2xl border border-gray-800 p-4">
            <h3 className="text-gray-500 text-[10px] font-black uppercase mb-4 tracking-widest">Leaderboard</h3>
            <div className="space-y-3">
              <div className="flex justify-between p-4 rounded-xl border border-green-500/20 bg-green-500/5"><span className="text-sm font-bold">YOU</span><span className={`font-bold ${unrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>{unrealizedPnl.toFixed(2)}</span></div>
              <div className="flex justify-between p-4 rounded-xl border border-gray-700 bg-gray-800/20"><span className="text-sm opacity-50">{opponent?.username || 'Opponent'}</span><span className={`font-bold ${(opponent?.currentPnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>{(opponent?.currentPnl || 0).toFixed(2)}</span></div>
            </div>
          </div>
          <div className="bg-[#1e1e24] rounded-2xl border border-gray-800 p-4">
            {position === 'NONE' ? (
              <div className="flex gap-3 h-20">
                <button onClick={() => { setPosition('SHORT'); setEntryPrice(currentPrice); }} className="flex-1 bg-red-600/10 text-red-500 border border-red-500/30 rounded-xl font-black text-lg">SELL</button>
                <button onClick={() => { setPosition('LONG'); setEntryPrice(currentPrice); }} className="flex-1 bg-green-600/10 text-green-500 border border-green-500/30 rounded-xl font-black text-lg">BUY</button>
              </div>
            ) : (
              <button onClick={() => { setBalance(b => b + unrealizedPnl); setPosition('NONE'); setUnrealizedPnl(0); }} className="w-full bg-yellow-500/10 text-yellow-500 border border-yellow-500/30 py-6 rounded-xl font-black text-xl flex items-center justify-center gap-2"><XCircle /> CLOSE POSITION</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}