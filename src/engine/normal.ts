/**
 * High-precision Standard Normal PDF, CDF (Cody's erfc ~1e-15), and Probit (Acklam + Halley).
 */

const INV_SQRT_2PI = 0.3989422804014327;

export function normalPdf(z: number): number {
  return INV_SQRT_2PI * Math.exp(-0.5 * z * z);
}

/**
 * Complementary error function erfc(x) accurate to full IEEE-754 double precision (~1e-15).
 * Uses convergent positive-term Taylor series for |x| < 1.5 and Lentz continued fraction for |x| >= 1.5.
 */
export function erfc(x: number): number {
  const absX = Math.abs(x);
  if (absX === 0) return 1;
  if (absX > 26.5) return x >= 0 ? 0 : 2;

  const TWO_OVER_SQRT_PI = 1.1283791670955126;
  const ONE_OVER_SQRT_PI = 0.5641895835477563;
  let result: number;

  if (absX < 1.5) {
    // erf(absX) via positive-term series: (2/sqrt(pi)) * exp(-x^2) * sum (2^k x^(2k+1)) / (2k+1)!!
    const x2 = absX * absX;
    let term = absX;
    let sum = term;
    for (let k = 1; k <= 40; k++) {
      term *= (2 * x2) / (2 * k + 1);
      sum += term;
      if (term < sum * 1e-16) break;
    }
    const erfVal = TWO_OVER_SQRT_PI * Math.exp(-x2) * sum;
    result = Math.max(0, 1 - erfVal);
  } else {
    // Continued fraction via modified Lentz's method:
    // erfc(x) = exp(-x^2) / sqrt(pi) * 1 / (x + (1/2)/(x + 1/(x + (3/2)/(x + ...))))
    const tiny = 1e-300;
    let f = absX;
    let C = f;
    let D = 0;
    for (let k = 1; k <= 100; k++) {
      const a = k * 0.5;
      const b = absX;
      D = b + a * D;
      if (Math.abs(D) < tiny) D = tiny;
      C = b + a / C;
      if (Math.abs(C) < tiny) C = tiny;
      D = 1 / D;
      const delta = C * D;
      f *= delta;
      if (Math.abs(delta - 1) < 1e-15) break;
    }
    result = (ONE_OVER_SQRT_PI * Math.exp(-absX * absX)) / f;
  }

  return x < 0 ? 2 - result : result;
}

export function normalCdf(z: number): number {
  if (!Number.isFinite(z)) return z > 0 ? 1 : 0;
  return 0.5 * erfc(-z * Math.SQRT1_2);
}

/**
 * Inverse Standard Normal CDF (Probit) via Peter J. Acklam's algorithm
 * with one Halley refinement iteration for full IEEE-754 double precision.
 */
export function normalInvCdf(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p === 0.5) return 0;

  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.38357751867269e2, -3.066479806614716e1, 2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783,
  ];
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
    3.754408661907416,
  ];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  let x: number;

  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    x =
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= pHigh) {
    const q = p - 0.5;
    const r = q * q;
    x =
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    x =
      -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }

  // One Halley step to refine to machine precision
  const err = normalCdf(x) - p;
  const u = err / normalPdf(x);
  x = x - u / (1 + 0.5 * x * u);
  return x;
}
