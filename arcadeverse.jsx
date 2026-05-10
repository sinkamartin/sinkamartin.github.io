import { useState, useEffect, useRef, useCallback } from "react";

// ─── Storage API helpers (online, shared across all users) ───────────────────
const storage = window.storage;
async function dbGet(key) {
  try { const r = await storage.get(key, true); return r ? JSON.parse(r.value) : null; }
  catch { return null; }
}
async function dbSet(key, val) {
  try { await storage.set(key, JSON.stringify(val), true); } catch {}
}

// ─── Escape HTML ─────────────────────────────────────────────────────────────
const esc = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

// ─── Game catalogue ──────────────────────────────────────────────────────────
const GAMES = [
  { id:"snake",    name:"SNAKE BLITZ",   emoji:"🐍", color:"#40c080", desc:"Eat, grow, survive!",            cost:0,   mult:1,   instr:"Arrow keys / WASD to move. Eat the food to grow!", bg:"linear-gradient(135deg,#0a2010,#102820)" },
  { id:"breakout", name:"NEON BREAKER",  emoji:"🎮", color:"#40c0f0", desc:"Break all the bricks!",          cost:0,   mult:1.2, instr:"Mouse or ← → to move paddle. Clear all bricks!", bg:"linear-gradient(135deg,#0a1020,#101828)" },
  { id:"dodge",    name:"METEOR DODGE",  emoji:"☄️", color:"#f0a040", desc:"Survive the meteor shower!",     cost:0,   mult:1.5, instr:"Mouse or ← → to dodge meteors.", bg:"linear-gradient(135deg,#150a00,#201000)" },
  { id:"tetris",   name:"BLOCK STORM",   emoji:"🟦", color:"#a040f0", desc:"Stack the falling blocks!",      cost:60,  mult:1.8, instr:"← → to move, ↑ to rotate, ↓ to drop.", bg:"linear-gradient(135deg,#100820,#160a28)", locked:true },
  { id:"memory",   name:"MIND MATRIX",   emoji:"🧠", color:"#e050a0", desc:"Match the pairs — test memory!", cost:80,  mult:2,   instr:"Click cards to flip and match all pairs.", bg:"linear-gradient(135deg,#180810,#200a18)", locked:true },
  { id:"reaction", name:"REFLEX RUSH",   emoji:"⚡", color:"#f0e040", desc:"Tap at the perfect moment!",     cost:120, mult:2.5, instr:"Press SPACE when the bar hits the zone!", bg:"linear-gradient(135deg,#181000,#201800)", locked:true },
  { id:"pong",     name:"CYBER PONG",    emoji:"🏓", color:"#c080f0", desc:"Classic pong vs AI.",            cost:200, mult:3,   instr:"W/S or ↑↓ to move, mouse also works.", bg:"linear-gradient(135deg,#100818,#180a20)", locked:true },
  { id:"flappy",   name:"NEON BIRD",     emoji:"🐦", color:"#f06040", desc:"Fly through the neon gates!",    cost:150, mult:2.2, instr:"Press SPACE or click to flap!", bg:"linear-gradient(135deg,#180800,#201008)", locked:true },
];

// ─── Shop catalogue ──────────────────────────────────────────────────────────
const SHOP = [
  // Snake skins
  { id:"skin_neon_snake",    name:"NEON SNAKE",    icon:"🌈", type:"Skin – Snake",    price:60,  forGame:"snake" },
  { id:"skin_fire_snake",    name:"FIRE SNAKE",    icon:"🔥", type:"Skin – Snake",    price:80,  forGame:"snake" },
  { id:"skin_rainbow_snake", name:"RAINBOW SNAKE", icon:"🎨", type:"Skin – Snake",    price:120, forGame:"snake" },
  { id:"skin_ghost_snake",   name:"GHOST SNAKE",   icon:"👻", type:"Skin – Snake",    price:100, forGame:"snake" },
  { id:"skin_gold_snake",    name:"GOLD SNAKE",    icon:"✨", type:"Skin – Snake",    price:150, forGame:"snake" },
  // Breakout skins
  { id:"skin_chrome_paddle", name:"CHROME PADDLE", icon:"⚪", type:"Skin – Breakout", price:50,  forGame:"breakout" },
  { id:"skin_gold_paddle",   name:"GOLD PADDLE",   icon:"🟡", type:"Skin – Breakout", price:90,  forGame:"breakout" },
  { id:"skin_rainbow_ball",  name:"RAINBOW BALL",  icon:"🔮", type:"Skin – Breakout", price:100, forGame:"breakout" },
  { id:"skin_laser_paddle",  name:"LASER PADDLE",  icon:"💜", type:"Skin – Breakout", price:130, forGame:"breakout" },
  // Dodge skins
  { id:"skin_ship_red",      name:"RED SHIP",      icon:"🔴", type:"Skin – Dodge",    price:50,  forGame:"dodge" },
  { id:"skin_ship_cyber",    name:"CYBER SHIP",    icon:"🤖", type:"Skin – Dodge",    price:120, forGame:"dodge" },
  { id:"skin_ship_gold",     name:"GOLD SHIP",     icon:"⭐", type:"Skin – Dodge",    price:160, forGame:"dodge" },
  // Game unlocks
  { id:"unlock_tetris",   name:"BLOCK STORM",  icon:"🟦", type:"Game Unlock", price:60,  unlocksGame:"tetris" },
  { id:"unlock_memory",   name:"MIND MATRIX",  icon:"🧠", type:"Game Unlock", price:80,  unlocksGame:"memory" },
  { id:"unlock_reaction", name:"REFLEX RUSH",  icon:"⚡", type:"Game Unlock", price:120, unlocksGame:"reaction" },
  { id:"unlock_pong",     name:"CYBER PONG",   icon:"🏓", type:"Game Unlock", price:200, unlocksGame:"pong" },
  { id:"unlock_flappy",   name:"NEON BIRD",    icon:"🐦", type:"Game Unlock", price:150, unlocksGame:"flappy" },
];

const RANK_COLORS = ["#f0c040","#c0c0d0","#c08060"];
const DEFAULT_STATE = () => ({
  coins:100, xp:0, level:1, gamesPlayed:0, totalCoinsEarned:100,
  bestStreak:0, highScores:{}, owned:[], equipped:{},
  unlocked:["snake","breakout","dodge"]
});

