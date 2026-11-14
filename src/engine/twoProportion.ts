import { normalCdf, normalInvCdf } from './normal';

export type HypothesisDirection = 'two-sided' | 'greater' | 'less';

export interface TwoProportionInput {
  x1: number;
  n1: number;
  x2: number;
  n2: number;
  alpha: number;
  direction: HypothesisDirection;
  continuityCorrection: boolean;
}

export interface ConfidenceInterval {
  lower: number;
  upper: number;
  width: number;
  containsZero: boolean;
}

export interface TwoProportionResult {
  x1: number;
  n1: number;
  x2: number;
  n2: number;
  p1Hat: number;
  p2Hat: number;
  diff: number;
  pPooled: number;
  sePooled: number;
  seUnpooled: number;
  correctionTerm: number;
  zScore: number;
  zCritical: number;
  pValue: number;
  significant: boolean;
  degenerateVariance: boolean;
  waldCI: ConfidenceInterval;
  newcombeCI: ConfidenceInterval;
  arm1WilsonCI: ConfidenceInterval;
  arm2WilsonCI: ConfidenceInterval;
  relativeRisk: number | null;
  oddsRatio: number | null;
  nnt: number | null;
  warnings: string[];
}

export function wilsonArmCI(x: number, n: number, z: number): ConfidenceInterval {
  if (n <= 0) {
    return { lower: 0, upper: 1, width: 1, containsZero: true };
  }
  const p = Math.min(1, Math.max(0, x / n));
  const z2 = z * z;
  const denom = 2 * (n + z2);
  const center = 2 * n * p + z2;
  const radius = z * Math.sqrt(z2 + 4 * n * p * (1 - p));
  const lower = Math.max(0, (center - radius) / denom);
  const upper = Math.min(1, (center + radius) / denom);
  return {
    lower,
    upper,
    width: Math.max(0, upper - lower),
    containsZero: lower <= 0 && upper >= 0,
  };
}

export function evaluateTwoProportionTest(input: TwoProportionInput): TwoProportionResult {
  const n1 = Math.max(1, Math.floor(input.n1));
  const n2 = Math.max(1, Math.floor(input.n2));
  const x1 = Math.min(n1, Math.max(0, Math.round(input.x1)));
  const x2 = Math.min(n2, Math.max(0, Math.round(input.x2)));
  const alpha = Math.min(0.499, Math.max(1e-6, input.alpha));
  const { direction, continuityCorrection } = input;

  const p1Hat = x1 / n1;
  const p2Hat = x2 / n2;
  const diff = p2Hat - p1Hat;

  const pPooled = (x1 + x2) / (n1 + n2);
  const invNSum = 1 / n1 + 1 / n2;
  const sePooled = Math.sqrt(Math.max(0, pPooled * (1 - pPooled) * invNSum));
  const seUnpooled = Math.sqrt(
    Math.max(0, (p1Hat * (1 - p1Hat)) / n1 + (p2Hat * (1 - p2Hat)) / n2)
  );

  const correctionTerm = continuityCorrection ? 0.5 * invNSum : 0;
  let adjustedDiff = diff;
  if (continuityCorrection) {
    if (Math.abs(diff) <= correctionTerm) {
      adjustedDiff = 0;
    } else {
      adjustedDiff = Math.sign(diff) * (Math.abs(diff) - correctionTerm);
    }
  }

  const degenerateVariance = sePooled === 0;
  const zScore = degenerateVariance ? 0 : adjustedDiff / sePooled;

  let pValue: number;
  if (degenerateVariance) {
    pValue = 1;
  } else if (direction === 'two-sided') {
    pValue = Math.min(1, Math.max(0, 2 * (1 - normalCdf(Math.abs(zScore)))));
  } else if (direction === 'greater') {
    pValue = Math.min(1, Math.max(0, 1 - normalCdf(zScore)));
  } else {
    pValue = Math.min(1, Math.max(0, normalCdf(zScore)));
  }

  const zCritical =
    direction === 'two-sided' ? normalInvCdf(1 - alpha / 2) : normalInvCdf(1 - alpha);

  // Two-sided (1 - alpha) confidence intervals for p2 - p1
  const zCI = normalInvCdf(1 - alpha / 2);

  const waldMargin = zCI * seUnpooled + (continuityCorrection ? correctionTerm : 0);
  const waldLower = Math.max(-1, diff - waldMargin);
  const waldUpper = Math.min(1, diff + waldMargin);
  const waldCI: ConfidenceInterval = {
    lower: waldLower,
    upper: waldUpper,
    width: Math.max(0, waldUpper - waldLower),
    containsZero: waldLower <= 0 && waldUpper >= 0,
  };

  // Newcombe-Wilson Score CI (Method 10, Newcombe 1998)
  const arm1WilsonCI = wilsonArmCI(x1, n1, zCI);
  const arm2WilsonCI = wilsonArmCI(x2, n2, zCI);
  const newcombeLower = Math.max(
    -1,
    diff - Math.sqrt(Math.pow(p2Hat - arm2WilsonCI.lower, 2) + Math.pow(arm1WilsonCI.upper - p1Hat, 2))
  );
  const newcombeUpper = Math.min(
    1,
    diff + Math.sqrt(Math.pow(arm2WilsonCI.upper - p2Hat, 2) + Math.pow(p1Hat - arm1WilsonCI.lower, 2))
  );
  const newcombeCI: ConfidenceInterval = {
    lower: newcombeLower,
    upper: newcombeUpper,
    width: Math.max(0, newcombeUpper - newcombeLower),
    containsZero: newcombeLower <= 0 && newcombeUpper >= 0,
  };

  // Effect ratios with Haldane-Anscombe 0.5 continuity fallback for zero cells
  let relativeRisk: number | null = null;
  if (p1Hat > 0) {
    relativeRisk = p2Hat / p1Hat;
  } else if (x1 === 0 && x2 > 0) {
    relativeRisk = ((x2 + 0.5) / (n2 + 0.5)) / (0.5 / (n1 + 0.5));
  }

  let oddsRatio: number | null = null;
  const a = x2;
  const b = n2 - x2;
  const c = x1;
  const d = n1 - x1;
  if (b * c > 0) {
    oddsRatio = (a * d) / (b * c);
  } else if ((a + 0.5) * (d + 0.5) > 0 && (b + 0.5) * (c + 0.5) > 0) {
    oddsRatio = ((a + 0.5) * (d + 0.5)) / ((b + 0.5) * (c + 0.5));
  }

  const nnt = Math.abs(diff) > 1e-9 ? 1 / Math.abs(diff) : null;

  const warnings: string[] = [];
  if (degenerateVariance) {
    warnings.push(
      'Zero pooled variance (all observations identical across both arms); Z-statistic set to 0 and p-value = 1.000.'
    );
  }
  const exp1Succ = n1 * pPooled;
  const exp1Fail = n1 * (1 - pPooled);
  const exp2Succ = n2 * pPooled;
  const exp2Fail = n2 * (1 - pPooled);
  if (!degenerateVariance && Math.min(exp1Succ, exp1Fail, exp2Succ, exp2Fail) < 5) {
    warnings.push(
      'Expected cell count < 5 under H₀; normal Z-approximation may deviate from Fisher exact test.'
    );
  }
  if ((x1 === 0 || x1 === n1 || x2 === 0 || x2 === n2) && !degenerateVariance) {
    warnings.push(
      'Boundary arm proportion (0% or 100%) detected; Newcombe-Wilson score CI prevents Wald interval collapse.'
    );
  }

  return {
    x1,
    n1,
    x2,
    n2,
    p1Hat,
    p2Hat,
    diff,
    pPooled,
    sePooled,
    seUnpooled,
    correctionTerm,
    zScore,
    zCritical,
    pValue,
    significant: pValue < alpha,
    degenerateVariance,
    waldCI,
    newcombeCI,
    arm1WilsonCI,
    arm2WilsonCI,
    relativeRisk,
    oddsRatio,
    nnt,
    warnings,
  };
}

