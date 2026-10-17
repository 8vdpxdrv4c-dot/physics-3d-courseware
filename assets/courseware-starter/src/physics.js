// Authoritative model calculations. Scene transforms and UI derive from these.
export function thinLens(u, f, screen) {
  if (!(u > 0 && f > 0)) throw new RangeError('物距与焦距必须为正值');
  if (Math.abs(u - f) < 1e-8) return { v: null, m: null, real: false, focused: false, kind: '不成有限位置的像', detail: '物体位于焦点 · 出射光线平行', limit: true };
  const v = f * u / (u - f), m = -v / u;
  const size = Math.abs(Math.abs(m) - 1) < 1e-7 ? '等大' : Math.abs(m) > 1 ? '放大' : '缩小';
  return { v, m, real: v > 0, focused: v > 0 && Math.abs(v - screen) < 0.35,
    kind: `${v > 0 ? '倒立' : '正立'} · ${size} · ${v > 0 ? '实像' : '虚像'}`,
    detail: v > 0 ? '实像可用光屏承接；移动光屏，观察清晰位置' : '虚像在物体同侧，不能用光屏承接', limit: false };
}

export function leverBalance(leftForce, leftArm, rightForce, rightArm) {
  const leftTorque = leftForce * leftArm, rightTorque = rightForce * rightArm;
  const net = leftTorque - rightTorque;
  return { leftTorque, rightTorque, net, balanced: Math.abs(net) < 1e-8,
    kind: Math.abs(net) < 1e-8 ? '力矩相等 · 杠杆平衡' : net > 0 ? '左侧力矩较大' : '右侧力矩较大' };
}

// Dimensionless point dipole m=(polarity,0,0), origin at magnet center.
// Used only outside the exclusion region. No physical tesla calibration claimed.
export function dipoleField(x, y, z, polarity = 1) {
  const r2 = x*x + y*y + z*z;
  if (r2 < 1e-8) return null;
  const scale = polarity / Math.pow(r2, 2.5);
  return [scale * (3*x*x-r2), scale * 3*x*y, scale * 3*x*z];
}

export function dipoleLine(theta, phi, L, polarity = 1, count = 96) {
  // Integral curve of a point dipole: r = L sin²(theta).
  // theta increases from the +x pole to the -x pole when polarity=+1.
  const start = Math.asin(Math.sqrt(0.87 / L));
  const pts = [];
  for (let i=0; i<=count; i++) {
    const t = start + (Math.PI-2*start) * i/count;
    const r = L * Math.sin(t)**2;
    pts.push([r*Math.cos(t), r*Math.sin(t)*Math.cos(phi), r*Math.sin(t)*Math.sin(phi)]);
  }
  return polarity > 0 ? pts : pts.reverse();
}
