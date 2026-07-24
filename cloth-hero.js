import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const canvas = document.getElementById('bottleCanvas');
const container = document.getElementById('modelContainer');
const resetButton = document.getElementById('clothReset');

if (!canvas || !container) {
  throw new Error('The Golabii cloth hero is missing its canvas.');
}

const GRID_SIZE = 31;
const PARTICLE_COUNT = GRID_SIZE * GRID_SIZE;
const CLOTH_WIDTH = 1.05;
const CLOTH_LENGTH = 2.34;
const FIXED_STEP = 1 / 120;
const SOLVER_ITERATIONS = 6;
const GROUND_Y = -0.515;
const GRAVITY = -3.8;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);

const camera = new THREE.PerspectiveCamera(26, 1, 0.01, 20);
camera.position.set(0, 0.035, 2.35);
camera.lookAt(0, 0.015, 0);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: 'high-performance'
});

renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
renderer.setClearColor(0xffffff, 1);

const world = new THREE.Group();
world.position.y = -0.015;
scene.add(world);

const hemiLight = new THREE.HemisphereLight(0xfff8ef, 0x7e3342, 1.45);
scene.add(hemiLight);

const keyLight = new THREE.DirectionalLight(0xfff1d4, 2.35);
keyLight.position.set(-2.8, 3.5, 4);
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0xffbac0, 1.25);
rimLight.position.set(3, 1.8, -2.4);
scene.add(rimLight);

const pmremGenerator = new THREE.PMREMGenerator(renderer);
const roomEnvironment = new RoomEnvironment();
const environmentTarget = pmremGenerator.fromScene(roomEnvironment, 0.04);
scene.environment = environmentTarget.texture;
scene.environmentIntensity = 0.9;
roomEnvironment.dispose();
pmremGenerator.dispose();

