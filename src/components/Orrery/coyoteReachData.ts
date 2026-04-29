// Coyote Reach orrery data — derived from
// sidequest-content/genre_packs/space_opera/worlds/coyote_reach/cartography.yaml.
//
// This is a hand-authored mirror today; the long-term path is a build-time
// JSON snapshot or a REST endpoint (`/api/world/coyote_reach/cartography`)
// that the renderer fetches. When that lands, replace this constant with
// fetched data — the OrreryView component takes data as a prop precisely
// so this swap is a one-line change.

import type { OrreryData } from "./types";

export const COYOTE_REACH_ORRERY: OrreryData = {
  star: { id: "coyote", name: "COYOTE" },

  // Per-body angular state at the rendered moment. Today these are picked
  // aesthetically (Far Landing and Deep Root in near conjunction at the
  // start, Red Prospect on the far side, moons spread around their parent).
  // When kinematics land, derive from (epoch, orbital_period_days).
  moment: {
    trueAnomalyDeg: {
      far_landing: 25,
      deep_root_world: 32,
      new_claim: 250,
      red_prospect: 210,
      grand_gate: 145,
    },
    moonAngleDeg: {
      // Far Landing's moon
      tethys_watch: 35,
      // Deep Root's moons
      kerel_eye: 200,
      lower_kerel: -75,
      // Red Prospect's six moons
      ember_moon: 70,
      vael_thain: 140,
      turning_hub: -30,
      whitedrift: 60,
      dead_lash: -95,
      the_horn: 25,
    },
  },

  bodies: [
    // ---- Inner system ----
    {
      id: "far_landing",
      name: "FAR LANDING",
      kind: "planet",
      semi_major_axis_au: 1.0,
      eccentricity: 0.02,
      perihelion_deg: 18,
      tags: ["habitable", "settlement", "authority"],
    },
    {
      id: "tethys_watch",
      name: "tethys watch",
      kind: "moon",
      parent: "far_landing",
      parent_orbit_radius_km: 580000,
      eccentricity: 0.05,
      perihelion_deg: 35,
      tags: ["surveillance"],
    },
    {
      id: "deep_root_world",
      name: "DEEP ROOT WORLD",
      kind: "planet",
      semi_major_axis_au: 1.07,
      eccentricity: 0.03,
      perihelion_deg: 42,
      tags: ["habitable", "alien_territory", "sacred"],
    },
    {
      id: "kerel_eye",
      name: "kerel-eye",
      kind: "moon",
      parent: "deep_root_world",
      parent_orbit_radius_km: 420000,
      eccentricity: 0.04,
      perihelion_deg: 80,
      tags: ["sacred", "alien_territory", "unvisited"],
    },
    {
      id: "lower_kerel",
      name: "lower kerel",
      kind: "moon",
      parent: "deep_root_world",
      parent_orbit_radius_km: 185000,
      eccentricity: 0.01,
      perihelion_deg: -20,
      tags: ["restricted"],
    },

    // ---- Inner Lagrange ----
    {
      id: "gravel_orchard",
      name: "GRAVEL ORCHARD",
      kind: "lagrange",
      lagrange_pair: ["coyote", "far_landing"],
      lagrange_point: "L4",
      tags: ["lagrange", "salvage"],
    },
    {
      id: "dead_mans_drift",
      name: "DEAD MAN'S DRIFT",
      kind: "lagrange",
      lagrange_pair: ["coyote", "far_landing"],
      lagrange_point: "L5",
      tags: ["lagrange", "lawless"],
    },

    // ---- Belt & outer-belt body ----
    {
      id: "broken_drift",
      name: "BROKEN DRIFT",
      kind: "belt",
      semi_major_axis_au: 2.5,
      inner_au: 2.2,
      outer_au: 3.0,
      tags: ["mining", "salvage", "lawless"],
    },
    {
      id: "new_claim",
      name: "NEW CLAIM",
      kind: "dwarf_body",
      semi_major_axis_au: 2.92,
      eccentricity: 0.08,
      perihelion_deg: 0,
      tags: ["mining", "industrial"],
    },

    // ---- Gas giant system ----
    {
      id: "red_prospect",
      name: "RED PROSPECT",
      kind: "gas_giant",
      semi_major_axis_au: 5.24,
      eccentricity: 0.05,
      perihelion_deg: -22,
      tags: ["gas_giant", "fuel", "voidborn"],
    },
    {
      id: "ember_moon",
      name: "Ember",
      kind: "moon",
      parent: "red_prospect",
      parent_orbit_radius_km: 1055000,
      eccentricity: 0.04,
      perihelion_deg: 15,
      tags: ["volcanic", "lethal"],
    },
    {
      id: "vael_thain",
      name: "vael thain",
      kind: "moon",
      parent: "red_prospect",
      parent_orbit_radius_km: 1675000,
      eccentricity: 0.02,
      perihelion_deg: -50,
      tags: ["sacred", "alien_territory", "forbidden"],
    },
    {
      id: "turning_hub",
      name: "Turning Hub",
      kind: "station",
      parent: "red_prospect",
      parent_orbit_radius_km: 1955000,
      eccentricity: 0.01,
      perihelion_deg: 110,
      provenance: "voidborn-built",
      tags: ["station", "voidborn", "neutral"],
    },
    {
      id: "whitedrift",
      name: "Whitedrift",
      kind: "moon",
      parent: "red_prospect",
      parent_orbit_radius_km: 2250000,
      eccentricity: 0.02,
      perihelion_deg: -30,
      tags: ["water", "contested"],
    },
    {
      id: "dead_lash",
      name: "Dead Lash",
      kind: "moon",
      parent: "red_prospect",
      parent_orbit_radius_km: 3250000,
      eccentricity: 0.03,
      perihelion_deg: 60,
      provenance: "hegemonic-issue",
      tags: ["abandoned", "surveillance"],
    },
    {
      id: "the_horn",
      name: "The Horn · e≈0.4",
      kind: "irregular_moon",
      parent: "red_prospect",
      parent_orbit_radius_km: 4050000,
      eccentricity: 0.42,
      inclination_deg: 24,
      perihelion_deg: 25,
      provenance: "pre-collapse-relic",
      tags: ["smuggler", "ancient"],
    },

    // ---- Mid-system Lagrange ----
    {
      id: "compact_anchorage",
      name: "COMPACT ANCHORAGE",
      kind: "lagrange",
      lagrange_pair: ["coyote", "red_prospect"],
      lagrange_point: "L4",
      tags: ["lagrange", "voidborn"],
    },
    {
      id: "the_counter",
      name: "THE COUNTER",
      kind: "lagrange",
      lagrange_pair: ["coyote", "red_prospect"],
      lagrange_point: "L3",
      tags: ["lagrange", "blind_spot"],
    },

    // ---- Outer ----
    {
      id: "grand_gate",
      name: "GRAND  GATE",
      kind: "jump_point_station",
      semi_major_axis_au: 6.5,
      eccentricity: 0.01,
      perihelion_deg: 0,
      provenance: "hegemonic-issue",
      tags: ["jump_point", "authority"],
    },
    {
      id: "last_drift",
      name: "the  Last  Drift",
      kind: "outer_system_zone",
      semi_major_axis_au: 10.0,
      inner_au: 7.5,
      outer_au: 15.0,
      tags: ["outer_system", "mystery"],
    },
  ],

  anomalies: [
    {
      id: "the_absent_gate",
      name: "absent gate",
      kind: "absent_gate",
      parent: "last_drift",
      bearing_deg: -40, // math: lower-right quadrant
      radius_au: 10.5,
    },
    {
      id: "the_hum_field",
      name: "The Hum Field",
      kind: "hum_field",
      parent: "last_drift",
      bearing_deg: -145, // math: lower-left quadrant
      radius_au: 9.0,
      label_above: true,
    },
  ],
};
