// OrreryView — Star Wars: A New Hope HUD render of a star-system orrery.
//
// Style guide: the Coyote Star Orrery design exemplar (claude.ai/design,
// 2026-04-29) — black ground, brass-amber phosphor lines (#f5d020), red
// accents (#e62a18), VT323 + Orbitron for type. The bundled HTML was the
// approved style-only spec; this component is data-driven from the
// cartography numerics (semi_major_axis_au, parent_orbit_radius_km,
// eccentricity, etc.) so any world that supplies the data shape can be
// rendered. See ./types.ts.
//
// Today the only consumer is /orrery (a dev route) showing
// COYOTE_STAR_ORRERY. The component takes data as a prop so a future
// integration with game state (current_region in hierarchical mode) drops
// in without rewriting the renderer.

import { useEffect, useRef } from "react";
import {
  HUB_PX,
  auToPx,
  bodyHelioPosition,
  ellipseCenter,
  ellipseSemiMinor,
  mathToScreenDeg,
  moonKeplerOffset,
  moonKmToPx,
} from "./geometry";
import type {
  OrreryAnomaly,
  OrreryBody,
  OrreryData,
} from "./types";

const VIEW = 1200;
const BRASS = "#f5d020";
const RED = "#e62a18";
const BG = "#000";

interface OrreryViewProps {
  data: OrreryData;
}

