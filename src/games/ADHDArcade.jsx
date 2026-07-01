import { useState, useEffect, useRef, useCallback, memo } from "react";
import { useArcadeBackButton } from "../arcadeChrome.js";
import { useArcadeScore } from "../lib/scores.js";
import { lsGetJSON, lsSetJSON } from "../lib/store.js";

// Map each minigame's short internal key (the `game` prop on GameOver/GameHUD)
// to its registry gameId, so a game-over run lands on the right board under the
// Arcade Score Standard. A key missing here simply isn't submitted.
const SCORE_GAME_IDS = {
  tapsurge: "tap-surge",
  colorpanic: "color-panic",
  pianotiles: "piano-tiles",
  splitter: "splitter",
};

export const GLOBAL_CSS =`
  @import url('https://fonts.googleapis.com/css2?family=Black+Ops+One&family=Share+Tech+Mono&display=swap');
  * { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  body { margin:0; background:#08080f; overflow:hidden; touch-action:none; }
  @keyframes popIn    { 0%{transform:scale(0) rotate(-12deg);opacity:0} 65%{transform:scale(1.2) rotate(2deg)} 100%{transform:scale(1) rotate(0);opacity:1} }
  @keyframes pulse    { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.55;transform:scale(0.92)} }
  @keyframes slideUp  { from{transform:translateY(30px);opacity:0} to{transform:translateY(0);opacity:1} }
  @keyframes floatUp  { 0%{transform:translate(-50%,-50%);opacity:1} 100%{transform:translate(-50%,-130%);opacity:0} }
  @keyframes countPop { 0%{transform:scale(1.7);opacity:0} 60%{opacity:1} 100%{transform:scale(1);opacity:1} }
  @keyframes wrongFlash { 0%,100%{background:transparent} 50%{background:rgba(255,45,78,0.22)} }
  @keyframes pop      { 0%{transform:scale(0.3)} 70%{transform:scale(1.1)} 100%{transform:scale(1)} }
  @keyframes glow     { 0%,100%{filter:brightness(1)} 50%{filter:brightness(1.5)} }
  @keyframes graceFlash { 0%,100%{opacity:1} 50%{opacity:0.3} }
  @keyframes surgeRing  { from{stroke-dashoffset:0} to{stroke-dashoffset:var(--circ)} }
  @keyframes surgeDanger{ 0%,100%{box-shadow:inset 0 0 0 0 rgba(255,45,78,0);background:rgba(255,45,78,0)} 50%{box-shadow:inset 0 0 120px 18px rgba(255,45,78,0.6);background:rgba(255,45,78,0.07)} }
  @keyframes surgeDeath { 0%{transform:translate(0,0)} 15%{transform:translate(-9px,5px)} 30%{transform:translate(8px,-6px)} 45%{transform:translate(-7px,-4px)} 60%{transform:translate(6px,6px)} 75%{transform:translate(-4px,3px)} 100%{transform:translate(0,0)} }
  @keyframes ptBurst  { 0%{transform:scale(0.4);opacity:0.95} 100%{transform:scale(1.7);opacity:0} }
  @keyframes ptRipple { 0%{transform:scale(0.2);opacity:0.8} 100%{transform:scale(1.6);opacity:0} }
  @keyframes ptBar    { 0%,100%{filter:brightness(1)} 50%{filter:brightness(1.6)} }
  @keyframes ptFlourish { 0%{transform:scale(0.6);opacity:0} 40%{transform:scale(1.12);opacity:1} 100%{transform:scale(1);opacity:0} }
  @keyframes ptMiss   { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-5px)} 40%{transform:translateX(5px)} 60%{transform:translateX(-3px)} 80%{transform:translateX(3px)} }
  @keyframes ptMissFlash { 0%{opacity:0} 25%{opacity:1} 100%{opacity:0} }
`;

const T = {
  bg:"#08080f", surface:"#0f0f1e",
  surge:"#ff9500", panic:"#bf5af2",
  danger:"#30d158", splitter:"#0a84ff",
  red:"#ff2d55", gold:"#ffd60a",
};

const rand  = (a,b) => Math.random()*(b-a)+a;
const randI = (a,b) => Math.floor(rand(a,b+1));
const uid   = () => Math.random().toString(36).slice(2,9);
const clamp = (v,lo,hi) => Math.max(lo,Math.min(hi,v));

// ═══════════════════════════════════════════════════════════════════
//  SOUND ENGINE — satisfying pop/bubble sounds via Web Audio
// ═══════════════════════════════════════════════════════════════════
let _ctx = null;
function getCtx() {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (_ctx.state === "suspended") _ctx.resume();
  return _ctx;
}

// Soft rounded "bubble pop" — sine wave with gentle attack, quick tail,
// slight pitch drop. Gain kept low for a muted, satisfying feel.
function pop({ freq=480, gain=0.13, dur=0.09, sweep=0.68 }={}) {
  try {
    const ctx = getCtx();
    // Slight low-pass so it never feels harsh
    const osc  = ctx.createOscillator();
    const filt = ctx.createBiquadFilter();
    const env  = ctx.createGain();
    osc.connect(filt); filt.connect(env); env.connect(ctx.destination);
    osc.type = "sine";
    filt.type = "lowpass"; filt.frequency.value = freq * 2.2; filt.Q.value = 0.5;
    const t = ctx.currentTime;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * sweep, t + dur);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(gain, t + 0.006);   // soft attack
    env.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.02);
    osc.start(t); osc.stop(t + dur + 0.04);
  } catch {}
}

// Muted dull thud for errors — low sine, no harsh noise
function thwack({ freq=160, gain=0.11, dur=0.13 }={}) {
  try {
    const ctx = getCtx();
    const osc  = ctx.createOscillator();
    const filt = ctx.createBiquadFilter();
    const env  = ctx.createGain();
    osc.connect(filt); filt.connect(env); env.connect(ctx.destination);
    osc.type = "sine";
    filt.type = "lowpass"; filt.frequency.value = 500; filt.Q.value = 0.7;
    const t = ctx.currentTime;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.55, t + dur);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(gain, t + 0.008);
    env.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.02);
    osc.start(t); osc.stop(t + dur + 0.04);
  } catch {}
}

// Airy shimmer for combos — two soft sine partials
function sparkle({ freq=700, gain=0.08, dur=0.1 }={}) {
  try {
    const ctx = getCtx();
    [1, 1.5].forEach((ratio, i) => {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.connect(env); env.connect(ctx.destination);
      osc.type = "sine";
      const t = ctx.currentTime + i * 0.04;
      const f = freq * ratio;
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.exponentialRampToValueAtTime(f * 0.75, t + dur);
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(gain * (1 - i * 0.35), t + 0.005);
      env.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.start(t); osc.stop(t + dur + 0.02);
    });
  } catch {}
}

// Gentle ascending chime
function chime(freqs=[523,659,784], delay=60) {
  freqs.forEach((f,i) => setTimeout(()=>pop({freq:f, gain:0.1, dur:0.1, sweep:0.78}), i*delay));
}

const SFX = {
  // Tap Surge
  surgeTap: (combo=0) => {
    const base = 380 + combo * 22;
    pop({ freq:base, gain:0.13, dur:0.09, sweep:0.65 });
    if (combo >= 3) setTimeout(()=>sparkle({freq:base*1.4, gain:0.07, dur:0.09}), 35);
  },
  surgeCombo: (combo) => {
    const scale = [523,587,659,740,784,880,988,1047];
    const f = scale[Math.min(combo-3, scale.length-1)];
    chime([f, f*1.25], 50);
  },
  surgeWrongTap: () => thwack({ freq:140, gain:0.1, dur:0.1 }),
  surgeMiss:     () => thwack({ freq:110, gain:0.13, dur:0.14 }),
  surgeDanger:   () => { pop({ freq:880, gain:0.12, dur:0.09, sweep:1 }); setTimeout(()=>pop({ freq:660, gain:0.11, dur:0.12, sweep:1 }), 100); },

  // Color Panic
  panicHit: (combo=0) => {
    const base = 320 + combo * 16;
    pop({ freq:base, gain:0.12, dur:0.09, sweep:0.68 });
    if (combo >= 5) setTimeout(()=>sparkle({freq:base*1.8, gain:0.07}), 30);
  },
  panicWrong:  () => thwack({ freq:130, gain:0.11, dur:0.12 }),
  panicChange: () => chime([600, 800, 1000], 65),
  panicMiss:   () => thwack({ freq:120, gain:0.1, dur:0.13 }),

  // Danger Dots
  dangerGreen: (combo=0) => {
    pop({ freq:340 + combo*18, gain:0.13, dur:0.08, sweep:0.65 });
  },
  dangerRed:  () => {
    thwack({ freq:90, gain:0.14, dur:0.17 });
    setTimeout(()=>thwack({ freq:65, gain:0.09, dur:0.12 }), 110);
  },
  dangerMiss: () => thwack({ freq:100, gain:0.11, dur:0.14 }),

  // Splitter
  splitterTap: (level=0) => {
    const freqs = [420, 540, 660, 820];
    pop({ freq:freqs[Math.min(level,3)], gain:0.13, dur:0.09, sweep:0.62 });
  },
  splitterSplit: () => {
    pop({ freq:460, gain:0.1, dur:0.08, sweep:0.72 });
    setTimeout(()=>pop({ freq:600, gain:0.08, dur:0.08, sweep:0.72 }), 55);
  },
  splitterMiss: () => thwack({ freq:85, gain:0.13, dur:0.16 }),

  // Shared
  loseLife: () => {
    thwack({ freq:140, gain:0.13, dur:0.18 });
    setTimeout(()=>thwack({ freq:95, gain:0.09, dur:0.14 }), 130);
  },
  gameOver: () => {
    [200,160,120,90].forEach((f,i)=>
      setTimeout(()=>thwack({freq:f, gain:0.1, dur:0.17}), i*140));
  },
  countdown:    () => pop({ freq:440, gain:0.1, dur:0.07, sweep:0.82 }),
  countdownGo:  () => chime([523, 659, 784, 1047], 55),
};

