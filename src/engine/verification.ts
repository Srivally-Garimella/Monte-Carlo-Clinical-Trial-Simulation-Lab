import { runMonteCarloSimulation } from './monteCarlo';
import { normalCdf, normalInvCdf } from './normal';
import { SeededRNG } from './prng';
import { computeAnalyticalPower, evaluateTwoProportionTest } from './twoProportion';

export interface VerificationCaseResult {
  id: string;
  name: string;
  category: 'PRNG' | 'Distribution' | 'Two-Proportion' | 'Edge Case' | 'Monte Carlo';
  passed: boolean;
  expected: string;
  actual: string;
  detail: string;
}

export function runVerificationSuite(): VerificationCaseResult[] {
  const results: VerificationCaseResult[] = [];

  // 1. PRNG Reproducibility
  {
    const rngA = new SeededRNG('CLINICAL-TRIAL-42');
    const rngB = new SeededRNG('CLINICAL-TRIAL-42');
    const rngC = new SeededRNG('CLINICAL-TRIAL-43');
    const seqA = Array.from({ length: 12 }, () => rngA.nextUint32());
    const seqB = Array.from({ length: 12 }, () => rngB.nextUint32());
    const seqC = Array.from({ length: 12 }, () => rngC.nextUint32());
    const matchAB = seqA.every((v, i) => v === seqB[i]);
    const diffAC = seqA.some((v, i) => v !== seqC[i]);
    results.push({
      id: 'PRNG-01',
      name: 'Deterministic Seed Reproducibility',
      category: 'PRNG',
      passed: matchAB && diffAC,
      expected: 'Identical sequence for identical seed; distinct for different seed',
      actual: matchAB && diffAC ? 'Exact bitwise match & distinct divergence' : 'Mismatch',
      detail: `Seed hash A=${rngA.seedHash.toString(16)}, C=${rngC.seedHash.toString(16)}`,
    });
  }

  // 2. Binomial Moments (BTPE + Geometric + Bernoulli)
  {
    const rng = new SeededRNG('MOMENTS-CHECK');
    const cases = [
      { n: 25, p: 0.5, label: 'Bernoulli (n=25, p=0.50)' },
      { n: 120, p: 0.04, label: 'Geometric BG (n=120, p=0.04)' },
      { n: 400, p: 0.35, label: 'BTPE (n=400, p=0.35)' },
      { n: 400, p: 0.82, label: 'BTPE flipped (n=400, p=0.82)' },
    ];
    const reps = 4000;
    let allOk = true;
    const summaries: string[] = [];

    for (const c of cases) {
      let sum = 0;
      let sumSq = 0;
      for (let i = 0; i < reps; i++) {
        const k = rng.sampleBinomial(c.n, c.p);
        sum += k;
        sumSq += k * k;
      }
      const empMean = sum / reps;
      const empVar = sumSq / reps - empMean * empMean;
      const theoMean = c.n * c.p;
      const theoVar = c.n * c.p * (1 - c.p);
      const meanTol = 4.5 * Math.sqrt(theoVar / reps);
      const meanOk = Math.abs(empMean - theoMean) <= meanTol;
      const varRatio = empVar / theoVar;
      const varOk = varRatio > 0.88 && varRatio < 1.12;
      if (!meanOk || !varOk) allOk = false;
      summaries.push(`${c.label}: μ=${empMean.toFixed(2)}/${theoMean.toFixed(2)}`);
    }

    results.push({
      id: 'PRNG-02',
      name: 'Binomial Sampler Mean & Variance Calibration',
      category: 'PRNG',
      passed: allOk,
      expected: 'Sample μ within 4.5σ and σ² within ±12% across all 3 regimes',
      actual: allOk ? 'All 4 regimes calibrated' : 'Deviation detected',
      detail: summaries.join(' | '),
    });
  }

  // 3. Normal CDF & Inverse CDF round-trip
  {
    const probs = [0.0001, 0.005, 0.025, 0.25, 0.5, 0.75, 0.975, 0.995, 0.9999];
    let maxErr = 0;
    for (const q of probs) {
      const z = normalInvCdf(q);
      const back = normalCdf(z);
      maxErr = Math.max(maxErr, Math.abs(back - q));
    }
    const z975 = normalInvCdf(0.975);
    const zErr = Math.abs(z975 - 1.959963984540054);
    const passed = maxErr < 1e-10 && zErr < 1e-10;
    results.push({
      id: 'DIST-01',
      name: 'Standard Normal CDF & Probit Machine Precision',
      category: 'Distribution',
      passed,
      expected: 'Max round-trip error < 1e-10; Φ⁻¹(0.975) = 1.9599639845',
      actual: `maxErr=${maxErr.toExponential(2)}, z₀.₉₇₅=${z975.toFixed(10)}`,
      detail: 'Cody rational erfc + Acklam/Halley inverse CDF',
    });
  }

  // 4. Two-Proportion Textbook Benchmark
  {
    const res = evaluateTwoProportionTest({
      x1: 45,
      n1: 200,
      x2: 68,
      n2: 200,
      alpha: 0.05,
      direction: 'two-sided',
      continuityCorrection: false,
    });
    const zExpected = 2.5543342;
    const pExpected = 0.0106391;
    const zOk = Math.abs(res.zScore - zExpected) < 1e-5;
    const pOk = Math.abs(res.pValue - pExpected) < 1e-5;
    const ncOk = res.newcombeCI.lower > 0.026 && res.newcombeCI.upper < 0.203;
    results.push({
      id: 'TEST-01',
      name: 'Two-Proportion Z-Test & Newcombe CI Benchmark',
      category: 'Two-Proportion',
      passed: zOk && pOk && ncOk,
      expected: `z=${zExpected.toFixed(5)}, p=${pExpected.toFixed(5)}, Newcombe CI ∈ (0.026, 0.203)`,
      actual: `z=${res.zScore.toFixed(5)}, p=${res.pValue.toFixed(5)}, CI=[${res.newcombeCI.lower.toFixed(4)}, ${res.newcombeCI.upper.toFixed(4)}]`,
      detail: `p̂₁=0.225, p̂₂=0.340, p_pool=${res.pPooled.toFixed(4)}`,
    });
  }

  // 5. Edge Case: Degenerate Zero Variance (0/50 vs 0/50 and 50/50 vs 50/50)
  {
    const zeroCase = evaluateTwoProportionTest({
      x1: 0,
      n1: 50,
      x2: 0,
      n2: 50,
      alpha: 0.05,
      direction: 'two-sided',
      continuityCorrection: true,
    });
    const fullCase = evaluateTwoProportionTest({
      x1: 50,
      n1: 50,
      x2: 50,
      n2: 50,
      alpha: 0.05,
      direction: 'two-sided',
      continuityCorrection: false,
    });
    const validZero =
      zeroCase.degenerateVariance &&
      zeroCase.zScore === 0 &&
      zeroCase.pValue === 1 &&
      Number.isFinite(zeroCase.newcombeCI.lower) &&
      Number.isFinite(zeroCase.newcombeCI.upper) &&
      zeroCase.newcombeCI.lower < 0 &&
      zeroCase.newcombeCI.upper > 0;
    const validFull =
      fullCase.degenerateVariance &&
      fullCase.zScore === 0 &&
      fullCase.pValue === 1 &&
      Number.isFinite(fullCase.newcombeCI.lower) &&
      Number.isFinite(fullCase.newcombeCI.upper);

    results.push({
      id: 'EDGE-01',
      name: 'Zero-Variance Boundary (0% vs 0% and 100% vs 100%)',
      category: 'Edge Case',
      passed: validZero && validFull,
      expected: 'No NaN/Infinity; z=0, p=1, Newcombe CI strictly non-zero width',
      actual:
        validZero && validFull
          ? `0% CI=[${zeroCase.newcombeCI.lower.toFixed(3)}, ${zeroCase.newcombeCI.upper.toFixed(3)}]`
          : 'Invalid NaN or collapsed boundary',
      detail: 'Verifies division-by-zero protection and Wilson score arm bounds',
    });
  }

  // 6. Edge Case: One-Sided Boundary + Small Expected Cells + Continuity Correction
  {
    const noCC = evaluateTwoProportionTest({
      x1: 0,
      n1: 25,
      x2: 5,
      n2: 25,
      alpha: 0.05,
      direction: 'greater',
      continuityCorrection: false,
    });
    const withCC = evaluateTwoProportionTest({
      x1: 0,
      n1: 25,
      x2: 5,
      n2: 25,
      alpha: 0.05,
      direction: 'greater',
      continuityCorrection: true,
    });
    const passed =
      noCC.warnings.length >= 2 &&
      withCC.zScore < noCC.zScore &&
      withCC.pValue > noCC.pValue &&
      noCC.newcombeCI.lower > 0 &&
      Number.isFinite(noCC.oddsRatio ?? NaN);

    results.push({
      id: 'EDGE-02',
      name: 'Boundary Arm (0/25 vs 5/25) & Yates Correction',
      category: 'Edge Case',
      passed,
      expected: 'Small-cell warning triggered; CC reduces |z|; Newcombe lower > 0',
      actual: `z_raw=${noCC.zScore.toFixed(3)}, z_cc=${withCC.zScore.toFixed(3)}, Newcombe=[${noCC.newcombeCI.lower.toFixed(3)}, ${noCC.newcombeCI.upper.toFixed(3)}]`,
      detail: `Warnings emitted: ${noCC.warnings.length}`,
    });
  }

  // 7. Monte Carlo Null Calibration & Reproducibility
  {
    const simParams = {
      p1: 0.3,
      n1: 150,
      p2: 0.3,
      n2: 150,
      alpha: 0.05,
      direction: 'two-sided' as const,
      continuityCorrection: false,
      repetitions: 1500,
      seed: 'NULL-CALIBRATION',
      useCustomCounts: false,
      customX1: 45,
      customX2: 45,
    };
    const run1 = runMonteCarloSimulation(simParams);
    const run2 = runMonteCarloSimulation(simParams);
    const deterministic =
      run1.calculationId === run2.calculationId &&
      run1.empiricalPower === run2.empiricalPower &&
      run1.newcombeCoverage === run2.newcombeCoverage;
    const type1Ok = run1.empiricalPower >= 0.032 && run1.empiricalPower <= 0.068;
    const coverageOk = run1.newcombeCoverage >= 0.93 && run1.newcombeCoverage <= 0.97;
    const theoZeroPower = Math.abs(computeAnalyticalPower(0.3, 150, 0.3, 150, 0.05, 'two-sided') - 0.05) < 1e-6;

    results.push({
      id: 'MC-01',
      name: 'Monte Carlo Null Type-I Error & 95% CI Coverage',
      category: 'Monte Carlo',
      passed: deterministic && type1Ok && coverageOk && theoZeroPower,
      expected: 'Deterministic ID; Type-I ∈ [0.032, 0.068]; Coverage ∈ [0.93, 0.97]',
      actual: `Type-I=${(run1.empiricalPower * 100).toFixed(2)}%, Cov=${(run1.newcombeCoverage * 100).toFixed(2)}%`,
      detail: `Calculation ID ${run1.calculationId} (${run1.computeTimeMs.toFixed(1)} ms)`,
    });
  }

  return results;
}
