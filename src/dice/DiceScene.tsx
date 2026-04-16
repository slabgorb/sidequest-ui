/**
 * DiceScene — Physics world with a d20 die and tray.
 *
 * Patterns learned from Owlbear Rodeo's architecture (clean-room):
 * - Fixed timestep (1/120) with no interpolation for deterministic replay
 * - Settle detection: linear + angular velocity below threshold
 * - Face reading via locator dot product against world-up
 * - Tray colliders: floor (leather-like friction) + walls (bouncy)
 * - Force-stop timeout after 5 seconds
 */

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useLoader } from "@react-three/fiber";
import { TextureLoader } from "three";
import {
  Physics,
  RigidBody,
  CuboidCollider,
  ConvexHullCollider,
  RapierRigidBody,
} from "@react-three/rapier";

import { Text } from "@react-three/drei";
import { D20_COLLIDER_VERTICES, D20_RADIUS, computeFaceInfo, readD20Value } from "./d20";
import { useDiceThrowGesture } from "./useDiceThrowGesture";

// drei's <Text> uses troika-three-text. Two bugs landed here in quick
// succession:
//   1. troika-three-text v0.52+ defaults `defaultFontURL` to `null` — if no
//      `font` prop is passed at all, the render suspends forever waiting for
//      a font that never loads, and R3F's internal Suspense boundary hides
//      the entire canvas (dice, tray, lights). Fixed by passing an explicit
//      `font={FACE_LABEL_FONT}` prop below.
//   2. troika-three-text's OpenType parser only supports `.ttf`/`.otf` —
//      NOT `.woff2`. Pointing it at a `@fontsource-variable/*` `?url` (which
//      ships `.woff2` only) causes troika to throw "woff2 fonts not
//      supported", which *also* triggers the Suspense-hide symptom — same
//      visual bug, different root cause. Fixed by serving a real `.ttf`
//      from `/public/fonts/Inter-Bold.ttf` (Google Fonts, OFL).
// Story 34-12 — physics-is-the-roll close-out.
const FACE_LABEL_FONT = "/fonts/Inter-Bold.ttf";
const BASTARDA_FONT = "/fonts/Bastarda-K.ttf";

// Precompute face info once at module load — same for every die instance
const FACE_INFO = computeFaceInfo();

// --- Constants ---

/** Velocity threshold for settle detection */
const SETTLE_THRESHOLD = 0.005;
/** Max roll time before force-stopping (ms) */
const MAX_ROLL_TIME = 5000;
/** Tray dimensions — wide enough for wall bounces, deep to use vertical panel space */
const TRAY_HALF_WIDTH = 0.8;
const TRAY_HALF_DEPTH = 0.8;
/** Wall half-height — walls extend from y=0 to y=2*WALL_HALF_HEIGHT */
const WALL_HALF_HEIGHT = 0.5;
/** Wall half-thickness — thick enough to prevent tunneling from fast throws */
const WALL_HALF_THICKNESS = 0.2;
// --- Types ---

export interface ThrowParams {
  position: [number, number, number];
  linearVelocity: [number, number, number];
  angularVelocity: [number, number, number];
  rotation: [number, number, number];
}

// --- Tray Colliders ---

function TrayColliders() {
  // Sealed box: floor, 4 walls, ceiling. Walls extend outward past the
  // visual tray and overlap at corners to eliminate gaps. Ceiling sits
  // directly at wall-top so there's no escape hatch over the walls.
  const wallTop = WALL_HALF_HEIGHT * 2; // y=1.0
  // Walls extend past the tray edges by WALL_HALF_THICKNESS so corners overlap
  const wallX = TRAY_HALF_WIDTH + WALL_HALF_THICKNESS;
  const wallZ = TRAY_HALF_DEPTH + WALL_HALF_THICKNESS;

  return (
    <group>
      {/* Floor — thick slab, high friction */}
      <RigidBody type="fixed" friction={10} restitution={0.3}>
        <CuboidCollider
          args={[wallX, 0.2, wallZ]}
          position={[0, -0.2, 0]}
        />
      </RigidBody>
      {/* Walls + ceiling — one rigid body, lower friction + higher bounce */}
      <RigidBody type="fixed" friction={1} restitution={0.6}>
        {/* Front wall (-Z) */}
        <CuboidCollider
          args={[wallX, WALL_HALF_HEIGHT, WALL_HALF_THICKNESS]}
          position={[0, WALL_HALF_HEIGHT, -(TRAY_HALF_DEPTH + WALL_HALF_THICKNESS)]}
        />
        {/* Back wall (+Z) */}
        <CuboidCollider
          args={[wallX, WALL_HALF_HEIGHT, WALL_HALF_THICKNESS]}
          position={[0, WALL_HALF_HEIGHT, TRAY_HALF_DEPTH + WALL_HALF_THICKNESS]}
        />
        {/* Left wall (-X) */}
        <CuboidCollider
          args={[WALL_HALF_THICKNESS, WALL_HALF_HEIGHT, wallZ]}
          position={[-(TRAY_HALF_WIDTH + WALL_HALF_THICKNESS), WALL_HALF_HEIGHT, 0]}
        />
        {/* Right wall (+X) */}
        <CuboidCollider
          args={[WALL_HALF_THICKNESS, WALL_HALF_HEIGHT, wallZ]}
          position={[TRAY_HALF_WIDTH + WALL_HALF_THICKNESS, WALL_HALF_HEIGHT, 0]}
        />
        {/* Ceiling — seals the top directly at wall top */}
        <CuboidCollider
          args={[wallX, 0.1, wallZ]}
          position={[0, wallTop + 0.1, 0]}
        />
      </RigidBody>
    </group>
  );
}