// ═══════════════════════════════════════════════════════════════════
//  SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════════════
function useInterval(cb, delay) {
  const ref = useRef(cb);
  useEffect(()=>{ref.current=cb;},[cb]);
  useEffect(()=>{
    if(delay===null) return;
    const id=setInterval(()=>ref.current(),delay);
    return ()=>clearInterval(id);
  },[delay]);
}

function ScorePopup({x,y,value,color,negative}) {
  return (
    <div style={{
      position:"absolute",left:x,top:y,pointerEvents:"none",
      fontFamily:"'Black Ops One'",fontSize:negative?17:22,
      color:negative?T.red:color,
      animation:"floatUp 0.75s ease-out forwards",
      zIndex:999,textShadow:`0 0 10px ${negative?T.red:color}`,
      transform:"translate(-50%,-50%)",
    }}>{negative?value:`+${value}`}</div>
  );
}

function Countdown({n,color}) {
  useEffect(()=>{n===0?SFX.countdownGo():SFX.countdown();},[n]);
  return (
    <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",zIndex:30,background:"rgba(8,8,15,0.55)"}}>
      <div style={{fontFamily:"'Black Ops One'",fontSize:n===0?56:110,color,textShadow:`0 0 30px ${color}, 0 0 60px ${color}55`,animation:"countPop 0.55s ease"}}>{n===0?"GO!":n}</div>
    </div>
  );
}

const HS_KEY = "adhd_arcade";              // → ourcade:adhd_arcade (prefix added by util)
const HS_KEY_LEGACY = "adhd_arcade_v3";    // pre-convention key; migrated once via lsGet
function loadHS(){
  // lsGetJSON transparently carries the legacy un-prefixed blob over the first
  // time it's read, so existing bests survive the rename.
  return lsGetJSON(HS_KEY, {}, HS_KEY_LEGACY) || {};
}
function saveHS(game,score){
  const hs=loadHS();
  if(!hs[game]||score>hs[game]){hs[game]=score;lsSetJSON(HS_KEY,hs);}
  return Math.max(score,hs[game]||0);
}

function GameHUD({score,lives,color,label,combo,onExit,extra}) {
  const hs=loadHS();
  const key=label.toLowerCase().replace(/ /g,"");
  return (
    <div style={{position:"absolute",top:0,left:0,right:0,height:62,display:"flex",alignItems:"center",padding:"0 10px",gap:8,background:`linear-gradient(${T.surface}f0,transparent)`,zIndex:100,borderBottom:"1px solid #ffffff08"}}>
      <button onPointerDown={onExit} style={{background:"#ffffff08",border:"1px solid #ffffff12",color:"#ffffff55",padding:"5px 10px",borderRadius:4,fontFamily:"'Share Tech Mono'",fontSize:12,cursor:"pointer",flexShrink:0}}>←</button>
      <span style={{fontFamily:"'Black Ops One'",fontSize:13,color,textShadow:`0 0 8px ${color}`,flexShrink:0}}>{label}</span>
      <div style={{flex:1}}/>
      {extra&&<span style={{color:"#ffffff33",fontFamily:"'Share Tech Mono'",fontSize:9,letterSpacing:1}}>{extra}</span>}
      {combo>=3&&<span style={{color:T.gold,fontFamily:"'Black Ops One'",fontSize:12,textShadow:`0 0 8px ${T.gold}`,animation:"pulse 0.5s infinite"}}>×{combo}</span>}
      <span style={{color:"#ffffff28",fontFamily:"'Share Tech Mono'",fontSize:9}}>BEST <span style={{color}}>{hs[key]||0}</span></span>
      <span style={{fontFamily:"'Black Ops One'",fontSize:22,color,textShadow:`0 0 10px ${color}`,minWidth:44,textAlign:"right"}}>{score}</span>
      <div style={{display:"flex",gap:3,flexShrink:0}}>
        {[0,1,2].map(i=>(
          <div key={i} style={{width:9,height:9,borderRadius:"50%",background:i<lives?color:"#ffffff12",boxShadow:i<lives?`0 0 6px ${color}`:"none",transition:"all 0.25s"}}/>
        ))}
      </div>
    </div>
  );
}

function GameOver({score,color,game,onRestart,onExit}) {
  const best=saveHS(game,score);
  const isNew=score>0&&score>=best;
  // Submit to the shared high-score board (claimed accounts only; the hook
  // no-ops for anon / unmapped games and only raises a beaten score).
  const { submit } = useArcadeScore(SCORE_GAME_IDS[game]);
  useEffect(()=>{SFX.gameOver();},[]);
  useEffect(()=>{ if(SCORE_GAME_IDS[game]) submit(score); },[]); // once per game-over

  return (
    <div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:14,background:T.bg}}>
      <div style={{fontFamily:"'Black Ops One'",fontSize:40,color,textShadow:`0 0 30px ${color}`,animation:"pop 0.5s cubic-bezier(0.34,1.56,0.64,1)"}}>GAME OVER</div>
      {isNew&&<div style={{fontFamily:"'Share Tech Mono'",fontSize:10,letterSpacing:5,color:T.gold,textShadow:`0 0 8px ${T.gold}`,animation:"pulse 0.9s infinite"}}>★ NEW BEST ★</div>}
      <div style={{fontFamily:"'Black Ops One'",fontSize:64,color,textShadow:`0 0 20px ${color}`,lineHeight:1}}>{score}</div>
      <div style={{color:"#ffffff22",fontFamily:"'Share Tech Mono'",fontSize:10,letterSpacing:2}}>BEST: {best}</div>
      <div style={{display:"flex",gap:12,marginTop:12}}>
        <ArcadeBtn color={color} onClick={onRestart}>RETRY</ArcadeBtn>
        <ArcadeBtn color="#ffffff33" onClick={onExit}>MENU</ArcadeBtn>
      </div>
    </div>
  );
}

function ArcadeBtn({color,onClick,children}) {
  return (
    <button onPointerDown={onClick} style={{background:`${color}18`,border:`2px solid ${color}44`,color,padding:"10px 24px",borderRadius:6,fontFamily:"'Black Ops One'",fontSize:13,letterSpacing:3,cursor:"pointer",textShadow:`0 0 8px ${color}`}}>{children}</button>
  );
}


// Speed helpers — slow ramp, high cap
// Spawn: 2200ms (very chill) → 300ms (insane) over 0–3000 score
// Life:  5500ms → 800ms over same range
function surgeSpawnMs(score) {
  const t = Math.min(score / 3000, 1);         // 0–1 normalised over 3000 score
  const curved = Math.pow(t, 1.8);             // ease-in, very slow start
  return Math.round(2200 - curved * 1900);     // 2200ms → 300ms
}
function surgeLifeMs(score) {
  const t = Math.min(score / 3000, 1);
  const curved = Math.pow(t, 1.8);
  return Math.round(5500 - curved * 4700);     // 5500ms → 800ms
}

// Color: green at 0 score → yellow mid → red at max speed
function surgeNodeColor(score) {
  const t = Math.min(score / 3000, 1);         // 0=slow(green) → 1=fast(red)
  // hue: 120=green, 60=yellow, 0=red
  const hue = Math.round(120 - t * 120);
  const sat = 90 + Math.round(t * 10);         // slightly more saturated at red end
  const lit = 52 + Math.round(t * 6);          // slightly brighter at red
  return `hsl(${hue},${sat}%,${lit}%)`;
}

// ═══════════════════════════════════════════════════════════════════
//  GAME 1: TAP SURGE
//  - ANY dot on screen can be tapped (no ordering)
//  - Any dot that expires untapped = 1 miss. 3 misses = game over.
//  - Tapping outside dots = score penalty (scales with score)
//  - Color: green (slow) → yellow → red (fast)
//  - Smaller play area, slower speed curve
// ═══════════════════════════════════════════════════════════════════
const SURGE_GRACE_MS = 400;   // anti-instakill: count at most one miss per window

