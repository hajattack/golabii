import * as THREE from 'three';
import clothBakeData from './cloth-bake-data.js';

const canvas = document.getElementById('bottleCanvas');
const container = document.getElementById('modelContainer');
const resetButton = document.getElementById('clothReset');
const pincher = document.getElementById('clothPincher');
const bottleModel = document.getElementById('bottleModel');

if (!canvas || !container) {
  throw new Error('The Golabii cloth hero is missing its canvas.');
}

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

scene.add(new THREE.HemisphereLight(0xfffbf4, 0x5b1a29, 1.72));

const keyLight = new THREE.DirectionalLight(0xfff4df, 1.85);
keyLight.position.set(-2.8, 3.5, 4);
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0xe9a3aa, 0.82);
rimLight.position.set(3, 1.8, -2.4);
scene.add(rimLight);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

let bakedFrames = null;
let frameCount = 0;
let particleCount = 0;
let gridSize = 0;
let cloth = null;
let drapeLiner = null;
let geometry = null;
let positionAttribute = null;
let bakeReady = false;
let bottleReady = Boolean(bottleModel?.loaded);
let isVisible = true;
let activePointerId = null;
let pointerStartX = 0;
let pointerStartY = 0;
let pullDirection = 1;
let displayProgress = 0;
let targetProgress = 0;
let completing = false;
let lastTime = performance.now();
let averageFrameMs = 0;
let measuredFrames = 0;
let bottleRotationEnabled = false;

bottleModel?.removeAttribute('auto-rotate');
if (bottleModel) {
  bottleModel.style.opacity = '0';
}

bottleModel?.addEventListener(
  'load',
  () => {
    bottleReady = true;
  },
  { once: true }
);

if (!bottleModel) {
  bottleReady = true;
}

