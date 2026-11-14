import { SeededRNG } from './prng';
import {
  computeAnalyticalPower,
  estimateRequiredNPerArm,
  evaluateTwoProportionTest,
  type HypothesisDirection,
  type TwoProportionResult,
} from './twoProportion';

export interface SimulationParams {
  p1: number;
  n1: number;
  p2: number;
  n2: number;
  alpha: number;
  direction: HypothesisDirection;
  continuityCorrection: boolean;
  repetitions: number;
  seed: string;
  useCustomCounts: boolean;
  customX1: number;
  customX2: number;
}

export interface ConvergencePoint {
  rep: number;
  empiricalPower: number;
  newcombeCoverage: number;
  waldCoverage: number;
}

export interface DiffHistogramBin {
  binStart: number;
  binEnd: number;
  mid: number;
  count: number;
  density: number;
}

export interface PValueHistogramBin {
  binStart: number;
  binEnd: number;
  count: number;
  proportion: number;
}

export interface SampleTrialRecord {
  index: number;
  x1: number;
  x2: number;
  p1Hat: number;
  p2Hat: number;
  diff: number;
  zScore: number;
  pValue: number;
  significant: boolean;
  newcombeLower: number;
  newcombeUpper: number;
  waldLower: number;
  waldUpper: number;
  coversTrueDiff: boolean;
  waldCoversTrueDiff: boolean;
}

export interface PowerCurvePoint {
  nPerArm: number;
  power: number;
}

export interface SensitivityCell {
  nPerArm: number;
  p2: number;
  power: number;
}

export interface SimulationResult {
  params: SimulationParams;
  seedHash: number;
  calculationId: string;
  focalTrial: {
    source: 'custom-observed' | 'monte-carlo-trial-1';
    x1: number;
    x2: number;
    inference: TwoProportionResult;
  };
  theoreticalPower: number;
  empiricalPower: number;
  powerStandardError: number;
  requiredN80: number | null;
  requiredN90: number | null;
  rejectionCount: number;
  waldCoverage: number;
  newcombeCoverage: number;
  meanDiffEstimate: number;
  trueDiff: number;
  bias: number;
  empiricalSD: number;
  theoreticalSE: number;
  meanWaldWidth: number;
  meanNewcombeWidth: number;
  degenerateCount: number;
  convergenceSeries: ConvergencePoint[];
  diffHistogram: DiffHistogramBin[];
  pValueHistogram: PValueHistogramBin[];
  sampleTrials: SampleTrialRecord[];
  powerCurveByN: PowerCurvePoint[];
  sensitivityGrid: SensitivityCell[];
  computeTimeMs: number;
}

