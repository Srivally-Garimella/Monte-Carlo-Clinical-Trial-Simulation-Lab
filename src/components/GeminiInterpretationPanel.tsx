import React from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw, Sparkles } from 'lucide-react';
import type { SimulationResult } from '../engine/monteCarlo';

export interface GeminiInterpretationPayload {
  calculationId: string;
  model: string;
  generatedAt: string;
  interpretation: {
    executiveVerdict: string;
    effectSizeAssessment: string;
    monteCarloReliability: string;
    methodologicalCaveats: string[];
    recommendedNextStep: string;
  };
}

interface Props {
  result: SimulationResult;
  calculationComplete: boolean;
  isComputing: boolean;
  isInterpreting: boolean;
  interpretationData: GeminiInterpretationPayload | null;
  interpretationError: string | null;
  onRequestInterpretation: () => void;
}

export const GeminiInterpretationPanel: React.FC<Props> = ({
  result,
  calculationComplete,
  isComputing,
  isInterpreting,
  interpretationData,
  interpretationError,
  onRequestInterpretation,
}) => {
  const isSynced =
    calculationComplete &&
    !isComputing &&
    interpretationData?.calculationId === result.calculationId;

  const isStale =
    interpretationData !== null &&
    interpretationData.calculationId !== result.calculationId;

  return (
    <section className="bg-[#171b27] border border-[#334155]">
      <div className="px-4 py-3 border-b border-[#1e293b] bg-[#1b1f2b] flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-display text-[11px] font-bold uppercase tracking-[0.08em] text-[#ddb7ff]">
            [GEMINI_SYNTH.08] Post-Calculation Biostatistical Interpretation
          </div>
          <p className="text-xs text-[#988d9f] mt-0.5">
            Locked until deterministic Monte Carlo & two-proportion calculations finalize ({result.calculationId})
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`text-[11px] font-mono px-2 py-1 border ${
              calculationComplete && !isComputing
                ? 'border-[#06b6d4]/60 bg-[#06b6d4]/10 text-[#4cd7f6]'
                : 'border-[#4d4354] bg-[#090e19] text-[#988d9f]'
            }`}
          >
            {isComputing
              ? 'CALCULATING ENGINE...'
              : calculationComplete
                ? `MATH READY · ${result.computeTimeMs.toFixed(1)} ms`
                : 'PENDING'}
          </span>

          <button
            type="button"
            disabled={!calculationComplete || isComputing || isInterpreting}
            onClick={onRequestInterpretation}
            className="px-4 py-2 bg-[#a855f7] hover:bg-[#b76dff] disabled:bg-[#303541] disabled:text-[#988d9f] text-[#090e19] font-display text-xs font-bold uppercase tracking-[0.08em] flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
          >
            {isInterpreting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Interpreting...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  {isSynced
                    ? 'Regenerate Interpretation'
                    : isStale
                      ? 'Re-Interpret Updated Math'
                      : 'Interpret Completed Results'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="p-4">
        {interpretationError && (
          <div className="mb-4 p-3 border border-[#ffb4ab]/50 bg-[#93000a]/25 text-xs text-[#ffdad6] flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-[#ffb4ab] shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-[#ffb4ab]">Interpretation Request Failed</div>
              <div className="mt-0.5 font-mono text-[11px]">{interpretationError}</div>
            </div>
          </div>
        )}

        {isStale && !isInterpreting && (
          <div className="mb-4 p-3 border border-[#b76dff]/50 bg-[#b76dff]/10 text-xs text-[#f0dbff] flex items-center justify-between gap-3">
            <span>
              Parameters changed since the previous interpretation ({interpretationData?.calculationId}). Click{' '}
              <strong className="font-semibold">Re-Interpret Updated Math</strong> to analyze {result.calculationId}.
            </span>
          </div>
        )}

        {!interpretationData && !isInterpreting && (
          <div className="p-5 border border-[#1e293b] bg-[#090e19] text-sm text-[#cfc2d6] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="font-display text-xs font-bold uppercase tracking-[0.06em] text-[#dee2f2]">
                Calculations Complete — Ready for Biostatistical Synthesis
              </div>
              <p className="text-xs text-[#988d9f] max-w-2xl">
                All Z-test statistics, Newcombe-Wilson intervals, and {result.params.repetitions.toLocaleString()} Monte Carlo repetitions for{' '}
                <span className="font-mono text-[#4cd7f6]">{result.calculationId}</span> are finalized. Request a Gemini interpretation grounded strictly in these outputs.
              </p>
            </div>
            <div className="text-xs font-mono text-[#4cd7f6] shrink-0 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>Post-Calc Gate Passed</span>
            </div>
          </div>
        )}

        {isInterpreting && (
          <div className="p-6 border border-[#1e293b] bg-[#090e19] space-y-3">
            <div className="flex items-center gap-2 text-xs font-mono text-[#4cd7f6]">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Analyzing completed simulation metrics for {result.calculationId}...</span>
            </div>
            <div className="h-3 bg-[#1b1f2b] w-3/4" />
            <div className="h-3 bg-[#1b1f2b] w-1/2" />
          </div>
        )}

        {interpretationData && !isInterpreting && (
          <div className={`space-y-4 ${isStale ? 'opacity-65' : ''}`}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="bg-[#090e19] border border-[#1e293b] p-3.5">
                <div className="font-display text-[11px] font-bold uppercase tracking-[0.08em] text-[#4cd7f6] mb-1.5">
                  Executive Verdict
                </div>
                <p className="text-xs leading-relaxed text-[#dee2f2]">
                  {interpretationData.interpretation.executiveVerdict}
                </p>
              </div>

              <div className="bg-[#090e19] border border-[#1e293b] p-3.5">
                <div className="font-display text-[11px] font-bold uppercase tracking-[0.08em] text-[#ddb7ff] mb-1.5">
                  Effect Size & CI Precision
                </div>
                <p className="text-xs leading-relaxed text-[#dee2f2]">
                  {interpretationData.interpretation.effectSizeAssessment}
                </p>
              </div>

              <div className="bg-[#090e19] border border-[#1e293b] p-3.5">
                <div className="font-display text-[11px] font-bold uppercase tracking-[0.08em] text-[#bdc2ff] mb-1.5">
                  Monte Carlo Reliability
                </div>
                <p className="text-xs leading-relaxed text-[#dee2f2]">
                  {interpretationData.interpretation.monteCarloReliability}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-[#090e19] border border-[#1e293b] p-3.5">
                <div className="font-display text-[11px] font-bold uppercase tracking-[0.08em] text-[#cfc2d6] mb-2">
                  Methodological Caveats
                </div>
                <ul className="space-y-1.5 text-xs text-[#cfc2d6]">
                  {interpretationData.interpretation.methodologicalCaveats.map((cav, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="font-mono text-[#4cd7f6] shrink-0">0{idx + 1}.</span>
                      <span>{cav}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-[#090e19] border border-[#1e293b] p-3.5 flex flex-col justify-between">
                <div>
                  <div className="font-display text-[11px] font-bold uppercase tracking-[0.08em] text-[#4cd7f6] mb-1.5">
                    Recommended Next Adjustment
                  </div>
                  <p className="text-xs leading-relaxed text-[#dee2f2]">
                    {interpretationData.interpretation.recommendedNextStep}
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-[#1e293b] flex items-center justify-between text-[11px] font-mono text-[#988d9f]">
                  <span>MODEL: {interpretationData.model}</span>
                  <span>BOUND TO: {interpretationData.calculationId}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
