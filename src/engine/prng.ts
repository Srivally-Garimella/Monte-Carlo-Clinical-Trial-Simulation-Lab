/**
 * Reproducible Pseudo-Random Number Generator (SplitMix32 -> Xoshiro128++)
 * and Exact Binomial Sampler (Bernoulli / Geometric Waiting-Time / BTPE).
 */

export function hashSeed(seedInput: string | number): number {
  const str = String(seedInput);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // Murmur3 32-bit finalizer avalanche
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

function splitmix32(state: number): () => number {
  let a = state >>> 0;
  return () => {
    a = (a + 0x9e3779b9) >>> 0;
    let t = a ^ (a >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t ^= t >>> 15;
    t = Math.imul(t, 0x735a2d97);
    t ^= t >>> 15;
    return t >>> 0;
  };
}

function rotl32(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}

export class SeededRNG {
  private s0: number;
  private s1: number;
  private s2: number;
  private s3: number;
  public readonly seedHash: number;

  constructor(seed: string | number) {
    this.seedHash = hashSeed(seed);
    const sm = splitmix32(this.seedHash || 1);
    this.s0 = sm();
    this.s1 = sm();
    this.s2 = sm();
    this.s3 = sm();
    if ((this.s0 | this.s1 | this.s2 | this.s3) === 0) {
      this.s0 = 1;
    }
  }

  /** Returns a uniform 32-bit unsigned integer */
  public nextUint32(): number {
    const result = (rotl32((this.s0 + this.s3) >>> 0, 7) + this.s0) >>> 0;
    const t = (this.s1 << 9) >>> 0;

    this.s2 ^= this.s0;
    this.s3 ^= this.s1;
    this.s1 ^= this.s2;
    this.s0 ^= this.s3;

    this.s2 ^= t;
    this.s3 = rotl32(this.s3, 11);

    return result;
  }

  /** Returns a uniform float in [0, 1) with 32-bit resolution */
  public next(): number {
    return this.nextUint32() / 4294967296;
  }

  /** Returns a uniform float strictly in (0, 1) */
  public nextOpen(): number {
    return (this.nextUint32() + 0.5) / 4294967296;
  }

  /**
   * Exact Binomial(n, p) sampler.
   * Uses:
   * - Direct boundary guards for p <= 0, p >= 1, n <= 0
   * - Direct Bernoulli summation for n <= 40
   * - Geometric waiting-time (Devroye BG) when n * min(p, 1-p) < 10
   * - Kachitvichyanukul & Schmeiser (1988) BTPE algorithm when n * min(p, 1-p) >= 10
   */
  public sampleBinomial(n: number, p: number): number {
    const trials = Math.max(0, Math.floor(n));
    if (trials === 0 || p <= 0) return 0;
    if (p >= 1) return trials;

    const flipped = p > 0.5;
    const q = flipped ? 1 - p : p;

    let result: number;
    if (trials <= 40) {
      let count = 0;
      for (let i = 0; i < trials; i++) {
        if (this.next() < q) count++;
      }
      result = count;
    } else if (trials * q < 10) {
      // Exact geometric waiting-time algorithm
      const logOneMinusQ = Math.log1p(-q);
      let x = 0;
      let sum = 0;
      while (true) {
        const u = this.nextOpen();
        sum += Math.floor(Math.log(u) / logOneMinusQ) + 1;
        if (sum > trials) break;
        x++;
      }
      result = x;
    } else {
      result = this.sampleBinomialBTPE(trials, q);
    }

    return flipped ? trials - result : result;
  }

  private sampleBinomialBTPE(n: number, p: number): number {
    const q = 1 - p;
    const np = n * p;
    const fm = np + p;
    const m = Math.floor(fm);
    const p1 = Math.floor(2.195 * Math.sqrt(n * p * q) - 4.6 * q) + 0.5;
    const xm = m + 0.5;
    const xl = xm - p1;
    const xr = xm + p1;
    const c = 0.134 + 20.5 / (15.3 + m);
    const a = (fm - xl) / (fm - xl * p);
    const laml = a * (1 + 0.5 * a);
    const a2 = (xr - fm) / (xr * q);
    const lamr = a2 * (1 + 0.5 * a2);
    const p2 = p1 * (1 + 2 * c);
    const p3 = p2 + c / laml;
    const p4 = p3 + c / lamr;

    while (true) {
      const u = this.next() * p4;
      let v = this.nextOpen();
      let y: number;

      if (u <= p1) {
        y = Math.floor(xm - p1 * v + u);
        return y;
      } else if (u <= p2) {
        const x = xl + (u - p1) / c;
        v = v * c + 1 - Math.abs(m - x + 0.5) / p1;
        if (v > 1) continue;
        y = Math.floor(x);
      } else if (u <= p3) {
        y = Math.floor(xl + Math.log(v) / laml);
        if (y < 0) continue;
        v = v * (u - p2) * laml;
      } else {
        y = Math.floor(xr - Math.log(v) / lamr);
        if (y > n) continue;
        v = v * (u - p3) * lamr;
      }

      const k = Math.abs(y - m);
      if (k <= 20 || k >= (n * p * q) / 2 - 1) {
        let s = p / q;
        let aProd = s * (n + 1);
        let F = 1.0;
        if (m < y) {
          for (let i = m + 1; i <= y; i++) {
            F *= aProd / i - s;
          }
        } else if (m > y) {
          for (let i = y + 1; i <= m; i++) {
            F /= aProd / i - s;
          }
        }
        if (v <= F) return y;
      } else {
        const rho = (k / (n * p * q)) * ((k * (k / 3 + 0.625) + 1 / 6) / (n * p * q) + 0.5);
        const t = -(k * k) / (2 * n * p * q);
        const A = Math.log(v);
        if (A < t - rho) return y;
        if (A <= t + rho) {
          const x1 = y + 1;
          const f1 = m + 1;
          const z = n + 1 - m;
          const w = n - y + 1;
          const x2 = x1 * x1;
          const f2 = f1 * f1;
          const z2 = z * z;
          const w2 = w * w;
          const bound =
            xm * Math.log(f1 / x1) +
            (n - m + 0.5) * Math.log(z / w) +
            (y - m) * Math.log((w * p) / (x1 * q)) +
            (13860 - (462 - (132 - (99 - 140 / f2) / f2) / f2) / f2) / f1 / 166320 +
            (13860 - (462 - (132 - (99 - 140 / z2) / z2) / z2) / z2) / z / 166320 +
            (13860 - (462 - (132 - (99 - 140 / x2) / x2) / x2) / x2) / x1 / 166320 +
            (13860 - (462 - (132 - (99 - 140 / w2) / w2) / w2) / w2) / w / 166320;
          if (A <= bound) return y;
        }
      }
    }
  }
}