function createGeometry(initialPositions) {
  const indices = new Uint16Array((gridSize - 1) * (gridSize - 1) * 6);
  const uvs = new Float32Array(particleCount * 2);
  let triangleOffset = 0;

  for (let z = 0; z < gridSize; z += 1) {
    for (let x = 0; x < gridSize; x += 1) {
      const particle = z * gridSize + x;
      const uvOffset = particle * 2;
      uvs[uvOffset] = x / (gridSize - 1);
      uvs[uvOffset + 1] = 1 - z / (gridSize - 1);

      if (x + 1 < gridSize && z + 1 < gridSize) {
        const a = particle;
        const b = particle + 1;
        const c = particle + gridSize;
        const d = c + 1;
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

  const bufferGeometry = new THREE.BufferGeometry();
  positionAttribute = new THREE.BufferAttribute(
    new Float32Array(initialPositions),
    3
  );
  positionAttribute.setUsage(THREE.DynamicDrawUsage);
  bufferGeometry.setAttribute('position', positionAttribute);
  bufferGeometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  bufferGeometry.setIndex(new THREE.BufferAttribute(indices, 1));
  bufferGeometry.computeVertexNormals();
  bufferGeometry.boundingSphere = new THREE.Sphere(
    new THREE.Vector3(),
    4
  );

  return bufferGeometry;
}

function createDrapeLiner(material) {
  const profile = [
    new THREE.Vector2(0, 0.533),
    new THREE.Vector2(0.139, 0.531),
    new THREE.Vector2(0.143, 0.48),
    new THREE.Vector2(0.164, 0.405),
    new THREE.Vector2(0.193, 0.285),
    new THREE.Vector2(0.208, 0.195),
    new THREE.Vector2(0.208, -0.445),
    new THREE.Vector2(0.178, -0.505),
    new THREE.Vector2(0, -0.505)
  ];
  const linerMaterial = material.clone();
  linerMaterial.transparent = true;
  linerMaterial.opacity = 1;
  linerMaterial.depthWrite = true;
  const liner = new THREE.Mesh(
    new THREE.LatheGeometry(profile, 64),
    linerMaterial
  );
  liner.renderOrder = 0;
  return liner;
}

function setBottleRotation(enabled) {
  if (!bottleModel || enabled === bottleRotationEnabled) return;
  bottleRotationEnabled = enabled;

  if (enabled) {
    bottleModel.setAttribute('auto-rotate', '');
    bottleModel.setAttribute('auto-rotate-delay', '0');
    bottleModel.setAttribute('rotation-per-second', '30deg');
  } else {
    bottleModel.removeAttribute('auto-rotate');
  }
}

function applyBakedProgress(progress) {
  if (!positionAttribute || !bakedFrames || frameCount < 2) return;

  const clamped = THREE.MathUtils.clamp(progress, 0, 1);
  const framePosition = clamped * (frameCount - 1);
  const frameA = Math.floor(framePosition);
  const frameB = Math.min(frameCount - 1, frameA + 1);
  const mix = framePosition - frameA;
  const valuesPerFrame = particleCount * 3;
  const offsetA = frameA * valuesPerFrame;
  const offsetB = frameB * valuesPerFrame;
  const positions = positionAttribute.array;

  for (let value = 0; value < valuesPerFrame; value += 1) {
    positions[value] =
      bakedFrames[offsetA + value] * (1 - mix) +
      bakedFrames[offsetB + value] * mix;
  }

  positionAttribute.needsUpdate = true;
  geometry.computeVertexNormals();
}

async function loadBake() {
  const decoded = atob(clothBakeData);
  const bytes = new Uint8Array(decoded.length);

  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index);
  }

  const buffer = bytes.buffer;
  const header = new Uint32Array(buffer, 0, 5);

  if (header[0] !== 0x47434c54 || header[1] !== 1) {
    throw new Error('The cloth bake has an unsupported format.');
  }

  gridSize = header[2];
  frameCount = header[3];
  particleCount = header[4];
  const expectedParticles = gridSize * gridSize;

  if (particleCount !== expectedParticles || frameCount < 2) {
    throw new Error('The cloth bake has invalid dimensions.');
  }

  bakedFrames = new Float32Array(buffer, 5 * Uint32Array.BYTES_PER_ELEMENT);
  const valuesPerFrame = particleCount * 3;

  if (bakedFrames.length !== valuesPerFrame * frameCount) {
    throw new Error('The cloth bake is incomplete.');
  }

  geometry = createGeometry(bakedFrames.subarray(0, valuesPerFrame));
  const material = new THREE.MeshPhysicalMaterial({
    color: 0x78182e,
    metalness: 0,
    roughness: 0.86,
    sheen: 0.22,
    sheenColor: new THREE.Color(0xa83b50),
    sheenRoughness: 0.88,
    side: THREE.DoubleSide
  });
  drapeLiner = createDrapeLiner(material);
  cloth = new THREE.Mesh(geometry, material);
  cloth.frustumCulled = false;
  cloth.renderOrder = 1;
  world.add(drapeLiner);
  world.add(cloth);
  bakeReady = true;
}

loadBake().catch((error) => {
  console.error('Could not initialize the Golabii cloth animation.', error);
  container.classList.add('hero-model-error');
});

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

function onPointerDown(event) {
  if (!bakeReady || !bottleReady || !cloth || activePointerId !== null) {
    return;
  }

  world.updateMatrixWorld(true);
  updatePointer(event);

  if (raycaster.intersectObject(cloth, false).length === 0) {
    return;
  }

  event.preventDefault();
  activePointerId = event.pointerId;
  pointerStartX = event.clientX;
  pointerStartY = event.clientY;
  targetProgress = displayProgress;
  completing = false;
  positionPincher(event);
  canvas.setPointerCapture(activePointerId);
  container.classList.add('is-grabbing');
}

function onPointerMove(event) {
  if (event.pointerId !== activePointerId) return;

  event.preventDefault();
  positionPincher(event);

  const deltaX = event.clientX - pointerStartX;
  const deltaY = event.clientY - pointerStartY;
  const distance = Math.hypot(deltaX, deltaY);
  const bounds = canvas.getBoundingClientRect();
  const revealDistance = Math.min(360, bounds.width * 0.48);

  if (Math.abs(deltaX) > 8) {
    pullDirection = deltaX < 0 ? -1 : 1;
  }

  targetProgress = Math.max(
    targetProgress,
    THREE.MathUtils.clamp(distance / revealDistance, 0, 1)
  );

  if (targetProgress > 0.025) {
    container.classList.add('has-unveiled');
  }
}

function finishPointer(event) {
  if (event.pointerId !== activePointerId) return;

  if (canvas.hasPointerCapture(activePointerId)) {
    canvas.releasePointerCapture(activePointerId);
  }

  activePointerId = null;
  container.classList.remove('is-grabbing');

  if (targetProgress >= 0.28) {
    targetProgress = 1;
    completing = true;
    container.classList.add('has-unveiled');
  } else {
    targetProgress = 0;
    completing = false;
    container.classList.remove('has-unveiled');
  }
}

canvas.addEventListener('pointerdown', onPointerDown);
canvas.addEventListener('pointermove', onPointerMove, { passive: false });
canvas.addEventListener('pointerup', finishPointer);
canvas.addEventListener('pointercancel', finishPointer);
canvas.addEventListener('lostpointercapture', () => {
  activePointerId = null;
  container.classList.remove('is-grabbing');
});

function startKeyboardReveal() {
  if (!bakeReady || !bottleReady || completing || displayProgress > 0.01) {
    return;
  }

  pullDirection = 1;
  targetProgress = 1;
  completing = true;
  container.classList.add('has-unveiled');
}

canvas.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  startKeyboardReveal();
});

