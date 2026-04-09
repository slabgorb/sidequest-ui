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

import { useCallback, useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import {
  Physics,
  RigidBody,
  CuboidCollider,
  ConvexHullCollider,
  RapierRigidBody,
} from "@react-three/rapier";

import { Text } from "@react-three/drei";
import { D20_COLLIDER_VERTICES, D20_RADIUS, computeFaceInfo, readD20Value } from "./d20";

// Precompute face info once at module load — same for every die instance
const FACE_INFO = computeFaceInfo();

// --- Constants ---

/** Velocity threshold for settle detection */
const SETTLE_THRESHOLD = 0.005;
/** Max roll time before force-stopping (ms) */
const MAX_ROLL_TIME = 5000;
/** Tray dimensions (all in Rapier units; half-extents for colliders) */
const TRAY_HALF_WIDTH = 0.5;
const TRAY_HALF_DEPTH = 0.8;
/** Wall half-height — walls extend from y=0 to y=2*WALL_HALF_HEIGHT */
const WALL_HALF_HEIGHT = 0.5;
/** Wall half-thickness — thick enough to prevent tunneling from fast throws */
const WALL_HALF_THICKNESS = 0.2;
/** Drag gesture constants */
const DRAG_HISTORY_SIZE = 5;
const DRAG_HEIGHT = 0.3;

// --- Types ---

export interface ThrowParams {
  position: [number, number, number];
  linearVelocity: [number, number, number];
  angularVelocity: [number, number, number];
  rotation: [number, number, number];
}

interface DragSample {
  x: number;
  z: number;
  t: number;
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
  const visibleHeight = WALL_HALF_HEIGHT * 2; // walls extend from y=0 to y=1.0
  return (
    <group>
      {/* Floor plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} receiveShadow>
        <planeGeometry args={[TRAY_HALF_WIDTH * 2, TRAY_HALF_DEPTH * 2]} />
        <meshStandardMaterial color="#2a1f14" roughness={0.9} />
      </mesh>
      {/* Wall outlines — show the inner playable volume */}
      <lineSegments position={[0, visibleHeight / 2, 0]}>
        <edgesGeometry
          args={[
            new THREE.BoxGeometry(
              TRAY_HALF_WIDTH * 2,
              visibleHeight,
              TRAY_HALF_DEPTH * 2
            ),
          ]}
        />
        <lineBasicMaterial color="#5a4a3a" />
      </lineSegments>
    </group>
  );
}

// --- D20 Mesh with face numbers ---

function FaceLabels() {
  return (
    <>
      {FACE_INFO.map((face, i) => {
        // Position the label slightly above the face surface (along normal)
        const labelPos = face.center.clone().add(
          face.normal.clone().multiplyScalar(0.002)
        );
        // Compute rotation: orient text so its +Z axis matches the face normal
        // (by default Text faces +Z).
        const up = new THREE.Vector3(0, 1, 0);
        const quaternion = new THREE.Quaternion();
        quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), face.normal);
        // If the face is nearly vertical, pick a stable "up" reference
        const euler = new THREE.Euler().setFromQuaternion(quaternion);
        // Suppress unused warning
        void up;

        return (
          <Text
            key={i}
            position={labelPos.toArray()}
            rotation={[euler.x, euler.y, euler.z]}
            fontSize={0.035}
            color="#1a1a1a"
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

function D20Mesh() {
  return (
    <group name="dice">
      <mesh castShadow>
        <icosahedronGeometry args={[D20_RADIUS, 0]} />
        <meshStandardMaterial
          color="#e8e0d0"
          roughness={0.3}
          metalness={0.1}
          flatShading
        />
      </mesh>
      <FaceLabels />
    </group>
  );
}

// --- Physics Die ---

function PhysicsDie({
  throwParams,
  onSettle,
}: {
  throwParams: ThrowParams | null;
  onSettle: (value: number) => void;
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
        <D20Mesh />
      </group>
    </RigidBody>
  );
}

// --- Drag Gesture ---

function useDragThrow(onThrow: (params: ThrowParams) => void) {
  const { camera, size } = useThree();
  const draggingRef = useRef(false);
  const historyRef = useRef<DragSample[]>([]);
  const raycaster = useRef(new THREE.Raycaster()).current;
  const pointer = useRef(new THREE.Vector2()).current;

  const screenToWorld = useCallback(
    (clientX: number, clientY: number): { x: number; z: number } => {
      pointer.x = (clientX / size.width) * 2 - 1;
      pointer.y = -(clientY / size.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      // Intersect with y=DRAG_HEIGHT plane
      const t = (DRAG_HEIGHT - raycaster.ray.origin.y) / raycaster.ray.direction.y;
      const hit = raycaster.ray.origin
        .clone()
        .add(raycaster.ray.direction.clone().multiplyScalar(t));
      return { x: hit.x, z: hit.z };
    },
    [camera, size, pointer, raycaster]
  );

  const handlePointerDown = useCallback(
    (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      draggingRef.current = true;
      historyRef.current = [];
    },
    []
  );

  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      const pos = screenToWorld(e.clientX, e.clientY);
      const history = historyRef.current;
      history.push({ x: pos.x, z: pos.z, t: performance.now() });
      if (history.length > DRAG_HISTORY_SIZE) history.shift();
    };

    const handleUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;

      const history = historyRef.current;
      if (history.length < 2) return;

      // Compute average velocity from drag history
      let totalDx = 0;
      let totalDz = 0;
      let totalDt = 0;
      for (let i = 1; i < history.length; i++) {
        totalDx += history[i].x - history[i - 1].x;
        totalDz += history[i].z - history[i - 1].z;
        totalDt += history[i].t - history[i - 1].t;
      }

      if (totalDt === 0) return;

      const vx = (totalDx / totalDt) * 1000; // per second
      const vz = (totalDz / totalDt) * 1000;
      const speed = Math.sqrt(vx * vx + vz * vz);

      if (speed < 0.5) return; // Too slow, ignore

      const throwSpeed = Math.min(speed * 3, 15);
      const dir = { x: vx / speed, z: vz / speed };

      // Random rotation for visual variety
      const rx = Math.random() * Math.PI * 2;
      const ry = Math.random() * Math.PI * 2;
      const rz = Math.random() * Math.PI * 2;

      onThrow({
        position: [0, 0.5, 0],
        linearVelocity: [
          dir.x * throwSpeed,
          2 + Math.random() * 2, // slight upward loft
          dir.z * throwSpeed,
        ],
        angularVelocity: [
          (Math.random() - 0.5) * 20,
          (Math.random() - 0.5) * 20,
          (Math.random() - 0.5) * 20,
        ],
        rotation: [rx, ry, rz],
      });
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [screenToWorld, onThrow]);

  return handlePointerDown;
}

// --- Pickup Die (pre-throw, draggable) ---

function PickupDie({ onThrow }: { onThrow: (params: ThrowParams) => void }) {
  const handlePointerDown = useDragThrow(onThrow);

  return (
    <group position={[0, D20_RADIUS + 0.01, 0]}>
      <mesh
        castShadow
        onPointerDown={handlePointerDown}
        onPointerOver={() => {
          document.body.style.cursor = "grab";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "default";
        }}
      >
        <icosahedronGeometry args={[D20_RADIUS, 0]} />
        <meshStandardMaterial
          color="#e8e0d0"
          roughness={0.3}
          metalness={0.1}
          flatShading
        />
      </mesh>
      <FaceLabels />
    </group>
  );
}

// --- Main Scene ---

export function DiceScene({
  throwParams,
  rollKey,
  onThrow,
  onSettle,
}: {
  throwParams: ThrowParams | null;
  rollKey: number;
  onThrow: (params: ThrowParams) => void;
  onSettle: (value: number) => void;
}) {
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[2, 4, 1]} intensity={1} castShadow />
      <Physics
        key={rollKey}
        colliders={false}
        interpolate={false}
        timeStep={1 / 120}
        gravity={[0, -9.81, 0]}
      >
        <TrayColliders />
        {throwParams ? (
          <PhysicsDie throwParams={throwParams} onSettle={onSettle} />
        ) : (
          <PickupDie onThrow={onThrow} />
        )}
      </Physics>
      <TrayVisual />
    </>
  );
}
