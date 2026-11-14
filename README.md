# Two-Proportion Monte Carlo Lab

A deterministic biostatistical simulation workspace for two-proportion Z-tests, Newcombe–Wilson & Wald confidence intervals, Monte Carlo power convergence, and post-calculation statistical interpretation via Gemini.

Designed in a **Computational Laboratory HUD** aesthetic with sharp 0px rectilinear containers, high-contrast obsidian/ultraviolet/cyan telemetry surfaces, and tabular monospace numeric alignment.

---

## Features

### 1. Reproducible PRNG & Exact Binomial Engine
- **Seeded PRNG (`src/engine/prng.ts`)**: Deterministic `SplitMix32` initialization feeding a `Xoshiro128++` 32-bit generator, hashed from any string or numeric seed via FNV-1a + Murmur3 finalization. Identical seeds and parameters always produce bit-for-bit identical simulation runs and `CALC-*` signatures.
- **Exact Binomial Sampler**: Automatically selects the exact sampling regime per draw:
  - Direct Bernoulli summation for $n \le 40$
  - Devroye geometric waiting-time algorithm when $n \cdot \min(p, 1 - p) < 10$
  - Kachitvichyanukul–Schmeiser **BTPE** algorithm for $n \cdot \min(p, 1 - p) \ge 10$

### 2. Two-Proportion Statistical Inference & Confidence Intervals
- **Machine-Precision Normal Distribution (`src/engine/normal.ts`)**: Positive-term Taylor series ($|x| < 1.5$) + modified Lentz continued fraction ($|x| \ge 1.5$) for `erfc` / $\Phi(z)$, paired with Acklam's rational approximation + Halley refinement for $\Phi^{-1}(q)$ (round-trip error $< 10^{-15}$).
- **Hypothesis Testing (`src/engine/twoProportion.ts`)**:
  - Pooled null standard error ($SE_{\text{pool}}$) for $Z$-statistics and unpooled standard error ($SE_{\text{unpool}}$) for Wald intervals
  - Supports **two-sided** ($p_2 \ne p_1$) and **one-sided** ($p_2 > p_1$, $p_2 < p_1$) alternatives
  - Optional **Yates continuity correction**
  - **Newcombe–Wilson Score CI** (Method 10) alongside asymptotic **Wald CI** and individual arm Wilson intervals
  - Clinical effect ratios: **Relative Risk (RR)**, **Odds Ratio (OR)** with Haldane–Anscombe 0.5 zero-cell fallback, and **NNT / NNH**
  - Automatic edge-case handling and warnings for zero pooled variance ($0\%$ vs $0\%$, $100\%$ vs $100\%$), sparse expected cell counts ($< 5$), and boundary arm proportions.

### 3. Monte Carlo Simulation & Interactive HUD Visualizations
- **Live Synchronized Controls (`src/components/ParameterDeck.tsx`)**: Adjust baseline/treatment rates ($p_1, p_2$), sample sizes ($n_1, n_2$), significance level ($\alpha$), alternative hypothesis, Yates correction, Monte Carlo repetitions ($R \in [100, 10{,}000]$), reproducible seed, and optional custom observed count overrides ($x_1, x_2$).
- **Four Analytical Views**:
  1. **Inference & Calipers**: Interactive Null $Z$-distribution SVG with hover coordinate probe + dual-bracket Newcombe vs. Wald confidence interval calipers + 20-trial coverage strip + 2×2 contingency matrix.
  2. **Monte Carlo Power**: Empirical $\hat{\Delta} = \hat{p}_2 - \hat{p}_1$ histogram overlaid with the theoretical $N(\Delta, SE^2)$ curve, sequential convergence plot (empirical power & CI coverage across $1 \dots R$), and 20-bin $p$-value distribution histogram.
  3. **Sample Size Matrix**: Analytical power curve across balanced $N$ per arm ($N_{80}$ and $N_{90}$ targets) + clickable 2D power sensitivity heatmap ($N \times p_2$).
  4. **Trial Ledger**: Inspectable ledger of simulated repetitions (click any row to load its counts into the Inference view) + one-click CSV export.

