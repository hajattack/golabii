import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const GRID_SIZE = 51;
const PARTICLE_COUNT = GRID_SIZE * GRID_SIZE;
const CLOTH_WIDTH = 1.26;
const CLOTH_LENGTH = 2.15;
const GROUND_Y = -0.515;
const DT = 1 / 180;
const ITERATIONS = 8;
const SETTLE_STEPS = 900;
const PULL_STEPS = 540;
const CAPTURE_EVERY = 36;
const OUTPUT_PATH = resolve(
  import.meta.dirname,
  '..',
  'cloth-bake-data.js'
);

const positions = new Float32Array(PARTICLE_COUNT * 3);
const previous = new Float32Array(PARTICLE_COUNT * 3);
const velocities = new Float32Array(PARTICLE_COUNT * 3);
const materialX = new Float32Array(PARTICLE_COUNT);
const materialZ = new Float32Array(PARTICLE_COUNT);

function index(x, z) {
  return z * GRID_SIZE + x;
}

for (let z = 0; z < GRID_SIZE; z += 1) {
  for (let x = 0; x < GRID_SIZE; x += 1) {
    const particle = index(x, z);
    const offset = particle * 3;
    const mz = (z / (GRID_SIZE - 1) - 0.5) * CLOTH_LENGTH;
    const taperInput = Math.min(
      1,
      Math.max(0, (Math.abs(mz) - 0.04) / 0.82)
    );
    const taper = taperInput * taperInput * (3 - 2 * taperInput);
    const localWidth = 0.34 + (CLOTH_WIDTH - 0.34) * taper;
    const mx = (x / (GRID_SIZE - 1) - 0.5) * localWidth;
    const seed =
      Math.sin(mx * 19 + mz * 3.1) * 0.0018 +
      Math.sin(mx * 7.4 - mz * 11) * 0.0011;

    materialX[particle] = mx;
    materialZ[particle] = mz;
    positions[offset] = mx;
    positions[offset + 1] = 0.536 + seed;
    positions[offset + 2] = mz;
  }
}

previous.set(positions);

const crownParticles = [];

for (let particle = 0; particle < PARTICLE_COUNT; particle += 1) {
  const capDistance = Math.hypot(
    materialX[particle] / 0.135,
    materialZ[particle] / 0.112
  );

  if (capDistance <= 1) {
    crownParticles.push(particle);
  }
}

const constraintA = [];
const constraintB = [];
const restLengths = [];
const compliances = [];
function addConstraint(a, b, compliance) {
  const aOffset = a * 3;
  const bOffset = b * 3;
  const dx = positions[bOffset] - positions[aOffset];
  const dy = positions[bOffset + 1] - positions[aOffset + 1];
  const dz = positions[bOffset + 2] - positions[aOffset + 2];
  constraintA.push(a);
  constraintB.push(b);
  restLengths.push(Math.hypot(dx, dy, dz));
  compliances.push(compliance);
}

for (let z = 0; z < GRID_SIZE; z += 1) {
  for (let x = 0; x < GRID_SIZE; x += 1) {
    const particle = index(x, z);

    if (x + 1 < GRID_SIZE) {
      addConstraint(particle, index(x + 1, z), 5e-7);
    }

    if (z + 1 < GRID_SIZE) {
      addConstraint(particle, index(x, z + 1), 5e-7);
    }

    if (x + 1 < GRID_SIZE && z + 1 < GRID_SIZE) {
      addConstraint(particle, index(x + 1, z + 1), 1.5e-6);
      addConstraint(index(x + 1, z), index(x, z + 1), 1.5e-6);
    }

    if (x + 2 < GRID_SIZE) {
      addConstraint(particle, index(x + 2, z), 4e-6);
    }

    if (z + 2 < GRID_SIZE) {
      addConstraint(particle, index(x, z + 2), 4e-6);
    }
  }
}

const indicesA = new Uint16Array(constraintA);
const indicesB = new Uint16Array(constraintB);
const rests = new Float32Array(restLengths);
const compliance = new Float32Array(compliances);
const lambdas = new Float32Array(rests.length);

function bottleRadiusAt(y) {
  if (y < -0.5 || y > 0.526) return 0;

  if (y < -0.445) {
    const t = (y + 0.5) / 0.055;
    return 0.175 + (0.205 - 0.175) * Math.sin(t * Math.PI * 0.5);
  }

  if (y < 0.195) return 0.205;

  const t = Math.min(1, Math.max(0, (y - 0.195) / 0.331));
  const smooth = t * t * (3 - 2 * t);
  return 0.205 + (0.138 - 0.205) * smooth;
}