function createShadowTexture() {
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 256;
  shadowCanvas.height = 128;
  const context = shadowCanvas.getContext('2d');
  const gradient = context.createRadialGradient(128, 64, 2, 128, 64, 112);
  gradient.addColorStop(0, 'rgba(45, 15, 22, 0.32)');
  gradient.addColorStop(0.38, 'rgba(45, 15, 22, 0.16)');
  gradient.addColorStop(1, 'rgba(45, 15, 22, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 128);
  const texture = new THREE.CanvasTexture(shadowCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const shadow = new THREE.Mesh(
  new THREE.PlaneGeometry(0.88, 0.42),
  new THREE.MeshBasicMaterial({
    map: createShadowTexture(),
    transparent: true,
    depthWrite: false,
    opacity: 0.86
  })
);
shadow.rotation.x = -Math.PI / 2;
shadow.position.set(0.035, GROUND_Y + 0.003, 0.025);
world.add(shadow);

function createWeaveNormalMap() {
  const size = 96;
  const data = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const warp = Math.sin((x / size) * Math.PI * 24);
      const weft = Math.sin((y / size) * Math.PI * 20);
      const diagonal = Math.sin(((x + y) / size) * Math.PI * 8);
      const offset = (y * size + x) * 4;
      data[offset] = 128 + Math.round(warp * 12 + diagonal * 3);
      data[offset + 1] = 128 + Math.round(weft * 9 - diagonal * 3);
      data[offset + 2] = 246;
      data[offset + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(7, 7);
  texture.needsUpdate = true;
  return texture;
}

class SilkCloth {
  constructor() {
    this.positions = new Float32Array(PARTICLE_COUNT * 3);
    this.velocities = new Float32Array(PARTICLE_COUNT * 3);
    this.previousPositions = new Float32Array(PARTICLE_COUNT * 3);
    this.coveredPositions = new Float32Array(PARTICLE_COUNT * 3);
    this.holdActive = true;
    this.grab = null;

    this.createCoveredShape();
    this.createConstraints();
    this.createMesh();
  }

  index(x, y) {
    return y * GRID_SIZE + x;
  }

  createCoveredShape() {
    for (let y = 0; y < GRID_SIZE; y += 1) {
      for (let x = 0; x < GRID_SIZE; x += 1) {
        const materialX = (x / (GRID_SIZE - 1) - 0.5) * CLOTH_WIDTH;
        const materialZ = (y / (GRID_SIZE - 1) - 0.5) * CLOTH_LENGTH;
        const sidePath = Math.max(0, Math.abs(materialX) - 0.15);
        const hangingPath = Math.max(0, Math.abs(materialZ) - 0.13);
        const combinedDrop = Math.hypot(hangingPath, sidePath * 0.86);
        const sideFold =
          Math.sin(materialX * 43 + materialZ * 4.5) *
          Math.min(0.004, hangingPath * 0.005);
        const drapeX =
          Math.min(Math.abs(materialX), 0.15) +
          0.08 * (1 - Math.exp(-sidePath * 8)) +
          sidePath * 0.05;
        const drapeZ =
          Math.min(Math.abs(materialZ), 0.13) +
          0.11 * (1 - Math.exp(-hangingPath * 6)) +
          hangingPath * 0.03;
        const wrinkle =
          (Math.sin(materialX * 45) +
            Math.sin(materialX * 19 + 1.1) * 0.42) *
          0.008 *
          (0.3 + Math.min(1, hangingPath / 0.34));
        const topCurve =
          (1 - Math.min(1, hangingPath / 0.16)) *
          Math.pow(Math.min(Math.abs(materialX), 0.15) / 0.15, 2) *
          0.012;

        const px =
          Math.sign(materialX) * drapeX + sideFold;
        const pz =
          Math.sign(materialZ) * drapeZ +
          (materialZ >= 0 ? wrinkle : -wrinkle);
        const py =
          0.522 -
          combinedDrop * 0.985 -
          topCurve -
          Math.min(0.012, hangingPath * 0.012) *
            Math.cos(materialX * 28);

        const offset = this.index(x, y) * 3;
        this.positions[offset] = px;
        this.positions[offset + 1] = Math.max(GROUND_Y + 0.004, py);
        this.positions[offset + 2] = pz;
      }
    }

    this.coveredPositions.set(this.positions);
  }

  createConstraints() {
    const indicesA = [];
    const indicesB = [];
    const restLengths = [];
    const compliances = [];
    const spacingX = CLOTH_WIDTH / (GRID_SIZE - 1);
    const spacingY = CLOTH_LENGTH / (GRID_SIZE - 1);

    const addConstraint = (a, b, restLength, compliance) => {
      indicesA.push(a);
      indicesB.push(b);
      restLengths.push(restLength);
      compliances.push(compliance);
    };

    for (let y = 0; y < GRID_SIZE; y += 1) {
      for (let x = 0; x < GRID_SIZE; x += 1) {
        const current = this.index(x, y);

        if (x + 1 < GRID_SIZE) {
          addConstraint(current, this.index(x + 1, y), spacingX, 2e-5);
        }

        if (y + 1 < GRID_SIZE) {
          addConstraint(current, this.index(x, y + 1), spacingY, 2e-5);
        }

        if (x + 1 < GRID_SIZE && y + 1 < GRID_SIZE) {
          const diagonalRest = Math.hypot(spacingX, spacingY);
          addConstraint(
            current,
            this.index(x + 1, y + 1),
            diagonalRest,
            5e-5
          );
          addConstraint(
            this.index(x + 1, y),
            this.index(x, y + 1),
            diagonalRest,
            5e-5
          );
        }

        if (x + 2 < GRID_SIZE) {
          addConstraint(current, this.index(x + 2, y), spacingX * 2, 1e-5);
        }

        if (y + 2 < GRID_SIZE) {
          addConstraint(current, this.index(x, y + 2), spacingY * 2, 1e-5);
        }
      }
    }

    this.constraintA = new Uint16Array(indicesA);
    this.constraintB = new Uint16Array(indicesB);
    this.restLengths = new Float32Array(restLengths);
    this.compliances = new Float32Array(compliances);
    this.lambdas = new Float32Array(restLengths.length);
  }

  createMesh() {
    const indices = new Uint16Array((GRID_SIZE - 1) * (GRID_SIZE - 1) * 6);
    const uvs = new Float32Array(PARTICLE_COUNT * 2);
    let triangleOffset = 0;

    for (let y = 0; y < GRID_SIZE; y += 1) {
      for (let x = 0; x < GRID_SIZE; x += 1) {
        const particle = this.index(x, y);
        const uvOffset = particle * 2;
        uvs[uvOffset] = x / (GRID_SIZE - 1);
        uvs[uvOffset + 1] = 1 - y / (GRID_SIZE - 1);

        if (x + 1 < GRID_SIZE && y + 1 < GRID_SIZE) {
          const a = particle;
          const b = this.index(x + 1, y);
          const c = this.index(x, y + 1);
          const d = this.index(x + 1, y + 1);
          indices[triangleOffset] = a;
          indices[triangleOffset + 1] = c;
          indices[triangleOffset + 2] = b;
          indices[triangleOffset + 3] = b;
          indices[triangleOffset + 4] = c;
          indices[triangleOffset + 5] = d;
          triangleOffset += 6;
        }
      }
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.positions, 3)
    );
    this.geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    this.geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    this.geometry.computeVertexNormals();
    this.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 3);

    this.material = new THREE.MeshPhysicalMaterial({
      color: 0x4a0717,
      metalness: 0,
      roughness: 0.42,
      sheen: 0.62,
      sheenColor: new THREE.Color(0xb65f6c),
      sheenRoughness: 0.42,
      clearcoat: 0.02,
      clearcoatRoughness: 0.62,
      anisotropy: 0.54,
      anisotropyRotation: Math.PI * 0.25,
      normalMap: createWeaveNormalMap(),
      normalScale: new THREE.Vector2(0.1, 0.08),
      side: THREE.DoubleSide
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
  }

  bottleRadiusAt(y) {
    if (y < -0.5 || y > 0.505) return 0;

    if (y < -0.445) {
      const t = (y + 0.5) / 0.055;
      return THREE.MathUtils.lerp(0.175, 0.205, Math.sin(t * Math.PI * 0.5));
    }

    if (y < 0.195) return 0.205;

    if (y < 0.345) {
      const t = (y - 0.195) / 0.15;
      const smooth = t * t * (3 - 2 * t);
      return THREE.MathUtils.lerp(0.205, 0.118, smooth);
    }

    if (y < 0.425) return 0.118;
    return 0.132;
  }

  solveDistanceConstraints(dt) {
    const positions = this.positions;
    const alphaScale = 1 / (dt * dt);

    for (let constraint = 0; constraint < this.restLengths.length; constraint += 1) {
      const aOffset = this.constraintA[constraint] * 3;
      const bOffset = this.constraintB[constraint] * 3;
      const dx = positions[bOffset] - positions[aOffset];
      const dy = positions[bOffset + 1] - positions[aOffset + 1];
      const dz = positions[bOffset + 2] - positions[aOffset + 2];
      const distanceSquared = dx * dx + dy * dy + dz * dz;

      if (distanceSquared < 1e-12) continue;

      const distance = Math.sqrt(distanceSquared);
      const constraintValue = distance - this.restLengths[constraint];
      const alpha = this.compliances[constraint] * alphaScale;
      const deltaLambda =
        (-constraintValue - alpha * this.lambdas[constraint]) /
        (2 + alpha);
      this.lambdas[constraint] += deltaLambda;

      const scale = deltaLambda / distance;
      positions[aOffset] -= dx * scale;
      positions[aOffset + 1] -= dy * scale;
      positions[aOffset + 2] -= dz * scale;
      positions[bOffset] += dx * scale;
      positions[bOffset + 1] += dy * scale;
      positions[bOffset + 2] += dz * scale;
    }
  }

  solveBottleCollision() {
    const positions = this.positions;
    const clearance = 0.035;

    for (let particle = 0; particle < PARTICLE_COUNT; particle += 1) {
      const offset = particle * 3;
      const x = positions[offset];
      const y = positions[offset + 1];
      const z = positions[offset + 2];
      const radius = this.bottleRadiusAt(y);
      const horizontalRadius = Math.hypot(x, z);

      if (radius > 0 && horizontalRadius < radius + clearance) {
        const safeRadius = Math.max(horizontalRadius, 1e-5);
        const targetRadius = radius + clearance;
        positions[offset] = (x / safeRadius) * targetRadius;
        positions[offset + 2] = (z / safeRadius) * targetRadius;
      }

      if (
        y > 0.425 &&
        y < 0.519 &&
        horizontalRadius < 0.15
      ) {
        positions[offset + 1] = 0.519;
      }
    }
  }

  solveGroundCollision() {
    const positions = this.positions;

    for (let particle = 0; particle < PARTICLE_COUNT; particle += 1) {
      const yOffset = particle * 3 + 1;
      if (positions[yOffset] < GROUND_Y) {
        positions[yOffset] = GROUND_Y;
      }
    }
  }

  solveTopHold() {
    if (!this.holdActive) return;

    const center = Math.floor(GRID_SIZE / 2);

    for (let y = center - 1; y <= center + 1; y += 1) {
      for (let x = center - 1; x <= center + 1; x += 1) {
        const distanceFromCenter = Math.hypot(x - center, y - center);
        if (distanceFromCenter > 1.45) continue;

        const particle = this.index(x, y);
        const offset = particle * 3;
        const strength = distanceFromCenter < 0.5 ? 0.7 : 0.28;
        this.positions[offset] +=
          (this.coveredPositions[offset] - this.positions[offset]) * strength;
        this.positions[offset + 1] +=
          (this.coveredPositions[offset + 1] - this.positions[offset + 1]) *
          strength;
        this.positions[offset + 2] +=
          (this.coveredPositions[offset + 2] - this.positions[offset + 2]) *
          strength;
      }
    }
  }

  solveGrab() {
    if (!this.grab) return;

    const { particles, weights, offsets, target } = this.grab;

    for (let i = 0; i < particles.length; i += 1) {
      const particleOffset = particles[i] * 3;
      const localOffset = i * 3;
      const desiredX = target.x + offsets[localOffset];
      const desiredY = target.y + offsets[localOffset + 1];
      const desiredZ = target.z + offsets[localOffset + 2];
      const strength = 0.2 + weights[i] * 0.42;

      this.positions[particleOffset] +=
        (desiredX - this.positions[particleOffset]) * strength;
      this.positions[particleOffset + 1] +=
        (desiredY - this.positions[particleOffset + 1]) * strength;
      this.positions[particleOffset + 2] +=
        (desiredZ - this.positions[particleOffset + 2]) * strength;
    }
  }

  step(dt) {
    const damping = 0.992;

    for (let particle = 0; particle < PARTICLE_COUNT; particle += 1) {
      const offset = particle * 3;
      this.previousPositions[offset] = this.positions[offset];
      this.previousPositions[offset + 1] = this.positions[offset + 1];
      this.previousPositions[offset + 2] = this.positions[offset + 2];

      this.velocities[offset] *= damping;
      this.velocities[offset + 1] =
        this.velocities[offset + 1] * damping + GRAVITY * dt;
      this.velocities[offset + 2] *= damping;

      this.positions[offset] += this.velocities[offset] * dt;
      this.positions[offset + 1] += this.velocities[offset + 1] * dt;
      this.positions[offset + 2] += this.velocities[offset + 2] * dt;
    }

    this.lambdas.fill(0);

    for (let iteration = 0; iteration < SOLVER_ITERATIONS; iteration += 1) {
      this.solveDistanceConstraints(dt);
      this.solveBottleCollision();
      this.solveGroundCollision();
      this.solveTopHold();
      this.solveGrab();
    }

    for (let particle = 0; particle < PARTICLE_COUNT; particle += 1) {
      const offset = particle * 3;
      let velocityX =
        (this.positions[offset] - this.previousPositions[offset]) / dt;
      let velocityY =
        (this.positions[offset + 1] - this.previousPositions[offset + 1]) / dt;
      let velocityZ =
        (this.positions[offset + 2] - this.previousPositions[offset + 2]) / dt;
      const speed = Math.hypot(velocityX, velocityY, velocityZ);

      if (speed > 3.2) {
        const velocityScale = 3.2 / speed;
        velocityX *= velocityScale;
        velocityY *= velocityScale;
        velocityZ *= velocityScale;
      }

      this.velocities[offset] = velocityX;
      this.velocities[offset + 1] = velocityY;
      this.velocities[offset + 2] = velocityZ;
    }
  }

  updateGeometry() {
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.computeVertexNormals();
  }

  beginGrab(particle, target) {
    const centerX = particle % GRID_SIZE;
    const centerY = Math.floor(particle / GRID_SIZE);
    const particles = [];
    const weights = [];
    const offsets = [];
    const centerOffset = particle * 3;

    for (let y = Math.max(0, centerY - 5); y <= Math.min(GRID_SIZE - 1, centerY + 5); y += 1) {
      for (let x = Math.max(0, centerX - 5); x <= Math.min(GRID_SIZE - 1, centerX + 5); x += 1) {
        const gridDistance = Math.hypot(x - centerX, y - centerY);
        if (gridDistance > 5.35) continue;

        const nearbyParticle = this.index(x, y);
        const offset = nearbyParticle * 3;
        const weight = Math.exp(-gridDistance * gridDistance * 0.12);
        particles.push(nearbyParticle);
        weights.push(weight);
        offsets.push(
          (this.positions[offset] - this.positions[centerOffset]) * 0.92,
          (this.positions[offset + 1] - this.positions[centerOffset + 1]) * 0.92,
          (this.positions[offset + 2] - this.positions[centerOffset + 2]) * 0.92
        );
      }
    }

    this.grab = {
      particles: new Uint16Array(particles),
      weights: new Float32Array(weights),
      offsets: new Float32Array(offsets),
      target: target.clone()
    };
  }

  endGrab() {
    this.grab = null;
  }

  reset() {
    this.positions.set(this.coveredPositions);
    this.velocities.fill(0);
    this.previousPositions.set(this.coveredPositions);
    this.holdActive = true;
    this.grab = null;
    this.updateGeometry();
  }
}

const cloth = new SilkCloth();
world.add(cloth.mesh);

// The authored pose remains perfectly still until the first grab. This hybrid
// approach keeps the opening composition flawless, then hands control to XPBD.

let bottle = null;
let heroReady = false;
let isVisible = true;
let hasInteracted = false;
let accumulator = 0;
let lastTime = performance.now();
let averageFrameMs = 0;
let measuredFrames = 0;

function dispatchProgress(progress) {
  window.dispatchEvent(
    new CustomEvent('golabii:hero-progress', {
      detail: { progress }
    })
  );
}

function dispatchReady() {
  heroReady = true;
  window.dispatchEvent(new CustomEvent('golabii:hero-ready'));
}

const loader = new GLTFLoader();
loader.load(
  'floral-bottle.glb',
  (gltf) => {
    bottle = gltf.scene;

    bottle.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = false;
      object.receiveShadow = false;

      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];

      materials.forEach((material) => {
        if (!material) return;
        material.envMapIntensity = 1.15;
        material.needsUpdate = true;

        if (material.map) {
          material.map.anisotropy = Math.min(
            8,
            renderer.capabilities.getMaxAnisotropy()
          );
        }
      });
    });

    world.add(bottle);
    dispatchProgress(1);
    dispatchReady();
  },
  (event) => {
    if (event.total > 0) {
      dispatchProgress(event.loaded / event.total);
    }
  },
  (error) => {
    console.error('Could not load the Golabii bottle model.', error);
    container.classList.add('hero-model-error');
    dispatchReady();
  }
);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const dragPlane = new THREE.Plane();
const dragPlaneHit = new THREE.Vector3();
const dragStartWorld = new THREE.Vector3();
const dragStartLocal = new THREE.Vector3();
const grabStartTarget = new THREE.Vector3();
const cameraDirection = new THREE.Vector3();
let activePointerId = null;
let grabReleaseAt = 0;
let pointerDidDrag = false;

function updatePointer(event) {
  const bounds = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
  pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
}

function nearestFaceParticle(intersection) {
  const localPoint = world.worldToLocal(intersection.point.clone());
  const faceParticles = [
    intersection.face.a,
    intersection.face.b,
    intersection.face.c
  ];
  let nearest = faceParticles[0];
  let nearestDistance = Infinity;

  faceParticles.forEach((particle) => {
    const offset = particle * 3;
    const dx = cloth.positions[offset] - localPoint.x;
    const dy = cloth.positions[offset + 1] - localPoint.y;
    const dz = cloth.positions[offset + 2] - localPoint.z;
    const distance = dx * dx + dy * dy + dz * dz;

    if (distance < nearestDistance) {
      nearest = particle;
      nearestDistance = distance;
    }
  });

  return nearest;
}

function onPointerDown(event) {
  if (!heroReady || activePointerId !== null) return;

  world.updateMatrixWorld(true);
  cloth.geometry.attributes.position.needsUpdate = true;
  updatePointer(event);
  const intersections = raycaster.intersectObject(cloth.mesh, false);

  if (intersections.length === 0) return;

  event.preventDefault();
  activePointerId = event.pointerId;
  grabReleaseAt = 0;
  pointerDidDrag = false;
  canvas.setPointerCapture(activePointerId);
  container.classList.add('is-grabbing');

  const intersection = intersections[0];
  const particle = nearestFaceParticle(intersection);
  camera.getWorldDirection(cameraDirection);
  dragPlane.setFromNormalAndCoplanarPoint(cameraDirection, intersection.point);
  raycaster.ray.intersectPlane(dragPlane, dragStartWorld);
  dragStartLocal.copy(world.worldToLocal(dragStartWorld.clone()));

  const particleOffset = particle * 3;
  grabStartTarget.set(
    cloth.positions[particleOffset],
    cloth.positions[particleOffset + 1],
    cloth.positions[particleOffset + 2]
  );
  cloth.beginGrab(particle, grabStartTarget);
}

function onPointerMove(event) {
  if (event.pointerId !== activePointerId || !cloth.grab) return;

  event.preventDefault();
  updatePointer(event);

  if (!raycaster.ray.intersectPlane(dragPlane, dragPlaneHit)) return;

  const localHit = world.worldToLocal(dragPlaneHit.clone());
  const assistedDelta = localHit.sub(dragStartLocal);
  cloth.grab.target
    .copy(grabStartTarget)
    .addScaledVector(assistedDelta, 1.55);
  cloth.grab.target.y += Math.min(0.18, assistedDelta.length() * 0.14);

  if (cloth.grab.target.distanceTo(grabStartTarget) > 0.045) {
    pointerDidDrag = true;
    cloth.holdActive = false;
    hasInteracted = true;
    container.classList.add('has-unveiled');
  }
}

function endPointerInteraction(event) {
  if (event.pointerId !== activePointerId) return;

  if (pointerDidDrag) {
    grabReleaseAt = performance.now() + 360;
  } else {
    grabReleaseAt = 0;
    cloth.reset();
    hasInteracted = false;
  }

  if (canvas.hasPointerCapture(activePointerId)) {
    canvas.releasePointerCapture(activePointerId);
  }

  activePointerId = null;
  container.classList.remove('is-grabbing');
}

canvas.addEventListener('pointerdown', onPointerDown);
canvas.addEventListener('pointermove', onPointerMove, { passive: false });
canvas.addEventListener('pointerup', endPointerInteraction);
canvas.addEventListener('pointercancel', endPointerInteraction);
canvas.addEventListener('lostpointercapture', () => {
  activePointerId = null;
  container.classList.remove('is-grabbing');
  if (grabReleaseAt === 0) {
    cloth.endGrab();
  }
});

function startKeyboardReveal() {
  if (!heroReady || hasInteracted) return;

  const x = Math.floor(GRID_SIZE / 2);
  const y = Math.floor(GRID_SIZE * 0.7);
  const particle = cloth.index(x, y);
  const offset = particle * 3;
  const target = new THREE.Vector3(
    cloth.positions[offset],
    cloth.positions[offset + 1],
    cloth.positions[offset + 2]
  );

  cloth.beginGrab(particle, target);
  cloth.holdActive = false;
  cloth.grab.target.add(new THREE.Vector3(0.95, 0.72, 0.18));
  grabReleaseAt = performance.now() + 620;
  hasInteracted = true;
  container.classList.add('has-unveiled');
}

canvas.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  startKeyboardReveal();
});

