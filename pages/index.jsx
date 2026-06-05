import { useState, useRef, useEffect, useCallback } from "react";
import { getHealthScore, getHealthLabel } from "../lib/health";
import DiagnoseModal from "../components/DiagnoseModal";
import GardenMap from "../components/GardenMap";
import HealthChart from "../components/HealthChart";
import { getSupabase } from "../lib/supabase";
import AuthModal from "../components/AuthModal";
import LocationWidget from "../components/LocationWidget";
import { loadLocation, saveLocation, buildLocationContext, getSeasonAdvice, getFrostRisk, SEASON_EMOJI } from "../lib/location";
import { FREE_PLANT_LIMIT } from "../lib/stripe";

const TYPE_THEMES = {
  Vegetable: { primary: "#2e7d32", light: "#e8f5e9", darkLight: "#1a2e1a", accent: "#81c784", text: "#1b5e20", icon: "🥦" },
  Fruit:     { primary: "#e65100", light: "#fff8e1", darkLight: "#2e1e0a", accent: "#ffb74d", text: "#bf360c", icon: "🍑" },
  Herb:      { primary: "#6a1b9a", light: "#f3e5f5", darkLight: "#1e0a2e", accent: "#ce93d8", text: "#4a148c", icon: "🌿" },
  Flower:    { primary: "#ad1457", light: "#fce4ec", darkLight: "#2e0a1a", accent: "#f48fb1", text: "#880e4f", icon: "🌸" },
  Succulent: { primary: "#558b2f", light: "#f1f8e9", darkLight: "#192610", accent: "#aed581", text: "#33691e", icon: "🪴" },
  Tree:      { primary: "#5d4037", light: "#efebe9", darkLight: "#1e1410", accent: "#a1887f", text: "#3e2723", icon: "🌳" },
  Grass:     { primary: "#388e3c", light: "#e8f5e9", darkLight: "#122012", accent: "#a5d6a7", text: "#2e7d32", icon: "🌾" },
  Other:     { primary: "#455a64", light: "#eceff1", darkLight: "#141e22", accent: "#90a4ae", text: "#263238", icon: "🌱" },
};
const RARITY = {
  Common:    { color: "#78909c", stars: "★☆☆☆☆", glow: "none" },
  Uncommon:  { color: "#43a047", stars: "★★☆☆☆", glow: "0 0 12px #43a04744" },
  Rare:      { color: "#1e88e5", stars: "★★★☆☆", glow: "0 0 16px #1e88e544" },
  Legendary: { color: "#e65100", stars: "★★★★★", glow: "0 0 24px #e6510066" },
};
const JOURNAL_TYPES = [
  { id: "water",   label: "Watered",     emoji: "💧" },
  { id: "feed",    label: "Fertilised",  emoji: "🌿" },
  { id: "prune",   label: "Pruned",      emoji: "✂️" },
  { id: "harvest", label: "Harvested",   emoji: "🍎" },
  { id: "pest",    label: "Pest Alert",  emoji: "🐛" },
  { id: "note",    label: "Observation", emoji: "📝" },
];
const SAMPLE_PLANTS = [
  { id:"s1", name:"Cherry Tomato", species:"Solanum lycopersicum", type:"Vegetable", rarity:"Uncommon", emoji:"🍅", image:null, vigor:78, dateAdded:"2026-04-29", nextCareDate:null, journal:[], stats:{sunlight:88,water:62,difficulty:28}, details:{soilType:"Loamy, well-draining",pH:"6.2–6.8",harvestTime:"60–70 days",sunHours:"8+ hrs/day",spacing:'24"',funFact:"Botanically, tomatoes are both a fruit and a berry!",careNotes:"Water at soil level to prevent fungal disease."} },
  { id:"s2", name:"Lemon Basil", species:"Ocimum × citriodorum", type:"Herb", rarity:"Rare", emoji:"🌿", image:null, vigor:65, dateAdded:"2026-05-06", nextCareDate:null, journal:[], stats:{sunlight:75,water:72,difficulty:38}, details:{soilType:"Rich, moist loam",pH:"6.0–7.0",harvestTime:"3–4 weeks",sunHours:"6–8 hrs/day",spacing:'12"',funFact:"Its citrus scent comes from a compound also found in lemon rind.",careNotes:"Pinch flower buds to keep leaf production going."} },
  { id:"s3", name:"Giant Sunflower", species:"Helianthus annuus 'Titan'", type:"Flower", rarity:"Legendary", emoji:"🌻", image:null, vigor:95, dateAdded:"2026-04-22", nextCareDate:null, journal:[], stats:{sunlight:97,water:44,difficulty:15}, details:{soilType:"Sandy, well-draining",pH:"6.0–7.5",harvestTime:"80–100 days",sunHours:"6–8 hrs/day",spacing:'24"',funFact:"Young sunflowers track the sun as it moves!",careNotes:"Minimal watering once established. Stake tall varieties."} },
  { id:"s4", name:"Strawberry", species:"Fragaria × ananassa", type:"Fruit", rarity:"Common", emoji:"🍓", image:null, vigor:70, dateAdded:"2026-05-09", nextCareDate:null, journal:[], stats:{sunlight:80,water:78,difficulty:42}, details:{soilType:"Sandy loam, acidic",pH:"5.5–6.5",harvestTime:"60–90 days",sunHours:"6–10 hrs/day",spacing:'18"',funFact:"Strawberries are the only fruit with seeds on the outside!",careNotes:"Remove runners to encourage larger fruits."} },
];

function loadPlants() { try { const r=localStorage.getItem("gardendex_plants"); if(r) return JSON.parse(r); } catch{} return SAMPLE_PLANTS; }
function savePlants(p) { try { localStorage.setItem("gardendex_plants",JSON.stringify(p)); } catch{} }
function loadBeds() { try { const r=localStorage.getItem("gardendex_beds"); if(r) return JSON.parse(r); } catch{} return []; }
function saveBeds(b) { try { localStorage.setItem("gardendex_beds",JSON.stringify(b)); } catch{} }
function fmtDate(iso) { if(!iso) return "—"; const d=new Date(iso); return isNaN(d)?iso:d.toLocaleString(undefined,{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}); }
function fmtShort(iso) { if(!iso) return "—"; const d=new Date(iso); return isNaN(d)?"—":d.toLocaleDateString(undefined,{month:"short",day:"numeric"}); }
function isOverdue(d) { return d && new Date(d)<new Date(); }
function daysUntil(d) { if(!d) return null; return Math.ceil((new Date(d)-new Date())/(864e5)); }
function plantAge(dateAdded) {
  const days = Math.floor((Date.now() - new Date(dateAdded)) / 864e5);
  if (days < 7)  return `${days}d old`;
  if (days < 30) return `${Math.floor(days/7)}w old`;
  if (days < 365) return `${Math.floor(days/30)}mo old`;
  return `${Math.floor(days/365)}y old`;
}
function encodePlant(plant) { const {image,...rest}=plant; return btoa(unescape(encodeURIComponent(JSON.stringify(rest)))); }
function decodePlant(s) { try { return JSON.parse(decodeURIComponent(escape(atob(s)))); } catch{ return null; } }

