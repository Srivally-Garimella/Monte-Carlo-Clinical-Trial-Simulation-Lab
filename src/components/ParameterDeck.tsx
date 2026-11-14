import React from 'react';
import { Dices, Download, Play, RotateCcw } from 'lucide-react';
import type { SimulationParams } from '../engine/monteCarlo';
import type { HypothesisDirection } from '../engine/twoProportion';

export interface PresetScenario {
  id: string;
  label: string;
  description: string;
  params: Partial<SimulationParams>;
}

export const PRESET_SCENARIOS: PresetScenario[] = [
  {
    id: 'rct-standard',
    label: 'Phase III RCT',
    description: '22% vs 34%, n=200/arm, α=0.05',
    params: {
      p1: 0.22,
      n1: 200,
      p2: 0.34,
      n2: 200,
      alpha: 0.05,
      direction: 'two-sided',
      continuityCorrection: false,
      repetitions: 2000,
      useCustomCounts: false,
    },
  },
  {
    id: 'null-calibration',
    label: 'Null H₀ Check',
    description: 'p₁=p₂=0.30, Type-I calibration',
    params: {
      p1: 0.3,
      n1: 150,
      p2: 0.3,
      n2: 150,
      alpha: 0.05,
      direction: 'two-sided',
      continuityCorrection: false,
      repetitions: 2500,
      useCustomCounts: false,
    },
  },
  {
    id: 'sparse-boundary',
    label: 'Sparse Boundary',
    description: '1% vs 6%, n=80/arm, Yates CC',
    params: {
      p1: 0.01,
      n1: 80,
      p2: 0.06,
      n2: 80,
      alpha: 0.05,
      direction: 'greater',
      continuityCorrection: true,
      repetitions: 2000,
      useCustomCounts: false,
    },
  },
  {
    id: 'asymmetric-cohort',
    label: '2:1 Allocation',
    description: '25% vs 38%, n₁=120, n₂=240',
    params: {
      p1: 0.25,
      n1: 120,
      p2: 0.38,
      n2: 240,
      alpha: 0.05,
      direction: 'two-sided',
      continuityCorrection: false,
      repetitions: 2000,
      useCustomCounts: false,
    },
  },
];

interface Props {
  params: SimulationParams;
  onChange: (next: SimulationParams) => void;
  onRecompute: () => void;
  onReset: () => void;
  onExportCsv: () => void;
  isComputing: boolean;
}

