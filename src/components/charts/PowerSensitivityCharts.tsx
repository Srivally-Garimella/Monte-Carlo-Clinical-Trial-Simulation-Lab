import React, { useState } from 'react';
import type { SimulationResult } from '../../engine/monteCarlo';

interface Props {
  result: SimulationResult;
  onApplySampleSize?: (n: number) => void;
}

export const PowerSensitivityCharts: React.FC<Props> = ({ result, onApplySampleSize }) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const curve = result.powerCurveByN;
  const minN = curve[0]?.nPerArm ?? 10;
  const maxN = curve[curve.length - 1]?.nPerArm ?? 500;

  const w = 620;
  const h = 240;
  const pad = { top: 22, right: 24, bottom: 36, left: 48 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  const toX = (n: number) => pad.left + ((n - minN) / Math.max(1, maxN - minN)) * plotW;
  const toY = (p: number) => pad.top + plotH - p * plotH;

  const linePath = curve
    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${toX(pt.nPerArm).toFixed(2)} ${toY(pt.power).toFixed(2)}`)
    .join(' ');
  const areaPath =
    curve.length > 0
      ? `${linePath} L ${toX(curve[curve.length - 1].nPerArm).toFixed(2)} ${toY(0).toFixed(2)} L ${toX(curve[0].nPerArm).toFixed(2)} ${toY(0).toFixed(2)} Z`
      : '';

  // Sensitivity Grid dimensions
  const grid = result.sensitivityGrid;
  const nValues = Array.from(new Set(grid.map((c) => c.nPerArm)));
  const p2Values = Array.from(new Set(grid.map((c) => c.p2)));

  const getCellColor = (power: number) => {
    if (power >= 0.9) return 'bg-[#06B6D4]/75 text-[#001f26] border-[#4cd7f6]';
    if (power >= 0.8) return 'bg-[#06B6D4]/45 text-[#dee2f2] border-[#06B6D4]';
    if (power >= 0.6) return 'bg-[#A855F7]/45 text-[#dee2f2] border-[#b76dff]';
    if (power >= 0.35) return 'bg-[#818CF8]/30 text-[#dee2f2] border-[#4d4354]';
    return 'bg-[#090e19] text-[#988d9f] border-[#1e293b]';
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {/* Power vs Sample Size Curve */}
      <div className="bg-[#171b27] border border-[#334155] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-[#1e293b]">
          <div>
            <div className="font-display text-[11px] font-bold uppercase tracking-[0.08em] text-[#cfc2d6]">
              [PWR_CURVE.06] Statistical Power vs Balanced Sample Size (N per arm)
            </div>
            <p className="text-xs text-[#988d9f] mt-0.5">
              p₁ = {(result.params.p1 * 100).toFixed(1)}%, p₂ = {(result.params.p2 * 100).toFixed(1)}%, α = {result.params.alpha}
            </p>
          </div>
          <div className="text-xs font-mono tabular-nums text-[#4cd7f6]">
            N₈₀ = {result.requiredN80 ?? 'N/A'} · N₉₀ = {result.requiredN90 ?? 'N/A'}
          </div>
        </div>

        <div className="bg-[#090e19] border border-[#1e293b]">
          <svg
            viewBox={`0 0 ${w} ${h}`}
            className="w-full h-auto block cursor-crosshair"
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const relX = ((e.clientX - rect.left) / rect.width) * w;
              if (relX >= pad.left && relX <= w - pad.right && curve.length > 0) {
                const frac = (relX - pad.left) / plotW;
                const idx = Math.min(curve.length - 1, Math.max(0, Math.round(frac * (curve.length - 1))));
                setHoverIdx(idx);
              } else {
                setHoverIdx(null);
              }
            }}
            onMouseLeave={() => setHoverIdx(null)}
          >
            <defs>
              <linearGradient id="pwrCurveGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#A855F7" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#0B101B" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {[0, 0.2, 0.4, 0.6, 0.8, 1.0].map((tick) => (
              <g key={tick}>
                <line
                  x1={pad.left}
                  x2={w - pad.right}
                  y1={toY(tick)}
                  y2={toY(tick)}
                  stroke={tick === 0.8 ? '#06B6D4' : '#1e293b'}
                  strokeDasharray={tick === 0.8 ? '4 3' : undefined}
                  strokeWidth="1"
                />
                <text
                  x={pad.left - 8}
                  y={toY(tick) + 3}
                  textAnchor="end"
                  className={tick === 0.8 ? 'fill-[#4cd7f6] text-[10px] font-mono' : 'fill-[#988d9f] text-[10px] font-mono'}
                >
                  {(tick * 100).toFixed(0)}%
                </text>
              </g>
            ))}

            {areaPath && <path d={areaPath} fill="url(#pwrCurveGrad)" />}
            {linePath && <path d={linePath} fill="none" stroke="#A855F7" strokeWidth="2" />}

            {/* Current n1 marker */}
            {result.params.n1 >= minN && result.params.n1 <= maxN && (
              <g>
                <line
                  x1={toX(result.params.n1)}
                  x2={toX(result.params.n1)}
                  y1={pad.top}
                  y2={pad.top + plotH}
                  stroke="#ddb7ff"
                  strokeWidth="1.25"
                  strokeDasharray="2 2"
                />
                <rect
                  x={toX(result.params.n1) - 4}
                  y={toY(result.theoreticalPower) - 4}
                  width="8"
                  height="8"
                  fill="#4cd7f6"
                  stroke="#090e19"
                  strokeWidth="1.5"
                />
              </g>
            )}

            {[0, 0.25, 0.5, 0.75, 1].map((t) => {
              const nv = Math.round(minN + t * (maxN - minN));
              return (
                <text
                  key={t}
                  x={toX(nv)}
                  y={h - 10}
                  textAnchor="middle"
                  className="fill-[#988d9f] text-[10px] font-mono"
                >
                  n={nv}
                </text>
              );
            })}

            {hoverIdx !== null && curve[hoverIdx] && (
              <g>
                <line
                  x1={toX(curve[hoverIdx].nPerArm)}
                  x2={toX(curve[hoverIdx].nPerArm)}
                  y1={pad.top}
                  y2={pad.top + plotH}
                  stroke="#dee2f2"
                  strokeOpacity="0.45"
                  strokeWidth="1"
                />
                <rect
                  x={toX(curve[hoverIdx].nPerArm) - 3}
                  y={toY(curve[hoverIdx].power) - 3}
                  width="6"
                  height="6"
                  fill="#dee2f2"
                />
              </g>
            )}
          </svg>
          <div className="px-3 py-1.5 border-t border-[#1e293b] bg-[#0e131e] text-[11px] font-mono tabular-nums text-[#cfc2d6] flex justify-between">
            {hoverIdx !== null && curve[hoverIdx] ? (
              <>
                <span>PROBE N/ARM = {curve[hoverIdx].nPerArm}</span>
                <span>TOTAL N = {curve[hoverIdx].nPerArm * 2}</span>
                <span>POWER = {(curve[hoverIdx].power * 100).toFixed(2)}%</span>
              </>
            ) : (
              <>
                <span>CYAN DASH: 80% Target Power</span>
                <span>N₈₀ = {result.requiredN80 ?? 'N/A'} per arm</span>
                <span>N₉₀ = {result.requiredN90 ?? 'N/A'} per arm</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 2D Sensitivity Heatmap Matrix */}
      <div className="bg-[#171b27] border border-[#334155] p-4 flex flex-col justify-between">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-[#1e293b]">
            <div>
              <div className="font-display text-[11px] font-bold uppercase tracking-[0.08em] text-[#cfc2d6]">
                [SENS_MATRIX.07] Power Sensitivity Matrix (N per arm × p₂)
              </div>
              <p className="text-xs text-[#988d9f] mt-0.5">
                Click any row sample size to lock N₁ = N₂ to that cohort size
              </p>
            </div>
            <span className="text-[11px] font-mono text-[#988d9f]">
              Fixed p₁ = {(result.params.p1 * 100).toFixed(1)}%
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs font-mono tabular-nums">
              <thead>
                <tr>
                  <th className="text-left py-2 px-2 text-[#988d9f] border border-[#1e293b] bg-[#090e19]">
                    N / ARM
                  </th>
                  {p2Values.map((p2v) => (
                    <th
                      key={p2v}
                      className="text-center py-2 px-2 text-[#cfc2d6] border border-[#1e293b] bg-[#090e19]"
                    >
                      {(p2v * 100).toFixed(1)}%
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {nValues.map((nv) => (
                  <tr key={nv}>
                    <td className="border border-[#1e293b] bg-[#0e131e] p-0">
                      <button
                        type="button"
                        onClick={() => onApplySampleSize?.(nv)}
                        className={`w-full text-left px-2 py-2.5 transition-colors hover:bg-[#252a36] hover:text-[#4cd7f6] ${
                          nv === result.params.n1 ? 'text-[#ddb7ff] font-bold' : 'text-[#cfc2d6]'
                        }`}
                        title="Apply this balanced sample size"
                      >
                        n={nv}
                      </button>
                    </td>
                    {p2Values.map((p2v) => {
                      const cell = grid.find((c) => c.nPerArm === nv && c.p2 === p2v);
                      const pwr = cell?.power ?? 0;
                      const isCurrent =
                        nv === result.params.n1 && Math.abs(p2v - result.params.p2) < 0.015;
                      return (
                        <td
                          key={`${nv}-${p2v}`}
                          className={`border p-2 text-center font-semibold ${getCellColor(pwr)} ${
                            isCurrent ? 'ring-1 ring-[#ddb7ff]' : ''
                          }`}
                        >
                          {(pwr * 100).toFixed(0)}%
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-3 pt-2 border-t border-[#1e293b] flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-[#988d9f]">
          <span>SCALE: &lt;35% · 35–59% · 60–79% · 80–89% · ≥90%</span>
          <span>Δp = p₂ − p₁</span>
        </div>
      </div>
    </div>
  );
};
