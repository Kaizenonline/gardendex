// components/GardenMap.jsx
// Drag-and-drop garden bed layout.
// Plants can be placed on named grid beds, moved between cells, and removed.
// Beds are persisted in localStorage via the parent's beds/setBeds state.

import { useState, useRef } from "react";

const BED_COLORS = [
  { id: "earth",   bg: "#4e342e", light: "#efebe9", dark: "#1e1410", label: "Earth"   },
  { id: "grass",   bg: "#2e7d32", light: "#e8f5e9", dark: "#1a2e1a", label: "Grass"   },
  { id: "clay",    bg: "#bf360c", light: "#fbe9e7", dark: "#2e1208", label: "Clay"     },
  { id: "sand",    bg: "#f57f17", light: "#fff8e1", dark: "#1e1a08", label: "Sand"     },
  { id: "stone",   bg: "#455a64", light: "#eceff1", dark: "#141e22", label: "Stone"    },
  { id: "wood",    bg: "#5d4037", light: "#efebe9", dark: "#1e1410", label: "Wood"     },
];

const TYPE_THEMES = {
  Vegetable: "#2e7d32", Fruit: "#e65100", Herb: "#6a1b9a",
  Flower: "#ad1457", Succulent: "#558b2f", Tree: "#5d4037",
  Grass: "#388e3c", Other: "#455a64",
};

function newBed(name, rows, cols, colorId) {
  return {
    id: `bed_${Date.now()}`,
    name: name || "New Bed",
    rows: Math.min(8, Math.max(1, rows || 3)),
    cols: Math.min(10, Math.max(1, cols || 4)),
    colorId: colorId || "earth",
    cells: {},   // { "row-col": plantId }
    notes: "",
  };
}

