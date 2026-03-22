import React, { useState, useEffect } from 'react';
import { LogOut, Gamepad2, CheckCircle2, ShieldAlert, Plus, Trash2, Search, ChevronDown, ChevronUp, MessageSquare } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';

// Initial list of games to use if the app is brand new
const INITIAL_GAMES = [
  { id: "1", title: 'The Legend of Zelda: Breath of the Wild', genre: 'Action-Adventure', ratings: {} },
  { id: "2", title: 'Minecraft', genre: 'Sandbox', ratings: {} },
  { id: "3", title: 'Hades', genre: 'Roguelike', ratings: {} },
  { id: "4", title: 'Stardew Valley', genre: 'Simulation', ratings: {} }
];

const ADMIN_EMAIL = 'oliversamuelbond@icloud.com';

// --- CLOUD DATABASE SETUP ---
let appId = 'game-rater-prod';
let firebaseConfig = null;

// Smart Database Switcher
if (typeof __firebase_config !== 'undefined') {
  // 1. If we are in the testing Sandbox, safely use the sandbox database
  firebaseConfig = typeof __firebase_config === 'string' ? JSON.parse(__firebase_config) : __firebase_config;
  if (typeof __app_id !== 'undefined') appId = __app_id;
} else {
  // 2. If we are live on Vercel (or your computer), use YOUR real database!
  firebaseConfig = {
    apiKey: "AIzaSyB8r7loWotSyr1F3Ps2iAwrWYjBwbLPOMo",
    authDomain: "gamerater-e908a.firebaseapp.com",
    projectId: "gamerater-e908a",
    storageBucket: "gamerater-e908a.firebasestorage.app",
    messagingSenderId: "791914210637",
    appId: "1:791914210637:web:342c58be7a4e94470dc304"
  };
}

let app, auth, db;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (e) {
  console.error("Firebase init error:", e);
}

