// app/page.tsx
"use client";
"use client";

import { useState, useCallback, useEffect } from "react";
// 1. นำเข้า io จาก socket.io-client
import { io, Socket } from "socket.io-client"; 
import TradingChart from "@/components/TradingChart";
import { TrendingUp, TrendingDown, Users, Trophy, XCircle } from "lucide-react";

export default function ArenaPage() {
  // ... (State เดิมทั้งหมดปล่อยไว้เหมือนเดิม) ...
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [position, setPosition] = useState<'NONE' | 'LONG' | 'SHORT'>('NONE');
  const [entryPrice, setEntryPrice] = useState<number>(0);
  const [unrealizedPnl, setUnrealizedPnl] = useState<number>(0);
  const [balance, setBalance] = useState<number>(1000);

  // 2. สร้าง useEffect สำหรับต่อ Socket
  useEffect(() => {
    // เชื่อมต่อไปที่เซิร์ฟเวอร์ตัวเอง (พอร์ต 3000)
    const socket: Socket = io("http://localhost:3000");

    socket.on("connect", () => {
      console.log("Connected to Game Server! ID:", socket.id);
      
      // พอกดเข้าเว็บปุ๊บ ให้จำลองการเข้าห้องแข่งชื่อ arena_1 ทันที
      socket.emit("join_match", "arena_1");
    });

    socket.on("message", (msg) => {
      console.log("Server says:", msg);
    });

    // Cleanup ตอนปิดหน้าเว็บ
    return () => {
      socket.disconnect();
    };
  }, []); // พอร์ตจำลองเริ่มต้น $1,000

  // รับราคาล่าสุดจากกราฟ
  const handlePriceChange = useCallback((price: number) => {
    setCurrentPrice(price);
  }, []);

  // คำนวณ PnL แบบ Real-time ทันทีที่ราคาหรือสถานะเปลี่ยน
  useEffect(() => {
    if (position === 'LONG') {
      // สมมติเทรดทีละ 10 Unit (Multiplier = 10)
      setUnrealizedPnl((currentPrice - entryPrice) * 10);
    } else if (position === 'SHORT') {
      setUnrealizedPnl((entryPrice - currentPrice) * 10);
    } else {
      setUnrealizedPnl(0);
    }
  }, [currentPrice, position, entryPrice]);

  // ฟังก์ชันกดเข้าออเดอร์
  const handleOpenLong = () => {
    setPosition('LONG');
    setEntryPrice(currentPrice);
  };

  const handleOpenShort = () => {
    setPosition('SHORT');
    setEntryPrice(currentPrice);
  };

  // ฟังก์ชันปิดออเดอร์ (รับรู้กำไร/ขาดทุน)
  const handleClosePosition = () => {
    setBalance((prev) => prev + unrealizedPnl); // เอา PnL ไปบวก/ลบกับพอร์ตหลัก
    setPosition('NONE');
    setEntryPrice(0);
    setUnrealizedPnl(0);
  };

  return (
    <div className="min-h-screen bg-[#13131a] text-white p-4 flex flex-col font-sans">
      
      {/* Header ส่วนหัว */}
      <header className="flex justify-between items-center bg-[#1e1e24] p-4 rounded-xl border border-gray-800 mb-4">
        <div className="flex items-center gap-3">
          <Trophy className="text-yellow-500 w-6 h-6" />
          <h1 className="text-xl font-bold tracking-wider">VS TRAD : ARENA</h1>
        </div>
        <div className="flex items-center gap-6 text-sm bg-black/30 px-4 py-2 rounded-lg">
          {/* แสดงยอดเงินพอร์ตจำลอง */}
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Balance:</span>
            <span className="font-mono font-bold text-green-400 text-lg">${balance.toFixed(2)}</span>
          </div>
          <div className="w-px h-6 bg-gray-700"></div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            <span className="text-gray-400">Time Remaining:</span>
            <span className="font-mono font-bold text-red-400 text-lg">04:59</span>
          </div>
        </div>
      </header>

      {/* Main Content แบ่ง 2 ฝั่ง */}
      <div className="flex flex-1 gap-4 overflow-hidden">
        
        {/* ฝั่งซ้าย: กราฟ */}
        <div className="flex-[3] bg-[#1e1e24] rounded-xl border border-gray-800 p-2 flex flex-col">
          <div className="flex justify-between items-center px-4 py-2 border-b border-gray-800 mb-2">
            <h2 className="text-gray-400 text-sm font-semibold">ASSET : HIDDEN (Volatility High)</h2>
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-sm">Market Price:</span>
              <span className={`font-mono font-bold text-xl transition-colors ${currentPrice > entryPrice && position === 'LONG' ? 'text-green-400' : currentPrice < entryPrice && position === 'SHORT' ? 'text-green-400' : 'text-white'}`}>
                {currentPrice.toFixed(2)}
              </span>
            </div>
          </div>
          <div className="flex-1 relative">
             <TradingChart onPriceChange={handlePriceChange} />
          </div>
        </div>

        {/* ฝั่งขวา: Leaderboard & Action Panel */}
        <div className="flex-[1] flex flex-col gap-4">
          
          {/* Live Leaderboard */}
          <div className="flex-1 bg-[#1e1e24] rounded-xl border border-gray-800 p-4 flex flex-col">
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-800">
              <Users className="w-5 h-5 text-blue-400" />
              <h3 className="font-bold">Live Match Ranking</h3>
            </div>
            
            <div className="flex flex-col gap-3">
              {/* ข้อมูลของเรา (จะอัปเดต PnL แบบ Real-time) */}
              <div className={`flex justify-between items-center p-2 rounded border ${unrealizedPnl > 0 ? 'bg-green-500/10 border-green-500/30' : unrealizedPnl < 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-gray-800/50 border-gray-700/50'}`}>
                <span className="font-semibold text-sm">1. You</span>
                <span className={`font-mono font-bold ${unrealizedPnl > 0 ? 'text-green-400' : unrealizedPnl < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                  {unrealizedPnl > 0 ? '+' : ''}{unrealizedPnl.toFixed(2)}
                </span>
              </div>
              {/* บอทคู่แข่ง (Mock Data) */}
              <div className="flex justify-between items-center p-2 rounded">
                <span className="text-gray-400 text-sm">2. TraderX_99</span>
                <span className="font-mono text-red-400">-45.20</span>
              </div>
            </div>
          </div>

          {/* Action Panel (ระบบเทรด) */}
          <div className="h-56 bg-[#1e1e24] rounded-xl border border-gray-800 p-4 flex flex-col justify-center">
            
            {position === 'NONE' ? (
              // กรณีที่ยังไม่มีออเดอร์ ให้โชว์ปุ่ม Buy / Sell
              <>
                <div className="text-center mb-4 text-gray-400 text-sm">Your Position: <span className="text-white font-bold">NONE</span></div>
                <div className="flex gap-3 h-16">
                  <button onClick={handleOpenShort} className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/50 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all active:scale-95">
                      <TrendingDown className="w-5 h-5" /> SELL
                  </button>
                  <button onClick={handleOpenLong} className="flex-1 bg-green-500/10 hover:bg-green-500/20 text-green-500 border border-green-500/50 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all active:scale-95">
                      <TrendingUp className="w-5 h-5" /> BUY
                  </button>
                </div>
              </>
            ) : (
              // กรณีที่มีออเดอร์อยู่ ให้โชว์สถานะพร้อมปุ่มปิดออเดอร์
              <div className="flex flex-col h-full justify-between">
                <div className="flex justify-between items-center bg-black/30 p-3 rounded-lg border border-gray-700">
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-400 mb-1">Position</span>
                    <span className={`font-bold ${position === 'LONG' ? 'text-green-400' : 'text-red-400'}`}>
                      {position}
                    </span>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-xs text-gray-400 mb-1">Entry Price</span>
                    <span className="font-mono">{entryPrice.toFixed(2)}</span>
                  </div>
                </div>
                
                <button 
                  onClick={handleClosePosition}
                  className="w-full bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 border border-yellow-500/50 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  <XCircle className="w-5 h-5" /> CLOSE POSITION
                </button>
              </div>
            )}

          </div>

        </div>
      </div>
    </div>
  );
}