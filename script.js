/* ============================================================================
 * DUNGEON WORLD — a QeNTROPY arcade run
 * Real-time Gauntlet-style arena survival. Wisp, banished by the Hollow Wizard,
 * crashes onto an endless quantum dungeon-planet. Clear the swarm, dive the rift.
 * Seed-driven waves (same daily run for everyone). Comic-book carnage.
 * ========================================================================== */
(() => {
  "use strict";

  // ---------- palette ----------
  const C = {
    floor1:"#e8d08a", floor2:"#dcc276", grain:"#c7ab63",
    wall1:"#b7bfd3", wall2:"#8d97b0", wall3:"#5f6985",
    ink:"#241a2e", wisp:"#ff79c6", wispDk:"#c84f97", wispLt:"#ffd0ec",
    laser:"#fff27a", laserCore:"#ff8a3d",
    hp:"#ff4d6d", hpDk:"#7a2630",
    portal:"#35a7e0", portal2:"#bfe9ff",
    gold:"#ffd53d", paper:"#f3e7c2",
  };
  const ETYPES = {
    grunt:   { r:0.30, speed:1.55, hp:2,  score:100, col:"#7d5ce2", dk:"#402a7a", words:["POW!","BAP!"] },
    swarmer: { r:0.23, speed:2.65, hp:1,  score:60,  col:"#4fd0c0", dk:"#1f7a70", words:["ZAP!","ZIP!"] },
    brute:   { r:0.44, speed:0.95, hp:6,  score:250, col:"#e2683c", dk:"#7a2f17", words:["BAM!","WHAM!"] },
    caster:  { r:0.32, speed:1.20, hp:3,  score:180, col:"#5aa0ff", dk:"#274a8a", words:["ZAP!","POW!"] },
    tank:    { r:0.50, speed:0.50, hp:12, score:420, col:"#8a9a5b", dk:"#3e4a25", words:["BLAM!","BOOM!"] },
    boss:    { r:0.85, speed:1.50, hp:48, score:2500, col:"#d84a54", dk:"#7a2630", words:["BOOM!","KAPOW!"] },
  };
  const WORDS_CRIT = ["KAPOW!","WHAMM!","BOOM!","SMASH!"];

  // ---------- acts (themed chapters; cycle & escalate forever) ----------
  const ACTS = [
    { name:"THE PALE CRYPT",     f1:"#e8d08a", f2:"#dcc276", w1:"#b7bfd3", w2:"#8d97b0", w3:"#5f6985", brute:0.16, caster:0.05, dread:0.00 },
    { name:"THE EMBER DEPTHS",   f1:"#d99c63", f2:"#c9863f", w1:"#a86a4a", w2:"#7c4a30", w3:"#512e1c", brute:0.24, caster:0.06, dread:0.06 },
    { name:"THE FROST WARRENS",  f1:"#bcd6e6", f2:"#9fc0d6", w1:"#8fb0c8", w2:"#5f86a5", w3:"#3d5c78", brute:0.16, caster:0.09, dread:0.10 },
    { name:"THE HEX GARDENS",    f1:"#b9cf7e", f2:"#9db85e", w1:"#7f9a53", w2:"#566e33", w3:"#374a1f", brute:0.18, caster:0.15, dread:0.14 },
    { name:"THE BONE REACH",     f1:"#d9d2c0", f2:"#c3baa4", w1:"#a49c8a", w2:"#736c5c", w3:"#474338", brute:0.24, caster:0.10, dread:0.18 },
    { name:"THE VOID CHOIR",     f1:"#8a7bbf", f2:"#6f5fa6", w1:"#5b4c8c", w2:"#3d3160", w3:"#241a3a", brute:0.20, caster:0.16, dread:0.24 },
    { name:"THE MAGMA THRONE",   f1:"#c25a3a", f2:"#a5432a", w1:"#8a3320", w2:"#5e2013", w3:"#38120a", brute:0.30, caster:0.10, dread:0.28 },
    { name:"THE MIRROR VOID",    f1:"#9aa0a6", f2:"#7d858c", w1:"#6a7176", w2:"#474d52", w3:"#2b2f33", brute:0.22, caster:0.18, dread:0.34 },
    { name:"THE SCREAMING DARK", f1:"#5b5566", f2:"#453f52", w1:"#3a3346", w2:"#272031", w3:"#160f1e", brute:0.24, caster:0.18, dread:0.44 },
    { name:"THE QUANTUM CORE",   f1:"#3aa0b8", f2:"#2b7f96", w1:"#7d5ce2", w2:"#4a2f8a", w3:"#241a4a", brute:0.26, caster:0.20, dread:0.40 },
  ];
  const ROMAN=["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII","XIII","XIV","XV"];
  function actInfo(f){ const a=Math.floor((f-1)/10); return { a, loop:Math.floor(a/ACTS.length), th:ACTS[a%ACTS.length] }; }
  let THEME=ACTS[0], waveBatch=8, floorLoop=0;
  const ACT_EYE=["#fff27a","#ff7a3c","#8fe0ff","#b6ff5a","#ffe6a0","#c58bff","#ff5a3c","#e0e6ff","#ff3b57","#5cf2ff"];

  // ---------- prng ----------
  function xmur3(s){ let h=1779033703^s.length; for(let i=0;i<s.length;i++){ h=Math.imul(h^s.charCodeAt(i),3432918353); h=h<<13|h>>>19; } return ()=>{ h=Math.imul(h^h>>>16,2246822507); h=Math.imul(h^h>>>13,3266489909); return (h^=h>>>16)>>>0; }; }
  function mulberry32(a){ return ()=>{ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  function makeRng(seed,salt){ const s=xmur3(String(seed)+"|"+(salt||"")); return mulberry32(s()); }

  // ---------- canvas ----------
  const SIZE=11, TILE=48, W=SIZE*TILE, H=SIZE*TILE;
  const cv=document.getElementById("board"), ctx=cv.getContext("2d");
  let dpr=1;
  function resize(){ dpr=Math.min(window.devicePixelRatio||1,2); cv.width=W*dpr; cv.height=H*dpr; ctx.setTransform(dpr,0,0,dpr,0,0); }
  resize(); window.addEventListener("resize",resize);

  // ---------- seed ----------
  function laDate(){ try{ return new Date().toLocaleDateString("en-CA",{timeZone:"America/Los_Angeles"}); }catch(e){ return new Date().toISOString().slice(0,10); } }
  const params = new URLSearchParams(location.search);
  const SEED = params.get("seed") || ("dungeonworld|"+laDate());
  const START_FLOOR = Math.max(1, parseInt(params.get("floor"),10) || 1);

  // ---------- input ----------
  const held = new Set();
  const KEYMAP = { ArrowUp:"up",KeyW:"up", ArrowDown:"down",KeyS:"down", ArrowLeft:"left",KeyA:"left", ArrowRight:"right",KeyD:"right", Space:"fire" };
  addEventListener("keydown",(e)=>{ initMusic(); if(e.code==="KeyM"){ e.preventDefault(); toggleMusic(); return; } if(e.code==="KeyG"||e.code==="ShiftLeft"||e.code==="ShiftRight"){ e.preventDefault(); activateGhost(); return; } if(e.code==="KeyN"){ e.preventDefault(); triggerNuke(); return; } const k=KEYMAP[e.code]; if(!k) return; held.add(k); if(e.code==="Space"||e.code.indexOf("Arrow")===0) e.preventDefault(); if(phase!=="play"&&!dwModalOpen) startOrRestart(); });
  addEventListener("pointerdown",()=>initMusic(),{once:false});
  addEventListener("keyup",(e)=>{ const k=KEYMAP[e.code]; if(k) held.delete(k); });
  function bindBtn(id,k){ const el=document.getElementById(id); if(!el) return;
    const on=(e)=>{ e.preventDefault(); held.add(k); if(phase!=="play"&&!dwModalOpen) startOrRestart(); };
    const off=(e)=>{ e.preventDefault(); held.delete(k); };
    el.addEventListener("pointerdown",on); el.addEventListener("pointerup",off);
    el.addEventListener("pointerleave",off); el.addEventListener("pointercancel",off);
  }
  bindBtn("btn-up","up"); bindBtn("btn-down","down"); bindBtn("btn-left","left"); bindBtn("btn-right","right"); bindBtn("btn-fire","fire");
  (function(){ const gb=document.getElementById("btn-ghost"); if(gb) gb.addEventListener("pointerdown",(e)=>{ e.preventDefault(); if(phase!=="play"){ if(!dwModalOpen) startOrRestart(); return; } activateGhost(); }); })();
  (function(){ const nb=document.getElementById("btn-nuke"); if(nb) nb.addEventListener("pointerdown",(e)=>{ e.preventDefault(); if(phase!=="play"){ if(!dwModalOpen) startOrRestart(); return; } triggerNuke(); }); })();
  cv.addEventListener("pointerdown",()=>{ if(phase!=="play"&&!dwModalOpen) startOrRestart(); });

  // ---------- state ----------
  let phase="intro", floor=1, score=0, best=0, hearts=4, maxHearts=4;
  let player=null, enemies=[], bullets=[], popups=[], walls=new Set(), portal=null, toSpawn=[], spawnRng=null, spawnTimer=0, fireCd=0, iframe=0, speedMul=1;
  let banner="", bannerT=0, shake=0, flash=0, killStreak=0, streakT=0;
  let pickups=[], weapon="laser", weaponT=0, ghostCharges=3, ghostMax=3, ghostT=0;
  let mines=[], blasts=[], dropCd=0, eid=0;
  let ebullets=[], doors=[], doorSet=new Set(), anim=0;
  let spawners=[], genSet=new Set(), dropship=null, mushrooms=[], nukesHeld=0, maxNukes=3, vases=[], waterSpots=[], waterSet=new Set(), scraps=[], dying=false, deathT=0, hordeTheme="classic", music=null, musicOn=true, musicTried=false;
  // ---------- monetization hooks (ad-to-continue / IAP unlock) ----------
  // dwModalOpen blocks the "any tap/key restarts" behavior above while the
  // game-over modal (defined in monetization.js) is on screen, so a player
  // reaching for SPACE to restart doesn't accidentally skip past the
  // continue/purchase offer.
  let dwModalOpen=false, continuesUsed=0, gameOverListeners=[];
  const MAX_FREE_CONTINUES=2; // how many rewarded-ad continues per run before the offer switches to "buy full game"
  function hasFullUnlock(){ return !!(window.DungeonWorldMonetization && window.DungeonWorldMonetization.isFullUnlock()); }
  function notifyGameOver(){
    const canContinue = hasFullUnlock() || continuesUsed<MAX_FREE_CONTINUES;
    const data={ score, best, floor, canContinue, continuesUsed, maxFreeContinues:MAX_FREE_CONTINUES, fullUnlock:hasFullUnlock() };
    gameOverListeners.forEach(function(cb){ try{ cb(data); }catch(e){ console.error("DungeonWorld onGameOver listener failed:",e); } });
  }
  function isEmberAct(){ return actInfo(floor).a%3===2; }
  function initMusic(){ if(musicTried||typeof Audio==="undefined") return; musicTried=true;
    const SRCS=["DUNGEONMUSIC.wav","dungeonmusic.wav","DUNGEONMUSIC.mp3","music.wav","music.mp3"]; let i=0;
    const tryNext=()=>{ if(i>=SRCS.length) return; const a=new Audio(SRCS[i++]); a.loop=true; a.volume=0.35;
      a.onerror=tryNext; a.oncanplaythrough=()=>{ if(music) return; music=a; if(musicOn&&phase==="play") music.play().catch(()=>{}); }; };
    tryNext();
  }
  function toggleMusic(){ musicOn=!musicOn; if(music){ if(musicOn) music.play().catch(()=>{}); else music.pause(); }
    if(player) addPop(player.x,player.y-34, musicOn?"MUSIC ON":"MUSIC OFF", C.gold, false); }
  function startDeath(){ if(dying) return; dying=true; deathT=0; iframe=99; shake=Math.max(shake,12); addPop(player.x,player.y-40,"NOOO!",C.hp,true); burst(player.x,player.y,C.hp,18); }
  let curF1="#e8d08a", curF2="#dcc276", curW1="#b7bfd3", curW2="#8d97b0", curW3="#5f6985";
  const PCOL={ bspread:"#35a7e0", rocket:"#e2683c", beam:"#ffe14d", mine:"#f0872e", flame:"#ff8a3c", star:"#ff6ec7", minigun:"#ffd23c", nuke:"#b061ff", nukegun:"#b061ff" };
  const WLABEL={ bspread:"BOUNCY SPREAD", rocket:"ROCKETS", beam:"PIERCE BEAM", mine:"GRENADES", flame:"FLAME ARROWS", star:"STARBURST", minigun:"MINIGUN", nukegun:"NUKE GUN" };
  const BANDS=[null,"46,150,90","205,160,40","200,52,18","135,70,200","40,160,170","230,110,30","165,30,60"];
  function bandRGB(){ return BANDS[Math.floor((floor-1)/5)%BANDS.length]; }

  // ---------- arena ----------
  function genWalls(fl){
    const rng=makeRng(SEED,"walls|"+fl); const set=new Set();
    const n=2+Math.floor(rng()*4); let tries=0;
    const mid=(SIZE-1)/2;
    while(set.size<n && tries<80){ tries++;
      const x=2+Math.floor(rng()*(SIZE-4)), y=2+Math.floor(rng()*(SIZE-4));
      if(Math.abs(x-mid)<1.5 && Math.abs(y-mid)<1.5) continue; // keep center clear (spawn + portal)
      set.add(x+","+y);
    }
    return set;
  }
  function solid(col,row){ if(col<=0||row<=0||col>=SIZE-1||row>=SIZE-1) return true; return walls.has(col+","+row); }
  function blocked(px,py,r){
    const minc=Math.floor((px-r)/TILE), maxc=Math.floor((px+r)/TILE);
    const minr=Math.floor((py-r)/TILE), maxr=Math.floor((py+r)/TILE);
    for(let row=minr;row<=maxr;row++) for(let col=minc;col<=maxc;col++){
      if(!solid(col,row) && !doorSet.has(col+","+row) && !genSet.has(col+","+row)) continue;
      const cx=Math.max(col*TILE,Math.min(px,col*TILE+TILE)), cy=Math.max(row*TILE,Math.min(py,row*TILE+TILE));
      const dx=px-cx, dy=py-cy; if(dx*dx+dy*dy < r*r) return true;
    }
    return false;
  }
  function waterBlocked(px,py,r){ if(!waterSet.size) return false; const rr=r*0.72;
    const minc=Math.floor((px-rr)/TILE), maxc=Math.floor((px+rr)/TILE);
    const minr=Math.floor((py-rr)/TILE), maxr=Math.floor((py+rr)/TILE);
    for(let row=minr;row<=maxr;row++) for(let col=minc;col<=maxc;col++){
      if(!waterSet.has(col+","+row)) continue;
      const cx=Math.max(col*TILE,Math.min(px,col*TILE+TILE)), cy=Math.max(row*TILE,Math.min(py,row*TILE+TILE));
      const dx=px-cx, dy=py-cy; if(dx*dx+dy*dy < rr*rr) return true;
    }
    return false;
  }
  function moveEnt(e,dx,dy){
    const ghost=(e.form==="ghost"), cr=e.cr||e.r;
    if(dx){ const nx=e.x+dx; if(!blocked(nx,e.y,cr) && (ghost||!waterBlocked(nx,e.y,cr))) e.x=nx; }
    if(dy){ const ny=e.y+dy; if(!blocked(e.x,ny,cr) && (ghost||!waterBlocked(e.x,ny,cr))) e.y=ny; }
  }
  function edgeSpawn(rng){
    for(let t=0;t<40;t++){
      const side=Math.floor(rng()*4); let col,row;
      if(side===0){ col=1+Math.floor(rng()*(SIZE-2)); row=1; }
      else if(side===1){ col=1+Math.floor(rng()*(SIZE-2)); row=SIZE-2; }
      else if(side===2){ col=1; row=1+Math.floor(rng()*(SIZE-2)); }
      else { col=SIZE-2; row=1+Math.floor(rng()*(SIZE-2)); }
      if(!solid(col,row) && !waterSet.has(col+","+row)) return { x:col*TILE+TILE/2, y:row*TILE+TILE/2 };
    }
    return { x:TILE*1.5, y:TILE*1.5 };
  }

  // ---------- floor / waves ----------
  function startFloor(){
    walls=genWalls(floor);
    const rng=makeRng(SEED,"floor|"+floor);
    const {a,loop,th}=actInfo(floor); THEME=th; floorLoop=loop;
    const isBoss = floor%5===0, isActEnd = floor%10===0;
    toSpawn=[];
    if(isBoss){
      toSpawn.push("boss");
      const adds=Math.min(24,(isActEnd?4:2)+Math.floor(floor*0.5)+a);
      for(let i=0;i<adds;i++){ const r=rng(); toSpawn.push(r<0.2?"caster":r<0.6?"grunt":"swarmer"); }
    } else {
      const total=Math.min(120, 6+Math.floor(floor*2.0)+a*4);
      const fbrute=Math.min(0.42, th.brute+floor*0.006);
      const fcast =(floor>=3)?Math.min(0.30, th.caster+floor*0.005):0;
      const ftank =(floor>=6)?Math.min(0.10, 0.02+a*0.012):0;
      for(let i=0;i<total;i++){ const r=rng();
        toSpawn.push( r<ftank ? "tank" : r<ftank+fcast ? "caster" : r<ftank+fcast+fbrute ? "brute" : (rng()<0.55 ? "swarmer" : "grunt") );
      }
    }
    for(let i=toSpawn.length-1;i>0;i--){ const j=Math.floor(rng()*(i+1)); const t=toSpawn[i]; toSpawn[i]=toSpawn[j]; toSpawn[j]=t; }
    enemies=[]; bullets=[]; popups=[]; portal=null; spawnTimer=0; fireCd=0; iframe=0; pickups=[]; ghostT=0; mines=[]; blasts=[]; dropCd=0; ebullets=[];
    // per-floor color variation (subtle tint over the act palette so each level feels fresh)
    { const tRng=makeRng(SEED,"tint|"+floor); const TINTS=["#ffffff","#0a0713","#e6c6ff","#bfe0ff","#ffe0b0","#bfffd8","#ffc6d0","#d0f0ff"];
      const tc=TINTS[Math.floor(tRng()*TINTS.length)], amt=0.07+tRng()*0.09;
      curF1=mix(THEME.f1,tc,amt); curF2=mix(THEME.f2,tc,amt);
      curW1=mix(THEME.w1,tc,amt*0.6); curW2=mix(THEME.w2,tc,amt*0.6); curW3=mix(THEME.w3,tc,amt*0.6); }
    // Gauntlet-style doors: thin barriers that block, and collapse when touched or shot.
    // Gauntlet-style doors: FULL wall-to-wall barrier lines (no open breaks).
    // Walk into a segment (or shoot it) and it collapses, opening a gap.
    doors=[]; doorSet=new Set();
    if(floor>=4){ const dRng=makeRng(SEED,"door|"+floor); const mid=(SIZE-1)/2;
      const nLines=Math.min(3, 1+Math.floor(a/3)); const usedR=new Set(), usedC=new Set();
      for(let n=0;n<nLines;n++){ const horiz=dRng()<0.5; let idx=-1;
        for(let t=0;t<20;t++){ const cand=2+Math.floor(dRng()*(SIZE-4)); if(cand===mid) continue; if(horiz?usedR.has(cand):usedC.has(cand)) continue; idx=cand; break; }
        if(idx<0) continue;
        if(horiz){ usedR.add(idx); for(let c=1;c<=SIZE-2;c++){ if(solid(c,idx)) continue; doors.push({col:c,row:idx,x:c*TILE+TILE/2,y:idx*TILE+TILE/2,horiz:true,open:false,collapse:0}); doorSet.add(c+","+idx); } }
        else { usedC.add(idx); for(let r=1;r<=SIZE-2;r++){ if(solid(idx,r)) continue; doors.push({col:idx,row:r,x:idx*TILE+TILE/2,y:r*TILE+TILE/2,horiz:false,open:false,collapse:0}); doorSet.add(idx+","+r); } }
      }
    }
    // monster generators (Gauntlet-style machines) — spew enemies until shot; deeper floors
    spawners=[]; genSet=new Set();
    if(!isBoss && floor>=4){ const gRng=makeRng(SEED,"gen|"+floor); const mid=(SIZE-1)/2;
      const ng=Math.min(3, 1+Math.floor(a/3));
      for(let n=0;n<ng;n++){ for(let t=0;t<40;t++){ const col=2+Math.floor(gRng()*(SIZE-4)), row=2+Math.floor(gRng()*(SIZE-4));
        if(solid(col,row)||doorSet.has(col+","+row)||genSet.has(col+","+row)) continue; if(Math.abs(col-mid)<1.5&&Math.abs(row-mid)<1.5) continue;
        spawners.push({ col,row,x:col*TILE+TILE/2,y:row*TILE+TILE/2, alive:true, cd:1.5+gRng()*1.5 }); genSet.add(col+","+row); break; } }
    }
    // dropship set-piece — flies in and drops a squad on some floors
    dropship=null;
    if(!isBoss && floor>=3){ const sRng=makeRng(SEED,"ship|"+floor);
      if(sRng()<0.4){ const dir=sRng()<0.5?1:-1, squad=[], k=3+Math.floor(sRng()*4);
        for(let i=0;i<k;i++){ const r=sRng(); squad.push(r<0.5?"swarmer":r<0.8?"grunt":"brute"); }
        dropship={ x: dir>0?-TILE:W+TILE, y:TILE*1.35, vx:dir*2.0*TILE, dir, dropCd:0.55, squad, wait:2.4, announced:false }; }
    }
    // decorative water pools + breakable vases (seeded per floor)
    vases=[]; waterSpots=[]; waterSet=new Set(); scraps=[]; dying=false; deathT=0;
    { const tRng=makeRng(SEED,"theme|"+floor); const tr=tRng();
      if(floor>=10) hordeTheme = tr<0.25 ? "zombie" : tr<0.45 ? "alien" : tr<0.68 ? "magic" : "classic";
      else hordeTheme = tr<0.3 ? "zombie" : tr<0.55 ? "alien" : "classic"; }
    if(music&&musicOn) music.play().catch(()=>{});
    { const pRng=makeRng(SEED,"props|"+floor); const mid=(SIZE-1)/2;
      const openSpot=()=>{ for(let t=0;t<30;t++){ const c=2+Math.floor(pRng()*(SIZE-4)), r=2+Math.floor(pRng()*(SIZE-4));
        if(solid(c,r)||doorSet.has(c+","+r)||genSet.has(c+","+r)) continue; if(Math.abs(c-mid)<1.5&&Math.abs(r-mid)<1.5) continue;
        if(waterSpots.some(w=>w.col===c&&w.row===r)||vases.some(v=>v.col===c&&v.row===r)||scraps.some(sc=>sc.col===c&&sc.row===r)) continue; return {c,r}; } return null; };
      const nw=(pRng()<0.45)?2:1;
      const can=(c,r)=> c>=2&&r>=2&&c<=SIZE-3&&r<=SIZE-3 && !solid(c,r) && !doorSet.has(c+","+r) && !genSet.has(c+","+r) && !waterSpots.some(w=>w.col===c&&w.row===r) && !(Math.abs(c-mid)<1.6&&Math.abs(r-mid)<1.6);
      const tryBase=()=>{ for(let t=0;t<50;t++){ const c=2+Math.floor(pRng()*(SIZE-5)), r=2+Math.floor(pRng()*(SIZE-5));
        if(can(c,r)&&can(c+1,r)&&can(c,r+1)&&can(c+1,r+1)) return {c,r}; } return null; };
      for(let n=0;n<nw;n++){ const s=tryBase();
        if(s){ const pond=[{col:s.c,row:s.r},{col:s.c+1,row:s.r},{col:s.c,row:s.r+1},{col:s.c+1,row:s.r+1}];
          pond.forEach(t=>waterSpots.push(t));
          const grow=3+Math.floor(pRng()*4), DIRS=[[1,0],[-1,0],[0,1],[0,-1]]; let added=0;
          for(let a=0;a<18&&added<grow;a++){ const base=pond[Math.floor(pRng()*pond.length)], d=DIRS[Math.floor(pRng()*4)], nc=base.col+d[0], nr=base.row+d[1];
            if(!can(nc,nr)) continue; const t={col:nc,row:nr}; pond.push(t); waterSpots.push(t); added++; }
        } else { const o=openSpot(); if(o) waterSpots.push({col:o.c,row:o.r}); }
      }
      waterSpots.forEach(w=>waterSet.add(w.col+","+w.row));
      if(!isBoss){ const nv=2+Math.floor(pRng()*3); for(let n=0;n<nv;n++){ const s=openSpot(); if(s) vases.push({col:s.c,row:s.r,x:s.c*TILE+TILE/2,y:s.r*TILE+TILE/2,alive:true}); } }
      { const ns=3+Math.floor(pRng()*3); for(let n=0;n<ns;n++){ const s=openSpot(); if(s) scraps.push({col:s.c,row:s.r,x:s.c*TILE+TILE/2,y:s.r*TILE+TILE/2,v:[0,1,2,3,5][Math.floor(pRng()*5)],rot:(pRng()*0.8-0.4),skull:pRng()<0.5}); } }
    }
    spawnRng=makeRng(SEED,"spawn|"+floor);
    speedMul = 1 + Math.min(0.6, floor*0.02) + Math.min(0.9, loop*0.15); // bounded ramp
    waveBatch = Math.min(56, 6 + Math.floor(floor*1.3) + a*2); // dense hordes ramp then cap
    player=player||{}; player.x=W/2; player.y=H/2; player.r=0.32*TILE; player.aim=[0,-1]; player.form="wizard";
    if(floor===START_FLOOR || floor%10===1){ banner="ACT "+ROMAN[a%ROMAN.length]+" · "+th.name; bannerT=2.6; }
    else banner=(isBoss?"BOSS · FLOOR "+floor:"FLOOR "+floor); if(bannerT<1.7) bannerT=1.7;
  }

  // ---------- sprite pipeline: optional PNG art from Sprites/ with drawn fallback ----------
  // Character sheets live in Sprites/ next to index.html. Each is a grid; we slice one
  // cell per creature. Missing/failed sheets fall back to the hand-drawn art automatically.
  const SPRITE_SHEETS = {
    magical:{ src:"Sprites/magical.png", cols:5, rows:3 },
    demons: { src:"Sprites/demons.png",  cols:5, rows:3 },
    undead: { src:"Sprites/undead.png",  cols:5, rows:3 },
    wizard: { srcs:["Sprites/wizard.png","Sprites/wizard 1.png"], cols:1, rows:1 }, // optional custom hero (e.g. from Ludo AI)
    torch:  { srcs:["Sprites/torch.png","Sprites/Torch Yellow.png","Sprites/torch yellow.png"], cell:16 }, // animated wall torch strip
    water:  { srcs:["Sprites/water.png","Sprites/Water.png"], cell:16 }, // animated water strip
    potionRed:  { srcs:["Sprites/potion_red.png","Sprites/Potion 1.png","Sprites/Potion 2.png"], cols:1, rows:1 },
    potionBlue: { srcs:["Sprites/potion_blue.png","Sprites/Potion 3.png","Sprites/Potion 4.png"], cols:1, rows:1 },
    vase:   { srcs:["Sprites/vase.png","Sprites/Vase.png","Sprites/Vase Shine Anim.png","Sprites/vase shine anim.png","Sprites/Vase Shine Animation.png"], cell:16 },
    playerDeath: { srcs:["Sprites/1Zombie-Death1.png","Sprites/Zombie-Death1.png","Sprites/zombie death.png","Sprites/playerdeath.png"], cell:16, strip:true },
    mech:      { srcs:["Sprites/mech.png","Sprites/Mech.png"], cols:1, rows:1 },
    skullmech: { srcs:["Sprites/Skullmech.png","Sprites/skullmech.png","Sprites/SkullMech.png"], cols:1, rows:1 },
    title:    { srcs:["Sprites/title.png","Sprites/Title.png"], cols:1, rows:1 },
    gameover: { srcs:["Sprites/gameover.png","Sprites/Gameover.png","Sprites/Game Over.png"], cols:1, rows:1 },
    zombieRun: { srcs:["Sprites/1Zombie-Run.png","Sprites/Zombie-Run.png","Sprites/1Zombie-Idle.png"], cell:16 },
    orcWalk:   { srcs:["Sprites/Orc_Walk.png","Sprites/Orc_Idle.png","Sprites/Orc.png"], cell:16, strip:true },
    buddies:   { srcs:["Sprites/buddie0 sprite sheet x1.png","Sprites/buddie0 sprite sheet.png","Sprites/buddies.png"], cell:16, strip:true },
    // Dungeon Gathering set sheets. Each entry lists every filename spelling we accept,
    // so "tiles1.png", "tiles 1.png", etc. all work. All auto-grid at 16px.
    tiles1: { srcs:["Sprites/tiles1.png","Sprites/tiles 1.png","Sprites/tiles.png"], cell:16 },
    tiles2: { srcs:["Sprites/tiles2.png","Sprites/tiles 2.png"], cell:16 },
    tiles3: { srcs:["Sprites/tiles3.png","Sprites/tiles 3.png"], cell:16 },
    tiles4: { srcs:["Sprites/tiles4.png","Sprites/tiles 4.png"], cell:16 },
    tiles5: { srcs:["Sprites/tiles5.png","Sprites/tiles 5.png","Sprites/tiles 5png","Sprites/tiles5png"], cell:16 },
  };
  // creature -> sheet + grid cell {col,row}. EDIT these if a slice grabs the wrong one.
  // Open the game with ?spritegrid=1 to see each sheet with numbered (col,row) cells.
  const SPRITE_MAP = {
    player: { sheet:"magical", col:2, row:0 }, // the wizard (from the pack)
    playerCustom: { sheet:"wizard", col:0, row:0 }, // your own wizard.png wins if present
    grunt:  { sheet:"demons",  col:0, row:0 },
    swarmer:{ sheet:"demons",  col:1, row:0 },
    brute:  { sheet:"demons",  col:4, row:0 },
    caster: { sheet:"undead",  col:1, row:1 },
    tank:   { sheet:"undead",  col:2, row:2 },
    boss:   { sheet:"undead",  col:2, row:1 },
    floor:  null, // clean flat stone drawn in code (matches the pack). To use a sheet cell instead: { sheet:"tiles3", col:X, row:Y }
    wall:   { sheet:"tiles1", col:0, row:3 }, // brick wall FACE (wall with floor below it)
    wallTop:{ sheet:"tiles1", col:0, row:0 }, // wall TOP/cap (all other wall tiles)
    potionRed: { sheet:"potionRed", col:0, row:0 },
    potionBlue:{ sheet:"potionBlue", col:0, row:0 },
    vaseProp:  { sheet:"vase", col:0, row:0 },
    mechSkin:      { sheet:"mech", col:0, row:0 },
    skullmechSkin: { sheet:"skullmech", col:0, row:0 },
  };
  const spriteImg = {};
  function loadSprites(){ if(typeof Image==="undefined") return; // headless: skip -> fallback
    for(const name in SPRITE_SHEETS){ const sh=SPRITE_SHEETS[name]; const cands=sh.srcs||[sh.src];
      const rec={ ok:false, w:0, h:0, img:new Image(), _i:0 };
      rec.img.onload=()=>{ rec.ok=true; rec.w=rec.img.naturalWidth; rec.h=rec.img.naturalHeight;
        if(sh.strip && rec.w/rec.h>=1.8){ sh.cell=rec.h; sh.cols=Math.max(1,Math.round(rec.w/rec.h)); sh.rows=1; sh._strip=true; }
        else if(sh.cell){ sh.cols=Math.max(1,Math.floor(rec.w/sh.cell)); sh.rows=Math.max(1,Math.floor(rec.h/sh.cell)); sh._strip=false; } };
      rec.img.onerror=()=>{ rec._i++; if(rec._i<cands.length){ rec.img.src=cands[rec._i]; } else { rec.ok=false; } };
      rec.img.src=cands[0]; spriteImg[name]=rec; }
  }
  loadSprites();
  function sheetCell(m){ const rec=spriteImg[m.sheet]; if(!rec||!rec.ok) return null;
    const sh=SPRITE_SHEETS[m.sheet]; if(!sh.cols||!sh.rows) return null;
    const cw=sh.cell||rec.w/sh.cols, chh=sh.cell||rec.h/sh.rows;
    return { img:rec.img, sx:m.col*cw, sy:m.row*chh, cw, chh };
  }
  function drawSprite(type,x,y,size,faceLeft){
    const m=SPRITE_MAP[type]; if(!m) return false;
    const c=sheetCell(m); if(!c) return false;
    const sc=size/Math.max(c.cw,c.chh); const dw=c.cw*sc, dh=c.chh*sc;
    ctx.save(); ctx.imageSmoothingEnabled=false; ctx.translate(x,y); if(faceLeft) ctx.scale(-1,1);
    try{ ctx.drawImage(c.img, c.sx, c.sy, c.cw, c.chh, -dw/2, -dh/2, dw, dh); }catch(e){ ctx.restore(); return false; }
    ctx.restore(); return true;
  }
  function drawTileSprite(type,px,py,size){
    const m=SPRITE_MAP[type]; if(!m) return false;
    const c=sheetCell(m); if(!c) return false;
    ctx.save(); ctx.imageSmoothingEnabled=false;
    try{ ctx.drawImage(c.img, c.sx, c.sy, c.cw, c.chh, px, py, size, size); }catch(e){ ctx.restore(); return false; }
    ctx.restore(); return true;
  }
  const _qs=(typeof location!=="undefined"&&location.search)||"";
  const SPRITEGRID=/[?&]spritegrid=1/.test(_qs);
  const SHEETVIEW=(function(){ const m=_qs.match(/[?&]sheet=([a-z0-9]+)/i); return m?m[1]:null; })();
  function drawSpriteDebug(){ ctx.save(); ctx.fillStyle="rgba(10,7,19,0.97)"; ctx.fillRect(0,0,W,H); ctx.imageSmoothingEnabled=false;
    const name=SHEETVIEW&&SPRITE_SHEETS[SHEETVIEW]?SHEETVIEW:null;
    if(!name){ // index page
      ctx.fillStyle="#ffd23c"; ctx.font="15px monospace"; ctx.fillText("SHEET VIEWER — add &sheet=NAME to the URL:",10,26); let oy=52;
      for(const n in SPRITE_SHEETS){ const rec=spriteImg[n]; ctx.fillStyle=rec&&rec.ok?"#7ae08a":"#ff5a6e"; ctx.font="14px monospace";
        ctx.fillText((rec&&rec.ok?"● ":"○ ")+n+(rec&&rec.ok?("   "+rec.w+"x"+rec.h+"  ("+SPRITE_SHEETS[n].cols+"x"+SPRITE_SHEETS[n].rows+" cells)"):"   (not found)"),10,oy); oy+=22; }
      ctx.fillStyle="#8fd0ff"; ctx.fillText("example: ?spritegrid=1&sheet=tiles1",10,oy+16);
      ctx.restore(); return;
    }
    const rec=spriteImg[name], sh=SPRITE_SHEETS[name];
    ctx.fillStyle="#ffd23c"; ctx.font="14px monospace"; ctx.fillText(name+" — cells labeled col,row — screenshot this",10,20);
    if(!(rec&&rec.ok&&sh.cols)){ ctx.fillStyle="#ff5a6e"; ctx.fillText("sheet not loaded (check filename in Sprites/)",10,44); ctx.restore(); return; }
    const cw=sh.cell||rec.w/sh.cols, chh=sh.cell||rec.h/sh.rows;
    const sc=Math.min((W-20)/(sh.cols*cw),(H-50)/(sh.rows*chh)); const gw=cw*sc, gh=chh*sc, ox=10, oy=34;
    for(let rr=0;rr<sh.rows;rr++) for(let cc=0;cc<sh.cols;cc++){ const dx=ox+cc*gw, dy=oy+rr*gh;
      ctx.drawImage(rec.img, cc*cw, rr*chh, cw, chh, dx, dy, gw, gh);
      ctx.strokeStyle="rgba(255,255,255,0.35)"; ctx.lineWidth=1; ctx.strokeRect(dx,dy,gw,gh);
      ctx.fillStyle="rgba(10,7,19,0.75)"; ctx.fillRect(dx+1,dy+1,34,13);
      ctx.fillStyle="#ffd23c"; ctx.font="10px monospace"; ctx.fillText(cc+","+rr,dx+3,dy+11); }
    ctx.restore();
  }
  function drawPlayerArms(x,y,r,aim,ghost){ if(!aim) return; const ang=Math.atan2(aim[1],aim[0]);
    ctx.save(); ctx.translate(x,y); ctx.rotate(ang); ctx.lineCap="round";
    ctx.strokeStyle=ghost?"rgba(232,214,255,0.85)":"#d8dbe6"; ctx.lineWidth=4; ctx.beginPath(); ctx.moveTo(0,r*0.15); ctx.lineTo(r*1.1,r*0.15); ctx.stroke();
    ctx.fillStyle=ghost?"rgba(232,214,255,0.85)":"#b9bccb"; ctx.fillRect(r*1.0,-r*0.02,r*0.5,r*0.34);
    ctx.restore();
  }

  function makeEnemy(type,x,y){ const s=ETYPES[type];
    const hpBonus = type==="boss" ? (Math.floor(floor/5)*12 + floorLoop*24) : (Math.min(8,Math.floor(floor/6)) + floorLoop*2);
    const e={ id:(++eid), type, x, y, r:s.r*TILE, hp:s.hp+hpBonus, max:s.hp+hpBonus, spd:s.speed*speedMul, flash:0, wob:Math.random()*6.28 };
    if(type==="boss"){ e.atkCd=2.4; e.tele=0; e.pat=0; e.cr=e.r*0.42; }
    if(type==="caster"){ e.atkCd=1.4+Math.random(); e.tele=0; }
    if(type==="tank"){ e.atkCd=2.0+Math.random(); e.tele=0; }
    return e;
  }
  function spawnEnemy(type){ const p=edgeSpawn(spawnRng); enemies.push(makeEnemy(type,p.x,p.y)); }

  // ---------- helpers ----------
  let zaps=[];
  function starBurst(b){ burst(b.x,b.y,"#ff6ec7",10); shake=Math.max(shake,4);
    for(let k=0;k<10;k++){ const a2=k/10*6.2832+Math.random()*0.2; const sp2=9.5*TILE*0.8;
      bullets.push({x:b.x,y:b.y,vx:Math.cos(a2)*sp2,vy:Math.sin(a2)*sp2,r:4,life:0.55,bounce:0,dmg:1,starlet:true}); } }
  function chainZap(from,n){ let cur=from; const hitset=new Set([from]);
    for(let k=0;k<n;k++){ let bestE=null,bd=(TILE*2.6)*(TILE*2.6);
      for(const o of enemies){ if(hitset.has(o)||o.hp<=0) continue; const dx=o.x-cur.x,dy=o.y-cur.y,d=dx*dx+dy*dy; if(d<bd){bd=d;bestE=o;} }
      if(!bestE) break;
      zaps.push({x1:cur.x,y1:cur.y,x2:bestE.x,y2:bestE.y,t:0.16});
      bestE.hp-=1; bestE.flash=0.08; burst(bestE.x,bestE.y,"#7ce8ff",3);
      const idx=enemies.indexOf(bestE); if(bestE.hp<=0&&idx>=0) killEnemy(bestE,idx);
      hitset.add(bestE); cur=bestE; }
  }
  function nearest(){ let best=null,bd=1e18; for(const e of enemies){ const dx=e.x-player.x,dy=e.y-player.y,d=dx*dx+dy*dy; if(d<bd){bd=d;best=e;} } return best; }
  function nearestTo(x,y){ let best=null,bd=1e18; for(const e of enemies){ const dx=e.x-x,dy=e.y-y,d=dx*dx+dy*dy; if(d<bd){bd=d;best=e;} } return best; }
  function explodeAt(x,y,radius,dmg,col){
    for(let j=enemies.length-1;j>=0;j--){ const e=enemies[j]; const dx=e.x-x,dy=e.y-y;
      if(dx*dx+dy*dy < (radius+e.r)*(radius+e.r)){ e.hp-=dmg; e.flash=0.08; if(e.hp<=0) killEnemy(e,j); } }
    burst(x,y,col||C.laserCore,18); shake=Math.max(shake,7);
    blasts.push({ x,y,max:radius,t:0,life:0.34,col:col||C.laserCore });
  }
  function nukeScreen(){
    flash=1; shake=Math.max(shake,16); blasts.push({ x:W/2,y:H/2,max:W*0.85,t:0,life:0.6,col:C.gold }); spawnMushroom(W/2,H*0.66,4.6);
    for(let j=enemies.length-1;j>=0;j--){ const e=enemies[j]; burst(e.x,e.y,ETYPES[e.type].col,10); killEnemy(e,j); }
    addPop(player.x,player.y-40,"NUKE!",C.gold,true);
  }
  function pickDoorSpot(){ const rng=makeRng(SEED,"door|"+floor); for(let i=0;i<60;i++){ const col=2+Math.floor(rng()*(SIZE-4)), row=2+Math.floor(rng()*(SIZE-4)); if(solid(col,row)||waterSet.has(col+","+row)) continue; return { x:col*TILE+TILE/2, y:row*TILE+TILE/2, t:0 }; } return { x:W/2, y:H/2, t:0 }; }
  function landSpot(x,y){ const c=Math.floor(x/TILE), r=Math.floor(y/TILE); if(!waterSet.has(c+","+r)) return {x,y};
    for(let rad=1;rad<=3;rad++) for(let dr=-rad;dr<=rad;dr++) for(let dc=-rad;dc<=rad;dc++){ const nc=c+dc, nr=r+dr;
      if(solid(nc,nr)||waterSet.has(nc+","+nr)) continue; return {x:nc*TILE+TILE/2,y:nr*TILE+TILE/2}; }
    return {x,y}; }
  function addPop(x,y,txt,color,big){ popups.push({ x,y,txt,color,t:0,life:big?1.0:0.8,big:!!big,rot:(Math.random()-0.5)*0.4,vy:34+Math.random()*16 }); }
  function activateGhost(){
    if(phase!=="play"||!player) return;
    if(ghostCharges<=0 || ghostT>0) return;
    ghostCharges--; ghostT=3.5; player.form="ghost"; iframe=Math.max(iframe,0.15);
    addPop(player.x,player.y-34,"PHASE!",C.wisp,true); burst(player.x,player.y,C.wispLt,16); shake=Math.max(shake,4);
  }
  function triggerNuke(){ if(phase!=="play"||!player) return; if(nukesHeld<=0){ addPop(player.x,player.y-34,"NO NUKES",C.paper,false); return; } nukesHeld--; nukeScreen(); }
  function spawnEbullet(x,y,vx,vy,col){ const b={ x,y,vx,vy,r:6,life:3.2,col:col||"#ff5a6e" }; ebullets.push(b); return b; }
  function bossFire(e){ const pat=e.pat%3; e.pat++; const sp=3.2*TILE;
    if(pat===0){ const dx=player.x-e.x,dy=player.y-e.y,a=Math.atan2(dy,dx); for(const o of [-0.22,0,0.22]) spawnEbullet(e.x,e.y,Math.cos(a+o)*sp,Math.sin(a+o)*sp,"#ff5a6e"); }
    else if(pat===1){ const n=12; for(let i=0;i<n;i++){ const a=i/n*6.2832; spawnEbullet(e.x,e.y,Math.cos(a)*sp,Math.sin(a)*sp,"#ffa14d"); } }
    else { const n=10, off=e.pat*0.5; for(let i=0;i<n;i++){ const a=i/n*6.2832+off; spawnEbullet(e.x,e.y,Math.cos(a)*sp*0.9,Math.sin(a)*sp*0.9,"#ff5a6e"); } }
    shake=Math.max(shake,4);
  }
  function casterFire(e){ const dx=player.x-e.x,dy=player.y-e.y,L=Math.hypot(dx,dy)||1,sp=3.0*TILE; spawnEbullet(e.x,e.y,dx/L*sp,dy/L*sp,"#7fbcff"); }
  function tankFire(e){ const dx=player.x-e.x,dy=player.y-e.y,a=Math.atan2(dy,dx),sp=2.6*TILE; for(const o of [-0.12,0.12]){ const b=spawnEbullet(e.x,e.y,Math.cos(a+o)*sp,Math.sin(a+o)*sp,"#cfe07a"); if(b) b.r=8; } shake=Math.max(shake,4); }
  function spawnMushroom(x,y,scale){ mushrooms.push({ x,y,t:0,life:1.6,scale:scale||1 }); }
  function bulletBoom(b){ if(b.nukeshot){ explodeAt(b.x,b.y,TILE*2.0,4,C.gold); spawnMushroom(b.x,b.y,2.6); flash=Math.max(flash,0.5); } else { explodeAt(b.x,b.y,TILE*1.35,3,C.laserCore); } }
  function openDoor(d){ if(d.open) return; d.open=true; d.collapse=0.4; doorSet.delete(d.col+","+d.row);
    burst(d.x,d.y,"#c7cef0",12); shake=Math.max(shake,5); }
  function killEnemy(e,i){
    const s=ETYPES[e.type]; const pts=s.score;
    score+=pts; killStreak++; streakT=1.4;
    const word = e.type==="boss" ? "KAPOW!" : (killStreak>=6 ? WORDS_CRIT[killStreak%WORDS_CRIT.length] : s.words[(Math.random()*s.words.length)|0]);
    addPop(e.x,e.y-e.r,word,s.col,e.type==="boss"||killStreak>=6);
    addPop(e.x,e.y-e.r+18,"+"+pts,C.gold,false);
    burst(e.x,e.y,s.col,e.type==="boss"?22:8);
    if(e.type==="boss"){ shake=Math.max(shake,14); if(hearts<maxHearts){ hearts++; addPop(player.x,player.y-30,"+1 LIFE",C.hp,true);} pickups.push({x:e.x,y:e.y,type:"rocket",t:0}); if(Math.random()<0.5) pickups.push({x:e.x+18,y:e.y,type:"nuke",t:0}); if(Math.random()<0.3) pickups.push({x:e.x-18,y:e.y,type:"nukegun",t:0}); }
    else { shake=Math.max(shake,3); const r=Math.random(); const ls=landSpot(e.x,e.y);
      if(r<0.012) pickups.push({x:ls.x,y:ls.y,type:"nuke",t:0});
      else if(r<0.03) pickups.push({x:ls.x,y:ls.y,type:"nukegun",t:0});
      else if(r<0.055) pickups.push({x:ls.x,y:ls.y,type:"redpotion",t:0});
      else if(r<0.13) pickups.push({x:ls.x,y:ls.y,type:"bluepotion",t:0}); }
    enemies.splice(i,1);
  }
  const sparks=[];
  function burst(x,y,col,n){ for(let i=0;i<n;i++){ const a=Math.random()*6.28, sp=40+Math.random()*120; sparks.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,t:0,life:0.4+Math.random()*0.3,col}); } }

  // ---------- update ----------
  function update(dt){
    if(bannerT>0) bannerT-=dt;
    if(streakT>0){ streakT-=dt; if(streakT<=0) killStreak=0; }
    if(shake>0) shake=Math.max(0,shake-dt*40);
    if(flash>0) flash=Math.max(0,flash-dt*3);
    if(iframe>0) iframe-=dt;
    if(zaps.length) zaps=zaps.filter(z=>(z.t-=dt)>0);
    if(dying){ deathT+=dt; iframe=99; if(deathT>1.2){ best=Math.max(best,score); phase="over"; dying=false; notifyGameOver(); return; } }
    if(weaponT>0){ weaponT-=dt; if(weaponT<=0){ weapon="laser"; addPop(player.x,player.y-30,"laser",C.laser,false); } }
    if(ghostT>0){ ghostT-=dt; if(ghostT<=0 && player) player.form="wizard"; }
    // pickups
    for(let i=pickups.length-1;i>=0;i--){ const p=pickups[i]; p.t+=dt;
      const dx=player.x-p.x, dy=player.y-p.y, rr=player.r+14;
      if(dx*dx+dy*dy < rr*rr){
        if(p.type==="nuke"){ nukesHeld=Math.min(maxNukes,nukesHeld+1); addPop(player.x,player.y-36,"NUKE +1",C.gold,true); burst(p.x,p.y,C.gold,12); }
        else if(p.type==="redpotion"){ if(hearts<maxHearts){ hearts++; addPop(player.x,player.y-36,"+1 LIFE",C.hp,true); } else { score+=150; addPop(player.x,player.y-36,"+150",C.gold,false); } burst(p.x,p.y,"#e8404e",12); }
        else if(p.type==="bluepotion"){ const K=["bspread","rocket","beam","mine","flame","star","minigun"]; weapon=K[(Math.random()*K.length)|0]; weaponT=11; addPop(player.x,player.y-36,"GULP! "+WLABEL[weapon]+"!",PCOL[weapon],true); burst(p.x,p.y,"#35a7e0",12); }
        else { weapon=p.type; weaponT=(p.type==="mine"?13:11); addPop(player.x,player.y-36,WLABEL[p.type]+"!",PCOL[p.type],true); burst(p.x,p.y,PCOL[p.type],12); }
        pickups.splice(i,1);
      }
    }

    // player move
    let mx=0,my=0;
    if(held.has("left"))mx-=1; if(held.has("right"))mx+=1; if(held.has("up"))my-=1; if(held.has("down"))my+=1;
    if(!dying&&(mx||my)){ const L=Math.hypot(mx,my); mx/=L; my/=L; const sp=3.05*TILE*dt; moveEnt(player,mx*sp,my*sp);
      player.walkT=(player.walkT||0)+dt;
      player.dustCd=(player.dustCd||0)-dt;
      if(player.dustCd<=0){ sparks.push({x:player.x-mx*8+(Math.random()*6-3),y:player.y+player.r*0.9,vx:-mx*26+(Math.random()*14-7),vy:-8-Math.random()*10,t:0,life:0.32,col:"rgba(120,122,138,0.8)"}); player.dustCd=0.13; }
    } else player.walkT=0;

    // fire (auto-aim; hold SPACE = rapid)
    fireCd-=dt;
    const tgt=nearest();
    if(tgt){ const dx=tgt.x-player.x,dy=tgt.y-player.y,L=Math.hypot(dx,dy)||1; player.aim=[dx/L,dy/L];
      if(fireCd<=0&&!dying){ const sp=9.5*TILE; const baseA=Math.atan2(dy,dx); const ox=player.x+player.aim[0]*player.r, oy=player.y+player.aim[1]*player.r;
        if(weapon==="bspread"){
          for(const off of [-0.34,0,0.34]){ const a=baseA+off; bullets.push({x:ox,y:oy,vx:Math.cos(a)*sp*0.92,vy:Math.sin(a)*sp*0.92,r:5,life:1.5,bounce:3,dmg:1}); }
          fireCd = held.has("fire")?0.13:0.27;
        } else if(weapon==="rocket"){
          bullets.push({x:ox,y:oy,vx:player.aim[0]*sp*0.6,vy:player.aim[1]*sp*0.6,r:6,life:2.6,bounce:0,rocket:true,homing:true,dmg:3});
          fireCd = held.has("fire")?0.2:0.45;
        } else if(weapon==="flame"){
          for(const off of [-0.13,0,0.13]){ const a2=baseA+off+(Math.random()*0.06-0.03); bullets.push({x:ox,y:oy,vx:Math.cos(a2)*sp*1.05,vy:Math.sin(a2)*sp*1.05,r:5,life:1.0,bounce:0,dmg:1,flame:true}); }
          fireCd = held.has("fire")?0.09:0.2;
        } else if(weapon==="star"){
          bullets.push({x:ox,y:oy,vx:player.aim[0]*sp*0.72,vy:player.aim[1]*sp*0.72,r:7,life:0.42,bounce:0,dmg:1,star:true});
          fireCd = held.has("fire")?0.3:0.55;
        } else if(weapon==="minigun"){
          const a2=baseA+(Math.random()*0.24-0.12); bullets.push({x:ox,y:oy,vx:Math.cos(a2)*sp*1.1,vy:Math.sin(a2)*sp*1.1,r:3.6,life:0.9,bounce:0,dmg:1,mini:true});
          fireCd = held.has("fire")?0.045:0.14;
        } else if(weapon==="beam"){
          bullets.push({x:ox,y:oy,vx:player.aim[0]*sp*1.55,vy:player.aim[1]*sp*1.55,r:7,life:0.55,bounce:0,pierce:6,dmg:2,beam:true});
          fireCd = held.has("fire")?0.17:0.34;
        } else if(weapon==="mine"){
          const L2=Math.hypot(dx,dy)||1, fl=Math.min(0.72, Math.max(0.3, L2/(sp*0.55)));
          bullets.push({x:ox,y:oy,vx:player.aim[0]*sp*0.55,vy:player.aim[1]*sp*0.55,r:6,life:fl,bounce:0,grenade:true,gmax:fl,dmg:0});
          fireCd = held.has("fire")?0.5:0.75;
        } else if(weapon==="nukegun"){
          bullets.push({x:ox,y:oy,vx:player.aim[0]*sp*0.55,vy:player.aim[1]*sp*0.55,r:8,life:2.4,bounce:0,nukeshot:true,dmg:4});
          fireCd = held.has("fire")?0.6:0.85;
        } else {
          bullets.push({x:ox,y:oy,vx:dx/L*sp,vy:dy/L*sp,r:5,life:1.1,bounce:0,dmg:1});
          fireCd = held.has("fire")?0.085:0.2;
        }
      }
    }
    // mines auto-drop
    

    // bullets
    for(let i=bullets.length-1;i>=0;i--){ const b=bullets[i];
      if(b.homing){ const tg=nearestTo(b.x,b.y); if(tg){ const dx=tg.x-b.x,dy=tg.y-b.y,L=Math.hypot(dx,dy)||1, sp=Math.hypot(b.vx,b.vy);
        let nvx=b.vx+(dx/L)*sp*3*dt, nvy=b.vy+(dy/L)*sp*3*dt, nl=Math.hypot(nvx,nvy)||1; b.vx=nvx/nl*sp; b.vy=nvy/nl*sp; } }
      b.x+=b.vx*dt; b.y+=b.vy*dt; b.life-=dt;
      if(b.life<=0 || b.x<0||b.y<0||b.x>W||b.y>H){ if(b.star&&b.life<=0&&b.x>0&&b.y>0&&b.x<W&&b.y<H){ starBurst(b); } else if(b.grenade){ explodeAt(b.x,b.y,TILE*1.55,3,"#f0872e"); shake=Math.max(shake,6); } else if(b.rocket||b.nukeshot) bulletBoom(b); bullets.splice(i,1); continue; }
      { const bc=Math.floor(b.x/TILE), br=Math.floor(b.y/TILE);
        if(doorSet.has(bc+","+br)){ const d=doors.find(dd=>dd.col===bc&&dd.row===br&&!dd.open); if(d) openDoor(d); if(b.rocket||b.nukeshot) bulletBoom(b); bullets.splice(i,1); continue; }
        if(genSet.has(bc+","+br)){ const g=spawners.find(gg=>gg.col===bc&&gg.row===br&&gg.alive); if(g){ g.alive=false; genSet.delete(bc+","+br); explodeAt(g.x,g.y,TILE*1.1,2,"#ff9a3c"); spawnMushroom(g.x,g.y,1.1); score+=300; addPop(g.x,g.y-22,"GENERATOR DOWN!",C.gold,true); } if(b.rocket||b.nukeshot) bulletBoom(b); bullets.splice(i,1); continue; } }
      { let hitVase=false;
        for(const v of vases){ if(!v.alive) continue; const dvx=b.x-v.x, dvy=b.y-v.y;
          if(dvx*dvx+dvy*dvy < 15*15){ v.alive=false; burst(v.x,v.y,"#b9c2d8",9); shake=Math.max(shake,2); score+=50; addPop(v.x,v.y-16,"+50",C.gold,false);
            const rp=Math.random(); if(rp<0.22) pickups.push({x:v.x,y:v.y,type:"redpotion",t:0}); else if(rp<0.36) pickups.push({x:v.x,y:v.y,type:"bluepotion",t:0});
            if(!b.pierce && !b.beam){ if(b.rocket||b.nukeshot) bulletBoom(b); bullets.splice(i,1); hitVase=true; } break; } }
        if(hitVase) continue; }
      if(blocked(b.x,b.y,b.r-2)){
        if(b.grenade){ explodeAt(b.x,b.y,TILE*1.55,3,"#f0872e"); shake=Math.max(shake,6); bullets.splice(i,1); continue; }
        if(b.star){ starBurst(b); bullets.splice(i,1); continue; }
        if(b.rocket||b.nukeshot){ bulletBoom(b); bullets.splice(i,1); continue; }
        if(b.bounce>0){ b.bounce--; b.x-=b.vx*dt; b.y-=b.vy*dt;
          const hitX=blocked(b.x+b.vx*dt,b.y,b.r-2), hitY=blocked(b.x,b.y+b.vy*dt,b.r-2);
          if(hitX) b.vx=-b.vx; if(hitY) b.vy=-b.vy; if(!hitX&&!hitY){ b.vx=-b.vx; b.vy=-b.vy; }
          b.x+=b.vx*dt; b.y+=b.vy*dt; burst(b.x,b.y,C.portal2,2);
        } else { bullets.splice(i,1); continue; }
      }
      let removed=false;
      for(let j=enemies.length-1;j>=0;j--){ const e=enemies[j]; const dx=e.x-b.x,dy=e.y-b.y;
        if(dx*dx+dy*dy < (e.r+b.r)*(e.r+b.r)){
          if(b.grenade){ explodeAt(b.x,b.y,TILE*1.55,3,"#f0872e"); shake=Math.max(shake,6); bullets.splice(i,1); removed=true; break; }
          if(b.star){ e.hp-=1; e.flash=0.08; if(e.hp<=0) killEnemy(e,j); starBurst(b); bullets.splice(i,1); removed=true; break; }
          if(b.rocket||b.nukeshot){ bulletBoom(b); bullets.splice(i,1); removed=true; break; }
          if(b.pierce>0){ if(!b.hit) b.hit={}; if(b.hit[e.id]) continue; b.hit[e.id]=1;
            e.hp-=(b.dmg||1); e.flash=0.08; burst(b.x,b.y,C.portal2,2); if(e.hp<=0) killEnemy(e,j);
            b.pierce--; if(b.pierce<=0){ bullets.splice(i,1); removed=true; break; } continue; }
          e.hp-=(b.dmg||1); e.flash=0.08; burst(b.x,b.y,C.laser,3); if(e.hp<=0) killEnemy(e,j);
          bullets.splice(i,1); removed=true; break;
        }
      }
      if(removed) continue;
    }

    // spawn batches
    const batch=waveBatch;
    spawnTimer-=dt;
    while(toSpawn.length && enemies.length<batch && spawnTimer<=0){ spawnEnemy(toSpawn.shift()); spawnTimer=0.09; }

    // enemies: move by type, attack, contact
    for(let i=enemies.length-1;i>=0;i--){ const e=enemies[i]; if(e.flash>0)e.flash-=dt; e.wob+=dt*8;
      const dx=player.x-e.x, dy=player.y-e.y, L=Math.hypot(dx,dy)||1; const sp=e.spd*TILE*dt;
      if(e.type==="boss"){
        const bx=e.x, by=e.y, hustle=(L>TILE*3.5)?1.3:1;
        moveEnt(e, dx/L*sp*hustle, dy/L*sp*hustle);
        if(Math.hypot(e.x-bx,e.y-by) < sp*0.3){ moveEnt(e, Math.sign(dx)*sp, 0);
          if(Math.hypot(e.x-bx,e.y-by) < sp*0.3) moveEnt(e, 0, Math.sign(dy)*sp); }
        if(e.tele>0){ e.tele-=dt; if(e.tele<=0){ bossFire(e); e.atkCd=2.0+Math.random()*0.6; } }
        else { e.atkCd-=dt; if(e.atkCd<=0) e.tele=0.55; }
      } else if(e.type==="caster"){
        const want=TILE*3.2;
        if(L<want*0.8) moveEnt(e, -dx/L*sp, -dy/L*sp);
        else if(L>want*1.4) moveEnt(e, dx/L*sp*0.6, dy/L*sp*0.6);
        if(e.tele>0){ e.tele-=dt; if(e.tele<=0){ casterFire(e); e.atkCd=1.5+Math.random()*0.9; } }
        else { e.atkCd-=dt; if(e.atkCd<=0) e.tele=0.5; }
      } else if(e.type==="tank"){
        const want=TILE*4;
        if(L>want*1.2) moveEnt(e, dx/L*sp*0.7, dy/L*sp*0.7);
        if(e.tele>0){ e.tele-=dt; if(e.tele<=0){ tankFire(e); e.atkCd=2.2+Math.random()*0.8; } }
        else { e.atkCd-=dt; if(e.atkCd<=0) e.tele=0.7; }
      } else {
        // swarm chase: weave toward the player, hustle when far, slide around corners instead of sticking
        const ox=e.x, oy=e.y;
        const weave=Math.sin(e.wob*2.2)*0.38, wx=-dy/L, wy=dx/L;
        const hustle=(L>TILE*3.5)?1.25:1;
        moveEnt(e, (dx/L+wx*weave)*sp*hustle, (dy/L+wy*weave)*sp*hustle);
        if(Math.hypot(e.x-ox,e.y-oy) < sp*0.3){
          moveEnt(e, Math.sign(dx)*sp, 0);
          if(Math.hypot(e.x-ox,e.y-oy) < sp*0.3) moveEnt(e, 0, Math.sign(dy)*sp);
        }
      }
      const rr=e.r+player.r;
      if(dx*dx+dy*dy < rr*rr && iframe<=0 && player.form!=="ghost"){
        hearts--; iframe=1.1; flash=1; shake=Math.max(shake,9);
        const kx=-dx/L, ky=-dy/L; moveEnt(player,kx*22,ky*22);
        addPop(player.x,player.y-34,"OUCH!",C.hp,true);
        if(hearts<=0){ startDeath(); return; }
      }
    }

    // enemy bullets
    for(let i=ebullets.length-1;i>=0;i--){ const b=ebullets[i]; b.x+=b.vx*dt; b.y+=b.vy*dt; b.life-=dt;
      if(b.life<=0 || b.x<0||b.y<0||b.x>W||b.y>H || blocked(b.x,b.y,b.r-2)){ ebullets.splice(i,1); continue; }
      const dx=player.x-b.x, dy=player.y-b.y, rr=player.r+b.r;
      if(dx*dx+dy*dy < rr*rr && iframe<=0 && player.form!=="ghost"){
        ebullets.splice(i,1); hearts--; iframe=1.1; flash=1; shake=Math.max(shake,9);
        addPop(player.x,player.y-34,"OW!",C.hp,true);
        if(hearts<=0){ startDeath(); return; }
      }
    }

    // doors: walk into one to collapse it (bullets open them too, handled above)
    for(const d of doors){ if(d.open){ if(d.collapse>0) d.collapse-=dt; continue; }
      if(Math.abs(player.x-d.x) < TILE*0.5+player.r+2 && Math.abs(player.y-d.y) < TILE*0.5+player.r+2) openDoor(d);
    }

    // sparks
    for(let i=sparks.length-1;i>=0;i--){ const s=sparks[i]; s.t+=dt; s.x+=s.vx*dt; s.y+=s.vy*dt; s.vx*=0.92; s.vy*=0.92; if(s.t>=s.life) sparks.splice(i,1); }
    // mines
    for(let i=mines.length-1;i>=0;i--){ const m=mines[i]; m.t+=dt; let boom=(m.t>9);
      if(m.t>0.3 && !boom){ for(const e of enemies){ const dx=e.x-m.x,dy=e.y-m.y; const rr=TILE*0.6+e.r; if(dx*dx+dy*dy<rr*rr){ boom=true; break; } } }
      if(boom){ explodeAt(m.x,m.y,TILE*1.15,3,C.hp); mines.splice(i,1); }
    }
    // blast rings
    for(let i=blasts.length-1;i>=0;i--){ const bl=blasts[i]; bl.t+=dt; if(bl.t>=bl.life) blasts.splice(i,1); }
    // mushroom clouds
    for(let i=mushrooms.length-1;i>=0;i--){ const m=mushrooms[i]; m.t+=dt; if(m.t>=m.life) mushrooms.splice(i,1); }
    // monster generators keep spewing until destroyed
    for(const g of spawners){ if(!g.alive) continue; g.cd-=dt;
      if(g.cd<=0 && enemies.length < waveBatch+6){ const rr=Math.random(); const ty= rr<0.1?"caster": rr<0.28?"brute": rr<0.64?"swarmer":"grunt";
        const an=Math.random()*6.28, d=TILE*0.7; enemies.push(makeEnemy(ty, g.x+Math.cos(an)*d, g.y+Math.sin(an)*d)); g.cd=1.3+Math.random()*1.4; burst(g.x,g.y,"#ff9a3c",5); }
    }
    // dropship set-piece
    if(dropship){ const d=dropship;
      if(d.wait>0){ d.wait-=dt; if(d.wait<=0 && !d.announced){ d.announced=true; addPop(W/2,H*0.28,"DROPSHIP!",C.gold,true); shake=Math.max(shake,5); } }
      else { d.x+=d.vx*dt; d.dropCd-=dt;
        if(d.dropCd<=0 && d.squad.length && d.x>TILE && d.x<W-TILE){ const ty=d.squad.shift(); enemies.push(makeEnemy(ty,d.x,d.y+TILE*0.5)); burst(d.x,d.y+TILE*0.4,"#ffd23c",6); d.dropCd=0.5; }
        if((d.dir>0 && d.x>W+TILE) || (d.dir<0 && d.x<-TILE)) dropship=null;
      }
    }
    // popups
    for(let i=popups.length-1;i>=0;i--){ const p=popups[i]; p.t+=dt; p.y-=p.vy*dt; p.vy*=0.96; if(p.t>=p.life) popups.splice(i,1); }

    // wave clear -> exit door -> next floor (generators must be destroyed, dropship gone)
    const gensDead = spawners.every(g=>!g.alive);
    if(!portal && toSpawn.length===0 && enemies.length===0 && gensDead && !dropship){ portal=pickDoorSpot(); banner="RIFT OPEN — DIVE!"; bannerT=2.4; }
    if(portal){ portal.t+=dt; const dx=player.x-portal.x, dy=player.y-portal.y;
      if(dx*dx+dy*dy < (TILE*0.55)*(TILE*0.55)){ floor++; startFloor(); }
    }
  }

  // ---------- render ----------
  function R(){ return (Math.random()-0.5); }
  function comic(txt,x,y,size,fill,align){ ctx.font=size+"px Bangers, system-ui"; ctx.textAlign=align||"center"; ctx.textBaseline="middle";
    ctx.lineJoin="round"; ctx.lineWidth=Math.max(3,size*0.13); ctx.strokeStyle=C.ink; ctx.strokeText(txt,x,y); ctx.fillStyle=fill; ctx.fillText(txt,x,y); }

  function drawFloorAndWalls(){
    const mF=SPRITE_MAP.floor&&sheetCell(SPRITE_MAP.floor), mW=SPRITE_MAP.wall&&sheetCell(SPRITE_MAP.wall);
    if(mF||mW){
      for(let y=0;y<SIZE;y++) for(let x=0;x<SIZE;x++){
        const px=x*TILE, py=y*TILE;
        if(solid(x,y)){
          const faceHere = (y+1<SIZE) && !solid(x,y+1); // wall meeting open floor below shows its brick FACE
          const kind = faceHere ? "wall" : (SPRITE_MAP.wallTop?"wallTop":"wall");
          if(!drawTileSprite(kind,px,py,TILE) && !drawTileSprite("wall",px,py,TILE)){ ctx.fillStyle=curW1; ctx.fillRect(px,py,TILE,TILE); ctx.fillStyle=curW2; ctx.fillRect(px,py+TILE*0.5,TILE,TILE*0.5); ctx.strokeStyle=C.ink; ctx.lineWidth=3; ctx.strokeRect(px+1.5,py+1.5,TILE-3,TILE-3); }
        } else {
          if(!SPRITE_MAP.floor || !drawTileSprite("floor",px,py,TILE)){
            // clean flat stone floor in the pack's style — no busy cells
            ctx.fillStyle="#a7acb8"; ctx.fillRect(px,py,TILE,TILE);
            if((x+y)&1){ ctx.fillStyle="rgba(0,0,0,0.045)"; ctx.fillRect(px,py,TILE,TILE); }
            ctx.fillStyle="rgba(30,32,44,0.13)";
            const h1=((x*7+y*13)%9), h2=((x*11+y*5)%7);
            ctx.fillRect(px+6+h1*3, py+8+h2*3, 3, 2); ctx.fillRect(px+TILE-12-h2*2, py+TILE-14-h1*2, 2, 2);
            if(((x*3+y*17)%5)===0){ ctx.fillRect(px+14+h2, py+26+h1, 4, 2); }
          } else if((x+y)&1){ ctx.fillStyle="rgba(0,0,0,0.05)"; ctx.fillRect(px,py,TILE,TILE); }
        }
      }
      // gentle act-palette wash so acts keep their mood without muddying the tiles
      ctx.fillStyle=curF1; ctx.globalAlpha=0.10; ctx.fillRect(0,0,W,H); ctx.globalAlpha=1;
      return;
    }
    for(let y=0;y<SIZE;y++) for(let x=0;x<SIZE;x++){
      const px=x*TILE, py=y*TILE;
      if(solid(x,y)){
        ctx.fillStyle=curW1; ctx.fillRect(px,py,TILE,TILE);
        ctx.fillStyle=curW2; ctx.fillRect(px,py+TILE*0.5,TILE,TILE*0.5);
        ctx.fillStyle=curW3; ctx.fillRect(px,py+TILE*0.78,TILE,TILE*0.22);
        ctx.strokeStyle=C.ink; ctx.lineWidth=3; ctx.strokeRect(px+1.5,py+1.5,TILE-3,TILE-3);
      } else {
        ctx.fillStyle=((x+y)&1)?curF1:curF2; ctx.fillRect(px,py,TILE,TILE);
        ctx.fillStyle="rgba(0,0,0,0.10)"; ctx.fillRect(px+TILE*0.32,py+TILE*0.32,2,2); ctx.fillRect(px+TILE*0.66,py+TILE*0.62,2,2);
      }
    }
  }
  function drawPortal(){ if(!portal)return; const t=portal.t, x=portal.x, y=portal.y;
    const dw=70, dh=84, left=x-dw/2, top=y-dh/2, pulse=0.5+0.5*Math.sin(t*4);
    // quantum glow
    ctx.fillStyle="rgba(53,167,224,"+(0.10+0.10*pulse)+")"; ctx.beginPath(); ctx.arc(x,y,dw*0.95,0,6.2832); ctx.fill();
    ctx.fillStyle="rgba(53,167,224,"+(0.14+0.12*pulse)+")"; ctx.beginPath(); ctx.arc(x,y,dw*0.66,0,6.2832); ctx.fill();
    // stone frame
    ctx.fillStyle=C.wall2; ctx.fillRect(left,top,dw,dh);
    ctx.fillStyle=C.wall1; ctx.fillRect(left,top,dw,9);
    ctx.fillStyle=C.wall3; ctx.fillRect(left,top+dh-12,dw,12);
    ctx.lineWidth=3; ctx.strokeStyle=C.ink; ctx.strokeRect(left+1.5,top+1.5,dw-3,dh-3);
    // brick seams
    ctx.strokeStyle="rgba(36,26,46,0.42)"; ctx.lineWidth=1.5;
    for(let i=1;i<4;i++){ const yy=top+i*(dh/4); ctx.beginPath(); ctx.moveTo(left,yy); ctx.lineTo(left+dw,yy); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(x,top+9); ctx.lineTo(x,top+dh*0.5); ctx.stroke();
    // arched doorway opening
    const ow=38, ax=x-ow/2, abase=top+dh-8, acy=top+22+ow/2;
    const arch=()=>{ ctx.beginPath(); ctx.moveTo(ax,abase); ctx.lineTo(ax,acy); ctx.arc(x,acy,ow/2,Math.PI,0,false); ctx.lineTo(ax+ow,abase); ctx.closePath(); };
    arch(); ctx.fillStyle="#0a0e18"; ctx.fill();
    // shimmer rising inside the doorway
    ctx.save(); arch(); ctx.clip();
    ctx.fillStyle="rgba(31,90,140,"+(0.55+0.35*pulse)+")"; ctx.fillRect(ax,abase-20,ow,20);
    ctx.fillStyle=C.portal2; for(let i=0;i<4;i++){ const sy=abase-((t*36+i*16)%(dh-20)); ctx.fillRect(x-12+i*8,sy,3,3); }
    ctx.restore();
    arch(); ctx.lineWidth=3; ctx.strokeStyle=C.ink; ctx.stroke();
    // gold keystone gem
    ctx.fillStyle=C.gold; ctx.strokeStyle=C.ink; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(x,top-3); ctx.lineTo(x+7,top+7); ctx.lineTo(x,top+15); ctx.lineTo(x-7,top+7); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  function drawArms(x,y,r,skin){
    for(const s of [-1,1]){
      const sx=x+s*r*0.55, sy=y+r*0.18, ex=x+s*r*1.28, ey=y+r*0.06;
      ctx.lineCap="round"; ctx.strokeStyle=C.ink; ctx.lineWidth=9; ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(ex,ey); ctx.stroke();
      ctx.strokeStyle=skin; ctx.lineWidth=5; ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(ex,ey); ctx.stroke();
      ctx.fillStyle=skin; ctx.strokeStyle=C.ink; ctx.lineWidth=2; ctx.beginPath(); ctx.arc((sx+ex)/2,(sy+ey)/2-1,5,0,6.2832); ctx.fill(); ctx.stroke(); // bicep
      ctx.fillStyle="#c9cfdb"; ctx.strokeStyle=C.ink; ctx.lineWidth=2; // silver gun
      const gx=ex+s*2-(s<0?9:0); ctx.fillRect(gx,ey-3.5,9,7); ctx.strokeRect(gx,ey-3.5,9,7);
      ctx.fillStyle="#f2f5fa"; ctx.fillRect(gx+1,ey-2.5,7,2); // shine
    }
    ctx.lineCap="butt";
  }
  function drawWizard(x,y,r,aim){
    drawArms(x,y,r,"#f0d6b0");
    ctx.lineJoin="round";
    // robe
    ctx.fillStyle="#5a3fb0"; ctx.strokeStyle=C.ink; ctx.lineWidth=3;
    ctx.beginPath(); ctx.moveTo(x-r*0.78,y+r*0.95); ctx.lineTo(x+r*0.78,y+r*0.95); ctx.lineTo(x+r*0.4,y-r*0.05); ctx.lineTo(x-r*0.4,y-r*0.05); ctx.closePath(); ctx.fill(); ctx.stroke();
    // face
    ctx.fillStyle="#f0d6b0"; ctx.beginPath(); ctx.arc(x,y-r*0.2,r*0.46,0,6.2832); ctx.fill(); ctx.lineWidth=3; ctx.strokeStyle=C.ink; ctx.stroke();
    // white pointy beard
    ctx.fillStyle="#f6f3ea"; ctx.strokeStyle=C.ink; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.moveTo(x-r*0.36,y-r*0.16);
    ctx.quadraticCurveTo(x-r*0.30,y+r*0.34, x,y+r*0.62);
    ctx.quadraticCurveTo(x+r*0.30,y+r*0.34, x+r*0.36,y-r*0.16);
    ctx.quadraticCurveTo(x,y+r*0.10, x-r*0.36,y-r*0.16);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // hat
    ctx.fillStyle="#7d5ce2"; ctx.strokeStyle=C.ink; ctx.lineWidth=3;
    ctx.beginPath(); ctx.moveTo(x-r*0.6,y-r*0.42); ctx.lineTo(x+r*0.6,y-r*0.42); ctx.lineTo(x+aim[0]*5,y-r*1.55); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle=C.gold; ctx.fillRect(x-2+aim[0]*2,y-r*1.0,4,4); // hat star
    // eyes
    ctx.fillStyle=C.ink; ctx.beginPath(); ctx.arc(x-r*0.16,y-r*0.22,2.6,0,6.2832); ctx.arc(x+r*0.16,y-r*0.22,2.6,0,6.2832); ctx.fill();
    // muzzle glow
    ctx.fillStyle=C.laser; ctx.beginPath(); ctx.arc(x+aim[0]*r*1.35,y+aim[1]*r*0.5+r*0.06,5,0,6.2832); ctx.fill();
  }
  function drawGhostForm(x,y,r,aim){
    const pulse=0.5+0.5*Math.sin(ghostT*9);
    ctx.save(); ctx.globalAlpha=0.5+0.18*pulse;
    drawArms(x,y,r,C.wisp);
    // ghost body
    ctx.beginPath(); ctx.moveTo(x-r,y+r); ctx.lineTo(x-r,y-r*0.2); ctx.arc(x,y-r*0.2,r,Math.PI,0,false); ctx.lineTo(x+r,y+r);
    const n=4; for(let i=0;i<n;i++){ const xx=x+r-(2*r)*((i+0.5)/n); ctx.lineTo(xx,y+r-((i%2)?0:r*0.32)); }
    ctx.closePath(); ctx.fillStyle=C.wisp; ctx.fill(); ctx.lineWidth=3; ctx.strokeStyle=C.ink; ctx.lineJoin="round"; ctx.stroke();
    ctx.fillStyle=C.wispLt; ctx.beginPath(); ctx.arc(x-r*0.35,y-r*0.45,r*0.22,0,6.2832); ctx.fill();
    ctx.fillStyle=C.ink; ctx.beginPath(); ctx.arc(x-r*0.32,y-r*0.1,3.4,0,6.2832); ctx.arc(x+r*0.32,y-r*0.1,3.4,0,6.2832); ctx.fill();
    ctx.restore();
    // muzzle glow stays bright
    ctx.fillStyle=C.laser; ctx.beginPath(); ctx.arc(x+aim[0]*r*1.35,y+aim[1]*r*0.5+r*0.06,5,0,6.2832); ctx.fill();
  }
  function drawPlayer(){ const x=player.x,y=player.y,r=player.r;
    if(dying){ const dr=spriteImg.playerDeath, dsh=SPRITE_SHEETS.playerDeath;
      ctx.save(); ctx.imageSmoothingEnabled=false;
      if(dr&&dr.ok&&dsh.cols){ const frame=Math.min(dsh.cols-1, Math.floor(deathT/1.2*dsh.cols)), size=r*3.6;
        try{ ctx.drawImage(dr.img, frame*dsh.cell, 0, dsh.cell, dsh.cell, x-size/2, y-size/2, size, size); }catch(err){}
      } else { const p=Math.min(1,deathT/1.2); ctx.globalAlpha=1-p*0.85; ctx.translate(x,y); ctx.rotate(p*4.5); ctx.translate(-x,-y);
        drawSprite("playerCustom",x,y,r*3.6*(1-p*0.4),false) || drawSprite("player",x,y,r*2.5*(1-p*0.4),false); }
      ctx.restore(); return; }
    if(player.form!=="ghost" && iframe>0 && Math.floor(iframe*16)%2===0) return; // blink when hurt
    if(player.form==="ghost"){ drawGhostForm(x,y,r,player.aim); return; }
    const faceLeft=player.aim&&player.aim[0]<0;
    ctx.save(); ctx.fillStyle="rgba(0,0,0,0.24)"; ctx.beginPath(); ctx.ellipse(x,y+r*0.95,r*0.8,r*0.28,0,0,6.2832); ctx.fill(); ctx.restore();
    const walking=(player.walkT||0)>0;
    const wt=(player.walkT||0)*13;
    const bobY=walking?Math.abs(Math.sin(wt))*-3.4:Math.sin(anim*0.08)*1.2; // hop while walking, gentle breathe when idle
    const rock=walking?Math.sin(wt*0.5)*0.075:0;                             // little side-to-side rock
    const squash=walking?1-Math.abs(Math.sin(wt))*0.06:1;                    // squash-and-stretch
    ctx.save(); ctx.translate(x,y+bobY); ctx.rotate(rock); ctx.scale(1,squash); ctx.translate(-x,-y);
    if(drawSprite("playerCustom",x,y,r*3.6,faceLeft)){ ctx.restore(); return; } // custom wizard has his own gun — no overlay arm
    ctx.restore();
    if(drawSprite("player",x,y,r*2.5,faceLeft)){ drawPlayerArms(x,y,r,player.aim,false); return; }
    drawWizard(x,y,r,player.aim);
  }
  function drawPickups(){ for(const p of pickups){ const x=p.x,y=p.y, b=0.5+0.5*Math.sin(p.t*6), yo=Math.sin(p.t*3)*2, col=PCOL[p.type]||C.portal;
    ctx.fillStyle="rgba(255,255,255,"+(0.10+0.13*b)+")"; ctx.beginPath(); ctx.arc(x,y+yo,17,0,6.2832); ctx.fill();
    if(p.type==="redpotion"||p.type==="bluepotion"){
      const red=p.type==="redpotion", pc=red?"#e8404e":"#35a7e0";
      if(!drawSprite(red?"potionRed":"potionBlue",x,y+yo,26,false)){
        ctx.fillStyle=pc; ctx.strokeStyle=C.ink; ctx.lineWidth=2.5;
        ctx.beginPath(); ctx.arc(x,y+yo+2,7.5,0,6.2832); ctx.fill(); ctx.stroke();
        ctx.fillRect(x-3,y+yo-9,6,7); ctx.strokeRect(x-3,y+yo-9,6,7);
        ctx.fillStyle="#8a5a2b"; ctx.fillRect(x-3.2,y+yo-12,6.4,3.4); ctx.strokeStyle=C.ink; ctx.lineWidth=1.6; ctx.strokeRect(x-3.2,y+yo-12,6.4,3.4);
        ctx.fillStyle="rgba(255,255,255,0.85)"; ctx.beginPath(); ctx.arc(x-2.4,y+yo+1,2,0,6.2832); ctx.fill();
      }
      continue;
    }
    if(p.type==="nuke"){ ctx.strokeStyle=C.gold; ctx.lineWidth=2; for(let a=0;a<8;a++){ const an=a/8*6.2832+p.t*1.5; ctx.beginPath(); ctx.moveTo(x+Math.cos(an)*8,y+yo+Math.sin(an)*8); ctx.lineTo(x+Math.cos(an)*(13+2*b),y+yo+Math.sin(an)*(13+2*b)); ctx.stroke(); } }
    ctx.fillStyle=col; ctx.strokeStyle=C.ink; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.moveTo(x,y+yo-11); ctx.lineTo(x+9,y+yo); ctx.lineTo(x,y+yo+11); ctx.lineTo(x-9,y+yo); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle="#fff";
    if(p.type==="rocket"){ ctx.beginPath(); ctx.moveTo(x,y+yo-5); ctx.lineTo(x+3.5,y+yo+3); ctx.lineTo(x-3.5,y+yo+3); ctx.closePath(); ctx.fill(); }
    else if(p.type==="beam"){ ctx.fillRect(x-1.5,y+yo-6,3,12); }
    else if(p.type==="mine"){ ctx.beginPath(); ctx.arc(x,y+yo,2.6,0,6.2832); ctx.fill(); ctx.fillStyle=C.ink; for(let a=0;a<4;a++){ const an=a/4*6.2832+0.6; ctx.fillRect(x+Math.cos(an)*4.5-0.8,y+yo+Math.sin(an)*4.5-0.8,1.6,1.6);} }
    else if(p.type==="nuke"){ ctx.fillStyle="#fff"; ctx.beginPath(); ctx.arc(x,y+yo,4,0,6.2832); ctx.fill(); ctx.fillStyle=C.ink; ctx.beginPath(); ctx.arc(x,y+yo,1.6,0,6.2832); ctx.fill(); }
    else if(p.type==="nukegun"){ ctx.fillStyle="#fff"; ctx.beginPath(); ctx.arc(x,y+yo-2,4.2,Math.PI,0); ctx.fill(); ctx.fillRect(x-1.5,y+yo-2,3,6); }
    else { ctx.fillStyle=C.gold; ctx.beginPath(); ctx.arc(x,y+yo,3,0,6.2832); ctx.fill(); }
  } }
  function hex2(h){ h=(h||"#000").replace("#",""); if(h.length===3) h=h.split("").map(c=>c+c).join(""); return [parseInt(h.slice(0,2),16)||0,parseInt(h.slice(2,4),16)||0,parseInt(h.slice(4,6),16)||0]; }
  function mix(a,b,t){ const pa=hex2(a),pb=hex2(b); return "rgb("+Math.round(pa[0]+(pb[0]-pa[0])*t)+","+Math.round(pa[1]+(pb[1]-pa[1])*t)+","+Math.round(pa[2]+(pb[2]-pa[2])*t)+")"; }
  function drawZombie(x,y,s,faceLeft,wob){
    const G="#7fc25e", GD="#4e8f3a", SH="#6b5f86", SHD="#4d4463";
    ctx.save(); ctx.translate(x,y); if(faceLeft) ctx.scale(-1,1);
    ctx.lineJoin="round"; ctx.lineCap="round"; ctx.strokeStyle=C.ink; ctx.lineWidth=2.4;
    const shuf=Math.sin(wob*1.6)*s*0.16, lean=Math.sin(wob*0.8)*0.06;
    ctx.rotate(0.08+lean); // permanent zombie slump
    ctx.fillStyle=GD;
    ctx.fillRect(-s*0.42, s*0.44+shuf*0.4, s*0.34, s*0.5-shuf*0.4); ctx.strokeRect(-s*0.42, s*0.44+shuf*0.4, s*0.34, s*0.5-shuf*0.4);
    ctx.fillRect( s*0.06, s*0.44-shuf*0.4, s*0.34, s*0.5+shuf*0.4); ctx.strokeRect( s*0.06, s*0.44-shuf*0.4, s*0.34, s*0.5+shuf*0.4);
    ctx.fillStyle=SH; ctx.beginPath(); ctx.roundRect(-s*0.62,-s*0.42,s*1.24,s*0.95,s*0.18); ctx.fill(); ctx.stroke();
    ctx.fillStyle=SHD; ctx.fillRect(-s*0.62,s*0.28,s*1.24,s*0.25);
    ctx.beginPath(); ctx.moveTo(-s*0.2,s*0.53); ctx.lineTo(-s*0.05,s*0.34); ctx.lineTo(s*0.1,s*0.53); ctx.fill();
    const sway=Math.sin(wob*1.6)*s*0.07;
    ctx.fillStyle=G;
    ctx.beginPath(); ctx.roundRect(s*0.34,-s*0.30+sway,s*0.85,s*0.24,s*0.1); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.roundRect(s*0.34, s*0.02-sway,s*0.85,s*0.24,s*0.1); ctx.fill(); ctx.stroke();
    ctx.fillStyle=G; ctx.beginPath(); ctx.arc(s*0.12,-s*0.78,s*0.55,0,6.2832); ctx.fill(); ctx.stroke();
    ctx.fillStyle=GD; ctx.beginPath(); ctx.arc(-s*0.08,-s*0.98,s*0.34,0.6,3.6); ctx.fill();
    ctx.fillStyle="#ffd23c"; ctx.beginPath(); ctx.arc(s*0.3,-s*0.82,s*0.10,0,6.2832); ctx.arc(s*0.55,-s*0.82,s*0.09,0,6.2832); ctx.fill();
    ctx.fillStyle=C.ink; ctx.beginPath(); ctx.arc(s*0.32,-s*0.81,s*0.045,0,6.2832); ctx.arc(s*0.56,-s*0.81,s*0.04,0,6.2832); ctx.fill();
    ctx.strokeStyle=C.ink; ctx.lineWidth=1.8; ctx.beginPath(); ctx.moveTo(s*0.28,-s*0.56); ctx.lineTo(s*0.6,-s*0.6); ctx.stroke();
    for(let i=0;i<3;i++){ const mx=s*(0.33+i*0.1); ctx.beginPath(); ctx.moveTo(mx,-s*0.64); ctx.lineTo(mx,-s*0.52); ctx.stroke(); }
    ctx.restore();
  }
  function drawAlien(x,y,s,faceLeft,wob,v){
    const SKINS=["#67d6c4","#9fe066","#c59df0","#f0a35e"], DK=["#3fa190","#6faf3f","#9268c9","#c67a34"];
    const skin=SKINS[v%4], dk=DK[v%4], suit="#b9c2d8", suitD="#8d97b0";
    ctx.save(); ctx.translate(x,y); if(faceLeft) ctx.scale(-1,1);
    ctx.lineJoin="round"; ctx.lineCap="round"; ctx.strokeStyle=C.ink; ctx.lineWidth=2.4;
    const hop=Math.abs(Math.sin(wob*2.1))*s*0.14, wig=Math.sin(wob*2.1)*s*0.1;
    ctx.translate(0,-hop);
    // stubby legs
    ctx.fillStyle=suitD;
    ctx.fillRect(-s*0.36, s*0.5, s*0.28, s*0.32+wig); ctx.strokeRect(-s*0.36, s*0.5, s*0.28, s*0.32+wig);
    ctx.fillRect( s*0.08, s*0.5, s*0.28, s*0.32-wig); ctx.strokeRect( s*0.08, s*0.5, s*0.28, s*0.32-wig);
    // jumpsuit body
    ctx.fillStyle=suit; ctx.beginPath(); ctx.roundRect(-s*0.55,-s*0.1,s*1.1,s*0.7,s*0.2); ctx.fill(); ctx.stroke();
    ctx.fillStyle=dk; ctx.fillRect(-s*0.55,s*0.32,s*1.1,s*0.14); // belt
    ctx.fillStyle="#ffd23c"; ctx.beginPath(); ctx.arc(0,s*0.16,s*0.11,0,6.2832); ctx.fill(); ctx.stroke(); // badge
    // little arms
    ctx.fillStyle=skin;
    ctx.beginPath(); ctx.roundRect(s*0.4,-s*0.02+wig*0.5,s*0.5,s*0.2,s*0.09); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.roundRect(-s*0.9,-s*0.02-wig*0.5,s*0.5,s*0.2,s*0.09); ctx.fill(); ctx.stroke();
    // big head
    ctx.fillStyle=skin; ctx.beginPath(); ctx.ellipse(0,-s*0.55,s*0.6,s*0.52,0,0,6.2832); ctx.fill(); ctx.stroke();
    if(v%2===0){ // two big eyes
      ctx.fillStyle=C.ink; ctx.beginPath(); ctx.ellipse(s*0.16,-s*0.58,s*0.15,s*0.2,0.15,0,6.2832); ctx.ellipse(s*0.46,-s*0.58,s*0.13,s*0.18,0.15,0,6.2832); ctx.fill();
      ctx.fillStyle="#fff"; ctx.beginPath(); ctx.arc(s*0.12,-s*0.64,s*0.05,0,6.2832); ctx.arc(s*0.42,-s*0.64,s*0.045,0,6.2832); ctx.fill();
    } else { // one cyclops eye
      ctx.fillStyle="#fff"; ctx.beginPath(); ctx.arc(s*0.28,-s*0.58,s*0.22,0,6.2832); ctx.fill(); ctx.stroke();
      ctx.fillStyle=C.ink; ctx.beginPath(); ctx.arc(s*0.33,-s*0.57,s*0.1,0,6.2832); ctx.fill();
    }
    ctx.fillStyle=dk; ctx.beginPath(); ctx.arc(s*0.3,-s*0.32,s*0.08,0,3.1416); ctx.fill(); // small mouth
    // antenna with glowing tip
    ctx.strokeStyle=C.ink; ctx.lineWidth=2.2; ctx.beginPath(); ctx.moveTo(-s*0.1,-s*1.02); ctx.quadraticCurveTo(-s*0.2,-s*1.3,-s*0.02,-s*1.36); ctx.stroke();
    const gl=0.5+0.5*Math.sin(anim*0.3+v); ctx.fillStyle="rgba(255,210,60,"+(0.35+0.3*gl)+")"; ctx.beginPath(); ctx.arc(-s*0.02,-s*1.4,s*0.16,0,6.2832); ctx.fill();
    ctx.fillStyle="#ffd23c"; ctx.beginPath(); ctx.arc(-s*0.02,-s*1.4,s*0.09,0,6.2832); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  function drawEnemy(e){ const s=ETYPES[e.type]; const x=e.x,y=e.y,r=e.r; const bob=Math.sin(e.wob)*2;
    const menace=Math.min(1,(THEME.dread||0)+floorLoop*0.15); const eyeCol=ACT_EYE[actInfo(floor).a%ACT_EYE.length];
    const body=e.flash>0?"#ffffff":mix(s.col,"#160f1e",menace*0.42);
    const dark=e.flash>0?"#cfcfcf":mix(s.dk,"#0a0713",menace*0.42);
    const light=e.flash>0?"#ffffff":mix(s.col,"#ffffff",0.34);
    ctx.save(); ctx.lineJoin="round"; ctx.lineCap="round";
    ctx.fillStyle="rgba(0,0,0,0.24)"; ctx.beginPath(); ctx.ellipse(x,y+r*0.98,r*0.82,r*0.3,0,0,6.2832); ctx.fill(); // ground shadow
    ctx.translate(0,bob);
    if(e.tele>0){ const p=0.5+0.5*Math.sin(anim*0.6); ctx.strokeStyle="rgba(255,80,90,"+(0.5+0.4*p)+")"; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(x,y,r+7+3*p,0,6.2832); ctx.stroke(); }
    // pixel sprite art (if sheets are present); flash white overlay kept via globalAlpha trick
    // elite mechs from floor 5+ (custom AI sprites)
    if(e.flash<=0 && floor>=5){
      if(e.type==="brute" && drawSprite("mechSkin",x,y,r*3.3,(player&&player.x<x))){ ctx.restore(); return; }
      if(e.type==="tank" && drawSprite("skullmechSkin",x,y,r*3.5,(player&&player.x<x))){
        const hw=r*1.5; ctx.fillStyle="rgba(0,0,0,0.5)"; ctx.fillRect(x-hw/2,y-r-12,hw,5);
        ctx.fillStyle="#7ae08a"; ctx.fillRect(x-hw/2,y-r-12,hw*Math.max(0,e.hp/e.max),5);
        ctx.restore(); return; }
    }
    // horde theme skins (zombie floors — hand-drawn in house style)
    if(e.flash<=0 && hordeTheme==="zombie" && (e.type==="grunt"||e.type==="swarmer")){
      drawZombie(x,y,r*(e.type==="swarmer"?0.92:1.12), player&&player.x<x, e.wob);
      ctx.restore(); return;
    }
    if(e.flash<=0 && hordeTheme==="alien" && (e.type==="grunt"||e.type==="swarmer"||e.type==="caster")){
      if(e.vAlien===undefined) e.vAlien=Math.floor(Math.random()*4);
      drawAlien(x,y,r*(e.type==="swarmer"?0.88:1.02), player&&player.x<x, e.wob, e.vAlien);
      ctx.restore(); return;
    }
    if(e.flash<=0 && hordeTheme==="magic" && (e.type==="grunt"||e.type==="swarmer"||e.type==="caster")){
      const mrec=spriteImg.magical, msh=SPRITE_SHEETS.magical;
      if(mrec&&mrec.ok&&msh.cols){
        const CELLS=[[0,0],[1,0],[0,1],[1,1],[2,1],[3,1]];
        if(e.mCell===undefined) e.mCell=Math.floor(Math.random()*CELLS.length);
        const cell=CELLS[e.mCell], cw=mrec.w/msh.cols, chh=mrec.h/msh.rows, size=r*2.5;
        ctx.save(); ctx.imageSmoothingEnabled=false; ctx.translate(x,y); if(player&&player.x<x) ctx.scale(-1,1);
        try{ ctx.drawImage(mrec.img, cell[0]*cw, cell[1]*chh, cw, chh, -size/2, -size/2, size, size); }catch(err){}
        ctx.restore(); ctx.restore(); return;
      }
    }
    if(e.flash<=0 && hordeTheme!=="classic" && false){
      const skin = hordeTheme==="zombie" ? ((e.type==="grunt"||e.type==="swarmer")?"zombieRun":null)
                 : hordeTheme==="orc" ? ((e.type==="grunt"||e.type==="brute")?"orcWalk":null)
                 : hordeTheme==="alien" ? ((e.type==="grunt"||e.type==="swarmer"||e.type==="caster")?"buddies":null) : null;
      if(skin){ const sr=spriteImg[skin], ssh=SPRITE_SHEETS[skin];
        if(sr&&sr.ok&&ssh.cols){
          const frame = skin==="zombieRun" ? 0 : (ssh._strip ? (Math.floor(anim*0.11)+(e.frameOff=e.frameOff??Math.floor(Math.random()*ssh.cols)))%ssh.cols : (e.frameOff=e.frameOff??Math.floor(Math.random()*ssh.cols))%ssh.cols);
          const size=r*(skin==="orcWalk"?3.6:3.4)*(e.type==="brute"?1.2:1);
          ctx.save(); ctx.imageSmoothingEnabled=false; ctx.translate(x,y); if(player&&player.x<x) ctx.scale(-1,1);
          try{ ctx.drawImage(sr.img, frame*ssh.cell, 0, ssh.cell, ssh.cell, -size/2, -size/2, size, size); }catch(err){}
          ctx.restore();
          if(e.type==="boss"||e.type==="tank"||e.max>6){ const hw=r*1.5; ctx.fillStyle="rgba(0,0,0,0.5)"; ctx.fillRect(x-hw/2,y-r-12,hw,5); ctx.fillStyle="#7ae08a"; ctx.fillRect(x-hw/2,y-r-12,hw*Math.max(0,e.hp/e.max),5); }
          ctx.restore(); return;
        }
      }
    }
    if(e.flash<=0 && drawSprite(e.type,x,y,r*2.35,(player&&player.x<x))){
      if(e.type==="boss"||e.type==="tank"||e.max>6){ const hw=r*1.5; ctx.fillStyle="rgba(0,0,0,0.5)"; ctx.fillRect(x-hw/2,y-r-12,hw,5); ctx.fillStyle="#7ae08a"; ctx.fillRect(x-hw/2,y-r-12,hw*Math.max(0,e.hp/e.max),5); }
      ctx.restore(); return;
    }
    const eye=(gx,gy,rad)=>{ ctx.fillStyle="#0a0713"; ctx.beginPath(); ctx.arc(gx,gy,rad*1.28,0,6.2832); ctx.fill();
      ctx.fillStyle=eyeCol; ctx.beginPath(); ctx.arc(gx,gy,rad,0,6.2832); ctx.fill();
      ctx.fillStyle=C.ink; ctx.beginPath(); ctx.ellipse(gx,gy+rad*0.1,rad*0.36,rad*0.5,0,0,6.2832); ctx.fill();
      ctx.fillStyle="rgba(255,255,255,0.85)"; ctx.beginPath(); ctx.arc(gx-rad*0.34,gy-rad*0.34,rad*0.24,0,6.2832); ctx.fill(); };
    const gloss=(cx,cy,rad)=>{ ctx.globalAlpha=0.32; ctx.fillStyle=light; ctx.beginPath(); ctx.arc(cx,cy,rad,0,6.2832); ctx.fill(); ctx.globalAlpha=1; };
    const tendril=(x0,y0,ang,len,ph)=>{ const bx=Math.sin(anim*0.15+ph)*5; const mx=x0+Math.cos(ang)*len*0.5+bx, my=y0+Math.sin(ang)*len*0.5, ex=x0+Math.cos(ang)*len+bx*1.4, ey=y0+Math.sin(ang)*len;
      ctx.strokeStyle=C.ink; ctx.lineWidth=5; ctx.beginPath(); ctx.moveTo(x0,y0); ctx.quadraticCurveTo(mx,my,ex,ey); ctx.stroke();
      ctx.strokeStyle=dark; ctx.lineWidth=2.6; ctx.beginPath(); ctx.moveTo(x0,y0); ctx.quadraticCurveTo(mx,my,ex,ey); ctx.stroke(); };
    const fangs=(cx,cy,ww,hh,n)=>{ ctx.fillStyle="#e9e2cf"; for(let i=0;i<n;i++){ const fx=cx-ww/2+ww*(i+0.5)/n; ctx.beginPath(); ctx.moveTo(fx-ww/n*0.5,cy); ctx.lineTo(fx,cy+hh); ctx.lineTo(fx+ww/n*0.5,cy); ctx.closePath(); ctx.fill(); } };

    if(e.type==="grunt"){ // alien gremling
      ctx.strokeStyle=C.ink; ctx.lineWidth=2.5;
      for(const g of [-1,1]){ ctx.beginPath(); ctx.moveTo(x+g*r*0.32,y-r*0.72); ctx.quadraticCurveTo(x+g*r*0.75,y-r*1.35,x+g*r*0.5,y-r*1.55); ctx.stroke(); ctx.fillStyle=eyeCol; ctx.beginPath(); ctx.arc(x+g*r*0.5,y-r*1.55,r*0.12,0,6.2832); ctx.fill(); }
      ctx.fillStyle=body; ctx.strokeStyle=C.ink; ctx.lineWidth=3; ctx.beginPath(); ctx.ellipse(x,y,r*0.96,r,0,0,6.2832); ctx.fill(); ctx.stroke();
      gloss(x-r*0.32,y-r*0.42,r*0.4);
      ctx.strokeStyle=dark; ctx.lineWidth=1.6; ctx.beginPath(); ctx.arc(x,y+r*0.15,r*0.55,0.25,2.9); ctx.stroke();
      eye(x-r*0.36,y-r*0.12,r*0.25); eye(x+r*0.36,y-r*0.12,r*0.25); if(menace>0.55) eye(x,y-r*0.5,r*0.16);
      ctx.strokeStyle=C.ink; ctx.lineWidth=2.5; ctx.beginPath(); let gx=x-r*0.42; ctx.moveTo(gx,y+r*0.46); for(let i=0;i<5;i++){ gx+=r*0.16; ctx.lineTo(gx,y+r*(i%2?0.46:0.62)); } ctx.stroke();
      for(const g of [-1,1]){ ctx.fillStyle="#e9e2cf"; ctx.beginPath(); ctx.moveTo(x+g*r*0.3,y+r*0.5); ctx.lineTo(x+g*r*0.4,y+r*0.8); ctx.lineTo(x+g*r*0.18,y+r*0.56); ctx.closePath(); ctx.fill(); }
    } else if(e.type==="swarmer"){ // alien stinger
      const flap=Math.sin(e.wob*1.6)*0.28;
      for(const g of [-1,1]){ ctx.globalAlpha=0.55; ctx.fillStyle=light; ctx.strokeStyle=C.ink; ctx.lineWidth=2;
        ctx.beginPath(); ctx.moveTo(x,y-r*0.2); ctx.quadraticCurveTo(x+g*r*1.9,y-r*(1.1+flap),x+g*r*1.35,y+r*0.35); ctx.quadraticCurveTo(x+g*r*0.7,y,x,y-r*0.2); ctx.closePath(); ctx.fill(); ctx.globalAlpha=1; ctx.stroke();
        ctx.strokeStyle="rgba(0,0,0,0.22)"; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(x,y-r*0.1); ctx.lineTo(x+g*r*1.25,y-r*0.45); ctx.stroke(); }
      ctx.strokeStyle=C.ink; ctx.lineWidth=4; ctx.beginPath(); ctx.moveTo(x,y+r*0.4); ctx.quadraticCurveTo(x-r*0.25,y+r*1.25,x+r*0.35,y+r*1.45); ctx.stroke();
      ctx.fillStyle=dark; ctx.beginPath(); ctx.moveTo(x+r*0.35,y+r*1.45); ctx.lineTo(x+r*0.6,y+r*1.75); ctx.lineTo(x+r*0.1,y+r*1.5); ctx.closePath(); ctx.fill();
      ctx.fillStyle=body; ctx.strokeStyle=C.ink; ctx.lineWidth=2.6; ctx.beginPath(); ctx.ellipse(x,y+r*0.15,r*0.72,r*0.98,0,0,6.2832); ctx.fill(); ctx.stroke();
      ctx.strokeStyle=dark; ctx.lineWidth=1.5; for(let i=1;i<=2;i++){ ctx.beginPath(); ctx.arc(x,y+r*0.15,r*0.5*i*0.5,0.4,2.74); ctx.stroke(); }
      ctx.fillStyle=dark; ctx.strokeStyle=C.ink; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(x,y-r*0.55,r*0.42,0,6.2832); ctx.fill(); ctx.stroke();
      eye(x-r*0.18,y-r*0.6,r*0.16); eye(x+r*0.18,y-r*0.6,r*0.16); if(menace>0.5) eye(x,y-r*0.35,r*0.12);
    } else if(e.type==="brute"){ // alien behemoth
      ctx.fillStyle=dark; ctx.strokeStyle=C.ink; ctx.lineWidth=2; for(let i=-2;i<=2;i++){ ctx.beginPath(); ctx.moveTo(x+i*r*0.34,y-r*0.68); ctx.lineTo(x+i*r*0.34+r*0.12,y-r*(1.02+Math.abs(i)*0.06)); ctx.lineTo(x+i*r*0.34+r*0.26,y-r*0.68); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      for(const g of [-1,1]){ ctx.fillStyle=dark; ctx.beginPath(); ctx.arc(x+g*r*1.0,y+r*0.45,r*0.36,0,6.2832); ctx.fill(); ctx.strokeStyle=C.ink; ctx.lineWidth=2.5; ctx.stroke(); }
      ctx.fillStyle=body; ctx.strokeStyle=C.ink; ctx.lineWidth=3.5; ctx.beginPath(); ctx.arc(x,y,r,0,6.2832); ctx.fill(); ctx.stroke();
      gloss(x-r*0.32,y-r*0.4,r*0.46);
      ctx.strokeStyle=dark; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(x,y-r*0.05,r*0.72,0.3,2.84); ctx.stroke();
      ctx.fillStyle=dark; ctx.strokeStyle=C.ink; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(x-r*0.62,y-r*0.12); ctx.quadraticCurveTo(x,y-r*0.44,x+r*0.62,y-r*0.12); ctx.quadraticCurveTo(x,y-r*0.26,x-r*0.62,y-r*0.12); ctx.closePath(); ctx.fill(); ctx.stroke();
      eye(x-r*0.3,y,r*0.15); eye(x+r*0.3,y,r*0.15);
      ctx.fillStyle="#0a0713"; ctx.beginPath(); ctx.ellipse(x,y+r*0.44,r*0.46,r*0.24,0,0,6.2832); ctx.fill(); fangs(x,y+r*0.24,r*0.7,r*0.32,4);
      ctx.fillStyle="#e9e2cf"; ctx.strokeStyle=C.ink; ctx.lineWidth=1.5; for(const g of [-1,1]){ ctx.beginPath(); ctx.moveTo(x+g*r*0.42,y+r*0.5); ctx.quadraticCurveTo(x+g*r*0.64,y+r*0.18,x+g*r*0.5,y-r*0.08); ctx.lineTo(x+g*r*0.34,y+r*0.1); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    } else if(e.type==="caster"){ // alien psychic — floating brain, one great eye, tendrils
      ctx.globalAlpha=0.16+0.1*Math.sin(anim*0.2); ctx.fillStyle=eyeCol; ctx.beginPath(); ctx.arc(x,y,r*1.6,0,6.2832); ctx.fill(); ctx.globalAlpha=1;
      for(let i=-2;i<=2;i++) tendril(x+i*r*0.26,y+r*0.5,Math.PI/2+i*0.2,r*1.15,i);
      ctx.fillStyle=body; ctx.strokeStyle=C.ink; ctx.lineWidth=3; ctx.beginPath(); ctx.ellipse(x,y-r*0.1,r*0.92,r*0.96,0,0,6.2832); ctx.fill(); ctx.stroke();
      gloss(x-r*0.3,y-r*0.5,r*0.4);
      ctx.strokeStyle=dark; ctx.lineWidth=2; for(let i=-1;i<=1;i++){ ctx.beginPath(); ctx.moveTo(x+i*r*0.32-r*0.18,y-r*0.6); ctx.quadraticCurveTo(x+i*r*0.32+r*0.12,y-r*0.32,x+i*r*0.32-r*0.1,y-r*0.02); ctx.stroke(); }
      eye(x,y-r*0.02,r*0.36); if(menace>0.5){ eye(x-r*0.46,y-r*0.18,r*0.12); eye(x+r*0.46,y-r*0.18,r*0.12); }
    } else if(e.type==="tank"){ // alien war-tank
      const ang=Math.atan2(player.y-y,player.x-x);
      ctx.fillStyle=dark; ctx.strokeStyle=C.ink; ctx.lineWidth=2;
      for(const g of [-1,1]){ ctx.fillRect(x+g*r*0.62-r*0.2,y-r*0.85,r*0.4,r*1.7); ctx.strokeRect(x+g*r*0.62-r*0.2,y-r*0.85,r*0.4,r*1.7);
        ctx.lineWidth=1.4; for(let i=-3;i<=3;i++){ ctx.beginPath(); ctx.moveTo(x+g*r*0.62-r*0.2,y+i*r*0.24); ctx.lineTo(x+g*r*0.62+r*0.2,y+i*r*0.24); ctx.stroke(); } ctx.lineWidth=2; }
      ctx.fillStyle=body; ctx.strokeStyle=C.ink; ctx.lineWidth=3; ctx.fillRect(x-r*0.6,y-r*0.7,r*1.2,r*1.4); ctx.strokeRect(x-r*0.6,y-r*0.7,r*1.2,r*1.4);
      gloss(x-r*0.25,y-r*0.35,r*0.35);
      ctx.fillStyle="#0a0713"; for(const cx of [-1,1]) for(const cy of [-1,1]) ctx.fillRect(x+cx*r*0.42-1.6,y+cy*r*0.5-1.6,3.2,3.2);
      ctx.save(); ctx.translate(x,y); ctx.rotate(ang); ctx.fillStyle=dark; ctx.strokeStyle=C.ink; ctx.lineWidth=3; ctx.fillRect(r*0.1,-r*0.14,r*1.15,r*0.28); ctx.strokeRect(r*0.1,-r*0.14,r*1.15,r*0.28); ctx.restore();
      ctx.fillStyle=mix(body,"#ffffff",0.12); ctx.strokeStyle=C.ink; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(x,y,r*0.44,0,6.2832); ctx.fill(); ctx.stroke();
      eye(x,y,r*0.2);
    } else { // boss — alien dread horror
      ctx.globalAlpha=0.22+0.1*Math.sin(anim*0.25); ctx.fillStyle=eyeCol; ctx.beginPath(); ctx.arc(x,y,r*1.4,0,6.2832); ctx.fill(); ctx.globalAlpha=1;
      const nt=menace>0.4?5:4; for(let i=0;i<nt;i++){ const a1=Math.PI*0.2+(i/(nt-1))*Math.PI*0.6; tendril(x,y+r*0.45,a1,r*1.35,i); tendril(x,y+r*0.45,Math.PI-a1,r*1.35,i+9); }
      ctx.fillStyle=dark; ctx.strokeStyle=C.ink; ctx.lineWidth=3; for(const g of [-1,1]){ ctx.beginPath(); ctx.moveTo(x+g*r*0.6,y-r*0.55); ctx.quadraticCurveTo(x+g*r*1.28,y-r*1.02,x+g*r*1.05,y-r*1.55); ctx.quadraticCurveTo(x+g*r*0.7,y-r*1.02,x+g*r*0.3,y-r*0.68); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      ctx.fillStyle=body; ctx.strokeStyle=C.ink; ctx.lineWidth=3.5; ctx.beginPath(); ctx.arc(x,y,r,0,6.2832); ctx.fill(); ctx.stroke();
      gloss(x-r*0.35,y-r*0.42,r*0.5);
      ctx.strokeStyle=dark; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(x,y,r*0.7,0.3,2.84); ctx.stroke();
      eye(x-r*0.36,y-r*0.1,r*0.16); eye(x+r*0.36,y-r*0.1,r*0.16); eye(x,y-r*0.42,r*0.14);
      if(menace>0.4){ eye(x-r*0.18,y-r*0.02,r*0.1); eye(x+r*0.18,y-r*0.02,r*0.1); }
      ctx.fillStyle="#0a0713"; ctx.beginPath(); ctx.ellipse(x,y+r*0.46,r*0.54,r*0.3,0,0,6.2832); ctx.fill(); fangs(x,y+r*0.22,r*0.9,r*0.4,5);
    }
    if(e.type==="boss"){ const w=r*1.8; ctx.fillStyle=C.ink; ctx.fillRect(x-w/2-2,y-r*1.62-16,w+4,8); ctx.fillStyle=C.hp; ctx.fillRect(x-w/2,y-r*1.62-14,w*(e.hp/e.max),4); }
    ctx.restore();
  }
  function drawBullet(b){ ctx.save(); const a=Math.atan2(b.vy,b.vx); ctx.translate(b.x,b.y); ctx.rotate(a);
    if(b.grenade){
      ctx.rotate(-a); // undo; grenades draw unrotated with fake arc height
      const p=1-Math.max(0,b.life)/(b.gmax||0.6), arc=Math.sin(p*3.1416)*20;
      ctx.fillStyle="rgba(0,0,0,0.25)"; ctx.beginPath(); ctx.ellipse(0,4,7-arc*0.12,3,0,0,6.2832); ctx.fill(); // ground shadow
      ctx.translate(0,-arc); ctx.rotate(p*7);
      ctx.fillStyle="#3b3f4d"; ctx.strokeStyle=C.ink; ctx.lineWidth=2.2;
      ctx.beginPath(); ctx.arc(0,0,6.5,0,6.2832); ctx.fill(); ctx.stroke();
      ctx.fillStyle="#f0872e"; ctx.fillRect(-1.6,-10,3.2,4.5); ctx.strokeRect(-1.6,-10,3.2,4.5);
      const fz=0.5+0.5*Math.sin(anim*0.9); ctx.fillStyle="rgba(255,220,90,"+(0.6+0.4*fz)+")";
      ctx.beginPath(); ctx.arc(0,-12,2.4+fz*1.4,0,6.2832); ctx.fill();
      ctx.fillStyle="rgba(255,255,255,0.5)"; ctx.beginPath(); ctx.arc(-2,-2,1.8,0,6.2832); ctx.fill();
      ctx.restore(); return;
    }
    if(b.flame){ // flaming arrow
      const fz=0.5+0.5*Math.sin(anim*0.9+b.x);
      ctx.fillStyle="rgba(255,150,50,"+(0.5+0.3*fz)+")"; ctx.beginPath(); ctx.arc(-9,0,4.5+fz*2,0,6.2832); ctx.fill();
      ctx.fillStyle="rgba(255,220,90,0.9)"; ctx.beginPath(); ctx.arc(-8,0,2.6,0,6.2832); ctx.fill();
      ctx.fillStyle="#9a6a3a"; ctx.fillRect(-8,-1.4,14,2.8);
      ctx.fillStyle="#d8dbe6"; ctx.strokeStyle=C.ink; ctx.lineWidth=1.6;
      ctx.beginPath(); ctx.moveTo(10,0); ctx.lineTo(4,-3.6); ctx.lineTo(4,3.6); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore(); return;
    }
    if(b.star||b.starlet){ // starburst shells + star fragments
      ctx.rotate(anim*(b.star?0.5:0.9));
      const R=b.star?9:4.6, r2=R*0.42, col=b.star?"#ffd23c":"#ff6ec7";
      ctx.fillStyle=col; ctx.strokeStyle=C.ink; ctx.lineWidth=b.star?2:1.3;
      ctx.beginPath(); for(let k=0;k<10;k++){ const a2=k*3.1416/5, rr=k%2?r2:R; const px2=Math.cos(a2)*rr, py2=Math.sin(a2)*rr; k?ctx.lineTo(px2,py2):ctx.moveTo(px2,py2); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      if(b.star){ ctx.fillStyle="rgba(255,255,255,0.8)"; ctx.beginPath(); ctx.arc(-2,-2,2,0,6.2832); ctx.fill(); }
      ctx.restore(); return;
    }
    if(b.mini){ // minigun slug
      ctx.fillStyle="#ffd23c"; ctx.strokeStyle=C.ink; ctx.lineWidth=1.4;
      ctx.beginPath(); ctx.roundRect(-4,-1.7,8,3.4,1.6); ctx.fill(); ctx.stroke();
      ctx.restore(); return;
    }
    if(b.rocket){
      ctx.fillStyle=C.laserCore; ctx.beginPath(); ctx.moveTo(-9,0); ctx.lineTo(-17,-3.5); ctx.lineTo(-17,3.5); ctx.closePath(); ctx.fill(); // flame
      ctx.fillStyle="#d8dbe6"; ctx.strokeStyle=C.ink; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(9,0); ctx.lineTo(-8,-4.5); ctx.lineTo(-8,4.5); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle=C.hp; ctx.fillRect(-3,-2.5,4,5);
    } else if(b.beam){
      ctx.fillStyle=C.portal2; ctx.strokeStyle=C.portal; ctx.lineWidth=2; ctx.beginPath(); ctx.ellipse(0,0,14,5.5,0,0,6.2832); ctx.fill(); ctx.stroke();
      ctx.fillStyle="#ffffff"; ctx.beginPath(); ctx.ellipse(0,0,8,2.2,0,0,6.2832); ctx.fill();
    } else if(b.nukeshot){
      const p=0.5+0.5*Math.sin(anim*0.6); ctx.fillStyle="rgba(176,97,255,"+(0.4+0.3*p)+")"; ctx.beginPath(); ctx.arc(0,0,11,0,6.2832); ctx.fill();
      ctx.fillStyle="#b061ff"; ctx.strokeStyle=C.ink; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(0,0,7,0,6.2832); ctx.fill(); ctx.stroke();
      ctx.fillStyle=C.gold; ctx.beginPath(); ctx.arc(0,0,3,0,6.2832); ctx.fill();
    } else {
      ctx.fillStyle=C.laser; ctx.strokeStyle=C.ink; ctx.lineWidth=2; ctx.beginPath(); ctx.ellipse(0,0,9,4.5,0,0,6.2832); ctx.fill(); ctx.stroke();
      ctx.fillStyle=C.laserCore; ctx.beginPath(); ctx.ellipse(-2,0,4,2,0,0,6.2832); ctx.fill();
    }
    ctx.restore();
  }
  function drawMines(){ for(const m of mines){ const blink=Math.floor(m.t*6)%2===0;
    ctx.strokeStyle="#4a4048"; ctx.lineWidth=2; for(let a=0;a<8;a++){ const an=a/8*6.2832; ctx.beginPath(); ctx.moveTo(m.x+Math.cos(an)*6,m.y+Math.sin(an)*6); ctx.lineTo(m.x+Math.cos(an)*10,m.y+Math.sin(an)*10); ctx.stroke(); }
    ctx.fillStyle="#4a4048"; ctx.strokeStyle=C.ink; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(m.x,m.y,7,0,6.2832); ctx.fill(); ctx.stroke();
    ctx.fillStyle=blink?C.hp:"#7a2630"; ctx.beginPath(); ctx.arc(m.x,m.y,2.6,0,6.2832); ctx.fill(); } }
  function drawBlasts(){ for(const bl of blasts){ const k=bl.t/bl.life, rr=bl.max*k;
    ctx.globalAlpha=Math.max(0,1-k); ctx.strokeStyle=bl.col; ctx.lineWidth=4; ctx.beginPath(); ctx.arc(bl.x,bl.y,rr,0,6.2832); ctx.stroke();
    ctx.globalAlpha=Math.max(0,0.35*(1-k)); ctx.fillStyle=bl.col; ctx.beginPath(); ctx.arc(bl.x,bl.y,rr*0.7,0,6.2832); ctx.fill(); ctx.globalAlpha=1; } }
  function drawEbullets(){ for(const b of ebullets){ ctx.fillStyle=b.col; ctx.strokeStyle=C.ink; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,6.2832); ctx.fill(); ctx.stroke();
    ctx.fillStyle="#fff"; ctx.beginPath(); ctx.arc(b.x-1.6,b.y-1.6,2,0,6.2832); ctx.fill(); } }
  function drawDoors(){ for(const d of doors){ const x=d.x,y=d.y;
    if(d.open){ if(d.collapse>0){ const k=d.collapse/0.4; ctx.globalAlpha=k; ctx.fillStyle="#c7cef0";
        for(let i=0;i<5;i++){ const an=i/5*6.2832; ctx.fillRect(x+Math.cos(an)*(1-k)*22-3, y+Math.sin(an)*(1-k)*22-3, 6,6); } ctx.globalAlpha=1; }
      continue; }
    const thick=TILE*0.34; const w=d.horiz?TILE:thick, h=d.horiz?thick:TILE;
    ctx.fillStyle="#aab4e6"; ctx.strokeStyle=C.ink; ctx.lineWidth=3; ctx.fillRect(x-w/2,y-h/2,w,h); ctx.strokeRect(x-w/2,y-h/2,w,h);
    ctx.fillStyle="#c9d0f2"; if(d.horiz) ctx.fillRect(x-w/2,y-h/2,w,3); else ctx.fillRect(x-w/2,y-h/2,3,h);
    ctx.strokeStyle="#6b74a8"; ctx.lineWidth=1.6; const seg=3;
    for(let i=1;i<seg;i++){ if(d.horiz){ const sx=x-w/2+i*w/seg; ctx.beginPath(); ctx.moveTo(sx,y-h/2); ctx.lineTo(sx,y+h/2); ctx.stroke(); }
      else { const sy=y-h/2+i*h/seg; ctx.beginPath(); ctx.moveTo(x-w/2,sy); ctx.lineTo(x+w/2,sy); ctx.stroke(); } }
  } }
  function drawWater(){ if(!waterSpots.length) return; const rec=spriteImg.water, sh=SPRITE_SHEETS.water;
    const isW=(c,r)=>waterSpots.some(w=>w.col===c&&w.row===r);
    ctx.save(); ctx.imageSmoothingEnabled=false;
    // clip to the pond shape so oversized waves stay inside
    ctx.beginPath(); for(const w of waterSpots) ctx.rect(w.col*TILE,w.row*TILE,TILE,TILE); ctx.clip();
    for(const w of waterSpots){ ctx.fillStyle="#2f5cb8"; ctx.fillRect(w.col*TILE,w.row*TILE,TILE,TILE); }
    for(const w of waterSpots){ const px=w.col*TILE, py=w.row*TILE;
      if(rec&&rec.ok&&sh.cols){ const frame=Math.floor(anim*0.13+w.col*2+w.row)%sh.cols;
        const ds=TILE*1.5, ox=px+TILE/2-ds/2, oy=py+TILE/2-ds/2+Math.sin(anim*0.07+w.col+w.row)*2;
        try{ ctx.drawImage(rec.img, frame*sh.cell, 0, sh.cell, sh.cell, ox, oy, ds, ds); }catch(err){}
      } else {
        ctx.strokeStyle="rgba(200,228,255,0.8)"; ctx.lineWidth=2.6;
        const ph=anim*0.09+w.col*1.7+w.row; for(let k=0;k<2;k++){ const wy=py+15+k*17+Math.sin(ph+k*2)*2.5; ctx.beginPath(); ctx.moveTo(px+5,wy); ctx.quadraticCurveTo(px+TILE/2,wy-5,px+TILE-5,wy); ctx.stroke(); }
      }
    }
    ctx.restore();
    // scalloped light rim on exposed edges (Set 4.5 pond style)
    ctx.save(); ctx.lineCap="round";
    ctx.strokeStyle="#8fb8ef"; ctx.lineWidth=6;
    for(const w of waterSpots){ const px=w.col*TILE, py=w.row*TILE, i=3;
      if(!isW(w.col,w.row-1)){ ctx.beginPath(); ctx.moveTo(px+i,py+i); ctx.lineTo(px+TILE-i,py+i); ctx.stroke(); }
      if(!isW(w.col,w.row+1)){ ctx.beginPath(); ctx.moveTo(px+i,py+TILE-i); ctx.lineTo(px+TILE-i,py+TILE-i); ctx.stroke(); }
      if(!isW(w.col-1,w.row)){ ctx.beginPath(); ctx.moveTo(px+i,py+i); ctx.lineTo(px+i,py+TILE-i); ctx.stroke(); }
      if(!isW(w.col+1,w.row)){ ctx.beginPath(); ctx.moveTo(px+TILE-i,py+i); ctx.lineTo(px+TILE-i,py+TILE-i); ctx.stroke(); }
    }
    ctx.strokeStyle="#d6ecff"; ctx.lineWidth=2.6;
    for(const w of waterSpots){ const px=w.col*TILE, py=w.row*TILE, i=3, seg=8;
      const scallop=(x1,y1,x2,y2)=>{ const dx=(x2-x1)/5, dy=(y2-y1)/5, nx=dy!==0?2.2:0, ny=dx!==0?2.2:0, sgn=(y1===py+i||x1===px+i)?1:-1;
        for(let s=0;s<5;s++){ ctx.beginPath(); ctx.moveTo(x1+dx*s,y1+dy*s); ctx.quadraticCurveTo(x1+dx*(s+0.5)+nx*sgn, y1+dy*(s+0.5)+ny*sgn, x1+dx*(s+1), y1+dy*(s+1)); ctx.stroke(); } };
      if(!isW(w.col,w.row-1)) scallop(px+i,py+i,px+TILE-i,py+i);
      if(!isW(w.col,w.row+1)) scallop(px+i,py+TILE-i,px+TILE-i,py+TILE-i);
      if(!isW(w.col-1,w.row)) scallop(px+i,py+i,px+i,py+TILE-i);
      if(!isW(w.col+1,w.row)) scallop(px+TILE-i,py+i,px+TILE-i,py+TILE-i);
    }
    ctx.restore();
  }
  function drawScraps(){ for(const sc of scraps){ const x=sc.x, y=sc.y;
    ctx.save(); ctx.translate(x,y); ctx.rotate(sc.rot);
    ctx.fillStyle="rgba(0,0,0,0.16)"; ctx.beginPath(); ctx.ellipse(0,9,13,4,0,0,6.2832); ctx.fill();
    ctx.strokeStyle=C.ink; ctx.lineWidth=2; ctx.lineJoin="round";
    if(sc.v===0){ // broken gear + bolts
      ctx.fillStyle="#9aa3b8"; ctx.beginPath(); ctx.arc(0,0,9,0.4,5.6); ctx.lineTo(0,0); ctx.closePath(); ctx.fill(); ctx.stroke();
      for(let k=0;k<5;k++){ const a2=0.5+k*1.05; ctx.fillRect(Math.cos(a2)*9-2,Math.sin(a2)*9-2,4,4); }
      ctx.fillStyle="#6d7590"; ctx.beginPath(); ctx.arc(0,0,3.2,0,6.2832); ctx.fill(); ctx.stroke();
      ctx.fillStyle="#7d88a6"; ctx.fillRect(8,4,5,5); ctx.strokeRect(8,4,5,5); ctx.fillRect(-14,6,4,4); ctx.strokeRect(-14,6,4,4);
    } else if(sc.v===1){ // half-buried bone
      ctx.fillStyle="rgba(90,84,72,0.5)"; ctx.beginPath(); ctx.ellipse(0,7,9,3.2,0,0,6.2832); ctx.fill(); // disturbed earth
      ctx.save(); ctx.rotate(-0.62);
      ctx.fillStyle="#ece6d4"; ctx.strokeStyle=C.ink; ctx.lineWidth=2;
      ctx.beginPath(); ctx.roundRect(-3,-16,6,20,3); ctx.fill(); ctx.stroke(); // shaft rising from ground
      ctx.beginPath(); ctx.arc(-3.4,-16,4,0,6.2832); ctx.fill(); // twin knobs
      ctx.beginPath(); ctx.arc(3.4,-16,4,0,6.2832); ctx.fill();
      ctx.beginPath(); ctx.arc(-3.4,-16,4,0,6.2832); ctx.stroke();
      ctx.beginPath(); ctx.arc(3.4,-16,4,0,6.2832); ctx.stroke();
      ctx.fillStyle="#cfc8b2"; ctx.fillRect(-3,0,6,4); // shading where it meets the dirt
      ctx.restore();
      ctx.fillStyle="#ece6d4"; ctx.strokeStyle=C.ink; ctx.lineWidth=1.8;
      ctx.beginPath(); ctx.ellipse(9,5,5,2.6,0.4,0,6.2832); ctx.fill(); ctx.stroke(); // small rib fragment nearby
      if(sc.skull){ // half-buried human skull, staring up
        ctx.fillStyle="rgba(90,84,72,0.45)"; ctx.beginPath(); ctx.ellipse(-11,8,8,2.8,0,0,6.2832); ctx.fill();
        ctx.fillStyle="#ece6d4"; ctx.strokeStyle=C.ink; ctx.lineWidth=2;
        ctx.beginPath(); ctx.arc(-11,3,6.5,3.3,6.1); ctx.arc(-11,3,6.5,6.1,3.3+6.2832); ctx.fill(); ctx.stroke();
        ctx.fillStyle="#ece6d4"; ctx.fillRect(-14.5,5,7,3.5); ctx.strokeRect(-14.5,5,7,3.5); // jaw sinking into dirt
        ctx.fillStyle=C.ink;
        ctx.beginPath(); ctx.ellipse(-13.3,2.2,1.8,2.2,0,0,6.2832); ctx.ellipse(-8.7,2.2,1.8,2.2,0,0,6.2832); ctx.fill(); // sockets
        ctx.beginPath(); ctx.moveTo(-11,4.4); ctx.lineTo(-12,6.2); ctx.lineTo(-10,6.2); ctx.closePath(); ctx.fill(); // nose
        ctx.strokeStyle=C.ink; ctx.lineWidth=1.2; for(let k=0;k<3;k++){ ctx.beginPath(); ctx.moveTo(-13.5+k*2.4,5.2); ctx.lineTo(-13.5+k*2.4,8); ctx.stroke(); } // teeth
      }
    } else if(sc.v===3){ // glowing mushroom cluster
      const gl=0.4+0.35*Math.sin(anim*0.16+x);
      ctx.fillStyle="rgba(140,110,220,"+(0.12+0.12*gl)+")"; ctx.beginPath(); ctx.arc(0,0,15,0,6.2832); ctx.fill();
      const caps=[[-6,2,6,"#a06ee8"],[4,4,4.6,"#c58bff"],[0,-4,5,"#8a5ad8"]];
      for(const [mx,my,mr,mc] of caps){
        ctx.fillStyle="#e8e2d0"; ctx.strokeStyle=C.ink; ctx.lineWidth=1.8;
        ctx.fillRect(mx-1.6,my,3.2,6); ctx.strokeRect(mx-1.6,my,3.2,6);
        ctx.fillStyle=mc; ctx.beginPath(); ctx.arc(mx,my,mr,3.1416,6.2832); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle="rgba(255,255,255,0.7)"; ctx.beginPath(); ctx.arc(mx-mr*0.35,my-mr*0.45,1.2,0,6.2832); ctx.fill(); }
    } else if(sc.v===5){ // smashed crate
      ctx.fillStyle="#9a6a3a"; ctx.strokeStyle=C.ink; ctx.lineWidth=1.8;
      ctx.save(); ctx.rotate(-0.22); ctx.fillRect(-12,-3,17,5); ctx.strokeRect(-12,-3,17,5); ctx.restore(); // plank 1
      ctx.save(); ctx.rotate(0.3); ctx.fillStyle="#b07c46"; ctx.fillRect(-6,-1,16,5); ctx.strokeRect(-6,-1,16,5); ctx.restore(); // plank 2
      ctx.fillStyle="#7d5228"; ctx.fillRect(-4,-9,5,7); ctx.strokeRect(-4,-9,5,7); // upright shard
      ctx.beginPath(); ctx.moveTo(8,-6); ctx.lineTo(12,-9); ctx.lineTo(11,-4); ctx.closePath(); ctx.fillStyle="#9a6a3a"; ctx.fill(); ctx.stroke(); // splinter
      ctx.fillStyle="#5b6070"; ctx.fillRect(-10,-5.5,2,2); ctx.fillRect(4,2,2,2); // nails
    } else { // fallen robot head
      ctx.fillStyle="#b9c2d8"; ctx.beginPath(); ctx.roundRect(-10,-9,20,17,5); ctx.fill(); ctx.stroke();
      ctx.fillStyle="#2a2e3d"; ctx.beginPath(); ctx.roundRect(-7,-4,14,5,2.5); ctx.fill();
      const gl=0.4+0.4*Math.sin(anim*0.2+x); ctx.fillStyle="rgba(255,80,90,"+gl+")"; ctx.fillRect(-4,-3,3,3);
      ctx.strokeStyle=C.ink; ctx.lineWidth=1.8; ctx.beginPath(); ctx.moveTo(0,-9); ctx.lineTo(2,-14); ctx.stroke();
      ctx.fillStyle="#ffd23c"; ctx.beginPath(); ctx.arc(2,-15,2,0,6.2832); ctx.fill(); ctx.stroke();
      ctx.fillStyle="#8d97b0"; ctx.fillRect(-16,5,6,4); ctx.strokeRect(-16,5,6,4);
    }
    ctx.restore();
  } }
  function drawVases(){ for(const v of vases){ if(!v.alive) continue; const x=v.x, y=v.y;
    ctx.save();
    ctx.fillStyle="rgba(0,0,0,0.2)"; ctx.beginPath(); ctx.ellipse(x,y+12,10,3.4,0,0,6.2832); ctx.fill();
    const vr=spriteImg.vase, vsh=SPRITE_SHEETS.vase;
    if(vr&&vr.ok&&vsh.cols){ const frame=Math.floor(anim*0.11+(v.col*3+v.row*5))%vsh.cols, size=TILE*0.68;
      try{ ctx.drawImage(vr.img, frame*vsh.cell, 0, vsh.cell, vsh.cell, x-size/2, y-size/2, size, size); }catch(err){}
      ctx.restore(); continue; }
    const vb=bandRGB(); const potBody=vb?("rgb("+vb+")"):"#9aa5c0";
    ctx.fillStyle=potBody; ctx.strokeStyle=C.ink; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.ellipse(x,y+3,9,10,0,0,6.2832); ctx.fill(); ctx.stroke();
    ctx.fillStyle="rgba(255,255,255,0.22)"; ctx.beginPath(); ctx.ellipse(x-2,y,5,6,0,0,6.2832); ctx.fill(); // glaze light
    ctx.fillStyle=potBody; ctx.fillRect(x-4.5,y-11,9,5); ctx.fillStyle="rgba(0,0,0,0.22)"; ctx.fillRect(x-4.5,y-11,9,5); ctx.strokeRect(x-4.5,y-11,9,5);
    ctx.strokeStyle="#5d6885"; ctx.lineWidth=1.6; ctx.beginPath(); ctx.moveTo(x-6,y+2); ctx.quadraticCurveTo(x,y+5,x+6,y+2); ctx.stroke();
    ctx.fillStyle="rgba(255,255,255,0.5)"; ctx.beginPath(); ctx.arc(x-3.4,y-1,2.2,0,6.2832); ctx.fill();
    ctx.restore();
  } }
  function drawTorches(){ const rec=spriteImg.torch, sh=SPRITE_SHEETS.torch;
    if(!(rec&&rec.ok&&sh.cols)) return;
    const frame=Math.floor(anim*0.28)%sh.cols, cw=sh.cell, sz=TILE*0.66;
    ctx.save(); ctx.imageSmoothingEnabled=false;
    for(const tx of [2,5,8]){ const px=tx*TILE+TILE/2, py=TILE*0.62;
      const p=0.5+0.5*Math.sin(anim*0.31+tx); ctx.fillStyle="rgba(255,180,70,"+(0.10+0.10*p)+")";
      ctx.beginPath(); ctx.arc(px,py+sz*0.2,TILE*(0.75+0.12*p),0,6.2832); ctx.fill();
      try{ ctx.drawImage(rec.img, frame*cw, 0, cw, cw, px-sz/2, py-sz/2, sz, sz); }catch(err){}
    }
    ctx.restore();
  }
  function drawGenerators(){ for(const g of spawners){ if(!g.alive) continue; const x=g.x,y=g.y, pz=0.5+0.5*Math.sin(anim*0.3+g.col), sz=TILE*0.62;
    ctx.fillStyle="rgba(255,120,40,"+(0.12+0.14*pz)+")"; ctx.beginPath(); ctx.arc(x,y,sz*0.9,0,6.2832); ctx.fill();
    ctx.fillStyle="#3a3550"; ctx.strokeStyle=C.ink; ctx.lineWidth=3; ctx.fillRect(x-sz/2,y-sz/2,sz,sz); ctx.strokeRect(x-sz/2,y-sz/2,sz,sz);
    ctx.fillStyle="#211c34"; for(const cx of [-1,1]) for(const cy of [-1,1]) ctx.fillRect(x+cx*sz*0.36-1.6,y+cy*sz*0.36-1.6,3.2,3.2);
    ctx.strokeStyle="#ff9a3c"; ctx.lineWidth=2; ctx.strokeRect(x-sz*0.5,y-3,sz,6);
    ctx.fillStyle="rgba(255,140,50,"+(0.5+0.4*pz)+")"; ctx.beginPath(); ctx.arc(x,y,sz*0.26*(0.85+0.25*pz),0,6.2832); ctx.fill();
    ctx.fillStyle="#ffd23c"; ctx.beginPath(); ctx.arc(x,y,sz*0.12,0,6.2832); ctx.fill();
  } }
  function drawDropship(){ if(!dropship) return; const d=dropship; if(d.wait>0 && Math.floor(anim*0.3)%2 && d.wait>0.3) return; const x=d.x,y=d.y;
    ctx.fillStyle="rgba(0,0,0,0.14)"; ctx.beginPath(); ctx.ellipse(x,H-TILE*0.5,TILE*0.5,TILE*0.14,0,0,6.2832); ctx.fill();
    ctx.fillStyle="rgba(255,150,40,0.7)"; ctx.beginPath(); ctx.arc(x-d.dir*TILE*0.62,y+TILE*0.12,5+Math.sin(anim*0.8)*2,0,6.2832); ctx.fill();
    ctx.fillStyle="#5a6070"; ctx.strokeStyle=C.ink; ctx.lineWidth=3; ctx.beginPath(); ctx.ellipse(x,y,TILE*0.7,TILE*0.34,0,0,6.2832); ctx.fill(); ctx.stroke();
    ctx.fillStyle="#3a4150"; ctx.beginPath(); ctx.moveTo(x-d.dir*TILE*0.5,y-TILE*0.28); ctx.lineTo(x-d.dir*TILE*0.72,y-TILE*0.56); ctx.lineTo(x-d.dir*TILE*0.38,y-TILE*0.28); ctx.closePath(); ctx.fill(); ctx.strokeStyle=C.ink; ctx.lineWidth=2; ctx.stroke();
    ctx.fillStyle="#8fd0ff"; ctx.strokeStyle=C.ink; ctx.lineWidth=2; ctx.beginPath(); ctx.ellipse(x+d.dir*TILE*0.4,y-TILE*0.04,TILE*0.17,TILE*0.13,0,0,6.2832); ctx.fill(); ctx.stroke();
    ctx.fillStyle="#20242e"; ctx.fillRect(x-TILE*0.22,y+TILE*0.24,TILE*0.44,6);
  }
  function drawMushrooms(){ for(const m of mushrooms){ const k=m.t/m.life, sc=m.scale; const stemH=(0.3+k*1.5)*TILE*sc, capR=(0.3+k*0.85)*TILE*sc, topY=m.y-stemH;
    ctx.globalAlpha=Math.max(0,1-k);
    ctx.fillStyle="#ff8a2c"; ctx.strokeStyle=C.ink; ctx.lineWidth=3;
    ctx.beginPath(); ctx.moveTo(m.x-capR*0.24,m.y); ctx.lineTo(m.x-capR*0.12,topY); ctx.lineTo(m.x+capR*0.12,topY); ctx.lineTo(m.x+capR*0.24,m.y); ctx.closePath(); ctx.fill(); ctx.stroke();
    const bill=[[0,0,1],[-0.62,0.16,0.62],[0.62,0.16,0.62],[-0.32,-0.16,0.56],[0.32,-0.16,0.56]];
    for(const [bx,by,bs] of bill){ ctx.fillStyle="#ffb347"; ctx.beginPath(); ctx.arc(m.x+bx*capR, topY+by*capR, bs*capR*0.72,0,6.2832); ctx.fill(); ctx.strokeStyle=C.ink; ctx.lineWidth=3; ctx.stroke(); }
    ctx.fillStyle="#fff27a"; ctx.beginPath(); ctx.arc(m.x,topY,capR*0.4,0,6.2832); ctx.fill();
    ctx.globalAlpha=1;
  } }
  function drawHUD(){
    // hearts
    for(let i=0;i<maxHearts;i++){ const hx=14+i*26, hy=18; const on=i<hearts;
      ctx.fillStyle=on?C.hp:"#5a3a44"; ctx.strokeStyle=C.ink; ctx.lineWidth=2.5;
      ctx.beginPath(); ctx.moveTo(hx,hy+4); ctx.bezierCurveTo(hx,hy-3,hx-9,hy-3,hx-9,hy+3); ctx.bezierCurveTo(hx-9,hy+9,hx,hy+12,hx,hy+15);
      ctx.bezierCurveTo(hx,hy+12,hx+9,hy+9,hx+9,hy+3); ctx.bezierCurveTo(hx+9,hy-3,hx,hy-3,hx,hy+4); ctx.fill(); ctx.stroke(); }
    comic("FLOOR "+floor, W-12, 20, 24, C.paper, "right");
    comic(String(score).padStart(5,"0"), W-12, 44, 22, C.gold, "right");
    // ghost charges (little ghost pips under hearts)
    for(let i=0;i<ghostMax;i++){ const gx=18+i*20, gy=44, on=i<ghostCharges;
      ctx.globalAlpha=on?1:0.3; ctx.fillStyle=C.wisp; ctx.strokeStyle=C.ink; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(gx,gy-2,6,Math.PI,0,false); ctx.lineTo(gx+6,gy+5); ctx.lineTo(gx+3,gy+2); ctx.lineTo(gx,gy+5); ctx.lineTo(gx-3,gy+2); ctx.lineTo(gx-6,gy+5); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle=C.ink; ctx.beginPath(); ctx.arc(gx-2,gy-2,1.3,0,6.2832); ctx.arc(gx+2,gy-2,1.3,0,6.2832); ctx.fill(); ctx.globalAlpha=1; }
    // held nukes (mushroom-cloud icons)
    for(let i=0;i<maxNukes;i++){ const mx=18+i*20, my=64, on=i<nukesHeld; ctx.globalAlpha=on?1:0.28;
      ctx.fillStyle="#ffb347"; ctx.strokeStyle=C.ink; ctx.lineWidth=1.8; ctx.beginPath(); ctx.arc(mx,my,6.5,Math.PI,0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle="#ff8a2c"; ctx.fillRect(mx-2.5,my,5,6); ctx.strokeRect(mx-2.5,my,5,6);
      ctx.fillStyle="#fff27a"; ctx.beginPath(); ctx.arc(mx,my-1.5,2.4,0,6.2832); ctx.fill(); ctx.globalAlpha=1; }
    // active weapon timer
    if(weapon!=="laser" && weaponT>0){ comic(WLABEL[weapon]+" "+Math.ceil(weaponT)+"s", W/2, H-44, 16, PCOL[weapon]||C.portal2, "center"); }
    const left=enemies.length+toSpawn.length;
    if(phase==="play") comic((portal?"DIVE!":("ENEMIES "+left)), W/2, 20, 18, portal?C.portal2:C.paper, "center");
    if(killStreak>=3 && streakT>0){ comic(killStreak+"x COMBO!", W/2, H-22, 22, C.gold, "center"); }
  }
  function drawPopups(){ for(const p of popups){ const k=1-p.t/p.life; ctx.globalAlpha=Math.max(0,k); ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot);
    comic(p.txt,0,0,p.big?28:18,p.color,"center"); ctx.restore(); ctx.globalAlpha=1; } }
  function drawSparks(){ for(const s of sparks){ ctx.globalAlpha=Math.max(0,1-s.t/s.life); ctx.fillStyle=s.col; ctx.fillRect(s.x-2,s.y-2,4,4); } ctx.globalAlpha=1; }

  function render(){
    anim++;
    ctx.save();
    if(shake>0){ ctx.translate(R()*shake,R()*shake); }
    drawFloorAndWalls();
    drawPortal();
    drawWater();
    { const bc=bandRGB();
      if(bc){
        ctx.fillStyle="rgba("+bc+",0.10)"; ctx.fillRect(0,0,W,H);
        ctx.fillStyle="rgba("+bc+",0.22)";
        for(let ty=0;ty<SIZE;ty++) for(let tx=0;tx<SIZE;tx++) if(solid(tx,ty)) ctx.fillRect(tx*TILE,ty*TILE,TILE,TILE);
        const emb=0.5+0.5*Math.sin(anim*0.12); ctx.fillStyle="rgba("+bc+","+(0.02+0.03*emb)+")"; ctx.fillRect(0,0,W,H);
      }
    }
    drawDoors();
    drawTorches();
    drawGenerators();
    drawScraps();
    drawVases();
    drawMines();
    drawPickups();
    for(const b of bullets) drawBullet(b);
    for(const z of zaps){ const al=z.t/0.16; ctx.save(); ctx.globalAlpha=al;
      ctx.strokeStyle="#d9f7ff"; ctx.lineWidth=3.4; ctx.lineCap="round";
      const mx=(z.x1+z.x2)/2+(Math.random()*10-5), my=(z.y1+z.y2)/2+(Math.random()*10-5);
      ctx.beginPath(); ctx.moveTo(z.x1,z.y1); ctx.lineTo(mx,my); ctx.lineTo(z.x2,z.y2); ctx.stroke();
      ctx.strokeStyle="#7ce8ff"; ctx.lineWidth=1.6; ctx.stroke(); ctx.restore(); }
    for(const e of enemies) drawEnemy(e);
    drawEbullets();
    drawBlasts();
    drawSparks();
    if(player) drawPlayer();
    drawDropship();
    drawMushrooms();
    drawPopups();
    ctx.restore();
    const dread=Math.min(0.55,(THEME.dread||0)+floorLoop*0.12);
    if(dread>0){ ctx.fillStyle="rgba(8,5,14,"+dread*0.5+")"; ctx.fillRect(0,0,W,H); }
    if(flash>0){ ctx.fillStyle="rgba(216,74,84,"+(flash*0.30)+")"; ctx.fillRect(0,0,W,H); }
    drawHUD();
    if(bannerT>0 && phase==="play"){ const a=Math.min(1,bannerT*1.4); ctx.globalAlpha=Math.min(1,a);
      const by=Math.round(H*0.135); ctx.fillStyle="rgba(20,16,30,0.55)"; ctx.fillRect(0,by-24,W,48); comic(banner,W/2,by,30,C.gold,"center"); ctx.globalAlpha=1; }
    if(phase==="intro") drawIntro();
    if(phase==="over") drawOver();
    if(SPRITEGRID) drawSpriteDebug();
  }
  function panel(){ ctx.fillStyle="rgba(10,14,24,0.82)"; ctx.fillRect(0,0,W,H); }
  function drawIntro(){ panel();
    const tRec=spriteImg.title;
    if(tRec&&tRec.ok){ ctx.save(); ctx.imageSmoothingEnabled=false;
      ctx.fillStyle="#0d0a1c"; ctx.fillRect(0,0,W,H);
      try{ const iw=tRec.img.naturalWidth||W, ih=tRec.img.naturalHeight||H, sc=Math.min(W/iw,H/ih);
        ctx.drawImage(tRec.img,(W-iw*sc)/2,(H-ih*sc)/2,iw*sc,ih*sc); }catch(err){}
      ctx.restore();
      ctx.font="11px monospace"; ctx.fillStyle="#8fd0ff"; ctx.textAlign="right"; ctx.fillText("build 27 · M=music",W-8,H-10); ctx.textAlign="left";
      return; }
    comic("DUNGEON",W/2,H*0.17,52,C.gold,"center"); comic("WORLD",W/2,H*0.17+54,52,C.gold,"center");
    ctx.font='14px "Comic Neue",system-ui'; ctx.fillStyle=C.paper; ctx.textAlign="center";
    ctx.fillText("— an endless quantum arcade run —",W/2,H*0.17+82);
    const lines=["A tiny wizard with muscle arms & guns,","stranded on a living ALIEN dungeon-world.","","Blast the swarm. Smash the vases.","Dive each rift. Go GHOST to phase through —","but you only get a few charges!"];
    lines.forEach((l,i)=> ctx.fillText(l,W/2,H*0.47+i*21));
    const bl=0.55+0.45*Math.sin(anim*0.25); ctx.save(); ctx.globalAlpha=bl;
    comic("TAP / SPACE TO BEGIN",W/2,H*0.82,26,C.portal2,"center"); ctx.restore();
    comic("move + auto-aim · hold FIRE · SHIFT/G = phase · M = music",W/2,H*0.82+24,13,C.paper,"center");
    // --- art status line (diagnostics) ---
    ctx.font='11px monospace'; let sx=10; const order=["magical","demons","undead","tiles1","tiles2","tiles3","tiles4","tiles5"];
    for(const n of order){ const rec=spriteImg[n], on=rec&&rec.ok; ctx.fillStyle=on?"#7ae08a":"#ff5a6e"; ctx.textAlign="left";
      ctx.fillText((on?"●":"○")+n.replace("tiles","t"),sx,H-10); sx+=ctx.measureText((on?"●":"○")+n.replace("tiles","t")).width+10; }
    ctx.fillStyle="#8fd0ff"; ctx.textAlign="right"; ctx.fillText("build 27 · M=music",W-8,H-10); ctx.textAlign="left";
  }
  function drawOver(){ panel();
    const gRec=spriteImg.gameover;
    if(gRec&&gRec.ok){ ctx.save(); ctx.imageSmoothingEnabled=false;
      ctx.fillStyle="#0d0a1c"; ctx.fillRect(0,0,W,H);
      try{ const iw=gRec.img.naturalWidth||W, ih=gRec.img.naturalHeight||H, sc=Math.min(W/iw,H/ih);
        ctx.drawImage(gRec.img,(W-iw*sc)/2,(H-ih*sc)/2,iw*sc,ih*sc); }catch(err){}
      ctx.fillStyle="rgba(13,10,28,0.85)"; ctx.fillRect(0,H-58,W,58);
      comic("FLOOR "+floor+"  ·  SCORE "+score+"  ·  BEST "+best,W/2,H-36,18,C.gold,"center");
      const bl0=0.55+0.45*Math.sin(anim*0.25); ctx.globalAlpha=bl0;
      comic("TAP / SPACE TO RETRY",W/2,H-12,20,C.portal2,"center");
      ctx.restore(); return; }
    comic("GAME OVER",W/2,H*0.24,46,C.gold,"center");
    comic("THE WIZARD FELL",W/2,H*0.24+40,20,C.hp,"center");
    comic("FLOOR "+floor,W/2,H*0.48,30,C.paper,"center");
    comic("SCORE "+score,W/2,H*0.48+34,30,C.gold,"center");
    comic("BEST "+best,W/2,H*0.48+64,20,C.paper,"center");
    const bl=0.55+0.45*Math.sin(anim*0.25); ctx.save(); ctx.globalAlpha=bl;
    comic("TAP / SPACE TO RETRY",W/2,H*0.8,26,C.portal2,"center"); ctx.restore();
  }

  // ---------- lifecycle ----------
  function startOrRestart(){ floor=START_FLOOR; score=0; hearts=maxHearts; phase="play"; player=null; weapon="laser"; weaponT=0; ghostCharges=ghostMax; nukesHeld=0; continuesUsed=0; startFloor(); }

  let lastT=0;
  function frame(t){ const now=t/1000; let dt=lastT?now-lastT:0; lastT=now; if(dt>0.05)dt=0.05;
    if(phase==="play") update(dt); render(); requestAnimationFrame(frame); }
  requestAnimationFrame(frame);

  // ---------- public API for monetization.js / the native app shell ----------
  // Kept deliberately tiny: monetization.js (ads + IAP) never touches game
  // internals directly, it only calls these. That way the ad/IAP code can be
  // swapped, tested, or stripped out entirely without touching game logic.
  window.DungeonWorld = {
    getState(){ return { phase, score, best, floor, hearts, maxHearts, continuesUsed, maxFreeContinues:MAX_FREE_CONTINUES, fullUnlock:hasFullUnlock() }; },
    // Revives the player where they died (same floor/score) instead of a
    // full restart. Returns false (and does nothing) if called outside the
    // game-over state or once free continues are used up without a full
    // unlock — so it's safe to call even if UI/ad state gets out of sync.
    continueRun(){
      if(phase!=="over") return false;
      if(!hasFullUnlock() && continuesUsed>=MAX_FREE_CONTINUES) return false;
      continuesUsed++; hearts=maxHearts; dying=false; deathT=0; iframe=2.5; phase="play"; dwModalOpen=false;
      return true;
    },
    restart(){ dwModalOpen=false; startOrRestart(); },
    // monetization.js sets this true while its modal is open so the
    // existing "tap/space to restart" input handlers don't fire underneath it.
    setModalOpen(v){ dwModalOpen=!!v; },
    // Fired once per death, right when phase becomes "over".
    onGameOver(cb){ if(typeof cb==="function") gameOverListeners.push(cb); },
    // QA/testing only — forces a game-over without playing to death.
    _debugForceGameOver(){ if(!player) return false; phase="over"; dying=false; notifyGameOver(); return true; }
  };

})();
