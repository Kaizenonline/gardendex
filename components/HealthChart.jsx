// components/HealthChart.jsx
// Shows a plant's health over time as a line chart.
// Past: reconstructed from journal entries.
// Future: projected decay from today forward.

import { useState } from "react";
import { getHealthLabel } from "../lib/health";

const CARE_TYPES = new Set(["water", "feed", "prune"]);
const GRACE_DAYS  = 3;
const DECAY_DAYS  = 14;

function computeHealthAt(daysSinceCare) {
  if (daysSinceCare <= GRACE_DAYS) return 100;
  const decayDays = daysSinceCare - GRACE_DAYS;
  return Math.max(0, Math.round(100 - (decayDays / DECAY_DAYS) * 100));
}

/** Build the full timeline of health data points */
function buildTimeline(plant) {
  const now        = Date.now();
  const added      = new Date(plant.dateAdded).getTime();
  const daysOld    = Math.max(1, Math.ceil((now - added) / 864e5));
  const journal    = (plant.journal || []).slice().sort(
    (a, b) => new Date(a.timestamp || a.ts) - new Date(b.timestamp || b.ts)
  );

  // Collect all care events as { dayIndex, type, label }
  const careEvents = journal
    .filter(e => CARE_TYPES.has(e.type))
    .map(e => ({
      dayIndex: Math.round((new Date(e.timestamp || e.ts) - added) / 864e5),
      type:     e.type,
      emoji:    e.emoji,
    }));

  // Build one data point per day, from day 0 to daysOld + 7 (projection)
  const totalDays  = daysOld + 7;
  const points     = [];
  let lastCareDay  = -GRACE_DAYS; // treat "planted" as care event at day 0

  for (let day = 0; day <= totalDays; day++) {
    // Check if care happened on this day
    const cared = careEvents.some(e => e.dayIndex === day);
    if (cared || day === 0) lastCareDay = day;

    const daysSinceCare = day - lastCareDay;
    const health        = computeHealthAt(daysSinceCare);
    const isProjected   = day > daysOld;
    const isToday       = day === daysOld;
    const date          = new Date(added + day * 864e5);

    points.push({ day, health, isProjected, isToday, date, cared: cared && day > 0 });
  }

  return { points, careEvents, daysOld };
}