export function OrreryView({ data }: OrreryViewProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const viewportRef = useRef<SVGGElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  // Pan/zoom is imperative on the viewport <g>'s transform attribute —
  // matches the design's approach and avoids re-rendering ~700 elements
  // on every wheel event.
  useEffect(() => {
    const svg = svgRef.current;
    const vp = viewportRef.current;
    const stage = stageRef.current;
    if (!svg || !vp || !stage) return;

    const MIN = 0.6;
    const MAX = 8;
    let scale = 1;
    let tx = 0;
    let ty = 0;

    const apply = () => {
      vp.setAttribute(
        "transform",
        `translate(${tx} ${ty}) scale(${scale})`,
      );
      stage.classList.toggle("orrery-zoomed-in", scale > 1.05);
    };

    const clientToSvg = (cx: number, cy: number): [number, number] => {
      const rect = svg.getBoundingClientRect();
      return [
        ((cx - rect.left) / rect.width) * VIEW,
        ((cy - rect.top) / rect.height) * VIEW,
      ];
    };

    const zoomAt = (cx: number, cy: number, factor: number) => {
      const [sx, sy] = clientToSvg(cx, cy);
      const wx = (sx - tx) / scale;
      const wy = (sy - ty) / scale;
      const next = Math.min(MAX, Math.max(MIN, scale * factor));
      if (next === scale) return;
      scale = next;
      tx = sx - wx * scale;
      ty = sy - wy * scale;
      apply();
    };

    const reset = () => {
      scale = 1;
      tx = 0;
      ty = 0;
      apply();
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015));
    };

    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    const onPointerDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      stage.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const rect = svg.getBoundingClientRect();
      tx += ((e.clientX - lastX) / rect.width) * VIEW;
      ty += ((e.clientY - lastY) / rect.height) * VIEW;
      lastX = e.clientX;
      lastY = e.clientY;
      apply();
    };
    const onPointerUp = (e: PointerEvent) => {
      dragging = false;
      try {
        stage.releasePointerCapture(e.pointerId);
      } catch {
        /* released before capture started — fine */
      }
    };
    const onDblClick = (e: MouseEvent) => {
      if (scale > 1.05) reset();
      else zoomAt(e.clientX, e.clientY, 2.5);
    };
    const onKey = (e: KeyboardEvent) => {
      const r = stage.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      if (e.key === "+" || e.key === "=") zoomAt(cx, cy, 1.5);
      else if (e.key === "-" || e.key === "_") zoomAt(cx, cy, 1 / 1.5);
      else if (e.key === "0") reset();
    };

    stage.addEventListener("wheel", onWheel, { passive: false });
    stage.addEventListener("pointerdown", onPointerDown);
    stage.addEventListener("pointermove", onPointerMove);
    stage.addEventListener("pointerup", onPointerUp);
    stage.addEventListener("pointercancel", onPointerUp);
    stage.addEventListener("dblclick", onDblClick);
    window.addEventListener("keydown", onKey);

    // Expose imperative buttons via inline handlers below.
    (stage as HTMLDivElement & { __orreryReset?: () => void; __orreryZoom?: (f: number) => void }).__orreryReset = reset;
    (stage as HTMLDivElement & { __orreryReset?: () => void; __orreryZoom?: (f: number) => void }).__orreryZoom = (f: number) => {
      const r = stage.getBoundingClientRect();
      zoomAt(r.left + r.width / 2, r.top + r.height / 2, f);
    };

    return () => {
      stage.removeEventListener("wheel", onWheel);
      stage.removeEventListener("pointerdown", onPointerDown);
      stage.removeEventListener("pointermove", onPointerMove);
      stage.removeEventListener("pointerup", onPointerUp);
      stage.removeEventListener("pointercancel", onPointerUp);
      stage.removeEventListener("dblclick", onDblClick);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const callImperative = (fn: "__orreryReset" | "__orreryZoom", arg?: number) => {
    const stage = stageRef.current as
      | (HTMLDivElement & { __orreryReset?: () => void; __orreryZoom?: (f: number) => void })
      | null;
    if (!stage) return;
    if (fn === "__orreryReset") stage.__orreryReset?.();
    else stage.__orreryZoom?.(arg ?? 1.5);
  };

  return (
    <div className="orrery-root">
      <style>{`
        .orrery-root, .orrery-root * { box-sizing: border-box; }
        .orrery-root {
          position: relative; width: 100%; height: 100%;
          background: ${BG}; overflow: hidden; user-select: none;
        }
        .orrery-toolbar {
          position: absolute; top: 16px; left: 50%; transform: translateX(-50%);
          z-index: 10; display: flex; gap: 6px; padding: 8px 10px;
          background: rgba(0,0,0,0.92); border: 1px solid ${BRASS};
          box-shadow: 0 0 0 1px rgba(245,208,32,0.3);
          font-family: 'Orbitron', sans-serif; font-size: 10px;
          letter-spacing: 3px; color: ${BRASS};
        }
        .orrery-toolbar button {
          background: ${BG}; border: 1px solid ${BRASS}; color: ${BRASS};
          font-family: inherit; font-size: 10px; letter-spacing: 2px;
          padding: 5px 10px; cursor: pointer; min-width: 30px; font-weight: 600;
        }
        .orrery-toolbar button:hover { background: ${BRASS}; color: ${BG}; }
        .orrery-toolbar .sep { width: 1px; background: ${BRASS}; margin: 2px 4px; opacity: 0.5; }
        .orrery-toolbar .hint { padding: 5px 6px; opacity: 0.7; font-style: italic; text-transform: lowercase; letter-spacing: 1px; }
        .orrery-stage {
          width: 100%; height: 100%; overflow: hidden; cursor: grab;
          background: ${BG}; position: relative;
        }
        .orrery-stage:active { cursor: grabbing; }
        .orrery-stage.orrery-zoomed-in { cursor: zoom-out; }
        .orrery-stage svg { display: block; width: 100%; height: 100%; touch-action: none; }
        .orrery-halo { paint-order: stroke fill; stroke: ${BG}; stroke-width: 2.4px; stroke-linejoin: round; }
      `}</style>

      <div className="orrery-toolbar">
        <button title="Zoom out" onClick={() => callImperative("__orreryZoom", 1 / 1.5)}>−</button>
        <button title="Zoom in" onClick={() => callImperative("__orreryZoom", 1.5)}>+</button>
        <div className="sep" />
        <button title="Reset view" onClick={() => callImperative("__orreryReset")}>RESET</button>
        <div className="hint">scroll · drag · dbl-click</div>
      </div>

      <div className="orrery-stage" ref={stageRef}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW} ${VIEW}`}
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label={`Orrery of the ${data.star.name} star system`}
        >
          <defs>
            <pattern id="orrery-stipple" x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse">
              <rect x="14" y="14" width="2" height="2" fill={BRASS} />
              <rect x="2" y="22" width="1.5" height="1.5" fill={BRASS} opacity="0.7" />
              <rect x="24" y="4" width="1.5" height="1.5" fill={RED} opacity="0.8" />
            </pattern>
            <symbol id="orrery-stamp-square" viewBox="-10 -10 20 20">
              <rect x="-7" y="-7" width="14" height="14" fill={BRASS} stroke="#1a1812" strokeWidth="0.8" />
              <rect x="-4" y="-4" width="8" height="8" fill="none" stroke="#1a1812" strokeWidth="0.5" opacity="0.7" />
            </symbol>
            <symbol id="orrery-stamp-diamond" viewBox="-10 -10 20 20">
              <polygon points="0,-8 8,0 0,8 -8,0" fill={BRASS} stroke="#1a1812" strokeWidth="0.8" />
              <circle cx="0" cy="0" r="1.4" fill="#1a1812" />
            </symbol>
            <symbol id="orrery-stamp-cross" viewBox="-10 -10 20 20">
              <circle cx="0" cy="0" r="7.5" fill={BRASS} stroke="#1a1812" strokeWidth="0.7" />
              <line x1="-7" y1="0" x2="7" y2="0" stroke="#1a1812" strokeWidth="1.6" />
              <line x1="0" y1="-7" x2="0" y2="7" stroke="#1a1812" strokeWidth="1.6" />
            </symbol>
            <symbol id="orrery-struck-pin" viewBox="-14 -14 28 28">
              <g stroke="#0a0805" strokeWidth="0.6">
                <polygon points="0,-12 2.5,-2.5 12,0 2.5,2.5 0,12 -2.5,2.5 -12,0 -2.5,-2.5" fill={BRASS} />
                <polygon points="0,-7 1.4,-1.4 7,0 1.4,1.4 0,7 -1.4,1.4 -7,0 -1.4,-1.4" fill="#3a2810" />
              </g>
              <circle cx="0" cy="0" r="1.6" fill="#f1d089" />
            </symbol>
          </defs>

          <g ref={viewportRef}>
            {/* Background */}
            <rect x="0" y="0" width={VIEW} height={VIEW} fill={BG} />

            {/* Bearing rose */}
            <BearingRose />

            {/* Engraved orbit rings (planets + Red Prospect + belt edges) */}
            <OrbitRings bodies={data.bodies} />

            {/* Asteroid belt — stippled annulus */}
            <Belt bodies={data.bodies} />

            {/* Coyote (the star, with reticle) */}
            <CoyoteStar name={data.star.name} />

            {/* Inner & mid-system planets and their moons */}
            {data.bodies
              .filter((b) => b.kind === "planet" || b.kind === "gas_giant" || b.kind === "dwarf_body" || b.kind === "jump_point_station")
              .map((b) => (
                <PlanetGroup key={b.id} body={b} data={data} />
              ))}

            {/* Lagrange points */}
            {data.bodies
              .filter((b) => b.kind === "lagrange")
              .map((b) => (
                <LagrangeMark key={b.id} body={b} data={data} />
              ))}

            {/* Outer system zone (Last Drift + anomalies) */}
            <OuterSystem
              zone={data.bodies.find((b) => b.kind === "outer_system_zone")}
              anomalies={data.anomalies}
            />

            {/* Scale bar */}
            <ScaleBar />
          </g>
        </svg>
      </div>
    </div>
  );
}

// ---- Sub-components ------------------------------------------------------

function BearingRose() {
  // 36 ticks every 10°, longer every 30°, longest every 90°.
  const ticks = [];
  for (let deg = 0; deg < 360; deg += 10) {
    const isCardinal = deg % 90 === 0;
    const isMajor = !isCardinal && deg % 30 === 0;
    const inner = isCardinal ? 69 : isMajor ? 71 : 75;
    const sw = isCardinal ? 0.7 : isMajor ? 0.6 : 0.4;
    ticks.push(
      <g key={deg} transform={`rotate(${-deg})`} stroke={BRASS} strokeWidth={sw} fill="none">
        <line x1="0" y1="-78" x2="0" y2={`${-inner}`} />
      </g>,
    );
  }
  return (
    <g transform={`translate(${HUB_PX.x},${HUB_PX.y})`} fontFamily="'Orbitron',serif" fill={BRASS} className="orrery-halo">
      <circle r="78" fill="none" stroke={BRASS} strokeWidth="0.6" opacity="0.85" />
      <circle r="84" fill="none" stroke={BRASS} strokeWidth="0.3" opacity="0.6" />
      {ticks}
      <g fontSize="9" letterSpacing="1.5" fill={BRASS}>
        <text x="92" y="3" textAnchor="start">000°</text>
        <text x="0" y="-88" textAnchor="middle">090°</text>
        <text x="-92" y="3" textAnchor="end">180°</text>
        <text x="0" y="96" textAnchor="middle">270°</text>
      </g>
      <g>
        <line x1="78" y1="0" x2="98" y2="0" stroke={BRASS} strokeWidth="0.7" />
        <polygon points="98,0 92,-2.4 92,2.4" fill={BRASS} stroke={BRASS} strokeWidth="0.3" />
      </g>
    </g>
  );
}

function OrbitRings({ bodies }: { bodies: OrreryBody[] }) {
  return (
    <g fill="none" stroke={BRASS} strokeLinecap="round">
      {bodies
        .filter((b) => b.semi_major_axis_au !== undefined && b.kind !== "lagrange" && b.kind !== "outer_system_zone")
        .map((b) => {
          const a_px = auToPx(b.semi_major_axis_au!);
          const e = b.eccentricity ?? 0;
          const { cx, cy } = ellipseCenter(a_px, e);
          const ry = ellipseSemiMinor(a_px, e);
          const rotDeg = mathToScreenDeg(b.perihelion_deg ?? 0);
          const sw = b.kind === "gas_giant" ? 1.8 : b.kind === "planet" ? 1.6 : 0.8;
          const dash = b.kind === "jump_point_station" ? "4 4" : undefined;
          return (
            <ellipse
              key={`ring-${b.id}`}
              cx={cx}
              cy={cy}
              rx={a_px}
              ry={ry}
              transform={`rotate(${rotDeg} ${HUB_PX.x} ${HUB_PX.y})`}
              strokeWidth={sw}
              strokeDasharray={dash}
              opacity={b.kind === "jump_point_station" ? 0.85 : 1}
            />
          );
        })}
    </g>
  );
}

function Belt({ bodies }: { bodies: OrreryBody[] }) {
  const belt = bodies.find((b) => b.kind === "belt");
  if (!belt || belt.inner_au === undefined || belt.outer_au === undefined) return null;
  const inner = auToPx(belt.inner_au);
  const outer = auToPx(belt.outer_au);
  return (
    <g>
      <mask id="orrery-belt-mask">
        <rect x="0" y="0" width={VIEW} height={VIEW} fill="black" />
        <ellipse cx={HUB_PX.x} cy={HUB_PX.y} rx={outer} ry={outer} fill="white" />
        <ellipse cx={HUB_PX.x} cy={HUB_PX.y} rx={inner} ry={inner} fill="black" />
      </mask>
      <rect x="0" y="0" width={VIEW} height={VIEW} fill="url(#orrery-stipple)" mask="url(#orrery-belt-mask)" opacity="0.85" />
      {/* engraved boundary rings */}
      <ellipse cx={HUB_PX.x} cy={HUB_PX.y} rx={inner} ry={inner} fill="none" stroke={BRASS} strokeWidth="0.5" opacity="0.7" />
      <ellipse cx={HUB_PX.x} cy={HUB_PX.y} rx={outer} ry={outer} fill="none" stroke={BRASS} strokeWidth="0.5" opacity="0.7" />
      <g fontFamily="'VT323',monospace" fill={BRASS} className="orrery-halo">
        <path id="orrery-belt-path" d={`M ${HUB_PX.x},${HUB_PX.y} m -${(inner + outer) / 2},0 a ${(inner + outer) / 2},${(inner + outer) / 2} 0 0,1 ${inner + outer},0`} fill="none" />
        <text fontSize="13" letterSpacing="3">
          <textPath href="#orrery-belt-path" startOffset="50%" textAnchor="middle">
            — {belt.name.toLowerCase()} —
          </textPath>
        </text>
      </g>
    </g>
  );
}

function CoyoteStar({ name }: { name: string }) {
  return (
    <g>
      <circle cx={HUB_PX.x} cy={HUB_PX.y} r="28" fill="none" stroke={RED} strokeWidth="2" />
      <circle cx={HUB_PX.x} cy={HUB_PX.y} r="20" fill="none" stroke={RED} strokeWidth="1.2" />
      <g stroke={RED} strokeWidth="2" strokeLinecap="square">
        <line x1={HUB_PX.x} y1={HUB_PX.y - 34} x2={HUB_PX.x} y2={HUB_PX.y - 22} />
        <line x1={HUB_PX.x} y1={HUB_PX.y + 22} x2={HUB_PX.x} y2={HUB_PX.y + 34} />
        <line x1={HUB_PX.x - 34} y1={HUB_PX.y} x2={HUB_PX.x - 22} y2={HUB_PX.y} />
        <line x1={HUB_PX.x + 22} y1={HUB_PX.y} x2={HUB_PX.x + 34} y2={HUB_PX.y} />
      </g>
      <circle cx={HUB_PX.x} cy={HUB_PX.y} r="6" fill={BRASS} />
      <g fontFamily="'Orbitron',sans-serif" fill={RED} letterSpacing="4" className="orrery-halo">
        <text x={HUB_PX.x} y={HUB_PX.y - 48} textAnchor="middle" fontSize="11" fontWeight="700">{name}</text>
      </g>
    </g>
  );
}

function isTsveriBlank(body: OrreryBody): boolean {
  const t = body.tags ?? [];
  return t.includes("forbidden") || (t.includes("sacred") && t.includes("alien_territory"));
}

function PlanetGroup({ body, data }: { body: OrreryBody; data: OrreryData }) {
  const pos = bodyHelioPosition(body, data.bodies, data.moment.trueAnomalyDeg);
  if (!pos) return null;

  const moons = data.bodies.filter((b) => b.parent === body.id);

  if (body.kind === "gas_giant") {
    return (
      <g id={`orrery-${body.id}`}>
        <GasGiantBody pos={pos} />
        <g transform={`translate(${pos.x},${pos.y})`}>
          {moons.map((m) => (
            <MoonOnGasGiant key={m.id} moon={m} angleDeg={data.moment.moonAngleDeg[m.id] ?? 0} />
          ))}
        </g>
        <g fontFamily="'Orbitron',sans-serif" fill={RED} className="orrery-halo">
          <text x={pos.x - 30} y={pos.y + 52} fontSize="14" fontWeight="700" letterSpacing="2">{body.name}</text>
        </g>
      </g>
    );
  }

  if (body.kind === "jump_point_station") {
    // Special render: struck pin glyph.
    return (
      <g id={`orrery-${body.id}`}>
        <g opacity="0.9">
          <circle cx={pos.x} cy={pos.y} r="34" fill="none" stroke={BRASS} strokeWidth="0.6" strokeDasharray="2 3" />
          <circle cx={pos.x} cy={pos.y} r="22" fill="none" stroke={BRASS} strokeWidth="0.4" strokeDasharray="1 4" />
        </g>
        <use href="#orrery-struck-pin" x={pos.x - 17} y={pos.y - 17} width="34" height="34" />
        <g fontFamily="'Orbitron',serif" fill={BRASS} letterSpacing="3" className="orrery-halo">
          <text x={pos.x} y={pos.y - 38} textAnchor="middle" fontSize="12">{body.name}</text>
        </g>
        <g fontFamily="'VT323',monospace" fill={BRASS} fontSize="10" className="orrery-halo">
          <text x={pos.x} y={pos.y + 48} textAnchor="middle">jump-point — struck and held</text>
        </g>
      </g>
    );
  }

  // Generic planet / dwarf_body
  const r = body.kind === "planet" ? 11 : 7;
  const rCore = body.kind === "planet" ? 3.5 : 2;
  const sw = body.kind === "planet" ? 1.6 : 1.2;
  return (
    <g id={`orrery-${body.id}`}>
      <circle cx={pos.x} cy={pos.y} r={r} fill="none" stroke={BRASS} strokeWidth={sw} />
      <circle cx={pos.x} cy={pos.y} r={rCore} fill={BRASS} />

      {/* Claim flag for mining bodies */}
      {body.tags?.includes("mining") && (
        <g stroke={RED} strokeWidth="1" fill="none">
          <rect x={pos.x - 12} y={pos.y - 11} width="6" height="6" />
        </g>
      )}

      {/* Moons */}
      <g transform={`translate(${pos.x},${pos.y})`}>
        {moons.map((m) => (
          <MoonOnPlanet
            key={m.id}
            moon={m}
            angleDeg={data.moment.moonAngleDeg[m.id] ?? 0}
          />
        ))}
      </g>

      <g fontFamily="'Orbitron',sans-serif" fill={BRASS} className="orrery-halo">
        <text
          x={pos.x + (body.kind === "planet" ? 18 : 12)}
          y={pos.y + 3}
          fontSize={body.kind === "planet" ? 13 : 11}
          fontWeight={body.kind === "planet" ? 700 : 600}
          letterSpacing={body.kind === "planet" ? "1.5" : "2"}
        >
          {body.name}
        </text>
      </g>

      {/* Moon labels — primary's first moon gets a sub-label */}
      {moons.length > 0 && body.kind === "planet" && (
        <g fontFamily="'VT323',monospace" fill={BRASS} fontSize="11" opacity="0.85" className="orrery-halo">
          <text x={pos.x + 18} y={pos.y + 22}>{moons[0].name}</text>
        </g>
      )}
    </g>
  );
}

function GasGiantBody({ pos }: { pos: { x: number; y: number } }) {
  return (
    <g>
      <circle cx={pos.x} cy={pos.y} r="22" fill="none" stroke={RED} strokeWidth="2" />
      <circle cx={pos.x} cy={pos.y} r="14" fill="none" stroke={RED} strokeWidth="1.2" />
      <circle cx={pos.x} cy={pos.y} r="6" fill={RED} />
      <circle cx={pos.x} cy={pos.y} r="9" fill="none" stroke={RED} strokeWidth="0.5" opacity="0.6" />
      <circle cx={pos.x} cy={pos.y} r="18" fill="none" stroke={RED} strokeWidth="0.5" opacity="0.6" />
    </g>
  );
}

function MoonOnPlanet({
  moon,
  angleDeg,
}: {
  moon: OrreryBody;
  angleDeg: number;
}) {
  if (moon.parent_orbit_radius_km === undefined) return null;
  const e = moon.eccentricity ?? 0;
  const omega = moon.perihelion_deg ?? 0;
  const offset = moonKeplerOffset(moon.parent_orbit_radius_km, e, "planet", angleDeg, omega);
  const a_px = moonKmToPx(moon.parent_orbit_radius_km, "planet");
  const b_px = a_px * Math.sqrt(1 - e * e);
  const tsveri = isTsveriBlank(moon);
  // Orbit ellipse: focus at parent (origin), pre-rotation center at (−a*e, 0),
  // rotated by mathToScreenDeg(omega) so perihelion ends up at math-angle ω.
  return (
    <g>
      <ellipse
        cx={-a_px * e}
        cy={0}
        rx={a_px}
        ry={b_px}
        transform={`rotate(${mathToScreenDeg(omega)})`}
        fill="none"
        stroke={tsveri ? RED : BRASS}
        strokeWidth="0.6"
        strokeDasharray="2 3"
        opacity="0.7"
      />
      <g transform={`translate(${offset.x},${offset.y})`}>
        {tsveri ? (
          <rect x="-3" y="-3" width="6" height="6" fill="none" stroke={RED} strokeWidth="1" strokeDasharray="2 1" />
        ) : (
          <circle cx="0" cy="0" r="2" fill={BRASS} />
        )}
      </g>
    </g>
  );
}

function MoonOnGasGiant({ moon, angleDeg }: { moon: OrreryBody; angleDeg: number }) {
  if (moon.parent_orbit_radius_km === undefined) return null;
  const e = moon.eccentricity ?? 0;
  const omega = moon.perihelion_deg ?? 0;
  const inc = moon.inclination_deg ?? 0;
  const a_px = moonKmToPx(moon.parent_orbit_radius_km, "gas_giant");
  const b_px = a_px * Math.sqrt(1 - e * e);

  // The Horn — irregular, eccentric, inclined. Render the orbit as a tilted
  // ellipse with focus at parent and body at its actual ν (apoapsis if ν=180°).
  // The same Kepler math drives the inclined orbit too, applied within an
  // outer rotation that simulates inclination as a 2D tilt of the projected
  // orbit (good enough for a top-down HUD).
  if (moon.kind === "irregular_moon") {
    const offset = moonKeplerOffset(moon.parent_orbit_radius_km, e, "gas_giant", angleDeg, omega);
    return (
      <g transform={`rotate(${inc})`}>
        <ellipse
          cx={-a_px * e}
          cy={0}
          rx={a_px}
          ry={b_px}
          transform={`rotate(${mathToScreenDeg(omega)})`}
          fill="none"
          stroke={BRASS}
          strokeWidth="0.5"
          strokeDasharray="3 3"
          opacity="0.85"
        />
        <g transform={`translate(${offset.x},${offset.y})`}>
          <polygon points="-4,-3 4,-3.5 6,0 3,4 -3,4 -5,1" fill={BRASS} stroke="#000" strokeWidth="0.4" />
          <text x="8" y="-4" fontFamily="'VT323',monospace" fontSize="10" fill={BRASS} className="orrery-halo">
            {moon.name}
          </text>
        </g>
      </g>
    );
  }

  const offset = moonKeplerOffset(moon.parent_orbit_radius_km, e, "gas_giant", angleDeg, omega);
  const tsveri = isTsveriBlank(moon);
  const isStation = moon.kind === "station";
  const isAbandoned = moon.tags?.includes("abandoned");
  const stroke = tsveri ? RED : BRASS;

  return (
    <g>
      <ellipse
        cx={-a_px * e}
        cy={0}
        rx={a_px}
        ry={b_px}
        transform={`rotate(${mathToScreenDeg(omega)})`}
        fill="none"
        stroke={stroke}
        strokeWidth={tsveri ? 0.5 : 0.6}
        strokeDasharray={tsveri ? "1 3" : "2 3"}
        opacity={tsveri ? 0.7 : 0.85}
      />
      <g transform={`translate(${offset.x},${offset.y})`}>
        {tsveri ? (
          <g stroke={RED} strokeWidth="1" fill="none">
            <rect x="-3.5" y="-3.5" width="7" height="7" strokeDasharray="2 1" />
            {/* corner brackets */}
            <line x1="-6" y1="-6" x2="-3" y2="-6" />
            <line x1="-6" y1="-6" x2="-6" y2="-3" />
            <line x1="6" y1="-6" x2="3" y2="-6" />
            <line x1="6" y1="-6" x2="6" y2="-3" />
            <line x1="-6" y1="6" x2="-3" y2="6" />
            <line x1="-6" y1="6" x2="-6" y2="3" />
            <line x1="6" y1="6" x2="3" y2="6" />
            <line x1="6" y1="6" x2="6" y2="3" />
          </g>
        ) : isStation ? (
          <rect x="-4" y="-4" width="8" height="8" fill={BRASS} stroke="#000" strokeWidth="0.4" />
        ) : isAbandoned ? (
          <g>
            <circle cx="0" cy="0" r="2.6" fill={BRASS} />
            <line x1="-4" y1="-4" x2="4" y2="4" stroke={BRASS} strokeWidth="0.7" />
            <line x1="4" y1="-4" x2="-4" y2="4" stroke={BRASS} strokeWidth="0.7" />
          </g>
        ) : (
          <circle cx="0" cy="0" r={moon.tags?.includes("water") ? 3.6 : moon.tags?.includes("volcanic") ? 3 : 2.6} fill={moon.tags?.includes("volcanic") ? RED : BRASS} />
        )}
      </g>
      {!tsveri && (
        <text
          x={offset.x + 10}
          y={offset.y + 3}
          fontFamily="'VT323',monospace"
          fontSize="10"
          fill={BRASS}
          className="orrery-halo"
        >
          {moon.name}
        </text>
      )}
      {tsveri && (
        <text
          x={offset.x - 6}
          y={offset.y + 3}
          textAnchor="end"
          fontFamily="'VT323',monospace"
          fontSize="10"
          fill={RED}
          className="orrery-halo"
        >
          [ {moon.name} ]
        </text>
      )}
    </g>
  );
}

function LagrangeMark({ body, data }: { body: OrreryBody; data: OrreryData }) {
  const pos = bodyHelioPosition(body, data.bodies, data.moment.trueAnomalyDeg);
  if (!pos) return null;
  const stamp =
    body.lagrange_point === "L4" || body.lagrange_point === "L5"
      ? "orrery-stamp-diamond"
      : body.lagrange_point === "L3"
        ? "orrery-stamp-cross"
        : "orrery-stamp-square";
  const subscript =
    body.lagrange_point === "L4" ? "L₄"
      : body.lagrange_point === "L5" ? "L₅"
        : body.lagrange_point === "L3" ? "L₃"
          : body.lagrange_point;
  const pairLabel =
    body.lagrange_pair && body.lagrange_pair[1]
      ? `${subscript} ⌇ ${body.lagrange_pair[0] === "coyote" ? "Sun" : body.lagrange_pair[0]}–${pretty(body.lagrange_pair[1], data.bodies)}`
      : subscript;

  return (
    <g id={`orrery-${body.id}`}>
      <use href={`#${stamp}`} x={pos.x - 11} y={pos.y - 11} width="22" height="22" />
      <g fontFamily="'Orbitron',sans-serif" fill={BRASS} letterSpacing="2" className="orrery-halo">
        <text x={pos.x + 14} y={pos.y - 4} fontSize="10">{body.name}</text>
      </g>
      <g fontFamily="'VT323',monospace" fill={BRASS} fontSize="9" className="orrery-halo">
        <text x={pos.x + 14} y={pos.y + 8}>{pairLabel}</text>
      </g>
    </g>
  );
}

