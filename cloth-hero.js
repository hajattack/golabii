import * as THREE from 'three';

const canvas = document.getElementById('bottleCanvas');
const container = document.getElementById('modelContainer');
const resetButton = document.getElementById('clothReset');
const pincher = document.getElementById('clothPincher');

if (!canvas || !container) {
  throw new Error('The Golabii cloth hero is missing its canvas.');
}

const GRID_SIZE = 35;
const PARTICLE_COUNT = GRID_SIZE * GRID_SIZE;
const CLOTH_WIDTH = 1.05;
const CLOTH_LENGTH = 2.34;
const FIXED_STEP = 1 / 180;
const SOLVER_ITERATIONS = 8;
const GROUND_Y = -0.515;
const GRAVITY = -9.8;

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(26, 1, 0.01, 20);
camera.position.set(0, 0.035, 2.35);
camera.lookAt(0, 0.015, 0);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
  premultipliedAlpha: true,
  powerPreference: 'high-performance'
});

renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
renderer.setClearColor(0x000000, 0);

const world = new THREE.Group();
world.position.y = -0.015;
scene.add(world);

const hemiLight = new THREE.HemisphereLight(0xfffbf4, 0x5b1a29, 1.7);
scene.add(hemiLight);

const keyLight = new THREE.DirectionalLight(0xfff4df, 1.55);
keyLight.position.set(-2.8, 3.5, 4);
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0xe9a3aa, 0.65);
rimLight.position.set(3, 1.8, -2.4);
scene.add(rimLight);

