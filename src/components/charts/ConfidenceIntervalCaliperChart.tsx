import React from 'react';
import type { SampleTrialRecord } from '../../engine/monteCarlo';
import type { TwoProportionResult } from '../../engine/twoProportion';

interface Props {
  inference: TwoProportionResult;
  trueDiff: number;
  alpha: number;
  sampleTrials: SampleTrialRecord[];
}

export const ConfidenceIntervalCaliperChart: React.FC<Props> = ({
  inference,
  trueDiff,
  alpha,
  sampleTrials,
}) => {
  const confPct = ((1 - alpha) * 100).toFixed(1).replace(/\.0$/, '');
  const width = 640;
  const height = 166;
  const pad = { left: 138, right: 26, top: 22, bottom: 28 };
  const plotW = width - pad.left - pad.right;

  // Dynamic domain covering Newcombe CI, Wald CI, 0, and trueDiff
  const allVals = [
    0,
    trueDiff,
    inference.diff,
    inference.newcombeCI.lower,
    inference.newcombeCI.upper,
    inference.waldCI.lower,
    inference.waldCI.upper,
  ];
  const rawMin = Math.min(...allVals);
  const rawMax = Math.max(...allVals);
  const margin = Math.max(0.05, (rawMax - rawMin) * 0.18);
  const minX = Math.max(-1, rawMin - margin);
  const maxX = Math.min(1, rawMax + margin);

  const toX = (v: number) => pad.left + ((v - minX) / Math.max(1e-6, maxX - minX)) * plotW;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => minX + t * (maxX - minX));

  const renderCaliper = (
    y: number,
    lower: number,
    upper: number,
    est: number,
    color: string,
    label: string,
    sub: string
  ) => {
    const lx = toX(lower);
    const ux = toX(upper);
    const ex = toX(est);
    return (
      <g>
        <text
          x={pad.left - 12}
          y={y - 2}
          textAnchor="end"
          className="fill-[#dee2f2] text-[11px] font-display font-semibold"
        >
          {label}
        </text>
        <text
          x={pad.left - 12}
          y={y + 11}
          textAnchor="end"
          className="fill-[#988d9f] text-[10px] font-mono"
        >
          {sub}
        </text>
        {/* Horizontal Caliper Shaft */}
        <line x1={lx} x2={ux} y1={y} y2={y} stroke={color} strokeWidth="2" />
        {/* Dual Bracket End-Caps */}
        <path
          d={`M ${lx + 5} ${y - 8} L ${lx} ${y - 8} L ${lx} ${y + 8} L ${lx + 5} ${y + 8}`}
          fill="none"
          stroke={color}
          strokeWidth="1.75"
        />
        <path
          d={`M ${ux - 5} ${y - 8} L ${ux} ${y - 8} L ${ux} ${y + 8} L ${ux - 5} ${y + 8}`}
          fill="none"
          stroke={color}
          strokeWidth="1.75"
        />
        {/* Point Estimate Diamond */}
        <polygon
          points={`${ex},${y - 5} ${ex + 5},${y} ${ex},${y + 5} ${ex - 5},${y}`}
          fill={color}
          stroke="#090e19"
          strokeWidth="1"
        />
      </g>
    );
  };

  // Forest strip for first 20 MC trials
  const forestTrials = sampleTrials.slice(0, 20);
  const fMin = Math.min(
    trueDiff - 0.15,
    ...forestTrials.map((t) => t.newcombeLower)
  );
  const fMax = Math.max(
    trueDiff + 0.15,
    ...forestTrials.map((t) => t.newcombeUpper)
  );
  const toForestX = (v: number) =>
    36 + ((v - fMin) / Math.max(1e-6, fMax - fMin)) * (width - 56);

  return (
    <div className="bg-[#171b27] border border-[#334155] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-[#1e293b]">
        <div>
          <div className="font-display text-[11px] font-bold uppercase tracking-[0.08em] text-[#cfc2d6]">
            [CI_CALIPER.02] {confPct}% Confidence Interval Calipers (p₂ − p₁)
          </div>
          <p className="text-xs text-[#988d9f] mt-0.5">
            Newcombe-Wilson hybrid score interval vs asymptotic Wald normal interval
          </p>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-mono tabular-nums">
          <span className="text-[#4cd7f6]">
            Δ̂ = {(inference.diff * 100).toFixed(2)} pp
          </span>
          <span className="text-[#cfc2d6]">
            Δ_true = {(trueDiff * 100).toFixed(2)} pp
          </span>
        </div>
      </div>

      <div className="bg-[#090e19] border border-[#1e293b]">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto block">
          {/* Vertical grid & ticks */}
          {ticks.map((tk, i) => (
            <g key={i}>
              <line
                x1={toX(tk)}
                x2={toX(tk)}
                y1={pad.top - 6}
                y2={height - pad.bottom}
                stroke="#171b27"
                strokeWidth="1"
              />
              <text
                x={toX(tk)}
                y={height - 10}
                textAnchor="middle"
                className="fill-[#988d9f] text-[10px] font-mono"
              >
                {(tk * 100).toFixed(1)}%
              </text>
            </g>
          ))}

          {/* Null reference line Δ = 0 */}
          {minX <= 0 && maxX >= 0 && (
            <g>
              <line
                x1={toX(0)}
                x2={toX(0)}
                y1={pad.top - 8}
                y2={height - pad.bottom}
                stroke="#ffb4ab"
                strokeOpacity="0.7"
                strokeWidth="1.25"
                strokeDasharray="4 3"
              />
              <text
                x={toX(0)}
                y={13}
                textAnchor="middle"
                className="fill-[#ffb4ab] text-[9px] font-mono font-bold"
              >
                H₀ (0%)
              </text>
            </g>
          )}

          {/* True Population Difference Line */}
          {minX <= trueDiff && maxX >= trueDiff && (
            <g>
              <line
                x1={toX(trueDiff)}
                x2={toX(trueDiff)}
                y1={pad.top - 8}
                y2={height - pad.bottom}
                stroke="#A855F7"
                strokeOpacity="0.7"
                strokeWidth="1.25"
                strokeDasharray="2 2"
              />
              <text
                x={toX(trueDiff)}
                y={13}
                textAnchor="middle"
                className="fill-[#ddb7ff] text-[9px] font-mono font-bold"
              >
                TRUE Δ
              </text>
            </g>
          )}

          {renderCaliper(
            58,
            inference.newcombeCI.lower,
            inference.newcombeCI.upper,
            inference.diff,
            '#06B6D4',
            'Newcombe-Wilson',
            `[${(inference.newcombeCI.lower * 100).toFixed(2)}%, ${(inference.newcombeCI.upper * 100).toFixed(2)}%]`
          )}

          {renderCaliper(
            106,
            inference.waldCI.lower,
            inference.waldCI.upper,
            inference.diff,
            '#818CF8',
            'Wald Asymptotic',
            `[${(inference.waldCI.lower * 100).toFixed(2)}%, ${(inference.waldCI.upper * 100).toFixed(2)}%]`
          )}
        </svg>
      </div>

      {/* First 20 Monte Carlo Repetitions Coverage Forest Strip */}
      <div className="mt-3 pt-3 border-t border-[#1e293b]">
        <div className="flex items-center justify-between text-[11px] mb-2">
          <span className="font-display font-bold uppercase tracking-[0.08em] text-[#cfc2d6]">
            First 20 Monte Carlo Newcombe-Wilson Intervals vs True Δ ({(trueDiff * 100).toFixed(1)} pp)
          </span>
          <span className="font-mono text-[#988d9f] tabular-nums">
            {forestTrials.filter((t) => t.coversTrueDiff).length}/{forestTrials.length} capture True Δ
          </span>
        </div>
        <div className="bg-[#090e19] border border-[#1e293b] p-2">
          <svg viewBox={`0 0 ${width} 112`} className="w-full h-auto block">
            <line
              x1={toForestX(trueDiff)}
              x2={toForestX(trueDiff)}
              y1={4}
              y2={108}
              stroke="#A855F7"
              strokeWidth="1.25"
              strokeDasharray="3 2"
            />
            {forestTrials.map((trial, idx) => {
              const y = 7 + idx * 5;
              const color = trial.coversTrueDiff ? '#06B6D4' : '#ffb4ab';
              return (
                <g key={trial.index}>
                  <line
                    x1={toForestX(trial.newcombeLower)}
                    x2={toForestX(trial.newcombeUpper)}
                    y1={y}
                    y2={y}
                    stroke={color}
                    strokeWidth="1.5"
                  />
                  <rect
                    x={toForestX(trial.diff) - 1.5}
                    y={y - 1.5}
                    width="3"
                    height="3"
                    fill={color}
                  />
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
};
