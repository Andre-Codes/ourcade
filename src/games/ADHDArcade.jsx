import { useState, useEffect, useRef, useCallback } from "react";

const GLOBAL_CSS = `
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

const HS_KEY = "adhd_arcade_v3";
function loadHS(){try{return JSON.parse(localStorage.getItem(HS_KEY)||"{}");}catch{return {};}}
function saveHS(game,score){
  const hs=loadHS();
  if(!hs[game]||score>hs[game]){hs[game]=score;localStorage.setItem(HS_KEY,JSON.stringify(hs));}
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
  useEffect(()=>{SFX.gameOver();},[]);
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
function TapSurge({onExit}) {
  const [nodes,setNodes]         = useState([]);
  const [score,setScore]         = useState(0);
  const [misses,setMisses]       = useState(0);
  const [running,setRunning]     = useState(false);
  const [countdown,setCountdown] = useState(3);
  const [gameOver,setGameOver]   = useState(false);
  const [popups,setPopups]       = useState([]);
  const [combo,setCombo]         = useState(0);
  const [flashWrong,setFlashWrong] = useState(false);
  const [speedPct,setSpeedPct]   = useState(0);
  const [dotColor,setDotColor]   = useState(surgeNodeColor(0));

  const areaRef     = useRef(null);
  const nodesRef    = useRef([]);
  const comboRef    = useRef(0);
  const scoreRef    = useRef(0);
  const missRef     = useRef(0);
  const gameOverRef = useRef(false);
  const spawnTimer  = useRef(null);

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
    missRef.current+=1;
    setMisses(missRef.current);
    SFX.loseLife();
    setFlashWrong(true);
    setTimeout(()=>setFlashWrong(false),420);
    if(missRef.current>=3){
      gameOverRef.current=true;
      clearTimeout(spawnTimer.current);
      setRunning(false);
      setGameOver(true);
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
    const spawnNow=surgeSpawnMs(scoreRef.current);
    setSpeedPct(Math.round(((2200-spawnNow)/(2200-300))*100));
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
    const hitAny=nodesRef.current.some(nd=>{
      const dx=px-nd.x,dy=py-nd.y;
      return Math.sqrt(dx*dx+dy*dy)<36;
    });
    if(hitAny) return;
    SFX.surgeWrongTap();
    // Base penalty 5, scales up with score: +1 per 50 score, capped at 50
    const scaledPenalty=Math.min(50, 5+Math.floor(scoreRef.current/50));
    const comboPenalty=comboRef.current*2;
    const penalty=scaledPenalty+comboPenalty;
    scoreRef.current=Math.max(0,scoreRef.current-penalty);
    setScore(scoreRef.current);
    setCombo(0);
    setFlashWrong(true);
    setTimeout(()=>setFlashWrong(false),280);
    addPopup(px,py,penalty,true);
  },[addPopup]);

  const restart=()=>{
    clearTimeout(spawnTimer.current);
    gameOverRef.current=false; missRef.current=0; scoreRef.current=0;
    setNodes([]);setScore(0);setMisses(0);setCombo(0);
    setSpeedPct(0);setDotColor(surgeNodeColor(0));
    setGameOver(false);setCountdown(3);setRunning(false);
  };

  if(gameOver) return <GameOver score={score} color={dotColor} game="tapsurge" onRestart={restart} onExit={onExit}/>;

  const hudColor=dotColor;
  return (
    <div
      style={{width:"100%",height:"100%",position:"relative",overflow:"hidden",
        animation:flashWrong?"wrongFlash 0.35s ease":"none"}}
      onPointerDown={handleAreaTap}
    >
      <div style={{position:"absolute",top:0,left:0,right:0,height:62,display:"flex",alignItems:"center",padding:"0 10px",gap:8,background:`linear-gradient(${T.surface}f0,transparent)`,zIndex:100,borderBottom:"1px solid #ffffff08"}}>
        <button onPointerDown={onExit} style={{background:"#ffffff08",border:"1px solid #ffffff12",color:"#ffffff55",padding:"5px 10px",borderRadius:4,fontFamily:"'Share Tech Mono'",fontSize:12,cursor:"pointer",flexShrink:0}}>←</button>
        <span style={{fontFamily:"'Black Ops One'",fontSize:13,color:hudColor,textShadow:`0 0 8px ${hudColor}`,flexShrink:0,transition:"color 1.5s"}}>TAP SURGE</span>
        <div style={{flex:1}}/>
        {speedPct>0&&<span style={{color:"#ffffff28",fontFamily:"'Share Tech Mono'",fontSize:9}}>{speedPct}% SPD</span>}
        {combo>=3&&<span style={{color:T.gold,fontFamily:"'Black Ops One'",fontSize:12,textShadow:`0 0 8px ${T.gold}`,animation:"pulse 0.5s infinite"}}>×{combo}</span>}
        <span style={{color:"#ffffff28",fontFamily:"'Share Tech Mono'",fontSize:9}}>BEST <span style={{color:hudColor}}>{loadHS()["tapsurge"]||0}</span></span>
        <span style={{fontFamily:"'Black Ops One'",fontSize:22,color:hudColor,textShadow:`0 0 10px ${hudColor}`,minWidth:44,textAlign:"right",transition:"color 1.5s"}}>{score}</span>
        <div style={{display:"flex",gap:3,flexShrink:0}}>
          {[0,1,2].map(i=>(
            <div key={i} style={{
              width:9,height:9,borderRadius:"50%",
              background:i<(3-misses)?hudColor:"#ff2d5540",
              boxShadow:i<(3-misses)?`0 0 6px ${hudColor}`:"0 0 4px #ff2d5555",
              transition:"all 0.3s",
            }}/>
          ))}
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

function TapSurgeNode({node,onTap}) {
  const [progress,setProgress] = useState(1);
  const progressRef = useRef(1);
  useEffect(()=>{
    const start=Date.now();
    const id=setInterval(()=>{
      const p=1-(Date.now()-start)/node.lifeMs;
      progressRef.current=Math.max(0,p);
      setProgress(Math.max(0,p));
    },40);
    return()=>clearInterval(id);
  },[node.lifeMs]);

  const size=64, r=27;
  const circ=Math.PI*2*r;
  const nodeCol=node.color||"#30d158";

  return (
    <div
      onPointerDown={e=>{e.stopPropagation();onTap(node,progressRef.current,e);}}
      style={{position:"absolute",left:node.x-size/2,top:node.y-size/2,width:size,height:size,cursor:"pointer",animation:"popIn 0.2s cubic-bezier(0.34,1.56,0.64,1)"}}
    >
      <svg width={size} height={size} style={{position:"absolute",inset:0,overflow:"visible"}}>
        <circle cx={size/2} cy={size/2} r={r+4} fill="none" stroke={`${nodeCol}14`} strokeWidth={7}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#ffffff08" strokeWidth={4}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke={nodeCol} strokeWidth={3.5}
          strokeDasharray={circ} strokeDashoffset={circ*(1-progress)}
          strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`}
        />
        <circle cx={size/2} cy={size/2} r={r-7}
          fill={`${nodeCol}1a`} stroke={`${nodeCol}44`} strokeWidth={1.5}
        />
      </svg>
    </div>
  );
}

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

