// Orrery body data shape — mirrors the relevant subset of cartography.yaml's
// world_graph nodes. Only fields the renderer reads live here. Adding a field
// to this type is the contract for a new visual treatment.

export type OrreryBodyKind =
  | "planet"
  | "gas_giant"
  | "moon"
  | "irregular_moon"
  | "station"
  | "belt"
  | "dwarf_body"
  | "lagrange"
  | "jump_point_station"
  | "outer_system_zone";

export type LagrangePoint = "L1" | "L2" | "L3" | "L4" | "L5";

export type Provenance =
  | "natural"
  | "voidborn-built"
  | "hegemonic-issue"
  | "frontier-improvised"
  | "alien"
  | "pre-collapse-relic";

export interface OrreryBody {
  id: string;
  name: string;
  kind: OrreryBodyKind;
  parent?: string;
  /** Heliocentric semi-major axis (AU). Required for star-orbiting bodies. */
  semi_major_axis_au?: number;
  /** Moon-around-parent radius (km). Required for moons / parent-orbiting stations. */
  parent_orbit_radius_km?: number;
  /** Orbital eccentricity. Default 0 if absent. */
  eccentricity?: number;
  /** Inclination from the system ecliptic (deg). Visualization only. */
  inclination_deg?: number;
  /** Argument of periapsis — orientation of the ellipse's perihelion (deg, CCW from +x in math, screen-CW). */
  perihelion_deg?: number;
  /** Belt zone bounds (AU). Both required for kind=belt or outer_system_zone. */
  inner_au?: number;
  outer_au?: number;
  /** Lagrange relation. */
  lagrange_pair?: [string, string];
  lagrange_point?: LagrangePoint;
  provenance?: Provenance;
  tags?: string[];
}

export interface OrreryAnomaly {
  id: string;
  name: string;
  kind: "absent_gate" | "hum_field";
  /** Where in the parent zone (e.g. last_drift) to render — given as polar offset from the star. */
  bearing_deg: number;
  radius_au: number;
  parent: string;
  label_above?: boolean;
}

/** Per-body presentation hints — picked once today, eventually computed from epoch + period. */
export interface OrreryMoment {
  /** Map from body id → current true anomaly (deg). Lagrange points derive from their pair's secondary angle. */
  trueAnomalyDeg: Record<string, number>;
  /** Map from moon id → current angle around its parent (deg). */
  moonAngleDeg: Record<string, number>;
}

export interface OrreryData {
  bodies: OrreryBody[];
  anomalies: OrreryAnomaly[];
  moment: OrreryMoment;
  /** Star metadata (label, glow color). */
  star: { id: string; name: string };
}