resetButton?.addEventListener('click', () => {
  cloth.reset();
  grabReleaseAt = 0;
  world.rotation.y = 0;
  hasInteracted = false;
  container.classList.remove('has-unveiled', 'is-grabbing');
});

function resizeRenderer() {
  const width = Math.max(1, container.clientWidth);
  const height = Math.max(1, container.clientHeight);
  const mobile = width < 720;
  camera.position.z = mobile ? 2.82 : 2.35;
  camera.lookAt(0, 0.015, 0);
  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio || 1, mobile ? 1.35 : 1.7)
  );
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

const resizeObserver = new ResizeObserver(resizeRenderer);
resizeObserver.observe(container);
resizeRenderer();

const visibilityObserver = new IntersectionObserver(
  (entries) => {
    isVisible = entries[0]?.isIntersecting ?? true;
  },
  { threshold: 0.01 }
);
visibilityObserver.observe(container);

function animate(time) {
  if (!isVisible) {
    lastTime = time;
    return;
  }

  const frameStart = performance.now();
  const frameDelta = Math.min((time - lastTime) / 1000, 1 / 30);
  lastTime = time;
  accumulator = Math.min(accumulator + frameDelta, FIXED_STEP * 4);

  let substeps = 0;
  if (!cloth.holdActive || cloth.grab) {
    while (accumulator >= FIXED_STEP && substeps < 4) {
      cloth.step(FIXED_STEP);
      accumulator -= FIXED_STEP;
      substeps += 1;
    }
  } else {
    accumulator = 0;
  }

  if (grabReleaseAt > 0 && time >= grabReleaseAt) {
    grabReleaseAt = 0;
    cloth.endGrab();
  }

  // The covered pose stays composed for the reveal. Once the user has
  // interacted, all visible movement comes from the cloth itself.

  cloth.updateGeometry();
  renderer.render(scene, camera);

  const frameMs = performance.now() - frameStart;
  measuredFrames += 1;
  averageFrameMs += (frameMs - averageFrameMs) / measuredFrames;
}

renderer.setAnimationLoop(animate);

window.__golabiiCloth = {
  reset: () => resetButton?.click(),
  unveil: startKeyboardReveal,
  getState: () => ({
    vertices: PARTICLE_COUNT,
    constraints: cloth.restLengths.length,
    held: cloth.holdActive,
    grabbed: Boolean(cloth.grab),
    ready: heroReady,
    averageFrameMs: Number(averageFrameMs.toFixed(2))
  })
};
