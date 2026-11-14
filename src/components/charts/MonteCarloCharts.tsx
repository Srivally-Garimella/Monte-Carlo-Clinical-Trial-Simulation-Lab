import React, { useState } from 'react';
import { normalPdf } from '../../engine/normal';
import type { SimulationResult } from '../../engine/monteCarlo';

interface Props {
  result: SimulationResult;
}

export const MonteCarloCharts: React.FC<Props> = ({ result }) => {
  const [hoveredBin, setHoveredBin] = useState<number | null>(null);
  const [hoveredConvIdx, setHoveredConvIdx] = useState<number | null>(null);

  // 1. Sampling Distribution Histogram
  const w = 620;
  const h = 230;
  const pad = { top: 20, right: 20, bottom: 34, left: 46 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  const bins = result.diffHistogram;
  const minBin = bins[0]?.binStart ?? -0.2;
  const maxBin = bins[bins.length - 1]?.binEnd ?? 0.2;

  // Compute max density across histogram & theoretical Gaussian curve
  const theoMaxDensity =
    result.theoreticalSE > 1e-6 ? normalPdf(0) / result.theoreticalSE : 0;
  const histMaxDensity = Math.max(
    1,
    theoMaxDensity * 1.12,
    ...bins.map((b) => b.density * 1.1)
  );

  const toHistX = (v: number) =>
    pad.left + ((v - minBin) / Math.max(1e-6, maxBin - minBin)) * plotW;
  const toHistY = (d: number) => pad.top + plotH - (d / histMaxDensity) * plotH;

  // Theoretical Gaussian curve path
  let theoPath = '';
  if (result.theoreticalSE > 1e-6) {
    const pts: string[] = [];
    for (let i = 0; i <= 100; i++) {
      const v = minBin + ((maxBin - minBin) * i) / 100;
      const z = (v - result.trueDiff) / result.theoreticalSE;
      const dens = normalPdf(z) / result.theoreticalSE;
      pts.push(`${i === 0 ? 'M' : 'L'} ${toHistX(v).toFixed(2)} ${toHistY(dens).toFixed(2)}`);
    }
    theoPath = pts.join(' ');
  }

  // 2. Convergence Chart
  const conv = result.convergenceSeries;
  const maxRep = result.params.repetitions;
  const toConvX = (rep: number) => pad.left + (rep / Math.max(1, maxRep)) * plotW;
  const toConvY = (val: number) => pad.top + plotH - val * plotH;

  const empPowerLine = conv
    .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${toConvX(pt.rep).toFixed(2)} ${toConvY(pt.empiricalPower).toFixed(2)}`)
    .join(' ');
  const empPowerArea =
    conv.length > 0
      ? `${empPowerLine} L ${toConvX(conv[conv.length - 1].rep).toFixed(2)} ${toConvY(0).toFixed(2)} L ${toConvX(conv[0].rep).toFixed(2)} ${toConvY(0).toFixed(2)} Z`
      : '';
  const covLine = conv
    .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${toConvX(pt.rep).toFixed(2)} ${toConvY(pt.newcombeCoverage).toFixed(2)}`)
    .join(' ');

  // 3. P-Value Histogram
  const pBins = result.pValueHistogram;
  const maxPProp = Math.max(0.1, ...pBins.map((b) => b.proportion * 1.15));

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {/* Sampling Distribution of Difference */}
      <div className="bg-[#171b27] border border-[#334155] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-[#1e293b]">
          <div>
            <div className="font-display text-[11px] font-bold uppercase tracking-[0.08em] text-[#cfc2d6]">
              [MC_DIST.03] Empirical Sampling Distribution of Δ̂ = p̂₂ − p̂₁
            </div>
            <p className="text-xs text-[#988d9f] mt-0.5">
              {result.params.repetitions.toLocaleString()} simulated trials vs theoretical N(Δ, SE²) curve
            </p>
          </div>
          <div className="text-xs font-mono tabular-nums text-[#4cd7f6]">
            SD_emp = {(result.empiricalSD * 100).toFixed(2)} pp
          </div>
        </div>

        <div className="bg-[#090e19] border border-[#1e293b]">
          <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto block">
            <defs>
              <linearGradient id="mcBarGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#A855F7" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#A855F7" stopOpacity="0.25" />
              </linearGradient>
            </defs>

            {[0.25, 0.5, 0.75, 1].map((frac) => (
              <line
                key={frac}
                x1={pad.left}
                x2={w - pad.right}
                y1={pad.top + plotH * (1 - frac)}
                y2={pad.top + plotH * (1 - frac)}
                stroke="#1e293b"
                strokeWidth="1"
              />
            ))}

            {bins.map((b, idx) => {
              const x1 = toHistX(b.binStart);
              const x2 = toHistX(b.binEnd);
              const bw = Math.max(1, x2 - x1 - 1);
              const y = toHistY(b.density);
              const bh = Math.max(0, pad.top + plotH - y);
              const isHover = hoveredBin === idx;
              return (
                <rect
                  key={idx}
                  x={x1}
                  y={y}
                  width={bw}
                  height={bh}
                  fill={isHover ? '#ddb7ff' : 'url(#mcBarGrad)'}
                  stroke={isHover ? '#ffffff' : '#b76dff'}
                  strokeWidth={isHover ? 1 : 0.5}
                  onMouseEnter={() => setHoveredBin(idx)}
                  onMouseLeave={() => setHoveredBin(null)}
                  className="cursor-crosshair"
                />
              );
            })}

            {theoPath && (
              <path d={theoPath} fill="none" stroke="#4cd7f6" strokeWidth="2" />
            )}

            {/* Reference lines */}
            {minBin <= 0 && maxBin >= 0 && (
              <line
                x1={toHistX(0)}
                x2={toHistX(0)}
                y1={pad.top}
                y2={pad.top + plotH}
                stroke="#ffb4ab"
                strokeWidth="1.25"
                strokeDasharray="4 3"
              />
            )}
            <line
              x1={toHistX(result.trueDiff)}
              x2={toHistX(result.trueDiff)}
              y1={pad.top}
              y2={pad.top + plotH}
              stroke="#ddb7ff"
              strokeWidth="1.25"
              strokeDasharray="2 2"
            />

            {/* X-axis labels */}
            {[0, 0.25, 0.5, 0.75, 1].map((t) => {
              const v = minBin + t * (maxBin - minBin);
              return (
                <text
                  key={t}
                  x={toHistX(v)}
                  y={h - 10}
                  textAnchor="middle"
                  className="fill-[#988d9f] text-[10px] font-mono"
                >
                  {(v * 100).toFixed(1)}%
                </text>
              );
            })}

            <line
              x1={pad.left}
              x2={w - pad.right}
              y1={pad.top + plotH}
              y2={pad.top + plotH}
              stroke="#334155"
              strokeWidth="1"
            />
          </svg>
          <div className="px-3 py-1.5 border-t border-[#1e293b] bg-[#0e131e] text-[11px] font-mono tabular-nums text-[#cfc2d6] flex justify-between">
            {hoveredBin !== null && bins[hoveredBin] ? (
              <>
                <span>
                  BIN: [{(bins[hoveredBin].binStart * 100).toFixed(2)}%, {(bins[hoveredBin].binEnd * 100).toFixed(2)}%)
                </span>
                <span>COUNT: {bins[hoveredBin].count} / {result.params.repetitions}</span>
                <span>DENSITY: {bins[hoveredBin].density.toFixed(2)}</span>
              </>
            ) : (
              <>
                <span>VIOLET BARS: Simulated Δ̂</span>
                <span>CYAN CURVE: Theoretical Normal</span>
                <span>RED DASH: H₀ (0%)</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Sequential Power & Coverage Convergence */}
      <div className="bg-[#171b27] border border-[#334155] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-[#1e293b]">
          <div>
            <div className="font-display text-[11px] font-bold uppercase tracking-[0.08em] text-[#cfc2d6]">
              [MC_CONV.04] Sequential Power & CI Coverage Convergence
            </div>
            <p className="text-xs text-[#988d9f] mt-0.5">
              Running rejection rate vs theoretical power & Newcombe-Wilson 1−α coverage
            </p>
          </div>
          <div className="text-xs font-mono tabular-nums text-[#ddb7ff]">
            P_emp = {(result.empiricalPower * 100).toFixed(1)}%
          </div>
        </div>

        <div className="bg-[#090e19] border border-[#1e293b]">
          <svg
            viewBox={`0 0 ${w} ${h}`}
            className="w-full h-auto block cursor-crosshair"
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const relX = ((e.clientX - rect.left) / rect.width) * w;
              if (relX >= pad.left && relX <= w - pad.right && conv.length > 0) {
                const frac = (relX - pad.left) / plotW;
                const idx = Math.min(conv.length - 1, Math.max(0, Math.round(frac * (conv.length - 1))));
                setHoveredConvIdx(idx);
              } else {
                setHoveredConvIdx(null);
              }
            }}
            onMouseLeave={() => setHoveredConvIdx(null)}
          >
            <defs>
              <linearGradient id="convVioletFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#A855F7" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#0B101B" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
              <g key={tick}>
                <line
                  x1={pad.left}
                  x2={w - pad.right}
                  y1={toConvY(tick)}
                  y2={toConvY(tick)}
                  stroke="#1e293b"
                  strokeWidth="1"
                />
                <text
                  x={pad.left - 8}
                  y={toConvY(tick) + 3}
                  textAnchor="end"
                  className="fill-[#988d9f] text-[10px] font-mono"
                >
                  {(tick * 100).toFixed(0)}%
                </text>
              </g>
            ))}

            {/* Theoretical power target line */}
            <line
              x1={pad.left}
              x2={w - pad.right}
              y1={toConvY(result.theoreticalPower)}
              y2={toConvY(result.theoreticalPower)}
              stroke="#ddb7ff"
              strokeOpacity="0.65"
              strokeWidth="1"
              strokeDasharray="4 3"
            />

            {/* Nominal 1 - alpha coverage target line */}
            <line
              x1={pad.left}
              x2={w - pad.right}
              y1={toConvY(1 - result.params.alpha)}
              y2={toConvY(1 - result.params.alpha)}
              stroke="#4cd7f6"
              strokeOpacity="0.55"
              strokeWidth="1"
              strokeDasharray="4 3"
            />

            {empPowerArea && <path d={empPowerArea} fill="url(#convVioletFill)" />}
            {empPowerLine && <path d={empPowerLine} fill="none" stroke="#A855F7" strokeWidth="2" />}
            {covLine && <path d={covLine} fill="none" stroke="#06B6D4" strokeWidth="2" />}

            {/* X-axis repetition ticks */}
            {[0, 0.25, 0.5, 0.75, 1].map((t) => {
              const repVal = Math.max(1, Math.round(t * maxRep));
              return (
                <text
                  key={t}
                  x={toConvX(repVal)}
                  y={h - 10}
                  textAnchor="middle"
                  className="fill-[#988d9f] text-[10px] font-mono"
                >
                  R={repVal}
                </text>
              );
            })}

            {hoveredConvIdx !== null && conv[hoveredConvIdx] && (
              <g>
                <line
                  x1={toConvX(conv[hoveredConvIdx].rep)}
                  x2={toConvX(conv[hoveredConvIdx].rep)}
                  y1={pad.top}
                  y2={pad.top + plotH}
                  stroke="#dee2f2"
                  strokeOpacity="0.45"
                  strokeWidth="1"
                />
                <rect
                  x={toConvX(conv[hoveredConvIdx].rep) - 3}
                  y={toConvY(conv[hoveredConvIdx].empiricalPower) - 3}
                  width="6"
                  height="6"
                  fill="#A855F7"
                />
                <rect
                  x={toConvX(conv[hoveredConvIdx].rep) - 3}
                  y={toConvY(conv[hoveredConvIdx].newcombeCoverage) - 3}
                  width="6"
                  height="6"
                  fill="#06B6D4"
                />
              </g>
            )}
          </svg>
          <div className="px-3 py-1.5 border-t border-[#1e293b] bg-[#0e131e] text-[11px] font-mono tabular-nums text-[#cfc2d6] flex justify-between">
            {hoveredConvIdx !== null && conv[hoveredConvIdx] ? (
              <>
                <span>REP #{conv[hoveredConvIdx].rep}</span>
                <span>EMP POWER: {(conv[hoveredConvIdx].empiricalPower * 100).toFixed(2)}%</span>
                <span>NEWCOMBE COV: {(conv[hoveredConvIdx].newcombeCoverage * 100).toFixed(2)}%</span>
              </>
            ) : (
              <>
                <span>VIOLET: Empirical Power</span>
                <span>CYAN: Newcombe Coverage</span>
                <span>DASHED: Analytical Targets</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* P-Value Distribution Histogram (Full Width on 2-col grid) */}
      <div className="xl:col-span-2 bg-[#171b27] border border-[#334155] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-[#1e293b]">
          <div>
            <div className="font-display text-[11px] font-bold uppercase tracking-[0.08em] text-[#cfc2d6]">
              [PVAL_HIST.05] Empirical P-Value Distribution Across {result.params.repetitions.toLocaleString()} Trials
            </div>
            <p className="text-xs text-[#988d9f] mt-0.5">
              Cyan bars denote statistically significant trials (p &lt; {result.params.alpha}); uniform distribution expected under H₀
            </p>
          </div>
          <div className="text-xs font-mono tabular-nums text-[#4cd7f6]">
            {result.rejectionCount.toLocaleString()} / {result.params.repetitions.toLocaleString()} rejected ({(result.empiricalPower * 100).toFixed(2)}%)
          </div>
        </div>

        <div className="bg-[#090e19] border border-[#1e293b]">
          <svg viewBox="0 0 900 155" className="w-full h-auto block">
            {pBins.map((b, i) => {
              const bx = 46 + (i / pBins.length) * (900 - 66);
              const bw = (900 - 66) / pBins.length - 2;
              const bh = (b.proportion / maxPProp) * 106;
              const by = 122 - bh;
              const isSigBin = b.binEnd <= result.params.alpha + 1e-6;
              return (
                <g key={i}>
                  <rect
                    x={bx}
                    y={by}
                    width={bw}
                    height={Math.max(1, bh)}
                    fill={isSigBin ? '#06B6D4' : '#818CF8'}
                    fillOpacity={isSigBin ? 0.85 : 0.45}
                    stroke={isSigBin ? '#4cd7f6' : '#818CF8'}
                    strokeWidth="0.75"
                  />
                  {i % 2 === 0 && (
                    <text
                      x={bx + bw / 2}
                      y={140}
                      textAnchor="middle"
                      className="fill-[#988d9f] text-[10px] font-mono"
                    >
                      {b.binStart.toFixed(2)}
                    </text>
                  )}
                </g>
              );
            })}
            {/* Alpha marker */}
            <line
              x1={46 + result.params.alpha * (900 - 66)}
              x2={46 + result.params.alpha * (900 - 66)}
              y1={10}
              y2={124}
              stroke="#ffb4ab"
              strokeWidth="1.5"
              strokeDasharray="4 2"
            />
            <line x1={46} x2={880} y1={122} y2={122} stroke="#334155" strokeWidth="1" />
          </svg>
        </div>
      </div>
    </div>
  );
};