function ColorPanic({onExit}) {
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
//  4 lanes, tiles fall from top. Tap/hold a lane button when a tile
//  enters the hit zone at the bottom. Perfect/Good/Miss scoring.
//  Speed and density increase with score. 3 misses = game over.
//  Each lane plays a distinct musical note for audio feedback.
// ═══════════════════════════════════════════════════════════════════

const PT_LANES   = 4;
const PT_COLOR   = "#e8c547";

// Note frequencies per lane (pentatonic scale — always sounds good)
const PT_NOTES   = [261.63, 329.63, 392.00, 523.25]; // C4 D4 G4 C5

function playPianoNote(lane, quality) {
  try {
    const ctx = getCtx();
    const freq = PT_NOTES[lane];
    const gainVal = quality === "perfect" ? 0.22 : quality === "good" ? 0.16 : 0.06;
    const osc  = ctx.createOscillator();
    const filt = ctx.createBiquadFilter();
    const env  = ctx.createGain();
    osc.connect(filt); filt.connect(env); env.connect(ctx.destination);
    osc.type = "triangle";
    filt.type = "lowpass"; filt.frequency.value = 1800; filt.Q.value = 0.6;
    const t = ctx.currentTime;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.98, t + 0.25);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(gainVal, t + 0.01);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.start(t); osc.stop(t + 0.35);
    // Soft overtone
    const osc2 = ctx.createOscillator();
    const env2 = ctx.createGain();
    osc2.connect(env2); env2.connect(ctx.destination);
    osc2.type = "sine"; osc2.frequency.value = freq * 2;
    env2.gain.setValueAtTime(0, t);
    env2.gain.linearRampToValueAtTime(gainVal * 0.3, t + 0.008);
    env2.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc2.start(t); osc2.stop(t + 0.2);
  } catch {}
}

