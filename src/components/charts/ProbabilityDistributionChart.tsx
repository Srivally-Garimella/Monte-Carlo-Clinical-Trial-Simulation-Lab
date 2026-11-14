import React, { useMemo, useState } from 'react';
import { normalCdf, normalPdf } from '../../engine/normal';
import type { HypothesisDirection, TwoProportionResult } from '../../engine/twoProportion';

interface Props {
  inference: TwoProportionResult;
  alpha: number;
  direction: HypothesisDirection;
}

export const ProbabilityDistributionChart: React.FC<Props> = ({
  inference,
  alpha,
  direction,
}) => {
  const [hoverZ, setHoverZ] = useState<number | null>(null);

  const width = 640;
  const height = 270;
  const pad = { top: 24, right: 24, bottom: 38, left: 46 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const zMin = -4.2;
  const zMax = 4.2;
  const maxPdf = 0.42;

  const toX = (z: number) => pad.left + ((z - zMin) / (zMax - zMin)) * plotW;
  const toY = (pdf: number) => pad.top + plotH - (pdf / maxPdf) * plotH;

  const { curvePath, areaPath, leftRejectPath, rightRejectPath } = useMemo(() => {
    const steps = 160;
    const pts: Array<{ z: number; x: number; y: number }> = [];
    for (let i = 0; i <= steps; i++) {
      const z = zMin + ((zMax - zMin) * i) / steps;
      pts.push({ z, x: toX(z), y: toY(normalPdf(z)) });
    }

    const line = pts
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
      .join(' ');
    const baseY = toY(0);
    const area = `${line} L ${pts[pts.length - 1].x.toFixed(2)} ${baseY.toFixed(2)} L ${pts[0].x.toFixed(2)} ${baseY.toFixed(2)} Z`;

    const buildTail = (fromZ: number, toTailZ: number) => {
      const tailPts: Array<{ x: number; y: number }> = [];
      const tailSteps = 48;
      for (let i = 0; i <= tailSteps; i++) {
        const z = fromZ + ((toTailZ - fromZ) * i) / tailSteps;
        tailPts.push({ x: toX(z), y: toY(normalPdf(z)) });
      }
      if (tailPts.length < 2) return '';
      const topLine = tailPts
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
        .join(' ');
      return `${topLine} L ${tailPts[tailPts.length - 1].x.toFixed(2)} ${baseY.toFixed(2)} L ${tailPts[0].x.toFixed(2)} ${baseY.toFixed(2)} Z`;
    };

    const crit = inference.zCritical;
    let leftPath = '';
    let rightPath = '';
    if (direction === 'two-sided') {
      leftPath = buildTail(zMin, -crit);
      rightPath = buildTail(crit, zMax);
    } else if (direction === 'greater') {
      rightPath = buildTail(crit, zMax);
    } else {
      leftPath = buildTail(zMin, -crit);
    }

    return {
      curvePath: line,
      areaPath: area,
      leftRejectPath: leftPath,
      rightRejectPath: rightPath,
    };
  }, [inference.zCritical, direction]);

  const clampedZ = Math.max(zMin + 0.08, Math.min(zMax - 0.08, inference.zScore));
  const obsX = toX(clampedZ);
  const obsY = toY(normalPdf(clampedZ));
  const baseY = toY(0);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * width;
    if (relX >= pad.left && relX <= width - pad.right) {
      const z = zMin + ((relX - pad.left) / plotW) * (zMax - zMin);
      setHoverZ(z);
    } else {
      setHoverZ(null);
    }
  };

  return (
    <div className="bg-[#171b27] border border-[#334155] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-[#1e293b]">
        <div>
          <div className="font-display text-[11px] font-bold uppercase tracking-[0.08em] text-[#cfc2d6]">
            [DIST_PDF.01] Null Hypothesis Z-Distribution & Rejection Regions
          </div>
          <p className="text-xs text-[#988d9f] mt-0.5">
            Standard normal density φ(z) under H₀: p₁ = p₂ with α = {alpha.toFixed(3)} ({direction})
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono tabular-nums">
          <span className="text-[#ddb7ff]">
            z_obs = {inference.zScore.toFixed(3)}
          </span>
          <span className="text-[#4cd7f6]">
            z_crit = {direction === 'two-sided' ? `±${inference.zCritical.toFixed(3)}` : direction === 'greater' ? `+${inference.zCritical.toFixed(3)}` : `-${inference.zCritical.toFixed(3)}`}
          </span>
        </div>
      </div>

      <div className="relative bg-[#090e19] border border-[#1e293b]">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto block cursor-crosshair select-none"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverZ(null)}
        >
          <defs>
            <linearGradient id="hudVioletFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#A855F7" stopOpacity="0.42" />
              <stop offset="100%" stopColor="#0B101B" stopOpacity="0.04" />
            </linearGradient>
            <linearGradient id="hudCyanReject" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.12" />
            </linearGradient>
          </defs>

          {/* Horizontal grid lines */}
          {[0.1, 0.2, 0.3, 0.4].map((tick) => (
            <g key={tick}>
              <line
                x1={pad.left}
                x2={width - pad.right}
                y1={toY(tick)}
                y2={toY(tick)}
                stroke="#1e293b"
                strokeWidth="1"
              />
              <text
                x={pad.left - 8}
                y={toY(tick) + 3}
                textAnchor="end"
                className="fill-[#988d9f] text-[10px] font-mono"
              >
                {tick.toFixed(1)}
              </text>
            </g>
          ))}

          {/* Vertical grid ticks */}
          {[-4, -3, -2, -1, 0, 1, 2, 3, 4].map((zt) => (
            <g key={zt}>
              <line
                x1={toX(zt)}
                x2={toX(zt)}
                y1={pad.top}
                y2={baseY}
                stroke={zt === 0 ? '#334155' : '#171b27'}
                strokeWidth="1"
              />
              <text
                x={toX(zt)}
                y={baseY + 16}
                textAnchor="middle"
                className="fill-[#988d9f] text-[10px] font-mono"
              >
                {zt}
              </text>
            </g>
          ))}

          {/* Probability Distribution Area & Rejection Tails */}
          <path d={areaPath} fill="url(#hudVioletFill)" />
          {leftRejectPath && <path d={leftRejectPath} fill="url(#hudCyanReject)" />}
          {rightRejectPath && <path d={rightRejectPath} fill="url(#hudCyanReject)" />}

          {/* Primary Normal Curve */}
          <path d={curvePath} fill="none" stroke="#A855F7" strokeWidth="2" />

          {/* Baseline axis */}
          <line
            x1={pad.left}
            x2={width - pad.right}
            y1={baseY}
            y2={baseY}
            stroke="#334155"
            strokeWidth="1"
          />

          {/* Critical threshold markers */}
          {(direction === 'two-sided' || direction === 'greater') && (
            <line
              x1={toX(inference.zCritical)}
              x2={toX(inference.zCritical)}
              y1={pad.top}
              y2={baseY}
              stroke="#06B6D4"
              strokeWidth="1.25"
              strokeDasharray="4 3"
            />
          )}
          {(direction === 'two-sided' || direction === 'less') && (
            <line
              x1={toX(-inference.zCritical)}
              x2={toX(-inference.zCritical)}
              y1={pad.top}
              y2={baseY}
              stroke="#06B6D4"
              strokeWidth="1.25"
              strokeDasharray="4 3"
            />
          )}

          {/* Observed Z needle */}
          <line
            x1={obsX}
            x2={obsX}
            y1={pad.top + 4}
            y2={baseY}
            stroke={inference.significant ? '#4cd7f6' : '#ddb7ff'}
            strokeWidth="2"
          />
          <rect
            x={obsX - 4}
            y={obsY - 4}
            width="8"
            height="8"
            fill={inference.significant ? '#4cd7f6' : '#ddb7ff'}
            stroke="#090e19"
            strokeWidth="1.5"
          />
          <text
            x={Math.min(width - pad.right - 72, Math.max(pad.left + 8, obsX + 8))}
            y={pad.top + 14}
            className="fill-[#dee2f2] text-[10px] font-mono font-semibold"
          >
            Z = {inference.zScore.toFixed(2)}
            {Math.abs(inference.zScore) > zMax ? ' (clamped)' : ''}
          </text>

          {/* Interactive Crosshair Probe */}
          {hoverZ !== null && (
            <g>
              <line
                x1={toX(hoverZ)}
                x2={toX(hoverZ)}
                y1={pad.top}
                y2={baseY}
                stroke="#dee2f2"
                strokeOpacity="0.45"
                strokeWidth="1"
              />
              <rect
                x={toX(hoverZ) - 3}
                y={toY(normalPdf(hoverZ)) - 3}
                width="6"
                height="6"
                fill="#dee2f2"
              />
            </g>
          )}
        </svg>

        {/* Crosshair HUD readout */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 border-t border-[#1e293b] bg-[#0e131e] text-[11px] font-mono tabular-nums text-[#cfc2d6]">
          {hoverZ !== null ? (
            <>
              <span>PROBE z = {hoverZ.toFixed(3)}</span>
              <span>φ(z) = {normalPdf(hoverZ).toFixed(4)}</span>
              <span>Φ(z) = {(normalCdf(hoverZ) * 100).toFixed(2)}%</span>
              <span>Upper Tail 1−Φ(z) = {(1 - normalCdf(hoverZ)).toFixed(4)}</span>
            </>
          ) : (
            <>
              <span>AXIS: Standardized Z-Statistic [-4.2, +4.2]</span>
              <span>SHADED CYAN: Rejection Region (α = {alpha.toFixed(3)})</span>
              <span>HOVER CANVAS FOR COORDINATE PROBE</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
