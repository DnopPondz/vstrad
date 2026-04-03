"use client";

import { useState, useEffect } from "react";
import Pusher from "pusher-js";
import TradingChart from "@/components/TradingChart";
import { Trophy, Loader2, Swords, Clock, Snowflake, Ghost, Wallet, TrendingUp, XCircle, MessageSquare, History, RefreshCw, Users, LogOut, Skull, LineChart, Lock, User as UserIcon, LogIn, UserPlus } from "lucide-react";

export default function ArenaPage() {
  // 🛑 เพิ่มสถานะ AUTH เป็นหน้าแรก
  const [gameState, setGameState] = useState<'AUTH' | 'LOBBY' | 'HOSTING' | 'ARENA' | 'FREE_TRADE'>('AUTH');
  
  // Auth States
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState("");

  const [myUser, setMyUser] = useState<any>(null);
  const [opponent, setOpponent] = useState<any>(null);
  
  const [balance, setBalance] = useState(0);
  const [leaderboard, setLeaderboard] = useState([]);
  const [matchHistory, setMatchHistory] = useState([]);
  const [stats, setStats] = useState({ wins: 0, total: 0 });
  const [availableRooms, setAvailableRooms] = useState([]);
  
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [leverage, setLeverage] = useState(10);
  const [roomId, setRoomId] = useState("");
  const [timeLeft, setTimeLeft] = useState(300);
  
  const [isGameOver, setIsGameOver] = useState(false);
  const [forceResult, setForceResult] = useState<'WIN' | 'LOSE' | null>(null);
  const [endReason, setEndReason] = useState<string | null>(null);

  const [isFetchingLobby, setIsFetchingLobby] = useState(false);
  
  const [isFrozen, setIsFrozen] = useState(false);
  const [isFoggy, setIsFoggy] = useState(false);
  const [powerUpUsed, setPowerUpUsed] = useState(false);
  const [quickChatMsg, setQuickChatMsg] = useState<string | null>(null);

  const [currentPrice, setCurrentPrice] = useState(0);
  const [position, setPosition] = useState<'NONE' | 'LONG' | 'SHORT'>('NONE');
  const [entryPrice, setEntryPrice] = useState(0);
  const [unrealizedPnl, setUnrealizedPnl] = useState(0);

  // เช็ค Session เดิม
  useEffect(() => {
    const savedUser = localStorage.getItem('vstrad_user');
    if (savedUser) {
      setMyUser({ username: savedUser });
      setGameState('LOBBY');
    }
  }, []);

  // 🛑 ฟังก์ชันล็อกอิน / สมัครสมาชิก
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: authMode, username: usernameInput, password: passwordInput })
      });
      const data = await res.json();
      
      if (data.success) {
        localStorage.setItem('vstrad_user', data.username);
        setMyUser({ username: data.username });
        setGameState('LOBBY');
      } else {
        setAuthError(data.error);
      }
    } catch (err) {
      setAuthError("Server Error");
    }
  };

  const logout = () => {
    localStorage.removeItem('vstrad_user');
    setMyUser(null);
    setGameState('AUTH');
  };

  const fetchLobby = async () => {
    if (!myUser?.username) return;
    setIsFetchingLobby(true);
    try {
      const res = await fetch('/api/matchmake', { method: 'POST', body: JSON.stringify({ action: 'FETCH_LOBBY', username: myUser.username }) });
      const data = await res.json();
      if (data.error === 'Unauthorized User') return logout(); // ดักกรณีลบ DB แล้วค้าง
      
      setBalance(data.balance || 0);
      setLeaderboard(data.leaderboard || []);
      setMatchHistory(data.history || []);
      setStats(data.stats || { wins: 0, total: 0 });
      setAvailableRooms(data.rooms || []);
    } catch (e) {}
    setIsFetchingLobby(false);
  };

  useEffect(() => { if (myUser && gameState === 'LOBBY') fetchLobby(); }, [myUser, gameState]);

  const setupGameListener = (rId: string) => {
    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, { cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER! });
    const channel = pusher.subscribe(`room-${rId}`);

    channel.bind('game-start', (data: any) => {
      const oppName = myUser.username === data.host ? data.challenger : data.host;
      setOpponent({ username: oppName, currentPnl: 0 });
      setSymbol(data.symbol);
      setLeverage(data.leverage);
      setRoomId(rId);
      setForceResult(null);
      setEndReason(null);
      setUnrealizedPnl(0);
      setPosition('NONE');
      setTimeLeft(300);
      setGameState('ARENA');
      pusher.unsubscribe(`room-${rId}`);
    });
  };

  const createRoom = async () => {
    if (balance < 100) return alert("❌ คุณต้องมียอด Balance ขั้นต่ำ $100 เพื่อเล่นโหมด VS\nกรุณาไปฟาร์มเงินในโหมด PRACTICE & EARN ก่อน!");
    const res = await fetch('/api/matchmake', { method: 'POST', body: JSON.stringify({ action: 'CREATE_ROOM', username: myUser.username, symbol, leverage }) });
    const data = await res.json();
    if (data.roomId) { setRoomId(data.roomId); setGameState('HOSTING'); setupGameListener(data.roomId); }
  };

  const joinRoom = async (targetRoomId: string) => {
    if (balance < 100) return alert("❌ คุณต้องมียอด Balance ขั้นต่ำ $100 เพื่อเล่นโหมด VS\nกรุณาไปฟาร์มเงินในโหมด PRACTICE & EARN ก่อน!");
    setupGameListener(targetRoomId);
    await fetch('/api/matchmake', { method: 'POST', body: JSON.stringify({ action: 'JOIN_ROOM', username: myUser.username, roomId: targetRoomId }) });
  };

  const cancelRoom = async () => {
    await fetch('/api/matchmake', { method: 'POST', body: JSON.stringify({ action: 'CANCEL_ROOM', username: myUser.username, roomId }) });
    setGameState('LOBBY'); setRoomId("");
  };

  const startFreeTrade = () => {
    setSymbol('BTCUSDT'); setRoomId('local_free_trade'); setOpponent({ username: 'SYSTEM', currentPnl: 0 });
    setTimeLeft(300); setForceResult(null); setEndReason(null); setUnrealizedPnl(0); setPosition('NONE');
    setGameState('FREE_TRADE');
  };

  const sendEvent = async (event: string, payload: any) => {
    if (!opponent || !opponent.username || gameState === 'FREE_TRADE') return;
    await fetch('/api/pusher', { method: 'POST', body: JSON.stringify({ event, channel: roomId, data: payload }) });
  };

  const usePower = (type: 'FREEZE' | 'FOG') => {
    if (powerUpUsed || !opponent || gameState === 'FREE_TRADE') return;
    setPowerUpUsed(true); sendEvent('skill-use', { type, target: opponent.username });
  };
  const sendQuickChat = (msg: string) => sendEvent('quick-chat', { msg, sender: myUser.username });

  useEffect(() => {
    if ((gameState !== 'ARENA' && gameState !== 'FREE_TRADE') || isGameOver) return;
    const timer = setInterval(() => setTimeLeft(p => p <= 1 ? (setIsGameOver(true), 0) : p - 1), 1000);
    return () => clearInterval(timer);
  }, [gameState, isGameOver]);

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
    channel.bind('quick-chat', (d: any) => { if (d.sender !== myUser.username) { setQuickChatMsg(d.msg); setTimeout(() => setQuickChatMsg(null), 3000); } });
    channel.bind('liquidated', (d: any) => {
      if (d.loser !== myUser?.username) { setForceResult('WIN'); setEndReason('OPPONENT LIQUIDATED! 💥'); setIsGameOver(true); }
    });

    return () => pusher.unsubscribe(roomId);
  }, [roomId, gameState, myUser?.username]);

  useEffect(() => {
    if ((gameState === 'ARENA' || gameState === 'FREE_TRADE') && !isGameOver && !isFrozen) {
      let pnl = 0;
      const activeLeverage = gameState === 'FREE_TRADE' ? 0.5 : leverage;
      if (position === 'LONG') pnl = (currentPrice - entryPrice) * activeLeverage;
      if (position === 'SHORT') pnl = (entryPrice - currentPrice) * activeLeverage;
      setUnrealizedPnl(pnl);

      if (balance + pnl <= 0 && position !== 'NONE') {
        setForceResult('LOSE'); setEndReason('LIQUIDATED! (Balance Reached $0) 💀'); setIsGameOver(true);
        if (gameState === 'ARENA') sendEvent('liquidated', { loser: myUser?.username });
        return;
      }
      if (gameState === 'ARENA') {
        fetch('/api/pusher', { method: 'POST', body: JSON.stringify({ event: 'opponent-update', channel: roomId, data: { username: myUser?.username, pnl } }) });
      }
    }
  }, [currentPrice, position, entryPrice, gameState, isGameOver, isFrozen, roomId, myUser?.username, leverage, balance]);

  useEffect(() => {
    if (isGameOver) {
      let finalPnl = unrealizedPnl;
      if (balance + unrealizedPnl < 0) finalPnl = -balance;
      let isWin = false;
      if (gameState === 'FREE_TRADE') {
        isWin = finalPnl > 0;
        fetch('/api/game/end', { method: 'POST', body: JSON.stringify({ username: myUser.username, opponent: 'SYSTEM', pnl: finalPnl, result: isWin ? 'WIN' : 'LOSE', symbol: symbol + ' (FREE)' }) });
      } else {
        isWin = forceResult !== null ? forceResult === 'WIN' : unrealizedPnl > (opponent?.currentPnl || 0);
        fetch('/api/game/end', { method: 'POST', body: JSON.stringify({ username: myUser.username, opponent: opponent.username, pnl: finalPnl, result: isWin ? 'WIN' : 'LOSE', symbol }) });
      }
    }
  }, [isGameOver, forceResult, gameState]);

  // ----- UI: หน้า Login / Register -----
  if (gameState === 'AUTH') {
    return (
      <div className="min-h-screen bg-[#0b0b10] flex flex-col items-center justify-center p-6 font-sans text-white relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
        <h1 className="text-6xl font-black italic bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent mb-8 tracking-tighter">VS TRAD</h1>
        
        <div className="bg-[#16161e] p-8 rounded-3xl border border-white/10 w-full max-w-md shadow-2xl relative z-10">
          <div className="flex gap-4 mb-8">
            <button onClick={() => {setAuthMode('LOGIN'); setAuthError("");}} className={`flex-1 py-3 font-bold rounded-xl transition-all ${authMode === 'LOGIN' ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-500 hover:bg-white/10'}`}>LOGIN</button>
            <button onClick={() => {setAuthMode('REGISTER'); setAuthError("");}} className={`flex-1 py-3 font-bold rounded-xl transition-all ${authMode === 'REGISTER' ? 'bg-purple-600 text-white' : 'bg-white/5 text-gray-500 hover:bg-white/10'}`}>REGISTER</button>
          </div>

          <form onSubmit={handleAuth} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Username</label>
              <div className="relative">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input type="text" value={usernameInput} onChange={e => setUsernameInput(e.target.value)} className="w-full bg-black/50 border border-white/10 p-4 pl-12 rounded-xl text-white outline-none focus:border-blue-500 transition-all" placeholder="Enter username" required />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input type="password" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} className="w-full bg-black/50 border border-white/10 p-4 pl-12 rounded-xl text-white outline-none focus:border-purple-500 transition-all" placeholder="Enter password" required />
              </div>
            </div>
            {authError && <p className="text-red-500 text-sm font-bold bg-red-500/10 p-3 rounded-lg text-center border border-red-500/20">{authError}</p>}
            
            <button type="submit" className={`mt-4 w-full py-4 rounded-xl font-black text-lg flex justify-center items-center gap-2 transition-all active:scale-95 shadow-lg ${authMode === 'LOGIN' ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/40' : 'bg-purple-600 hover:bg-purple-500 shadow-purple-900/40'}`}>
              {authMode === 'LOGIN' ? <><LogIn size={20} /> SIGN IN</> : <><UserPlus size={20} /> CREATE ACCOUNT</>}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ----- UI: Game Results -----
  if (isGameOver) {
    let isWin = gameState === 'FREE_TRADE' ? unrealizedPnl > 0 : (forceResult !== null ? forceResult === 'WIN' : unrealizedPnl > (opponent?.currentPnl || 0));
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center">
        {forceResult === 'LOSE' && endReason?.includes('LIQUIDATED') ? (
           <Skull className="w-24 h-24 text-red-600 mb-6 animate-pulse" />
        ) : ( <Trophy className={`w-24 h-24 mb-6 animate-bounce ${isWin ? 'text-yellow-500' : 'text-gray-600'}`} /> )}
        <h2 className={`text-6xl font-black mb-4 ${isWin ? 'text-green-500' : 'text-red-500'}`}>{gameState === 'FREE_TRADE' ? (isWin ? 'PROFIT SECURED!' : 'NO PROFIT') : (isWin ? 'YOU WIN!' : 'YOU LOSE!')}</h2>
        {endReason && <p className="text-2xl text-yellow-400 font-black tracking-widest uppercase mb-8">{endReason}</p>}
        <div className="bg-[#1e1e24] p-8 rounded-3xl border border-gray-800 w-full max-w-md shadow-2xl">
          <div className="flex justify-between mb-4"><span className="font-bold">YOUR PnL:</span><span className={unrealizedPnl >= 0 ? "text-green-400 font-black" : "text-red-400 font-black"}>${unrealizedPnl.toFixed(2)}</span></div>
          {gameState === 'ARENA' && <div className="flex justify-between mb-8"><span className="text-gray-400 font-bold">OPPONENT:</span><span className="text-gray-400 font-bold">${opponent?.currentPnl?.toFixed(2) || '0.00'}</span></div>}
          <button onClick={() => window.location.reload()} className="w-full mt-4 bg-blue-600 text-white py-5 rounded-2xl font-black hover:bg-blue-500 transition-all text-xl shadow-lg shadow-blue-900/30">BACK TO LOBBY</button>
        </div>
      </div>
    );
  }

  if (gameState === 'HOSTING') return (
    <div className="min-h-screen bg-[#0b0b10] text-white flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-[#16161e] p-10 rounded-3xl border border-blue-500/20 shadow-2xl flex flex-col items-center">
        <Loader2 className="w-16 h-16 text-blue-500 animate-spin mb-6" />
        <h2 className="text-3xl font-black mb-2">WAITING FOR CHALLENGER</h2>
        <p className="text-gray-400 mb-8">Room ID: <span className="font-mono text-white">{roomId}</span></p>
        <button onClick={cancelRoom} className="flex items-center gap-2 bg-red-600/10 text-red-500 px-8 py-3 rounded-xl font-bold hover:bg-red-600/20">
          <LogOut size={18} /> CANCEL ROOM
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0b0b10] text-white p-4 font-sans relative">
      {isFoggy && <div className="fixed inset-0 bg-white/10 backdrop-blur-xl z-[100] animate-pulse pointer-events-none" />}
      {isFrozen && <div className="fixed inset-0 bg-blue-500/20 z-[101] pointer-events-none border-[20px] border-blue-400/30" />}
      {quickChatMsg && gameState === 'ARENA' && (
        <div className="fixed top-20 right-10 z-[110] bg-white text-black font-bold px-6 py-3 rounded-2xl shadow-2xl animate-bounce flex gap-2"><MessageSquare /> {opponent?.username}: "{quickChatMsg}"</div>
      )}

      {gameState === 'LOBBY' ? (
        <div className="max-w-7xl mx-auto pt-6">
          <div className="flex justify-between items-center mb-10 border-b border-white/5 pb-6">
            <h1 className="text-4xl lg:text-5xl font-black italic bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">VS TRAD PRO</h1>
            <div className="flex gap-4 items-center">
              <span className="text-gray-400 font-bold hidden md:block">Welcome, <span className="text-white">{myUser?.username}</span></span>
              <div className="bg-green-500/10 p-3 px-6 rounded-2xl border border-green-500/20 text-green-400 font-bold flex items-center gap-2"><Wallet size={20} /> ${balance.toFixed(2)}</div>
              <button onClick={logout} className="p-3 bg-red-500/10 text-red-400 rounded-2xl hover:bg-red-500/20" title="Logout"><LogOut size={20}/></button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 flex flex-col gap-6">
              <div className="bg-[#16161e] p-6 rounded-3xl border border-white/5 shadow-2xl">
                <h2 className="text-xl font-black mb-4 flex items-center gap-2 text-blue-400"><Swords /> HOST A ROOM</h2>
                <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className="w-full bg-black p-4 rounded-xl border border-white/10 outline-none mb-4 font-bold">
                  <option value="BTCUSDT">Bitcoin (BTC/USDT)</option>
                  <option value="ETHUSDT">Ethereum (ETH/USDT)</option>
                  <option value="XAUUSD">Gold (XAU/USD)</option>
                </select>

                <div className="flex gap-2 mb-6">
                  {[10, 50, 100].map(lev => (
                    <button key={lev} onClick={() => setLeverage(lev)} className={`flex-1 py-3 rounded-xl font-black border ${leverage === lev ? 'bg-purple-600 border-purple-400' : 'bg-black border-white/10 text-gray-400'}`}>{lev}x</button>
                  ))}
                </div>
                
                {/* 🛑 ล็อกปุ่มถ้าเงินไม่ถึง 100 USD */}
                <button onClick={createRoom} disabled={balance < 100} className={`w-full py-5 rounded-2xl font-black text-xl flex justify-center items-center gap-2 transition-all ${balance < 100 ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700' : 'bg-blue-600 hover:bg-blue-500 active:scale-95 shadow-lg shadow-blue-900/40'}`}>
                   {balance < 100 ? <><Lock size={20} /> NEED $100 TO HOST</> : "CREATE ROOM"}
                </button>

                <div className="mt-6 border-t border-white/5 pt-6">
                  <button onClick={startFreeTrade} className="w-full bg-green-900/30 border border-green-500/30 py-4 rounded-2xl font-bold text-green-400 flex justify-center items-center gap-2 hover:bg-green-800/40 active:scale-95 transition-all">
                    <LineChart size={18} /> PRACTICE & EARN (FREE)
                  </button>
                  {balance < 100 && <p className="text-xs text-center text-gray-500 mt-2">Farm money here to unlock VS mode.</p>}
                </div>
              </div>

              <div className="bg-[#16161e] p-6 rounded-3xl border border-white/5">
                <h2 className="text-sm font-black mb-4 flex items-center gap-2 text-yellow-500 uppercase"><Trophy size={16} /> Leaderboard</h2>
                <div className="space-y-2">
                  {leaderboard.map((u: any, i) => (
                    <div key={i} className="flex justify-between p-3 bg-black/40 rounded-xl border border-white/5 text-sm">
                      <span className="font-bold">{i+1}. {u.username}</span><span className="text-green-400 font-bold">${u.balance.toFixed(0)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-8 bg-[#16161e] p-6 rounded-3xl border border-white/5 flex flex-col h-full">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-black flex items-center gap-2"><Users className="text-purple-400"/> AVAILABLE ROOMS</h2>
                <button onClick={fetchLobby} className="p-2 bg-white/5 rounded-lg hover:bg-white/10 text-gray-400"><RefreshCw size={18} className={isFetchingLobby ? "animate-spin" : ""} /></button>
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                {availableRooms.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-500 py-20 border-2 border-dashed border-white/5 rounded-2xl"><Ghost size={48} className="mb-4 opacity-20" /><p className="font-bold">No active rooms found.</p></div>
                ) : (
                  availableRooms.map((room: any) => (
                    <div key={room.roomId} className="flex justify-between items-center p-4 bg-black/60 rounded-2xl border border-white/5">
                      <div className="flex flex-col">
                        <span className="font-black text-lg text-blue-400">{room.host}'s Room</span>
                        <div className="flex gap-3 text-xs font-bold text-gray-400 mt-1">
                          <span className="bg-white/10 px-2 py-1 rounded">{room.symbol}</span><span className="text-purple-400 bg-purple-400/10 px-2 py-1 rounded">{room.leverage}x Lev</span>
                        </div>
                      </div>
                      {/* 🛑 ล็อกปุ่มถ้าเงินไม่ถึง 100 USD */}
                      <button onClick={() => joinRoom(room.roomId)} disabled={balance < 100} className={`px-8 py-3 rounded-xl font-black transition-all ${balance < 100 ? 'bg-gray-800 text-gray-600 cursor-not-allowed' : 'bg-green-600/20 text-green-400 border border-green-500/30 hover:bg-green-600 hover:text-white'}`}>
                        {balance < 100 ? <Lock size={18}/> : "JOIN"}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* หน้าจอเทรด (เหมือนเดิม) */
        <div className="max-w-7xl mx-auto flex flex-col gap-4">
          <header className="flex justify-between items-center bg-[#16161e] p-4 rounded-2xl border border-white/5">
            <div className="text-red-400 font-black text-xl flex gap-2 items-center"><Clock /> {Math.floor(timeLeft/60)}:{(timeLeft%60).toString().padStart(2,'0')}</div>
            {gameState === 'FREE_TRADE' ? <div className="text-yellow-400 font-black px-4 py-1 bg-yellow-500/10 rounded-full text-sm">FREE TRADE (0.5x Lev)</div> : <div className="text-purple-400 font-black px-4 py-1 bg-purple-500/10 rounded-full text-sm">Leverage: {leverage}x</div>}
            <div className="flex gap-4 items-center">
              <div className={`font-bold px-3 py-1 rounded-lg ${balance + unrealizedPnl <= 0 ? 'bg-red-500/20 text-red-500 animate-pulse' : 'bg-green-500/10 text-green-400'}`}>Equity: ${(balance + unrealizedPnl).toFixed(2)}</div>
              {gameState === 'ARENA' && <div className="text-blue-400 font-bold bg-blue-500/10 px-3 py-1 rounded-lg">{opponent?.username}: ${opponent?.currentPnl?.toFixed(2) || '0.00'}</div>}
            </div>
          </header>
          
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-3 h-[65vh] bg-black rounded-3xl border border-white/5 relative overflow-hidden flex flex-col">
               <TradingChart onPriceChange={setCurrentPrice} />
               {gameState === 'ARENA' && (
                 <div className="absolute bottom-4 left-4 flex gap-2 z-50">
                    {["HODL!", "To the Moon 🚀", "REKT 📉"].map(msg => (<button key={msg} onClick={() => sendQuickChat(msg)} className="bg-white/10 hover:bg-white/20 px-3 py-1 text-xs font-bold rounded-full">{msg}</button>))}
                 </div>
               )}
            </div>
            
            <div className="flex flex-col gap-4">
              {gameState === 'ARENA' ? (
                <div className="bg-[#16161e] p-4 rounded-3xl border border-white/5 flex flex-col gap-3">
                  <button disabled={!opponent || powerUpUsed || isFrozen} onClick={() => usePower('FREEZE')} className="w-full bg-blue-500/10 p-4 rounded-xl font-bold"><Snowflake size={20} className="inline mr-2"/> FREEZE (5s)</button>
                  <button disabled={!opponent || powerUpUsed || isFrozen} onClick={() => usePower('FOG')} className="w-full bg-gray-500/10 p-4 rounded-xl font-bold"><Ghost size={20} className="inline mr-2"/> FOG BOMB</button>
                </div>
              ) : <div className="bg-[#16161e] p-4 rounded-3xl flex items-center justify-center text-center"><p className="text-gray-500 text-sm font-bold">Skills disabled in Free mode.</p></div>}

              <div className="bg-[#16161e] p-4 rounded-3xl border border-white/5 flex-1 flex flex-col justify-end gap-2">
                <button onClick={() => {setPosition('SHORT'); setEntryPrice(currentPrice);}} disabled={isFrozen} className="bg-red-600 py-8 rounded-2xl font-black text-2xl active:scale-95">SELL</button>
                <button onClick={() => {setPosition('LONG'); setEntryPrice(currentPrice);}} disabled={isFrozen} className="bg-green-600 py-8 rounded-2xl font-black text-2xl active:scale-95">BUY</button>
                {position !== 'NONE' && <button onClick={() => {setPosition('NONE'); setUnrealizedPnl(0);}} className="bg-yellow-500 py-4 rounded-2xl font-bold text-black mt-2"><XCircle className="inline mr-2"/> CLOSE</button>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}