function playMissThud() {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.connect(env); env.connect(ctx.destination);
    osc.type = "sine"; osc.frequency.value = 90;
    osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.15);
    env.gain.setValueAtTime(0.1, ctx.currentTime);
    env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.22);
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

// Hit window from bottom of play area (px). Perfect ±18, Good ±38
const PT_HIT_ZONE_H = 72; // height of the hit zone bar
const PT_PERFECT    = 18;
const PT_GOOD       = 40;

function PianoTiles({onExit}) {
  const [tiles, setTiles]         = useState([]);   // {id, lane, startY, speed, born}
  const [score, setScore]         = useState(0);
  const [misses, setMisses]       = useState(0);
  const [combo, setCombo]         = useState(0);
  const [running, setRunning]     = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [gameOver, setGameOver]   = useState(false);
  const [popups, setPopups]       = useState([]);
  const [laneFlash, setLaneFlash] = useState([false,false,false,false]);
  const [hitFeedback, setHitFeedback] = useState(null); // {text,color,key}

  const scoreRef    = useRef(0);
  const missRef     = useRef(0);
  const comboRef    = useRef(0);
  const gameOverRef = useRef(false);
  const tilesRef    = useRef([]);
  const areaRef     = useRef(null);
  const spawnTimer  = useRef(null);
  const frameRef    = useRef(null);
  // Track rendered tile positions via rAF
  const [tick, setTick] = useState(0);

  tilesRef.current = tiles;

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
    const x=lane*laneW+laneW/2;
    const y=rect.height-PT_HIT_ZONE_H-30;
    const id=uid();
    setPopups(p=>[...p,{id,x,y,val:text,color,neg:false,text:true}]);
    setTimeout(()=>setPopups(p=>p.filter(pp=>pp.id!==id)),700);
  },[]);

  const recordMiss=useCallback(()=>{
    if(gameOverRef.current) return;
    missRef.current+=1;
    setMisses(missRef.current);
    comboRef.current=0; setCombo(0);
    playMissThud();
    if(missRef.current>=3){
      gameOverRef.current=true;
      clearTimeout(spawnTimer.current);
      setRunning(false); setGameOver(true);
    }
  },[]);

  // Spawn tiles recursively
  const scheduleSpawn=useCallback(()=>{
    if(gameOverRef.current) return;
    const gap=ptSpawnGap(scoreRef.current);
    spawnTimer.current=setTimeout(()=>{
      if(gameOverRef.current) return;
      const lane=randI(0,PT_LANES-1);
      const speed=ptTileSpeed(scoreRef.current);
      const id=uid();
      const tile={id,lane,speed,born:Date.now()};
      setTiles(t=>[...t,tile]);
      // Auto-expire: if still on screen after speed+200ms = missed
      setTimeout(()=>{
        setTiles(prev=>{
          const still=prev.find(tl=>tl.id===id);
          if(still) recordMiss();
          return prev.filter(tl=>tl.id!==id);
        });
      }, speed+200);
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
    // Flash lane
    setLaneFlash(f=>{const n=[...f];n[lane]=true;return n;});
    setTimeout(()=>setLaneFlash(f=>{const n=[...f];n[lane]=false;return n;}),120);

    if(!areaRef.current) return;
    const rect=areaRef.current.getBoundingClientRect();
    const areaH=rect.height-PT_HIT_ZONE_H;
    const now=Date.now();

    // Find tile in this lane closest to the hit zone
    const laneTiles=tilesRef.current
      .filter(t=>t.lane===lane)
      .map(t=>{
        const elapsed=now-t.born;
        const progress=elapsed/t.speed;       // 0=top 1=bottom
        const y=progress*areaH;               // px from top of play area
        const distFromBottom=areaH-y;
        return{...t,y,distFromBottom};
      })
      .sort((a,b)=>a.distFromBottom-b.distFromBottom);

    const closest=laneTiles[0];
    if(!closest){
      // Empty tap — small penalty
      const pen=Math.max(3,Math.floor(scoreRef.current/100));
      scoreRef.current=Math.max(0,scoreRef.current-pen);
      setScore(scoreRef.current);
      setHitFeedback({text:"EMPTY",color:"#ffffff33",key:uid()});
      return;
    }

    const dist=Math.abs(closest.distFromBottom);
    let quality=null;
    if(dist<=PT_PERFECT)      quality="perfect";
    else if(dist<=PT_GOOD)    quality="good";
    else if(closest.distFromBottom>0) quality="early"; // tile hasn't arrived yet — too early

    if(!quality||quality==="early"){
      // Too early or too far — miss
      const pen=Math.max(3,Math.floor(scoreRef.current/80));
      scoreRef.current=Math.max(0,scoreRef.current-pen);
      setScore(scoreRef.current);
      setHitFeedback({text:"MISS",color:T.red,key:uid()});
      playMissThud();
      return;
    }

    // Hit!
    setTiles(t=>t.filter(tl=>tl.id!==closest.id));
    comboRef.current+=1; setCombo(comboRef.current);
    const comboMult=comboRef.current>=20?4:comboRef.current>=10?3:comboRef.current>=5?2:1;
    const basePts=quality==="perfect"?100:60;
    const pts=basePts*comboMult;
    scoreRef.current+=pts; setScore(scoreRef.current);
    playPianoNote(lane, quality);
    addPopup(lane, quality==="perfect"?"PERFECT!":"GOOD", quality==="perfect"?PT_COLOR:"#88ddff");
    setHitFeedback({text:quality==="perfect"?"✦ PERFECT":"GOOD",color:quality==="perfect"?PT_COLOR:"#88ddff",key:uid()});
  },[addPopup]);

  const restart=()=>{
    clearTimeout(spawnTimer.current);
    gameOverRef.current=false; missRef.current=0; scoreRef.current=0; comboRef.current=0;
    setTiles([]); setScore(0); setMisses(0); setCombo(0);
    setGameOver(false); setCountdown(3); setRunning(false);
    setLaneFlash([false,false,false,false]); setPopups([]);
  };

  if(gameOver) return <GameOver score={score} color={PT_COLOR} game="pianotiles" onRestart={restart} onExit={onExit}/>;

  // Compute tile positions from elapsed time
  const now=Date.now();
  const areaH=areaRef.current?.getBoundingClientRect().height-PT_HIT_ZONE_H||600;
  const computedTiles=tiles.map(t=>{
    const elapsed=now-t.born;
    const progress=Math.min(1,elapsed/t.speed);
    return{...t,progress,y:progress*areaH};
  });

  const laneColors=["#e8c547","#5ac8fa","#bf5af2","#ff6b6b"];

  return (
    <div style={{width:"100%",height:"100%",position:"relative",overflow:"hidden",background:T.bg,display:"flex",flexDirection:"column"}}>
      {/* HUD */}
      <div style={{height:62,display:"flex",alignItems:"center",padding:"0 10px",gap:8,background:`linear-gradient(${T.surface}f0,transparent)`,zIndex:100,borderBottom:"1px solid #ffffff08",flexShrink:0}}>
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

        {/* Lane dividers */}
        {[1,2,3].map(i=>(
          <div key={i} style={{position:"absolute",top:0,bottom:0,left:`${i*25}%`,width:1,background:"#ffffff08",zIndex:1}}/>
        ))}

        {/* Hit zone bar */}
        <div style={{
          position:"absolute",bottom:PT_HIT_ZONE_H-2,left:0,right:0,height:2,
          background:`linear-gradient(90deg,${laneColors.join(",")})`,
          opacity:0.5,zIndex:3,
        }}/>
        {/* Hit zone glow */}
        <div style={{
          position:"absolute",bottom:PT_HIT_ZONE_H-14,left:0,right:0,height:12,
          background:"linear-gradient(transparent,rgba(255,255,255,0.04))",
          zIndex:2,
        }}/>

        {/* Falling tiles */}
        {computedTiles.map(t=>{
          const laneW=100/PT_LANES;
          const col=laneColors[t.lane];
          return (
            <div key={t.id} style={{
              position:"absolute",
              left:`${t.lane*laneW+0.5}%`,
              width:`${laneW-1}%`,
              top:t.y-90,
              height:88,
              borderRadius:8,
              background:`linear-gradient(180deg,${col}cc,${col}99)`,
              boxShadow:`0 0 16px ${col}55, inset 0 1px 0 rgba(255,255,255,0.2)`,
              border:`1px solid ${col}88`,
              zIndex:2,
            }}/>
          );
        })}

        {/* Hit feedback overlay */}
        {hitFeedback&&(
          <div key={hitFeedback.key} style={{
            position:"absolute",top:"30%",left:0,right:0,
            textAlign:"center",pointerEvents:"none",
            fontFamily:"'Black Ops One'",fontSize:26,
            color:hitFeedback.color,
            textShadow:`0 0 16px ${hitFeedback.color}`,
            animation:"floatUp 0.6s ease-out forwards",zIndex:10,
          }}>{hitFeedback.text}</div>
        )}

        {/* Score popups */}
        {popups.map(p=>(
          <ScorePopup key={p.id} x={p.x} y={p.y} value={p.val} color={p.color}/>
        ))}
      </div>

      {/* Lane tap buttons */}
      <div style={{height:PT_HIT_ZONE_H,display:"flex",flexShrink:0,borderTop:"1px solid #ffffff10"}}>
        {laneColors.map((col,i)=>(
          <div
            key={i}
            onPointerDown={e=>{e.preventDefault();tapLane(i);}}
            style={{
              flex:1,
              background:laneFlash[i]?`${col}55`:`${col}0d`,
              borderRight:i<PT_LANES-1?"1px solid #ffffff10":"none",
              cursor:"pointer",
              display:"flex",alignItems:"center",justifyContent:"center",
              transition:"background 0.06s",
              userSelect:"none",
              WebkitUserSelect:"none",
            }}
          >
            <div style={{
              width:36,height:36,borderRadius:"50%",
              border:`2px solid ${col}${laneFlash[i]?"ff":"55"}`,
              background:laneFlash[i]?`${col}44`:"transparent",
              transition:"all 0.06s",
              boxShadow:laneFlash[i]?`0 0 12px ${col}`:"none",
            }}/>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  GAME 4: SPLITTER (UPDATED)
//  - Smaller dots get MORE time (lifeMultiplier increases with level)
//  - baseLife shrinks as score rises → pressure increases over time
// ═══════════════════════════════════════════════════════════════════
function Splitter({onExit}) {
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

// ═══════════════════════════════════════════════════════════════════
//  ARCADE MENU
// ═══════════════════════════════════════════════════════════════════
const GAMES=[
  {id:"tapsurge",   label:"TAP SURGE",    color:T.surge,    emoji:"⚡", desc:"Tap dots before they vanish · 3 misses and it's over",              component:TapSurge},
  {id:"colorpanic", label:"COLOR PANIC",  color:T.panic,    emoji:"🎨", desc:"Tap only the target color · grace period on color switch",           component:ColorPanic},
  {id:"pianotiles", label:"PIANO TILES",  color:PT_COLOR,   emoji:"🎹", desc:"Tap the lane when a tile hits the line · Perfect > Good > Miss",     component:PianoTiles},
  {id:"splitter",   label:"SPLITTER",     color:T.splitter, emoji:"💥", desc:"Tap dots before they split · gets faster as you score",              component:Splitter},
];

export default function ADHDArcade() {
  const [activeGame,setActiveGame]=useState(null);
  const hs=loadHS();

  useEffect(()=>{
    const s=document.createElement("style");
    s.textContent=GLOBAL_CSS;
    document.head.appendChild(s);
    return()=>document.head.removeChild(s);
  },[]);

  const G=activeGame?GAMES.find(g=>g.id===activeGame):null;

  return (
    <div style={{width:"100vw",height:"100svh",background:T.bg,overflow:"hidden",position:"relative"}}>
      <div style={{position:"fixed",inset:0,pointerEvents:"none",opacity:0.025,backgroundImage:"linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)",backgroundSize:"28px 28px"}}/>
      {G
        ?<div style={{width:"100%",height:"100%"}}><G.component onExit={()=>setActiveGame(null)}/></div>
        :(
          <div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",alignItems:"center",overflowY:"auto",padding:"18px 14px 40px"}}>
            <div style={{textAlign:"center",marginBottom:22,marginTop:6}}>
              <div style={{fontFamily:"'Black Ops One'",fontSize:34,letterSpacing:5,background:"linear-gradient(135deg,#ff2d78,#ff9500,#ffd60a)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",filter:"drop-shadow(0 0 16px #ff2d7866)",lineHeight:1,marginBottom:5}}>ADHD ARCADE</div>
              <div style={{color:"#ffffff28",fontFamily:"'Share Tech Mono'",fontSize:9,letterSpacing:5}}>TAP · REACT · SCORE · REPEAT</div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,width:"100%",maxWidth:430}}>
              {GAMES.map((game,i)=>{
                const best=hs[game.id]||0;
                return (
                  <div key={game.id} onPointerDown={()=>{getCtx();setActiveGame(game.id);}}
                    style={{background:`linear-gradient(135deg,${game.color}0d,${game.color}04)`,border:`1px solid ${game.color}2e`,borderRadius:12,padding:"16px 12px",cursor:"pointer",animation:`slideUp 0.4s ease ${i*0.07}s both`,position:"relative",overflow:"hidden"}}>
                    <div style={{position:"absolute",top:-14,right:-14,width:50,height:50,borderRadius:"50%",background:game.color,opacity:0.07,filter:"blur(16px)"}}/>
                    <div style={{fontSize:26,marginBottom:7}}>{game.emoji}</div>
                    <div style={{fontFamily:"'Black Ops One'",fontSize:12,color:game.color,letterSpacing:1,textShadow:`0 0 8px ${game.color}66`,marginBottom:4}}>{game.label}</div>
                    <div style={{fontFamily:"'Share Tech Mono'",fontSize:8,color:"#ffffff35",letterSpacing:0.3,lineHeight:1.6,marginBottom:8}}>{game.desc}</div>
                    {best>0&&<div style={{fontFamily:"'Share Tech Mono'",fontSize:9,color:game.color,opacity:0.6}}>BEST: {best}</div>}
                    <div style={{position:"absolute",bottom:10,right:10,fontFamily:"'Black Ops One'",fontSize:16,color:game.color,opacity:0.16}}>▶</div>
                  </div>
                );
              })}
            </div>
            <div style={{marginTop:22,color:"#ffffff12",fontFamily:"'Share Tech Mono'",fontSize:8,letterSpacing:3,textAlign:"center",lineHeight:2}}>SCORES SAVED LOCALLY · TURN SOUND ON</div>
          </div>
        )
      }
    </div>
  );
}
