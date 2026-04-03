"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import TradingChart from "@/components/TradingChart";
import { TrendingUp, TrendingDown, Users, Trophy, XCircle, Loader2, Swords } from "lucide-react";

type GameState = 'LOBBY' | 'SEARCHING' | 'ARENA';

export default function ArenaPage() {
  const [gameState, setGameState] = useState<GameState>('LOBBY');
  const [myUser, setMyUser] = useState<any>(null);
  const [opponent, setOpponent] = useState<any>(null);

  const socketRef = useRef<Socket | null>(null);

  // Trading States
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [position, setPosition] = useState<'NONE' | 'LONG' | 'SHORT'>('NONE');
  const [entryPrice, setEntryPrice] = useState<number>(0);
  const [unrealizedPnl, setUnrealizedPnl] = useState<number>(0);
  const [balance, setBalance] = useState<number>(1000);

  // 1. WebSocket Connection & Event Listeners
  useEffect(() => {
    if (!socketRef.current) {
      const socket = io("http://localhost:3000");
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

      // เมื่อจับคู่สำเร็จ
      socket.on("match_found", (data) => {
        setMyUser((currentMyUser: any) => {
          const enemy = data.players.find((p: any) => p.username !== currentMyUser?.username);
          if (enemy) {
            // ตั้งค่าเริ่มต้นให้คู่แข่งมี PnL เป็น 0
            setOpponent({ ...enemy, currentPnl: 0 });
          }
          return currentMyUser;
        });
        setGameState('ARENA');
      });

      // 🌟 ส่วนสำคัญ: รับคะแนน Real-time จากคู่แข่ง
      socket.on("opponent_pnl", (data) => {
        setOpponent((prev: any) => {
          if (!prev) return prev;
          // อัปเดตเฉพาะค่า PnL ของคู่แข่งใน State
          return { ...prev, currentPnl: data.pnl };
        });
      });
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  // 2. คำนวณ PnL ของเรา และส่งไปให้เซิร์ฟเวอร์ (เพื่อส่งต่อให้คู่แข่ง)
  useEffect(() => {
    let pnl = 0;
    if (position === 'LONG') {
      pnl = (currentPrice - entryPrice) * 10;
    } else if (position === 'SHORT') {
      pnl = (entryPrice - currentPrice) * 10;
    }
    
    setUnrealizedPnl(pnl);

    // 🌟 ส่งค่า PnL ของเราไปให้เซิร์ฟเวอร์
    if (socketRef.current && gameState === 'ARENA') {
      socketRef.current.emit('update_pnl', {
        pnl: pnl,
        username: myUser?.username
      });
    }
  }, [currentPrice, position, entryPrice, gameState, myUser?.username]);

  const findMatch = () => {
    if (socketRef.current && myUser) {
      setGameState('SEARCHING');
      socketRef.current.emit('find_match', myUser);
    }
  };

  const handlePriceChange = useCallback((price: number) => {
    setCurrentPrice(price);
  }, []);

  const handleOpenLong = () => { setPosition('LONG'); setEntryPrice(currentPrice); };
  const handleOpenShort = () => { setPosition('SHORT'); setEntryPrice(currentPrice); };
  
  const handleClosePosition = () => {
    setBalance(prev => prev + unrealizedPnl);
    setPosition('NONE');
    setEntryPrice(0);
    setUnrealizedPnl(0);
  };

  // --- UI Logic ---

  if (gameState === 'LOBBY' || gameState === 'SEARCHING') {
    return (
      <div className="min-h-screen bg-[#13131a] text-white flex flex-col items-center justify-center p-4">
        <Trophy className="text-yellow-500 w-20 h-20 mb-6" />
        <h1 className="text-4xl font-bold mb-2 tracking-tighter">VS TRAD</h1>
        <p className="text-gray-400 mb-8">User: <span className="text-blue-400 font-mono">{myUser?.username || 'Connecting...'}</span></p>

        <div className="bg-[#1e1e24] border border-gray-800 p-8 rounded-2xl w-full max-w-md text-center">
          <div className="mb-6 text-2xl font-mono font-bold text-green-400">${balance.toFixed(2)}</div>
          {gameState === 'LOBBY' ? (
            <button onClick={findMatch} className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-xl font-bold text-xl flex items-center justify-center gap-2">
              <Swords /> FIND MATCH
            </button>
          ) : (
            <div className="flex flex-col items-center gap-4 text-blue-400">
              <Loader2 className="animate-spin" />
              <p>Searching for opponent...</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#13131a] text-white p-4 flex flex-col overflow-hidden">
      <header className="flex justify-between items-center bg-[#1e1e24] p-4 rounded-xl border border-gray-800 mb-4">
        <h2 className="font-bold">ARENA MODE</h2>
        <div className="font-mono text-green-400">Wallet: ${balance.toFixed(2)}</div>
      </header>

      <div className="flex flex-1 gap-4 h-full">
        <div className="flex-[3] bg-[#1e1e24] rounded-xl border border-gray-800 p-2 flex flex-col">
          <div className="flex justify-between items-center px-4 py-2 border-b border-gray-800 mb-2 font-mono font-bold text-xl">
             BTC/USDT: {currentPrice.toFixed(2)}
          </div>
          <div className="flex-1 relative">
            <TradingChart onPriceChange={handlePriceChange} />
          </div>
        </div>

        <div className="flex-[1] flex flex-col gap-4">
          <div className="flex-1 bg-[#1e1e24] rounded-xl border border-gray-800 p-4">
            <h3 className="font-bold mb-4 text-gray-400 uppercase text-xs tracking-widest">Scoreboard</h3>
            <div className="space-y-3">
              {/* คะแนนของเรา */}
              <div className={`flex justify-between p-3 rounded-lg border ${unrealizedPnl >= 0 ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                <span className="text-sm font-bold">You</span>
                <span className={`font-mono ${unrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {unrealizedPnl >= 0 ? '+' : ''}{unrealizedPnl.toFixed(2)}
                </span>
              </div>
              
              {/* 🌟 คะแนนคู่แข่ง (โชว์ค่าจริงจาก State) */}
              <div className={`flex justify-between p-3 rounded-lg border ${(opponent?.currentPnl || 0) >= 0 ? 'bg-green-500/5 border-gray-700' : 'bg-red-500/5 border-gray-700'}`}>
                <span className="text-sm">{opponent?.username || 'Opponent'}</span>
                <span className={`font-mono ${(opponent?.currentPnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {opponent?.currentPnl !== undefined ? (opponent.currentPnl >= 0 ? '+' : '') + opponent.currentPnl.toFixed(2) : '0.00'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-[#1e1e24] rounded-xl border border-gray-800 p-4">
            {position === 'NONE' ? (
              <div className="flex gap-3">
                <button onClick={handleOpenShort} className="flex-1 bg-red-600/20 hover:bg-red-600/30 text-red-500 border border-red-500/40 py-4 rounded-xl font-bold">SHORT</button>
                <button onClick={handleOpenLong} className="flex-1 bg-green-600/20 hover:bg-green-600/30 text-green-500 border border-green-500/40 py-4 rounded-xl font-bold">LONG</button>
              </div>
            ) : (
              <button onClick={handleClosePosition} className="w-full bg-orange-600/20 hover:bg-orange-600/30 text-orange-500 border border-orange-500/40 py-4 rounded-xl font-bold">
                CLOSE POSITION ({unrealizedPnl.toFixed(2)})
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}