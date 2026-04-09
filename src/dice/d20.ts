/**
 * D20 icosahedron geometry data.
 *
 * Face centers are positioned slightly outside each triangular face.
 * The dot product of (faceCenter - dieCenter) with the world-up vector
 * determines which face is on top after the die settles.
 *
 * Collider vertices are the 12 vertices of a regular icosahedron,
 * scaled to match the visual mesh.
 */

import * as THREE from "three";

const PHI = (1 + Math.sqrt(5)) / 2;

/**
 * 12 vertices of a regular icosahedron (unit-ish scale).
 * Used for the ConvexHullCollider in Rapier.
 */
export const D20_COLLIDER_VERTICES = new Float32Array([
  -1, PHI, 0,
   1, PHI, 0,
  -1, -PHI, 0,
   1, -PHI, 0,
   0, -1, PHI,
   0,  1, PHI,
   0, -1, -PHI,
   0,  1, -PHI,
   PHI, 0, -1,
   PHI, 0,  1,
  -PHI, 0, -1,
  -PHI, 0,  1,
].map(v => v * 0.08));

/** Die radius for the visual mesh */
export const D20_RADIUS = 0.135;

/**
 * Standard d20 face-to-number mapping.
 * Each face is a triangle defined by 3 vertex indices from IcosahedronGeometry.
 * The number on each face follows the d20 convention where opposite faces sum to 21.
 */
const FACE_INDICES: [number, number, number][] = [
  [0, 11, 5],  [0, 5, 1],   [0, 1, 7],   [0, 7, 10],  [0, 10, 11],
  [1, 5, 9],   [5, 11, 4],  [11, 10, 2],  [10, 7, 6],  [7, 1, 8],
  [3, 9, 4],   [3, 4, 2],   [3, 2, 6],   [3, 6, 8],   [3, 8, 9],
  [4, 9, 5],   [2, 4, 11],  [6, 2, 10],  [8, 6, 7],   [9, 8, 1],
];

// d20 standard numbering: opposite faces sum to 21
const FACE_NUMBERS = [20, 2, 8, 14, 12, 18, 4, 16, 6, 10, 1, 19, 13, 7, 9, 11, 17, 5, 15, 3];

/**
 * Face information: number, center position, and outward normal.
 * The normal is used to orient text meshes so numbers face outward.
 */
export interface FaceInfo {
  number: number;
  center: THREE.Vector3;
  normal: THREE.Vector3;
}

/**
 * Compute face center + normal for all 20 faces in local space.
 */
export function computeFaceInfo(): FaceInfo[] {
  // Icosahedron vertices at unit scale
  const rawVerts = [
    new THREE.Vector3(-1, PHI, 0),
    new THREE.Vector3(1, PHI, 0),
    new THREE.Vector3(-1, -PHI, 0),
    new THREE.Vector3(1, -PHI, 0),
    new THREE.Vector3(0, -1, PHI),
    new THREE.Vector3(0, 1, PHI),
    new THREE.Vector3(0, -1, -PHI),
    new THREE.Vector3(0, 1, -PHI),
    new THREE.Vector3(PHI, 0, -1),
    new THREE.Vector3(PHI, 0, 1),
    new THREE.Vector3(-PHI, 0, -1),
    new THREE.Vector3(-PHI, 0, 1),
  ].map(v => v.normalize().multiplyScalar(D20_RADIUS));

  return FACE_INDICES.map((indices, i) => {
    const [a, b, c] = indices;
    const center = new THREE.Vector3()
      .add(rawVerts[a])
      .add(rawVerts[b])
      .add(rawVerts[c])
      .divideScalar(3);
    // For a regular icosahedron centered at origin, the outward normal
    // of each face is the normalized center position.
    const normal = center.clone().normalize();
    return { number: FACE_NUMBERS[i], center, normal };
  });
}

/**
 * Given a d20 group's world transform, determine which face number is on top.
 * Works by finding the face center with the highest dot product against world-up.
 */
export function readD20Value(group: THREE.Group): number {
  const up = new THREE.Vector3(0, 1, 0);
  const worldPos = new THREE.Vector3();
  const faceCenters = computeFaceInfo();

  group.getWorldPosition(worldPos);

  let bestDot = -Infinity;
  let bestNumber = 1;

  for (const { number, center } of faceCenters) {
    // Transform face center to world space
    const worldCenter = center.clone().applyMatrix4(group.matrixWorld);
    const dir = worldCenter.sub(worldPos).normalize();
    const dot = dir.dot(up);
    if (dot > bestDot) {
      bestDot = dot;
      bestNumber = number;
    }
  }

  return bestNumber;
}