function pretty(id: string, bodies: OrreryBody[]): string {
  const b = bodies.find((x) => x.id === id);
  if (!b) return id;
  return b.name
    .split(/\s+/)
    .map((w) => w[0] + w.slice(1).toLowerCase())
    .join(" ");
}

function OuterSystem({
  zone,
  anomalies,
}: {
  zone: OrreryBody | undefined;
  anomalies: OrreryAnomaly[];
}) {
  if (!zone || zone.inner_au === undefined || zone.outer_au === undefined) return null;
  const inner = auToPx(zone.inner_au);
  const outer = auToPx(zone.outer_au);
  return (
    <g id="orrery-outer-system">
      {/* dashed annular boundaries */}
      <ellipse cx={HUB_PX.x} cy={HUB_PX.y} rx={inner} ry={inner} fill="none" stroke={BRASS} strokeWidth="0.7" strokeDasharray="3 4" opacity="0.85" />
      <ellipse cx={HUB_PX.x} cy={HUB_PX.y} rx={outer} ry={outer} fill="none" stroke={BRASS} strokeWidth="0.7" strokeDasharray="3 4" opacity="0.85" />

      {/* zone label */}
      <path id="orrery-last-drift-path" d={`M ${HUB_PX.x},${HUB_PX.y} m 0,-${(inner + outer) / 2 + 20} a ${(inner + outer) / 2 + 20},${(inner + outer) / 2 + 20} 0 1,1 -1,0`} fill="none" />
      <g fontFamily="'VT323',monospace" fill={BRASS} opacity="0.9" className="orrery-halo">
        <text fontSize="22" letterSpacing="14">
          <textPath href="#orrery-last-drift-path" startOffset="76%">— {zone.name} —</textPath>
        </text>
      </g>

      {anomalies.map((a) => (
        <Anomaly key={a.id} anomaly={a} />
      ))}
    </g>
  );
}