// Compress image to max 400px wide, 0.7 quality JPEG before storing
function compressImage(dataUrl, callback) {
  const img = new Image();
  img.onload = () => {
    const MAX = 400;
    const scale = Math.min(1, MAX / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width  = Math.round(img.width  * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    callback(canvas.toDataURL("image/jpeg", 0.72));
  };
  img.onerror = () => callback(dataUrl); // fallback to original if compression fails
  img.src = dataUrl;
}

function StatBar({label,value,color,icon,dark}) {
  return (
    <div style={{marginBottom:7}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
        <span style={{fontSize:10,fontWeight:700,color:dark?"#7a9a7a":"#666",textTransform:"uppercase",letterSpacing:"0.07em"}}>{icon} {label}</span>
        <span style={{fontSize:11,fontWeight:700,color}}>{value}%</span>
      </div>
      <div style={{height:7,background:dark?"#2a3e2a":"#e8e8e8",borderRadius:4,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${value}%`,background:color,borderRadius:4}}/>
      </div>
    </div>
  );
}

function PlantCard({plant,onClick,dark}) {
  const theme=TYPE_THEMES[plant.type]||TYPE_THEMES.Other;
  const rar=RARITY[plant.rarity]||RARITY.Common;
  const [hovered,setHovered]=useState(false);
  const hasJournal=plant.journal?.length>0;
  const overdue=isOverdue(plant.nextCareDate);
  const days=daysUntil(plant.nextCareDate);
  const isLegendary=plant.rarity==="Legendary";
  const health=getHealthScore(plant);
  const healthInfo=getHealthLabel(health);

  return (
    <div
      onClick={()=>onClick(plant)}
      onMouseEnter={()=>setHovered(true)}
      onMouseLeave={()=>setHovered(false)}
      style={{
        maxWidth:210,flex:"0 0 auto",borderRadius:18,overflow:"hidden",
        background:dark?"#1a2a1c":"#fffdf8",
        border:`2.5px solid ${overdue?"#e53935":rar.color}`,
        boxShadow:hovered
          ?`0 10px 30px rgba(0,0,0,${dark?0.5:0.22}),${rar.glow}`
          :`0 3px 12px rgba(0,0,0,${dark?0.3:0.10}),${rar.glow}`,
        cursor:"pointer",
        transform:hovered?"translateY(-6px) rotate(-1.5deg) scale(1.03)":"none",
        transition:"all 0.25s cubic-bezier(.34,1.56,.64,1)",
        fontFamily:"system-ui,sans-serif",flexShrink:0,
        position:"relative",
      }}
    >
      {/* Legendary foil shimmer overlay */}
      {isLegendary&&(
        <div style={{position:"absolute",inset:0,zIndex:2,pointerEvents:"none",borderRadius:16,background:"linear-gradient(135deg,rgba(255,215,0,0.08) 0%,rgba(255,100,200,0.06) 30%,rgba(100,200,255,0.08) 60%,rgba(255,215,0,0.06) 100%)",animation:"foil-shimmer 3s ease-in-out infinite"}}/>
      )}
      <style>{`@keyframes foil-shimmer{0%,100%{opacity:0.4}50%{opacity:1}}`}</style>

      <div style={{background:dark?`linear-gradient(135deg,${theme.darkLight},${theme.primary}30)`:`linear-gradient(135deg,${theme.light},${theme.primary}20)`,borderBottom:`2.5px solid ${theme.primary}40`,height:8}}/>
      <div style={{height:140,background:dark?`linear-gradient(160deg,${theme.darkLight},${theme.primary}25)`:`linear-gradient(160deg,${theme.light},${theme.primary}15)`,display:"flex",alignItems:"center",justifyContent:"center",position:"relative",overflow:"hidden"}}>
        {plant.image?<img src={plant.image} alt={plant.name} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontSize:72,filter:"drop-shadow(0 4px 8px rgba(0,0,0,0.2))",lineHeight:1}}>{plant.emoji||"🌱"}</span>}
        <div style={{position:"absolute",top:10,left:10,background:theme.primary,color:"#fff",fontSize:9,fontWeight:800,padding:"3px 9px",borderRadius:20,textTransform:"uppercase",letterSpacing:"0.08em"}}>{theme.icon} {plant.type}</div>
        <div style={{position:"absolute",bottom:10,right:10,background:"rgba(0,0,0,0.75)",color:"#ffd54f",fontSize:10,fontWeight:800,padding:"4px 10px",borderRadius:12}}>⚡ {plant.vigor}</div>
        {overdue&&<div style={{position:"absolute",top:10,right:10,background:"#e53935",color:"#fff",fontSize:9,fontWeight:800,padding:"3px 8px",borderRadius:10}}>⚠ DUE</div>}
        {!overdue&&days!==null&&days<=2&&<div style={{position:"absolute",top:10,right:10,background:"#f57c00",color:"#fff",fontSize:9,fontWeight:800,padding:"3px 8px",borderRadius:10}}>🔔 {days===0?"Today":`${days}d`}</div>}
        {hasJournal&&!overdue&&(days===null||days>2)&&<div style={{position:"absolute",bottom:10,left:10,background:"rgba(0,0,0,0.65)",color:"#81c784",fontSize:9,fontWeight:800,padding:"4px 8px",borderRadius:10}}>📓 {plant.journal.length}</div>}
      </div>
      <div style={{padding:"10px 14px 6px",borderBottom:`1px solid ${dark?"#2a3e2a":theme.light}`}}>
        <div style={{fontSize:15,fontWeight:700,color:dark?"#d4ecd4":"#1a1a1a",lineHeight:1.1,marginBottom:2}}>{plant.name}</div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontSize:9,color:dark?"#4a6a4a":"#888",fontStyle:"italic",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{plant.species}</div>
          <div style={{fontSize:9,color:dark?"#4a6a4a":"#aaa",flexShrink:0,marginLeft:6}}>{plantAge(plant.dateAdded)}</div>
        </div>
      </div>
      <div style={{padding:"8px 14px 4px"}}>
        <StatBar label="Sun" value={plant.stats?.sunlight||0} color="#f9a825" icon="☀" dark={dark}/>
        <StatBar label="Water" value={plant.stats?.water||0} color="#1e88e5" icon="💧" dark={dark}/>
        <StatBar label="Difficulty" value={plant.stats?.difficulty||0} color="#e53935" icon="⚠" dark={dark}/>
      </div>
      {/* Health bar */}
      <div style={{padding:"0 14px 6px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:2}}>
          <span style={{fontSize:9,fontWeight:700,color:healthInfo.color,textTransform:"uppercase",letterSpacing:"0.06em"}}>{healthInfo.icon} {healthInfo.label}</span>
          <span style={{fontSize:9,color:dark?"#3a5a3a":"#aaa"}}>{health}%</span>
        </div>
        <div style={{height:4,background:dark?"#2a3e2a":"#e8e8e8",borderRadius:2,overflow:"hidden"}}>
          <div style={{height:"100%",width:`${health}%`,background:healthInfo.color,borderRadius:2,transition:"width 0.5s"}}/>
        </div>
      </div>
      <div style={{padding:"6px 14px 10px",display:"flex",justifyContent:"space-between",alignItems:"center",borderTop:`1px dashed ${theme.primary}44`}}>
        <span style={{fontSize:12,color:rar.color,letterSpacing:"2px"}}>{rar.stars}</span>
        <div style={{display:"flex",gap:5,alignItems:"center"}}>
        </div>
      </div>
    </div>
  );
}

function PlantDetail({plant,onClose,onDelete,onUpdate,dark,allPlants=[],onNavigate,collection=[],locationContext=null,userId=null}) {
  const touchRef=useRef(null);
  const idx=allPlants.findIndex(p=>p.id===plant.id);
  const goPrev=()=>{if(idx>0&&onNavigate)onNavigate(allPlants[idx-1]);};
  const goNext=()=>{if(idx<allPlants.length-1&&onNavigate)onNavigate(allPlants[idx+1]);};
  const onTouchStart=e=>{touchRef.current={x:e.touches[0].clientX,y:e.touches[0].clientY};};
  const onTouchEnd=e=>{if(!touchRef.current)return;const dx=e.changedTouches[0].clientX-touchRef.current.x;const dy=e.changedTouches[0].clientY-touchRef.current.y;touchRef.current=null;if(Math.abs(dx)<50||Math.abs(dy)>Math.abs(dx))return;if(dx<0)goNext();else goPrev();};
  useEffect(()=>{const h=e=>{if(e.key==="ArrowLeft")goPrev();if(e.key==="ArrowRight")goNext();};document.addEventListener("keydown",h);return()=>document.removeEventListener("keydown",h);},[idx]);// eslint-disable-line react-hooks/exhaustive-deps
  const [tab,setTab]=useState("overview");
  const [journalInput,setJournalInput]=useState("");
  const [journalType,setJournalType]=useState("note");
  const [confirmDelete,setConfirmDelete]=useState(false);
  const [shareMsg,setShareMsg]=useState("");
  const [showDiagnose,setShowDiagnose]=useState(false);
  const [loadingCompanions,setLoadingCompanions]=useState(false);
  const [companionError,setCompanionError]=useState("");
  const [editName,setEditName]=useState(plant.name);
  const [editSpecies,setEditSpecies]=useState(plant.species);
  const [editEmoji,setEditEmoji]=useState(plant.emoji||"🌱");
  const [editCareNotes,setEditCareNotes]=useState(plant.details?.careNotes||"");
  const [editFunFact,setEditFunFact]=useState(plant.details?.funFact||"");
  const [editNextCare,setEditNextCare]=useState(plant.nextCareDate?plant.nextCareDate.slice(0,10):"");
  if(!plant) return null;
  const theme=TYPE_THEMES[plant.type]||TYPE_THEMES.Other;
  const rar=RARITY[plant.rarity]||RARITY.Common;
  const overdue=isOverdue(plant.nextCareDate);
  const days=daysUntil(plant.nextCareDate);
  const bg=dark?"#141f14":"#fffdf8";
  const textPrimary=dark?"#d4ecd4":"#1a1a1a";
  const textSecondary=dark?"#5a7a5a":"#666";
  const borderColor=dark?"#2a3e2a":"#e0e0e0";
  const inputBg=dark?"#0e160e":"#f8f8f8";
  const addEntry=()=>{
    if(!journalInput.trim()) return;
    const t=JOURNAL_TYPES.find(x=>x.id===journalType)||JOURNAL_TYPES[5];
    onUpdate({...plant,journal:[{id:Date.now().toString(),text:journalInput.trim(),type:journalType,emoji:t.emoji,timestamp:new Date().toISOString()},...(plant.journal||[])]});
    setJournalInput("");
  };
  const saveEdit=()=>{
    onUpdate({...plant,name:editName.trim()||plant.name,species:editSpecies.trim()||plant.species,emoji:editEmoji||plant.emoji,nextCareDate:editNextCare?(editNextCare+"T12:00:00"):null,details:{...plant.details,careNotes:editCareNotes,funFact:editFunFact}});
    setTab("overview");
  };
  const fetchCompanions=async()=>{
    setLoadingCompanions(true);setCompanionError("");
    try{
      const res=await fetch("/api/companion-plants",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:plant.name,species:plant.species,locationContext})});
      const data=await res.json();
      if(!res.ok)throw new Error(data.error||"Failed to load companions");
      onUpdate({...plant,companions:data.companions});
    }catch(e){setCompanionError(e.message||"Could not load companion data");}
    finally{setLoadingCompanions(false);}
  };
  const handleShare=()=>{
    const url=`${window.location.origin}${window.location.pathname}?plant=${encodePlant(plant)}`;
    navigator.clipboard?.writeText(url).catch(()=>{});
    setShareMsg("✓ Link copied!"); setTimeout(()=>setShareMsg(""),2500);
  };
  const TabBtn=({id,label})=><button onClick={()=>setTab(id)} style={{flex:1,padding:"9px 0",border:"none",borderRadius:10,background:tab===id?theme.primary:"transparent",color:tab===id?"#fff":textSecondary,fontSize:12,fontWeight:700,cursor:"pointer",transition:"all 0.15s"}}>{label}</button>;
  return (
    <>
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.72)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:20}} onClick={onClose} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {idx>0&&<button onClick={e=>{e.stopPropagation();goPrev();}} style={{position:"fixed",left:8,top:"50%",transform:"translateY(-50%)",background:"rgba(0,0,0,0.55)",border:"none",color:"#fff",fontSize:28,cursor:"pointer",borderRadius:14,padding:"10px 14px",zIndex:102,lineHeight:1}}>‹</button>}
      {idx>=0&&idx<allPlants.length-1&&<button onClick={e=>{e.stopPropagation();goNext();}} style={{position:"fixed",right:8,top:"50%",transform:"translateY(-50%)",background:"rgba(0,0,0,0.55)",border:"none",color:"#fff",fontSize:28,cursor:"pointer",borderRadius:14,padding:"10px 14px",zIndex:102,lineHeight:1}}>›</button>}
      {allPlants.length>1&&<div style={{position:"fixed",bottom:18,left:"50%",transform:"translateX(-50%)",background:"rgba(0,0,0,0.5)",borderRadius:20,padding:"5px 14px",color:"#fff",fontSize:11,fontWeight:600,zIndex:102,pointerEvents:"none"}}>{idx+1} / {allPlants.length}</div>}
      <div onClick={e=>e.stopPropagation()} style={{width:480,maxHeight:"90vh",overflowY:"auto",background:bg,borderRadius:24,border:`3px solid ${overdue?"#e53935":rar.color}`,boxShadow:`0 20px 60px rgba(0,0,0,${dark?0.6:0.35}),${rar.glow}`,fontFamily:"system-ui,sans-serif"}}>
        <div style={{height:190,position:"relative",overflow:"hidden",background:dark?`linear-gradient(160deg,${theme.darkLight},${theme.primary}40)`:`linear-gradient(160deg,${theme.light},${theme.primary}30)`,borderRadius:"21px 21px 0 0"}}>
          {plant.image?<img src={plant.image} alt={plant.name} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%"}}><span style={{fontSize:90}}>{plant.emoji||"🌱"}</span></div>}
          <div style={{position:"absolute",bottom:0,left:0,right:0,background:"linear-gradient(to top,rgba(0,0,0,0.75),transparent)",padding:"20px 20px 14px"}}>
            <div style={{fontSize:20,fontWeight:800,color:"#fff"}}>{plant.name}</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.7)",fontStyle:"italic"}}>{plant.species}</div>
          </div>
          <button onClick={onClose} style={{position:"absolute",top:12,right:12,background:"rgba(0,0,0,0.45)",border:"none",borderRadius:"50%",width:30,height:30,cursor:"pointer",color:"#fff",fontSize:15,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
          <div style={{position:"absolute",top:12,left:12,display:"flex",gap:6,flexWrap:"wrap"}}>
            <span style={{background:theme.primary,color:"#fff",fontSize:9,fontWeight:800,padding:"3px 9px",borderRadius:20,textTransform:"uppercase",letterSpacing:"0.07em"}}>{theme.icon} {plant.type}</span>
            <span style={{background:rar.color,color:"#fff",fontSize:9,fontWeight:800,padding:"3px 9px",borderRadius:20,textTransform:"uppercase",letterSpacing:"0.07em"}}>{plant.rarity}</span>
            {overdue&&<span style={{background:"#e53935",color:"#fff",fontSize:9,fontWeight:800,padding:"3px 9px",borderRadius:20,textTransform:"uppercase"}}>⚠ Care Overdue</span>}
          </div>
        </div>
        {plant.nextCareDate&&(
          <div style={{background:overdue?"#e53935":days<=2?"#f57c00":theme.primary,padding:"10px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{color:"#fff",fontSize:12,fontWeight:700}}>{overdue?"⚠ Care overdue!":`🔔 Care due ${days===0?"today":`in ${days} day${days===1?"":"s"}`}`} — {fmtShort(plant.nextCareDate)}</span>
            <button onClick={()=>onUpdate({...plant,nextCareDate:null})} style={{background:"rgba(255,255,255,0.25)",border:"none",borderRadius:8,padding:"4px 12px",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer"}}>✓ Done</button>
          </div>
        )}
        <div style={{display:"flex",gap:4,padding:"12px 20px 4px",background:dark?"#1a2a1c":"#f6f6f0",borderBottom:`1px solid ${borderColor}`}}>
          <TabBtn id="overview" label="📊 Overview"/>
          <TabBtn id="health"   label="📈 Health"/>
          <TabBtn id="journal"  label={`📓 Journal${plant.journal?.length?` (${plant.journal.length})`:""}`}/>
          <TabBtn id="diagnose" label="🔬 Diagnose"/>
          <TabBtn id="edit"     label="✏️ Edit"/>
        </div>
        <div style={{padding:"18px 22px 24px"}}>
          {tab==="overview"&&<>
            <div style={{background:`linear-gradient(135deg,${theme.primary},${theme.primary}88)`,borderRadius:12,padding:"11px 16px",marginBottom:18,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{color:"#fff",fontWeight:700,fontSize:12}}>⚡ VIGOR RATING</span>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:90,height:9,background:"rgba(255,255,255,0.25)",borderRadius:5,overflow:"hidden"}}><div style={{width:`${plant.vigor}%`,height:"100%",background:"#ffd54f",borderRadius:5}}/></div>
                <span style={{color:"#ffd54f",fontWeight:800,fontSize:15}}>{plant.vigor}</span>
              </div>
            </div>
            <div style={{marginBottom:18}}>
              <div style={{fontSize:10,fontWeight:700,color:textSecondary,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:10}}>Growth Stats</div>
              <StatBar label="Sunlight" value={plant.stats?.sunlight||0} color="#f9a825" icon="☀" dark={dark}/>
              <StatBar label="Water Needs" value={plant.stats?.water||0} color="#1e88e5" icon="💧" dark={dark}/>
              <StatBar label="Difficulty" value={plant.stats?.difficulty||0} color="#e53935" icon="⚠" dark={dark}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
              {[{label:"Soil Type",value:plant.details?.soilType||"—",icon:"🪱"},{label:"pH Range",value:plant.details?.pH||"—",icon:"⚗️"},{label:"Harvest Time",value:plant.details?.harvestTime||"—",icon:"🗓️"},{label:"Sun Hours",value:plant.details?.sunHours||"—",icon:"☀️"},{label:"Spacing",value:plant.details?.spacing||"—",icon:"📐"},{label:"Rarity",value:rar.stars,icon:""}].map(({label,value,icon})=>(
                <div key={label} style={{background:dark?theme.darkLight:theme.light,borderRadius:10,padding:"9px 11px",border:`1px solid ${theme.primary}${dark?"44":"22"}`}}>
                  <div style={{fontSize:9,color:dark?theme.accent:theme.text,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:3}}>{icon} {label}</div>
                  <div style={{fontSize:12,fontWeight:600,color:dark?"#c8e4c8":"#2a2a2a"}}>{value}</div>
                </div>
              ))}
            </div>
            <div style={{background:dark?"#1e1a08":"#fffbe6",border:`1.5px solid ${dark?"#4a3a00":"#ffe082"}`,borderRadius:10,padding:"12px 14px",marginBottom:12}}>
              <div style={{fontSize:10,fontWeight:700,color:dark?"#c8a020":"#f57f17",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:5}}>🌟 Fun Fact</div>
              <div style={{fontSize:12,color:dark?"#c8b86a":"#5d4037",lineHeight:1.6}}>{plant.details?.funFact||"No fun fact available."}</div>
            </div>
            <div style={{background:dark?theme.darkLight:theme.light,border:`1.5px solid ${theme.primary}${dark?"55":"33"}`,borderRadius:10,padding:"12px 14px",marginBottom:16}}>
              <div style={{fontSize:10,fontWeight:700,color:dark?theme.accent:theme.text,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:5}}>🌿 Care Note</div>
              <div style={{fontSize:12,color:dark?"#a8c8a8":"#333",lineHeight:1.6}}>{plant.details?.careNotes||"No care notes available."}</div>
            </div>

            {/* ── Companion Planting ─────────────────────────────────────── */}
            <div style={{background:dark?"#0e1a10":"#f1faf1",border:`1.5px solid ${dark?"#1e3a1e":"#a5d6a7"}`,borderRadius:10,padding:"14px 16px",marginBottom:16}}>
              <div style={{fontSize:10,fontWeight:700,color:dark?"#81c784":"#2e7d32",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:10}}>🌱 Companion Planting</div>
              {plant.companions?(
                <>
                  {plant.companions.tip&&<div style={{fontSize:11,color:dark?"#7aaa7a":"#388e3c",background:dark?"#142014":"#e8f5e9",borderRadius:8,padding:"8px 11px",marginBottom:12,lineHeight:1.5}}>💡 {plant.companions.tip}</div>}
                  <div style={{marginBottom:12}}>
                    <div style={{fontSize:10,fontWeight:700,color:"#2e7d32",marginBottom:6}}>✅ Plant nearby</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                      {(plant.companions.good||[]).map(name=>{
                        const inColl=collection.some(p=>p.name.toLowerCase().includes(name.toLowerCase())||name.toLowerCase().includes(p.name.toLowerCase()));
                        const reason=plant.companions.goodReasons?.[name];
                        return(
                          <span key={name} title={reason||""} style={{background:inColl?"#e8f5e9":(dark?"#1a2a1c":"#f5f5f5"),border:`1px solid ${inColl?"#66bb6a":(dark?"#2a3e2a":"#ddd")}`,borderRadius:8,padding:"3px 10px",fontSize:11,color:inColl?"#1b5e20":(dark?"#7aaa7a":"#555"),cursor:reason?"help":"default"}}>
                            {inColl?"✓ ":""}{name}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <div style={{fontSize:10,fontWeight:700,color:"#c62828",marginBottom:6}}>⛔ Keep away from</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                      {(plant.companions.bad||[]).map(name=>{
                        const inColl=collection.some(p=>p.name.toLowerCase().includes(name.toLowerCase())||name.toLowerCase().includes(p.name.toLowerCase()));
                        const reason=plant.companions.badReasons?.[name];
                        return(
                          <span key={name} title={reason||""} style={{background:inColl?"#ffebee":(dark?"#1a1010":"#f5f5f5"),border:`1px solid ${inColl?"#e57373":(dark?"#3a2020":"#ddd")}`,borderRadius:8,padding:"3px 10px",fontSize:11,color:inColl?"#c62828":(dark?"#888":"#555"),cursor:reason?"help":"default"}}>
                            {inColl?"⚠️ ":""}{name}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <button onClick={()=>onUpdate({...plant,companions:null})} style={{marginTop:10,background:"none",border:"none",cursor:"pointer",fontSize:10,color:dark?"#3a5a3a":"#aaa",textDecoration:"underline"}}>Refresh companions</button>
                </>
              ):(
                <div>
                  {companionError&&<div style={{fontSize:11,color:"#e53935",marginBottom:8}}>⚠ {companionError}</div>}
                  <button onClick={fetchCompanions} disabled={loadingCompanions} style={{width:"100%",padding:"9px 0",background:"none",border:`1.5px solid ${dark?"#1e3a1e":"#a5d6a7"}`,borderRadius:9,color:dark?"#66bb6a":"#2e7d32",fontSize:12,fontWeight:700,cursor:loadingCompanions?"wait":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:7}}>
                    {loadingCompanions?<><span style={{width:13,height:13,border:"2px solid #2e7d32",borderTopColor:"transparent",borderRadius:"50%",display:"inline-block",animation:"spin 0.7s linear infinite"}}/> Loading...</>:"🌱 Get Companion Suggestions"}
                  </button>
                </div>
              )}
            </div>

            {/* Battle record */}
            {((plant.wins||0)+(plant.losses||0))>0&&(
              <div style={{background:dark?"#1a0e0e":"#fff8f8",border:`1.5px solid ${dark?"#5a2020":"#ffcdd2"}`,borderRadius:10,padding:"12px 14px",marginBottom:16}}>
                <div style={{fontSize:10,fontWeight:700,color:dark?"#e57373":"#c62828",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8}}>⚔️ Battle Record</div>
                <div style={{display:"flex",gap:12,alignItems:"center"}}>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontSize:22,fontWeight:900,color:"#43a047"}}>{plant.wins||0}</div>
                    <div style={{fontSize:10,color:dark?"#5a7a5a":"#888",fontWeight:600}}>Wins</div>
                  </div>
                  <div style={{flex:1,height:8,background:dark?"#2a2a2a":"#e0e0e0",borderRadius:4,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${Math.round(((plant.wins||0)/((plant.wins||0)+(plant.losses||0)))*100)}%`,background:"#43a047",borderRadius:4}}/>
                  </div>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontSize:22,fontWeight:900,color:"#e53935"}}>{plant.losses||0}</div>
                    <div style={{fontSize:10,color:dark?"#5a7a5a":"#888",fontWeight:600}}>Losses</div>
                  </div>
                </div>
                <div style={{textAlign:"center",marginTop:6,fontSize:11,color:dark?"#7a9a7a":"#666",fontWeight:600}}>
                  {Math.round(((plant.wins||0)/((plant.wins||0)+(plant.losses||0)))*100)}% win rate
                </div>
              </div>
            )}
            <button onClick={handleShare} style={{width:"100%",padding:"10px 0",background:"none",border:`1.5px solid ${dark?"#2a3e2a":"#c8e6c9"}`,borderRadius:10,color:dark?"#7aaa7a":"#2e7d32",fontSize:12,fontWeight:700,cursor:"pointer",transition:"background 0.15s"}} onMouseEnter={e=>e.currentTarget.style.background=dark?"#1a2e1a":"#e8f5e9"} onMouseLeave={e=>e.currentTarget.style.background="none"}>
              {shareMsg||"🔗 Copy Shareable Link"}
            </button>
          </>}
          {tab==="health"&&<HealthChart plant={plant} dark={dark}/>}
          {tab==="journal"&&<>
            <div style={{marginBottom:18}}>
              <div style={{fontSize:11,fontWeight:700,color:textSecondary,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>Log Entry</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
                {JOURNAL_TYPES.map(t=>(
                  <button key={t.id} onClick={()=>setJournalType(t.id)} style={{padding:"5px 10px",borderRadius:20,border:`1.5px solid ${journalType===t.id?theme.primary:(dark?"#2a3e2a":"#c8e6c9")}`,background:journalType===t.id?theme.primary:(dark?"#141f14":"#fff"),color:journalType===t.id?"#fff":textSecondary,fontSize:11,fontWeight:600,cursor:"pointer",transition:"all 0.15s"}}>
                    {t.emoji} {t.label}
                  </button>
                ))}
              </div>
              <textarea value={journalInput} onChange={e=>setJournalInput(e.target.value)} placeholder="Add notes..." rows={3} style={{width:"100%",padding:"10px 12px",borderRadius:10,border:`1.5px solid ${dark?"#2a3e2a":"#c8e6c9"}`,background:inputBg,color:textPrimary,fontSize:13,resize:"vertical",outline:"none",boxSizing:"border-box",fontFamily:"system-ui,sans-serif"}}/>
              <button onClick={addEntry} disabled={!journalInput.trim()} style={{marginTop:8,padding:"9px 18px",background:journalInput.trim()?`linear-gradient(135deg,${theme.primary},${theme.primary}88)`:(dark?"#1e2e1e":"#e0e0e0"),border:"none",borderRadius:10,color:journalInput.trim()?"#fff":textSecondary,fontSize:13,fontWeight:700,cursor:journalInput.trim()?"pointer":"not-allowed"}}>+ Log Entry</button>
            </div>
            {!plant.journal?.length?(
              <div style={{textAlign:"center",padding:"28px 0",color:textSecondary,fontSize:13}}><div style={{fontSize:36,marginBottom:8}}>📓</div>No entries yet.</div>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {plant.journal.map(entry=>(
                  <div key={entry.id} style={{background:dark?"#1a2a1c":"#f8fdf8",border:`1px solid ${dark?"#2a3e2a":"#c8e6c9"}`,borderRadius:10,padding:"11px 14px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                      <div style={{flex:1}}>
                        <span style={{fontSize:11,fontWeight:700,color:theme.primary,marginRight:6}}>{entry.emoji} {JOURNAL_TYPES.find(t=>t.id===entry.type)?.label||"Note"}</span>
                        <div style={{fontSize:13,color:dark?"#c8e4c8":"#2a2a2a",lineHeight:1.55,marginTop:3}}>{entry.text}</div>
                      </div>
                      <button onClick={()=>onUpdate({...plant,journal:(plant.journal||[]).filter(e=>e.id!==entry.id)})} style={{background:"none",border:"none",cursor:"pointer",color:dark?"#4a6a4a":"#bbb",fontSize:14,padding:"0 2px",flexShrink:0}}>✕</button>
                    </div>
                    <div style={{fontSize:10,color:textSecondary,marginTop:6,fontWeight:600}}>🕐 {fmtDate(entry.timestamp)}</div>
                  </div>
                ))}
              </div>
            )}
          </>}
          {tab==="diagnose"&&<>
            <div style={{background:dark?"#1a1e2e":"#e8eaf6",border:`1.5px solid ${dark?"#2a3060":"#c5cae9"}`,borderRadius:12,padding:"14px 16px",marginBottom:16}}>
              <div style={{fontSize:14,fontWeight:700,color:dark?"#9fa8da":"#1a237e",marginBottom:6}}>🔬 Disease & Pest Diagnosis</div>
              <div style={{fontSize:12,color:dark?"#5a6a9a":"#555",lineHeight:1.65,marginBottom:14}}>
                Take or upload a close-up photo of any problem area — discolouration, spots, wilting, insects, or unusual growth. AI will identify the issue and give you a step-by-step treatment plan.
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
                {[["🦠","Diseases","Mildew, blight, rot"],["🐛","Pests","Insects, mites, aphids"],["🌿","Deficiencies","Nutrient & mineral issues"],["🌡️","Environmental","Over/underwatering, light"]].map(([emoji,title,desc])=>(
                  <div key={title} style={{background:dark?"#141f14":"#fff",borderRadius:10,padding:"10px 12px",border:`1px solid ${dark?"#2a3e2a":"#e0e0e0"}`}}>
                    <div style={{fontSize:18,marginBottom:3}}>{emoji}</div>
                    <div style={{fontSize:11,fontWeight:700,color:dark?"#d4ecd4":"#1a1a1a"}}>{title}</div>
                    <div style={{fontSize:10,color:dark?"#5a7a5a":"#888"}}>{desc}</div>
                  </div>
                ))}
              </div>
              <button onClick={()=>setShowDiagnose(true)} style={{width:"100%",padding:"12px 0",background:"linear-gradient(135deg,#1a237e,#283593)",border:"none",borderRadius:12,color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer"}}>
                📷 Scan for Issues
              </button>
            </div>
            {plant.journal?.filter(e=>e.type==="pest").length>0&&(
              <div>
                <div style={{fontSize:11,fontWeight:700,color:dark?"#5a7a5a":"#666",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>Previous diagnoses</div>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {plant.journal.filter(e=>e.type==="pest").map(entry=>(
                    <div key={entry.id} style={{background:dark?"#1a2a1c":"#f8fdf8",border:`1px solid ${dark?"#2a3e2a":"#c8e6c9"}`,borderRadius:10,padding:"10px 13px"}}>
                      <div style={{fontSize:11,fontWeight:700,color:"#e65100",marginBottom:4}}>🐛 Pest / Disease Log</div>
                      <div style={{fontSize:12,color:dark?"#c8e4c8":"#2a2a2a",lineHeight:1.55,whiteSpace:"pre-line"}}>{entry.text.slice(0,200)}{entry.text.length>200?"...":""}</div>
                      <div style={{fontSize:10,color:dark?"#5a7a5a":"#888",marginTop:5}}>🕐 {new Date(entry.timestamp).toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"})}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>}
          {tab==="edit"&&<>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:textSecondary,textTransform:"uppercase",letterSpacing:"0.07em",display:"block",marginBottom:6}}>Emoji</label>
                <input value={editEmoji} onChange={e=>setEditEmoji(e.target.value)} maxLength={2} style={{width:60,padding:"9px 12px",borderRadius:10,border:`1.5px solid ${dark?"#2a3e2a":"#c8e6c9"}`,background:inputBg,color:textPrimary,fontSize:22,textAlign:"center",outline:"none"}}/>
              </div>
              {[{label:"Plant Name",value:editName,set:setEditName,ph:"e.g. Cherry Tomato"},{label:"Species",value:editSpecies,set:setEditSpecies,ph:"e.g. Solanum lycopersicum"}].map(({label,value,set,ph})=>(
                <div key={label}>
                  <label style={{fontSize:11,fontWeight:700,color:textSecondary,textTransform:"uppercase",letterSpacing:"0.07em",display:"block",marginBottom:6}}>{label}</label>
                  <input value={value} onChange={e=>set(e.target.value)} placeholder={ph} style={{width:"100%",padding:"9px 12px",borderRadius:10,border:`1.5px solid ${dark?"#2a3e2a":"#c8e6c9"}`,background:inputBg,color:textPrimary,fontSize:13,outline:"none",boxSizing:"border-box"}}/>
                </div>
              ))}
              <div>
                <label style={{fontSize:11,fontWeight:700,color:textSecondary,textTransform:"uppercase",letterSpacing:"0.07em",display:"block",marginBottom:6}}>🔔 Next Care Date</label>
                <input type="date" value={editNextCare} onChange={e=>setEditNextCare(e.target.value)} style={{width:"100%",padding:"9px 12px",borderRadius:10,border:`1.5px solid ${dark?"#2a3e2a":"#c8e6c9"}`,background:inputBg,color:textPrimary,fontSize:13,outline:"none",boxSizing:"border-box"}}/>
                <div style={{fontSize:10,color:textSecondary,marginTop:4}}>Card shows a badge when care is due or overdue.</div>
              </div>
              {[{label:"Care Notes",value:editCareNotes,set:setEditCareNotes},{label:"Fun Fact",value:editFunFact,set:setEditFunFact}].map(({label,value,set})=>(
                <div key={label}>
                  <label style={{fontSize:11,fontWeight:700,color:textSecondary,textTransform:"uppercase",letterSpacing:"0.07em",display:"block",marginBottom:6}}>{label}</label>
                  <textarea value={value} onChange={e=>set(e.target.value)} rows={3} style={{width:"100%",padding:"9px 12px",borderRadius:10,border:`1.5px solid ${dark?"#2a3e2a":"#c8e6c9"}`,background:inputBg,color:textPrimary,fontSize:13,outline:"none",resize:"vertical",boxSizing:"border-box",fontFamily:"system-ui,sans-serif"}}/>
                </div>
              ))}
              <div style={{display:"flex",gap:10,marginTop:4}}>
                <button onClick={saveEdit} style={{flex:1,padding:"11px 0",background:`linear-gradient(135deg,${theme.primary},${theme.primary}88)`,border:"none",borderRadius:10,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>✓ Save Changes</button>
                <button onClick={()=>{setEditName(plant.name);setEditSpecies(plant.species);setEditEmoji(plant.emoji);setEditCareNotes(plant.details?.careNotes||"");setEditFunFact(plant.details?.funFact||"");setEditNextCare(plant.nextCareDate?plant.nextCareDate.slice(0,10):"");setTab("overview");}} style={{padding:"11px 16px",background:dark?"#1e2e1e":"#f0f0f0",border:`1px solid ${borderColor}`,borderRadius:10,color:textSecondary,fontSize:13,cursor:"pointer"}}>Cancel</button>
              </div>
            </div>
          </>}
          <div style={{marginTop:22,paddingTop:16,borderTop:`1px solid ${borderColor}`}}>
            {!confirmDelete?(
              <button onClick={()=>setConfirmDelete(true)} style={{width:"100%",padding:"10px 0",background:"none",border:`1.5px solid ${dark?"#5a2020":"#ffcdd2"}`,borderRadius:10,color:dark?"#e57373":"#e53935",fontSize:12,fontWeight:700,cursor:"pointer"}} onMouseEnter={e=>e.currentTarget.style.background=dark?"#2e1010":"#ffebee"} onMouseLeave={e=>e.currentTarget.style.background="none"}>🗑️ Remove from Collection</button>
            ):(
              <div style={{background:dark?"#2e1010":"#ffebee",borderRadius:10,padding:"14px",textAlign:"center"}}>
                <div style={{fontSize:13,color:dark?"#ef9a9a":"#c62828",marginBottom:12,fontWeight:600}}>Remove {plant.name}?</div>
                <div style={{display:"flex",gap:8,justifyContent:"center"}}>
                  <button onClick={()=>{onDelete(plant.id);onClose();}} style={{padding:"9px 20px",background:"#e53935",border:"none",borderRadius:8,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>Yes, Remove</button>
                  <button onClick={()=>setConfirmDelete(false)} style={{padding:"9px 16px",background:dark?"#1e1e1e":"#fff",border:`1px solid ${borderColor}`,borderRadius:8,color:textSecondary,fontSize:13,cursor:"pointer"}}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    {showDiagnose&&<DiagnoseModal
      plant={plant}
      dark={dark}
      userId={userId}
      onClose={()=>setShowDiagnose(false)}
      onLogEntry={entry=>{
        onUpdate({...plant,journal:[entry,...(plant.journal||[])]});
        setShowDiagnose(false);
        setTab("journal");
      }}
    />}
    </>
  );
}

function AddPlantModal({onClose,onAdd,dark,existingPlants=[],locationContext=null,userId=null}) {
  const [image,setImage]=useState(null);
  const [imageBase64,setImageBase64]=useState(null);
  const [imageMime,setImageMime]=useState("image/jpeg");
  const [analyzing,setAnalyzing]=useState(false);
  const [step,setStep]=useState("idle");
  const [errorMsg,setErrorMsg]=useState("");
  const [dragging,setDragging]=useState(false);
  const fileRef=useRef(); const camRef=useRef();
  const processFile=f=>{
    if(!f||!f.type.startsWith("image/"))return;
    setImageMime(f.type);
    const r=new FileReader();
    r.onload=e=>{
      // Compress before storing
      compressImage(e.target.result,compressed=>{
        setImage(compressed);
        setImageBase64(compressed.split(",")[1]);
      });
    };
    r.readAsDataURL(f);
  };
  const handleAnalyze=async()=>{
    if(!imageBase64)return;
    setAnalyzing(true);setStep("analyzing");setErrorMsg("");
    try {
      const res=await fetch("/api/identify-plant",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({imageBase64,imageMime,locationContext,userId})});
      const data=await res.json();
      if(!res.ok){
        if(data.error==="out_of_credits") throw new Error("No scans remaining. Purchase more in the Credits menu.");
        throw new Error(data.error||"Server error");
      }
      // Duplicate detection
      const identified=data.plant;
      onAdd({id:`p${Date.now()}`,...identified,image,journal:[],nextCareDate:null,dateAdded:new Date().toISOString().split("T")[0]});
    } catch(err){setStep("error");setErrorMsg(err.message||"Could not identify plant.");} finally{setAnalyzing(false);}
  };
  const bg=dark?"#141f14":"#fffdf8";
  const dropBg=dragging?(dark?"#1a2e1a":"#e8f5e9"):(dark?"#0e160e":"#fafaf8");
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:20}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{width:420,background:bg,borderRadius:24,border:"2.5px solid #2e7d32",boxShadow:"0 20px 60px rgba(0,0,0,0.35)",fontFamily:"system-ui,sans-serif",overflow:"hidden"}}>
        <div style={{background:"linear-gradient(135deg,#2e7d32,#1b5e20)",padding:"16px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><div style={{fontSize:16,fontWeight:800,color:"#fff"}}>🌿 Scan New Plant</div><div style={{fontSize:11,color:"rgba(255,255,255,0.65)",marginTop:2}}>Photograph a plant or its label to generate a card</div></div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.15)",border:"none",borderRadius:"50%",width:30,height:30,cursor:"pointer",color:"#fff",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
        </div>
        <div style={{padding:"20px 22px 24px"}}>
          <div onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);processFile(e.dataTransfer.files[0]);}} onClick={()=>fileRef.current?.click()} style={{border:`2.5px dashed ${dragging?"#4caf50":(dark?"#2a3e2a":"#bbb")}`,borderRadius:14,minHeight:170,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",cursor:"pointer",background:dropBg,transition:"all 0.2s",marginBottom:12,overflow:"hidden"}}>
            {image?<img src={image} alt="upload" style={{width:"100%",height:170,objectFit:"cover",borderRadius:11}}/>:<><div style={{fontSize:44,marginBottom:8}}>📷</div><div style={{fontSize:13,fontWeight:600,color:dark?"#7aaa7a":"#555"}}>Drag a photo here</div><div style={{fontSize:11,color:dark?"#4a6a4a":"#999",marginTop:3}}>or tap to browse your library</div></>}
          </div>
          <button onClick={()=>camRef.current?.click()} style={{width:"100%",padding:"10px 0",marginBottom:16,background:"none",border:`1.5px solid ${dark?"#2a3e2a":"#c8e6c9"}`,borderRadius:12,color:dark?"#7aaa7a":"#2e7d32",fontSize:13,fontWeight:700,cursor:"pointer"}}>📸 Take a Photo</button>
          <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>processFile(e.target.files[0])}/>
          <input ref={camRef} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={e=>processFile(e.target.files[0])}/>
          {step==="analyzing"&&<div style={{background:dark?"#1a2e1a":"#e8f5e9",borderRadius:10,padding:"11px 14px",marginBottom:14,display:"flex",alignItems:"center",gap:10}}><div style={{width:18,height:18,border:"2.5px solid #2e7d32",borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.8s linear infinite",flexShrink:0}}/><span style={{fontSize:13,color:"#2e7d32",fontWeight:600}}>Identifying your plant...</span></div>}
          {step==="error"&&<div style={{background:dark?"#2e1010":"#ffebee",borderRadius:10,padding:"11px 14px",marginBottom:14,fontSize:12,color:dark?"#ff8a80":"#c62828"}}>⚠️ {errorMsg}</div>}
          <div style={{display:"flex",gap:8}}>
            <button onClick={handleAnalyze} disabled={!imageBase64||analyzing} style={{flex:1,padding:"12px 0",background:imageBase64&&!analyzing?"linear-gradient(135deg,#2e7d32,#1b5e20)":(dark?"#2a3a2a":"#ddd"),border:"none",borderRadius:10,color:imageBase64&&!analyzing?"#fff":(dark?"#4a5a4a":"#aaa"),fontSize:14,fontWeight:700,cursor:imageBase64&&!analyzing?"pointer":"not-allowed"}}>{analyzing?"Analyzing...":"✨ Generate Card"}</button>
            {image&&<button onClick={()=>{setImage(null);setImageBase64(null);setStep("idle");}} style={{padding:"12px 16px",background:dark?"#1e2e1e":"#f5f5f5",border:`1.5px solid ${dark?"#2a3e2a":"#ddd"}`,borderRadius:10,color:dark?"#7aaa7a":"#555",fontSize:13,cursor:"pointer"}}>Clear</button>}
          </div>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

export default function GardenTracker() {
  const [user,setUser]=useState(null);
  const [location,setLocation]=useState(loadLocation);
  const [showAuth,setShowAuth]=useState(false);
  const [syncing,setSyncing]=useState(false);
  const [plants,setPlants]=useState(loadPlants);
  const [beds,setBeds]=useState(loadBeds);
  const [selectedPlant,setSelectedPlant]=useState(null);
  const [showAdd,setShowAdd]=useState(false);
  const [filter,setFilter]=useState("All");
  const [search,setSearch]=useState("");
  const [filterRarity,setFilterRarity]=useState("");
  const [openNav,setOpenNav]=useState(null);
  const [dark,setDark]=useState(()=>{try{const s=localStorage.getItem("gardendex_dark");return s===null?true:s==="1";}catch{return true;}});
  const [sharedPlant,setSharedPlant]=useState(null);
  const [duplicateWarning,setDuplicateWarning]=useState(null);
  const [sortBy,setSortBy]=useState("dateAdded");
  const [showMap,setShowMap]=useState(false);

  useEffect(()=>{savePlants(plants);},[plants]);
  useEffect(()=>{saveBeds(beds);},[beds]);
  useEffect(()=>{try{localStorage.setItem("gardendex_dark",dark?"1":"0");}catch{}},[dark]);
  // ── Supabase auth ──────────────────────────────────────────────────────────
  useEffect(()=>{
    const db=getSupabase();
    if(!db)return;
    db.auth.getSession().then(({data:{session}})=>{
      const u=session?.user??null;
      setUser(u);
      if(u)loadPlantsFromDB(u);
    });
    const{data:{subscription}}=db.auth.onAuthStateChange((_,session)=>{
      const u=session?.user??null;
      setUser(u);
      if(u)loadPlantsFromDB(u);
    });
    return()=>subscription.unsubscribe();
  },[]);// eslint-disable-line react-hooks/exhaustive-deps

  const loadPlantsFromDB=async(u)=>{
    const db=getSupabase();if(!db)return;
    setSyncing(true);
    try{
      const{data,error}=await db.from("plants").select("data").eq("user_id",u.id);
      if(error)throw error;
      if(data?.length>0){
        const p=data.map(r=>r.data);
        setPlants(p);savePlants(p);
      } else {
        const local=loadPlants().filter(p=>!p.id.match(/^s\d+$/));// skip sample plants
        if(local.length>0){
          const rows=local.map(p=>({id:p.id,user_id:u.id,data:p}));
          await db.from("plants").upsert(rows,{onConflict:"id"});
        }
      }
      const{data:meta}=await db.from("user_data").select("*").eq("user_id",u.id).maybeSingle();
      if(meta){
        if(meta.beds)setBeds(meta.beds);
      } else {
        await db.from("user_data").upsert({
          updated_at:new Date().toISOString()
        },{onConflict:"user_id"});
      }
    }catch(e){console.error("DB load error:",e);setSyncing(false);// Plants remain as localStorage fallback
return;}
    dbLoadedRef.current=true;
    setSyncing(false);
  };

  const syncPlant=async(plant)=>{
    const db=getSupabase();if(!db||!user)return;
    await db.from("plants").upsert({id:plant.id,user_id:user.id,data:plant},{onConflict:"id"}).then(({error})=>{if(error)console.error("syncPlant:",error);});
  };

  const unsyncPlant=async(plantId)=>{
    const db=getSupabase();if(!db||!user)return;
    await db.from("plants").delete().eq("id",plantId).eq("user_id",user.id);
  };

  const syncMeta=async(patch)=>{
    const db=getSupabase();if(!db||!user)return;
    await db.from("user_data").upsert({user_id:user.id,...patch,updated_at:new Date().toISOString()},{onConflict:"user_id"});
  };

  const doSignOut=async()=>{
    const db=getSupabase();if(db)await db.auth.signOut();
    setUser(null);
    dbLoadedRef.current=false;
    // Reset to sample plants so the next user (or logged-out state) sees defaults
    setPlants(SAMPLE_PLANTS);
    setBeds([]);
    savePlants(SAMPLE_PLANTS);
    saveBeds([]);
  };

  useEffect(()=>{if(user&&dbLoadedRef.current)syncMeta({beds});},[beds,user]);// eslint-disable-line react-hooks/exhaustive-deps

  useEffect(()=>{
    if(!openNav)return;
    const close=()=>setOpenNav(null);
    document.addEventListener("click",close);
    return()=>document.removeEventListener("click",close);
  },[openNav]);

  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const plantParam=params.get("plant");
    if(plantParam){const d=decodePlant(plantParam);if(d)setSharedPlant(d);}
  },[]);

  const types=["All",...Object.keys(TYPE_THEMES)];
  const overdueCount=plants.filter(p=>isOverdue(p.nextCareDate)).length;
  const handleAdd=p=>{
    // Fix #3: enforce free plant limit for non-pro, non-signed-in users
    const realPlants=plants.filter(x=>!x.id.match(/^s\d+$/));
    if(!user && realPlants.length>=FREE_PLANT_LIMIT){
      alert(`Free collections are limited to ${FREE_PLANT_LIMIT} plants. Sign in to save unlimited plants!`);
      return;
    }
    setPlants(prev=>[p,...prev]);
    setShowAdd(false);
    setSelectedPlant(p);
    syncPlant(p);
    // Fix #4: check duplicate AFTER modal closes so the warning is actually visible
    const dup=plants.find(x=>
      x.species?.toLowerCase()===p.species?.toLowerCase()||
      x.name?.toLowerCase()===p.name?.toLowerCase()
    );
    if(dup) setDuplicateWarning(dup);
  };
  const handleDelete=id=>{setPlants(prev=>prev.filter(p=>p.id!==id));if(selectedPlant?.id===id)setSelectedPlant(null);unsyncPlant(id);};
  const handleUpdate=u=>{setPlants(prev=>prev.map(p=>p.id===u.id?u:p));setSelectedPlant(prev=>prev?.id===u.id?u:prev);syncPlant(u);};

  const dbLoadedRef=useRef(false);
  const placedInBeds=new Set(beds.flatMap(b=>Object.values(b.cells||{}))).size;

  const allTypes=Object.keys(TYPE_THEMES);
  const ownedTypes=new Set(plants.map(p=>p.type));
  const typesOwned=ownedTypes.size;
  const typeCompletion=Math.round((typesOwned/allTypes.length)*100);
  const rarityOrder={Common:0,Uncommon:1,Rare:2,Legendary:3};

  const filteredPlants=plants
    .filter(p=>(filter==="All"||p.type===filter)&&(!filterRarity||p.rarity===filterRarity)&&(!search||p.name.toLowerCase().includes(search.toLowerCase())))
    .sort((a,b)=>{
      switch(sortBy){
        case "name":    return a.name.localeCompare(b.name);
        case "vigor":   return b.vigor-a.vigor;
        case "rarity":  return (rarityOrder[b.rarity]||0)-(rarityOrder[a.rarity]||0);
        case "health":  return getHealthScore(b)-getHealthScore(a);
        case "care":    return (isOverdue(a.nextCareDate)?-1:1)-(isOverdue(b.nextCareDate)?-1:1);
        default:        return new Date(b.dateAdded)-new Date(a.dateAdded);
      }
    });

  const stats={
    total:plants.length,
    common:plants.filter(p=>p.rarity==="Common").length,
    uncommon:plants.filter(p=>p.rarity==="Uncommon").length,
    rare:plants.filter(p=>p.rarity==="Rare").length,
    legendary:plants.filter(p=>p.rarity==="Legendary").length,
    types:typesOwned,
  };

  return (
    <div style={{minHeight:"100vh",background:dark?"linear-gradient(160deg,#0a140a,#0d180d,#0a140a)":"linear-gradient(160deg,#f0f7f0,#fdf6e8,#f0f7f0)",fontFamily:"system-ui,-apple-system,sans-serif",transition:"background 0.35s"}}>
      {overdueCount>0&&<div style={{background:"#e53935",padding:"10px 32px",display:"flex",justifyContent:"center",alignItems:"center"}}><span style={{color:"#fff",fontSize:13,fontWeight:700}}>⚠ {overdueCount} plant{overdueCount>1?"s":""} overdue for care</span></div>}
      <div style={{background:dark?"linear-gradient(135deg,#0d1f0d,#162816,#0f200f)":"linear-gradient(135deg,#1b5e20,#2e7d32,#33691e)",padding:"22px 32px 26px",boxShadow:dark?"0 4px 24px rgba(0,0,0,0.55)":"0 4px 20px rgba(0,0,0,0.15)",borderBottom:dark?"1px solid #1e3a1e":"none",transition:"background 0.35s"}}>
        <div style={{maxWidth:1100,margin:"0 auto"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
            <div>
              <h1 style={{margin:0,fontSize:26,fontWeight:900,color:"#fff",letterSpacing:"-0.02em"}}>🌿 GardenDex</h1>
              <p style={{margin:"3px 0 0",fontSize:12,color:"rgba(255,255,255,0.6)"}}>Your personal plant collection & garden tracker</p>
            </div>
            <div style={{display:"flex",flexDirection:"column",alignItems:"stretch",gap:7,minWidth:148}}>
              <button onClick={()=>setShowAdd(true)} style={{background:"#ffd54f",border:"none",borderRadius:11,padding:"10px 18px",fontSize:13,fontWeight:800,cursor:"pointer",color:"#1b5e20",boxShadow:"0 4px 12px rgba(0,0,0,0.2)",display:"flex",alignItems:"center",justifyContent:"center",gap:7,transition:"transform 0.15s"}} onMouseEnter={e=>e.currentTarget.style.transform="scale(1.04)"} onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>📷 Add Plant</button>
              <button onClick={()=>setDark(d=>!d)} style={{background:dark?"rgba(255,255,255,0.13)":"rgba(0,0,0,0.22)",border:"1.5px solid rgba(255,255,255,0.27)",borderRadius:11,padding:"8px 18px",cursor:"pointer",color:"#fff",fontSize:12,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:7,transition:"all 0.2s"}} onMouseEnter={e=>e.currentTarget.style.transform="scale(1.04)"} onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>{dark?"☀️ Light Mode":"🌙 Dark Mode"}</button>
              {user?(
                <button onClick={doSignOut} title={user.email} style={{background:"rgba(255,255,255,0.13)",border:"1.5px solid rgba(100,200,100,0.5)",borderRadius:11,padding:"8px 18px",cursor:"pointer",color:"#fff",fontSize:12,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:7,transition:"all 0.2s"}} onMouseEnter={e=>e.currentTarget.style.transform="scale(1.04)"} onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>
                  <span style={{width:18,height:18,borderRadius:"50%",background:"#4caf50",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,color:"#fff",flexShrink:0}}>{user.email?.[0]?.toUpperCase()||"?"}</span>
                  {syncing?"Syncing…":"☁ Synced"}
                </button>
              ):(
                <button onClick={()=>setShowAuth(true)} style={{background:"rgba(255,255,255,0.13)",border:"1.5px solid rgba(255,255,255,0.27)",borderRadius:11,padding:"8px 18px",cursor:"pointer",color:"#fff",fontSize:12,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:7,transition:"all 0.2s"}} onMouseEnter={e=>e.currentTarget.style.transform="scale(1.04)"} onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>☁ Sign In</button>
              )}
              <LocationWidget location={location} onUpdate={loc=>{setLocation(loc);if(loc)saveLocation(loc);}} dark={dark}/>
            </div>
          </div>
          <div style={{display:"flex",gap:12,marginTop:18,flexWrap:"wrap"}}>
            {[
              {label:"All",value:stats.total,icon:"🌱",rarity:""},
              {label:`Types`,value:`${stats.types}/${allTypes.length}`,icon:"🏷️",rarity:null},
              {label:"Common",value:stats.common,icon:"🟢",rarity:"Common"},
              {label:"Uncommon",value:stats.uncommon,icon:"🔵",rarity:"Uncommon"},
              {label:"Rare",value:stats.rare,icon:"💜",rarity:"Rare"},
              {label:"Legendary",value:stats.legendary,icon:"🌟",rarity:"Legendary"},
              {label:"In Beds",value:placedInBeds,icon:"🗺️",rarity:null},
              ...(overdueCount?[{label:"Care Due",value:overdueCount,icon:"⚠️",warn:true,rarity:null}]:[]),
            ].map(({label,value,icon,warn,rarity})=>{
              const isActive=rarity!==null&&filterRarity===rarity;
              const clickable=rarity!==null;
              return(
              <div key={label}
                onClick={clickable?()=>setFilterRarity(isActive?"":rarity):undefined}
                style={{background:isActive?"rgba(255,213,79,0.25)":warn?"rgba(229,57,53,0.3)":"rgba(255,255,255,0.10)",borderRadius:10,padding:"9px 14px",border:`1px solid ${isActive?"rgba(255,213,79,0.6)":warn?"rgba(229,57,53,0.5)":"rgba(255,255,255,0.18)"}`,cursor:clickable?"pointer":"default",transition:"all 0.15s",userSelect:"none"}}>
                <div style={{fontSize:16,fontWeight:800,color:isActive?"#ffd54f":"#ffd54f"}}>{icon} {value}</div>
                <div style={{fontSize:9,color:"rgba(255,255,255,0.6)",textTransform:"uppercase",letterSpacing:"0.07em",marginTop:2}}>{label}{isActive?" ✓":""}</div>
              </div>
            );})}
          </div>
        </div>
      </div>

      {/* ── NavBar ─────────────────────────────────────────────────────────── */}
      {(()=>{
        const navBg=dark?"#0d1f0d":"#1b5e20";
        const navItemStyle=(active)=>({padding:"10px 16px",background:active?"rgba(255,255,255,0.18)":"none",border:"none",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",borderRadius:8,display:"flex",alignItems:"center",gap:5,whiteSpace:"nowrap",transition:"background 0.15s"});
        const dropStyle={position:"absolute",top:"calc(100% + 4px)",left:0,background:dark?"#1a2e1a":"#2e7d32",borderRadius:12,boxShadow:"0 8px 32px rgba(0,0,0,0.35)",overflow:"hidden",zIndex:200,minWidth:180};
        const dropItemStyle={display:"block",width:"100%",padding:"11px 18px",background:"none",border:"none",color:"#fff",fontSize:13,cursor:"pointer",textAlign:"left",transition:"background 0.1s"};
        const navItems=[
          {id:"collection",label:"📚 Collection",items:[
            {label:"🌿 All Plants",action:()=>{setFilterRarity("");setFilter("All");}},
            {label:"🟢 Common",action:()=>{setFilterRarity("Common");}},
            {label:"🔵 Uncommon",action:()=>{setFilterRarity("Uncommon");}},
            {label:"💜 Rare",action:()=>{setFilterRarity("Rare");}},
            {label:"🌟 Legendary",action:()=>{setFilterRarity("Legendary");}},
          ]},
          {id:"garden",label:"🗺️ Garden",items:[
            {label:"🗺️ Garden Map",action:()=>setShowMap(true)},
          ]},
          {id:"challenges",label:"🎯 Challenges",items:[
          ]},
        ];
        return(
          <div style={{background:navBg,borderBottom:"1px solid rgba(255,255,255,0.1)"}} onClick={()=>setOpenNav(null)}>
            <div style={{maxWidth:1100,margin:"0 auto",padding:"0 32px",display:"flex",alignItems:"center",gap:4,overflowX:"auto"}}>
              {navItems.map(nav=>(
                <div key={nav.id} style={{position:"relative",flexShrink:0}}>
                  <button onClick={e=>{e.stopPropagation();setOpenNav(openNav===nav.id?null:nav.id);}} style={navItemStyle(openNav===nav.id)}>
                    {nav.label} <span style={{fontSize:9,opacity:0.7}}>▾</span>
                  </button>
                  {openNav===nav.id&&(
                    <div style={dropStyle} onClick={e=>e.stopPropagation()}>
                      {nav.items.map(item=>(
                        <button key={item.label} style={dropItemStyle}
                          onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.15)"}
                          onMouseLeave={e=>e.currentTarget.style.background="none"}
                          onClick={()=>{item.action();setOpenNav(null);}}>
                          {item.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <button onClick={()=>setShowAdd(true)} style={navItemStyle(false)}>
                📷 Scan Plant
              </button>
              {filterRarity&&(
                <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
                  <span style={{color:"rgba(255,255,255,0.7)",fontSize:12}}>Showing:</span>
                  <span style={{background:"rgba(255,213,79,0.25)",border:"1px solid rgba(255,213,79,0.5)",borderRadius:8,padding:"3px 10px",color:"#ffd54f",fontSize:12,fontWeight:700}}>{filterRarity}</span>
                  <button onClick={()=>setFilterRarity("")} style={{background:"none",border:"none",color:"rgba(255,255,255,0.6)",cursor:"pointer",fontSize:16,padding:"0 2px",lineHeight:1}}>✕</button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Seasonal context banner (when location set) ───────────────── */}
      {location&&(()=>{
        const advice=getSeasonAdvice(location.season,location.zone);
        const frost=getFrostRisk(location.season,location.zone);
        const frostMsg=frost==="high"?"⛄ Frost risk — protect tender plants":frost==="moderate"?"🌡 Watch for overnight frosts":null;
        if(!advice)return null;
        return(
          <div style={{background:dark?"#0e1a0e":"#e8f5e9",borderBottom:`1px solid ${dark?"#1a3a1a":"#a5d6a7"}`,padding:"7px 32px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
            <span style={{fontSize:11,color:dark?"#7aaa7a":"#2e7d32",fontWeight:600}}>{SEASON_EMOJI[location.season]} {location.season} in {location.city||"your area"}</span>
            <span style={{fontSize:11,color:dark?"#5a7a5a":"#388e3c"}}>— {advice}</span>
            {frostMsg&&<span style={{fontSize:11,color:frost==="high"?"#e53935":"#e65100",fontWeight:700,marginLeft:"auto"}}>{frostMsg}</span>}
          </div>
        );
      })()}

      {/* Controls: search + filter + sort */}
      <div style={{maxWidth:1100,margin:"0 auto",padding:"18px 32px 0"}}>
        <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search plants..." style={{padding:"8px 14px",borderRadius:10,border:`1.5px solid ${dark?"#2a3e2a":"#c8e6c9"}`,fontSize:13,background:dark?"#141f14":"#fff",color:dark?"#c8e4c8":"#333",outline:"none",width:190}}/>
          <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{padding:"8px 12px",borderRadius:10,border:`1.5px solid ${dark?"#2a3e2a":"#c8e6c9"}`,fontSize:12,background:dark?"#141f14":"#fff",color:dark?"#c8e4c8":"#333",outline:"none",cursor:"pointer"}}>
            <option value="dateAdded">Sort: Newest</option>
            <option value="name">Sort: A–Z</option>
            <option value="vigor">Sort: Vigor</option>
            <option value="rarity">Sort: Rarity</option>
            <option value="health">Sort: Health</option>
            <option value="care">Sort: Care Due</option>
          </select>
          <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
            {types.map(t=><button key={t} onClick={()=>setFilter(t)} style={{padding:"6px 12px",borderRadius:18,border:`1.5px solid ${filter===t?"#2e7d32":(dark?"#2a3e2a":"#c8e6c9")}`,background:filter===t?"#2e7d32":(dark?"#141f14":"#fff"),color:filter===t?"#fff":(dark?"#7aaa7a":"#555"),fontSize:11,fontWeight:600,cursor:"pointer",transition:"all 0.15s"}}>{t==="All"?"All":`${TYPE_THEMES[t]?.icon} ${t}`}</button>)}
          </div>
        </div>
        {/* Type completion bar */}
        <div style={{marginTop:10,display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:10,color:dark?"#5a7a5a":"#888",whiteSpace:"nowrap"}}>Collection: {typesOwned}/{allTypes.length} types</span>
          <div style={{flex:1,height:4,background:dark?"#2a3e2a":"#e0e0e0",borderRadius:2,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${typeCompletion}%`,background:"#2e7d32",borderRadius:2,transition:"width 0.5s"}}/>
          </div>
          <span style={{fontSize:10,color:dark?"#5a7a5a":"#888"}}>{typeCompletion}%</span>
        </div>
      </div>

      <div style={{maxWidth:1100,margin:"0 auto",padding:"22px 32px 48px"}}>
        {filteredPlants.length===0?(
          <div style={{textAlign:"center",padding:"56px 20px",color:dark?"#3a5a3a":"#888",fontSize:14}}><div style={{fontSize:44,marginBottom:10}}>🌾</div>No plants found. Add your first one!</div>
        ):(
          <div style={{display:"flex",flexWrap:"wrap",gap:20}}>
            {filteredPlants.map(plant=><PlantCard key={plant.id} plant={plant} onClick={setSelectedPlant} dark={dark}/>)}
          </div>
        )}
      </div>
      {selectedPlant&&<PlantDetail plant={plants.find(p=>p.id===selectedPlant.id)||selectedPlant} onClose={()=>setSelectedPlant(null)} onDelete={handleDelete} onUpdate={handleUpdate} dark={dark} allPlants={filteredPlants} onNavigate={setSelectedPlant} collection={plants} locationContext={location?buildLocationContext(location):null} userId={user?.id??null}/>}
      {showAdd&&<AddPlantModal onClose={()=>setShowAdd(false)} onAdd={handleAdd} dark={dark} existingPlants={plants} locationContext={location?buildLocationContext(location):null} userId={user?.id??null}/>}
    {showAuth&&<AuthModal onClose={()=>setShowAuth(false)} dark={dark}/>}
      {/* Fix #4: duplicate warning toast — shown after add modal closes */}
      {duplicateWarning&&(
        <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:dark?"#1e1a08":"#fffbe6",border:`1.5px solid ${dark?"#4a3a00":"#ffe082"}`,borderRadius:12,padding:"12px 20px",boxShadow:"0 8px 24px rgba(0,0,0,0.25)",zIndex:500,fontFamily:"system-ui,sans-serif",display:"flex",alignItems:"center",gap:12,maxWidth:360}}>
          <span style={{fontSize:20}}>⚠️</span>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:700,color:dark?"#c8b86a":"#5d4037"}}>Looks like a duplicate</div>
            <div style={{fontSize:12,color:dark?"#9a8a4a":"#795548",marginTop:2}}>You already have <strong>{duplicateWarning.name}</strong> in your collection.</div>
          </div>
          <button onClick={()=>setDuplicateWarning(null)} style={{background:"none",border:"none",cursor:"pointer",color:dark?"#6a5a2a":"#aaa",fontSize:18,lineHeight:1,padding:"0 2px"}}>✕</button>
        </div>
      )}
      {sharedPlant&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300,padding:20}} onClick={()=>setSharedPlant(null)}>
          <div onClick={e=>e.stopPropagation()} style={{background:dark?"#141f14":"#fffdf8",borderRadius:24,padding:"24px",maxWidth:380,width:"100%",fontFamily:"system-ui,sans-serif",border:`3px solid ${RARITY[sharedPlant.rarity]?.color||"#78909c"}`,boxShadow:"0 20px 60px rgba(0,0,0,0.4)"}}>
            <div style={{textAlign:"center",marginBottom:16}}>
              <span style={{fontSize:72}}>{sharedPlant.emoji||"🌱"}</span>
              <div style={{fontSize:20,fontWeight:800,color:dark?"#d4ecd4":"#1a1a1a",marginTop:8}}>{sharedPlant.name}</div>
              <div style={{fontSize:12,color:dark?"#5a7a5a":"#888",fontStyle:"italic"}}>{sharedPlant.species}</div>
              <div style={{marginTop:8,fontSize:12,color:RARITY[sharedPlant.rarity]?.color}}>{RARITY[sharedPlant.rarity]?.stars} {sharedPlant.rarity}</div>
            </div>
            <StatBar label="Sunlight" value={sharedPlant.stats?.sunlight||0} color="#f9a825" icon="☀" dark={dark}/>
            <StatBar label="Water" value={sharedPlant.stats?.water||0} color="#1e88e5" icon="💧" dark={dark}/>
            <StatBar label="Difficulty" value={sharedPlant.stats?.difficulty||0} color="#e53935" icon="⚠" dark={dark}/>
            <div style={{marginTop:16,display:"flex",gap:8}}>
              <button onClick={()=>{handleAdd({...sharedPlant,id:`p${Date.now()}`,image:null,journal:[],nextCareDate:null,dateAdded:new Date().toISOString().split("T")[0]});setSharedPlant(null);}} style={{flex:1,padding:"10px 0",background:"linear-gradient(135deg,#2e7d32,#1b5e20)",border:"none",borderRadius:10,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>+ Add to My Collection</button>
              <button onClick={()=>setSharedPlant(null)} style={{padding:"10px 16px",background:dark?"#1e2e1e":"#f0f0f0",border:`1px solid ${dark?"#2a3e2a":"#ddd"}`,borderRadius:10,color:dark?"#7aaa7a":"#555",fontSize:13,cursor:"pointer"}}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