export function TapSurge({onExit}) {
  const [nodes,setNodes]         = useState([]);
  const [score,setScore]         = useState(0);
  const [misses,setMisses]       = useState(0);
  const [running,setRunning]     = useState(false);
  const [countdown,setCountdown] = useState(3);
  const [gameOver,setGameOver]   = useState(false);
  const [popups,setPopups]       = useState([]);
  const [combo,setCombo]         = useState(0);
  const [flashWrong,setFlashWrong] = useState(false);
  const [dotColor,setDotColor]   = useState(surgeNodeColor(0));
  const [dying,setDying]         = useState(false);

  const areaRef     = useRef(null);
  const nodesRef    = useRef([]);
  const comboRef    = useRef(0);
  const scoreRef    = useRef(0);
  const missRef     = useRef(0);
  const gameOverRef = useRef(false);
  const spawnTimer  = useRef(null);
  const lastMissRef = useRef(0);     // anti-instakill: gate misses to 1 per window

  nodesRef.current = nodes;
  comboRef.current = combo;

  useEffect(()=>{
    if(countdown<=0){setRunning(true);return;}
    const t=setTimeout(()=>setCountdown(c=>c-1),1000);
    return()=>clearTimeout(t);
  },[countdown]);

  const addPopup=useCallback((x,y,val,neg=false)=>{
    const color=neg?T.red:surgeNodeColor(scoreRef.current);
    const id=uid();
    setPopups(p=>[...p,{id,x,y,val,color,neg}]);
    setTimeout(()=>setPopups(p=>p.filter(pp=>pp.id!==id)),750);
  },[]);

  // Pure ref-based miss counter — zero stale closure risk
  const recordMiss=useCallback(()=>{
    if(gameOverRef.current) return;
    // Anti-instakill grace: at top speed several dots can expire in the same
    // instant. Count at most one miss per GRACE_MS so a full-life run can't end
    // in a single frame — the dot is still cleared by the expiry handler.
    const now=Date.now();
    if(now-lastMissRef.current<SURGE_GRACE_MS) return;
    lastMissRef.current=now;
    missRef.current+=1;
    setMisses(missRef.current);
    setFlashWrong(true);
    setTimeout(()=>setFlashWrong(false),420);
    if(missRef.current>=3){
      // Fatal miss — freeze the field, play a short death beat, then reveal the
      // game-over screen so the end feels earned rather than instant.
      gameOverRef.current=true;
      clearTimeout(spawnTimer.current);
      SFX.loseLife();
      setRunning(false);
      setDying(true);
      setTimeout(()=>setGameOver(true),520);
    }else if(missRef.current>=2){
      // One life left — warn the player.
      SFX.surgeDanger();
    }else{
      SFX.loseLife();
    }
  },[]); // intentionally no deps — touches refs only

  const doSpawn=useCallback(()=>{
    if(gameOverRef.current||!areaRef.current) return;
    const rect=areaRef.current.getBoundingClientRect();
    // Play area: 55% wide × 52% tall, centred
    const pw=rect.width*0.55,  ph=rect.height*0.52;
    const ox=(rect.width-pw)/2, oy=(rect.height-ph)/2;
    const pad=40;
    const life=surgeLifeMs(scoreRef.current);
    const id=uid();
    const x=rand(ox+pad, ox+pw-pad);
    const y=rand(oy+pad, oy+ph-pad);
    const color=surgeNodeColor(scoreRef.current);
    setDotColor(color);
    setNodes(n=>[...n,{id,x,y,born:Date.now(),lifeMs:life,color}]);
    // Expiry — any dot that goes untapped is a miss
    setTimeout(()=>{
      if(gameOverRef.current) return;
      setNodes(prev=>{
        const still=prev.find(nd=>nd.id===id);
        if(still) recordMiss();           // was still on screen = missed
        return prev.filter(nd=>nd.id!==id);
      });
    }, life);
  },[recordMiss]);

  const scheduleNext=useCallback(()=>{
    if(gameOverRef.current) return;
    const ms=surgeSpawnMs(scoreRef.current);
    spawnTimer.current=setTimeout(()=>{
      if(gameOverRef.current) return;
      doSpawn();
      scheduleNext();
    }, ms);
  },[doSpawn]);

  useEffect(()=>{
    if(!running) return;
    doSpawn();
    scheduleNext();
    return()=>clearTimeout(spawnTimer.current);
  },[running]);

  // Tap any dot — any dot tapped scores
  const tapNode=useCallback((node,progress,e)=>{
    e.stopPropagation();
    if(gameOverRef.current) return;
    setNodes(n=>n.filter(nd=>nd.id!==node.id));
    const newCombo=comboRef.current+1;
    setCombo(newCombo);
    const speedBonus=Math.round(progress*20);
    const comboMult=newCombo>=10?4:newCombo>=5?2:1;
    const pts=(10+speedBonus)*comboMult;
    scoreRef.current+=pts;
    setScore(scoreRef.current);
    SFX.surgeTap(newCombo);
    if(newCombo>=3) setTimeout(()=>SFX.surgeCombo(newCombo),30);
    addPopup(node.x,node.y-22,pts);
  },[addPopup]);

  // Tap outside — penalty scales with current score (faster game = bigger penalty)
  const handleAreaTap=useCallback((e)=>{
    if(gameOverRef.current||!areaRef.current) return;
    const rect=areaRef.current.getBoundingClientRect();
    const touch=e.touches?.[0]||e;
    const px=(touch.clientX||e.clientX)-rect.left;
    const py=(touch.clientY||e.clientY)-rect.top;
    // Forgiving backstop: a near-miss just outside the dot costs nothing. Widen it
    // on small screens (shaky thumbs) — scales with play-area width, clamped 40–64px.
    const hitR=Math.max(40,Math.min(64,rect.width*0.11));
    const hitAny=nodesRef.current.some(nd=>{
      const dx=px-nd.x,dy=py-nd.y;
      return Math.sqrt(dx*dx+dy*dy)<hitR;
    });
    if(hitAny) return;
    SFX.surgeWrongTap();
    // Base penalty 5, scales up with score: +1 per 50 score, capped at 50.
    // Losing the combo (below) is already a steep hit, so no extra combo tax.
    const penalty=Math.min(50, 5+Math.floor(scoreRef.current/50));
    scoreRef.current=Math.max(0,scoreRef.current-penalty);
    setScore(scoreRef.current);
    setCombo(0);
    setFlashWrong(true);
    setTimeout(()=>setFlashWrong(false),280);
    addPopup(px,py,penalty,true);
  },[addPopup]);

  const restart=()=>{
    clearTimeout(spawnTimer.current);
    gameOverRef.current=false; missRef.current=0; scoreRef.current=0; lastMissRef.current=0;
    setNodes([]);setScore(0);setMisses(0);setCombo(0);
    setDotColor(surgeNodeColor(0));
    setGameOver(false);setCountdown(3);setRunning(false);setDying(false);
  };

  if(gameOver) return <GameOver score={score} color={dotColor} game="tapsurge" onRestart={restart} onExit={onExit}/>;

  const hudColor=dotColor;
  const danger=misses>=2;   // one life left
  // Difficulty progress, derived from score so the bar moves smoothly with every
  // tap/penalty instead of jumping only on spawn (matches the spawn/life curves).
  const speedPct=Math.round(Math.min(score/3000,1)*100);
  // Combo multiplier mirrors the scoring logic in tapNode (×2 at 5, ×4 at 10).
  const comboMult=combo>=10?4:combo>=5?2:1;
  return (
    <div
      style={{width:"100%",height:"100%",position:"relative",overflow:"hidden",
        animation:dying?"surgeDeath 0.5s ease":flashWrong?"wrongFlash 0.35s ease":"none"}}
      onPointerDown={handleAreaTap}
    >
      {/* last-life danger vignette */}
      {danger&&<div style={{position:"absolute",inset:0,zIndex:90,pointerEvents:"none",animation:"surgeDanger 0.9s ease-in-out infinite"}}/>}
      <div style={{position:"absolute",top:0,left:0,right:0,height:62,display:"flex",alignItems:"center",padding:"0 10px",gap:8,background:`linear-gradient(${T.surface}f0,transparent)`,zIndex:100,borderBottom:"1px solid #ffffff08"}}>
        <button onPointerDown={onExit} style={{background:"#ffffff08",border:"1px solid #ffffff12",color:"#ffffff55",padding:"5px 10px",borderRadius:4,fontFamily:"'Share Tech Mono'",fontSize:12,cursor:"pointer",flexShrink:0}}>←</button>
        <span style={{fontFamily:"'Black Ops One'",fontSize:13,color:hudColor,textShadow:`0 0 8px ${hudColor}`,flexShrink:0,transition:"color 1.5s"}}>TAP SURGE</span>
        <div style={{flex:1}}/>
        {speedPct>0&&<span style={{color:"#ffffff28",fontFamily:"'Share Tech Mono'",fontSize:9}}>{speedPct}% MAX</span>}
        {comboMult>1&&<span style={{color:T.gold,fontFamily:"'Black Ops One'",fontSize:12,textShadow:`0 0 8px ${T.gold}`,animation:"pulse 0.5s infinite"}}>×{comboMult}</span>}
        <span style={{color:"#ffffff28",fontFamily:"'Share Tech Mono'",fontSize:9}}>BEST <span style={{color:hudColor}}>{loadHS()["tapsurge"]||0}</span></span>
        <span style={{fontFamily:"'Black Ops One'",fontSize:22,color:hudColor,textShadow:`0 0 10px ${hudColor}`,minWidth:44,textAlign:"right",transition:"color 1.5s"}}>{score}</span>
        <div style={{display:"flex",gap:3,flexShrink:0,animation:danger?"pulse 0.6s infinite":"none"}}>
          {[0,1,2].map(i=>{
            const lit=i<(3-misses);
            return (
            <div key={i} style={{
              width:9,height:9,borderRadius:"50%",
              background:lit?(danger?T.red:hudColor):"#ff2d5540",
              boxShadow:lit?`0 0 6px ${danger?T.red:hudColor}`:"0 0 4px #ff2d5555",
              transition:"all 0.3s",
            }}/>
          );})}
        </div>
      </div>
      <div ref={areaRef} style={{position:"absolute",inset:0,top:62}}>
        {!running&&countdown>=0&&<Countdown n={countdown} color={surgeNodeColor(0)}/>}
        {nodes.map(node=>(
          <TapSurgeNode key={node.id} node={node} onTap={tapNode}/>
        ))}
        {popups.map(p=>(
          <ScorePopup key={p.id} x={p.x} y={p.y} value={p.val} color={p.color} negative={p.neg}/>
        ))}
      </div>
    </div>
  );
}