function Anomaly({ anomaly }: { anomaly: OrreryAnomaly }) {
  const r = auToPx(anomaly.radius_au);
  const a = anomaly.bearing_deg * (Math.PI / 180);
  const x = HUB_PX.x + r * Math.cos(a);
  const y = HUB_PX.y - r * Math.sin(a);

  if (anomaly.kind === "absent_gate") {
    return (
      <g id={`orrery-${anomaly.id}`}>
        <circle cx={x} cy={y} r="26" fill="none" stroke={BRASS} strokeWidth="0.7" strokeDasharray="2 4" opacity="0.75" />
        <circle cx={x} cy={y} r="14" fill="none" stroke={BRASS} strokeWidth="0.5" strokeDasharray="1 3" opacity="0.7" />
        <text x={x} y={y + 10} textAnchor="middle" fontFamily="'VT323',monospace" fontSize="36" fill={BRASS} opacity="0.95">?</text>
        <g fontFamily="'VT323',monospace" fill={BRASS} fontSize="11" opacity="0.85" className="orrery-halo">
          <text x={x} y={y - 36} textAnchor="middle">— {anomaly.name} —</text>
        </g>
        <g stroke={BRASS} strokeWidth="0.5" opacity="0.7">
          <line x1={x - 16} y1={y - 16} x2={x - 12} y2={y - 12} />
          <line x1={x - 12} y1={y - 16} x2={x - 16} y2={y - 12} />
          <line x1={x + 14} y1={y + 16} x2={x + 18} y2={y + 20} />
          <line x1={x + 18} y1={y + 16} x2={x + 14} y2={y + 20} />
        </g>
      </g>
    );
  }

  // hum_field
  return (
    <g id={`orrery-${anomaly.id}`}>
      <path
        d={`M ${x - 60},${y - 25} C ${x - 100},${y - 45} ${x - 90},${y + 25} ${x - 50},${y + 45} C ${x - 10},${y + 65} ${x + 40},${y + 65} ${x + 70},${y + 35} C ${x + 100},${y + 5} ${x + 90},${y - 45} ${x + 50},${y - 55} C ${x + 10},${y - 70} ${x - 20},${y - 55} ${x - 40},${y - 45} Z`}
        fill="none"
        stroke={BRASS}
        strokeWidth="0.6"
        strokeDasharray="2 3"
        opacity="0.7"
      />
      <g stroke={BRASS} fill="none" strokeWidth="0.4" opacity="0.55">
        <ellipse cx={x} cy={y} rx="60" ry="38" />
        <ellipse cx={x} cy={y} rx="42" ry="26" />
        <ellipse cx={x} cy={y} rx="22" ry="14" />
      </g>
      <g stroke={BRASS} strokeWidth="0.7" opacity="0.85">
        <line x1={x - 5} y1={y - 5} x2={x + 5} y2={y + 5} />
        <line x1={x + 5} y1={y - 5} x2={x - 5} y2={y + 5} />
      </g>
      <g fontFamily="'VT323',monospace" fill={BRASS} className="orrery-halo">
        <text x={x} y={anomaly.label_above ? y - 60 : y + 70} textAnchor="middle" fontSize="13">{anomaly.name}</text>
      </g>
    </g>
  );
}

function ScaleBar() {
  const TICKS = [0, 1, 2, 3, 4, 5];
  // 60 px/AU is the design's nominal — we use log scaling but the bar still
  // labels AU at the canonical 1-unit pitch for human reading.
  const PITCH = 36;
  return (
    <g transform={`translate(940,1080)`} fontFamily="'VT323',monospace" fill={BRASS} className="orrery-halo">
      <line x1="0" y1="0" x2={5 * PITCH} y2="0" stroke={BRASS} strokeWidth="0.8" />
      <g stroke={BRASS} strokeWidth="0.8">
        {TICKS.map((t) => (
          <line key={t} x1={t * PITCH} y1={t === 0 || t === 5 ? -5 : -3} x2={t * PITCH} y2={t === 0 || t === 5 ? 5 : 3} />
        ))}
      </g>
      {TICKS.map((t) => (
        <text key={t} x={t * PITCH} y="22" textAnchor="middle" fontSize="11">{t === 5 ? "5 AU" : t}</text>
      ))}
      <text x={2.5 * PITCH} y="-10" textAnchor="middle" fontSize="10" opacity="0.85">scale (engraved)</text>
    </g>
  );
}
