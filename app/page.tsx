"use client";

import { useState, useEffect } from "react";
import Pusher from "pusher-js";
import TradingChart from "@/components/TradingChart";
import { Trophy, Loader2, Swords, Clock, Snowflake, Ghost, Wallet, TrendingUp, XCircle, MessageSquare, History, RefreshCw, Users, LogOut, Skull, LineChart, Lock, User as UserIcon, LogIn, UserPlus } from "lucide-react";

export default function ArenaPage() {
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

  // Trading States
  const [currentPrice, setCurrentPrice] = useState(0);
  const [position, setPosition] = useState<'NONE' | 'LONG' | 'SHORT'>('NONE');
  const [entryPrice, setEntryPrice] = useState(0);
  const [unrealizedPnl, setUnrealizedPnl] = useState(0); 
  const [realizedPnl, setRealizedPnl] = useState(0); 

  const totalPnl = realizedPnl + unrealizedPnl;

  useEffect(() => {
    const savedUser = localStorage.getItem('vstrad_user');
    if (savedUser) {
      setMyUser({ username: savedUser });
      setGameState('LOBBY');
    }
  }, []);

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
    } catch (err) { setAuthError("Server Error"); }
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
      if (data.error === 'Unauthorized User') return logout();
      
      setBalance(data.balance || 0);
      setLeaderboard(data.leaderboard || []);
      setMatchHistory(data.history || []);
      setStats(data.stats || { wins: 0, total: 0 });
      setAvailableRooms(data.rooms || []);
    } catch (e) {}
    setIsFetchingLobby(false);
  };

  useEffect(() => { if (myUser && gameState === 'LOBBY') fetchLobby(); }, [myUser, gameState]);

  // 🛑 ระบบปิดออเดอร์และบันทึกเงิน DB แบบ Real-time
  const closePosition = async () => {
    if (position === 'NONE') return;
    const pnlToRealize = unrealizedPnl;
    const currentSymbol = gameState === 'FREE_TRADE' ? symbol + ' (FREE)' : symbol;

    setRealizedPnl(prev => prev + pnlToRealize);
    setUnrealizedPnl(0);
    setPosition('NONE');
    setEntryPrice(0);

    try {
      const res = await fetch('/api/game/end', {
        method: 'POST',
        body: JSON.stringify({ 
          username: myUser.username, 
          opponent: opponent?.username || 'SYSTEM', 
          pnl: pnlToRealize, 
          result: pnlToRealize >= 0 ? 'WIN' : 'LOSE', 
          symbol: currentSymbol,
          isMidGame: true 
        })
      });
      const data = await res.json();
      if (data.newBalance !== undefined) setBalance(data.newBalance);
    } catch (e) { console.error("Sync Error", e); }
  };

  const startFreeTrade = () => {
    setRoomId('local_free_trade'); 
    setOpponent({ username: 'SYSTEM', currentPnl: 0 });
    setTimeLeft(300); 
    setForceResult(null); 
    setRealizedPnl(0); 
    setUnrealizedPnl(0); 
    setPosition('NONE');
    setGameState('FREE_TRADE');
  };

  useEffect(() => {
    if ((gameState !== 'ARENA' && gameState !== 'FREE_TRADE') || isGameOver) return;
    const timer = setInterval(() => setTimeLeft(p => p <= 1 ? (setIsGameOver(true), 0) : p - 1), 1000);
    return () => clearInterval(timer);
  }, [gameState, isGameOver]);

  useEffect(() => {
    if ((gameState === 'ARENA' || gameState === 'FREE_TRADE') && !isGameOver && !isFrozen) {
      let pnl = 0;
      const activeLeverage = gameState === 'FREE_TRADE' ? 0.5 : leverage;
      if (position === 'LONG') pnl = (currentPrice - entryPrice) * activeLeverage;
      if (position === 'SHORT') pnl = (entryPrice - currentPrice) * activeLeverage;
      setUnrealizedPnl(pnl);

      if (balance + realizedPnl + pnl <= 0 && position !== 'NONE') {
        setIsGameOver(true);
        setForceResult('LOSE');
      }
    }
  }, [currentPrice, position, entryPrice, gameState, isGameOver, isFrozen, leverage, balance, realizedPnl]);

  if (gameState === 'AUTH') return (
    <div className="min-h-screen bg-[#0b0b10] flex flex-col items-center justify-center p-6 text-white font-sans relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
      <h1 className="text-7xl font-black italic bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent mb-12 tracking-tighter">VS TRAD</h1>
      <div className="bg-[#16161e] p-8 rounded-3xl w-full max-w-md border border-white/10 shadow-2xl relative z-10">
        <div className="flex gap-4 mb-8">
          <button onClick={() => setAuthMode('LOGIN')} className={`flex-1 py-3 rounded-xl font-bold transition-all ${authMode==='LOGIN'?'bg-blue-600':'bg-white/5 text-gray-500'}`}>LOGIN</button>
          <button onClick={() => setAuthMode('REGISTER')} className={`flex-1 py-3 rounded-xl font-bold transition-all ${authMode==='REGISTER'?'bg-purple-600':'bg-white/5 text-gray-500'}`}>REGISTER</button>
        </div>
        <form onSubmit={handleAuth} className="flex flex-col gap-5">
          <div className="relative">
            <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
            <input type="text" placeholder="Username" className="w-full bg-black/50 p-4 pl-12 rounded-xl border border-white/10 outline-none focus:border-blue-500" onChange={e=>setUsernameInput(e.target.value)} required />
          </div>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
            <input type="password" placeholder="Password" className="w-full bg-black/50 p-4 pl-12 rounded-xl border border-white/10 outline-none focus:border-purple-500" onChange={e=>setPasswordInput(e.target.value)} required />
          </div>
          {authError && <p className="text-red-500 text-sm font-bold bg-red-500/10 p-3 rounded-lg text-center">{authError}</p>}
          <button type="submit" className="bg-blue-600 py-4 rounded-xl font-black text-lg shadow-lg active:scale-95 transition-all">CONTINUE</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0b0b10] text-white p-4 font-sans relative">
      {gameState === 'LOBBY' ? (
        <div className="max-w-7xl mx-auto pt-6">
          <div className="flex justify-between items-center mb-10 border-b border-white/5 pb-6">
            <h1 className="text-4xl font-black italic bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">VS TRAD PRO</h1>
            <div className="flex gap-4 items-center">
              <div className="bg-green-500/10 p-3 px-6 rounded-2xl border border-green-500/20 text-green-400 font-bold flex items-center gap-2"><Wallet size={20} /> ${balance.toFixed(2)}</div>
              <button onClick={logout} className="p-3 bg-red-500/10 text-red-400 rounded-2xl hover:bg-red-500/20"><LogOut size={20}/></button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Hosting & Practice */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              <div className="bg-[#16161e] p-6 rounded-3xl border border-white/5 shadow-2xl">
                <h2 className="text-xl font-black mb-4 text-blue-400 flex items-center gap-2"><Swords size={22}/> HOST ROOM</h2>
                <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className="w-full bg-black p-4 rounded-xl border border-white/10 outline-none mb-4 font-bold">
                  <option value="BTCUSDT">Bitcoin (BTC/USDT)</option>
                  <option value="XAUUSD">Gold (XAU/USD)</option>
                </select>
                <div className="flex gap-2 mb-6">
                  {[10, 50, 100].map(lev => (
                    <button key={lev} onClick={() => setLeverage(lev)} className={`flex-1 py-3 rounded-xl font-black border ${leverage === lev ? 'bg-purple-600 border-purple-400' : 'bg-black border-white/10 text-gray-400'}`}>{lev}x</button>
                  ))}
                </div>
                <button onClick={() => { if (balance < 100) alert("Need $100 to host!"); else setGameState('HOSTING'); }} className="w-full bg-blue-600 py-5 rounded-2xl font-black text-xl hover:bg-blue-500 shadow-lg">CREATE ROOM</button>

                <div className="mt-8 pt-6 border-t border-white/5">
                  <h3 className="text-xs font-bold text-gray-500 uppercase mb-3 text-center tracking-widest flex items-center justify-center gap-2"><LineChart size={14}/> Practice & Earn</h3>
                  <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className="w-full bg-black/40 border border-white/10 p-3 rounded-xl mb-3 text-sm font-bold">
                    <option value="BTCUSDT">Bitcoin (BTC/USDT)</option>
                    <option value="XAUUSD">Gold (XAU/USD)</option>
                  </select>
                  <button onClick={startFreeTrade} className="w-full bg-green-900/30 border border-green-500/30 py-4 rounded-2xl font-bold text-green-400 hover:bg-green-800/40 transition-all">START PRACTICE</button>
                </div>
              </div>

              {/* 🏆 LEADERBOARD: เก็บไว้ตามคำขอ */}
              <div className="bg-[#16161e] p-6 rounded-3xl border border-white/5">
                <h2 className="text-sm font-black mb-4 flex items-center gap-2 text-yellow-500 uppercase tracking-widest"><Trophy size={16} /> Leaderboard</h2>
                <div className="space-y-2">
                  {leaderboard.length === 0 ? <p className="text-gray-600 text-xs italic">Loading rankings...</p> : leaderboard.map((u: any, i) => (
                    <div key={i} className="flex justify-between p-3 bg-black/40 rounded-xl border border-white/5 text-sm">
                      <span className="font-bold">{i+1}. {u.username}</span>
                      <span className="text-green-400 font-bold">${u.balance.toFixed(0)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Available Rooms */}
            <div className="lg:col-span-8 bg-[#16161e] p-6 rounded-3xl border border-white/5 flex flex-col h-[700px]">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-black text-purple-400 flex items-center gap-2"><Users size={22}/> AVAILABLE ROOMS</h2>
                <button onClick={fetchLobby} className="p-2 bg-white/5 rounded-lg text-gray-400"><RefreshCw size={18} className={isFetchingLobby ? "animate-spin" : ""} /></button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3">
                {availableRooms.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-gray-600 italic">
                    <Ghost size={48} className="mb-4 opacity-20"/>
                    <p>No active battles right now.</p>
                  </div>
                ) : availableRooms.map((room: any) => (
                  <div key={room.roomId} className="flex justify-between items-center p-5 bg-black/60 rounded-2xl border border-white/5 hover:border-white/10 transition-all">
                    <div>
                      <span className="font-black text-lg text-blue-400">{room.host}&apos;s Room</span>
                      <div className="flex gap-3 text-xs font-bold text-gray-500 uppercase mt-1">
                        <span className="bg-white/5 px-2 py-1 rounded">{room.symbol}</span>
                        <span className="text-purple-400 bg-purple-500/10 px-2 py-1 rounded">{room.leverage}x Lev</span>
                      </div>
                    </div>
                    <button className="bg-green-600 px-8 py-3 rounded-xl font-black hover:bg-green-500 transition-all">JOIN</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ARENA / FREE TRADE MODE */
        <div className="max-w-7xl mx-auto flex flex-col gap-4">
          <header className="flex justify-between items-center bg-[#16161e] p-4 rounded-2xl border border-white/5 shadow-xl">
            <div className="text-red-400 font-black text-xl font-mono flex items-center gap-2"><Clock size={20}/> {Math.floor(timeLeft/60)}:{(timeLeft%60).toString().padStart(2,'0')}</div>
            <div className={`px-5 py-2 rounded-xl font-black text-lg ${balance + totalPnl <= 0 ? 'bg-red-500/20 text-red-500 animate-pulse' : 'bg-green-500/10 text-green-400'}`}>
               EQUITY: ${(balance + totalPnl).toFixed(2)}
            </div>
          </header>
          
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-3 h-[68vh] bg-black rounded-3xl relative overflow-hidden shadow-inner">
               <TradingChart onPriceChange={setCurrentPrice} symbol={symbol} />
            </div>
            
            <div className="flex flex-col gap-4">
              <div className="bg-[#16161e] p-6 rounded-3xl border border-white/5 flex-1 flex flex-col justify-end gap-3 shadow-2xl">
                <div className="text-center font-bold text-gray-500 mb-2 uppercase text-xs tracking-widest">Order PnL: <span className={unrealizedPnl >= 0 ? "text-green-400 text-lg" : "text-red-400 text-lg"}>${unrealizedPnl.toFixed(2)}</span></div>
                <button onClick={() => {setPosition('SHORT'); setEntryPrice(currentPrice);}} className="bg-red-600 py-8 rounded-2xl font-black text-3xl active:scale-95 shadow-lg hover:bg-red-500 transition-all">SELL</button>
                <button onClick={() => {setPosition('LONG'); setEntryPrice(currentPrice);}} className="bg-green-600 py-8 rounded-2xl font-black text-3xl active:scale-95 shadow-lg hover:bg-green-500 transition-all">BUY</button>
                
                {position !== 'NONE' && (
                  <button onClick={closePosition} className="bg-yellow-500 py-4 rounded-2xl font-black text-black mt-2 hover:bg-yellow-400 transition-all flex justify-center items-center gap-2">
                    <XCircle size={20}/> CLOSE POSITION
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {isGameOver && (
        <div className="fixed inset-0 bg-black/95 flex flex-col items-center justify-center z-[200] p-6 text-center backdrop-blur-sm">
          {forceResult === 'LOSE' ? <Skull size={100} className="text-red-600 mb-6 animate-pulse"/> : <Trophy size={100} className="text-yellow-500 mb-6 animate-bounce" />}
          <h2 className="text-7xl font-black mb-4 tracking-tighter">{forceResult === 'LOSE' ? 'LIQUIDATED!' : 'MATCH ENDED'}</h2>
          <div className="bg-[#1e1e24] p-8 rounded-3xl w-full max-w-sm border border-white/10 mb-8 shadow-2xl">
             <div className="flex justify-between mb-2 text-gray-400 font-bold uppercase tracking-widest"><span>TOTAL PnL:</span><span className={totalPnl >=0 ? "text-green-400" : "text-red-400"}>${totalPnl.toFixed(2)}</span></div>
          </div>
          <button onClick={() => window.location.reload()} className="bg-white text-black px-16 py-5 rounded-2xl font-black text-2xl hover:bg-gray-200 transition-all shadow-xl">BACK TO LOBBY</button>
        </div>
      )}
    </div>
  );
}