// SI units; +s follows the belt from its left end toward its right/uphill end.
// Constant belt velocity, Coulomb friction, mu_s = mu_k, point-mass block.
export const CONVEYOR_LENGTH = 8;
export const GRAVITY = 9.8;
const EPS = 1e-10;

export function conveyorForces(config, velocity) {
  const {beltSpeed, mu, angle, mass} = config;
  const theta = angle * Math.PI / 180;
  const weight = mass * GRAVITY;
  const normal = weight * Math.cos(theta);
  const downhill = weight * Math.sin(theta);
  const capacity = mu * normal;
  const relative = velocity - beltSpeed;
  const canStick = Math.abs(downhill) <= capacity + EPS;
  const synchronous = Math.abs(relative) < EPS && canStick;
  // At equality with insufficient static friction, impending slip is downhill.
  const slipSign = Math.abs(relative) < EPS ? -Math.sign(downhill) : Math.sign(relative);
  const friction = synchronous ? downhill : -slipSign * capacity;
  return {relative, weight, normal, friction, capacity, canStick, synchronous,
    acceleration: (friction - downhill) / mass,
    kind: synchronous ? (Math.abs(friction) < EPS ? 'zero' : 'static') : 'kinetic'};
}

export function createConveyorRun(config) {
  const direction = Math.sign(config.initialSpeed) || Math.sign(config.beltSpeed) || 1;
  return {s: direction < 0 ? 7 : 1, v: config.initialSpeed, time: 0, beltTravel: 0, ended: false};
}

function firstBoundaryTime(s, v, a, horizon) {
  let hit = null;
  for (const boundary of [0, CONVEYOR_LENGTH]) {
    const c = s - boundary;
    let roots = [];
    if (Math.abs(a) < EPS) {
      if (Math.abs(v) > EPS) roots = [-c / v];
    } else {
      const discriminant = v * v - 2 * a * c;
      if (discriminant >= -EPS) {
        const q = -.5 * (v + (v >= 0 ? 1 : -1) * Math.sqrt(Math.max(0, discriminant)));
        roots = Math.abs(q) < EPS ? [-v / a] : [q / (.5 * a), c / q];
      }
    }
    for (const t of roots) {
      if (t >= -EPS && t <= horizon + EPS && (!hit || t < hit.time)) hit = {time: Math.max(0, t), boundary};
    }
  }
  return hit;
}

// Each constant-acceleration interval is analytic. Split exactly at synchrony
// and the first belt-end event, so a long frame cannot overshoot and chatter.
export function advanceConveyor(config, previous, dt) {
  if (!Number.isFinite(dt) || dt < 0) throw new RangeError('dt must be finite and nonnegative');
  const run = {...previous};
  if (run.ended || dt === 0) return run;
  let remaining = dt;
  for (let segment = 0; remaining > EPS && segment < 4; segment++) {
    const force = conveyorForces(config, run.v), a = force.acceleration;
    let syncTime = Infinity;
    if (Math.abs(force.relative) > EPS && force.relative * a < 0) syncTime = -force.relative / a;
    const interval = Math.min(remaining, syncTime);
    const hit = firstBoundaryTime(run.s, run.v, a, interval);
    const elapsed = hit ? hit.time : interval;
    run.s += run.v * elapsed + .5 * a * elapsed * elapsed;
    run.v += a * elapsed;
    run.time += elapsed;
    run.beltTravel += config.beltSpeed * elapsed;
    remaining -= elapsed;
    if (hit) { run.s = hit.boundary; run.ended = true; break; }
    if (syncTime <= interval + EPS) run.v = config.beltSpeed;
  }
  return run;
}
