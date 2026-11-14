import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import {
  GeminiInterpretationPanel,
  type GeminiInterpretationPayload,
} from './components/GeminiInterpretationPanel';
import { ParameterDeck } from './components/ParameterDeck';
import { VerificationModal } from './components/VerificationModal';
import { ConfidenceIntervalCaliperChart } from './components/charts/ConfidenceIntervalCaliperChart';
import { MonteCarloCharts } from './components/charts/MonteCarloCharts';
import { PowerSensitivityCharts } from './components/charts/PowerSensitivityCharts';
import { ProbabilityDistributionChart } from './components/charts/ProbabilityDistributionChart';
import {
  runMonteCarloSimulation,
  type SimulationParams,
  type SimulationResult,
} from './engine/monteCarlo';

type HudView = 'inference' | 'montecarlo' | 'sensitivity' | 'ledger';

const DEFAULT_PARAMS: SimulationParams = {
  p1: 0.22,
  n1: 200,
  p2: 0.34,
  n2: 200,
  alpha: 0.05,
  direction: 'two-sided',
  continuityCorrection: false,
  repetitions: 2000,
  seed: 'STRATA-2026',
  useCustomCounts: false,
  customX1: 44,
  customX2: 68,
};

function formatPValue(p: number): string {
  if (p < 0.0001) return p.toExponential(2);
  return p.toFixed(5);
}