// ── SVG line chart ────────────────────────────────────────────────────────────
function LineChart({ points, dark, width = 420, height = 140 }) {
  const [hovered, setHovered] = useState(null);

  const PAD = { top: 10, right: 12, bottom: 28, left: 32 };
  const W   = width  - PAD.left - PAD.right;
  const H   = height - PAD.top  - PAD.bottom;

  const maxDay = points[points.length - 1]?.day || 1;
  const xScale = d => PAD.left + (d / maxDay) * W;
  const yScale = v => PAD.top  + H - (v / 100) * H;

  // Split into actual vs projected segments
  const actual    = points.filter(p => !p.isProjected);
  const projected = points.filter(p => p.isProjected || (p.isToday));

  const makePath = (pts) =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"}${xScale(p.day).toFixed(1)},${yScale(p.health).toFixed(1)}`).join(" ");

  // Y grid lines
  const yLines = [0, 25, 50, 75, 100];

  // Colour for a health value
  const hCol = v => v >= 80 ? "#43a047" : v >= 60 ? "#7cb342" : v >= 40 ? "#f9a825" : v >= 20 ? "#e65100" : "#c62828";

  const todayPt = points.find(p => p.isToday);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      style={{ width: "100%", height, display: "block", fontFamily: "system-ui,sans-serif" }}
    >
      {/* Grid lines */}
      {yLines.map(v => (
        <g key={v}>
          <line
            x1={PAD.left} y1={yScale(v)}
            x2={PAD.left + W} y2={yScale(v)}
            stroke={dark ? "#1e2e1e" : "#f0f0f0"}
            strokeWidth="1"
          />
          <text
            x={PAD.left - 5} y={yScale(v) + 4}
            fontSize="9" textAnchor="end"
            fill={dark ? "#3a5a3a" : "#bbb"}
          >{v}</text>
        </g>
      ))}

      {/* Today line */}
      {todayPt && (
        <line
          x1={xScale(todayPt.day)} y1={PAD.top}
          x2={xScale(todayPt.day)} y2={PAD.top + H}
          stroke={dark ? "#4a6a4a" : "#c8e6c9"}
          strokeWidth="1"
          strokeDasharray="3,3"
        />
      )}

      {/* Area fill — actual */}
      {actual.length > 1 && (
        <path
          d={`${makePath(actual)} L${xScale(actual[actual.length-1].day)},${yScale(0)} L${xScale(actual[0].day)},${yScale(0)} Z`}
          fill={dark ? "rgba(46,125,50,0.15)" : "rgba(76,175,80,0.08)"}
        />
      )}

      {/* Line — actual */}
      {actual.length > 1 && (
        <path d={makePath(actual)} fill="none" stroke="#43a047" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      )}

      {/* Line — projected (dashed) */}
      {projected.length > 1 && (
        <path d={makePath(projected)} fill="none" stroke="#78909c" strokeWidth="1.5" strokeDasharray="4,3" strokeLinecap="round" />
      )}

      {/* Care event dots */}
      {points.filter(p => p.cared).map(p => (
        <circle
          key={p.day}
          cx={xScale(p.day)} cy={yScale(p.health)}
          r="5"
          fill="#1e88e5"
          stroke={dark ? "#141f14" : "#fff"}
          strokeWidth="2"
        />
      ))}

      {/* Today dot */}
      {todayPt && (
        <circle
          cx={xScale(todayPt.day)} cy={yScale(todayPt.health)}
          r="6"
          fill={hCol(todayPt.health)}
          stroke={dark ? "#141f14" : "#fff"}
          strokeWidth="2"
        />
      )}

      {/* Hover targets */}
      {points.filter((_, i) => i % 2 === 0).map(p => (
        <rect
          key={p.day}
          x={xScale(p.day) - 8} y={PAD.top}
          width="16" height={H}
          fill="transparent"
          style={{ cursor: "crosshair" }}
          onMouseEnter={() => setHovered(p)}
          onMouseLeave={() => setHovered(null)}
        />
      ))}

      {/* Hover tooltip */}
      {hovered && (() => {
        const x   = xScale(hovered.day);
        const y   = yScale(hovered.health);
        const flip = x > width * 0.65;
        const tx  = flip ? x - 64 : x + 8;
        const ty  = Math.min(y - 4, PAD.top + H - 32);
        const col = hCol(hovered.health);
        return (
          <g>
            <rect x={tx} y={ty} width={58} height={28} rx="6" fill={dark ? "#1a2a1a" : "#fff"} stroke={col} strokeWidth="1.5" />
            <text x={tx + 29} y={ty + 11} fontSize="9" textAnchor="middle" fill={dark ? "#7aaa7a" : "#888"}>
              {hovered.date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </text>
            <text x={tx + 29} y={ty + 22} fontSize="11" textAnchor="middle" fontWeight="700" fill={col}>
              {hovered.health}%
            </text>
          </g>
        );
      })()}

      {/* X axis labels */}
      {(() => {
        const every = Math.max(1, Math.floor(maxDay / 5));
        return points.filter(p => p.day % every === 0 || p.isToday).map(p => (
          <text
            key={p.day}
            x={xScale(p.day)} y={height - 6}
            fontSize="8" textAnchor="middle"
            fill={p.isToday ? (dark ? "#7aaa7a" : "#2e7d32") : (dark ? "#3a5a3a" : "#bbb")}
            fontWeight={p.isToday ? "700" : "400"}
          >
            {p.isToday ? "Today" : p.date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </text>
        ));
      })()}
    </svg>
  );
}

// ── Main HealthChart component ────────────────────────────────────────────────
export default function HealthChart({ plant, dark }) {
  const { points, careEvents, daysOld } = buildTimeline(plant);
  const todayPt  = points.find(p => p.isToday);
  const health   = todayPt?.health ?? 100;
  const info     = getHealthLabel(health);
  const ts       = dark ? "#5a7a5a" : "#666";
  const bd       = dark ? "#2a3e2a" : "#e0e0e0";

  // Next care event in the future
  const nextDrop = points.find(p => p.day > daysOld && p.health < (todayPt?.health ?? 100));
  const daysToWarning = nextDrop ? nextDrop.day - daysOld : null;

  return (
    <div style={{ fontFamily: "system-ui,sans-serif" }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: ts, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>Health Over Time</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ height: 7, flex: 1, background: dark ? "#2a3e2a" : "#e0e0e0", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${health}%`, background: info.color, borderRadius: 4, transition: "width 0.5s" }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: info.color }}>{health}%</span>
            <span style={{ fontSize: 12 }}>{info.icon}</span>
            <span style={{ fontSize: 12, color: info.color, fontWeight: 600 }}>{info.label}</span>
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 10, color: ts }}>{careEvents.length} care events</div>
          {daysToWarning !== null && daysToWarning > 0 && (
            <div style={{ fontSize: 10, color: "#f9a825", marginTop: 2 }}>⚠ drops in {daysToWarning}d</div>
          )}
        </div>
      </div>

      {/* Chart */}
      <div style={{ background: dark ? "#0e1a0e" : "#f8fdf8", borderRadius: 12, padding: "10px 8px 4px", border: `1px solid ${bd}`, marginBottom: 10 }}>
        <LineChart points={points} dark={dark} />
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, fontSize: 10, color: ts, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <svg width="20" height="6"><line x1="0" y1="3" x2="20" y2="3" stroke="#43a047" strokeWidth="2.5"/></svg>
          Actual health
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <svg width="20" height="6"><line x1="0" y1="3" x2="20" y2="3" stroke="#78909c" strokeWidth="1.5" strokeDasharray="4,3"/></svg>
          Projected (no care)
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <svg width="10" height="10"><circle cx="5" cy="5" r="4" fill="#1e88e5"/></svg>
          Care event
        </div>
      </div>

      {/* Recent care log */}
      {plant.journal?.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: ts, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
            Care history
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 160, overflowY: "auto" }}>
            {plant.journal
              .slice()
              .sort((a, b) => new Date(b.timestamp || b.ts) - new Date(a.timestamp || a.ts))
              .map(entry => (
                <div key={entry.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 8, background: dark ? "#1a2a1c" : "#f8fdf8", border: `1px solid ${bd}` }}>
                  <span style={{ fontSize: 14, flexShrink: 0 }}>{entry.emoji}</span>
                  <div style={{ flex: 1, overflow: "hidden" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: dark ? "#c8e4c8" : "#2a2a2a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.text}</div>
                  </div>
                  <div style={{ fontSize: 9, color: ts, flexShrink: 0 }}>
                    {new Date(entry.timestamp || entry.ts).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      )}
    </div>
  );
}