function solveDistances() {
  const alphaScale = 1 / (DT * DT);

  for (let constraint = 0; constraint < rests.length; constraint += 1) {
    const aOffset = indicesA[constraint] * 3;
    const bOffset = indicesB[constraint] * 3;
    const dx = positions[bOffset] - positions[aOffset];
    const dy = positions[bOffset + 1] - positions[aOffset + 1];
    const dz = positions[bOffset + 2] - positions[aOffset + 2];
    const lengthSquared = dx * dx + dy * dy + dz * dz;

    if (lengthSquared < 1e-12) continue;

    const length = Math.sqrt(lengthSquared);
    const value = length - rests[constraint];
    const alpha = compliance[constraint] * alphaScale;
    const deltaLambda =
      (-value - alpha * lambdas[constraint]) / (2 + alpha);
    lambdas[constraint] += deltaLambda;

    const scale = deltaLambda / length;
    positions[aOffset] -= dx * scale;
    positions[aOffset + 1] -= dy * scale;
    positions[aOffset + 2] -= dz * scale;
    positions[bOffset] += dx * scale;
    positions[bOffset + 1] += dy * scale;
    positions[bOffset + 2] += dz * scale;
  }
}

function solveBottleAndGround() {
  for (let particle = 0; particle < PARTICLE_COUNT; particle += 1) {
    const offset = particle * 3;
    let x = positions[offset];
    let y = positions[offset + 1];
    let z = positions[offset + 2];
    const radius = Math.hypot(x, z);

    if (y < 0.528 && y > 0.445 && radius < 0.143) {
      y = 0.528;
    }

    const bottleRadius = bottleRadiusAt(y);

    if (bottleRadius > 0 && radius < bottleRadius + 0.006) {
      const safeRadius = Math.max(radius, 1e-6);
      const target = bottleRadius + 0.006;
      x = (x / safeRadius) * target;
      z = (z / safeRadius) * target;
    }

    if (y < GROUND_Y) {
      y = GROUND_Y;
    }

    positions[offset] = x;
    positions[offset + 1] = y;
    positions[offset + 2] = z;
  }
}

const center = index(Math.floor(GRID_SIZE / 2), Math.floor(GRID_SIZE / 2));

function solveCrownAnchor(active) {
  if (!active) return;

  for (const particle of crownParticles) {
    const offset = particle * 3;
    const strength = particle === center ? 0.9 : 0.42;
    positions[offset] +=
      (materialX[particle] - positions[offset]) * strength;
    positions[offset + 1] +=
      (0.529 - positions[offset + 1]) * strength;
    positions[offset + 2] +=
      (materialZ[particle] - positions[offset + 2]) * strength;
  }
}

function createGrab(particle) {
  const centerX = particle % GRID_SIZE;
  const centerZ = Math.floor(particle / GRID_SIZE);
  const particles = [];
  const weights = [];
  const offsets = [];
  const centerOffset = particle * 3;

  for (let z = centerZ - 2; z <= centerZ + 2; z += 1) {
    for (let x = centerX - 2; x <= centerX + 2; x += 1) {
      if (x < 0 || z < 0 || x >= GRID_SIZE || z >= GRID_SIZE) continue;

      const distance = Math.hypot(x - centerX, z - centerZ);
      if (distance > 2.35) continue;

      const nearby = index(x, z);
      const offset = nearby * 3;
      particles.push(nearby);
      weights.push(Math.exp(-distance * distance * 0.58));
      offsets.push(
        positions[offset] - positions[centerOffset],
        positions[offset + 1] - positions[centerOffset + 1],
        positions[offset + 2] - positions[centerOffset + 2]
      );
    }
  }

  return {
    particles: new Uint16Array(particles),
    weights: new Float32Array(weights),
    offsets: new Float32Array(offsets),
    start: [
      positions[centerOffset],
      positions[centerOffset + 1],
      positions[centerOffset + 2]
    ],
    target: [
      positions[centerOffset],
      positions[centerOffset + 1],
      positions[centerOffset + 2]
    ]
  };
}

function solveGrab(grab) {
  if (!grab) return;

  for (let i = 0; i < grab.particles.length; i += 1) {
    const offset = grab.particles[i] * 3;
    const localOffset = i * 3;
    const weight = grab.weights[i];
    const strength = 0.22 + weight * 0.68;
    const desiredX = grab.target[0] + grab.offsets[localOffset];
    const desiredY = grab.target[1] + grab.offsets[localOffset + 1];
    const desiredZ = grab.target[2] + grab.offsets[localOffset + 2];

    positions[offset] += (desiredX - positions[offset]) * strength;
    positions[offset + 1] +=
      (desiredY - positions[offset + 1]) * strength;
    positions[offset + 2] +=
      (desiredZ - positions[offset + 2]) * strength;
  }
}