// --- Tray Visual (simple wireframe box for the spike) ---

function TrayVisual() {
  return (
    <group>
      {/* Shadow-catching floor — transparent material that only shows shadows,
          so the die appears to roll on whatever surface the panel provides. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} receiveShadow>
        <planeGeometry args={[TRAY_HALF_WIDTH * 2, TRAY_HALF_DEPTH * 2]} />
        <shadowMaterial opacity={0.3} />
      </mesh>
      {/* No wall outlines — skeuomorphic: die rolls on the bare surface */}
    </group>
  );
}

// --- D20 Mesh with face numbers ---

function FaceLabels({ color = "#1a1a1a", font = FACE_LABEL_FONT }: { color?: string; font?: string }) {
  return (
    <>
      {FACE_INFO.map((face, i) => {
        // Position the label slightly above the face surface (along normal)
        const labelPos = face.center.clone().add(
          face.normal.clone().multiplyScalar(0.002)
        );

        return (
          <Text
            key={i}
            font={font}
            position={labelPos.toArray()}
            quaternion={face.quaternion}
            fontSize={0.085}
            color={color}
            anchorX="center"
            anchorY="middle"
            fontWeight={700}
          >
            {face.number}
          </Text>
        );
      })}
    </>
  );
}

/** Die appearance — driven by genre. */
export interface DiceTheme {
  /** Die body color */
  dieColor: string;
  /** Face number color */
  labelColor: string;
  /** Font URL for face numbers (.ttf only — troika doesn't support .woff2) */
  labelFont?: string;
  /** Surface roughness (0 = glossy, 1 = matte) */
  roughness?: number;
  /** Metalness (0 = plastic, 1 = chrome) */
  metalness?: number;
  /** Normal map URL for surface detail (scratches, pitting, wear) */
  normalMap?: string;
  /** Normal map intensity (default 1.0) */
  normalScale?: number;
}

export const DEFAULT_DICE_THEME: DiceTheme = {
  dieColor: "#e8e0d0",   // ivory
  labelColor: "#1a1a1a", // near-black
  roughness: 0.3,
  metalness: 0.1,
  normalMap: "/textures/dice/scratched-plastic-normal.jpg",
  normalScale: 0.15,
};

function D20Mesh({ theme = DEFAULT_DICE_THEME }: { theme?: DiceTheme }) {
  // Load normal map if specified. useLoader suspends until loaded.
  const normalTex = useLoader(
    TextureLoader,
    theme.normalMap ?? "/textures/dice/scratched-plastic-normal.jpg",
  );
  normalTex.wrapS = normalTex.wrapT = THREE.RepeatWrapping;

  const normalScaleVec = useMemo(
    () => new THREE.Vector2(theme.normalScale ?? 0.5, theme.normalScale ?? 0.5),
    [theme.normalScale],
  );

  return (
    <group name="dice">
      <mesh castShadow>
        <icosahedronGeometry args={[D20_RADIUS, 0]} />
        <meshStandardMaterial
          color={theme.dieColor}
          roughness={theme.roughness ?? 0.3}
          metalness={theme.metalness ?? 0.1}
          normalMap={normalTex}
          normalScale={normalScaleVec}
          flatShading
        />
      </mesh>
      <FaceLabels color={theme.labelColor} font={theme.labelFont ?? FACE_LABEL_FONT} />
    </group>
  );
}

// --- Physics Die ---