export function runMonteCarloSimulation(rawParams: SimulationParams): SimulationResult {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();

  const p1 = Math.min(1, Math.max(0, rawParams.p1));
  const p2 = Math.min(1, Math.max(0, rawParams.p2));
  const n1 = Math.min(100000, Math.max(2, Math.floor(rawParams.n1)));
  const n2 = Math.min(100000, Math.max(2, Math.floor(rawParams.n2)));
  const alpha = Math.min(0.25, Math.max(0.001, rawParams.alpha));
  const repetitions = Math.min(10000, Math.max(10, Math.floor(rawParams.repetitions)));
  const seed = rawParams.seed.trim() || 'STRATA-2026';

  const params: SimulationParams = {
    ...rawParams,
    p1,
    p2,
    n1,
    n2,
    alpha,
    repetitions,
    seed,
    customX1: Math.min(n1, Math.max(0, Math.round(rawParams.customX1))),
    customX2: Math.min(n2, Math.max(0, Math.round(rawParams.customX2))),
  };

  const rng = new SeededRNG(seed);
  const trueDiff = p2 - p1;
  const theoreticalPower = computeAnalyticalPower(p1, n1, p2, n2, alpha, params.direction);
  const theoreticalSE = Math.sqrt(
    Math.max(0, (p1 * (1 - p1)) / n1 + (p2 * (1 - p2)) / n2)
  );

  let rejectionCount = 0;
  let waldCoverCount = 0;
  let newcombeCoverCount = 0;
  let degenerateCount = 0;
  let sumDiff = 0;
  let sumDiffSq = 0;
  let sumWaldWidth = 0;
  let sumNewcombeWidth = 0;

  const diffs = new Float64Array(repetitions);
  const pValues = new Float64Array(repetitions);
  const sampleTrials: SampleTrialRecord[] = [];
  const convergenceSeries: ConvergencePoint[] = [];

  const checkpointStep = Math.max(1, Math.floor(repetitions / 80));

  let firstTrialX1 = 0;
  let firstTrialX2 = 0;
  let firstTrialInference: TwoProportionResult | null = null;

  for (let r = 0; r < repetitions; r++) {
    const x1 = rng.sampleBinomial(n1, p1);
    const x2 = rng.sampleBinomial(n2, p2);

    const res = evaluateTwoProportionTest({
      x1,
      n1,
      x2,
      n2,
      alpha,
      direction: params.direction,
      continuityCorrection: params.continuityCorrection,
    });

    if (r === 0) {
      firstTrialX1 = x1;
      firstTrialX2 = x2;
      firstTrialInference = res;
    }

    if (res.significant) rejectionCount++;
    if (res.degenerateVariance) degenerateCount++;

    const coversNewcombe =
      res.newcombeCI.lower - 1e-12 <= trueDiff && trueDiff <= res.newcombeCI.upper + 1e-12;
    const coversWald =
      res.waldCI.lower - 1e-12 <= trueDiff && trueDiff <= res.waldCI.upper + 1e-12;

    if (coversNewcombe) newcombeCoverCount++;
    if (coversWald) waldCoverCount++;

    sumDiff += res.diff;
    sumDiffSq += res.diff * res.diff;
    sumWaldWidth += res.waldCI.width;
    sumNewcombeWidth += res.newcombeCI.width;

    diffs[r] = res.diff;
    pValues[r] = res.pValue;

    if (r < 100) {
      sampleTrials.push({
        index: r + 1,
        x1,
        x2,
        p1Hat: res.p1Hat,
        p2Hat: res.p2Hat,
        diff: res.diff,
        zScore: res.zScore,
        pValue: res.pValue,
        significant: res.significant,
        newcombeLower: res.newcombeCI.lower,
        newcombeUpper: res.newcombeCI.upper,
        waldLower: res.waldCI.lower,
        waldUpper: res.waldCI.upper,
        coversTrueDiff: coversNewcombe,
        waldCoversTrueDiff: coversWald,
      });
    }

    const repNum = r + 1;
    if (repNum % checkpointStep === 0 || repNum === repetitions) {
      convergenceSeries.push({
        rep: repNum,
        empiricalPower: rejectionCount / repNum,
        newcombeCoverage: newcombeCoverCount / repNum,
        waldCoverage: waldCoverCount / repNum,
      });
    }
  }

  const empiricalPower = rejectionCount / repetitions;
  const powerStandardError = Math.sqrt((empiricalPower * (1 - empiricalPower)) / repetitions);
  const meanDiffEstimate = sumDiff / repetitions;
  const bias = meanDiffEstimate - trueDiff;
  const variance = Math.max(0, sumDiffSq / repetitions - meanDiffEstimate * meanDiffEstimate);
  const empiricalSD = Math.sqrt(variance);

  // Build empirical difference histogram (28 bins centered around observed spread)
  let minDiff = diffs[0];
  let maxDiff = diffs[0];
  for (let i = 1; i < repetitions; i++) {
    if (diffs[i] < minDiff) minDiff = diffs[i];
    if (diffs[i] > maxDiff) maxDiff = diffs[i];
  }
  const span = Math.max(0.02, maxDiff - minDiff);
  const pad = span * 0.08;
  const histMin = Math.max(-1, minDiff - pad);
  const histMax = Math.min(1, maxDiff + pad);
  const numBins = 28;
  const binWidth = Math.max(1e-5, (histMax - histMin) / numBins);
  const binCounts = new Int32Array(numBins);

  for (let i = 0; i < repetitions; i++) {
    const idx = Math.min(numBins - 1, Math.max(0, Math.floor((diffs[i] - histMin) / binWidth)));
    binCounts[idx]++;
  }

  const diffHistogram: DiffHistogramBin[] = [];
  for (let b = 0; b < numBins; b++) {
    const binStart = histMin + b * binWidth;
    const binEnd = binStart + binWidth;
    diffHistogram.push({
      binStart,
      binEnd,
      mid: 0.5 * (binStart + binEnd),
      count: binCounts[b],
      density: binCounts[b] / (repetitions * binWidth),
    });
  }

  // Build p-value histogram (20 uniform bins in [0, 1])
  const pBins = 20;
  const pCounts = new Int32Array(pBins);
  for (let i = 0; i < repetitions; i++) {
    const idx = Math.min(pBins - 1, Math.max(0, Math.floor(pValues[i] * pBins)));
    pCounts[idx]++;
  }
  const pValueHistogram: PValueHistogramBin[] = [];
  for (let b = 0; b < pBins; b++) {
    pValueHistogram.push({
      binStart: b / pBins,
      binEnd: (b + 1) / pBins,
      count: pCounts[b],
      proportion: pCounts[b] / repetitions,
    });
  }

  // Focal trial (either custom observed counts or Monte Carlo trial #1)
  const focalX1 = params.useCustomCounts ? params.customX1 : firstTrialX1;
  const focalX2 = params.useCustomCounts ? params.customX2 : firstTrialX2;
  const focalInference = params.useCustomCounts
    ? evaluateTwoProportionTest({
        x1: focalX1,
        n1,
        x2: focalX2,
        n2,
        alpha,
        direction: params.direction,
        continuityCorrection: params.continuityCorrection,
      })
    : firstTrialInference!;

  // Power curve across sample sizes (balanced nPerArm scaled around user n1/n2)
  const maxN = Math.max(250, Math.round(Math.max(n1, n2) * 2.5));
  const minN = Math.max(10, Math.round(Math.min(n1, n2) * 0.15));
  const curveSteps = 24;
  const powerCurveByN: PowerCurvePoint[] = [];
  for (let i = 0; i <= curveSteps; i++) {
    const nPerArm = Math.round(minN + ((maxN - minN) * i) / curveSteps);
    powerCurveByN.push({
      nPerArm,
      power: computeAnalyticalPower(p1, nPerArm, p2, nPerArm, alpha, params.direction),
    });
  }

  // 2D Sensitivity matrix across nPerArm (5 levels) x p2 (6 levels)
  const nLevels = [
    Math.max(10, Math.round(n1 * 0.25)),
    Math.max(20, Math.round(n1 * 0.5)),
    n1,
    Math.round(n1 * 1.5),
    Math.round(n1 * 2.5),
  ];
  const p2Offsets = [-0.05, 0.0, 0.04, 0.08, 0.12, 0.18];
  const sensitivityGrid: SensitivityCell[] = [];
  for (const nl of nLevels) {
    for (const off of p2Offsets) {
      const targetP2 = Math.min(0.99, Math.max(0.01, Number((p1 + off).toFixed(3))));
      sensitivityGrid.push({
        nPerArm: nl,
        p2: targetP2,
        power: computeAnalyticalPower(p1, nl, targetP2, nl, alpha, params.direction),
      });
    }
  }

  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();

  const signatureString = JSON.stringify({
    p1,
    n1,
    p2,
    n2,
    alpha,
    dir: params.direction,
    cc: params.continuityCorrection,
    rep: repetitions,
    seed,
    custom: params.useCustomCounts ? [focalX1, focalX2] : null,
    emp: empiricalPower.toFixed(6),
    z: focalInference.zScore.toFixed(6),
  });
  let sigHash = 0;
  for (let i = 0; i < signatureString.length; i++) {
    sigHash = (Math.imul(31, sigHash) + signatureString.charCodeAt(i)) >>> 0;
  }

  return {
    params,
    seedHash: rng.seedHash,
    calculationId: `CALC-${sigHash.toString(16).toUpperCase().padStart(8, '0')}`,
    focalTrial: {
      source: params.useCustomCounts ? 'custom-observed' : 'monte-carlo-trial-1',
      x1: focalX1,
      x2: focalX2,
      inference: focalInference,
    },
    theoreticalPower,
    empiricalPower,
    powerStandardError,
    requiredN80: estimateRequiredNPerArm(p1, p2, alpha, 0.8, params.direction),
    requiredN90: estimateRequiredNPerArm(p1, p2, alpha, 0.9, params.direction),
    rejectionCount,
    waldCoverage: waldCoverCount / repetitions,
    newcombeCoverage: newcombeCoverCount / repetitions,
    meanDiffEstimate,
    trueDiff,
    bias,
    empiricalSD,
    theoreticalSE,
    meanWaldWidth: sumWaldWidth / repetitions,
    meanNewcombeWidth: sumNewcombeWidth / repetitions,
    degenerateCount,
    convergenceSeries,
    diffHistogram,
    pValueHistogram,
    sampleTrials,
    powerCurveByN,
    sensitivityGrid,
    computeTimeMs: Math.max(0.01, t1 - t0),
  };
}