export function computeAnalyticalPower(
  p1: number,
  n1: number,
  p2: number,
  n2: number,
  alpha: number,
  direction: HypothesisDirection
): number {
  const cp1 = Math.min(1, Math.max(0, p1));
  const cp2 = Math.min(1, Math.max(0, p2));
  const cn1 = Math.max(1, Math.floor(n1));
  const cn2 = Math.max(1, Math.floor(n2));
  const calpha = Math.min(0.499, Math.max(1e-6, alpha));

  const diff = cp2 - cp1;
  const pBar = (cn1 * cp1 + cn2 * cp2) / (cn1 + cn2);
  const invN = 1 / cn1 + 1 / cn2;
  const sigma0 = Math.sqrt(Math.max(0, pBar * (1 - pBar) * invN));
  const sigma1 = Math.sqrt(
    Math.max(0, (cp1 * (1 - cp1)) / cn1 + (cp2 * (1 - cp2)) / cn2)
  );

  if (sigma0 === 0 && sigma1 === 0) {
    return 0;
  }

  if (sigma1 === 0) {
    // Both true probabilities are deterministic (e.g. p1=0, p2=1)
    if (direction === 'two-sided') return diff !== 0 ? 1 : 0;
    if (direction === 'greater') return diff > 0 ? 1 : 0;
    return diff < 0 ? 1 : 0;
  }

  if (direction === 'two-sided') {
    const zCrit = normalInvCdf(1 - calpha / 2);
    const upperReject = normalCdf((-zCrit * sigma0 + diff) / sigma1);
    const lowerReject = normalCdf((-zCrit * sigma0 - diff) / sigma1);
    return Math.min(1, Math.max(0, upperReject + lowerReject));
  } else if (direction === 'greater') {
    const zCrit = normalInvCdf(1 - calpha);
    return Math.min(1, Math.max(0, normalCdf((diff - zCrit * sigma0) / sigma1)));
  } else {
    const zCrit = normalInvCdf(1 - calpha);
    return Math.min(1, Math.max(0, normalCdf((-diff - zCrit * sigma0) / sigma1)));
  }
}

export function estimateRequiredNPerArm(
  p1: number,
  p2: number,
  alpha: number,
  targetPower: number,
  direction: HypothesisDirection
): number | null {
  const diff = Math.abs(p2 - p1);
  if (diff < 1e-6) return null;
  if (direction === 'greater' && p2 <= p1) return null;
  if (direction === 'less' && p2 >= p1) return null;

  let lo = 2;
  let hi = 200000;
  if (computeAnalyticalPower(p1, hi, p2, hi, alpha, direction) < targetPower) {
    return null;
  }
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (computeAnalyticalPower(p1, mid, p2, mid, alpha, direction) >= targetPower) {
      hi = mid;
    } else {
      lo = mid + 1;
    }
  }
  return lo;
}
