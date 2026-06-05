import { useState } from "react";

const ZONES = ["1","2","3","4","5","6","7","8","9","10","11","12","13"];
const SEASONS = ["Spring","Summer","Autumn","Winter"];

export default function LocationWidget({ location, onUpdate, dark }) {
  const [open, setOpen]     = useState(false);
  const [city, setCity]     = useState(location?.city || "");
  const [zone, setZone]     = useState(location?.zone || "8");
  const [season, setSeason] = useState(location?.season || "Spring");

  const border  = dark ? "#2a3e2a" : "#c8e6c9";
  const bg      = dark ? "#1e2e1e" : "#f0f7f0";
  const text    = dark ? "#d4ecd4" : "#1a2e1a";
  const muted   = dark ? "#6a8a6a" : "#5a7a5a";

  function handleSave() {
    onUpdate({ city: city.trim() || null, zone, season });
    setOpen(false);
  }

  function handleClear() {
    onUpdate(null);
    setCity(""); setZone("8"); setSeason("Spring");
    setOpen(false);
  }

  return (
    <div style={{ position: "relative", fontFamily: "system-ui,sans-serif" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: location ? (dark ? "#1e2e1e" : "#e8f5e9") : "rgba(255,255,255,0.1)",
          border: `1.5px solid ${location ? border : "rgba(255,255,255,0.25)"}`,
          borderRadius: 9, padding: "7px 13px", cursor: "pointer",
          color: location ? (dark ? "#a5d6a7" : "#2e7d32") : "#fff",
          fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 5,
          transition: "all 0.2s",
        }}
      >
        📍 {location ? (location.city || `Zone ${location.zone}`) : "Set location"}
      </button>

      {open && (
        <div
          style={{
            position: "absolute", top: "calc(100% + 8px)", right: 0,
            background: dark ? "#141f14" : "#fffdf8",
            border: `2px solid ${border}`, borderRadius: 14,
            padding: 18, minWidth: 230, zIndex: 200,
            boxShadow: "0 12px 40px rgba(0,0,0,0.3)",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: text, marginBottom: 12 }}>
            🌍 Your Garden Location
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: muted, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>City / Region</div>
            <input
              type="text" placeholder="e.g. Sydney, London…"
              value={city} onChange={e => setCity(e.target.value)}
              style={{
                width: "100%", padding: "8px 10px", borderRadius: 8,
                border: `1.5px solid ${border}`, background: bg,
                color: text, fontSize: 13, outline: "none", boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: muted, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>USDA Hardiness Zone</div>
            <select
              value={zone} onChange={e => setZone(e.target.value)}
              style={{
                width: "100%", padding: "8px 10px", borderRadius: 8,
                border: `1.5px solid ${border}`, background: bg,
                color: text, fontSize: 13, outline: "none",
              }}
            >
              {ZONES.map(z => <option key={z} value={z}>Zone {z}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: muted, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>Current Season</div>
            <div style={{ display: "flex", gap: 5 }}>
              {SEASONS.map(s => (
                <button
                  key={s} onClick={() => setSeason(s)}
                  style={{
                    flex: 1, padding: "6px 0", borderRadius: 7, cursor: "pointer",
                    fontSize: 11, fontWeight: 600,
                    background: season === s ? "#2e7d32" : bg,
                    border: `1.5px solid ${season === s ? "#2e7d32" : border}`,
                    color: season === s ? "#fff" : muted,
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={handleSave}
              style={{
                flex: 1, padding: "9px 0",
                background: "linear-gradient(135deg,#2e7d32,#1b5e20)",
                border: "none", borderRadius: 8, color: "#fff",
                fontSize: 13, fontWeight: 700, cursor: "pointer",
              }}
            >
              Save
            </button>
            {location && (
              <button
                onClick={handleClear}
                style={{
                  padding: "9px 12px", background: bg,
                  border: `1.5px solid ${border}`, borderRadius: 8,
                  color: muted, fontSize: 13, cursor: "pointer",
                }}
              >
                Clear
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              style={{
                padding: "9px 12px", background: bg,
                border: `1.5px solid ${border}`, borderRadius: 8,
                color: muted, fontSize: 13, cursor: "pointer",
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