function step({ anchor = false, grab = null, settle = false } = {}) {
  const damping = settle ? 0.982 : 0.992;

  for (let particle = 0; particle < PARTICLE_COUNT; particle += 1) {
    const offset = particle * 3;
    previous[offset] = positions[offset];
    previous[offset + 1] = positions[offset + 1];
    previous[offset + 2] = positions[offset + 2];

    velocities[offset] *= damping;
    velocities[offset + 1] =
      velocities[offset + 1] * damping - 9.8 * DT;
    velocities[offset + 2] *= damping;

    positions[offset] += velocities[offset] * DT;
    positions[offset + 1] += velocities[offset + 1] * DT;
    positions[offset + 2] += velocities[offset + 2] * DT;
  }

  lambdas.fill(0);

  for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
    solveDistances();
    solveBottleAndGround();
    solveCrownAnchor(anchor);
    solveGrab(grab);
  }

  for (let particle = 0; particle < PARTICLE_COUNT; particle += 1) {
    const offset = particle * 3;
    let vx = (positions[offset] - previous[offset]) / DT;
    let vy = (positions[offset + 1] - previous[offset + 1]) / DT;
    let vz = (positions[offset + 2] - previous[offset + 2]) / DT;
    const speed = Math.hypot(vx, vy, vz);

    if (speed > 2.4) {
      const scale = 2.4 / speed;
      vx *= scale;
      vy *= scale;
      vz *= scale;
    }

    if (positions[offset + 1] <= GROUND_Y + 0.0001) {
      vx *= 0.7;
      vy = Math.max(0, vy) * 0.15;
      vz *= 0.7;
    }

    velocities[offset] = vx;
    velocities[offset + 1] = vy;
    velocities[offset + 2] = vz;
  }
}

for (let frame = 0; frame < SETTLE_STEPS; frame += 1) {
  step({
    anchor: true,
    settle: frame > SETTLE_STEPS - 240
  });
}

velocities.fill(0);
previous.set(positions);

const frames = [new Float32Array(positions)];
const grabParticle = index(
  Math.floor(GRID_SIZE * 0.64),
  Math.floor(GRID_SIZE * 0.73)
);
const grab = createGrab(grabParticle);

for (let frame = 1; frame <= PULL_STEPS; frame += 1) {
  const progress = frame / PULL_STEPS;
  const eased = 1 - Math.pow(1 - progress, 3);
  grab.target[0] = grab.start[0] + eased * 1.55;
  grab.target[1] =
    grab.start[1] +
    Math.sin(eased * Math.PI * 0.5) * 0.78 +
    eased * 0.2;
  grab.target[2] = grab.start[2] + eased * 0.12;

  step({ grab });

  if (frame % CAPTURE_EVERY === 0) {
    frames.push(new Float32Array(positions));
  }
}

const headerBytes = 5 * Uint32Array.BYTES_PER_ELEMENT;
const frameBytes =
  frames.length * positions.length * Float32Array.BYTES_PER_ELEMENT;
const output = Buffer.allocUnsafe(headerBytes + frameBytes);
const header = new Uint32Array(
  output.buffer,
  output.byteOffset,
  5
);

header[0] = 0x47434c54;
header[1] = 1;
header[2] = GRID_SIZE;
header[3] = frames.length;
header[4] = PARTICLE_COUNT;

const baked = new Float32Array(
  output.buffer,
  output.byteOffset + headerBytes,
  frames.length * positions.length
);

for (let frame = 0; frame < frames.length; frame += 1) {
  baked.set(frames[frame], frame * positions.length);
}

const encoded = output.toString('base64');
writeFileSync(OUTPUT_PATH, `export default ${JSON.stringify(encoded)};\n`);

const min = [Infinity, Infinity, Infinity];
const max = [-Infinity, -Infinity, -Infinity];

for (let offset = 0; offset < frames[0].length; offset += 3) {
  min[0] = Math.min(min[0], frames[0][offset]);
  min[1] = Math.min(min[1], frames[0][offset + 1]);
  min[2] = Math.min(min[2], frames[0][offset + 2]);
  max[0] = Math.max(max[0], frames[0][offset]);
  max[1] = Math.max(max[1], frames[0][offset + 1]);
  max[2] = Math.max(max[2], frames[0][offset + 2]);
}

console.log(
  JSON.stringify(
    {
      output: OUTPUT_PATH,
      binaryBytes: output.byteLength,
      encodedBytes: encoded.length,
      grid: GRID_SIZE,
      particles: PARTICLE_COUNT,
      constraints: rests.length,
      frames: frames.length,
      settledBounds: { min, max },
      center: [
        positions[center * 3],
        positions[center * 3 + 1],
        positions[center * 3 + 2]
      ]
    },
    null,
    2
  )
);