// ═════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [screen, setScreen]     = useState("auth"); // auth | app
  const [authTab, setAuthTab]   = useState("login");
  const [tab, setTab]           = useState("arcade");
  const [currentUser, setCU]    = useState(null);
  const [toast, setToast]       = useState(null);
  const [activeGame, setActiveGame] = useState(null);
  const [lbGame, setLbGame]     = useState("snake");
  const [lbData, setLbData]     = useState({});
  const [loading, setLoading]   = useState(false);
  const toastRef = useRef();

  // ── Toast ──────────────────────────────────────────────────────────────────
  const showToast = useCallback((msg, err=false) => {
    clearTimeout(toastRef.current);
    setToast({ msg, err });
    toastRef.current = setTimeout(() => setToast(null), 2800);
  }, []);

  // ── Session restore ────────────────────────────────────────────────────────
  useEffect(() => {
    const email = localStorage.getItem("av_session");
    if (email) loadUser(email);
  }, []);

  async function loadUser(email) {
    const u = await dbGet("user:"+email);
    if (u) { setCU(u); setScreen("app"); }
  }

  // ── Auth ───────────────────────────────────────────────────────────────────
  const [li, setLi] = useState({email:"",pass:""});
  const [re, setRe] = useState({name:"",email:"",pass:"",pass2:""});
  const [authErr, setAuthErr] = useState("");

  async function doRegister() {
    setAuthErr("");
    if (re.name.length < 2)          return setAuthErr("Username must be at least 2 characters.");
    if (!/\S+@\S+\.\S+/.test(re.email)) return setAuthErr("Enter a valid email.");
    if (re.pass.length < 6)          return setAuthErr("Password must be at least 6 characters.");
    if (re.pass !== re.pass2)        return setAuthErr("Passwords do not match.");
    setLoading(true);
    const existing = await dbGet("user:"+re.email.toLowerCase());
    if (existing) { setLoading(false); return setAuthErr("That email is already registered."); }
    // Check username taken
    const nameIdx = await dbGet("username:"+re.name.toLowerCase());
    if (nameIdx) { setLoading(false); return setAuthErr("Username taken — choose another."); }
    const u = { email:re.email.toLowerCase(), username:re.name, password:re.pass,
                ...DEFAULT_STATE(), joinedAt:Date.now() };
    await dbSet("user:"+u.email, u);
    await dbSet("username:"+re.name.toLowerCase(), u.email);
    localStorage.setItem("av_session", u.email);
    setCU(u); setScreen("app"); setLoading(false);
    showToast("🎮 Welcome to ARCADEVERSE, "+re.name+"!");
  }

  async function doLogin() {
    setAuthErr("");
    if (!li.email || !li.pass) return setAuthErr("Fill in all fields.");
    setLoading(true);
    const u = await dbGet("user:"+li.email.toLowerCase());
    setLoading(false);
    if (!u)              return setAuthErr("No account found with that email.");
    if (u.password !== li.pass) return setAuthErr("Incorrect password.");
    localStorage.setItem("av_session", u.email);
    setCU(u); setScreen("app");
    showToast("👾 Welcome back, "+u.username+"!");
  }

  function doLogout() {
    localStorage.removeItem("av_session");
    setCU(null); setScreen("auth");
  }

  // ── Save user (debounced) ──────────────────────────────────────────────────
  const saveRef = useRef();
  function saveUser(u) {
    setCU(u);
    clearTimeout(saveRef.current);
    saveRef.current = setTimeout(() => dbSet("user:"+u.email, u), 600);
  }

  // ── Economy ────────────────────────────────────────────────────────────────
  function addCoins(u, n) {
    return { ...u, coins: u.coins+n, totalCoinsEarned: u.totalCoinsEarned+(n>0?n:0) };
  }
  function addXP(u, n) {
    let xp = u.xp+n, level = u.level;
    if (xp >= level*100) { xp -= level*100; level++; showToast("🎉 LEVEL UP! Now Level "+level); }
    return { ...u, xp, level };
  }

  // ── Game end callback ──────────────────────────────────────────────────────
  async function onGameEnd(gameId, score) {
    const g = GAMES.find(x=>x.id===gameId);
    const coins = Math.floor(score * g.mult * 0.1);
    let u = addCoins(currentUser, coins);
    u = addXP(u, Math.floor(score*0.05)+10);
    u.gamesPlayed++;
    const isNew = !u.highScores[gameId] || score > u.highScores[gameId];
    if (isNew) { u.highScores[gameId] = score; showToast("🏆 NEW BEST: "+score+" (+"+coins+"🪙)"); }
    else showToast("🎮 Score: "+score+" (+"+coins+"🪙)");
    saveUser(u);
    // Push to shared leaderboard
    const lbKey = "lb:"+gameId;
    const lb = (await dbGet(lbKey)) || [];
    const filtered = lb.filter(e=>e.username !== u.username);
    const newEntry = { username:u.username, score, date:Date.now() };
    const updated = [...filtered, newEntry].sort((a,b)=>b.score-a.score).slice(0,100);
    await dbSet(lbKey, updated);
    setLbData(prev=>({...prev,[gameId]:updated}));
  }

  // ── Leaderboard load ───────────────────────────────────────────────────────
  useEffect(() => {
    if (tab==="leaderboard") loadLb(lbGame);
  }, [tab, lbGame]);
  async function loadLb(gid) {
    const d = await dbGet("lb:"+gid);
    setLbData(prev=>({...prev,[gid]:d||[]}));
  }

  // ── Buy / equip ────────────────────────────────────────────────────────────
  function buyItem(id) {
    const item = SHOP.find(i=>i.id===id);
    if (!item) return;
    if (currentUser.coins < item.price) return showToast("❌ Need "+item.price+"🪙", true);
    let u = { ...currentUser, coins:currentUser.coins-item.price, owned:[...currentUser.owned,id] };
    if (item.unlocksGame) u.unlocked = [...u.unlocked, item.unlocksGame];
    saveUser(u); showToast("✅ "+item.name+" purchased!");
  }
  function equipSkin(id, forGame) {
    saveUser({ ...currentUser, equipped:{ ...currentUser.equipped, [forGame]:id } });
    showToast("✨ Skin equipped!");
  }
  function tryUnlock(id) {
    const g = GAMES.find(x=>x.id===id);
    if (!g) return;
    if (currentUser.coins < g.cost) return showToast("❌ Need "+g.cost+"🪙 to unlock "+g.name, true);
    const si = SHOP.find(i=>i.unlocksGame===id);
    if (si) buyItem(si.id);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  if (screen === "auth") return (
    <AuthScreen
      tab={authTab} onTab={setAuthTab}
      li={li} setLi={setLi}
      re={re} setRe={setRe}
      err={authErr} loading={loading}
      onLogin={doLogin} onRegister={doRegister}
    />
  );

  return (
    <div style={S.root}>
      {/* HEADER */}
      <header style={S.header}>
        <div style={S.logo}>ARCADEVERSE</div>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={S.coinBadge}>🪙 {currentUser.coins}</div>
          <div style={S.lvlBadge}>LVL {currentUser.level}</div>
          <button style={S.userBtn} onClick={doLogout}>👾 {currentUser.username} · LOGOUT</button>
        </div>
      </header>

      {/* TABS */}
      <div style={S.tabBar}>
        {["arcade","shop","leaderboard","profile"].map(t=>(
          <div key={t} style={{...S.tab,...(tab===t?S.tabActive:{})}} onClick={()=>setTab(t)}>
            {t==="arcade"?"🕹 Arcade":t==="shop"?"🛒 Shop":t==="leaderboard"?"🏆 Leaderboard":"👾 Profile"}
          </div>
        ))}
      </div>

      {/* MAIN */}
      <main style={S.main}>
        {tab==="arcade" && (
          <ArcadeTab games={GAMES} user={currentUser} onPlay={setActiveGame} onUnlock={tryUnlock} />
        )}
        {tab==="shop" && (
          <ShopTab items={SHOP} user={currentUser} onBuy={buyItem} onEquip={equipSkin} />
        )}
        {tab==="leaderboard" && (
          <LeaderboardTab games={GAMES} lbGame={lbGame} setLbGame={setLbGame} lbData={lbData} currentUser={currentUser} />
        )}
        {tab==="profile" && (
          <ProfileTab games={GAMES} user={currentUser} />
        )}
      </main>

      {/* GAME OVERLAY */}
      {activeGame && (
        <GameOverlay
          gameId={activeGame}
          user={currentUser}
          onClose={()=>setActiveGame(null)}
          onEnd={onGameEnd}
        />
      )}

      {/* TOAST */}
      {toast && (
        <div style={{...S.toast,...(toast.err?{borderColor:"#e05090"}:{})}}>{toast.msg}</div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTH SCREEN
// ═══════════════════════════════════════════════════════════════════════════
function AuthScreen({tab,onTab,li,setLi,re,setRe,err,loading,onLogin,onRegister}) {
  return (
    <div style={S.authWrap}>
      <div style={S.authBox}>
        <div style={S.authLogo}>ARCADEVERSE</div>
        <div style={S.authSub}>INSERT COIN TO CONTINUE</div>
        <div style={S.authTabs}>
          {["login","register"].map(t=>(
            <div key={t} style={{...S.authTab,...(tab===t?S.authTabActive:{})}} onClick={()=>onTab(t)}>
              {t==="login"?"LOGIN":"REGISTER"}
            </div>
          ))}
        </div>
        {err && <div style={S.authErr}>{err}</div>}
        {tab==="login" ? (
          <div>
            <Field label="Email" type="email" value={li.email} onChange={v=>setLi({...li,email:v})} placeholder="player@example.com" />
            <Field label="Password" type="password" value={li.pass} onChange={v=>setLi({...li,pass:v})} placeholder="••••••••" onEnter={onLogin} />
            <button style={S.authBtn} onClick={onLogin} disabled={loading}>{loading?"LOADING…":"▶ PRESS START"}</button>
          </div>
        ):(
          <div>
            <Field label="Username" value={re.name} onChange={v=>setRe({...re,name:v})} placeholder="CoolPlayer99" />
            <Field label="Email" type="email" value={re.email} onChange={v=>setRe({...re,email:v})} placeholder="player@example.com" />
            <Field label="Password" type="password" value={re.pass} onChange={v=>setRe({...re,pass:v})} placeholder="Min 6 characters" />
            <Field label="Confirm Password" type="password" value={re.pass2} onChange={v=>setRe({...re,pass2:v})} placeholder="Repeat password" onEnter={onRegister} />
            <button style={S.authBtn} onClick={onRegister} disabled={loading}>{loading?"LOADING…":"▶ CREATE ACCOUNT"}</button>
          </div>
        )}
      </div>
    </div>
  );
}
function Field({label,type="text",value,onChange,placeholder,onEnter}) {
  return (
    <div style={{marginBottom:16}}>
      <label style={{display:"block",fontSize:11,letterSpacing:2,color:"#7070a0",marginBottom:6,textTransform:"uppercase"}}>{label}</label>
      <input
        type={type} value={value} placeholder={placeholder}
        style={S.input}
        onChange={e=>onChange(e.target.value)}
        onKeyDown={e=>e.key==="Enter"&&onEnter&&onEnter()}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ARCADE TAB
// ═══════════════════════════════════════════════════════════════════════════
function ArcadeTab({games,user,onPlay,onUnlock}) {
  return (
    <div>
      <div style={S.sectionTitle}>Available Games</div>
      <div style={S.gamesGrid}>
        {games.map(g=>{
          const unlocked = user.unlocked.includes(g.id);
          const best = user.highScores[g.id]||0;
          const skin = user.equipped[g.id];
          const skinItem = skin ? SHOP.find(s=>s.id===skin) : null;
          return (
            <div key={g.id} style={{...S.gameCard,...(!unlocked?{opacity:.7}:{})}}>
              <div style={{...S.gameThumb,background:g.bg}}>
                <span style={{fontSize:52,position:"relative",zIndex:1,animation:"float 3s ease-in-out infinite"}}>{g.emoji}</span>
                {!unlocked && <div style={S.lockBadge}>🔒 {g.cost}🪙</div>}
                {skinItem && <div style={S.skinBadge}>{skinItem.icon} {skinItem.name}</div>}
                <div style={S.thumbOverlay}/>
              </div>
              <div style={{padding:"14px 16px"}}>
                <div style={{...S.gameName,color:g.color}}>{g.name}</div>
                <div style={S.gameDesc}>{g.desc}</div>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div style={{fontSize:12,color:"#7070a0"}}>Best: <span style={{color:"#60e090",fontWeight:600}}>{best}</span></div>
                  {unlocked
                    ? <button style={S.btnSmallPrimary} onClick={()=>onPlay(g.id)}>PLAY</button>
                    : <button style={S.btnSmallSecondary} onClick={()=>onUnlock(g.id)}>UNLOCK</button>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SHOP TAB
// ═══════════════════════════════════════════════════════════════════════════
function ShopTab({items,user,onBuy,onEquip}) {
  return (
    <div>
      <div style={S.sectionTitle}>Store — Spend Your Coins</div>
      <div style={S.shopGrid}>
        {items.map(item=>{
          const owned = user.owned.includes(item.id)||(item.unlocksGame&&user.unlocked.includes(item.unlocksGame));
          const equipped = user.equipped[item.forGame]===item.id;
          return (
            <div key={item.id} style={S.shopCard}>
              <div style={{fontSize:48,marginBottom:12}}>{item.icon}</div>
              <div style={{fontFamily:"'Orbitron',sans-serif",fontSize:12,letterSpacing:1,marginBottom:6}}>{item.name}</div>
              <div style={{fontSize:12,color:"#7070a0",marginBottom:12}}>{item.type}</div>
              {owned
                ? (item.forGame && !equipped
                    ? <button style={S.btnSmallSecondary} onClick={()=>onEquip(item.id,item.forGame)}>EQUIP</button>
                    : equipped
                      ? <div style={{color:"#60e090",fontFamily:"'Orbitron',sans-serif",fontSize:11,background:"rgba(96,224,144,.1)",border:"1px solid #60e090",borderRadius:20,padding:"4px 12px"}}>✓ EQUIPPED</div>
                      : <div style={{color:"#60e090",fontFamily:"'Orbitron',sans-serif",fontSize:12}}>✓ OWNED</div>)
                : <>
                    <div style={{fontFamily:"'Orbitron',sans-serif",fontSize:14,color:"#f0c040",marginBottom:14,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>🪙 {item.price}</div>
                    <button style={S.btnSmallPrimary} onClick={()=>onBuy(item.id)}>BUY</button>
                  </>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LEADERBOARD TAB
// ═══════════════════════════════════════════════════════════════════════════
function LeaderboardTab({games,lbGame,setLbGame,lbData,currentUser}) {
  const entries = lbData[lbGame]||[];
  return (
    <div>
      <div style={S.sectionTitle}>Hall of Fame</div>
      <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:24}}>
        {games.map(g=>(
          <div key={g.id} onClick={()=>setLbGame(g.id)}
            style={{...S.lbGameTab,...(g.id===lbGame?{borderColor:"#f0c040",color:"#f0c040",background:"rgba(240,192,64,.08)"}:{})}}>
            {g.emoji} {g.name}
          </div>
        ))}
      </div>
      <div style={{maxWidth:620}}>
        {!entries.length
          ? <div style={{color:"#7070a0",fontFamily:"'Orbitron',sans-serif",fontSize:12,letterSpacing:2,padding:"24px 0"}}>NO SCORES YET — BE THE FIRST!</div>
          : entries.map((e,i)=>{
              const isYou = currentUser && e.username===currentUser.username;
              const d = new Date(e.date).toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"});
              return (
                <div key={i} style={{...S.lbRow,...(isYou?{borderColor:"#f0c040"}:{})}}>
                  <div style={{...S.lbRank,...(RANK_COLORS[i]?{color:RANK_COLORS[i]}:{})}}>{i+1}</div>
                  <div style={{flex:1,fontSize:15,fontWeight:600}}>
                    {esc(e.username)}
                    {isYou && <span style={{fontSize:10,color:"#f0c040",background:"rgba(240,192,64,.12)",borderRadius:10,padding:"2px 8px",marginLeft:8,fontFamily:"Orbitron,sans-serif"}}>YOU</span>}
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontFamily:"'Orbitron',sans-serif",fontSize:14,color:"#40c0f0"}}>{e.score.toLocaleString()}</div>
                    <div style={{fontSize:11,color:"#7070a0"}}>{d}</div>
                  </div>
                </div>
              );
            })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PROFILE TAB
// ═══════════════════════════════════════════════════════════════════════════
function ProfileTab({games,user}) {
  const xpPct = (user.xp/(user.level*100)*100)+"%";
  return (
    <div>
      <div style={S.sectionTitle}>Your Stats</div>
      <div style={{maxWidth:500}}>
        <div style={{background:"#16162a",border:"1px solid #2a2a4a",borderRadius:16,padding:28,marginBottom:16}}>
          <div style={{display:"flex",alignItems:"center",gap:20,marginBottom:24}}>
            <div style={{width:72,height:72,borderRadius:"50%",background:"linear-gradient(135deg,#4020a0,#e05090)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,border:"2px solid #f0c040"}}>👾</div>
            <div>
              <div style={{fontFamily:"'Orbitron',sans-serif",fontSize:20,fontWeight:700}}>{user.username}</div>
              <div style={{color:"#7070a0",fontSize:13,marginTop:2}}>{user.email}</div>
              <div style={{color:"#7070a0",fontSize:13,marginTop:2}}>Level {user.level}</div>
              <div style={{background:"#2a2a4a",borderRadius:4,height:6,width:200,marginTop:8,overflow:"hidden"}}>
                <div style={{height:"100%",background:"linear-gradient(90deg,#e05090,#f0c040)",borderRadius:4,width:xpPct,transition:".6s"}}/>
              </div>
              <div style={{fontSize:11,color:"#7070a0",marginTop:4}}>{user.xp} / {user.level*100} XP</div>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            {[["Total Coins",user.totalCoinsEarned],["Games Played",user.gamesPlayed],["Best Streak",user.bestStreak],["Items Owned",user.owned.length]].map(([k,v])=>(
              <div key={k} style={{background:"#1a1a2e",border:"1px solid #2a2a4a",borderRadius:10,padding:"10px 16px",textAlign:"center"}}>
                <div style={{fontSize:11,letterSpacing:2,color:"#7070a0",textTransform:"uppercase"}}>{k}</div>
                <div style={{fontFamily:"'Orbitron',sans-serif",fontSize:22,fontWeight:700,color:"#f0c040"}}>{v}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{background:"#16162a",border:"1px solid #2a2a4a",borderRadius:12,padding:20}}>
          <div style={{fontFamily:"'Orbitron',sans-serif",fontSize:12,letterSpacing:2,color:"#7070a0",marginBottom:14}}>PERSONAL BESTS</div>
          {games.filter(g=>user.unlocked.includes(g.id)).map(g=>(
            <div key={g.id} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid #2a2a4a",fontSize:14}}>
              <span>{g.emoji} {g.name}</span>
              <span style={{fontFamily:"'Orbitron',sans-serif",color:"#40c0f0"}}>{user.highScores[g.id]||0}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// GAME OVERLAY
// ═══════════════════════════════════════════════════════════════════════════
function GameOverlay({gameId,user,onClose,onEnd}) {
  const [phase, setPhase]   = useState("idle"); // idle | playing | over
  const [score, setScore]   = useState(0);
  const [coins, setCoins]   = useState(0);
  const canvasRef           = useRef();
  const stopRef             = useRef(null);
  const g = GAMES.find(x=>x.id===gameId);

  const handleEnd = useCallback((finalScore) => {
    setPhase("over");
    const c = Math.floor(finalScore * g.mult * 0.1);
    setCoins(c);
    onEnd(gameId, finalScore);
  }, [gameId, g, onEnd]);

  function startGame() {
    setPhase("playing"); setScore(0); setCoins(0);
    const runners = { snake:runSnake, breakout:runBreakout, dodge:runDodge,
                      tetris:runTetris, memory:runMemory, reaction:runReaction,
                      pong:runPong, flappy:runFlappy };
    if (stopRef.current) stopRef.current();
    stopRef.current = runners[gameId](canvasRef.current, user, setScore, handleEnd);
  }

  useEffect(() => () => { if(stopRef.current) stopRef.current(); }, []);

  const best = user.highScores[gameId]||0;

  return (
    <div style={S.overlayBg}>
      <div style={S.overlayModal}>
        <div style={S.modalHeader}>
          <div style={{fontFamily:"'Orbitron',sans-serif",fontSize:16,letterSpacing:2}}>{g.emoji} {g.name}</div>
          <button style={S.closeBtn} onClick={()=>{if(stopRef.current)stopRef.current();onClose();}}>✕</button>
        </div>
        <div style={{overflowY:"auto"}}>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:20,gap:16}}>
            <div style={{display:"flex",gap:16,width:"100%",maxWidth:580}}>
              {[["Score",score],["Personal Best",best],["Coins Won",coins]].map(([l,v])=>(
                <div key={l} style={{flex:1,background:"#1a1a2e",border:"1px solid #2a2a4a",borderRadius:10,padding:"10px 16px",textAlign:"center"}}>
                  <div style={{fontSize:11,letterSpacing:2,color:"#7070a0",textTransform:"uppercase"}}>{l}</div>
                  <div style={{fontFamily:"'Orbitron',sans-serif",fontSize:22,fontWeight:700,color:"#f0c040"}}>{v}</div>
                </div>
              ))}
            </div>
            <canvas ref={canvasRef} style={{borderRadius:10,border:"2px solid #2a2a4a",background:"#000",display:"block",maxWidth:"100%"}}/>
            {phase==="over" && <div style={{fontFamily:"'Orbitron',sans-serif",fontSize:18,color:"#f0c040"}}>GAME OVER — Score: {score}</div>}
            <div style={{display:"flex",gap:10,flexWrap:"wrap",justifyContent:"center"}}>
              {phase==="idle" && <button style={S.btnPrimary} onClick={startGame}>START GAME</button>}
              {phase==="over" && <button style={S.btnPrimary} onClick={startGame}>RESTART</button>}
            </div>
            {phase==="idle" && <div style={{fontSize:13,color:"#7070a0",textAlign:"center",maxWidth:400,lineHeight:1.6}}>{g.instr}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// GAME ENGINES — each returns a cleanup function
// ═══════════════════════════════════════════════════════════════════════════

// ── SNAKE ───────────────────────────────────────────────────────────────────
function runSnake(canvas, user, setScore, onEnd) {
  canvas.width=400; canvas.height=400;
  const ctx=canvas.getContext("2d");
  const C=20, skin=user.equipped["snake"];
  // Rainbow state
  let rainbowHue=0;
  function snakeColor(i){
    if(skin==="skin_rainbow_snake") return `hsl(${(rainbowHue+i*15)%360},100%,60%)`;
    if(skin==="skin_fire_snake") return i===0?"#ffa060":"#f04020";
    if(skin==="skin_ghost_snake") return `rgba(200,200,255,${0.3+0.7*(1-i/20)})`;
    if(skin==="skin_gold_snake") return i===0?"#ffe080":"#f0c040";
    if(skin==="skin_neon_snake") return i===0?"#a0ffd0":"#40f080";
    return i===0?"#a0ffd0":"#40f080";
  }
  let sn=[{x:10,y:10},{x:9,y:10},{x:8,y:10}], dir={x:1,y:0}, food={x:5,y:5}, score=0, spd=150;
  let lp, dead=false;
  function place(){do{food={x:Math.floor(Math.random()*20),y:Math.floor(Math.random()*20)};}while(sn.some(s=>s.x===food.x&&s.y===food.y));}
  function draw(){
    ctx.fillStyle="#080d08"; ctx.fillRect(0,0,400,400);
    ctx.fillStyle="#0f1a0f";
    for(let x=0;x<20;x++)for(let y=0;y<20;y++){ctx.beginPath();ctx.arc(x*C+C/2,y*C+C/2,1,0,Math.PI*2);ctx.fill();}
    ctx.fillStyle="#f03050"; ctx.shadowColor="#f03050"; ctx.shadowBlur=10;
    ctx.beginPath(); ctx.arc(food.x*C+C/2,food.y*C+C/2,C/2-2,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;
    rainbowHue=(rainbowHue+2)%360;
    sn.forEach((s,i)=>{
      ctx.fillStyle=snakeColor(i); ctx.shadowColor=snakeColor(i); ctx.shadowBlur=i===0?12:4;
      ctx.beginPath(); ctx.roundRect(s.x*C+1,s.y*C+1,C-2,C-2,4); ctx.fill(); ctx.shadowBlur=0;
    });
  }
  function tick(){
    if(dead) return;
    const h={x:sn[0].x+dir.x,y:sn[0].y+dir.y};
    if(h.x<0||h.x>=20||h.y<0||h.y>=20||sn.some(s=>s.x===h.x&&s.y===h.y)){dead=true;clearInterval(lp);onEnd(score);return;}
    sn.unshift(h);
    if(h.x===food.x&&h.y===food.y){score+=10;setScore(score);place();if(score%50===0){clearInterval(lp);spd=Math.max(60,spd-15);lp=setInterval(tick,spd);}}
    else sn.pop();
    draw();
  }
  const kd=e=>{
    const m={"ArrowUp":{x:0,y:-1},"ArrowDown":{x:0,y:1},"ArrowLeft":{x:-1,y:0},"ArrowRight":{x:1,y:0},w:{x:0,y:-1},s:{x:0,y:1},a:{x:-1,y:0},d:{x:1,y:0}};
    if(m[e.key]&&!(m[e.key].x===-dir.x&&m[e.key].y===-dir.y)){dir=m[e.key];e.preventDefault();}
  };
  document.addEventListener("keydown",kd);
  place(); draw(); lp=setInterval(tick,spd);
  return ()=>{clearInterval(lp);document.removeEventListener("keydown",kd);};
}

// ── BREAKOUT ─────────────────────────────────────────────────────────────────
function runBreakout(canvas, user, setScore, onEnd) {
  canvas.width=480; canvas.height=380;
  const ctx=canvas.getContext("2d");
  const skin=user.equipped["breakout"];
  const pc=skin==="skin_gold_paddle"?"#f0c040":skin==="skin_chrome_paddle"?"#c0c0d0":skin==="skin_laser_paddle"?"#c040f0":"#40c0f0";
  const rb=skin==="skin_rainbow_ball";
  let pad={x:190,y:355,w:100,h:10},ball={x:240,y:300,vx:4,vy:-4,r:8},bricks=[],score=0,lives=3;
  let rafId, dead=false, rbHue=0;
  function build(){bricks=[];const cl=["#f03050","#f08020","#f0c020","#40c060","#40b0f0","#a040f0"];for(let r=0;r<5;r++)for(let c=0;c<10;c++)bricks.push({x:c*46+8,y:r*26+40,w:40,h:18,a:true,color:cl[r]});}
  function loop(){
    if(dead) return;
    ctx.fillStyle="#050810"; ctx.fillRect(0,0,480,380);
    ctx.fillStyle=pc; ctx.shadowColor=pc; ctx.shadowBlur=8;
    ctx.beginPath(); ctx.roundRect(pad.x,pad.y,pad.w,pad.h,5); ctx.fill(); ctx.shadowBlur=0;
    rbHue=(rbHue+3)%360;
    if(!rb){ctx.fillStyle="#fff";ctx.shadowColor="#fff";ctx.shadowBlur=10;}
    else{const g=ctx.createRadialGradient(ball.x,ball.y,0,ball.x,ball.y,ball.r);g.addColorStop(0,`hsl(${rbHue},100%,80%)`);g.addColorStop(1,`hsl(${(rbHue+120)%360},100%,50%)`);ctx.fillStyle=g;ctx.shadowBlur=12;ctx.shadowColor="#fff";}
    ctx.beginPath(); ctx.arc(ball.x,ball.y,ball.r,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;
    bricks.forEach(b=>{if(!b.a)return;ctx.fillStyle=b.color;ctx.shadowColor=b.color;ctx.shadowBlur=6;ctx.beginPath();ctx.roundRect(b.x,b.y,b.w,b.h,3);ctx.fill();ctx.shadowBlur=0;});
    ctx.fillStyle="#7070a0";ctx.font="12px Orbitron";ctx.textAlign="left";ctx.fillText("♥".repeat(lives),8,20);
    ball.x+=ball.vx; ball.y+=ball.vy;
    if(ball.x-ball.r<0||ball.x+ball.r>480)ball.vx*=-1;
    if(ball.y-ball.r<0)ball.vy*=-1;
    if(ball.y+ball.r>380){lives--;if(lives<=0){dead=true;onEnd(score);return;}ball.x=pad.x+pad.w/2;ball.y=pad.y-20;ball.vy=-Math.abs(ball.vy);}
    if(ball.y+ball.r>=pad.y&&ball.y-ball.r<=pad.y+pad.h&&ball.x>=pad.x&&ball.x<=pad.x+pad.w){ball.vy=-Math.abs(ball.vy);ball.vx+=((ball.x-(pad.x+pad.w/2))/20);}
    bricks.forEach(b=>{if(!b.a)return;if(ball.x>b.x&&ball.x<b.x+b.w&&ball.y+ball.r>b.y&&ball.y-ball.r<b.y+b.h){b.a=false;ball.vy*=-1;score+=10;setScore(score);}});
    if(bricks.every(b=>!b.a)){ball.vy*=1.1;ball.vx*=1.1;build();}
    rafId=requestAnimationFrame(loop);
  }
  const mm=e=>{const r=canvas.getBoundingClientRect();pad.x=Math.max(0,Math.min(380,e.clientX-r.left-pad.w/2));};
  const kd=e=>{if(e.key==="ArrowLeft")pad.x=Math.max(0,pad.x-18);if(e.key==="ArrowRight")pad.x=Math.min(380,pad.x+18);};
  canvas.addEventListener("mousemove",mm); document.addEventListener("keydown",kd);
  build(); rafId=requestAnimationFrame(loop);
  return ()=>{cancelAnimationFrame(rafId);canvas.removeEventListener("mousemove",mm);document.removeEventListener("keydown",kd);};
}

// ── DODGE ─────────────────────────────────────────────────────────────────────
function runDodge(canvas, user, setScore, onEnd) {
  canvas.width=400; canvas.height=450;
  const ctx=canvas.getContext("2d");
  const skin=user.equipped["dodge"];
  const sc=skin==="skin_ship_red"?"#f04040":skin==="skin_ship_cyber"?"#40f0f0":skin==="skin_ship_gold"?"#f0c040":"#40c0f0";
  let ship={x:200,y:380},mets=[],score=0,spd=2,rate=60,frame=0,dead=false,rafId;
  function loop(){
    if(dead) return;
    frame++;score++;
    if(frame%180===0){spd+=.3;rate=Math.max(20,rate-3);}
    if(frame%rate===0)mets.push({x:Math.random()*370+15,y:-20,r:Math.random()*14+8,spd:spd+Math.random()*2,rot:Math.random()*Math.PI*2,rs:(Math.random()-.5)*.08});
    ctx.fillStyle="#050510"; ctx.fillRect(0,0,400,450);
    ctx.fillStyle="rgba(255,255,255,0.4)";
    for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(Math.sin(frame*.03+i*40)*200+200,(frame*.5*((i+1)*.5))%450,1,0,Math.PI*2);ctx.fill();}
    ctx.save();ctx.translate(ship.x,ship.y);ctx.shadowColor=sc;ctx.shadowBlur=16;ctx.fillStyle=sc;ctx.beginPath();ctx.moveTo(0,-14);ctx.lineTo(12,14);ctx.lineTo(0,8);ctx.lineTo(-12,14);ctx.closePath();ctx.fill();ctx.shadowBlur=0;ctx.restore();
    ctx.fillStyle="rgba(240,180,40,0.7)";ctx.beginPath();ctx.ellipse(ship.x,ship.y+16,5,8+Math.random()*6,0,0,Math.PI*2);ctx.fill();
    mets.forEach(m=>{
      m.y+=m.spd;m.rot+=m.rs;
      ctx.save();ctx.translate(m.x,m.y);ctx.rotate(m.rot);ctx.fillStyle="#8060a0";ctx.shadowColor="#c090ff";ctx.shadowBlur=8;ctx.beginPath();
      for(let i=0;i<7;i++){const a=i*Math.PI*2/7,r2=m.r*(i%2===0?1:.7);ctx.lineTo(Math.cos(a)*r2,Math.sin(a)*r2);}
      ctx.closePath();ctx.fill();ctx.shadowBlur=0;ctx.restore();
      if(Math.hypot(ship.x-m.x,ship.y-m.y)<m.r+10){dead=true;onEnd(score);}
    });
    mets=mets.filter(m=>m.y<490);
    setScore(score);
    rafId=requestAnimationFrame(loop);
  }
  const mm=e=>{const r=canvas.getBoundingClientRect();ship.x=Math.max(14,Math.min(386,e.clientX-r.left));};
  const kd=e=>{if(e.key==="ArrowLeft")ship.x=Math.max(14,ship.x-12);if(e.key==="ArrowRight")ship.x=Math.min(386,ship.x+12);};
  canvas.addEventListener("mousemove",mm); document.addEventListener("keydown",kd);
  rafId=requestAnimationFrame(loop);
  return ()=>{cancelAnimationFrame(rafId);canvas.removeEventListener("mousemove",mm);document.removeEventListener("keydown",kd);};
}

// ── TETRIS ───────────────────────────────────────────────────────────────────
function runTetris(canvas, user, setScore, onEnd) {
  canvas.width=240; canvas.height=480;
  const ctx=canvas.getContext("2d");
  const W=10,H=20,CS=24;
  const COLORS=["","#f03050","#f08020","#f0e020","#40c060","#40b0f0","#a040f0","#e050a0"];
  const SHAPES=[
    null,
    [[1,1,1,1]],                      // I
    [[2,0],[2,0],[2,2]],              // J
    [[0,3],[0,3],[3,3]],              // L
    [[4,4],[4,4]],                     // O
    [[0,5,5],[5,5,0]],                 // S
    [[6,6,0],[0,6,6]],                 // Z
    [[0,7,0],[7,7,7]],                 // T
  ];
  let board=Array.from({length:H},()=>Array(W).fill(0));
  let cur,cx,cy,score=0,rafId,dead=false,dropTimer=0,dropInterval=500,lastTime=0;
  function newPiece(){
    const t=Math.floor(Math.random()*7)+1;
    cur=SHAPES[t]; cx=Math.floor((W-cur[0].length)/2); cy=0;
    if(!valid(cur,cx,cy)){dead=true;onEnd(score);}
  }
  function valid(p,ox,oy){return p.every((row,r)=>row.every((v,c)=>!v||((oy+r>=0&&oy+r<H&&ox+c>=0&&ox+c<W)&&!board[oy+r][ox+c])));}
  function merge(){cur.forEach((row,r)=>row.forEach((v,c)=>{if(v)board[cy+r][cx+c]=v;}));}
  function clearLines(){let cleared=0;for(let r=H-1;r>=0;){if(board[r].every(v=>v)){board.splice(r,1);board.unshift(Array(W).fill(0));cleared++;}else r--;}if(cleared){score+=cleared*100*cleared;setScore(score);dropInterval=Math.max(100,500-Math.floor(score/500)*30);}}
  function rotate(p){return p[0].map((_,i)=>p.map(row=>row[i]).reverse());}
  function draw(){
    ctx.fillStyle="#050510"; ctx.fillRect(0,0,240,480);
    board.forEach((row,r)=>row.forEach((v,c)=>{if(v){ctx.fillStyle=COLORS[v];ctx.shadowColor=COLORS[v];ctx.shadowBlur=4;ctx.fillRect(c*CS+1,r*CS+1,CS-2,CS-2);ctx.shadowBlur=0;}}));
    if(cur) cur.forEach((row,r)=>row.forEach((v,c)=>{if(v){ctx.fillStyle=COLORS[v];ctx.shadowColor=COLORS[v];ctx.shadowBlur=8;ctx.fillRect((cx+c)*CS+1,(cy+r)*CS+1,CS-2,CS-2);ctx.shadowBlur=0;}}));
    ctx.strokeStyle="#1a1a3a";ctx.lineWidth=.5;
    for(let x=0;x<=W;x++){ctx.beginPath();ctx.moveTo(x*CS,0);ctx.lineTo(x*CS,480);ctx.stroke();}
    for(let y=0;y<=H;y++){ctx.beginPath();ctx.moveTo(0,y*CS);ctx.lineTo(240,y*CS);ctx.stroke();}
    ctx.fillStyle="#7070a0";ctx.font="11px Orbitron";ctx.textAlign="center";ctx.fillText("SCORE: "+score,120,H*CS+16);
  }
  function gameLoop(ts){
    if(dead) return;
    const dt=ts-lastTime; lastTime=ts; dropTimer+=dt;
    if(dropTimer>=dropInterval){dropTimer=0;if(valid(cur,cx,cy+1))cy++;else{merge();clearLines();newPiece();}}
    draw();
    rafId=requestAnimationFrame(gameLoop);
  }
  const kd=e=>{
    if(dead) return;
    if(e.key==="ArrowLeft"&&valid(cur,cx-1,cy))cx--;
    else if(e.key==="ArrowRight"&&valid(cur,cx+1,cy))cx++;
    else if(e.key==="ArrowDown"){while(valid(cur,cx,cy+1))cy++;merge();clearLines();newPiece();}
    else if(e.key==="ArrowUp"){const r=rotate(cur);if(valid(r,cx,cy))cur=r;}
    else return;
    e.preventDefault(); draw();
  };
  document.addEventListener("keydown",kd);
  canvas.height=H*CS+24;
  newPiece(); rafId=requestAnimationFrame(gameLoop);
  return ()=>{cancelAnimationFrame(rafId);document.removeEventListener("keydown",kd);};
}

// ── MEMORY ───────────────────────────────────────────────────────────────────
function runMemory(canvas, user, setScore, onEnd) {
  canvas.width=420; canvas.height=420;
  const ctx=canvas.getContext("2d");
  const EM=["🍎","🍊","🍋","🍇","🍓","🫐","🍑","🍒"];
  const cards=[...EM,...EM].sort(()=>Math.random()-.5).map((e,i)=>({e,i,x:(i%4)*100+10,y:Math.floor(i/4)*100+10,w:85,h:85,f:false,m:false}));
  let fl=[],score=0,moves=0,blocked=false;
  function draw(){
    ctx.fillStyle="#080812"; ctx.fillRect(0,0,420,420);
    cards.forEach(c=>{
      const back=c.f||c.m;
      ctx.fillStyle=c.m?"#1a3a1a":back?"#1a1a3a":"#1a1030";ctx.shadowColor=c.m?"#40c060":back?"#6040f0":"transparent";ctx.shadowBlur=c.m?8:back?6:0;
      ctx.beginPath();ctx.roundRect(c.x,c.y,c.w,c.h,8);ctx.fill();ctx.shadowBlur=0;
      ctx.strokeStyle=c.m?"#40c060":back?"#6040f0":"#2a2060";ctx.lineWidth=1;ctx.stroke();
      if(back){ctx.font="32px serif";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(c.e,c.x+c.w/2,c.y+c.h/2);}
      else{ctx.fillStyle="#3030a0";ctx.font="bold 24px Orbitron";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("?",c.x+c.w/2,c.y+c.h/2);}
    });
    setScore(score);
  }
  function click(e){
    if(blocked||fl.length>=2) return;
    const r=canvas.getBoundingClientRect(),mx=e.clientX-r.left,my=e.clientY-r.top;
    const c=cards.find(c=>mx>c.x&&mx<c.x+c.w&&my>c.y&&my<c.y+c.h&&!c.f&&!c.m);
    if(!c) return;
    c.f=true;fl.push(c);draw();
    if(fl.length===2){moves++;blocked=true;setTimeout(()=>{
      if(fl[0].e===fl[1].e){fl.forEach(x=>x.m=true);score+=20;if(cards.every(x=>x.m)){onEnd(score+Math.max(0,200-moves*5));return;}}
      else fl.forEach(x=>x.f=false);
      fl=[];blocked=false;draw();
    },800);}
  }
  canvas.addEventListener("click",click); draw();
  return ()=>canvas.removeEventListener("click",click);
}

// ── REACTION ─────────────────────────────────────────────────────────────────
function runReaction(canvas, user, setScore, onEnd) {
  canvas.width=400; canvas.height=300;
  const ctx=canvas.getContext("2d");
  let pos=0,vel=2,score=0,lives=5,round=0,running=true,rafId;
  const ZS=160,ZE=240;
  function draw(){
    ctx.fillStyle="#0a0a08"; ctx.fillRect(0,0,400,300);
    ctx.fillStyle="#1a1a10"; ctx.fillRect(0,120,400,60);
    const g=ctx.createLinearGradient(ZS,0,ZE,0);g.addColorStop(0,"rgba(240,200,40,0)");g.addColorStop(.5,"rgba(240,200,40,0.3)");g.addColorStop(1,"rgba(240,200,40,0)");ctx.fillStyle=g;ctx.fillRect(ZS,120,ZE-ZS,60);
    ctx.strokeStyle="#f0c040";ctx.lineWidth=2;ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(ZS,120);ctx.lineTo(ZS,180);ctx.moveTo(ZE,120);ctx.lineTo(ZE,180);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle="#f03050";ctx.shadowColor="#f03050";ctx.shadowBlur=12;ctx.beginPath();ctx.roundRect(pos,125,10,50,4);ctx.fill();ctx.shadowBlur=0;
    ctx.fillStyle="#7070a0";ctx.font="13px Orbitron";ctx.textAlign="center";ctx.fillText("PRESS SPACE WHEN IN ZONE",200,220);ctx.fillText("♥".repeat(lives)+" ROUND "+(round+1),200,250);
    setScore(score);
  }
  function loop(){if(!running)return;pos+=vel;if(pos>390||pos<0)vel*=-1;draw();rafId=requestAnimationFrame(loop);}
  const kd=e=>{if(e.code!=="Space")return;e.preventDefault();if(!running)return;if(pos>=ZS&&pos<=ZE-10){score+=100;round++;vel=vel<0?-(Math.abs(vel)+.5):Math.abs(vel)+.5;}else{lives--;if(lives<=0){running=false;onEnd(score);return;}}pos=Math.random()<.5?0:390;};
  document.addEventListener("keydown",kd); rafId=requestAnimationFrame(loop);
  return ()=>{cancelAnimationFrame(rafId);document.removeEventListener("keydown",kd);};
}

// ── PONG ─────────────────────────────────────────────────────────────────────
function runPong(canvas, user, setScore, onEnd) {
  canvas.width=480; canvas.height=360;
  const ctx=canvas.getContext("2d");
  let p={x:8,y:160,w:12,h:60},ai={x:460,y:160,w:12,h:60},ball={x:240,y:180,vx:-4,vy:3,r:8},score=0,run=true,rafId;
  function loop(){
    if(!run) return;
    ctx.fillStyle="#040810"; ctx.fillRect(0,0,480,360);
    ctx.strokeStyle="#1a2040";ctx.lineWidth=1;ctx.setLineDash([8,8]);ctx.beginPath();ctx.moveTo(240,0);ctx.lineTo(240,360);ctx.stroke();ctx.setLineDash([]);
    [[p,"#40c0f0"],[ai,"#f03060"]].forEach(([pd,col])=>{ctx.fillStyle=col;ctx.shadowColor=col;ctx.shadowBlur=10;ctx.beginPath();ctx.roundRect(pd.x,pd.y,pd.w,pd.h,4);ctx.fill();ctx.shadowBlur=0;});
    ctx.fillStyle="#fff";ctx.shadowColor="#fff";ctx.shadowBlur=10;ctx.beginPath();ctx.arc(ball.x,ball.y,ball.r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    ctx.fillStyle="#7070a0";ctx.font="14px Orbitron";ctx.textAlign="center";ctx.fillText("SCORE: "+score,240,24);
    ball.x+=ball.vx;ball.y+=ball.vy;
    if(ball.y-ball.r<0||ball.y+ball.r>360)ball.vy*=-1;
    if(ball.x-ball.r<p.x+p.w&&ball.y>p.y&&ball.y<p.y+p.h&&ball.vx<0){ball.vx=Math.abs(ball.vx)+.1;score+=5;setScore(score);}
    if(ball.x+ball.r>ai.x&&ball.y>ai.y&&ball.y<ai.y+ai.h&&ball.vx>0){ball.vx=-Math.abs(ball.vx)-.05;}
    if(ball.x<0){run=false;onEnd(score);return;}
    if(ball.x>480){ball.vx=-Math.abs(ball.vx);ball.x=480-ball.r;}
    const ac=ai.y+ai.h/2,asp=3.2+score*.02;
    if(ac<ball.y-5)ai.y=Math.min(300,ai.y+asp);else if(ac>ball.y+5)ai.y=Math.max(0,ai.y-asp);
    rafId=requestAnimationFrame(loop);
  }
  const kd=e=>{if(e.key==="ArrowUp"||e.key==="w")p.y=Math.max(0,p.y-10);if(e.key==="ArrowDown"||e.key==="s")p.y=Math.min(300,p.y+10);};
  const mm=e=>{const r=canvas.getBoundingClientRect();p.y=Math.max(0,Math.min(300,e.clientY-r.top-p.h/2));};
  document.addEventListener("keydown",kd); canvas.addEventListener("mousemove",mm);
  rafId=requestAnimationFrame(loop);
  return ()=>{cancelAnimationFrame(rafId);document.removeEventListener("keydown",kd);canvas.removeEventListener("mousemove",mm);};
}

// ── FLAPPY BIRD ───────────────────────────────────────────────────────────────
function runFlappy(canvas, user, setScore, onEnd) {
  canvas.width=400; canvas.height=480;
  const ctx=canvas.getContext("2d");
  let bird={x:80,y:240,vy:0},pipes=[],score=0,frame=0,dead=false,started=false,rafId;
  const G=0.35,JUMP=-7,GAP=130,PW=52;
  function spawnPipe(){const top=80+Math.random()*(200);pipes.push({x:420,top,bot:top+GAP});}
  function draw(){
    // BG gradient
    const bg=ctx.createLinearGradient(0,0,0,480);bg.addColorStop(0,"#050a18");bg.addColorStop(1,"#0a1828");ctx.fillStyle=bg;ctx.fillRect(0,0,400,480);
    // Neon grid lines
    ctx.strokeStyle="rgba(40,80,160,0.15)";ctx.lineWidth=1;
    for(let y=0;y<480;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(400,y);ctx.stroke();}
    for(let x=0;x<400;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,480);ctx.stroke();}
    // Pipes
    pipes.forEach(p=>{
      const grad=ctx.createLinearGradient(p.x,0,p.x+PW,0);grad.addColorStop(0,"#a040f0");grad.addColorStop(1,"#6020c0");
      ctx.fillStyle=grad;ctx.shadowColor="#c060ff";ctx.shadowBlur=10;
      ctx.fillRect(p.x,0,PW,p.top);ctx.fillRect(p.x,p.bot,PW,480-p.bot);
      // Pipe caps
      ctx.fillRect(p.x-4,p.top-16,PW+8,16);ctx.fillRect(p.x-4,p.bot,PW+8,16);
      ctx.shadowBlur=0;
    });
    // Bird
    ctx.save();ctx.translate(bird.x,bird.y);ctx.rotate(Math.min(Math.PI/4,bird.vy*0.05));
    ctx.shadowColor="#f06040";ctx.shadowBlur=14;ctx.fillStyle="#f06040";
    ctx.beginPath();ctx.ellipse(0,0,14,10,0,0,Math.PI*2);ctx.fill();
    // Eye
    ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(8,-3,4,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#111";ctx.beginPath();ctx.arc(10,-3,2,0,Math.PI*2);ctx.fill();
    // Wing
    ctx.fillStyle="#e05030";ctx.beginPath();ctx.ellipse(-5,4,8,5,Math.PI/4,0,Math.PI*2);ctx.fill();
    ctx.shadowBlur=0;ctx.restore();
    // Score
    ctx.fillStyle="#f0c040";ctx.font="bold 28px Orbitron";ctx.textAlign="center";ctx.shadowColor="#f0c040";ctx.shadowBlur=8;ctx.fillText(score,200,50);ctx.shadowBlur=0;
    if(!started){ctx.fillStyle="rgba(255,255,255,0.7)";ctx.font="14px Orbitron";ctx.fillText("PRESS SPACE OR CLICK",200,240);}
  }
  function loop(){
    if(dead) return;
    frame++;
    if(started){
      bird.vy+=G; bird.y+=bird.vy;
      if(frame%90===0) spawnPipe();
      pipes.forEach(p=>p.x-=3);
      pipes=pipes.filter(p=>p.x>-60);
      // Score
      pipes.forEach(p=>{if(!p.scored&&p.x+PW<bird.x){p.scored=true;score++;setScore(score);}});
      // Collisions
      if(bird.y<10||bird.y>470){dead=true;onEnd(score);return;}
      pipes.forEach(p=>{if(bird.x+10>p.x&&bird.x-10<p.x+PW&&(bird.y-10<p.top||bird.y+10>p.bot)){dead=true;onEnd(score);}});
    }
    draw();
    rafId=requestAnimationFrame(loop);
  }
  function flap(){if(!dead){bird.vy=JUMP;started=true;}}
  const kd=e=>{if(e.code==="Space"){e.preventDefault();flap();}};
  document.addEventListener("keydown",kd);
  canvas.addEventListener("click",flap);
  rafId=requestAnimationFrame(loop);
  return ()=>{cancelAnimationFrame(rafId);document.removeEventListener("keydown",kd);canvas.removeEventListener("click",flap);};
}

// ═══════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════
const S = {
  root:{minHeight:"100vh",background:"#0a0a12",color:"#e8e8f0",fontFamily:"'Rajdhani',sans-serif",position:"relative"},
  authWrap:{position:"fixed",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"#0a0a12",backgroundImage:"radial-gradient(ellipse 80% 50% at 50% -20%, rgba(60,20,120,.5), transparent), radial-gradient(ellipse 50% 40% at 100% 100%, rgba(20,60,120,.4), transparent)"},
  authBox:{background:"#111120",border:"1px solid #2a2a4a",borderRadius:20,width:"min(440px,94vw)",padding:40,boxShadow:"0 20px 80px rgba(0,0,0,.6)"},
  authLogo:{fontFamily:"'Orbitron',sans-serif",fontWeight:900,fontSize:28,letterSpacing:4,background:"linear-gradient(135deg,#f0c040,#e05090)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",textAlign:"center",marginBottom:8},
  authSub:{textAlign:"center",color:"#7070a0",fontSize:13,marginBottom:32,letterSpacing:2},
  authTabs:{display:"flex",background:"#1a1a2e",borderRadius:10,padding:4,marginBottom:28,gap:4},
  authTab:{flex:1,padding:10,textAlign:"center",borderRadius:7,cursor:"pointer",fontFamily:"'Orbitron',sans-serif",fontSize:11,letterSpacing:2,color:"#7070a0",transition:".2s"},
  authTabActive:{background:"#16162a",color:"#f0c040",border:"1px solid #2a2a4a"},
  authErr:{background:"rgba(224,80,144,.15)",border:"1px solid #e05090",borderRadius:8,padding:"10px 14px",fontSize:13,color:"#e05090",marginBottom:14},
  authBtn:{width:"100%",padding:14,background:"linear-gradient(135deg,#f0c040,#e08020)",color:"#111",border:"none",borderRadius:10,fontFamily:"'Orbitron',sans-serif",fontSize:13,letterSpacing:2,fontWeight:700,cursor:"pointer",marginTop:4},
  input:{width:"100%",background:"#1a1a2e",border:"1px solid #2a2a4a",borderRadius:8,padding:"12px 14px",color:"#e8e8f0",fontFamily:"'Rajdhani',sans-serif",fontSize:15,outline:"none"},
  header:{position:"sticky",top:0,zIndex:100,background:"rgba(10,10,18,.95)",backdropFilter:"blur(12px)",borderBottom:"1px solid #2a2a4a",padding:"0 24px",display:"flex",alignItems:"center",justifyContent:"space-between",height:60},
  logo:{fontFamily:"'Orbitron',sans-serif",fontWeight:900,fontSize:22,letterSpacing:4,background:"linear-gradient(135deg,#f0c040,#e05090)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"},
  coinBadge:{display:"flex",alignItems:"center",gap:8,background:"#1a1a2e",border:"1px solid #f0c040",borderRadius:24,padding:"6px 16px",fontFamily:"'Orbitron',sans-serif",fontSize:14,color:"#f0c040"},
  lvlBadge:{background:"linear-gradient(135deg,#4020a0,#2040c0)",borderRadius:24,padding:"6px 14px",fontSize:13,fontWeight:600,letterSpacing:1},
  userBtn:{background:"#1a1a2e",border:"1px solid #2a2a4a",borderRadius:24,padding:"6px 14px",fontSize:13,color:"#7070a0",cursor:"pointer",fontFamily:"'Rajdhani',sans-serif",fontWeight:600,whiteSpace:"nowrap"},
  tabBar:{display:"flex",gap:4,padding:"20px 24px 0",position:"relative",zIndex:1},
  tab:{padding:"10px 22px",borderRadius:"8px 8px 0 0",border:"1px solid #2a2a4a",borderBottom:"none",background:"#111120",color:"#7070a0",cursor:"pointer",fontFamily:"'Rajdhani',sans-serif",fontSize:15,fontWeight:600,letterSpacing:1,textTransform:"uppercase"},
  tabActive:{background:"#1a1a2e",color:"#f0c040",borderBottomColor:"#1a1a2e"},
  main:{position:"relative",zIndex:1,padding:"0 24px 40px",background:"#1a1a2e",border:"1px solid #2a2a4a",borderTop:"none",minHeight:"calc(100vh - 100px)",borderRadius:"0 0 16px 16px"},
  sectionTitle:{fontFamily:"'Orbitron',sans-serif",fontSize:13,letterSpacing:3,color:"#7070a0",textTransform:"uppercase",marginBottom:20,paddingTop:28},
  gamesGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:16},
  gameCard:{background:"#16162a",border:"1px solid #2a2a4a",borderRadius:12,overflow:"hidden",transition:"all .25s"},
  gameThumb:{height:120,display:"flex",alignItems:"center",justifyContent:"center",position:"relative"},
  thumbOverlay:{position:"absolute",inset:0,background:"linear-gradient(to bottom, transparent 40%, #16162a)"},
  lockBadge:{position:"absolute",top:10,right:10,background:"rgba(0,0,0,.7)",border:"1px solid #f0c040",borderRadius:20,padding:"4px 10px",fontSize:11,color:"#f0c040",fontFamily:"'Orbitron',sans-serif"},
  skinBadge:{position:"absolute",top:10,left:10,background:"rgba(224,80,144,.2)",border:"1px solid #e05090",borderRadius:20,padding:"3px 8px",fontSize:10,color:"#e05090",fontFamily:"'Orbitron',sans-serif"},
  gameName:{fontFamily:"'Orbitron',sans-serif",fontSize:13,fontWeight:700,letterSpacing:1,marginBottom:4},
  gameDesc:{fontSize:13,color:"#7070a0",marginBottom:10},
  shopGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:14},
  shopCard:{background:"#16162a",border:"1px solid #2a2a4a",borderRadius:12,padding:20,textAlign:"center",transition:".2s"},
  lbGameTab:{padding:"8px 16px",borderRadius:8,border:"1px solid #2a2a4a",background:"#16162a",color:"#7070a0",cursor:"pointer",fontFamily:"'Orbitron',sans-serif",fontSize:10,letterSpacing:1,transition:".2s"},
  lbRow:{display:"flex",alignItems:"center",gap:16,background:"#16162a",border:"1px solid #2a2a4a",borderRadius:10,padding:"14px 20px",marginBottom:10},
  lbRank:{fontFamily:"'Orbitron',sans-serif",fontSize:16,fontWeight:700,width:32,textAlign:"center",color:"#7070a0"},
  overlayBg:{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)"},
  overlayModal:{background:"#111120",border:"1px solid #2a2a4a",borderRadius:16,width:"min(760px,96vw)",maxHeight:"90vh",overflow:"hidden",display:"flex",flexDirection:"column"},
  modalHeader:{padding:"16px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid #2a2a4a"},
  closeBtn:{background:"none",border:"1px solid #2a2a4a",color:"#e8e8f0",borderRadius:8,width:36,height:36,cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"},
  btnPrimary:{padding:"10px 28px",borderRadius:8,fontFamily:"'Orbitron',sans-serif",fontSize:12,letterSpacing:2,fontWeight:700,cursor:"pointer",border:"none",background:"linear-gradient(135deg,#f0c040,#e08020)",color:"#111"},
  btnSmallPrimary:{padding:"6px 16px",borderRadius:7,fontFamily:"'Orbitron',sans-serif",fontSize:10,letterSpacing:1,fontWeight:700,cursor:"pointer",border:"none",background:"linear-gradient(135deg,#f0c040,#e08020)",color:"#111"},
  btnSmallSecondary:{padding:"6px 16px",borderRadius:7,fontFamily:"'Orbitron',sans-serif",fontSize:10,letterSpacing:1,fontWeight:700,cursor:"pointer",background:"transparent",border:"1px solid #40c0f0",color:"#40c0f0"},
  toast:{position:"fixed",bottom:30,right:24,background:"#1a1a2e",border:"1px solid #60e090",borderRadius:12,padding:"14px 20px",fontSize:14,zIndex:999,maxWidth:300,pointerEvents:"none"},
};
