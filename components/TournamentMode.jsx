// components/TournamentMode.jsx
// Single-elimination tournament bracket for 4 or 8 plants.
// Matches can be watched one-by-one or auto-simulated.

import { useState } from "react";
import { getBattleStats } from "./BattleSystem";
import { pickAttack, rolledMiss, rollStatus, applyStatusDot, rolledStunSkip } from "../lib/attacks";

const TYPE_MATCHUPS = {
  Herb:{strong:["Flower","Succulent"],weak:["Tree","Fruit"]},
  Flower:{strong:["Grass","Other"],weak:["Herb","Vegetable"]},
  Grass:{strong:["Vegetable"],weak:["Flower","Fruit"]},
  Vegetable:{strong:["Fruit","Grass"],weak:["Tree","Herb"]},
  Fruit:{strong:["Tree","Herb"],weak:["Vegetable","Grass"]},
  Tree:{strong:["Succulent","Grass"],weak:["Fruit","Flower"]},
  Succulent:{strong:["Herb","Flower"],weak:["Tree","Vegetable"]},
  Other:{strong:[],weak:[]},
};
function getMult(at,def){const c=TYPE_MATCHUPS[at]||TYPE_MATCHUPS.Other;return c.strong.includes(def)?2:c.weak.includes(def)?0.5:1;}

function quickSimulate(pA, pB) {
  const a={...getBattleStats(pA),id:pA.id,name:pA.name,type:pA.type,status:null,poisonStacks:1};
  const b={...getBattleStats(pB),id:pB.id,name:pB.name,type:pB.type,status:null,poisonStacks:1};
  let[atk,def]=a.speed>=b.speed?[a,b]:[b,a];
  for(let t=0;t<60&&a.hp>0&&b.hp>0;t++){
    if(!rolledStunSkip(atk.status)){
      const mv=pickAttack(atk.type,{});
      if(!rolledMiss(atk.speed,def.speed)){
        const m=getMult(atk.type,def.type);
        const dmg=Math.round(Math.max(1,atk.attack*(mv.power||1)-def.defense*0.4)*m*(0.85+Math.random()*0.3));
        def.hp=Math.max(0,def.hp-dmg);
        const ns=rollStatus(mv,def.status);
        if(ns)def.status=ns;
      }
    }
    if(def.hp<=0)break;
    for(const f of[a,b]){
      if(!f.status)continue;
      const{damage,newPoisonStacks}=applyStatusDot(f.hp,f.maxHp,f.status,f.poisonStacks);
      f.hp=Math.max(0,f.hp-damage);f.poisonStacks=newPoisonStacks;
      if(f.hp<=0)break;
    }
    if(a.hp<=0||b.hp<=0)break;
    [atk,def]=[def,atk];
  }
  return a.hp>0?pA:pB;
}

function buildBracket(participants) {
  // Seed by vigor descending — best plants on opposite sides
  const seeded=[...participants].sort((a,b)=>b.vigor-a.vigor);
  const n=seeded.length;
  // Pair 1v(n), 2v(n-1), etc for first round
  const round1=[];
  for(let i=0;i<n/2;i++) round1.push({p1:seeded[i],p2:seeded[n-1-i],winner:null});
  return[round1];
}

function getRoundName(roundIdx,totalRounds){
  const fromEnd=totalRounds-1-roundIdx;
  if(fromEnd===0)return"Final";
  if(fromEnd===1)return"Semi-finals";
  if(fromEnd===2)return"Quarter-finals";
  return`Round ${roundIdx+1}`;
}

const RARITY_COLOR={Common:"#78909c",Uncommon:"#43a047",Rare:"#1e88e5",Legendary:"#e65100"};