// Memoized: the depleting ring is a pure CSS animation (compositor-driven, no
// per-frame React state), so a node never needs to re-render after it mounts.
// Tap timing is read from elapsed life at tap time instead of a ticking ref.
const TapSurgeNode = memo(function TapSurgeNode({node,onTap}) {
  const size=64, r=27;
  const circ=Math.PI*2*r;
  const nodeCol=node.color||"#30d158";
  const tapProgress=()=>Math.max(0,1-(Date.now()-node.born)/node.lifeMs);

  return (
    <div
      onPointerDown={e=>{e.stopPropagation();onTap(node,tapProgress(),e);}}
      style={{position:"absolute",left:node.x-size/2,top:node.y-size/2,width:size,height:size,cursor:"pointer",animation:"popIn 0.2s cubic-bezier(0.34,1.56,0.64,1)"}}
    >
      <svg width={size} height={size} style={{position:"absolute",inset:0,overflow:"visible"}}>
        <circle cx={size/2} cy={size/2} r={r+4} fill="none" stroke={`${nodeCol}14`} strokeWidth={7}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#ffffff08" strokeWidth={4}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke={nodeCol} strokeWidth={3.5}
          strokeDasharray={circ} strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`}
          style={{["--circ"]:circ, strokeDashoffset:0, animation:`surgeRing ${node.lifeMs}ms linear forwards`}}
        />
        <circle cx={size/2} cy={size/2} r={r-7}
          fill={`${nodeCol}1a`} stroke={`${nodeCol}44`} strokeWidth={1.5}
        />
      </svg>
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════
//  GAME 2: COLOR PANIC
//  FIX: 1.5s grace period on color switch — tiles spawned before
//       the switch don't count against you for 1500ms.
// ═══════════════════════════════════════════════════════════════════
const PANIC_COLORS=[
  {name:"RED",    hex:"#ff3b3b"},
  {name:"BLUE",   hex:"#0a84ff"},
  {name:"GREEN",  hex:"#30d158"},
  {name:"YELLOW", hex:"#ffd60a"},
  {name:"PINK",   hex:"#ff375f"},
  {name:"TEAL",   hex:"#5ac8fa"},
];
const NUM_LANES=4, TILE_W=68, TILE_H=68;
const GRACE_MS=1500; // ms after color change where old-color tiles at bottom are forgiven

export function ColorPanic({onExit}) {
  const [tiles,setTiles]       = useState([]);
  const [target,setTarget]     = useState(PANIC_COLORS[0]);
  const [score,setScore]       = useState(0);
  const [lives,setLives]       = useState(3);
  const [countdown,setCountdown] = useState(3);
  const [running,setRunning]   = useState(false);
  const [gameOver,setGameOver] = useState(false);
  const [popups,setPopups]     = useState([]);
  const [combo,setCombo]       = useState(0);
  const [flashWrong,setFlashWrong] = useState(false);
  const [targetTimer,setTargetTimer] = useState(6);
  const [inGrace,setInGrace]   = useState(false); // visual grace indicator

  const livesRef      = useRef(3);
  const scoreRef      = useRef(0);
  const comboRef      = useRef(0);
  const targetRef     = useRef(PANIC_COLORS[0]);
  const areaRef       = useRef(null);
  const laneTimers    = useRef({});
  const runningRef    = useRef(false);
  const graceUntilRef = useRef(0); // timestamp until which misses are forgiven

  targetRef.current  = target;
  runningRef.current = running;

  useEffect(()=>{
    if(countdown<=0){setRunning(true);return;}
    const t=setTimeout(()=>setCountdown(c=>c-1),1000);
    return()=>clearTimeout(t);
  },[countdown]);

  const addPopup=useCallback((x,y,val,color,neg=false)=>{
    const id=uid();
    setPopups(p=>[...p,{id,x,y,val,color,neg}]);
    setTimeout(()=>setPopups(p=>p.filter(pp=>pp.id!==id)),750);
  },[]);

  const die=useCallback(()=>{
    SFX.loseLife();
    livesRef.current-=1;
    setLives(livesRef.current);
    setFlashWrong(true);
    setTimeout(()=>setFlashWrong(false),420);
    if(livesRef.current<=0){setRunning(false);setGameOver(true);}
  },[]);

  // Change target color every 6s — triggers grace period
  useInterval(()=>{
    if(!runningRef.current) return;
    setTargetTimer(t=>{
      if(t<=1){
        const others=PANIC_COLORS.filter(c=>c.name!==targetRef.current.name);
        const next=others[randI(0,others.length-1)];
        setTarget(next);
        SFX.panicChange();
        // Start grace period — tiles already near bottom won't penalize
        graceUntilRef.current=Date.now()+GRACE_MS;
        setInGrace(true);
        setTimeout(()=>setInGrace(false),GRACE_MS);
        return 6;
      }
      return t-1;
    });
  },running?1000:null);

  // Spawn falling tiles per lane
  useInterval(()=>{
    if(!runningRef.current||!areaRef.current) return;
    const rect=areaRef.current.getBoundingClientRect();
    const laneW=rect.width/NUM_LANES;
    const speed=Math.max(1600,4000-scoreRef.current*12);
    const now=Date.now();
    const availLanes=[0,1,2,3].filter(lane=>{
      const last=laneTimers.current[lane]||0;
      return now-last>speed*0.42;
    });
    if(availLanes.length===0) return;
    const lane=availLanes[randI(0,availLanes.length-1)];
    laneTimers.current[lane]=now;
    const color=PANIC_COLORS[randI(0,PANIC_COLORS.length-1)];
    const x=lane*laneW+laneW/2-TILE_W/2;
    const id=uid();
    const spawnedAt=now;
    setTiles(t=>[...t,{id,color,lane,x,speed,born:now,spawnedAt}]);
    setTimeout(()=>{
      setTiles(t=>{
        const still=t.find(ti=>ti.id===id);
        if(still&&still.color.name===targetRef.current.name){
          // Missed a target tile — check grace
          if(Date.now()>graceUntilRef.current){
            SFX.panicMiss();
            die();
          }
        }
        return t.filter(ti=>ti.id!==id);
      });
    },speed+200);
  },running?380:null);

  const tapTile=useCallback((tile,e)=>{
    e.stopPropagation();
    if(!areaRef.current) return;
    const rect=areaRef.current.getBoundingClientRect();
    const touch=e.touches?.[0]||e;
    const px=(touch.clientX||e.clientX)-rect.left;
    const py=(touch.clientY||e.clientY)-rect.top;
    setTiles(t=>t.filter(ti=>ti.id!==tile.id));
    if(tile.color.name===targetRef.current.name){
      comboRef.current++;
      setCombo(comboRef.current);
      const pts=10*(comboRef.current>=8?4:comboRef.current>=5?3:comboRef.current>=3?2:1);
      scoreRef.current+=pts;
      setScore(scoreRef.current);
      SFX.panicHit(comboRef.current);
      addPopup(px,py,pts,tile.color.hex);
    } else {
      // Wrong color tapped — only penalize if not in grace
      if(Date.now()>graceUntilRef.current){
        comboRef.current=0;setCombo(0);
        SFX.panicWrong();
        die();
      } else {
        // Grace — silent forgive, just remove tile
      }
    }
  },[addPopup,die]);

  const restart=()=>{
    setTiles([]);setScore(0);setLives(3);setCombo(0);setCountdown(3);
    setGameOver(false);setRunning(false);setTarget(PANIC_COLORS[0]);setTargetTimer(6);setInGrace(false);
    livesRef.current=3;scoreRef.current=0;comboRef.current=0;laneTimers.current={};runningRef.current=false;graceUntilRef.current=0;
  };

  if(gameOver) return <GameOver score={score} color={T.panic} game="colorpanic" onRestart={restart} onExit={onExit}/>;

  return (
    <div style={{width:"100%",height:"100%",position:"relative",overflow:"hidden",animation:flashWrong?"wrongFlash 0.35s ease":"none"}}>
      <GameHUD score={score} lives={lives} color={T.panic} label="COLOR PANIC" combo={combo} onExit={onExit}/>
      {running&&(
        <div style={{position:"absolute",top:62,left:0,right:0,height:42,display:"flex",alignItems:"center",justifyContent:"center",gap:10,background:`linear-gradient(${T.surface}cc,transparent)`,zIndex:20,borderBottom:"1px solid #ffffff08"}}>
          <span style={{color:"#ffffff44",fontFamily:"'Share Tech Mono'",fontSize:9,letterSpacing:3}}>TAP ONLY</span>
          <div style={{width:24,height:24,borderRadius:6,background:target.hex,boxShadow:`0 0 14px ${target.hex}`,animation:inGrace?"graceFlash 0.3s infinite":"glow 0.9s infinite"}}/>
          <span style={{fontFamily:"'Black Ops One'",fontSize:13,color:target.hex,textShadow:`0 0 8px ${target.hex}`}}>{target.name}</span>
          {inGrace&&<span style={{fontFamily:"'Share Tech Mono'",fontSize:8,color:target.hex,letterSpacing:2,opacity:0.7}}>GRACE</span>}
          <svg width={20} height={20} style={{transform:"rotate(-90deg)"}}>
            <circle cx={10} cy={10} r={7} fill="none" stroke="#ffffff12" strokeWidth={3}/>
            <circle cx={10} cy={10} r={7} fill="none" stroke={target.hex}
              strokeWidth={3} strokeDasharray={`${(targetTimer/6)*44} 44`} strokeLinecap="round"/>
          </svg>
        </div>
      )}
      <div ref={areaRef} style={{position:"absolute",inset:0,top:running?104:62,overflow:"hidden"}}>
        {!running&&countdown>=0&&<Countdown n={countdown} color={T.panic}/>}
        {tiles.map(tile=><FallingTile key={tile.id} tile={tile} isTarget={tile.color.name===target.name} inGrace={inGrace} onTap={tapTile}/>)}
        {popups.map(p=><ScorePopup key={p.id} x={p.x} y={p.y} value={p.val} color={p.color} negative={p.neg}/>)}
      </div>
    </div>
  );
}

function FallingTile({tile,isTarget,inGrace,onTap}) {
  const anim=`fall_${tile.id}`;
  return (
    <>
      <style>{`@keyframes ${anim}{from{top:-${TILE_H+10}px}to{top:110%}}`}</style>
      <div
        onPointerDown={e=>{e.stopPropagation();onTap(tile,e);}}
        style={{
          position:"absolute",left:tile.x,width:TILE_W,height:TILE_H,
          borderRadius:14,background:tile.color.hex,
          boxShadow:isTarget
            ?`0 0 20px ${tile.color.hex}, 0 0 40px ${tile.color.hex}44, inset 0 1px 0 rgba(255,255,255,0.3)`
            :`0 4px 12px ${tile.color.hex}33, inset 0 1px 0 rgba(255,255,255,0.12)`,
          border:isTarget?"2.5px solid rgba(255,255,255,0.7)":"1px solid rgba(0,0,0,0.1)",
          cursor:"pointer",
          display:"flex",alignItems:"center",justifyContent:"center",
          animation:`${anim} ${tile.speed}ms linear forwards`,
          willChange:"top",
          opacity:inGrace&&!isTarget?0.6:1,
        }}
      >
        {isTarget&&<div style={{width:16,height:16,borderRadius:"50%",border:"2.5px solid rgba(255,255,255,0.85)",boxShadow:"0 0 8px rgba(255,255,255,0.4)"}}/>}
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  GAME 3: PIANO TILES
//  4 lanes, tiles fall from top. Tap a lane when a tile's leading edge
//  reaches the hit line. Perfect/Good/Miss scoring. Speed and density
//  increase with score. 3 misses = game over. Each tile carries a note
//  from a procedural melody walker, so a clean run plays a coherent tune.
// ═══════════════════════════════════════════════════════════════════

const PT_LANES   = 4;
const PT_COLOR   = "#e8c547";
const PT_LANE_COLORS = ["#e8c547","#5ac8fa","#bf5af2","#ff6b6b"];

// ── Smart procedural melody engine ──────────────────────────────────
// Notes are chosen by a melodic walker, not by lane, so successive taps
// form a coherent line instead of four static pitches. Diatonic C-major
// across ~2 octaves; a rotating I–vi–IV–V progression biases each note
// toward the current chord's tones, and motion favours small steps that
// resolve toward chord roots — so a clean run sounds intentional.
const PT_SCALE = [0, 2, 4, 5, 7, 9, 11]; // C major semitone degrees
const PT_ROOT_MIDI = 60;                 // C4
const PT_RANGE = 15;                     // scale steps spanned (~2 octaves)
// Chord degrees (indices into a per-octave scale) for I, vi, IV, V.
const PT_PROG = [[0,2,4],[5,0,2],[3,5,0],[4,6,1]];
const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);
// Frequency for scale-step `i` (0..PT_RANGE), wrapping octaves.
function ptStepFreq(i) {
  const oct = Math.floor(i / PT_SCALE.length);
  const deg = ((i % PT_SCALE.length) + PT_SCALE.length) % PT_SCALE.length;
  return midiToFreq(PT_ROOT_MIDI + oct * 12 + PT_SCALE[deg]);
}

// Stateful walker. `.next()` returns one melodic note { freq, step };
// `.chord(count)` returns `count` harmonically-related notes (the current
// progression chord, spread across octaves) for simultaneous tiles.
function makeMelody() {
  let step = 4;      // start mid-range
  let n = 0;         // notes played (drives the progression)
  const curChord = () => PT_PROG[Math.floor(n / 4) % PT_PROG.length];
  const next = () => {
    const chord = curChord();
    // Candidate next steps: small intervals around current position.
    const cands = [-4,-3,-2,-1,-1,1,1,2,3,4].map(d => step + d)
      .filter(s => s >= 0 && s <= PT_RANGE);
    // Prefer chord tones; nudge back toward centre if drifting to edges.
    const scored = cands.map(s => {
      const deg = ((s % PT_SCALE.length) + PT_SCALE.length) % PT_SCALE.length;
      const inChord = chord.includes(deg) ? 0 : 3;
      const edge = Math.abs(s - PT_RANGE / 2) * 0.15;
      return { s, w: inChord + edge + Math.random() * 1.6 };
    }).sort((a,b) => a.w - b.w);
    step = scored[0].s;
    n++;
    return { freq: ptStepFreq(step), step };
  };
  const chord = (count) => {
    const deg = curChord();                 // e.g. [0,2,4] — a triad
    n++;                                     // advance progression once per chord
    // Build voices from low to high, cycling triad tones up the octaves so the
    // notes stack into a real chord instead of a cluster.
    const notes = [];
    for (let i = 0; i < count; i++) {
      const oct = Math.floor(i / deg.length);
      const s = oct * PT_SCALE.length + deg[i % deg.length];
      notes.push(midiToFreq(PT_ROOT_MIDI + Math.floor(s / PT_SCALE.length) * 12
        + PT_SCALE[s % PT_SCALE.length]));
    }
    step = deg[deg.length - 1] % PT_SCALE.length; // continue melody from the top voice
    return notes;
  };
  return { next, chord };
}

// How many tiles arrive together. Solo until difficulty tops out (~score 2000
// where ptTileSpeed bottoms), then occasional 2-tile chords, later rare 3-tile.
function ptChordSize(score) {
  if (score < 2000) return 1;
  const r = Math.random();
  if (score >= 3200) return r < 0.15 ? 3 : r < 0.5 ? 2 : 1;
  return r < 0.4 ? 2 : 1;
}

// Rich piano-ish voice: detuned twin oscillators + octave shimmer through
// a swept low-pass, into a shared reverb-ish delay for space. Velocity
// (gain) scales with hit quality. Cheap: 3 oscillators, all stop-scheduled.
let _ptVerb = null;
function ptVerb() {
  if (_ptVerb) return _ptVerb;
  const ctx = getCtx();
  const send = ctx.createGain();  send.gain.value = 0.18;
  const dly  = ctx.createDelay(); dly.delayTime.value = 0.14;
  const fb   = ctx.createGain();  fb.gain.value = 0.32;
  const damp = ctx.createBiquadFilter(); damp.type = "lowpass"; damp.frequency.value = 2200;
  send.connect(dly); dly.connect(damp); damp.connect(fb); fb.connect(dly);
  damp.connect(ctx.destination);
  _ptVerb = send;
  return send;
}

function playPianoNote(freq, quality) {
  try {
    const ctx = getCtx();
    const t = ctx.currentTime;
    const peak = quality === "perfect" ? 0.24 : quality === "good" ? 0.17 : 0.08;
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass"; filt.Q.value = 0.7;
    filt.frequency.setValueAtTime(5200, t);
    filt.frequency.exponentialRampToValueAtTime(1400, t + 0.28); // bright→mellow
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(peak, t + 0.006);      // sharp attack
    env.gain.exponentialRampToValueAtTime(peak * 0.35, t + 0.12); // body
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);      // long tail
    filt.connect(env);
    env.connect(ctx.destination);
    try { env.connect(ptVerb()); } catch {}
    // Detuned twin (triangle) for a fuller strike.
    [[freq, 0, "triangle", 1], [freq, +4, "triangle", 0.7], [freq * 2, 0, "sine", 0.28]]
      .forEach(([f, cents, type, amp]) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain(); g.gain.value = amp;
        o.type = type; o.frequency.value = f; o.detune.value = cents;
        // Tiny pitch settle for a struck feel.
        o.frequency.exponentialRampToValueAtTime(f * 0.996, t + 0.3);
        o.connect(g); g.connect(filt);
        o.start(t); o.stop(t + 0.95);
      });
  } catch {}
}

function playMissThud() {
  try {
    const ctx = getCtx();
    const t = ctx.currentTime;
    // Low body thud.
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.connect(env); env.connect(ctx.destination);
    osc.type = "sine"; osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.18);
    env.gain.setValueAtTime(0.16, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
    osc.start(t); osc.stop(t + 0.28);
    // Dissonant buzz on top so a miss reads as "wrong", not just quiet.
    const buzz = ctx.createOscillator();
    const benv = ctx.createGain();
    const bfilt = ctx.createBiquadFilter();
    buzz.connect(bfilt); bfilt.connect(benv); benv.connect(ctx.destination);
    buzz.type = "sawtooth"; buzz.frequency.setValueAtTime(220, t);
    buzz.frequency.exponentialRampToValueAtTime(150, t + 0.12);
    bfilt.type = "lowpass"; bfilt.frequency.value = 900;
    benv.gain.setValueAtTime(0.07, t);
    benv.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    buzz.start(t); buzz.stop(t + 0.18);
  } catch {}
}

// Speed: tile fall duration. Starts 2600ms, min 900ms, over 0-2000 score
function ptTileSpeed(score) {
  const t = Math.min(score / 2000, 1);
  return Math.round(2600 - Math.pow(t, 1.5) * 1700);
}
// Spawn gap: ms between tiles. Starts 1200ms, min 280ms
function ptSpawnGap(score) {
  const t = Math.min(score / 2000, 1);
  return Math.round(1200 - Math.pow(t, 1.4) * 920);
}

// ── Responsive geometry ─────────────────────────────────────────────
// One source of truth for tile height, hit line, and the tap-row height,
// derived from the measured play-area height so render + hit-detection
// always agree and everything scales to the viewport.
const PT_TAP_H_MIN = 64, PT_TAP_H_MAX = 96;
const PT_TILE_MIN  = 64, PT_TILE_MAX  = 120;
function ptGeom(areaH) {
  const h = areaH || 600;
  const tileH   = clamp(h * 0.16, PT_TILE_MIN, PT_TILE_MAX);
  const hitLineY = h - clamp(h * 0.12, PT_TAP_H_MIN, PT_TAP_H_MAX); // travel to here
  return {
    tileH,
    hitLineY,
    tapH: h - hitLineY,           // tap-row band height
    perfect: tileH * 0.22,        // hit window: fraction of tile height
    good:    tileH * 0.5,
  };
}
// How long a missed tile flashes red before it's cleared.
const PT_MISS_FLASH_MS = 300;

export function PianoTiles({onExit}) {
  const [tiles, setTiles]         = useState([]);   // {id, lane, speed, born, note, step}
  const [score, setScore]         = useState(0);
  const [misses, setMisses]       = useState(0);
  const [combo, setCombo]         = useState(0);
  const [running, setRunning]     = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [gameOver, setGameOver]   = useState(false);
  const [popups, setPopups]       = useState([]);
  const [laneFlash, setLaneFlash] = useState([0,0,0,0]);   // hit-quality per lane for ripple
  const [hitFeedback, setHitFeedback] = useState(null);    // {text,color,key}
  const [bursts, setBursts]       = useState([]);          // hit-line flash bursts
  const [flourish, setFlourish]   = useState(null);        // combo milestone flourish
  const [missFlash, setMissFlash] = useState(null);        // red screen flash key on miss
  const [areaH, setAreaH]         = useState(600);         // measured play-area height

  const scoreRef    = useRef(0);
  const missRef     = useRef(0);
  const comboRef    = useRef(0);
  const gameOverRef = useRef(false);
  const tilesRef    = useRef([]);
  const areaRef     = useRef(null);
  const spawnTimer  = useRef(null);
  const melodyRef   = useRef(makeMelody());
  // Track rendered tile positions via rAF
  const [, setTick] = useState(0);

  tilesRef.current = tiles;
  const geom = ptGeom(areaH);

  // Measure the play area so geometry is right on first paint and responsive.
  useEffect(()=>{
    const el=areaRef.current; if(!el) return;
    const measure=()=>setAreaH(el.getBoundingClientRect().height||600);
    measure();
    const ro=new ResizeObserver(measure);
    ro.observe(el);
    return()=>ro.disconnect();
  },[]);

  useEffect(()=>{
    if(countdown<=0){setRunning(true);return;}
    const t=setTimeout(()=>setCountdown(c=>c-1),1000);
    return()=>clearTimeout(t);
  },[countdown]);

  // rAF loop to keep tiles animating smoothly
  useEffect(()=>{
    if(!running) return;
    let id;
    const loop = () => { setTick(n=>n+1); id=requestAnimationFrame(loop); };
    id = requestAnimationFrame(loop);
    return()=>cancelAnimationFrame(id);
  },[running]);

  const addPopup=useCallback((lane, text, color)=>{
    if(!areaRef.current) return;
    const rect=areaRef.current.getBoundingClientRect();
    const laneW=rect.width/PT_LANES;
    // Keep the popup fully on-screen: clamp its centre away from both edges.
    const x=clamp(lane*laneW+laneW/2, 34, rect.width-34);
    const y=ptGeom(rect.height).hitLineY-24;
    const id=uid();
    setPopups(p=>[...p,{id,x,y,val:text,color}]);
    setTimeout(()=>setPopups(p=>p.filter(pp=>pp.id!==id)),700);
  },[]);

  // Brief flash at the hit line where a tile landed.
  const addBurst=useCallback((lane,color,perfect)=>{
    const id=uid();
    setBursts(b=>[...b,{id,lane,color,perfect}]);
    setTimeout(()=>setBursts(b=>b.filter(x=>x.id!==id)),420);
  },[]);

  const recordMiss=useCallback(()=>{
    if(gameOverRef.current) return;
    missRef.current+=1;
    setMisses(missRef.current);
    comboRef.current=0; setCombo(0);
    playMissThud();
    // Make the miss unmistakable: centered MISS + a full-screen red flash.
    setHitFeedback({text:"MISS",color:T.red,key:uid()});
    setMissFlash(uid());
    if(missRef.current>=3){
      gameOverRef.current=true;
      clearTimeout(spawnTimer.current);
      setRunning(false); setGameOver(true);
    }
  },[]);

  // Spawn tiles recursively. Notes come from the melody walker at spawn time,
  // so the order tiles fall in defines the tune. Once difficulty tops out,
  // some spawns are chords: 2+ tiles in different lanes sharing a `born` (so
  // they arrive together) with harmonically-related notes.
  const scheduleSpawn=useCallback(()=>{
    if(gameOverRef.current) return;
    const gap=ptSpawnGap(scoreRef.current);
    spawnTimer.current=setTimeout(()=>{
      if(gameOverRef.current) return;
      const speed=ptTileSpeed(scoreRef.current);
      const born=Date.now();
      const size=ptChordSize(scoreRef.current);
      // Pick `size` distinct lanes.
      const lanes=[0,1,2,3].sort(()=>Math.random()-0.5).slice(0,size);
      const notes=size>1 ? melodyRef.current.chord(size) : [melodyRef.current.next().freq];
      const newTiles=lanes.map((lane,i)=>({
        id:uid(),lane,speed,born,note:notes[i],chord:size>1,
      }));
      setTiles(t=>[...t,...newTiles]);
      // Auto-expire once the tile has fallen a bit past the Good window — the
      // logical miss lines up with the tile visibly leaving the hit line. Mark
      // the tile "missed" briefly first so the player sees which one they lost.
      const g=ptGeom(areaRef.current?.getBoundingClientRect().height||600);
      const expireMs=Math.round(speed*(1 + g.good/g.hitLineY)) + 40;
      newTiles.forEach(nt=>{
        setTimeout(()=>{
          // Read current tiles from the ref (synchronous, not a deferred state
          // updater) to decide if this tile is still un-tapped = a miss.
          const still=tilesRef.current.some(tl=>tl.id===nt.id && !tl.missed);
          if(!still) return;
          setTiles(prev=>prev.map(tl=>tl.id===nt.id?{...tl,missed:true}:tl));
          recordMiss();
          // Clear the missed tile after its flash plays.
          setTimeout(()=>setTiles(prev=>prev.filter(tl=>tl.id!==nt.id)),PT_MISS_FLASH_MS);
        }, expireMs);
      });
      scheduleSpawn();
    }, gap);
  },[recordMiss]);

  useEffect(()=>{
    if(!running) return;
    scheduleSpawn();
    return()=>clearTimeout(spawnTimer.current);
  },[running]);

  // Tap a lane button
  const tapLane=useCallback((lane)=>{
    if(gameOverRef.current) return;
    if(!areaRef.current) return;
    const rect=areaRef.current.getBoundingClientRect();
    const g=ptGeom(rect.height);
    const now=Date.now();

    // Find the tile in this lane whose leading (bottom) edge is nearest the
    // hit line. leadY uses the SAME geometry the tiles are rendered with.
    const laneTiles=tilesRef.current
      .filter(t=>t.lane===lane && !t.missed)   // a missed tile is flashing out
      .map(t=>{
        const progress=(now-t.born)/t.speed;
        const leadY=progress*g.hitLineY;        // bottom edge, px from top
        return{...t,leadY,delta:leadY-g.hitLineY};
      })
      .sort((a,b)=>Math.abs(a.delta)-Math.abs(b.delta));

    const closest=laneTiles[0];
    const flash=(q)=>{
      setLaneFlash(f=>{const n=[...f];n[lane]=q;return n;});
      setTimeout(()=>setLaneFlash(f=>{const n=[...f];n[lane]=0;return n;}),160);
    };

    if(!closest){
      flash(-1);
      const pen=Math.max(3,Math.floor(scoreRef.current/100));
      scoreRef.current=Math.max(0,scoreRef.current-pen);
      setScore(scoreRef.current);
      setHitFeedback({text:"EMPTY",color:"#ffffff33",key:uid()});
      return;
    }

    const dist=Math.abs(closest.delta);
    let quality=null;
    if(dist<=g.perfect)        quality="perfect";
    else if(dist<=g.good)      quality="good";
    else if(closest.delta<0)   quality="early"; // hasn't reached the line yet

    if(!quality||quality==="early"){
      flash(-1);
      const pen=Math.max(3,Math.floor(scoreRef.current/80));
      scoreRef.current=Math.max(0,scoreRef.current-pen);
      setScore(scoreRef.current);
      setHitFeedback({text:"MISS",color:T.red,key:uid()});
      playMissThud();
      return;
    }

    // Hit!
    const perfect=quality==="perfect";
    setTiles(t=>t.filter(tl=>tl.id!==closest.id));
    comboRef.current+=1; const c=comboRef.current; setCombo(c);
    const comboMult=c>=20?4:c>=10?3:c>=5?2:1;
    const pts=(perfect?100:60)*comboMult;
    scoreRef.current+=pts; setScore(scoreRef.current);
    playPianoNote(closest.note, quality);
    const col=PT_LANE_COLORS[lane];
    flash(perfect?2:1);
    addBurst(lane, perfect?col:"#88ddff", perfect);
    // Single hit label, centered. A small +points rises at the tapped lane —
    // informative, not a duplicate of the label. ScorePopup adds the "+".
    addPopup(lane, pts, perfect?col:"#88ddff");
    setHitFeedback({text:perfect?"✦ PERFECT":"GOOD",color:perfect?PT_COLOR:"#88ddff",key:uid()});
    // Combo milestone flourish.
    if(c===5||c===10||c===20||c===30||c===50)
      setFlourish({text:`×${comboMult} COMBO`,key:uid()});
  },[addPopup,addBurst]);

  const restart=()=>{
    clearTimeout(spawnTimer.current);
    gameOverRef.current=false; missRef.current=0; scoreRef.current=0; comboRef.current=0;
    melodyRef.current=makeMelody();
    setTiles([]); setScore(0); setMisses(0); setCombo(0);
    setGameOver(false); setCountdown(3); setRunning(false);
    setLaneFlash([0,0,0,0]); setPopups([]); setBursts([]); setFlourish(null); setMissFlash(null);
  };

  if(gameOver) return <GameOver score={score} color={PT_COLOR} game="pianotiles" onRestart={restart} onExit={onExit}/>;

  const hudH=`clamp(52px, 8vh, 62px)`;
  const now=Date.now();
  const laneW=100/PT_LANES;

  // Compute tile positions from the shared geometry (leading edge = leadY).
  const computedTiles=tiles.map(t=>{
    const progress=Math.min(1.2,(now-t.born)/t.speed);
    const leadY=progress*geom.hitLineY;
    // Proximity 0→1 as the tile nears the line, for glow ramp.
    const prox=clamp(1-Math.abs(leadY-geom.hitLineY)/geom.hitLineY,0,1);
    return{...t,leadY,prox};
  });

  return (
    <div style={{width:"100%",height:"100%",position:"relative",overflow:"hidden",background:T.bg,display:"flex",flexDirection:"column"}}>
      {/* HUD */}
      <div style={{height:hudH,display:"flex",alignItems:"center",padding:"0 10px",gap:8,background:`linear-gradient(${T.surface}f0,transparent)`,zIndex:100,borderBottom:"1px solid #ffffff08",flexShrink:0}}>
        <button onPointerDown={onExit} style={{background:"#ffffff08",border:"1px solid #ffffff12",color:"#ffffff55",padding:"5px 10px",borderRadius:4,fontFamily:"'Share Tech Mono'",fontSize:12,cursor:"pointer",flexShrink:0}}>←</button>
        <span style={{fontFamily:"'Black Ops One'",fontSize:13,color:PT_COLOR,textShadow:`0 0 8px ${PT_COLOR}`,flexShrink:0}}>PIANO TILES</span>
        <div style={{flex:1}}/>
        {combo>=3&&<span style={{color:T.gold,fontFamily:"'Black Ops One'",fontSize:12,textShadow:`0 0 8px ${T.gold}`,animation:"pulse 0.5s infinite"}}>×{combo}</span>}
        <span style={{color:"#ffffff28",fontFamily:"'Share Tech Mono'",fontSize:9}}>BEST <span style={{color:PT_COLOR}}>{loadHS()["pianotiles"]||0}</span></span>
        <span style={{fontFamily:"'Black Ops One'",fontSize:22,color:PT_COLOR,textShadow:`0 0 10px ${PT_COLOR}`,minWidth:44,textAlign:"right"}}>{score}</span>
        <div style={{display:"flex",gap:3,flexShrink:0}}>
          {[0,1,2].map(i=>(
            <div key={i} style={{width:9,height:9,borderRadius:"50%",background:i<(3-misses)?PT_COLOR:"#ff2d5540",boxShadow:i<(3-misses)?`0 0 6px ${PT_COLOR}`:"0 0 4px #ff2d5555",transition:"all 0.3s"}}/>
          ))}
        </div>
      </div>

      {/* Play area */}
      <div ref={areaRef} style={{flex:1,position:"relative",overflow:"hidden"}}>
        {!running&&countdown>=0&&<Countdown n={countdown} color={PT_COLOR}/>}

        {/* Keyboard-runway lanes: faint per-lane sheen + dividers */}
        {PT_LANE_COLORS.map((col,i)=>(
          <div key={"lane"+i} style={{
            position:"absolute",top:0,bottom:0,left:`${i*laneW}%`,width:`${laneW}%`,
            background:`linear-gradient(180deg, ${col}00 55%, ${col}0a 100%)`,
            borderRight:i<PT_LANES-1?"1px solid #ffffff08":"none",zIndex:1,
          }}/>
        ))}

        {/* Hit line: bar + soft glow, pulses with combo */}
        <div style={{
          position:"absolute",top:geom.hitLineY-1.5,left:0,right:0,height:3,
          background:`linear-gradient(90deg,${PT_LANE_COLORS.join(",")})`,
          opacity:combo>=3?0.85:0.55,zIndex:3,
          boxShadow:`0 0 ${combo>=5?18:10}px ${PT_COLOR}${combo>=5?"88":"44"}`,
          animation:combo>=5?"ptBar 0.6s ease-in-out infinite":"none",
        }}/>
        <div style={{
          position:"absolute",top:geom.hitLineY-16,left:0,right:0,height:16,
          background:"linear-gradient(transparent,rgba(255,255,255,0.05))",zIndex:2,
        }}/>

        {/* Falling tiles — glow ramps up as they approach the line. A missed
            tile turns red, shakes, and shows an ✕ so it's obvious which was lost. */}
        {computedTiles.map(t=>{
          const col=t.missed?T.red:PT_LANE_COLORS[t.lane];
          const glow=t.missed?26:8+t.prox*22;
          return (
            <div key={t.id} style={{
              position:"absolute",
              left:`${t.lane*laneW+0.6}%`,
              width:`${laneW-1.2}%`,
              top:t.leadY-geom.tileH,
              height:geom.tileH,
              borderRadius:10,
              background:`linear-gradient(180deg,${col}e6,${col}99)`,
              boxShadow:`0 0 ${glow}px ${col}${t.missed||t.prox>0.7?"cc":"66"}, inset 0 2px 0 rgba(255,255,255,0.28), inset 0 -3px 8px rgba(0,0,0,0.25)`,
              border:`1px solid ${col}`,
              zIndex:t.missed?5:2,
              animation:t.missed?"ptMiss 0.3s ease-out":"none",
              display:"flex",alignItems:"center",justifyContent:"center",
            }}>
              {/* glass streak */}
              <div style={{position:"absolute",inset:"6% 8% auto 8%",height:"22%",borderRadius:6,background:"linear-gradient(180deg,rgba(255,255,255,0.35),transparent)"}}/>
              {t.missed&&<span style={{fontFamily:"'Black Ops One'",fontSize:Math.min(34,geom.tileH*0.4),color:"#fff",textShadow:`0 0 10px ${T.red}`}}>✕</span>}
            </div>
          );
        })}

        {/* Hit-line bursts */}
        {bursts.map(b=>(
          <div key={b.id} style={{
            position:"absolute",left:`${b.lane*laneW}%`,width:`${laneW}%`,
            top:geom.hitLineY-geom.tileH*0.5,height:geom.tileH,
            pointerEvents:"none",zIndex:6,
            display:"flex",alignItems:"center",justifyContent:"center",
          }}>
            <div style={{
              width:"70%",height:"70%",borderRadius:"50%",
              background:`radial-gradient(circle, ${b.color}${b.perfect?"cc":"88"} 0%, ${b.color}00 70%)`,
              animation:"ptBurst 0.4s ease-out forwards",
            }}/>
          </div>
        ))}

        {/* Miss flash — red vignette pulse across the whole play area */}
        {missFlash&&(
          <div key={missFlash} style={{
            position:"absolute",inset:0,pointerEvents:"none",zIndex:9,
            boxShadow:"inset 0 0 90px 20px rgba(255,45,85,0.55)",
            background:"rgba(255,45,85,0.06)",
            animation:"ptMissFlash 0.4s ease-out forwards",
          }}/>
        )}

        {/* Hit feedback overlay */}
        {hitFeedback&&(
          <div key={hitFeedback.key} style={{
            position:"absolute",top:"28%",left:0,right:0,
            textAlign:"center",pointerEvents:"none",
            fontFamily:"'Black Ops One'",fontSize:hitFeedback.text==="MISS"?34:26,
            color:hitFeedback.color,
            textShadow:`0 0 16px ${hitFeedback.color}`,
            animation:"floatUp 0.6s ease-out forwards",zIndex:10,
          }}>{hitFeedback.text}</div>
        )}

        {/* Combo milestone flourish */}
        {flourish&&(
          <div key={flourish.key} style={{
            position:"absolute",top:"46%",left:0,right:0,textAlign:"center",
            pointerEvents:"none",zIndex:11,
            fontFamily:"'Black Ops One'",fontSize:34,color:T.gold,
            textShadow:`0 0 22px ${T.gold}, 0 0 44px ${T.gold}66`,
            animation:"ptFlourish 0.85s ease-out forwards",
          }}>{flourish.text}</div>
        )}

        {/* Score popups */}
        {popups.map(p=>(
          <ScorePopup key={p.id} x={p.x} y={p.y} value={p.val} color={p.color}/>
        ))}
      </div>

      {/* Lane tap buttons */}
      <div style={{height:geom.tapH,display:"flex",flexShrink:0,borderTop:"1px solid #ffffff10",background:T.surface}}>
        {PT_LANE_COLORS.map((col,i)=>{
          const q=laneFlash[i];               // 0 idle, -1 miss, 1 good, 2 perfect
          const lit=q>0;
          const bg=q===-1?"#ff2d5522":lit?`${col}${q===2?"55":"3a"}`:`${col}0d`;
          return (
            <div
              key={i}
              onPointerDown={e=>{e.preventDefault();tapLane(i);}}
              style={{
                flex:1,position:"relative",overflow:"hidden",
                background:bg,
                borderRight:i<PT_LANES-1?"1px solid #ffffff10":"none",
                cursor:"pointer",
                display:"flex",alignItems:"center",justifyContent:"center",
                transition:"background 0.09s",
                userSelect:"none",WebkitUserSelect:"none",
              }}
            >
              {lit&&<div style={{
                position:"absolute",inset:0,pointerEvents:"none",
                background:`radial-gradient(circle at 50% 50%, ${col}66 0%, transparent 60%)`,
                animation:"ptRipple 0.32s ease-out forwards",
              }}/>}
              <div style={{
                width:"clamp(30px,7vw,42px)",aspectRatio:"1",borderRadius:"50%",
                border:`2px solid ${col}${lit?"ff":"55"}`,
                background:lit?`${col}44`:"transparent",
                transition:"all 0.09s",
                boxShadow:lit?`0 0 14px ${col}`:"none",
              }}/>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  GAME 4: SPLITTER (UPDATED)
//  - Smaller dots get MORE time (lifeMultiplier increases with level)
//  - baseLife shrinks as score rises → pressure increases over time
// ═══════════════════════════════════════════════════════════════════
export function Splitter({onExit}) {
  const [dots,setDots]         = useState([]);
  const [score,setScore]       = useState(0);
  const [lives,setLives]       = useState(3);
  const [countdown,setCountdown] = useState(3);
  const [running,setRunning]   = useState(false);
  const [gameOver,setGameOver] = useState(false);
  const [popups,setPopups]     = useState([]);
  const [combo,setCombo]       = useState(0);
  const [wave,setWave]         = useState(0);

  const livesRef=useRef(3),scoreRef=useRef(0),comboRef=useRef(0);
  const areaRef=useRef(null),waveRef=useRef(0),baseLife=useRef(2800),spawning=useRef(false);
  const dotsRef=useRef([]);
  dotsRef.current=dots;

  useEffect(()=>{
    if(countdown<=0){setRunning(true);return;}
    const t=setTimeout(()=>setCountdown(c=>c-1),1000);
    return()=>clearTimeout(t);
  },[countdown]);

  const addPopup=useCallback((x,y,val)=>{
    const id=uid();
    setPopups(p=>[...p,{id,x,y,val}]);
    setTimeout(()=>setPopups(p=>p.filter(pp=>pp.id!==id)),750);
  },[]);

  const die=useCallback(()=>{
    SFX.loseLife();
    livesRef.current-=1;setLives(livesRef.current);
    if(livesRef.current<=0){setRunning(false);setGameOver(true);}
  },[]);

  const spawnDot=useCallback((x,y,level,maxLevel)=>{
    if(!areaRef.current) return;
    const rect=areaRef.current.getBoundingClientRect();
    // Smaller dots = more time. Score → reduces baseLife globally for pressure.
    // baseLife shrinks with score: starts 2800ms, minimum 1000ms
    const scorePenalty=Math.min(1800, Math.floor(scoreRef.current/5)*8);
    const currentBase=Math.max(1000, 2800-scorePenalty);
    baseLife.current=currentBase;
    // Life multiplier: level 0=1×, level 1=1.4×, level 2=1.85×, level 3=2.4×
    const mult=[1,1.4,1.85,2.4][Math.min(level,3)];
    const life=Math.round(currentBase*mult);
    const size=Math.max(30,62-level*10);
    const cx=clamp(x,42,rect.width-42);
    const cy=clamp(y,42,rect.height-42);
    const id=uid();
    setDots(d=>[...d,{id,x:cx,y:cy,level,maxLevel,lifeMs:life,size,born:Date.now()}]);
    setTimeout(()=>{
      setDots(d=>{
        if(d.find(dd=>dd.id===id)){SFX.splitterMiss();die();}
        return d.filter(dd=>dd.id!==id);
      });
    },life);
    return id;
  },[die]);

  const spawnWave=useCallback(()=>{
    if(!areaRef.current||spawning.current) return;
    spawning.current=true;
    const rect=areaRef.current.getBoundingClientRect();
    waveRef.current++;
    setWave(waveRef.current);
    const maxLevel=Math.min(3,Math.floor(waveRef.current/2));
    const cx=rand(rect.width*0.2,rect.width*0.8);
    const cy=rand(rect.height*0.2,rect.height*0.8);
    spawnDot(cx,cy,0,maxLevel);
    setTimeout(()=>{spawning.current=false;},400);
  },[spawnDot]);

  useEffect(()=>{
    if(!running) return;
    if(dots.length===0&&!spawning.current){
      const t=setTimeout(spawnWave,350);
      return()=>clearTimeout(t);
    }
  },[dots.length,running,spawnWave]);

  useEffect(()=>{if(running) spawnWave();},[running]);

  const tapDot=useCallback((dot,e)=>{
    e.stopPropagation();
    const rect=areaRef.current.getBoundingClientRect();
    const touch=e.touches?.[0]||e;
    const px=(touch.clientX||e.clientX)-rect.left;
    const py=(touch.clientY||e.clientY)-rect.top;
    setDots(d=>d.filter(dd=>dd.id!==dot.id));
    comboRef.current++;setCombo(comboRef.current);
    const pts=10*(dot.level+1);
    scoreRef.current+=pts;setScore(scoreRef.current);
    SFX.splitterTap(dot.level);
    addPopup(px,py,pts);
    if(dot.level<dot.maxLevel){
      SFX.splitterSplit();
      const spread=Math.max(50,85-dot.level*12);
      [0,1].forEach(i=>{
        const angle=rand(0,Math.PI*2);
        const nx=dot.x+Math.cos(angle)*spread;
        const ny=dot.y+Math.sin(angle)*spread;
        setTimeout(()=>spawnDot(nx,ny,dot.level+1,dot.maxLevel),i*55);
      });
    }
  },[addPopup,spawnDot]);

  const restart=()=>{
    setDots([]);setScore(0);setLives(3);setCombo(0);setCountdown(3);
    setGameOver(false);setRunning(false);setWave(0);
    livesRef.current=3;scoreRef.current=0;comboRef.current=0;
    waveRef.current=0;baseLife.current=2800;spawning.current=false;
  };

  if(gameOver) return <GameOver score={score} color={T.splitter} game="splitter" onRestart={restart} onExit={onExit}/>;

  // Show current speed as percentage for player feedback
  const scorePenalty=Math.min(1800,Math.floor(scoreRef.current/5)*8);
  const speedPct=Math.round(((2800-Math.max(1000,2800-scorePenalty))/1800)*100);

  return (
    <div style={{width:"100%",height:"100%",position:"relative",overflow:"hidden"}}>
      <GameHUD score={score} lives={lives} color={T.splitter} label="SPLITTER" combo={combo} onExit={onExit} extra={`WAVE ${wave} · ${speedPct}% SPEED`}/>
      <div ref={areaRef} style={{position:"absolute",inset:0,top:62}}>
        {!running&&countdown>=0&&<Countdown n={countdown} color={T.splitter}/>}
        {dots.map(dot=><SplitterDot key={dot.id} dot={dot} onTap={tapDot}/>)}
        {popups.map(p=><ScorePopup key={p.id} x={p.x} y={p.y} value={p.val} color={T.splitter}/>)}
      </div>
    </div>
  );
}

const SPLITTER_COLORS=[T.splitter,"#5ac8fa","#bf5af2","#ff9f0a"];
const SPLITTER_ICONS=["⬡","✦","◈","★"];

function SplitterDot({dot,onTap}) {
  const [progress,setProgress]=useState(1);
  useEffect(()=>{
    const start=Date.now();
    const id=setInterval(()=>setProgress(Math.max(0,1-(Date.now()-start)/dot.lifeMs)),40);
    return()=>clearInterval(id);
  },[dot.lifeMs]);
  const color=SPLITTER_COLORS[Math.min(dot.level,SPLITTER_COLORS.length-1)];
  const r=dot.size/2,circ=Math.PI*2*(r-6);
  const willSplit=dot.level<dot.maxLevel;
  return (
    <div onPointerDown={e=>{e.stopPropagation();onTap(dot,e);}}
      style={{position:"absolute",left:dot.x-r,top:dot.y-r,width:dot.size,height:dot.size,cursor:"pointer",animation:"popIn 0.22s cubic-bezier(0.34,1.56,0.64,1)"}}>
      <svg width={dot.size} height={dot.size} style={{position:"absolute",inset:0,overflow:"visible"}}>
        <circle cx={r} cy={r} r={r-2} fill="none" stroke={`${color}12`} strokeWidth={8}/>
        <circle cx={r} cy={r} r={r-6} fill="none" stroke={`${color}22`} strokeWidth={5}/>
        <circle cx={r} cy={r} r={r-6} fill="none" stroke={color} strokeWidth={5}
          strokeDasharray={circ} strokeDashoffset={circ*(1-progress)}
          strokeLinecap="round" transform={`rotate(-90 ${r} ${r})`}/>
        <circle cx={r} cy={r} r={r-12} fill={`${color}1a`} stroke={`${color}44`} strokeWidth={1}/>
        {willSplit&&<>
          <line x1={r-5} y1={r} x2={r+5} y2={r} stroke={color} strokeWidth={1.5} opacity={0.5}/>
          <line x1={r} y1={r-5} x2={r} y2={r+5} stroke={color} strokeWidth={1.5} opacity={0.5}/>
        </>}
        <text x={r} y={r+1} textAnchor="middle" dominantBaseline="middle" fontSize={r*0.52} fill={color} style={{fontFamily:"'Black Ops One'"}}>{SPLITTER_ICONS[Math.min(dot.level,SPLITTER_ICONS.length-1)]}</text>
      </svg>
    </div>
  );
}

// NOTE: The four minigames above are now exported individually and registered
// as standalone cabinets in src/data/games.js (each wrapped by its own file:
// TapSurge.jsx, ColorPanic.jsx, PianoTiles.jsx, Splitter.jsx). The old combined
// "ADHD Arcade" hub component was retired when the games were decoupled; this
// file now serves purely as the shared kit + the four game components.