export const ParameterDeck: React.FC<Props> = ({
  params,
  onChange,
  onRecompute,
  onReset,
  onExportCsv,
  isComputing,
}) => {
  const update = <K extends keyof SimulationParams>(key: K, value: SimulationParams[K]) => {
    const next = { ...params, [key]: value };
    if (key === 'n1' && next.customX1 > Number(value)) {
      next.customX1 = Number(value);
    }
    if (key === 'n2' && next.customX2 > Number(value)) {
      next.customX2 = Number(value);
    }
    onChange(next);
  };

  const randomizeSeed = () => {
    const token = Math.floor(100000 + Math.random() * 900000);
    update('seed', `SEED-${token}`);
  };

  return (
    <aside className="bg-[#171b27] border border-[#334155] flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#1e293b] flex items-center justify-between bg-[#1b1f2b]">
        <span className="font-display text-[11px] font-bold uppercase tracking-[0.08em] text-[#ddb7ff]">
          [PARAM_DECK.00] Parameter Synthesizer
        </span>
        <button
          type="button"
          onClick={onReset}
          className="text-xs font-mono text-[#988d9f] hover:text-[#4cd7f6] flex items-center gap-1 transition-colors"
          title="Reset to defaults"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset</span>
        </button>
      </div>

      <div className="p-4 space-y-5 flex-1 overflow-y-auto">
        {/* Preset Selector */}
        <div>
          <div className="font-display text-[11px] font-bold uppercase tracking-[0.08em] text-[#cfc2d6] mb-2">
            Trial Presets
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {PRESET_SCENARIOS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => onChange({ ...params, ...preset.params })}
                className="text-left px-2.5 py-2 border border-[#334155] bg-[#0e131e] hover:border-[#4cd7f6] hover:bg-[#1b1f2b] transition-colors"
              >
                <div className="font-display text-xs font-semibold text-[#dee2f2]">
                  {preset.label}
                </div>
                <div className="text-[11px] font-mono text-[#988d9f] truncate">
                  {preset.description}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Cohort A: Control */}
        <div className="pt-4 border-t border-[#1e293b] space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-display text-[11px] font-bold uppercase tracking-[0.08em] text-[#cfc2d6]">
              Cohort A · Control Arm
            </span>
            <span className="text-xs font-mono tabular-nums text-[#818cf8]">
              p₁ = {(params.p1 * 100).toFixed(1)}% · n₁ = {params.n1}
            </span>
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <label htmlFor="slider-p1" className="text-[#988d9f]">
                Baseline Rate (p₁)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={Number((params.p1 * 100).toFixed(1))}
                onChange={(e) => {
                  const v = Math.min(100, Math.max(0, Number(e.target.value) || 0));
                  update('p1', v / 100);
                }}
                className="w-20 bg-[#090e19] border border-[#334155] px-2 py-0.5 text-right font-mono text-xs tabular-nums text-[#dee2f2] focus:border-[#a855f7] focus:outline-none"
              />
            </div>
            <input
              id="slider-p1"
              type="range"
              min={0}
              max={1}
              step={0.005}
              value={params.p1}
              onChange={(e) => update('p1', parseFloat(e.target.value))}
              className="hud-slider"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <label htmlFor="slider-n1" className="text-[#988d9f]">
                Sample Size (n₁)
              </label>
              <input
                type="number"
                min={2}
                max={5000}
                step={1}
                value={params.n1}
                onChange={(e) => {
                  const v = Math.min(5000, Math.max(2, Math.round(Number(e.target.value) || 2)));
                  update('n1', v);
                }}
                className="w-20 bg-[#090e19] border border-[#334155] px-2 py-0.5 text-right font-mono text-xs tabular-nums text-[#dee2f2] focus:border-[#a855f7] focus:outline-none"
              />
            </div>
            <input
              id="slider-n1"
              type="range"
              min={10}
              max={1500}
              step={5}
              value={Math.min(1500, params.n1)}
              onChange={(e) => update('n1', parseInt(e.target.value, 10))}
              className="hud-slider"
            />
          </div>
        </div>

        {/* Cohort B: Treatment */}
        <div className="pt-4 border-t border-[#1e293b] space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-display text-[11px] font-bold uppercase tracking-[0.08em] text-[#4cd7f6]">
              Cohort B · Treatment Arm
            </span>
            <span className="text-xs font-mono tabular-nums text-[#4cd7f6]">
              p₂ = {(params.p2 * 100).toFixed(1)}% · n₂ = {params.n2}
            </span>
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <label htmlFor="slider-p2" className="text-[#988d9f]">
                Treatment Rate (p₂)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={Number((params.p2 * 100).toFixed(1))}
                onChange={(e) => {
                  const v = Math.min(100, Math.max(0, Number(e.target.value) || 0));
                  update('p2', v / 100);
                }}
                className="w-20 bg-[#090e19] border border-[#334155] px-2 py-0.5 text-right font-mono text-xs tabular-nums text-[#dee2f2] focus:border-[#06b6d4] focus:outline-none"
              />
            </div>
            <input
              id="slider-p2"
              type="range"
              min={0}
              max={1}
              step={0.005}
              value={params.p2}
              onChange={(e) => update('p2', parseFloat(e.target.value))}
              className="hud-slider hud-slider-cyan"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <label htmlFor="slider-n2" className="text-[#988d9f]">
                Sample Size (n₂)
              </label>
              <input
                type="number"
                min={2}
                max={5000}
                step={1}
                value={params.n2}
                onChange={(e) => {
                  const v = Math.min(5000, Math.max(2, Math.round(Number(e.target.value) || 2)));
                  update('n2', v);
                }}
                className="w-20 bg-[#090e19] border border-[#334155] px-2 py-0.5 text-right font-mono text-xs tabular-nums text-[#dee2f2] focus:border-[#06b6d4] focus:outline-none"
              />
            </div>
            <input
              id="slider-n2"
              type="range"
              min={10}
              max={1500}
              step={5}
              value={Math.min(1500, params.n2)}
              onChange={(e) => update('n2', parseInt(e.target.value, 10))}
              className="hud-slider hud-slider-cyan"
            />
          </div>
        </div>

        {/* Statistical Inference Settings */}
        <div className="pt-4 border-t border-[#1e293b] space-y-3">
          <div className="font-display text-[11px] font-bold uppercase tracking-[0.08em] text-[#cfc2d6]">
            Hypothesis & Alpha Level
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <label htmlFor="slider-alpha" className="text-[#988d9f]">
                Significance Level (α)
              </label>
              <span className="font-mono tabular-nums text-[#dee2f2]">
                {params.alpha.toFixed(3)} ({((1 - params.alpha) * 100).toFixed(1)}% CI)
              </span>
            </div>
            <input
              id="slider-alpha"
              type="range"
              min={0.005}
              max={0.2}
              step={0.005}
              value={params.alpha}
              onChange={(e) => update('alpha', parseFloat(e.target.value))}
              className="hud-slider"
            />
            <div className="grid grid-cols-4 gap-1 mt-1.5">
              {[0.001, 0.01, 0.05, 0.1].map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => update('alpha', a)}
                  className={`py-1 text-[11px] font-mono border transition-colors ${
                    Math.abs(params.alpha - a) < 1e-4
                      ? 'bg-[#a855f7] text-[#090e19] border-[#ddb7ff] font-bold'
                      : 'bg-[#090e19] text-[#988d9f] border-[#334155] hover:border-[#4cd7f6]'
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs text-[#988d9f] mb-1.5">Alternative Hypothesis H₁</div>
            <div className="grid grid-cols-3 border border-[#334155] bg-[#090e19]">
              {(
                [
                  { id: 'two-sided', label: 'p₂ ≠ p₁' },
                  { id: 'greater', label: 'p₂ > p₁' },
                  { id: 'less', label: 'p₂ < p₁' },
                ] as Array<{ id: HypothesisDirection; label: string }>
              ).map((dir) => (
                <button
                  key={dir.id}
                  type="button"
                  onClick={() => update('direction', dir.id)}
                  className={`py-1.5 text-xs font-mono transition-colors ${
                    params.direction === dir.id
                      ? 'bg-[#b76dff] text-[#090e19] font-bold'
                      : 'text-[#cfc2d6] hover:bg-[#1b1f2b]'
                  }`}
                >
                  {dir.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sharp Square Checkbox for Yates Continuity Correction */}
          <label className="flex items-center gap-2.5 cursor-pointer select-none pt-1">
            <input
              type="checkbox"
              checked={params.continuityCorrection}
              onChange={(e) => update('continuityCorrection', e.target.checked)}
              className="sr-only"
            />
            <span className="w-4 h-4 border border-[#988d9f] bg-[#090e19] flex items-center justify-center shrink-0">
              {params.continuityCorrection && (
                <span className="w-2.5 h-2.5 bg-[#a855f7] block" />
              )}
            </span>
            <span className="text-xs text-[#dee2f2]">
              Yates Continuity Correction
            </span>
          </label>
        </div>

        {/* Monte Carlo Repetitions & Seed */}
        <div className="pt-4 border-t border-[#1e293b] space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-display text-[11px] font-bold uppercase tracking-[0.08em] text-[#cfc2d6]">
              Monte Carlo Engine
            </span>
            <span className="text-xs font-mono tabular-nums text-[#ddb7ff]">
              R = {params.repetitions.toLocaleString()}
            </span>
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <label htmlFor="slider-reps" className="text-[#988d9f]">
                Repetitions (R)
              </label>
              <span className="font-mono text-[#cfc2d6]">
                100 – 10,000
              </span>
            </div>
            <input
              id="slider-reps"
              type="range"
              min={100}
              max={10000}
              step={100}
              value={params.repetitions}
              onChange={(e) => update('repetitions', parseInt(e.target.value, 10))}
              className="hud-slider"
            />
          </div>

          <div>
            <label htmlFor="seed-input" className="block text-xs text-[#988d9f] mb-1">
              Reproducible PRNG Seed (Xoshiro128++)
            </label>
            <div className="flex gap-1.5">
              <input
                id="seed-input"
                type="text"
                value={params.seed}
                onChange={(e) => update('seed', e.target.value)}
                className="flex-1 bg-[#090e19] border border-[#334155] px-2.5 py-1.5 text-xs font-mono text-[#dee2f2] focus:border-[#a855f7] focus:outline-none"
                placeholder="STRATA-2026"
              />
              <button
                type="button"
                onClick={randomizeSeed}
                className="px-2.5 py-1.5 border border-[#334155] bg-[#0e131e] text-[#cfc2d6] hover:border-[#4cd7f6] hover:text-[#4cd7f6] transition-colors flex items-center gap-1 text-xs font-mono"
                title="Generate new deterministic seed"
              >
                <Dices className="w-3.5 h-3.5" />
                <span>New</span>
              </button>
            </div>
          </div>

          {/* Focal Trial Observed Override */}
          <div className="pt-2 border-t border-[#1e293b]">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={params.useCustomCounts}
                onChange={(e) => update('useCustomCounts', e.target.checked)}
                className="sr-only"
              />
              <span className="w-4 h-4 border border-[#988d9f] bg-[#090e19] flex items-center justify-center shrink-0">
                {params.useCustomCounts && (
                  <span className="w-2.5 h-2.5 bg-[#06b6d4] block" />
                )}
              </span>
              <span className="text-xs text-[#dee2f2]">
                Inspect Custom Observed Counts (x₁, x₂)
              </span>
            </label>

            {params.useCustomCounts && (
              <div className="mt-3 p-2.5 bg-[#090e19] border border-[#1e293b] space-y-2.5">
                <div>
                  <div className="flex justify-between text-xs font-mono tabular-nums mb-1">
                    <span className="text-[#988d9f]">Control Events x₁</span>
                    <span className="text-[#dee2f2]">
                      {params.customX1} / {params.n1} ({((params.customX1 / params.n1) * 100).toFixed(1)}%)
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={params.n1}
                    step={1}
                    value={params.customX1}
                    onChange={(e) => update('customX1', parseInt(e.target.value, 10))}
                    className="hud-slider"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs font-mono tabular-nums mb-1">
                    <span className="text-[#988d9f]">Treatment Events x₂</span>
                    <span className="text-[#4cd7f6]">
                      {params.customX2} / {params.n2} ({((params.customX2 / params.n2) * 100).toFixed(1)}%)
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={params.n2}
                    step={1}
                    value={params.customX2}
                    onChange={(e) => update('customX2', parseInt(e.target.value, 10))}
                    className="hud-slider hud-slider-cyan"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="p-4 border-t border-[#1e293b] bg-[#1b1f2b] space-y-2">
        <button
          type="button"
          onClick={onRecompute}
          disabled={isComputing}
          className="w-full py-2.5 px-4 bg-[#a855f7] hover:bg-[#b76dff] text-[#090e19] font-display text-xs font-bold uppercase tracking-[0.08em] flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>{isComputing ? 'Computing...' : 'Run Simulation'}</span>
        </button>

        <button
          type="button"
          onClick={onExportCsv}
          className="w-full py-2 px-4 border border-[#334155] bg-transparent hover:border-[#06b6d4] text-[#dee2f2] hover:text-[#4cd7f6] font-display text-xs font-semibold uppercase tracking-[0.06em] flex items-center justify-center gap-2 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Trial Ledger CSV</span>
        </button>
      </div>
    </aside>
  );
};