export default function App() {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [emailInput, setEmailInput] = useState('');
  const [games, setGames] = useState([]);
  const [activeTab, setActiveTab] = useState('form');
  const [selectedGameId, setSelectedGameId] = useState('');
  const [ratingValue, setRatingValue] = useState(null);
  const [comment, setComment] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [pendingAdmin, setPendingAdmin] = useState(false);
  const [adminCode, setAdminCode] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCloudConnected, setIsCloudConnected] = useState(false);
  const [expandedGameId, setExpandedGameId] = useState(null);

  // Admin Tool State
  const [newGameTitle, setNewGameTitle] = useState('');
  const [newGameGenre, setNewGameGenre] = useState('');

  const isAdmin = currentUser === ADMIN_EMAIL;

  // 1. Connect to Auth
  useEffect(() => {
    if (!auth) return;
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setFirebaseUser);
    return () => unsubscribe();
  }, []);

  // 2. Load data from Cloud Database (or fall back to computer memory)
  useEffect(() => {
    if (db && firebaseUser) {
      const gamesRef = collection(db, 'artifacts', appId, 'public', 'data', 'games');
      const unsubscribe = onSnapshot(gamesRef, (snapshot) => {
        setIsCloudConnected(true);
        if (snapshot.empty) {
           INITIAL_GAMES.forEach(g => setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', g.id), g));
        } else {
           const data = snapshot.docs.map(d => d.data());
           data.sort((a, b) => parseInt(a.id) - parseInt(b.id));
           setGames(data);
        }
      }, (err) => {
        console.error(err);
        setIsCloudConnected(false);
      });
      return () => unsubscribe();
    } else {
      setIsCloudConnected(false);
      const saved = localStorage.getItem('gamerater_v3_data');
      if (saved) setGames(JSON.parse(saved));
      else setGames(INITIAL_GAMES);
    }
  }, [firebaseUser]);

  // Save data locally just in case we are offline
  useEffect(() => {
    if (!db && games.length > 0) {
      localStorage.setItem('gamerater_v3_data', JSON.stringify(games));
    }
  }, [games]);

  const handleLogin = (e) => {
    e.preventDefault();
    const email = emailInput.trim().toLowerCase();
    if (email === ADMIN_EMAIL.toLowerCase()) {
      setPendingAdmin(true);
    } else if (email) {
      setCurrentUser(email);
      setActiveTab('form');
    }
  };

  const handleVerifyAdmin = (e) => {
    e.preventDefault();
    if (adminCode === 'RedBlackGoldenTimes32') {
      setCurrentUser(ADMIN_EMAIL);
      setPendingAdmin(false);
      setActiveTab('form');
    }
  };

  const handleSubmitRating = async (e) => {
    e.preventDefault();
    if (!selectedGameId || !ratingValue) return;

    const game = games.find(g => g.id.toString() === selectedGameId.toString());
    if (!game) return;

    const updatedGame = {
      ...game,
      ratings: {
        ...game.ratings,
        [currentUser]: { rating: ratingValue, comment, date: new Date().toISOString() }
      }
    };

    if (db && firebaseUser) {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', selectedGameId.toString()), updatedGame);
    } else {
      setGames(games.map(g => g.id.toString() === selectedGameId.toString() ? updatedGame : g));
    }

    setShowSuccess(true);
    setSelectedGameId('');
    setRatingValue(null);
    setComment('');
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const handleAddGame = async (e) => {
    e.preventDefault();
    if (!newGameTitle.trim()) return;
    
    const newGame = {
      id: Date.now().toString(),
      title: newGameTitle,
      genre: newGameGenre || 'General',
      ratings: {}
    };
    
    if (db && firebaseUser) {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', newGame.id), newGame);
    } else {
      setGames([...games, newGame]);
    }
    setNewGameTitle('');
    setNewGameGenre('');
  };

  const handleDeleteGame = async (id) => {
    if (db && firebaseUser) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', id.toString()));
    } else {
      setGames(games.filter(g => g.id !== id));
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-700">
          <div className="flex justify-center mb-4"><Gamepad2 className="w-12 h-12 text-indigo-400" /></div>
          <h1 className="text-3xl font-bold text-center text-white mb-6">GameRater</h1>
          {!pendingAdmin ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <input
                type="email" required placeholder="Enter your email" value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-slate-900 border border-slate-700 text-white"
              />
              <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold">Sign In</button>
            </form>
          ) : (
            <form onSubmit={handleVerifyAdmin} className="space-y-4">
              <input
                type="password" placeholder="Admin Secret Code" value={adminCode}
                onChange={(e) => setAdminCode(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-slate-900 border border-slate-700 text-white"
              />
              <button type="submit" className="w-full bg-amber-600 text-white py-3 rounded-lg font-bold">Verify Admin</button>
              <button type="button" onClick={() => setPendingAdmin(false)} className="w-full text-slate-400 text-sm">Cancel</button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200">
      <nav className="bg-slate-800 border-b border-slate-700 p-4 flex justify-between items-center sticky top-0 z-10">
        <div className="flex gap-2 sm:gap-4">
          <button onClick={() => setActiveTab('form')} className={`px-3 py-2 rounded text-sm sm:text-base ${activeTab === 'form' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>Rate</button>
          <button onClick={() => setActiveTab('results')} className={`px-3 py-2 rounded text-sm sm:text-base ${activeTab === 'results' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>Results</button>
          {isAdmin && (
            <button onClick={() => setActiveTab('admin')} className={`px-3 py-2 rounded text-sm sm:text-base flex items-center gap-1 ${activeTab === 'admin' ? 'bg-amber-600 text-white' : 'text-amber-500/60'}`}>
              <ShieldAlert className="w-4 h-4" /> Admin
            </button>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center text-xs font-bold">
            {isCloudConnected ? (
              <span className="text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded">🟢 Live Cloud</span>
            ) : (
              <span className="text-red-400 bg-red-400/10 px-2 py-1 rounded">🔴 Offline Mode</span>
            )}
          </div>
          <button onClick={() => setCurrentUser(null)} className="text-slate-400"><LogOut /></button>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto mt-8 px-4 pb-20">
        {!isCloudConnected && (
          <div className="bg-red-900/40 border border-red-500/50 text-red-200 p-3 rounded-lg mb-6 text-sm text-center">
            <strong>Warning:</strong> The cloud database is disconnected. Ratings are only saving on this computer!
          </div>
        )}
        {showSuccess && (
          <div className="bg-emerald-600/20 border border-emerald-500 text-emerald-400 p-4 rounded-lg mb-6 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" /> Rating submitted!
          </div>
        )}

        {activeTab === 'form' && (
          <form onSubmit={handleSubmitRating} className="space-y-6">
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
              <label className="block mb-3 font-bold text-lg">1. Choose a Game</label>
              <select 
                required value={selectedGameId} onChange={(e) => setSelectedGameId(e.target.value)}
                className="w-full p-3 bg-slate-900 rounded-lg border border-slate-600 text-white"
              >
                <option value="">Select...</option>
                {games.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
              </select>
            </div>

            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
              <label className="block mb-4 font-bold text-lg">2. Score (1-19)</label>
              <div className="flex flex-wrap gap-2">
                {Array.from({length: 19}, (_, i) => i + 1).map(n => (
                  <button 
                    key={n} type="button" onClick={() => setRatingValue(n)}
                    className={`w-10 h-10 rounded-full border transition-all ${ratingValue === n ? 'bg-indigo-600 border-white scale-110' : 'bg-slate-900 border-slate-600'}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
              <label className="block mb-3 font-bold text-lg">3. Comments (Optional)</label>
              <textarea 
                value={comment} onChange={(e) => setComment(e.target.value)}
                className="w-full p-3 bg-slate-900 rounded-lg border border-slate-600 text-white h-24"
                placeholder="What did you think?"
              />
            </div>

            <button type="submit" disabled={!selectedGameId || !ratingValue} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 p-4 rounded-xl font-bold text-xl transition-colors">
              Submit Review
            </button>
          </form>
        )}

        {activeTab === 'results' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <h2 className="text-2xl font-bold">Community Standings</h2>
              <div className="relative w-full sm:w-64">
                <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search games..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-800 rounded-lg border border-slate-700 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>

            {games.filter(g => g.title.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
              <p className="text-slate-500 italic text-center py-8">No games found matching "{searchQuery}"...</p>
            )}

            {games
              .filter(g => g.title.toLowerCase().includes(searchQuery.toLowerCase()))
              .map(g => {
              const reviews = Object.values(g.ratings);
              const avg = reviews.length > 0 
                ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
                : "N/A";
              
              const isExpanded = expandedGameId === g.id;

              return (
                <div key={g.id} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden transition-all shadow-sm">
                  <div 
                    onClick={() => setExpandedGameId(isExpanded ? null : g.id)}
                    className="p-5 flex justify-between items-center cursor-pointer hover:bg-slate-700/50 transition-colors"
                  >
                    <div className="flex-1">
                      <h3 className="font-bold text-xl">{g.title}</h3>
                      <p className="text-indigo-400 text-sm">{g.genre}</p>
                    </div>
                    <div className="text-right flex items-center gap-4">
                      <div>
                        <div className="text-2xl font-black text-white">{avg}</div>
                        <div className="text-xs text-slate-500">{reviews.length} reviews</div>
                      </div>
                      {isExpanded ? <ChevronUp className="text-slate-400 w-6 h-6" /> : <ChevronDown className="text-slate-400 w-6 h-6" />}
                    </div>
                  </div>
                  
                  {isExpanded && (
                    <div className="bg-slate-900/80 p-5 border-t border-slate-700 space-y-3">
                      <h4 className="font-bold text-sm text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" /> Player Reviews
                      </h4>
                      {reviews.length === 0 ? (
                        <p className="text-slate-500 italic text-sm">No written reviews yet. Be the first!</p>
                      ) : (
                        Object.entries(g.ratings)
                          .sort(([,a], [,b]) => new Date(b.date || 0) - new Date(a.date || 0))
                          .map(([userEmail, reviewData]) => (
                          <div key={userEmail} className="bg-slate-800 p-4 rounded-lg border border-slate-700/50">
                            <div className="flex justify-between items-start mb-2">
                              <span className="font-bold text-indigo-300">@{userEmail.split('@')[0]}</span>
                              <span className="bg-indigo-600/20 text-indigo-300 px-2 py-1 rounded text-xs font-bold border border-indigo-500/30">
                                Score: {reviewData.rating}/19
                              </span>
                            </div>
                            {reviewData.comment ? (
                              <p className="text-slate-200 text-sm mt-2 leading-relaxed">"{reviewData.comment}"</p>
                            ) : (
                              <p className="text-slate-500 text-sm mt-2 italic">No written comment.</p>
                            )}
                            {reviewData.date && (
                              <div className="text-slate-500 text-xs mt-3 pt-2 border-t border-slate-700/50">
                                {new Date(reviewData.date).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'admin' && isAdmin && (
          <div className="space-y-6">
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
              <h3 className="font-bold text-xl mb-4">Add New Game</h3>
              <form onSubmit={handleAddGame} className="space-y-4">
                <input 
                  type="text" placeholder="Game Title" value={newGameTitle} 
                  onChange={(e) => setNewGameTitle(e.target.value)}
                  className="w-full p-3 bg-slate-900 rounded-lg border border-slate-600"
                />
                <input 
                  type="text" placeholder="Genre" value={newGameGenre} 
                  onChange={(e) => setNewGameGenre(e.target.value)}
                  className="w-full p-3 bg-slate-900 rounded-lg border border-slate-600"
                />
                <button type="submit" className="w-full bg-indigo-600 p-3 rounded-lg font-bold flex items-center justify-center gap-2">
                  <Plus className="w-5 h-5" /> Add Game to List
                </button>
              </form>
            </div>

            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
              <h3 className="font-bold p-4 border-b border-slate-700 bg-slate-900/50">Manage Games</h3>
              <div className="divide-y divide-slate-700">
                {games.map(g => (
                  <div key={g.id} className="p-4 flex justify-between items-center">
                    <span>{g.title}</span>
                    <button onClick={() => handleDeleteGame(g.id)} className="text-red-400 p-2 hover:bg-red-400/10 rounded">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}