// ── Add / Edit Bed modal ──────────────────────────────────────────────────────
function BedModal({ existing, onSave, onClose, dark }) {
  const [name, setName]       = useState(existing?.name || "");
  const [rows, setRows]       = useState(existing?.rows || 3);
  const [cols, setCols]       = useState(existing?.cols || 4);
  const [colorId, setColorId] = useState(existing?.colorId || "earth");
  const [notes, setNotes]     = useState(existing?.notes || "");

  const bg = dark ? "#141f14" : "#fffdf8";
  const ts = dark ? "#5a7a5a" : "#666";
  const bd = dark ? "#2a3e2a" : "#e0e0e0";
  const ib = dark ? "#0e160e" : "#f8f8f8";
  const ic = dark ? "#c8e4c8" : "#333";
  const selCol = BED_COLORS.find(c => c.id === colorId) || BED_COLORS[0];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400, padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: 400, background: bg, borderRadius: 20, border: `2px solid ${selCol.bg}`, boxShadow: "0 20px 60px rgba(0,0,0,0.4)", fontFamily: "system-ui,sans-serif", overflow: "hidden" }}>
        <div style={{ background: selCol.bg, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>{existing ? "Edit Bed" : "Add New Bed"}</div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", color: "#fff", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>
        <div style={{ padding: "16px 18px 20px", display: "flex", flexDirection: "column", gap: 13 }}>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: ts, textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 5 }}>Bed name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. South Border, Raised Bed 1" style={{ width: "100%", padding: "8px 11px", borderRadius: 9, border: `1.5px solid ${bd}`, background: ib, color: ic, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[["Rows", rows, setRows, 1, 8], ["Columns", cols, setCols, 1, 10]].map(([label, val, set, min, max]) => (
              <div key={label}>
                <label style={{ fontSize: 10, fontWeight: 700, color: ts, textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 5 }}>{label} ({val})</label>
                <input type="range" min={min} max={max} value={val} onChange={e => set(Number(e.target.value))} style={{ width: "100%", accentColor: selCol.bg }} />
              </div>
            ))}
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: ts, textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 8 }}>Bed colour</label>
            <div style={{ display: "flex", gap: 8 }}>
              {BED_COLORS.map(c => (
                <button key={c.id} onClick={() => setColorId(c.id)} title={c.label} style={{ width: 32, height: 32, borderRadius: 8, background: c.bg, border: colorId === c.id ? "3px solid #fff" : "2px solid transparent", boxShadow: colorId === c.id ? `0 0 0 2px ${c.bg}` : "none", cursor: "pointer", transition: "all 0.15s" }} />
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: ts, textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 5 }}>Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Soil mix, history, notes..." rows={2} style={{ width: "100%", padding: "8px 11px", borderRadius: 9, border: `1.5px solid ${bd}`, background: ib, color: ic, fontSize: 12, outline: "none", resize: "none", boxSizing: "border-box", fontFamily: "system-ui,sans-serif" }} />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
            <button onClick={() => onSave({ ...(existing || {}), name: name.trim() || "New Bed", rows, cols, colorId, notes })} style={{ flex: 1, padding: "11px 0", background: selCol.bg, border: "none", borderRadius: 11, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              {existing ? "Save Changes" : "Create Bed"}
            </button>
            <button onClick={onClose} style={{ padding: "11px 16px", background: dark ? "#1e2e1e" : "#f0f0f0", border: `1px solid ${bd}`, borderRadius: 11, color: ts, fontSize: 13, cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Plant quick-view popup ────────────────────────────────────────────────────
function PlantPopup({ plant, cell, bedId, onRemove, onClose, dark }) {
  if (!plant) return null;
  const typeColor = TYPE_THEMES[plant.type] || "#455a64";
  const bg = dark ? "#1a2a1c" : "#fff";
  const ts = dark ? "#5a7a5a" : "#666";
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 350, padding: 20 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: 280, background: bg, borderRadius: 16, border: `2.5px solid ${typeColor}`, boxShadow: "0 12px 40px rgba(0,0,0,0.3)", fontFamily: "system-ui,sans-serif", overflow: "hidden" }}>
        <div style={{ background: `linear-gradient(135deg,${typeColor},${typeColor}88)`, padding: "14px 16px", display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ fontSize: 36 }}>{plant.emoji}</span>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>{plant.name}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", fontStyle: "italic" }}>{plant.species}</div>
          </div>
        </div>
        <div style={{ padding: "12px 16px 16px" }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 800, padding: "3px 9px", borderRadius: 10, background: typeColor, color: "#fff", textTransform: "uppercase", letterSpacing: "0.06em" }}>{plant.type}</span>
            <span style={{ fontSize: 10, fontWeight: 800, padding: "3px 9px", borderRadius: 10, background: { Common: "#78909c", Uncommon: "#43a047", Rare: "#1e88e5", Legendary: "#e65100" }[plant.rarity] || "#78909c", color: "#fff" }}>{plant.rarity}</span>
          </div>
          <div style={{ fontSize: 12, color: ts, marginBottom: 4 }}>⚡ Vigor: <strong style={{ color: dark ? "#d4ecd4" : "#1a1a1a" }}>{plant.vigor}</strong></div>
          <div style={{ fontSize: 12, color: ts, marginBottom: 12 }}>📅 Added: <strong style={{ color: dark ? "#d4ecd4" : "#1a1a1a" }}>{plant.dateAdded}</strong></div>
          <button onClick={() => { onRemove(bedId, cell); onClose(); }} style={{ width: "100%", padding: "9px 0", background: "none", border: `1.5px solid ${dark ? "#5a2020" : "#ffcdd2"}`, borderRadius: 9, color: dark ? "#e57373" : "#e53935", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            Remove from bed
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Single bed grid ───────────────────────────────────────────────────────────
function BedGrid({ bed, plants, onDropPlant, onRemovePlant, onEditBed, onDeleteBed, dark }) {
  const [dragOverCell, setDragOverCell] = useState(null);
  const [popup, setPopup] = useState(null); // { plantId, cell }

  const col = BED_COLORS.find(c => c.id === bed.colorId) || BED_COLORS[0];
  const bg  = dark ? col.dark : col.light;
  const ts  = dark ? "#5a7a5a" : "#666";

  const placedIds = new Set(Object.values(bed.cells));
  const occupied  = (r, c) => bed.cells[`${r}-${c}`];

  const handleDrop = (e, row, col) => {
    e.preventDefault();
    setDragOverCell(null);
    const plantId = e.dataTransfer.getData("plantId");
    const fromBed = e.dataTransfer.getData("fromBed");
    const fromCell= e.dataTransfer.getData("fromCell");
    if (!plantId) return;
    onDropPlant(bed.id, `${row}-${col}`, plantId, fromBed || null, fromCell || null);
  };

  const popupPlant = popup ? plants.find(p => p.id === popup.plantId) : null;

  return (
    <>
      <div style={{ background: bg, borderRadius: 14, border: `2px solid ${col.bg}44`, padding: "12px 14px", fontFamily: "system-ui,sans-serif" }}>
        {/* Bed header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: col.bg }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: dark ? "#d4ecd4" : "#1a1a1a" }}>{bed.name}</div>
              <div style={{ fontSize: 10, color: ts }}>{bed.rows}×{bed.cols} · {Object.keys(bed.cells).length} plants</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 5 }}>
            <button onClick={() => onEditBed(bed)} title="Edit bed" style={{ background: "none", border: `1px solid ${dark ? "#2a3e2a" : "#c8d8c8"}`, borderRadius: 7, width: 26, height: 26, cursor: "pointer", color: ts, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>✏️</button>
            <button onClick={() => onDeleteBed(bed.id)} title="Delete bed" style={{ background: "none", border: `1px solid ${dark ? "#4a2020" : "#ffcdd2"}`, borderRadius: 7, width: 26, height: 26, cursor: "pointer", color: dark ? "#e57373" : "#e53935", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>🗑️</button>
          </div>
        </div>

        {/* Notes */}
        {bed.notes && <div style={{ fontSize: 11, color: ts, fontStyle: "italic", marginBottom: 9, lineHeight: 1.5 }}>{bed.notes}</div>}

        {/* Grid */}
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${bed.cols}, 1fr)`, gap: 5 }}>
          {Array.from({ length: bed.rows }).map((_, r) =>
            Array.from({ length: bed.cols }).map((_, c) => {
              const cellKey = `${r}-${c}`;
              const plantId = occupied(r, c);
              const plant   = plantId ? plants.find(p => p.id === plantId) : null;
              const isOver  = dragOverCell === cellKey;
              const typeCol = plant ? (TYPE_THEMES[plant.type] || "#455a64") : null;

              return (
                <div
                  key={cellKey}
                  onDragOver={e => { e.preventDefault(); setDragOverCell(cellKey); }}
                  onDragLeave={() => setDragOverCell(null)}
                  onDrop={e => handleDrop(e, r, c)}
                  onClick={() => { if (plant) setPopup({ plantId: plant.id, cell: cellKey }); }}
                  style={{
                    height: 52,
                    borderRadius: 8,
                    border: `2px ${isOver ? "solid" : plant ? "solid" : "dashed"} ${isOver ? col.bg : plant ? typeCol + "88" : (dark ? "#2a3e2a" : "#c8d8c8")}`,
                    background: isOver ? col.bg + "22" : plant ? typeCol + "15" : (dark ? "#0e160e" : "#fff"),
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    cursor: plant ? "pointer" : "default",
                    transition: "all 0.15s",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  {plant ? (
                    <>
                      {plant.image
                        ? <img src={plant.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 6 }} />
                        : <span style={{ fontSize: 22, lineHeight: 1 }}>{plant.emoji}</span>
                      }
                      <div style={{ position: "absolute", bottom: 2, left: 2, right: 2, textAlign: "center", fontSize: 8, fontWeight: 700, color: "#fff", background: typeCol + "cc", borderRadius: 4, padding: "1px 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: "14px" }}>
                        {plant.name}
                      </div>
                    </>
                  ) : (
                    <span style={{ fontSize: 14, color: dark ? "#2a3e2a" : "#c8d8c8" }}>+</span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {popup && popupPlant && (
        <PlantPopup
          plant={popupPlant}
          cell={popup.cell}
          bedId={bed.id}
          onRemove={onRemovePlant}
          onClose={() => setPopup(null)}
          dark={dark}
        />
      )}
    </>
  );
}

// ── Main GardenMap ────────────────────────────────────────────────────────────
export default function GardenMap({ plants, beds, setBeds, onClose, dark }) {
  const [showBedModal, setShowBedModal] = useState(false);
  const [editingBed, setEditingBed]     = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const bg  = dark ? "#0a140a" : "#f0f7f0";
  const ts  = dark ? "#5a7a5a" : "#666";
  const bd  = dark ? "#2a3e2a" : "#e0e0e0";

  // Which plantIds are already placed on any bed
  const placedIds = new Set(
    beds.flatMap(bed => Object.values(bed.cells))
  );
  const unplacedPlants = plants.filter(p => !placedIds.has(p.id));

  // ── Handlers ──
  const handleSaveBed = (bedData) => {
    if (bedData.id && beds.find(b => b.id === bedData.id)) {
      setBeds(prev => prev.map(b => b.id === bedData.id ? { ...b, ...bedData } : b));
    } else {
      setBeds(prev => [...prev, newBed(bedData.name, bedData.rows, bedData.cols, bedData.colorId)]);
    }
    setShowBedModal(false);
    setEditingBed(null);
  };

  const handleDeleteBed = (bedId) => {
    setBeds(prev => prev.filter(b => b.id !== bedId));
    setConfirmDeleteId(null);
  };

  const handleDropPlant = (toBedId, toCell, plantId, fromBedId, fromCell) => {
    setBeds(prev => prev.map(bed => {
      let cells = { ...bed.cells };
      // Remove from source bed
      if (fromBedId && bed.id === fromBedId && fromCell) {
        delete cells[fromCell];
      }
      // Remove this plant from this bed if it was already here
      Object.keys(cells).forEach(k => { if (cells[k] === plantId) delete cells[k]; });
      // Place in target
      if (bed.id === toBedId) {
        cells[toCell] = plantId;
      }
      return { ...bed, cells };
    }));
  };

  const handleRemovePlant = (bedId, cell) => {
    setBeds(prev => prev.map(bed => {
      if (bed.id !== bedId) return bed;
      const cells = { ...bed.cells };
      delete cells[cell];
      return { ...bed, cells };
    }));
  };

  const totalPlaced  = placedIds.size;
  const totalBeds    = beds.length;
  const totalCells   = beds.reduce((s, b) => s + b.rows * b.cols, 0);
  const pctFilled    = totalCells > 0 ? Math.round((totalPlaced / totalCells) * 100) : 0;

  return (
    <div style={{ position: "fixed", inset: 0, background: bg, overflowY: "auto", fontFamily: "system-ui,sans-serif", zIndex: 50 }}>
      {/* Header */}
      <div style={{ background: dark ? "linear-gradient(135deg,#0d1f0d,#162816)" : "linear-gradient(135deg,#1b5e20,#2e7d32)", padding: "16px 24px", position: "sticky", top: 0, zIndex: 10, boxShadow: "0 2px 12px rgba(0,0,0,0.2)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#fff" }}>🗺️ Garden Map</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>
              {totalBeds} bed{totalBeds !== 1 ? "s" : ""} · {totalPlaced}/{plants.length} plants placed · {pctFilled}% filled
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { setEditingBed(null); setShowBedModal(true); }} style={{ background: "#ffd54f", border: "none", borderRadius: 10, padding: "9px 16px", fontSize: 12, fontWeight: 800, cursor: "pointer", color: "#1b5e20" }}>
              + Add Bed
            </button>
            <button onClick={onClose} style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 10, padding: "9px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", color: "#fff" }}>
              ← Back to Collection
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 24px 48px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 20, alignItems: "start" }}>

          {/* ── Left: Unplaced plants ── */}
          <div style={{ background: dark ? "#141f14" : "#fff", borderRadius: 14, border: `1.5px solid ${bd}`, padding: "14px", position: "sticky", top: 80 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: ts, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
              Unplaced ({unplacedPlants.length})
            </div>
            {unplacedPlants.length === 0 ? (
              <div style={{ textAlign: "center", padding: "20px 0", color: ts, fontSize: 12 }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>🌱</div>
                All plants placed!
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {unplacedPlants.map(plant => {
                  const typeCol = TYPE_THEMES[plant.type] || "#455a64";
                  return (
                    <div
                      key={plant.id}
                      draggable
                      onDragStart={e => {
                        e.dataTransfer.setData("plantId", plant.id);
                        e.dataTransfer.setData("fromBed", "");
                        e.dataTransfer.setData("fromCell", "");
                      }}
                      style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 10px", borderRadius: 9, border: `1.5px solid ${typeCol}44`, background: dark ? "#0e1a0e" : typeCol + "11", cursor: "grab", userSelect: "none", transition: "all 0.15s" }}
                    >
                      <span style={{ fontSize: 22, flexShrink: 0 }}>{plant.emoji}</span>
                      <div style={{ overflow: "hidden" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: dark ? "#d4ecd4" : "#1a1a1a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{plant.name}</div>
                        <div style={{ fontSize: 9, color: ts }}>{plant.type}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Legend */}
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${bd}` }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: ts, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>How to use</div>
              {[["Drag", "a plant from this panel onto any empty cell"], ["Click", "a placed plant to view or remove it"], ["Move", "drag a placed plant to a new cell"]].map(([bold, rest]) => (
                <div key={bold} style={{ fontSize: 10, color: ts, marginBottom: 5, lineHeight: 1.5 }}>
                  <strong style={{ color: dark ? "#7aaa7a" : "#2e7d32" }}>{bold}</strong> {rest}
                </div>
              ))}
            </div>
          </div>

          {/* ── Right: Beds ── */}
          <div>
            {beds.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px", color: ts }}>
                <div style={{ fontSize: 56, marginBottom: 14 }}>🌱</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: dark ? "#d4ecd4" : "#1a1a1a", marginBottom: 8 }}>No beds yet</div>
                <div style={{ fontSize: 13, marginBottom: 20 }}>Create your first garden bed to start placing plants</div>
                <button onClick={() => setShowBedModal(true)} style={{ background: "linear-gradient(135deg,#2e7d32,#1b5e20)", border: "none", borderRadius: 12, padding: "12px 24px", fontSize: 14, fontWeight: 700, cursor: "pointer", color: "#fff" }}>
                  + Create First Bed
                </button>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
                {beds.map(bed => (
                  <BedGrid
                    key={bed.id}
                    bed={bed}
                    plants={plants}
                    onDropPlant={handleDropPlant}
                    onRemovePlant={handleRemovePlant}
                    onEditBed={b => { setEditingBed(b); setShowBedModal(true); }}
                    onDeleteBed={id => setConfirmDeleteId(id)}
                    dark={dark}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bed modal */}
      {showBedModal && (
        <BedModal
          existing={editingBed}
          onSave={handleSaveBed}
          onClose={() => { setShowBedModal(false); setEditingBed(null); }}
          dark={dark}
        />
      )}

      {/* Delete confirmation */}
      {confirmDeleteId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 450, padding: 20 }} onClick={() => setConfirmDeleteId(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: dark ? "#141f14" : "#fffdf8", borderRadius: 16, padding: "22px 24px", width: 320, border: `2px solid ${dark ? "#5a2020" : "#ffcdd2"}`, boxShadow: "0 12px 40px rgba(0,0,0,0.35)", fontFamily: "system-ui,sans-serif" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: dark ? "#ef9a9a" : "#c62828", marginBottom: 8 }}>Delete this bed?</div>
            <div style={{ fontSize: 12, color: ts, marginBottom: 18, lineHeight: 1.6 }}>Plants placed in it will return to the unplaced list. This can't be undone.</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => handleDeleteBed(confirmDeleteId)} style={{ flex: 1, padding: "10px 0", background: "#e53935", border: "none", borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Delete</button>
              <button onClick={() => setConfirmDeleteId(null)} style={{ padding: "10px 16px", background: dark ? "#1e2e1e" : "#f0f0f0", border: `1px solid ${bd}`, borderRadius: 10, color: ts, fontSize: 13, cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