function PhysicsDie({
  throwParams,
  onSettle,
  theme,
}: {
  throwParams: ThrowParams | null;
  onSettle: (value: number) => void;
  theme?: DiceTheme;
}) {
  const rigidBodyRef = useRef<RapierRigidBody>(null);
  const groupRef = useRef<THREE.Group>(null);
  const settledRef = useRef(false);
  const throwTimeRef = useRef(0);

  // Reset when new throw arrives
  useEffect(() => {
    settledRef.current = false;
    throwTimeRef.current = performance.now();
  }, [throwParams]);

  // Per-frame settle detection
  useFrame(() => {
    const rb = rigidBodyRef.current;
    const group = groupRef.current;
    if (!rb || !group || settledRef.current || !throwParams) return;

    const lin = rb.linvel();
    const ang = rb.angvel();
    const speed =
      Math.sqrt(lin.x * lin.x + lin.y * lin.y + lin.z * lin.z) +
      Math.sqrt(ang.x * ang.x + ang.y * ang.y + ang.z * ang.z);

    const elapsed = performance.now() - throwTimeRef.current;
    const forceStop = elapsed > MAX_ROLL_TIME;

    if (speed < SETTLE_THRESHOLD || forceStop) {
      if (forceStop) console.warn("Dice exceeded max roll time, force-stopping");
      settledRef.current = true;

      // Lock the body
      rb.setEnabledRotations(false, false, false, false);
      rb.setEnabledTranslations(false, false, false, false);
      rb.setLinvel({ x: 0, y: 0, z: 0 }, false);
      rb.setAngvel({ x: 0, y: 0, z: 0 }, false);

      const value = readD20Value(group);
      onSettle(value);
    }
  });

  if (!throwParams) return null;

  return (
    <RigidBody
      ref={rigidBodyRef}
      gravityScale={3}
      density={2}
      friction={0.2}
      restitution={0.3}
      position={throwParams.position}
      rotation={throwParams.rotation}
      linearVelocity={throwParams.linearVelocity}
      angularVelocity={throwParams.angularVelocity}
      colliders={false}
      ccd // continuous collision detection: prevents tunneling at high speeds
    >
      <group ref={groupRef}>
        <ConvexHullCollider args={[D20_COLLIDER_VERTICES]} />
        <D20Mesh theme={theme} />
      </group>
    </RigidBody>
  );
}

// --- Pickup Die (pre-throw, idle with fidget spin) ---

function PickupDie({ onThrow, theme }: { onThrow: (params: ThrowParams) => void; theme?: DiceTheme }) {
  const { onPointerDown: handlePointerDown } = useDiceThrowGesture({ onThrow });
  const groupRef = useRef<THREE.Group>(null);
  // Idle fidget: angular velocity with friction decay. Random kicks
  // give it a "snap-spin on the table" feel.
  const spinRef = useRef({
    vx: 0, vy: 0,
    nextKick: performance.now() + 2000 + Math.random() * 4000,
  });

  useFrame((_state, delta) => {
    const group = groupRef.current;
    if (!group) return;
    const spin = spinRef.current;
    const now = performance.now();

    // Random kick — like flicking the die with a finger
    if (now > spin.nextKick) {
      spin.vy = (Math.random() - 0.5) * 8;
      spin.vx = (Math.random() - 0.5) * 3;
      spin.nextKick = now + 5000 + Math.random() * 10000;
    }

    // Friction decay
    const friction = Math.pow(0.15, delta); // ~85% per second
    spin.vx *= friction;
    spin.vy *= friction;

    group.rotation.y += spin.vy * delta;
    group.rotation.x += spin.vx * delta;
  });

  return (
    <group ref={groupRef} position={[0, D20_RADIUS + 0.01, 0]}>
      <D20Mesh theme={theme} />
    </group>
  );
}

// --- Main Scene ---

export function DiceScene({
  throwParams,
  rollKey,
  onThrow,
  onSettle,
  theme,
}: {
  throwParams: ThrowParams | null;
  rollKey: number;
  onThrow: (params: ThrowParams) => void;
  onSettle: (value: number) => void;
  theme?: DiceTheme;
}) {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[2, 4, 1]} intensity={1.2} castShadow />
      <Physics
        key={rollKey}
        colliders={false}
        interpolate={false}
        timeStep={1 / 120}
        gravity={[0, -9.81, 0]}
      >
        <TrayColliders />
        {throwParams ? (
          <PhysicsDie throwParams={throwParams} onSettle={onSettle} theme={theme} />
        ) : (
          <PickupDie onThrow={onThrow} theme={theme} />
        )}
      </Physics>
      <TrayVisual />
    </>
  );
}
