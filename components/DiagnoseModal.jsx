// components/DiagnoseModal.jsx
// Photo-based plant disease/pest/deficiency diagnosis.
// Results are shown as a full diagnosis card and optionally logged to the plant's journal.

import { useState, useRef } from "react";

const SEVERITY_CONFIG = {
  Mild:     { color: "#43a047", bg: "#e8f5e9", darkBg: "#1a2e1a", bar: "#43a047", icon: "🟢" },
  Moderate: { color: "#f9a825", bg: "#fffde7", darkBg: "#1e1a08", bar: "#f9a825", icon: "🟡" },
  Severe:   { color: "#e53935", bg: "#ffebee", darkBg: "#2e1010", bar: "#e53935", icon: "🔴" },
};

const CATEGORY_CONFIG = {
  Disease:     { emoji: "🦠", color: "#7b1fa2" },
  Pest:        { emoji: "🐛", color: "#e65100" },
  Deficiency:  { emoji: "🌿", color: "#f57c00" },
  Environmental: { emoji: "🌡️", color: "#1565c0" },
  Healthy:     { emoji: "💚", color: "#43a047" },
};

const URGENCY_CONFIG = {
  Now:      { color: "#e53935", label: "Do now" },
  Soon:     { color: "#f9a825", label: "Within a week" },
  Optional: { color: "#78909c", label: "Optional" },
};