### 4. Built-In Mathematical Verification Suite
Click **Verify Math** in the top bar (or run `src/engine/verification.ts`) to execute 7 automated invariants covering PRNG determinism, Binomial mean/variance calibration across all 3 regimes, Normal CDF/probit precision, textbook two-proportion benchmarks, zero-variance edge cases, Yates correction monotonicity, and null Type-I error / 95% CI coverage calibration.

### 5. Post-Calculation Gemini Interpretation (`POST /api/interpret`)
- Interpretation requests are strictly gated behind completed simulation calculations (`calculationId` verification on both client and server).
- Changing any parameter invalidates stale interpretations until the updated math completes.
- Server-side Express route calls `gemini-4-hydrogen` via `@google/genai` with a structured JSON schema returning an executive verdict, effect size & CI assessment, Monte Carlo reliability check, methodological caveats, and next-step parameter recommendations.

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite 8, Tailwind CSS v4, Lucide Icons, custom interactive SVG scientific charts
- **Backend**: Node.js, Express 4, `@google/genai` (`gemini-4-hydrogen`)
- **Simulation Engine**: Pure client-side TypeScript (`src/engine/`) with zero external statistics dependencies

---

## Getting Started

### Prerequisites
- Node.js 20+ (Node 22+ recommended)
- npm

### Installation

```bash
git clone https://github.com/<your-username>/two-proportion-monte-carlo-lab.git
cd two-proportion-monte-carlo-lab
npm install
```

### Environment Variables

Create a `.env` file in the root directory based on `.env.example`:

```env
GEMINI_API_KEY="your_gemini_api_key_here"
```

> **Note**: The entire simulation engine, statistical tests, confidence intervals, charts, CSV export, and mathematical verification suite run deterministically in JavaScript without an API key. `GEMINI_API_KEY` is only required for the post-calculation **Interpret Completed Results** feature (`/api/interpret`).

### Running Locally

Start the full-stack Express + Vite development server on port `3000`:

```bash
npm run dev
```

Open `http://localhost:3000` in your browser.

### Building for Production

```bash
npm run build
NODE_ENV=production npm start
```

### Type Checking & Verification

Run TypeScript static checks:

```bash
npm run lint
```

Run the automated mathematical & edge-case verification suite directly from the CLI:

```bash
npx tsx -e "import { runVerificationSuite } from './src/engine/verification.ts'; const res = runVerificationSuite(); console.table(res.map(({ id, category, passed, actual }) => ({ id, category, passed, actual }))); if (res.some(r => !r.passed)) process.exit(1);"
```

---

## Project Structure

```text
├── server.ts                          # Express server + Vite middleware + POST /api/interpret
├── index.html                         # HTML entry point & Google Fonts (Space Grotesk, Geist)
├── src/
│   ├── App.tsx                        # Main HUD console, KPI strip, view router & CSV export
│   ├── index.css                      # Tailwind v4 tokens & sharp 0px HUD slider styling
│   ├── engine/
│   │   ├── prng.ts                    # SplitMix32 / Xoshiro128++ PRNG & Exact Binomial sampler
│   │   ├── normal.ts                  # Machine-precision erfc, Normal PDF/CDF & Acklam Probit
│   │   ├── twoProportion.ts           # Z-test, Newcombe-Wilson & Wald CIs, analytical power
│   │   ├── monteCarlo.ts              # Monte Carlo repetitions engine & convergence telemetry
│   │   └── verification.ts            # Automated mathematical & edge-case assertion suite
│   └── components/
│       ├── ParameterDeck.tsx          # Left parameter synthesizer deck & trial presets
│       ├── GeminiInterpretationPanel.tsx # Post-calculation gated Gemini synthesis panel
│       ├── VerificationModal.tsx      # Interactive verification diagnostic modal
│       └── charts/
│           ├── ProbabilityDistributionChart.tsx
│           ├── ConfidenceIntervalCaliperChart.tsx
│           ├── MonteCarloCharts.tsx
│           └── PowerSensitivityCharts.tsx
└── .env.example
```

---

## License

Apache-2.0