export default function App() {
  const [params, setParams] = useState<SimulationParams>(DEFAULT_PARAMS);
  const [activeView, setActiveView] = useState<HudView>('inference');
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [recomputeNonce, setRecomputeNonce] = useState(0);

  // Post-calculation state tracking for Gemini gating
  const [isComputing, setIsComputing] = useState(false);
  const [result, setResult] = useState<SimulationResult>(() =>
    runMonteCarloSimulation(DEFAULT_PARAMS)
  );
  const [calculationComplete, setCalculationComplete] = useState(true);

  const [isInterpreting, setIsInterpreting] = useState(false);
  const [interpretationData, setInterpretationData] =
    useState<GeminiInterpretationPayload | null>(null);
  const [interpretationError, setInterpretationError] = useState<string | null>(null);

  // Run deterministic simulation whenever parameters change
  useEffect(() => {
    setIsComputing(true);
    setCalculationComplete(false);
    setInterpretationError(null);

    const handle = window.setTimeout(() => {
      const computed = runMonteCarloSimulation(params);
      setResult(computed);
      setIsComputing(false);
      setCalculationComplete(true);
    }, 0);

    return () => window.clearTimeout(handle);
  }, [params, recomputeNonce]);

  const handleRequestInterpretation = useCallback(async () => {
    if (!calculationComplete || isComputing) return;

    setIsInterpreting(true);
    setInterpretationError(null);

    try {
      const { focalTrial } = result;
      const inf = focalTrial.inference;
      const resp = await fetch('/api/interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calculationId: result.calculationId,
          params: {
            p1: result.params.p1,
            n1: result.params.n1,
            p2: result.params.p2,
            n2: result.params.n2,
            alpha: result.params.alpha,
            direction: result.params.direction,
            continuityCorrection: result.params.continuityCorrection,
            repetitions: result.params.repetitions,
            seed: result.params.seed,
          },
          focalTrial: {
            source: focalTrial.source,
            x1: focalTrial.x1,
            x2: focalTrial.x2,
            p1Hat: inf.p1Hat,
            p2Hat: inf.p2Hat,
            diff: inf.diff,
            zScore: inf.zScore,
            pValue: inf.pValue,
            significant: inf.significant,
            newcombeLower: inf.newcombeCI.lower,
            newcombeUpper: inf.newcombeCI.upper,
            waldLower: inf.waldCI.lower,
            waldUpper: inf.waldCI.upper,
            relativeRisk: inf.relativeRisk,
            oddsRatio: inf.oddsRatio,
            nnt: inf.nnt,
            warnings: inf.warnings,
          },
          monteCarlo: {
            theoreticalPower: result.theoreticalPower,
            empiricalPower: result.empiricalPower,
            powerStandardError: result.powerStandardError,
            newcombeCoverage: result.newcombeCoverage,
            waldCoverage: result.waldCoverage,
            bias: result.bias,
            empiricalSD: result.empiricalSD,
            theoreticalSE: result.theoreticalSE,
            requiredN80: result.requiredN80,
            requiredN90: result.requiredN90,
            degenerateCount: result.degenerateCount,
          },
        }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || `HTTP ${resp.status}`);
      }
      setInterpretationData(data as GeminiInterpretationPayload);
    } catch (err: unknown) {
      setInterpretationError(
        err instanceof Error ? err.message : 'Unable to fetch Gemini interpretation.'
      );
    } finally {
      setIsInterpreting(false);
    }
  }, [calculationComplete, isComputing, result]);

  const handleExportCsv = useCallback(() => {
    const header = [
      'trial_index',
      'x1',
      'n1',
      'x2',
      'n2',
      'p1_hat',
      'p2_hat',
      'diff',
      'z_score',
      'p_value',
      'significant',
      'newcombe_lower',
      'newcombe_upper',
      'wald_lower',
      'wald_upper',
      'covers_true_diff',
    ].join(',');
    const rows = result.sampleTrials.map((t) =>
      [
        t.index,
        t.x1,
        result.params.n1,
        t.x2,
        result.params.n2,
        t.p1Hat.toFixed(6),
        t.p2Hat.toFixed(6),
        t.diff.toFixed(6),
        t.zScore.toFixed(6),
        t.pValue.toFixed(8),
        t.significant,
        t.newcombeLower.toFixed(6),
        t.newcombeUpper.toFixed(6),
        t.waldLower.toFixed(6),
        t.waldUpper.toFixed(6),
        t.coversTrueDiff,
      ].join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `monte-carlo-${result.calculationId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [result]);

  const inf = result.focalTrial.inference;
  const confLabel = useMemo(
    () => `${((1 - result.params.alpha) * 100).toFixed(1).replace(/\.0$/, '')}%`,
    [result.params.alpha]
  );

  return (
    <div className="min-h-screen bg-[#0e131e] text-[#dee2f2] flex flex-col hud-grid-bg">
      {/* Top Telemetry & Navigation Bar */}
      <header className="sticky top-0 z-30 bg-[#090e19]/95 backdrop-blur-md border-b border-[#334155] px-4 lg:px-6 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 shrink-0">
          <span className="w-2.5 h-2.5 bg-[#a855f7] border border-[#ddb7ff] shrink-0" />
          <h1 className="font-display text-sm sm:text-base font-bold tracking-tight text-[#dee2f2] whitespace-nowrap">
            Two-Proportion Monte Carlo Lab
          </h1>
        </div>

        <nav className="hidden md:flex items-center border border-[#334155] bg-[#171b27]">
          {(
            [
              { id: 'inference', label: 'Inference & Calipers' },
              { id: 'montecarlo', label: 'Monte Carlo Power' },
              { id: 'sensitivity', label: 'Sample Size Matrix' },
              { id: 'ledger', label: 'Trial Ledger' },
            ] as Array<{ id: HudView; label: string }>
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveView(tab.id)}
              className={`px-3.5 py-2 font-display text-xs font-semibold uppercase tracking-[0.06em] whitespace-nowrap transition-colors ${
                activeView === tab.id
                  ? 'bg-[#a855f7] text-[#090e19] font-bold'
                  : 'text-[#cfc2d6] hover:text-[#4cd7f6] hover:bg-[#1b1f2b]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2.5 shrink-0">
          <span className="hidden xl:inline-block font-mono text-[11px] text-[#988d9f] tabular-nums">
            SEED_HASH: 0x{result.seedHash.toString(16).toUpperCase().padStart(8, '0')}
          </span>
          <button
            type="button"
            onClick={() => setVerifyOpen(true)}
            className="px-3 py-1.5 border border-[#334155] bg-[#171b27] hover:border-[#06b6d4] text-xs font-display font-semibold uppercase tracking-[0.06em] text-[#4cd7f6] flex items-center gap-1.5 whitespace-nowrap transition-colors"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Verify Math</span>
          </button>
        </div>
      </header>

      {/* Mobile Tab Bar */}
      <div className="md:hidden grid grid-cols-4 border-b border-[#334155] bg-[#171b27]">
        {(
          [
            { id: 'inference', label: 'Inference' },
            { id: 'montecarlo', label: 'Monte Carlo' },
            { id: 'sensitivity', label: 'Matrix' },
            { id: 'ledger', label: 'Ledger' },
          ] as Array<{ id: HudView; label: string }>
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveView(tab.id)}
            className={`py-2.5 font-display text-[11px] font-bold uppercase tracking-[0.05em] ${
              activeView === tab.id
                ? 'bg-[#a855f7] text-[#090e19]'
                : 'text-[#cfc2d6]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Split Console */}
      <main className="flex-1 p-4 lg:p-6 max-w-[1680px] w-full mx-auto grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5 items-start">
        <ParameterDeck
          params={params}
          onChange={setParams}
          onRecompute={() => setRecomputeNonce((n) => n + 1)}
          onReset={() => setParams(DEFAULT_PARAMS)}
          onExportCsv={handleExportCsv}
          isComputing={isComputing}
        />

        <div className="space-y-4 min-w-0">
          {/* 4-Column KPI Telemetry Strip */}
          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {/* KPI 1: Z-Test & P-Value */}
            <div className="bg-[#171b27] border border-[#334155] p-3.5">
              <div className="flex items-center justify-between text-[11px] font-display font-bold uppercase tracking-[0.08em] text-[#988d9f]">
                <span>Two-Proportion Z-Test</span>
                <span className={inf.significant ? 'text-[#4cd7f6]' : 'text-[#cfc2d6]'}>
                  {inf.significant ? '● REJECT H₀' : '○ RETAIN H₀'}
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-mono font-bold tabular-nums text-[#dee2f2]">
                  z = {inf.zScore.toFixed(3)}
                </span>
                <span className="text-xs font-mono tabular-nums text-[#4cd7f6]">
                  p = {formatPValue(inf.pValue)}
                </span>
              </div>
              <div className="mt-1.5 text-[11px] font-mono tabular-nums text-[#988d9f]">
                {result.focalTrial.source === 'custom-observed' ? 'Custom' : 'MC Trial #1'}:{' '}
                {result.focalTrial.x1}/{params.n1} vs {result.focalTrial.x2}/{params.n2}
              </div>
            </div>

            {/* KPI 2: Newcombe-Wilson CI */}
            <div className="bg-[#171b27] border border-[#334155] p-3.5">
              <div className="flex items-center justify-between text-[11px] font-display font-bold uppercase tracking-[0.08em] text-[#988d9f]">
                <span>{confLabel} Newcombe-Wilson CI</span>
                <span className="text-[#4cd7f6]">Δ̂ = {(inf.diff * 100).toFixed(2)} pp</span>
              </div>
              <div className="mt-2 text-xl font-mono font-bold tabular-nums text-[#4cd7f6]">
                [{(inf.newcombeCI.lower * 100).toFixed(2)}%, {(inf.newcombeCI.upper * 100).toFixed(2)}%]
              </div>
              <div className="mt-1.5 text-[11px] font-mono tabular-nums text-[#988d9f]">
                Width: {(inf.newcombeCI.width * 100).toFixed(2)} pp ·{' '}
                {inf.newcombeCI.containsZero ? 'Includes 0%' : 'Excludes 0%'}
              </div>
            </div>

            {/* KPI 3: Empirical vs Theoretical Power */}
            <div className="bg-[#171b27] border border-[#334155] p-3.5">
              <div className="flex items-center justify-between text-[11px] font-display font-bold uppercase tracking-[0.08em] text-[#988d9f]">
                <span>Empirical Power (R={params.repetitions})</span>
                <span className="text-[#ddb7ff]">
                  ±{(result.powerStandardError * 100).toFixed(2)}% SE
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-mono font-bold tabular-nums text-[#ddb7ff]">
                  {(result.empiricalPower * 100).toFixed(2)}%
                </span>
                <span className="text-xs font-mono tabular-nums text-[#988d9f]">
                  vs {(result.theoreticalPower * 100).toFixed(2)}% theo
                </span>
              </div>
              <div className="mt-1.5 text-[11px] font-mono tabular-nums text-[#988d9f]">
                {result.rejectionCount.toLocaleString()} rejections · N₈₀ = {result.requiredN80 ?? 'N/A'}
              </div>
            </div>

            {/* KPI 4: CI Coverage Calibration */}
            <div className="bg-[#171b27] border border-[#334155] p-3.5">
              <div className="flex items-center justify-between text-[11px] font-display font-bold uppercase tracking-[0.08em] text-[#988d9f]">
                <span>Empirical CI Coverage</span>
                <span className="text-[#bdc2ff]">Target {confLabel}</span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-mono font-bold tabular-nums text-[#dee2f2]">
                  {(result.newcombeCoverage * 100).toFixed(2)}%
                </span>
                <span className="text-xs font-mono tabular-nums text-[#818cf8]">
                  Wald {(result.waldCoverage * 100).toFixed(2)}%
                </span>
              </div>
              <div className="mt-1.5 text-[11px] font-mono tabular-nums text-[#988d9f]">
                Bias: {(result.bias * 100).toFixed(3)} pp · {result.computeTimeMs.toFixed(1)} ms
              </div>
            </div>
          </section>

          {/* Edge-Case / Statistical Warnings */}
          {inf.warnings.length > 0 && (
            <div className="border border-[#ffb4ab]/50 bg-[#93000a]/20 px-4 py-2.5 flex items-start gap-2.5 text-xs text-[#ffdad6]">
              <AlertTriangle className="w-4 h-4 text-[#ffb4ab] shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                {inf.warnings.map((w, i) => (
                  <div key={i} className="font-mono text-[11px]">
                    {w}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Analytical View */}
          {activeView === 'inference' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <ProbabilityDistributionChart
                  inference={inf}
                  alpha={params.alpha}
                  direction={params.direction}
                />
                <ConfidenceIntervalCaliperChart
                  inference={inf}
                  trueDiff={result.trueDiff}
                  alpha={params.alpha}
                  sampleTrials={result.sampleTrials}
                />
              </div>

              {/* Contingency Table & Effect Metrics */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="bg-[#171b27] border border-[#334155] p-4">
                  <div className="font-display text-[11px] font-bold uppercase tracking-[0.08em] text-[#cfc2d6] pb-3 mb-3 border-b border-[#1e293b]">
                    [CONTINGENCY.03] Focal Trial 2×2 Contingency Matrix
                  </div>
                  <table className="w-full border-collapse text-xs font-mono tabular-nums">
                    <thead>
                      <tr className="bg-[#090e19] text-[#988d9f]">
                        <th className="text-left p-2.5 border border-[#1e293b]">ARM</th>
                        <th className="text-right p-2.5 border border-[#1e293b]">EVENTS (x)</th>
                        <th className="text-right p-2.5 border border-[#1e293b]">NON-EVENTS</th>
                        <th className="text-right p-2.5 border border-[#1e293b]">TOTAL (n)</th>
                        <th className="text-right p-2.5 border border-[#1e293b]">RATE (p̂)</th>
                        <th className="text-right p-2.5 border border-[#1e293b]">WILSON {confLabel} CI</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="bg-[#0e131e]">
                        <td className="p-2.5 border border-[#1e293b] text-[#818cf8] font-semibold">
                          Control (A)
                        </td>
                        <td className="p-2.5 border border-[#1e293b] text-right">{inf.x1}</td>
                        <td className="p-2.5 border border-[#1e293b] text-right">{inf.n1 - inf.x1}</td>
                        <td className="p-2.5 border border-[#1e293b] text-right">{inf.n1}</td>
                        <td className="p-2.5 border border-[#1e293b] text-right font-bold">
                          {(inf.p1Hat * 100).toFixed(2)}%
                        </td>
                        <td className="p-2.5 border border-[#1e293b] text-right text-[#cfc2d6]">
                          [{(inf.arm1WilsonCI.lower * 100).toFixed(1)}%, {(inf.arm1WilsonCI.upper * 100).toFixed(1)}%]
                        </td>
                      </tr>
                      <tr className="bg-[#0e131e]">
                        <td className="p-2.5 border border-[#1e293b] text-[#4cd7f6] font-semibold">
                          Treatment (B)
                        </td>
                        <td className="p-2.5 border border-[#1e293b] text-right">{inf.x2}</td>
                        <td className="p-2.5 border border-[#1e293b] text-right">{inf.n2 - inf.x2}</td>
                        <td className="p-2.5 border border-[#1e293b] text-right">{inf.n2}</td>
                        <td className="p-2.5 border border-[#1e293b] text-right font-bold text-[#4cd7f6]">
                          {(inf.p2Hat * 100).toFixed(2)}%
                        </td>
                        <td className="p-2.5 border border-[#1e293b] text-right text-[#4cd7f6]">
                          [{(inf.arm2WilsonCI.lower * 100).toFixed(1)}%, {(inf.arm2WilsonCI.upper * 100).toFixed(1)}%]
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="bg-[#171b27] border border-[#334155] p-4">
                  <div className="font-display text-[11px] font-bold uppercase tracking-[0.08em] text-[#cfc2d6] pb-3 mb-3 border-b border-[#1e293b]">
                    [EFFECT_SPEC.04] Variance & Clinical Effect Ratios
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs font-mono tabular-nums">
                    <div className="bg-[#090e19] border border-[#1e293b] p-2.5">
                      <div className="text-[10px] text-[#988d9f] uppercase">Pooled Proportion</div>
                      <div className="text-sm font-bold text-[#dee2f2] mt-1">
                        {(inf.pPooled * 100).toFixed(2)}%
                      </div>
                    </div>
                    <div className="bg-[#090e19] border border-[#1e293b] p-2.5">
                      <div className="text-[10px] text-[#988d9f] uppercase">Pooled SE (H₀)</div>
                      <div className="text-sm font-bold text-[#dee2f2] mt-1">
                        {(inf.sePooled * 100).toFixed(3)} pp
                      </div>
                    </div>
                    <div className="bg-[#090e19] border border-[#1e293b] p-2.5">
                      <div className="text-[10px] text-[#988d9f] uppercase">Unpooled SE (CI)</div>
                      <div className="text-sm font-bold text-[#dee2f2] mt-1">
                        {(inf.seUnpooled * 100).toFixed(3)} pp
                      </div>
                    </div>
                    <div className="bg-[#090e19] border border-[#1e293b] p-2.5">
                      <div className="text-[10px] text-[#988d9f] uppercase">Relative Risk (RR)</div>
                      <div className="text-sm font-bold text-[#4cd7f6] mt-1">
                        {inf.relativeRisk !== null ? inf.relativeRisk.toFixed(3) : 'N/A'}
                      </div>
                    </div>
                    <div className="bg-[#090e19] border border-[#1e293b] p-2.5">
                      <div className="text-[10px] text-[#988d9f] uppercase">Odds Ratio (OR)</div>
                      <div className="text-sm font-bold text-[#ddb7ff] mt-1">
                        {inf.oddsRatio !== null ? inf.oddsRatio.toFixed(3) : 'N/A'}
                      </div>
                    </div>
                    <div className="bg-[#090e19] border border-[#1e293b] p-2.5">
                      <div className="text-[10px] text-[#988d9f] uppercase">NNT / NNH</div>
                      <div className="text-sm font-bold text-[#dee2f2] mt-1">
                        {inf.nnt !== null ? inf.nnt.toFixed(1) : '∞'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeView === 'montecarlo' && (
            <div className="space-y-4">
              <MonteCarloCharts result={result} />

              <div className="bg-[#171b27] border border-[#334155] p-4">
                <div className="font-display text-[11px] font-bold uppercase tracking-[0.08em] text-[#cfc2d6] pb-3 mb-3 border-b border-[#1e293b]">
                  [MC_DIAG.06] Monte Carlo Ensemble Diagnostics
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs font-mono tabular-nums">
                  <div className="bg-[#090e19] border border-[#1e293b] p-2.5">
                    <div className="text-[10px] text-[#988d9f]">MEAN Δ̂</div>
                    <div className="text-sm font-bold mt-1">{(result.meanDiffEstimate * 100).toFixed(3)} pp</div>
                  </div>
                  <div className="bg-[#090e19] border border-[#1e293b] p-2.5">
                    <div className="text-[10px] text-[#988d9f]">TRUE Δ</div>
                    <div className="text-sm font-bold mt-1">{(result.trueDiff * 100).toFixed(3)} pp</div>
                  </div>
                  <div className="bg-[#090e19] border border-[#1e293b] p-2.5">
                    <div className="text-[10px] text-[#988d9f]">EMPIRICAL SD</div>
                    <div className="text-sm font-bold text-[#4cd7f6] mt-1">{(result.empiricalSD * 100).toFixed(3)} pp</div>
                  </div>
                  <div className="bg-[#090e19] border border-[#1e293b] p-2.5">
                    <div className="text-[10px] text-[#988d9f]">THEORETICAL SE</div>
                    <div className="text-sm font-bold text-[#ddb7ff] mt-1">{(result.theoreticalSE * 100).toFixed(3)} pp</div>
                  </div>
                  <div className="bg-[#090e19] border border-[#1e293b] p-2.5">
                    <div className="text-[10px] text-[#988d9f]">MEAN NEWCOMBE WIDTH</div>
                    <div className="text-sm font-bold mt-1">{(result.meanNewcombeWidth * 100).toFixed(2)} pp</div>
                  </div>
                  <div className="bg-[#090e19] border border-[#1e293b] p-2.5">
                    <div className="text-[10px] text-[#988d9f]">DEGENERATE TRIALS</div>
                    <div className="text-sm font-bold mt-1">{result.degenerateCount}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeView === 'sensitivity' && (
            <PowerSensitivityCharts
              result={result}
              onApplySampleSize={(n) => setParams((prev) => ({ ...prev, n1: n, n2: n }))}
            />
          )}

          {activeView === 'ledger' && (
            <div className="bg-[#171b27] border border-[#334155] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-[#1e293b]">
                <div>
                  <div className="font-display text-[11px] font-bold uppercase tracking-[0.08em] text-[#cfc2d6]">
                    [TRIAL_LEDGER.10] First 100 Simulated Repetitions (Click Row to Inspect)
                  </div>
                  <p className="text-xs text-[#988d9f] mt-0.5">
                    Clicking any simulated trial applies its observed counts (x₁, x₂) to the Inference & Calipers inspector
                  </p>
                </div>
                <span className="text-xs font-mono text-[#4cd7f6] tabular-nums">
                  SEED: {result.params.seed}
                </span>
              </div>

              <div className="overflow-x-auto max-h-[420px] border border-[#1e293b]">
                <table className="w-full border-collapse text-xs font-mono tabular-nums">
                  <thead className="sticky top-0 bg-[#090e19] text-[#988d9f]">
                    <tr>
                      <th className="p-2 text-left border-b border-[#334155]">#</th>
                      <th className="p-2 text-right border-b border-[#334155]">x₁ / n₁</th>
                      <th className="p-2 text-right border-b border-[#334155]">x₂ / n₂</th>
                      <th className="p-2 text-right border-b border-[#334155]">Δ̂</th>
                      <th className="p-2 text-right border-b border-[#334155]">Z</th>
                      <th className="p-2 text-right border-b border-[#334155]">P-VALUE</th>
                      <th className="p-2 text-right border-b border-[#334155]">NEWCOMBE {confLabel} CI</th>
                      <th className="p-2 text-center border-b border-[#334155]">DECISION</th>
                      <th className="p-2 text-center border-b border-[#334155]">COVERS TRUE Δ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.sampleTrials.map((t) => (
                      <tr
                        key={t.index}
                        onClick={() => {
                          setParams((prev) => ({
                            ...prev,
                            useCustomCounts: true,
                            customX1: t.x1,
                            customX2: t.x2,
                          }));
                          setActiveView('inference');
                        }}
                        className="border-b border-[#1e293b] bg-[#0e131e] hover:bg-[#252a36] cursor-pointer transition-colors"
                      >
                        <td className="p-2 text-[#988d9f]">{t.index}</td>
                        <td className="p-2 text-right">
                          {t.x1}/{params.n1}
                        </td>
                        <td className="p-2 text-right">
                          {t.x2}/{params.n2}
                        </td>
                        <td className="p-2 text-right">{(t.diff * 100).toFixed(2)}%</td>
                        <td className="p-2 text-right">{t.zScore.toFixed(3)}</td>
                        <td className="p-2 text-right">{formatPValue(t.pValue)}</td>
                        <td className="p-2 text-right text-[#4cd7f6]">
                          [{(t.newcombeLower * 100).toFixed(1)}%, {(t.newcombeUpper * 100).toFixed(1)}%]
                        </td>
                        <td
                          className={`p-2 text-center font-semibold ${
                            t.significant ? 'text-[#4cd7f6]' : 'text-[#988d9f]'
                          }`}
                        >
                          {t.significant ? 'REJECT H₀' : 'RETAIN'}
                        </td>
                        <td
                          className={`p-2 text-center ${
                            t.coversTrueDiff ? 'text-[#dee2f2]' : 'text-[#ffb4ab]'
                          }`}
                        >
                          {t.coversTrueDiff ? 'YES' : 'MISS'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Post-Calculation Gemini Interpretation Panel */}
          <GeminiInterpretationPanel
            result={result}
            calculationComplete={calculationComplete}
            isComputing={isComputing}
            isInterpreting={isInterpreting}
            interpretationData={interpretationData}
            interpretationError={interpretationError}
            onRequestInterpretation={handleRequestInterpretation}
          />
        </div>
      </main>

      <VerificationModal open={verifyOpen} onClose={() => setVerifyOpen(false)} />
    </div>
  );
}