class SilkCloth {
  constructor() {
    this.positions = new Float32Array(PARTICLE_COUNT * 3);
    this.velocities = new Float32Array(PARTICLE_COUNT * 3);
    this.previousPositions = new Float32Array(PARTICLE_COUNT * 3);
    this.coveredPositions = new Float32Array(PARTICLE_COUNT * 3);
    this.holdActive = true;
    this.grab = null;
    this.unfold = 0;
    this.unfoldTarget = 0;

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
    const coveredRestLengths = [];
    const flatRestLengths = [];
    const compliances = [];
    const spacingX = CLOTH_WIDTH / (GRID_SIZE - 1);
    const spacingY = CLOTH_LENGTH / (GRID_SIZE - 1);

    const addConstraint = (a, b, flatRestLength, compliance) => {
      const aOffset = a * 3;
      const bOffset = b * 3;
      const dx = this.positions[bOffset] - this.positions[aOffset];
      const dy = this.positions[bOffset + 1] - this.positions[aOffset + 1];
      const dz = this.positions[bOffset + 2] - this.positions[aOffset + 2];

      indicesA.push(a);
      indicesB.push(b);
      coveredRestLengths.push(Math.hypot(dx, dy, dz));
      flatRestLengths.push(flatRestLength);
      compliances.push(compliance);
    };

    for (let y = 0; y < GRID_SIZE; y += 1) {
      for (let x = 0; x < GRID_SIZE; x += 1) {
        const current = this.index(x, y);

        if (x + 1 < GRID_SIZE) {
          addConstraint(current, this.index(x + 1, y), spacingX, 7e-7);
        }

        if (y + 1 < GRID_SIZE) {
          addConstraint(current, this.index(x, y + 1), spacingY, 7e-7);
        }

        if (x + 1 < GRID_SIZE && y + 1 < GRID_SIZE) {
          const diagonalRest = Math.hypot(spacingX, spacingY);
          addConstraint(
            current,
            this.index(x + 1, y + 1),
            diagonalRest,
            2e-6
          );
          addConstraint(
            this.index(x + 1, y),
            this.index(x, y + 1),
            diagonalRest,
            2e-6
          );
        }

        if (x + 2 < GRID_SIZE) {
          addConstraint(
            current,
            this.index(x + 2, y),
            spacingX * 2,
            1.5e-6
          );
        }

        if (y + 2 < GRID_SIZE) {
          addConstraint(
            current,
            this.index(x, y + 2),
            spacingY * 2,
            1.5e-6
          );
        }
      }
    }

    this.constraintA = new Uint16Array(indicesA);
    this.constraintB = new Uint16Array(indicesB);
    this.coveredRestLengths = new Float32Array(coveredRestLengths);
    this.flatRestLengths = new Float32Array(flatRestLengths);
    this.restLengths = new Float32Array(coveredRestLengths);
    this.compliances = new Float32Array(compliances);
    this.lambdas = new Float32Array(coveredRestLengths.length);
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

    this.material = new THREE.MeshStandardMaterial({
      color: 0x651629,
      metalness: 0,
      roughness: 0.88,
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
      const strength = 0.15 + weights[i] * 0.5;

      this.positions[particleOffset] +=
        (desiredX - this.positions[particleOffset]) * strength;
      this.positions[particleOffset + 1] +=
        (desiredY - this.positions[particleOffset + 1]) * strength;
      this.positions[particleOffset + 2] +=
        (desiredZ - this.positions[particleOffset + 2]) * strength;
    }
  }

  step(dt) {
    const damping = 0.9915;
    this.unfold +=
      (this.unfoldTarget - this.unfold) * Math.min(1, dt * 0.75);

    for (let constraint = 0; constraint < this.restLengths.length; constraint += 1) {
      const coveredLength = this.coveredRestLengths[constraint];
      this.restLengths[constraint] =
        coveredLength +
        (this.flatRestLengths[constraint] - coveredLength) * this.unfold;
    }

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

      if (speed > 2.35) {
        const velocityScale = 2.35 / speed;
        velocityX *= velocityScale;
        velocityY *= velocityScale;
        velocityZ *= velocityScale;
      }

      if (this.positions[offset + 1] <= GROUND_Y + 0.0001) {
        velocityX *= 0.82;
        velocityY = Math.max(0, velocityY) * 0.22;
        velocityZ *= 0.82;
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

    for (let y = Math.max(0, centerY - 2); y <= Math.min(GRID_SIZE - 1, centerY + 2); y += 1) {
      for (let x = Math.max(0, centerX - 2); x <= Math.min(GRID_SIZE - 1, centerX + 2); x += 1) {
        const gridDistance = Math.hypot(x - centerX, y - centerY);
        if (gridDistance > 2.35) continue;

        const nearbyParticle = this.index(x, y);
        const offset = nearbyParticle * 3;
        const weight = Math.exp(-gridDistance * gridDistance * 0.55);
        particles.push(nearbyParticle);
        weights.push(weight);
        offsets.push(
          (this.positions[offset] - this.positions[centerOffset]) * 0.97,
          (this.positions[offset + 1] - this.positions[centerOffset + 1]) * 0.97,
          (this.positions[offset + 2] - this.positions[centerOffset + 2]) * 0.97
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
    this.restLengths.set(this.coveredRestLengths);
    this.holdActive = true;
    this.grab = null;
    this.unfold = 0;
    this.unfoldTarget = 0;
    this.updateGeometry();
  }
}

const cloth = new SilkCloth();
world.add(cloth.mesh);

// The authored pose remains perfectly still until the first grab. This hybrid
// approach keeps the opening composition flawless, then hands control to XPBD.

const bottleModel = document.getElementById('bottleModel');
let heroReady = Boolean(bottleModel?.loaded);
let isVisible = true;
let hasInteracted = false;
let accumulator = 0;
let lastTime = performance.now();
let averageFrameMs = 0;
let measuredFrames = 0;

bottleModel?.addEventListener('load', () => {
  heroReady = true;
}, { once: true });

if (!bottleModel) {
  heroReady = true;
}

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
let interactionCompleteAt = 0;
let pointerDidDrag = false;

function updatePointer(event) {
  const bounds = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
  pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
}

function positionPincher(event) {
  if (!pincher) return;

  const bounds = container.getBoundingClientRect();
  pincher.style.left = `${event.clientX - bounds.left}px`;
  pincher.style.top = `${event.clientY - bounds.top}px`;
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
  interactionCompleteAt = 0;
  pointerDidDrag = false;
  canvas.setPointerCapture(activePointerId);
  container.classList.add('is-grabbing');
  positionPincher(event);

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
  positionPincher(event);

  if (!raycaster.ray.intersectPlane(dragPlane, dragPlaneHit)) return;

  const localHit = world.worldToLocal(dragPlaneHit.clone());
  const assistedDelta = localHit.sub(dragStartLocal);
  cloth.grab.target
    .copy(grabStartTarget)
    .addScaledVector(assistedDelta, 1.7);
  cloth.grab.target.y += Math.min(0.15, assistedDelta.length() * 0.11);

  if (cloth.grab.target.distanceTo(grabStartTarget) > 0.045) {
    cloth.unfoldTarget = Math.max(
      cloth.unfoldTarget,
      Math.min(
        0.32,
        cloth.grab.target.distanceTo(grabStartTarget) / 2.25
      )
    );
    pointerDidDrag = true;
    cloth.holdActive = false;
    hasInteracted = true;
    container.classList.add('has-unveiled');
  }
}

function endPointerInteraction(event) {
  if (event.pointerId !== activePointerId) return;

  if (pointerDidDrag) {
    grabReleaseAt = performance.now() + 100;
    interactionCompleteAt = performance.now() + 260;
  } else {
    grabReleaseAt = 0;
    interactionCompleteAt = 0;
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
  cloth.unfoldTarget = 0.32;
  cloth.grab.target.add(new THREE.Vector3(0.95, 0.72, 0.18));
  grabReleaseAt = performance.now() + 620;
  interactionCompleteAt = performance.now() + 720;
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
  interactionCompleteAt = 0;
  hasInteracted = false;
  container.classList.remove('has-unveiled', 'has-completed', 'is-grabbing');
});

function resizeRenderer() {
  const width = Math.max(1, container.clientWidth);
  const height = Math.max(1, container.clientHeight);
  const mobile = width < 720;
  camera.position.z = mobile ? 2.55 : 2.35;
  world.position.y = mobile ? 0.005 : -0.015;
  world.scale.set(mobile ? 0.78 : 1, 1, mobile ? 0.78 : 1);
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

  if (interactionCompleteAt > 0 && time >= interactionCompleteAt) {
    interactionCompleteAt = 0;
    container.classList.add('has-completed');
  }

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