// ── Bracket visualisation ─────────────────────────────────────────────────────
function BracketCard({plant,isWinner,isLoser,dark}){
  if(!plant)return<div style={{height:52,borderRadius:9,border:`1.5px dashed ${dark?"#2a3e2a":"#c8e6c9"}`,background:dark?"#0e160e":"#f8fdf8",display:"flex",alignItems:"center",justifyContent:"center"}}>
    <span style={{fontSize:12,color:dark?"#3a5a3a":"#ccc"}}>TBD</span>
  </div>;
  const rarCol=RARITY_COLOR[plant.rarity]||"#78909c";
  const bg=isWinner?(dark?"#1a2e1a":"#e8f5e9"):isLoser?(dark?"#1e1010":"#fff8f8"):(dark?"#1a2a1c":"#fffdf8");
  const bord=isWinner?"#43a047":isLoser?"#e5393544":rarCol+"66";
  return<div style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",borderRadius:9,border:`1.5px solid ${bord}`,background:bg,opacity:isLoser?0.5:1}}>
    <span style={{fontSize:22,flexShrink:0}}>{plant.emoji}</span>
    <div style={{flex:1,overflow:"hidden"}}>
      <div style={{fontSize:11,fontWeight:700,color:dark?"#d4ecd4":"#1a1a1a",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{plant.name}</div>
      <div style={{fontSize:9,color:dark?"#4a6a4a":"#888"}}>⚡{plant.vigor} · {plant.type}</div>
    </div>
    {isWinner&&<span style={{fontSize:14}}>✓</span>}
    {isLoser&&<span style={{fontSize:12,color:"#e53935"}}>✗</span>}
  </div>;
}

// ── Main TournamentMode ───────────────────────────────────────────────────────
export default function TournamentMode({plants,onClose,onUpdatePlant,onAchievement,dark}){
  const[phase,setPhase]=useState("setup");   // setup|bracket|watching|complete
  const[size,setSize]=useState(4);
  const[selected,setSelected]=useState([]);
  const[rounds,setRounds]=useState([]);
  const[currentRoundIdx,setCurrentRoundIdx]=useState(0);
  const[currentMatchIdx,setCurrentMatchIdx]=useState(0);
  const[champion,setChampion]=useState(null);

  const bg=dark?"#141f14":"#fffdf8";
  const ts=dark?"#5a7a5a":"#666";
  const bd=dark?"#2a3e2a":"#e0e0e0";

  const totalRounds=Math.log2(size);

  const toggleSelect=(plant)=>{
    setSelected(prev=>{
      if(prev.find(p=>p.id===plant.id))return prev.filter(p=>p.id!==plant.id);
      if(prev.length>=size)return prev;
      return[...prev,plant];
    });
  };

  const startTournament=()=>{
    if(selected.length!==size)return;
    const bracket=buildBracket(selected);
    setRounds(bracket);
    setCurrentRoundIdx(0);
    setCurrentMatchIdx(0);
    setChampion(null);
    setPhase("bracket");
  };

  const simulateMatch=(roundIdx,matchIdx)=>{
    const match=rounds[roundIdx]?.[matchIdx];
    if(!match||!match.p1||!match.p2||match.winner)return;
    const winner=quickSimulate(match.p1,match.p2);
    const loser=match.p1.id===winner.id?match.p2:match.p1;
    // Update rounds
    const newRounds=rounds.map((r,ri)=>ri!==roundIdx?r:r.map((m,mi)=>mi!==matchIdx?m:{...m,winner}));
    // Check if round complete — build next round
    const roundDone=newRounds[roundIdx].every(m=>m.winner);
    let finalRounds=newRounds;
    if(roundDone){
      const winners=newRounds[roundIdx].map(m=>m.winner);
      if(winners.length===1){
        setChampion(winners[0]);
        setRounds(finalRounds);
        setCurrentRoundIdx(roundIdx);
        onUpdatePlant({...winner,wins:(winner.wins||0)+1});
        onUpdatePlant({...loser,losses:(loser.losses||0)+1});
        if(onAchievement) onAchievement({wonTournament:true,playerWon:true,totalWins:0,rankReached:0});
        setPhase("complete");
        return;
      }
      const nextRound=[];
      for(let i=0;i<winners.length;i+=2){
        if(winners[i+1])nextRound.push({p1:winners[i],p2:winners[i+1],winner:null});
      }
      finalRounds=[...newRounds,nextRound];
    }
    setRounds(finalRounds);
    // Always record — final match path has early return above, so no double-count
    onUpdatePlant({...winner,wins:(winner.wins||0)+1});
    onUpdatePlant({...loser,losses:(loser.losses||0)+1});
    // Advance current match pointer
    const nextMatchIdx=matchIdx+1;
    if(nextMatchIdx<finalRounds[roundIdx].length){
      setCurrentMatchIdx(nextMatchIdx);
    }else if(finalRounds.length>roundIdx+1){
      setCurrentRoundIdx(roundIdx+1);
      setCurrentMatchIdx(0);
    }
  };

  // ── SETUP ──
  if(phase==="setup")return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:16}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{width:560,maxHeight:"90vh",overflowY:"auto",background:bg,borderRadius:24,border:`2px solid ${bd}`,boxShadow:"0 24px 64px rgba(0,0,0,0.4)",fontFamily:"system-ui,sans-serif",overflow:"hidden"}}>
        <div style={{background:"linear-gradient(135deg,#e65100,#bf360c)",padding:"14px 18px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:16,fontWeight:800,color:"#fff"}}>🏆 Tournament</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.65)",marginTop:2}}>Single-elimination bracket — may the best plant win</div>
          </div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.15)",border:"none",borderRadius:"50%",width:28,height:28,cursor:"pointer",color:"#fff",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
        </div>
        <div style={{padding:"16px 18px 22px"}}>
          <div style={{marginBottom:16}}>
            <div style={{fontSize:11,fontWeight:700,color:ts,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8}}>Tournament size</div>
            <div style={{display:"flex",gap:8}}>
              {[4,8].map(n=><button key={n} onClick={()=>{setSize(n);setSelected([]);}} style={{flex:1,padding:"10px 0",borderRadius:11,border:`2px solid ${size===n?"#e65100":bd}`,background:size===n?(dark?"#2e1208":"#fff8f3"):(dark?"#141f14":"#fff"),color:size===n?"#e65100":ts,fontSize:13,fontWeight:700,cursor:"pointer"}}>{n} Plants</button>)}
            </div>
          </div>
          <div style={{fontSize:11,fontWeight:700,color:ts,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8}}>
            Select fighters ({selected.length}/{size})
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:8,marginBottom:16}}>
            {plants.map(p=>{
              const sel=selected.find(s=>s.id===p.id);
              const pos=sel?selected.indexOf(sel)+1:null;
              const rarCol=RARITY_COLOR[p.rarity]||"#78909c";
              const bs=getBattleStats(p);
              return<div key={p.id} onClick={()=>toggleSelect(p)} style={{borderRadius:12,overflow:"hidden",cursor:"pointer",border:`2px solid ${sel?rarCol:bd}`,background:sel?(dark?"#2e1208":"#fff8f3"):(dark?"#1a2a1c":"#fffdf8"),transition:"all 0.15s",position:"relative"}}>
                {sel&&<div style={{position:"absolute",top:4,right:4,width:18,height:18,background:"#e65100",borderRadius:"50%",fontSize:9,fontWeight:800,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center"}}>{pos}</div>}
                <div style={{height:72,background:dark?"#0e1a0e":"#e8f5e9",display:"flex",alignItems:"center",justifyContent:"center",fontSize:36}}>{p.emoji}</div>
                <div style={{padding:"6px 8px 8px"}}>
                  <div style={{fontSize:10,fontWeight:700,color:dark?"#d4ecd4":"#1a1a1a",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.name}</div>
                  <div style={{fontSize:9,color:rarCol}}>{p.rarity}</div>
                  <div style={{fontSize:9,color:ts,marginTop:2}}>⚡{bs.attack} 🛡{bs.defense}</div>
                </div>
              </div>;
            })}
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={startTournament} disabled={selected.length!==size} style={{flex:1,padding:"12px 0",background:selected.length===size?"linear-gradient(135deg,#e65100,#bf360c)":(dark?"#2a2a2a":"#e0e0e0"),border:"none",borderRadius:12,color:selected.length===size?"#fff":(dark?"#4a4a4a":"#aaa"),fontSize:14,fontWeight:800,cursor:selected.length===size?"pointer":"not-allowed"}}>
              {selected.length===size?"🏆 Start Tournament!":"Select all fighters"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // ── BRACKET / COMPLETE ──
  if(phase==="bracket"||phase==="complete")return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.82)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:16}} onClick={()=>{}}>
      <div style={{width:600,maxHeight:"92vh",overflowY:"auto",background:bg,borderRadius:24,border:`2px solid ${bd}`,boxShadow:"0 24px 64px rgba(0,0,0,0.5)",fontFamily:"system-ui,sans-serif",overflow:"hidden"}}>
        <div style={{background:phase==="complete"?"linear-gradient(135deg,#f57f17,#e65100)":"linear-gradient(135deg,#e65100,#bf360c)",padding:"14px 18px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:16,fontWeight:800,color:"#fff"}}>{phase==="complete"?"🏆 Tournament Complete!":"🏆 Tournament"}</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.65)",marginTop:2}}>
              {phase==="complete"?`Champion: ${champion?.name}`:`Round ${currentRoundIdx+1} of ${totalRounds}`}
            </div>
          </div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.15)",border:"none",borderRadius:"50%",width:28,height:28,cursor:"pointer",color:"#fff",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
        </div>

        {phase==="complete"&&champion&&(
          <div style={{background:"linear-gradient(135deg,#f57f17,#e65100)",padding:"20px",textAlign:"center",borderBottom:`1px solid ${bd}`}}>
            <div style={{fontSize:64,marginBottom:8}}>{champion.emoji}</div>
            <div style={{fontSize:22,fontWeight:900,color:"#fff"}}>{champion.name}</div>
            <div style={{fontSize:13,color:"rgba(255,255,255,0.8)",marginTop:4}}>Tournament Champion 🏆</div>
          </div>
        )}

        <div style={{padding:"16px 18px 24px"}}>
          {rounds.map((round,ri)=>(
            <div key={ri} style={{marginBottom:20}}>
              <div style={{fontSize:11,fontWeight:800,color:ts,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>
                {getRoundName(ri,rounds.length)}
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {round.map((match,mi)=>{
                  const loser=match.winner?(match.p1.id===match.winner.id?match.p2:match.p1):null;
                  const isCurrent=ri===currentRoundIdx&&mi===currentMatchIdx&&phase==="bracket";
                  return(
                    <div key={mi} style={{background:dark?"#0e1a0e":"#f8fdf8",borderRadius:12,border:`1.5px solid ${isCurrent?"#e65100":bd}`,padding:"10px 12px",boxShadow:isCurrent?"0 0 0 2px #e6510033":"none"}}>
                      <div style={{display:"flex",gap:8,alignItems:"center"}}>
                        <div style={{flex:1}}>
                          <BracketCard plant={match.p1} isWinner={match.winner?.id===match.p1?.id} isLoser={loser?.id===match.p1?.id} dark={dark}/>
                        </div>
                        <div style={{flexShrink:0,fontSize:11,fontWeight:700,color:ts}}>VS</div>
                        <div style={{flex:1}}>
                          <BracketCard plant={match.p2} isWinner={match.winner?.id===match.p2?.id} isLoser={loser?.id===match.p2?.id} dark={dark}/>
                        </div>
                        {!match.winner&&phase==="bracket"&&(
                          <button onClick={()=>simulateMatch(ri,mi)} style={{flexShrink:0,padding:"8px 12px",background:isCurrent?"linear-gradient(135deg,#e65100,#bf360c)":(dark?"#1e2e1e":"#f5f5f5"),border:`1px solid ${isCurrent?"#e65100":bd}`,borderRadius:9,color:isCurrent?"#fff":ts,fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>
                            {isCurrent?"⚔️ Fight":"Simulate"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {phase==="bracket"&&(
            <div style={{display:"flex",gap:8,marginTop:4}}>
              <button onClick={()=>{
                let r=[...rounds];let ri=currentRoundIdx;let mi=currentMatchIdx;
                const winDelta={};const lossDelta={};
                while(true){
                  const match=r[ri]?.[mi];
                  if(!match||match.winner)break;
                  if(!match.p1||!match.p2)break;
                  const winner=quickSimulate(match.p1,match.p2);
                  const loser=match.p1.id===winner.id?match.p2:match.p1;
                  r=r.map((round,rIdx)=>rIdx!==ri?round:round.map((m,mIdx)=>mIdx!==mi?m:{...m,winner}));
                  winDelta[winner.id]=(winDelta[winner.id]||0)+1;
                  lossDelta[loser.id]=(lossDelta[loser.id]||0)+1;
                  const roundDone=r[ri].every(m=>m.winner);
                  if(roundDone){
                    const winners=r[ri].map(m=>m.winner);
                    if(winners.length===1){setChampion(winners[0]);setRounds(r);setPhase("complete");return;}
                    const nextRound=[];
                    for(let i=0;i<winners.length-1;i+=2)nextRound.push({p1:winners[i],p2:winners[i+1],winner:null});
                    r=[...r,nextRound];ri++;mi=0;
                  }else{mi++;}
                  if(ri>=10)break;
                }
                setRounds(r);
                Object.entries(winDelta).forEach(([id,n])=>{const p=plants.find(x=>x.id===id);if(p)onUpdatePlant({...p,wins:(p.wins||0)+n});});
                Object.entries(lossDelta).forEach(([id,n])=>{const p=plants.find(x=>x.id===id);if(p)onUpdatePlant({...p,losses:(p.losses||0)+n});});
              }} style={{flex:1,padding:"10px 0",background:dark?"#1a2e1a":"#e8f5e9",border:`1px solid ${dark?"#2a3e2a":"#c8e6c9"}`,borderRadius:11,color:dark?"#7aaa7a":"#2e7d32",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                ⏭ Simulate All Remaining
              </button>
            </div>
          )}

          {phase==="complete"&&(
            <div style={{display:"flex",gap:8,marginTop:4}}>
              <button onClick={()=>{setPhase("setup");setSelected([]);setRounds([]);setChampion(null);}} style={{flex:1,padding:"10px 0",background:"linear-gradient(135deg,#e65100,#bf360c)",border:"none",borderRadius:11,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>New Tournament</button>
              <button onClick={onClose} style={{padding:"10px 16px",background:dark?"#1e2e1e":"#f0f0f0",border:`1px solid ${bd}`,borderRadius:11,color:ts,fontSize:12,cursor:"pointer"}}>Done</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return null;
}
