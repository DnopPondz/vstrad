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

  // 1. การเชื่อมต่อ WebSocket และ Listeners
  useEffect(() => {
    if (!socketRef.current) {
      // ใน Production (Railway/Render) ไม่ต้องระบุ URL ถ้าใช้โดเมนเดียวกัน
      const socket = io(); 
      socketRef.current = socket;

      socket.on("connect", () => {
        console.log("Connected to Server:", socket.id);
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
      
      socket.on("game_over", () => {
        setIsGameOver(true);
      });
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  // 2. การคำนวณ PnL และส่งข้อมูล Real-time
  useEffect(() => {
    let pnl = 0;
    if (position === 'LONG') pnl = (currentPrice - entryPrice) * 10;
    else if (position === 'SHORT') pnl = (entryPrice - currentPrice) * 10;
    
    setUnrealizedPnl(pnl);

    // ส่งคะแนนให้คู่แข่งเห็น
    if (socketRef.current && gameState === 'ARENA' && !isGameOver) {
      socketRef.current.emit('update_pnl', { 
        pnl: pnl, 
        username: myUser?.username 
      });
    }
  }, [currentPrice, position, entryPrice, gameState, myUser?.username, isGameOver]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  
  const handlePriceChange = useCallback((p: number) => {
    setCurrentPrice(p);
  }, []);

  const handleClosePosition = () => {
    setBalance(prev => prev + unrealizedPnl);
    setPosition('NONE');
    setEntryPrice(0);
    setUnrealizedPnl(0);
  };

  // UI: หน้าจอ Game Over
  if (isGameOver) {
    const opponentPnl = opponent?.currentPnl || 0;
    const win = unrealizedPnl > opponentPnl;
    return (
      <div className="fixed inset-0 bg-black/95 flex flex-col items-center justify-center z-50 p-6 text-white">
        <Trophy className={`w-20 h-20 mb-4 ${win ? 'text-yellow-500 animate-bounce' : 'text-gray-600'}`} />
        <h2 className="text-6xl font-black mb-6 tracking-tighter">{win ? "YOU WIN!" : "YOU LOSE!"}</h2>
        <div className="bg-[#1e1e24] p-8 rounded-3xl w-full max-w-sm border border-gray-800 shadow-2xl">
          <div className="flex justify-between mb-4 text-gray-400 uppercase text-xs font-bold"><span>Result</span></div>
          <div className="flex justify-between mb-2"><span>Your PnL:</span><span className={`font-bold ${unrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>${unrealizedPnl.toFixed(2)}</span></div>
          <div className="flex justify-between mb-8"><span>Opponent:</span><span className={`font-bold ${opponentPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>${opponentPnl.toFixed(2)}</span></div>
          <button onClick={() => window.location.reload()} className="w-full bg-white text-black py-4 rounded-xl font-bold hover:bg-gray-200 transition-all">PLAY AGAIN</button>
        </div>
      </div>
    );
  }

  // UI: หน้าจอ Lobby / Searching
  if (gameState !== 'ARENA') {
    return (
      <div className="min-h-screen bg-[#13131a] text-white flex flex-col items-center justify-center p-4">
        <Trophy className="text-yellow-500 w-16 h-16 mb-4" />
        <h1 className="text-4xl font-bold mb-8 tracking-tighter">VS TRAD</h1>
        <div className="bg-[#1e1e24] p-8 rounded-3xl border border-gray-800 w-full max-w-sm text-center shadow-2xl">
          <p className="text-blue-400 font-bold mb-2 uppercase text-xs tracking-widest">{myUser?.username || 'Connecting...'}</p>
          <p className="text-3xl font-mono text-green-400 mb-8">${balance.toFixed(2)}</p>
          {gameState === 'LOBBY' ? (
            <button 
              onClick={() => socketRef.current?.emit('find_match', myUser)} 
              className="w-full bg-blue-600 py-4 rounded-xl font-bold text-xl hover:bg-blue-500 active:scale-95 transition-all shadow-lg shadow-blue-900/20"
            >
              FIND MATCH
            </button>
          ) : (
            <div className="flex flex-col items-center gap-4 text-blue-400">
              <Loader2 className="animate-spin w-8 h-8" />
              <p className="animate-pulse">Searching for opponent...</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // UI: หน้าจอ Arena (Battle)
  return (
    <div className="min-h-screen bg-[#13131a] text-white p-4 flex flex-col">
      <header className="flex justify-between items-center bg-[#1e1e24] p-4 rounded-2xl border border-gray-800 mb-4 shadow-lg">
        <div className="flex items-center gap-2 font-bold tracking-widest text-xs uppercase"><Trophy className="w-4 h-4 text-yellow-500" /> Arena Match</div>
        <div className="bg-black/40 px-6 py-2 rounded-xl border border-red-500/20 font-mono text-red-400 font-bold flex items-center gap-2">
          <Clock className="w-4 h-4" /> {formatTime(timeLeft)}
        </div>
      </header>

      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* Chart */}
        <div className="flex-[3] bg-[#1e1e24] rounded-2xl border border-gray-800 p-2 flex flex-col shadow-xl">
          <div className="flex justify-between items-center px-4 py-2 border-b border-gray-800 mb-2 font-mono font-bold text-xl">
            BTC/USDT: <span className="text-white">{currentPrice.toFixed(2)}</span>
          </div>
          <div className="flex-1 relative">
            <TradingChart onPriceChange={handlePriceChange} />
          </div>
        </div>

        {/* Sidebar */}
        <div className="flex-[1] flex flex-col gap-4">
          <div className="flex-1 bg-[#1e1e24] rounded-2xl border border-gray-800 p-4 shadow-xl">
            <h3 className="text-gray-500 text-[10px] font-black uppercase mb-4 tracking-widest">Scoreboard</h3>
            <div className="space-y-3">
              <div className={`flex justify-between p-4 rounded-xl border transition-colors ${unrealizedPnl >= 0 ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                <span className="text-sm font-bold">YOU</span>
                <span className={`font-mono font-bold ${unrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {unrealizedPnl >= 0 ? '+' : ''}{unrealizedPnl.toFixed(2)}
                </span>
              </div>
              <div className={`flex justify-between p-4 rounded-xl border transition-colors ${(opponent?.currentPnl || 0) >= 0 ? 'bg-blue-500/5 border-gray-700' : 'bg-red-500/5 border-gray-700'}`}>
                <span className="text-sm opacity-50 truncate max-w-[80px]">{opponent?.username || 'Opponent'}</span>
                <span className={`font-mono font-bold ${(opponent?.currentPnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {(opponent?.currentPnl || 0) >= 0 ? '+' : ''}{(opponent?.currentPnl || 0).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-[#1e1e24] rounded-2xl border border-gray-800 p-4 shadow-xl">
            {position === 'NONE' ? (
              <div className="flex gap-3 h-20">
                <button onClick={() => { setPosition('SHORT'); setEntryPrice(currentPrice); }} className="flex-1 bg-red-600/10 text-red-500 border border-red-500/30 rounded-xl font-black text-lg hover:bg-red-600/20 transition-all">SELL</button>
                <button onClick={() => { setPosition('LONG'); setEntryPrice(currentPrice); }} className="flex-1 bg-green-600/10 text-green-500 border border-green-500/30 rounded-xl font-black text-lg hover:bg-green-600/20 transition-all">BUY</button>
              </div>
            ) : (
              <button onClick={handleClosePosition} className="w-full bg-yellow-500/10 text-yellow-500 border border-yellow-500/30 py-6 rounded-xl font-black text-xl flex items-center justify-center gap-2 hover:bg-yellow-500/20 transition-all active:scale-95">
                <XCircle /> CLOSE POSITION
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}