function compressImage(dataUrl, callback) {
  const img = new Image();
  img.onload = () => {
    const MAX = 500;
    const scale = Math.min(1, MAX / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width  = Math.round(img.width  * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    callback(canvas.toDataURL("image/jpeg", 0.75));
  };
  img.src = dataUrl;
}

export default function DiagnoseModal({ plant, onClose, onLogEntry, dark, userId = null }) {
  const [phase, setPhase] = useState("upload"); // upload | scanning | result | error
  const [image, setImage] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [imageMime, setImageMime] = useState("image/jpeg");
  const [diagnosis, setDiagnosis] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [dragging, setDragging] = useState(false);
  const [logged, setLogged] = useState(false);
  const fileRef = useRef();
  const camRef = useRef();

  const bg          = dark ? "#141f14" : "#fffdf8";
  const textPrimary = dark ? "#d4ecd4" : "#1a1a1a";
  const textSec     = dark ? "#5a7a5a" : "#666";
  const border      = dark ? "#2a3e2a" : "#e0e0e0";
  const inputBg     = dark ? "#0e160e" : "#f8f8f8";

  const processFile = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    setImageMime(file.type);
    const reader = new FileReader();
    reader.onload = (e) => {
      compressImage(e.target.result, (compressed) => {
        setImage(compressed);
        setImageBase64(compressed.split(",")[1]);
      });
    };
    reader.readAsDataURL(file);
  };

  const handleScan = async () => {
    if (!imageBase64) return;
    setPhase("scanning");
    setErrorMsg("");
    try {
      const res = await fetch("/api/diagnose-plant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64,
          imageMime,
          plantName: plant?.name,
          plantSpecies: plant?.species,
          userId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Diagnosis failed");
      setDiagnosis(data.diagnosis);
      setPhase("result");
    } catch (err) {
      setErrorMsg(err.message || "Could not complete diagnosis.");
      setPhase("error");
    }
  };

  const handleLog = () => {
    if (!diagnosis || logged) return;
    const severity = SEVERITY_CONFIG[diagnosis.severity] || SEVERITY_CONFIG.Mild;
    const cat = CATEGORY_CONFIG[diagnosis.category] || CATEGORY_CONFIG.Pest;
    const treatmentText = diagnosis.treatment
      .map(t => `${t.step}. ${t.action}`)
      .join("\n");
    const text = `${cat.emoji} ${diagnosis.issue} (${diagnosis.severity})\n\n${diagnosis.description}\n\nCause: ${diagnosis.cause}\n\nTreatment:\n${treatmentText}\n\nPrevention: ${diagnosis.prevention}`;
    onLogEntry({
      id: Date.now().toString(),
      type: diagnosis.category === "Healthy" ? "note" : "pest",
      emoji: diagnosis.category === "Healthy" ? "📝" : "🐛",
      text,
      timestamp: new Date().toISOString(),
    });
    setLogged(true);
  };

  const sev = diagnosis ? (SEVERITY_CONFIG[diagnosis.severity] || SEVERITY_CONFIG.Mild) : null;
  const cat = diagnosis ? (CATEGORY_CONFIG[diagnosis.category] || CATEGORY_CONFIG.Pest) : null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 250, padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: 480, maxHeight: "92vh", overflowY: "auto", background: bg, borderRadius: 24, border: `2.5px solid ${dark ? "#2a3e2a" : "#c8e6c9"}`, boxShadow: "0 24px 64px rgba(0,0,0,0.4)", fontFamily: "system-ui,sans-serif" }}>

        {/* Header */}
        <div style={{ background: "linear-gradient(135deg,#1a237e,#283593)", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderRadius: "21px 21px 0 0" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>🔬 Plant Diagnosis</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", marginTop: 2 }}>
              {plant ? `Scanning ${plant.name}` : "Photo analysis for diseases, pests & deficiencies"}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "50%", width: 30, height: 30, cursor: "pointer", color: "#fff", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>

        <div style={{ padding: "18px 22px 24px" }}>

          {/* ── UPLOAD PHASE ── */}
          {(phase === "upload" || phase === "error") && <>
            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); processFile(e.dataTransfer.files[0]); }}
              onClick={() => fileRef.current?.click()}
              style={{ border: `2.5px dashed ${dragging ? "#3949ab" : (dark ? "#2a3e2a" : "#c5cae9")}`, borderRadius: 14, minHeight: 160, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", background: dragging ? (dark ? "#1a1e40" : "#e8eaf6") : inputBg, transition: "all 0.2s", marginBottom: 12, overflow: "hidden" }}
            >
              {image
                ? <img src={image} alt="upload" style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: 11 }} />
                : <>
                    <div style={{ fontSize: 44, marginBottom: 8 }}>🔬</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: textPrimary }}>Drop a photo of the problem area</div>
                    <div style={{ fontSize: 11, color: textSec, marginTop: 4 }}>or click to browse</div>
                    <div style={{ fontSize: 11, color: dark ? "#3a5a3a" : "#bbb", marginTop: 6 }}>Close-up photos of affected leaves or stems work best</div>
                  </>
              }
            </div>

            <button onClick={() => camRef.current?.click()} style={{ width: "100%", padding: "10px 0", marginBottom: 14, background: "none", border: `1.5px solid ${dark ? "#2a3e2a" : "#c5cae9"}`, borderRadius: 12, color: dark ? "#9fa8da" : "#3949ab", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              📸 Take a Photo
            </button>

            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => processFile(e.target.files[0])} />
            <input ref={camRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={e => processFile(e.target.files[0])} />

            {phase === "error" && (
              <div style={{ background: dark ? "#2e1010" : "#ffebee", borderRadius: 10, padding: "11px 14px", marginBottom: 14, fontSize: 12, color: dark ? "#ff8a80" : "#c62828" }}>
                ⚠️ {errorMsg}
              </div>
            )}

            {/* Tips */}
            <div style={{ background: dark ? "#1a1e2e" : "#e8eaf6", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 11, color: dark ? "#9fa8da" : "#3949ab", lineHeight: 1.7 }}>
              <strong>💡 Tips for accurate results:</strong><br />
              • Photograph the affected leaf or stem in good light<br />
              • Include both healthy and damaged tissue if possible<br />
              • Avoid blurry or very dark photos
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={handleScan}
                disabled={!imageBase64}
                style={{ flex: 1, padding: "12px 0", background: imageBase64 ? "linear-gradient(135deg,#1a237e,#283593)" : (dark ? "#1e2e1e" : "#e0e0e0"), border: "none", borderRadius: 12, color: imageBase64 ? "#fff" : (dark ? "#4a5a4a" : "#aaa"), fontSize: 14, fontWeight: 700, cursor: imageBase64 ? "pointer" : "not-allowed" }}
              >
                🔬 Diagnose
              </button>
              {image && (
                <button onClick={() => { setImage(null); setImageBase64(null); }} style={{ padding: "12px 16px", background: dark ? "#1e2e1e" : "#f5f5f5", border: `1.5px solid ${border}`, borderRadius: 12, color: textSec, fontSize: 13, cursor: "pointer" }}>
                  Clear
                </button>
              )}
            </div>
          </>}

          {/* ── SCANNING PHASE ── */}
          {phase === "scanning" && (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>🔬</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: textPrimary, marginBottom: 8 }}>Analysing your plant...</div>
              <div style={{ fontSize: 12, color: textSec, marginBottom: 24, lineHeight: 1.6 }}>
                Searching for matching conditions<br />and treatment protocols
              </div>
              <div style={{ display: "flex", justifyContent: "center", gap: 6 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: "#3949ab", animation: `gd-dot-pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                ))}
              </div>
              <style>{`@keyframes gd-dot-pulse { 0%,100%{transform:scale(0.6);opacity:0.4} 50%{transform:scale(1);opacity:1} }`}</style>
            </div>
          )}

          {/* ── RESULT PHASE ── */}
          {phase === "result" && diagnosis && <>
            {/* Main diagnosis card */}
            <div style={{ background: dark ? sev.darkBg : sev.bg, border: `2px solid ${sev.color}44`, borderRadius: 14, padding: "16px 18px", marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 22 }}>{cat.emoji}</span>
                    <div>
                      <div style={{ fontSize: 17, fontWeight: 800, color: textPrimary }}>{diagnosis.issue}</div>
                      <div style={{ fontSize: 11, color: textSec }}>{diagnosis.category} · {diagnosis.confidence} confidence</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: textSec, lineHeight: 1.6, marginTop: 6 }}>{diagnosis.description}</div>
                </div>
                <div style={{ textAlign: "center", marginLeft: 12, flexShrink: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: sev.color, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{sev.icon} {diagnosis.severity}</div>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: sev.color + "22", border: `2.5px solid ${sev.color}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: sev.color }}>{diagnosis.severityScore}</span>
                  </div>
                  <div style={{ fontSize: 9, color: textSec, marginTop: 3 }}>/10</div>
                </div>
              </div>

              {/* Severity bar */}
              <div style={{ height: 5, background: dark ? "#2a2a2a" : "#e0e0e0", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${(diagnosis.severityScore / 10) * 100}%`, background: sev.color, borderRadius: 3 }} />
              </div>
            </div>

            {/* Symptoms */}
            {diagnosis.symptoms?.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: textSec, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Symptoms observed</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {diagnosis.symptoms.map((s, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: textPrimary }}>
                      <span style={{ color: sev.color, fontWeight: 700, flexShrink: 0 }}>•</span>
                      <span>{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cause */}
            <div style={{ background: dark ? "#1a1e2e" : "#e8eaf6", border: `1.5px solid ${dark ? "#2a3060" : "#c5cae9"}`, borderRadius: 10, padding: "11px 14px", marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: dark ? "#9fa8da" : "#3949ab", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>🔍 Cause</div>
              <div style={{ fontSize: 12, color: textPrimary, lineHeight: 1.6 }}>{diagnosis.cause}</div>
            </div>

            {/* Treatment steps */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: textSec, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Treatment plan</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {diagnosis.treatment.map((step) => {
                  const urg = URGENCY_CONFIG[step.urgency] || URGENCY_CONFIG.Soon;
                  return (
                    <div key={step.step} style={{ display: "flex", gap: 12, alignItems: "flex-start", background: dark ? "#1a2a1c" : "#f8fdf8", border: `1px solid ${dark ? "#2a3e2a" : "#c8e6c9"}`, borderRadius: 10, padding: "10px 12px" }}>
                      <div style={{ width: 24, height: 24, borderRadius: "50%", background: urg.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{step.step}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, color: textPrimary, lineHeight: 1.5 }}>{step.action}</div>
                        <div style={{ fontSize: 10, color: urg.color, fontWeight: 700, marginTop: 3 }}>{urg.label}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Organic option */}
            {diagnosis.organicOption && (
              <div style={{ background: dark ? "#1a2e1a" : "#e8f5e9", border: `1.5px solid ${dark ? "#2a3e2a" : "#c8e6c9"}`, borderRadius: 10, padding: "11px 14px", marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: dark ? "#7aaa7a" : "#2e7d32", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>🌿 Organic alternative</div>
                <div style={{ fontSize: 12, color: textPrimary, lineHeight: 1.6 }}>{diagnosis.organicOption}</div>
              </div>
            )}

            {/* Prevention + spread risk */}
            <div style={{ display: "grid", gridTemplateColumns: diagnosis.spreadRisk !== "None" ? "1fr auto" : "1fr", gap: 10, marginBottom: 18 }}>
              <div style={{ background: dark ? "#1e1a08" : "#fffbe6", border: `1.5px solid ${dark ? "#4a3a00" : "#ffe082"}`, borderRadius: 10, padding: "11px 14px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: dark ? "#c8a020" : "#f57f17", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>🛡️ Prevention</div>
                <div style={{ fontSize: 12, color: textPrimary, lineHeight: 1.6 }}>{diagnosis.prevention}</div>
              </div>
              {diagnosis.spreadRisk && diagnosis.spreadRisk !== "None" && (
                <div style={{ background: dark ? "#2e1010" : "#ffebee", border: `1.5px solid ${dark ? "#5a2020" : "#ffcdd2"}`, borderRadius: 10, padding: "11px 14px", textAlign: "center", minWidth: 80 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: dark ? "#e57373" : "#c62828", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>Spread</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: dark ? "#e57373" : "#c62828" }}>{diagnosis.spreadRisk}</div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 8 }}>
              {plant && !logged && (
                <button onClick={handleLog} style={{ flex: 1, padding: "11px 0", background: `linear-gradient(135deg,#1a237e,#283593)`, border: "none", borderRadius: 12, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  📓 Log to Journal
                </button>
              )}
              {logged && (
                <div style={{ flex: 1, padding: "11px 0", background: dark ? "#1a2e1a" : "#e8f5e9", borderRadius: 12, color: dark ? "#7aaa7a" : "#2e7d32", fontSize: 13, fontWeight: 700, textAlign: "center" }}>
                  ✓ Logged to journal
                </div>
              )}
              <button onClick={() => { setPhase("upload"); setImage(null); setImageBase64(null); setDiagnosis(null); setLogged(false); }} style={{ padding: "11px 16px", background: dark ? "#1e2e1e" : "#f0f0f0", border: `1px solid ${border}`, borderRadius: 12, color: textSec, fontSize: 13, cursor: "pointer" }}>
                Scan again
              </button>
              <button onClick={onClose} style={{ padding: "11px 16px", background: dark ? "#1e2e1e" : "#f0f0f0", border: `1px solid ${border}`, borderRadius: 12, color: textSec, fontSize: 13, cursor: "pointer" }}>
                Done
              </button>
            </div>
          </>}

        </div>
      </div>
    </div>
  );
}