resetButton?.addEventListener('click', () => {
  displayProgress = 0;
  targetProgress = 0;
  pullDirection = 1;
  completing = false;
  world.scale.x = Math.abs(world.scale.x);
  applyBakedProgress(0);
  if (drapeLiner) {
    drapeLiner.material.opacity = 1;
    drapeLiner.visible = true;
  }
  if (bottleModel) {
    bottleModel.style.opacity = '0';
  }
  setBottleRotation(false);
  container.classList.remove(
    'has-unveiled',
    'has-completed',
    'is-grabbing'
  );
});

function resizeRenderer() {
  const width = Math.max(1, container.clientWidth);
  const height = Math.max(1, container.clientHeight);
  const mobile = width < 720;
  const horizontalScale = mobile ? 1.1 : 1;

  camera.position.z = mobile ? 2.55 : 2.35;
  world.position.y = mobile ? 0.02 : -0.015;
  world.scale.set(
    horizontalScale * pullDirection,
    1,
    horizontalScale
  );
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
  const delta = Math.min((time - lastTime) / 1000, 1 / 30);
  lastTime = time;
  const previousProgress = displayProgress;
  const response = activePointerId === null ? 5.25 : 12;
  const blend = 1 - Math.exp(-response * delta);
  displayProgress += (targetProgress - displayProgress) * blend;

  if (Math.abs(displayProgress - previousProgress) > 0.00005) {
    applyBakedProgress(displayProgress);
    const horizontalScale = container.clientWidth < 720 ? 1.1 : 1;
    world.scale.x = horizontalScale * pullDirection;
  }

  const revealMix = THREE.MathUtils.smoothstep(displayProgress, 0.08, 0.42);

  if (drapeLiner) {
    drapeLiner.material.opacity = 1 - revealMix;
    drapeLiner.visible = revealMix < 0.999;
  }

  if (bottleModel) {
    bottleModel.style.opacity = `${revealMix}`;
  }

  if (displayProgress > 0.55) {
    setBottleRotation(true);
  } else if (targetProgress === 0) {
    setBottleRotation(false);
  }

  if (
    completing &&
    targetProgress === 1 &&
    displayProgress > 0.992
  ) {
    displayProgress = 1;
    completing = false;
    container.classList.add('has-completed');
  }

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
    ready: bakeReady && bottleReady,
    grid: gridSize,
    vertices: particleCount,
    bakedFrames: frameCount,
    progress: Number(displayProgress.toFixed(3)),
    grabbed: activePointerId !== null,
    averageFrameMs: Number(averageFrameMs.toFixed(2))
  })
};
