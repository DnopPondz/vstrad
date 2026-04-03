"use client";

import { useState, useEffect } from "react";
import Pusher from "pusher-js";
import TradingChart from "@/components/TradingChart";
import { Trophy, Loader2, Swords, Clock, Snowflake, Ghost, Wallet, TrendingUp, XCircle, MessageSquare, History, RefreshCw, Users, LogOut } from "lucide-react";

export default function ArenaPage() {
  const [gameState, setGameState] = useState<'LOBBY' | 'HOSTING' | 'ARENA'>('LOBBY');
  const [myUser, setMyUser] = useState<any>(null);
  const [opponent, setOpponent] = useState<any>(null);
  
  // Lobby Data
  const [balance, setBalance] = useState(0);
  const [leaderboard, setLeaderboard] = useState([]);
  const [matchHistory, setMatchHistory] = useState([]);
  const [stats, setStats] = useState({ wins: 0, total: 0 });
  const [availableRooms, setAvailableRooms] = useState([]);
  
  // Battle Config
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [leverage, setLeverage] = useState(10);
  const [roomId, setRoomId] = useState("");
  const [timeLeft, setTimeLeft] = useState(300);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isFetchingLobby, setIsFetchingLobby] = useState(false);
  
  // Power-ups & Chat
  const [isFrozen, setIsFrozen] = useState(false);
  const [isFoggy, setIsFoggy] = useState(false);
  const [powerUpUsed, setPowerUpUsed] = useState(false);
  const [quickChatMsg, setQuickChatMsg] = useState<string | null>(null);

  // Trading States
  const [currentPrice, setCurrentPrice] = useState(0);
  const [position, setPosition] = useState<'NONE' | 'LONG' | 'SHORT'>('NONE');
  const [entryPrice, setEntryPrice] = useState(0);
  const [unrealizedPnl, setUnrealizedPnl] = useState(0);

  useEffect(() => {
    const name = localStorage.getItem('vstrad_user') || `Trader_${Math.floor(Math.random() * 1000)}`;
    localStorage.setItem('vstrad_user', name);
    setMyUser({ username: name });
  }, []);

  // โหลดข้อมูลห้องและหน้า Lobby
  const fetchLobby = async () => {
    if (!myUser?.username) return;
    setIsFetchingLobby(true);
    try {
      const res = await fetch('/api/matchmake', { 
        method: 'POST', body: JSON.stringify({ action: 'FETCH_LOBBY', username: myUser.username }) 
      });
      const data = await res.json();
      setBalance(data.balance || 0);
      setLeaderboard(data.leaderboard || []);
      setMatchHistory(data.history || []);
      setStats(data.stats || { wins: 0, total: 0 });
      setAvailableRooms(data.rooms || []);
    } catch (e) {}
    setIsFetchingLobby(false);
  };

  useEffect(() => { if (myUser && gameState === 'LOBBY') fetchLobby(); }, [myUser, gameState]);

  // ระบบเข้าห้อง (Game Start) ที่เรียกผ่าน Pusher
  const setupGameListener = (rId: string) => {
    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, { cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER! });
    const channel = pusher.subscribe(`room-${rId}`);

    channel.bind('game-start', (data: any) => {
      // เมื่อมีคน Join สำเร็จ ทุกคนจะเด้งเข้า ARENA พร้อมกัน
      const oppName = myUser.username === data.host ? data.challenger : data.host;
      setOpponent({ username: oppName, currentPnl: 0 });
      setSymbol(data.symbol);
      setLeverage(data.leverage);
      setRoomId(rId);
      setGameState('ARENA');
      
      // ล้าง Pusher เดิมออก เพื่อไปใช้ State ใหม่ใน useEffect ของ ARENA
      pusher.unsubscribe(`room-${rId}`);
    });
  };

  const createRoom = async () => {
    const res = await fetch('/api/matchmake', { 
      method: 'POST', body: JSON.stringify({ action: 'CREATE_ROOM', username: myUser.username, symbol, leverage }) 
    });
    const data = await res.json();
    if (data.roomId) {
      setRoomId(data.roomId);
      setGameState('HOSTING');
      setupGameListener(data.roomId); // รอคนอื่นมา Join
    }
  };

  const joinRoom = async (targetRoomId: string) => {
    // ดักไว้รอฟัง Push ของตัวเองด้วย
    setupGameListener(targetRoomId);
    await fetch('/api/matchmake', { 
      method: 'POST', body: JSON.stringify({ action: 'JOIN_ROOM', username: myUser.username, roomId: targetRoomId }) 
    });
  };

  const cancelRoom = async () => {
    await fetch('/api/matchmake', { method: 'POST', body: JSON.stringify({ action: 'CANCEL_ROOM', username: myUser.username, roomId }) });
    setGameState('LOBBY');
    setRoomId("");
  };

  // ----- ระบบภายใน ARENA (เหมือนเดิม) -----
  const sendEvent = async (event: string, payload: any) => {
    if (!opponent || !opponent.username) return;
    await fetch('/api/pusher', { method: 'POST', body: JSON.stringify({ event, channel: roomId, data: payload }) });
  };

  const usePower = (type: 'FREEZE' | 'FOG') => {
    if (powerUpUsed || !opponent) return;
    setPowerUpUsed(true);
    sendEvent('skill-use', { type, target: opponent.username });
  };

  const sendQuickChat = (msg: string) => sendEvent('quick-chat', { msg, sender: myUser.username });

  useEffect(() => {
    if (!roomId || gameState !== 'ARENA') return;
    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, { cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER! });
    const channel = pusher.subscribe(roomId);
    
    channel.bind('opponent-update', (d: any) => { if (d.username !== myUser?.username) setOpponent((prev: any) => ({ ...prev, currentPnl: d.pnl })); });
    channel.bind('skill-use', (d: any) => {
      if (d.target === myUser.username) {
        if (d.type === 'FREEZE') { setIsFrozen(true); setTimeout(() => setIsFrozen(false), 5000); }
        if (d.type === 'FOG') { setIsFoggy(true); setTimeout(() => setIsFoggy(false), 8000); }
      }
    });
    channel.bind('quick-chat', (d: any) => {
      if (d.sender !== myUser.username) { setQuickChatMsg(d.msg); setTimeout(() => setQuickChatMsg(null), 3000); }
    });

    const timer = setInterval(() => setTimeLeft(p => p <= 1 ? (setIsGameOver(true), 0) : p - 1), 1000);
    return () => { pusher.unsubscribe(roomId); clearInterval(timer); };
  }, [roomId, gameState, myUser?.username]);

  useEffect(() => {
    if (gameState === 'ARENA' && !isGameOver && !isFrozen) {
      let pnl = 0;
      if (position === 'LONG') pnl = (currentPrice - entryPrice) * leverage;
      if (position === 'SHORT') pnl = (entryPrice - currentPrice) * leverage;
      setUnrealizedPnl(pnl);
      fetch('/api/pusher', { method: 'POST', body: JSON.stringify({ event: 'opponent-update', channel: roomId, data: { username: myUser?.username, pnl } }) });
    }
  }, [currentPrice, position, entryPrice, gameState, isGameOver, isFrozen, roomId, myUser?.username, leverage]);

  useEffect(() => {
    if (isGameOver) {
      const isWin = unrealizedPnl > (opponent?.currentPnl || 0);
      fetch('/api/game/end', {
        method: 'POST',
        body: JSON.stringify({ username: myUser.username, opponent: opponent.username, pnl: unrealizedPnl, result: isWin ? 'WIN' : 'LOSE', symbol })
      });
    }
  }, [isGameOver]);

  const winRate = stats.total > 0 ? ((stats.wins / stats.total) * 100).toFixed(0) : 0;

  // ----- UI Renders -----
  if (isGameOver) return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center">
      <Trophy className="w-20 h-20 text-yellow-500 mb-6 animate-bounce" />
      <h2 className="text-5xl font-black mb-8">RESULT</h2>
      <div className="bg-[#1e1e24] p-8 rounded-3xl border border-gray-800 w-full max-w-sm shadow-2xl">
        <div className="flex justify-between mb-4"><span>YOU:</span><span className={unrealizedPnl >= 0 ? "text-green-400" : "text-red-400 font-bold"}>${unrealizedPnl.toFixed(2)}</span></div>
        <div className="flex justify-between mb-8"><span>OPPONENT:</span><span className="text-gray-400">${opponent?.currentPnl?.toFixed(2) || '0.00'}</span></div>
        <button onClick={() => window.location.reload()} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-500 transition-all">BACK TO LOBBY</button>
      </div>
    </div>
  );

  if (gameState === 'HOSTING') return (
    <div className="min-h-screen bg-[#0b0b10] text-white flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-[#16161e] p-10 rounded-3xl border border-blue-500/20 shadow-2xl shadow-blue-900/20 flex flex-col items-center">
        <Loader2 className="w-16 h-16 text-blue-500 animate-spin mb-6" />
        <h2 className="text-3xl font-black mb-2">WAITING FOR CHALLENGER</h2>
        <p className="text-gray-400 mb-8">Room ID: <span className="font-mono text-white">{roomId}</span></p>
        <div className="flex gap-4 mb-8">
            <span className="bg-white/10 px-4 py-2 rounded-lg font-bold">{symbol}</span>
            <span className="bg-purple-500/20 text-purple-400 px-4 py-2 rounded-lg font-bold">{leverage}x Lev</span>
        </div>
        <button onClick={cancelRoom} className="flex items-center gap-2 bg-red-600/10 text-red-500 px-8 py-3 rounded-xl font-bold hover:bg-red-600/20 transition-all">
          <LogOut size={18} /> CANCEL ROOM
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0b0b10] text-white p-4 font-sans relative">
      {isFoggy && <div className="fixed inset-0 bg-white/10 backdrop-blur-xl z-[100] animate-pulse pointer-events-none" />}
      {isFrozen && <div className="fixed inset-0 bg-blue-500/20 z-[101] pointer-events-none border-[20px] border-blue-400/30" />}
      
      {quickChatMsg && (
        <div className="fixed top-20 right-10 z-[110] bg-white text-black font-bold px-6 py-3 rounded-2xl shadow-2xl animate-bounce flex gap-2">
          <MessageSquare /> {opponent?.username} Says: "{quickChatMsg}"
        </div>
      )}

      {gameState === 'LOBBY' ? (
        <div className="max-w-7xl mx-auto pt-6">
          <div className="flex justify-between items-center mb-10 border-b border-white/5 pb-6">
            <h1 className="text-4xl lg:text-5xl font-black italic bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent tracking-tighter">VS TRAD PRO</h1>
            <div className="flex gap-4">
              <div className="hidden lg:flex bg-blue-500/10 p-3 rounded-2xl border border-blue-500/20 text-blue-400 font-bold">
                Win Rate: {winRate}% ({stats.wins}/{stats.total})
              </div>
              <div className="bg-green-500/10 p-3 px-6 rounded-2xl border border-green-500/20 text-green-400 font-bold flex items-center gap-2">
                <Wallet size={20} /> ${balance.toFixed(2)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* ฝั่งซ้าย: สร้างห้อง & สถิติ */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              <div className="bg-[#16161e] p-6 rounded-3xl border border-white/5 shadow-2xl">
                <h2 className="text-xl font-black mb-4 flex items-center gap-2 text-blue-400"><Swords /> HOST A ROOM</h2>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Select Asset</label>
                <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className="w-full bg-black p-4 rounded-xl border border-white/10 outline-none mb-4 font-bold">
                  <option value="BTCUSDT">Bitcoin (BTC/USDT)</option>
                  <option value="ETHUSDT">Ethereum (ETH/USDT)</option>
                  <option value="XAUUSD">Gold (XAU/USD)</option>
                </select>

                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Leverage</label>
                <div className="flex gap-2 mb-6">
                  {[10, 50, 100].map(lev => (
                    <button key={lev} onClick={() => setLeverage(lev)} className={`flex-1 py-3 rounded-xl font-black border ${leverage === lev ? 'bg-purple-600 border-purple-400' : 'bg-black border-white/10 text-gray-400 hover:bg-white/5'}`}>
                      {lev}x
                    </button>
                  ))}
                </div>
                <button onClick={createRoom} className="w-full bg-blue-600 py-5 rounded-2xl font-black text-xl flex justify-center items-center gap-2 hover:bg-blue-500 active:scale-95 transition-all shadow-lg shadow-blue-900/40">
                   CREATE ROOM
                </button>
              </div>

              {/* Leaderboard */}
              <div className="bg-[#16161e] p-6 rounded-3xl border border-white/5">
                <h2 className="text-sm font-black mb-4 flex items-center gap-2 text-yellow-500 uppercase tracking-widest"><Trophy size={16} /> Leaderboard</h2>
                <div className="space-y-2">
                  {leaderboard.length === 0 ? <p className="text-gray-600 text-sm italic">No data</p> : leaderboard.map((u: any, i) => (
                    <div key={i} className="flex justify-between p-3 bg-black/40 rounded-xl border border-white/5 text-sm">
                      <span className="font-bold">{i+1}. {u.username}</span><span className="text-green-400 font-bold">${u.balance.toFixed(0)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ฝั่งขวา: รายชื่อห้องที่กำลังรอคน Join */}
            <div className="lg:col-span-8 bg-[#16161e] p-6 rounded-3xl border border-white/5 flex flex-col h-full">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-black flex items-center gap-2"><Users className="text-purple-400"/> AVAILABLE ROOMS</h2>
                <button onClick={fetchLobby} className="p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-all text-gray-400 hover:text-white">
                  <RefreshCw size={18} className={isFetchingLobby ? "animate-spin" : ""} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                {availableRooms.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-500 py-20 border-2 border-dashed border-white/5 rounded-2xl">
                    <Ghost size={48} className="mb-4 opacity-20" />
                    <p className="font-bold">No active rooms found.</p>
                    <p className="text-sm">Create one to challenge others!</p>
                  </div>
                ) : (
                  availableRooms.map((room: any) => (
                    <div key={room.roomId} className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 bg-black/60 rounded-2xl border border-white/5 hover:border-white/10 transition-all gap-4">
                      <div className="flex flex-col">
                        <span className="font-black text-lg text-blue-400">{room.host}'s Room</span>
                        <div className="flex items-center gap-3 text-xs font-bold text-gray-400 mt-1">
                          <span className="bg-white/10 px-2 py-1 rounded">{room.symbol}</span>
                          <span className="text-purple-400 bg-purple-400/10 px-2 py-1 rounded">{room.leverage}x Lev</span>
                        </div>
                      </div>
                      <button onClick={() => joinRoom(room.roomId)} className="w-full md:w-auto bg-green-600/20 text-green-400 border border-green-500/30 px-8 py-3 rounded-xl font-black hover:bg-green-600 hover:text-white transition-all active:scale-95">
                        JOIN
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* หน้าจอ ARENA ปกติ */
        <div className="max-w-7xl mx-auto flex flex-col gap-4">
          <header className="flex justify-between items-center bg-[#16161e] p-4 rounded-2xl border border-white/5">
            <div className="text-red-400 font-black text-xl flex gap-2 items-center"><Clock /> {Math.floor(timeLeft/60)}:{(timeLeft%60).toString().padStart(2,'0')}</div>
            <div className="text-purple-400 font-black px-4 py-1 bg-purple-500/10 rounded-full border border-purple-500/20 text-sm hidden md:block">Leverage: {leverage}x</div>
            <div className="flex gap-4 items-center">
              <div className="text-green-400 font-bold bg-green-500/10 px-3 py-1 rounded-lg">YOU: ${unrealizedPnl.toFixed(2)}</div>
              <div className="text-blue-400 font-bold bg-blue-500/10 px-3 py-1 rounded-lg">{opponent?.username}: ${opponent?.currentPnl?.toFixed(2) || '0.00'}</div>
            </div>
          </header>
          
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-3 h-[65vh] bg-black rounded-3xl border border-white/5 relative overflow-hidden shadow-inner flex flex-col">
               <TradingChart onPriceChange={setCurrentPrice} />
               <div className="absolute bottom-4 left-4 flex flex-wrap gap-2 z-50">
                  {["HODL!", "To the Moon 🚀", "REKT 📉", "GG!"].map(msg => (
                    <button key={msg} onClick={() => sendQuickChat(msg)} className="bg-white/10 hover:bg-white/20 px-3 py-1 text-xs font-bold rounded-full backdrop-blur-md transition-all border border-white/10">
                      {msg}
                    </button>
                  ))}
               </div>
            </div>
            
            <div className="flex flex-col gap-4">
              <div className="bg-[#16161e] p-4 rounded-3xl border border-white/5 flex flex-col gap-3">
                <button disabled={!opponent || powerUpUsed || isFrozen} onClick={() => usePower('FREEZE')} className="w-full bg-blue-500/10 p-4 rounded-xl border border-blue-500/20 flex items-center gap-3 hover:bg-blue-500/20 disabled:opacity-50 transition-all font-bold"><Snowflake size={20} /> FREEZE (5s)</button>
                <button disabled={!opponent || powerUpUsed || isFrozen} onClick={() => usePower('FOG')} className="w-full bg-gray-500/10 p-4 rounded-xl border border-gray-500/20 flex items-center gap-3 hover:bg-gray-500/20 disabled:opacity-50 transition-all font-bold"><Ghost size={20} /> FOG BOMB (8s)</button>
              </div>
              <div className="bg-[#16161e] p-4 rounded-3xl border border-white/5 flex-1 flex flex-col justify-end gap-2">
                <button onClick={() => {setPosition('SHORT'); setEntryPrice(currentPrice);}} disabled={isFrozen} className="bg-red-600 py-8 rounded-2xl font-black text-2xl active:scale-95 transition-all shadow-lg shadow-red-900/20">SELL</button>
                <button onClick={() => {setPosition('LONG'); setEntryPrice(currentPrice);}} disabled={isFrozen} className="bg-green-600 py-8 rounded-2xl font-black text-2xl active:scale-95 transition-all shadow-lg shadow-green-900/20">BUY</button>
                {position !== 'NONE' && <button onClick={() => {setPosition('NONE'); setUnrealizedPnl(0);}} className="bg-yellow-500 py-4 rounded-2xl font-bold text-black flex items-center justify-center gap-2 mt-2 hover:bg-yellow-400"><XCircle size={20} /> CLOSE</button>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}