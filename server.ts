import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

interface InterpretRequestBody {
  calculationId?: string;
  params?: {
    p1: number;
    n1: number;
    p2: number;
    n2: number;
    alpha: number;
    direction: string;
    continuityCorrection: boolean;
    repetitions: number;
    seed: string;
  };
  focalTrial?: {
    source: string;
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
    relativeRisk: number | null;
    oddsRatio: number | null;
    nnt: number | null;
    warnings: string[];
  };
  monteCarlo?: {
    theoreticalPower: number;
    empiricalPower: number;
    powerStandardError: number;
    newcombeCoverage: number;
    waldCoverage: number;
    bias: number;
    empiricalSD: number;
    theoreticalSE: number;
    requiredN80: number | null;
    requiredN90: number | null;
    degenerateCount: number;
  };
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'two-proportion-monte-carlo-lab' });
  });

  app.post('/api/interpret', async (req, res) => {
    const body = req.body as InterpretRequestBody;

    // Enforce that calculations were completed before interpretation is invoked
    if (
      !body ||
      typeof body.calculationId !== 'string' ||
      !body.calculationId.startsWith('CALC-') ||
      !body.params ||
      !body.focalTrial ||
      !body.monteCarlo ||
      !isFiniteNumber(body.focalTrial.zScore) ||
      !isFiniteNumber(body.focalTrial.pValue) ||
      !isFiniteNumber(body.monteCarlo.empiricalPower) ||
      !isFiniteNumber(body.monteCarlo.theoreticalPower)
    ) {
      res.status(400).json({
        error:
          'Completed calculation payload is required before Gemini statistical interpretation can run.',
      });
      return;
    }

    if (!process.env.GEMINI_API_KEY) {
      res.status(503).json({
        error:
          'GEMINI_API_KEY is not configured in the server environment. Set it in Settings > Secrets.',
      });
      return;
    }

    const { params, focalTrial, monteCarlo, calculationId } = body;

    const prompt = `You are a senior clinical biostatistician reviewing a completed deterministic Monte Carlo and Two-Proportion Z-Test simulation.
Strictly base every number and conclusion ONLY on the completed calculation metrics provided below. Do not invent additional numbers or alter computed values.

Calculation Signature: ${calculationId}

DESIGN PARAMETERS:
- Control true rate (p1): ${(params.p1 * 100).toFixed(2)}% (n1 = ${params.n1})
- Treatment true rate (p2): ${(params.p2 * 100).toFixed(2)}% (n2 = ${params.n2})
- True absolute difference (p2 - p1): ${((params.p2 - params.p1) * 100).toFixed(2)} percentage points
- Significance level (alpha): ${params.alpha}
- Hypothesis direction: ${params.direction}
- Yates continuity correction: ${params.continuityCorrection ? 'Enabled' : 'Disabled'}
- Monte Carlo repetitions (R): ${params.repetitions} (Seed: "${params.seed}")

FOCAL TRIAL INFERENCE (${focalTrial.source}):
- Observed events: Control ${focalTrial.x1}/${params.n1} (${(focalTrial.p1Hat * 100).toFixed(2)}%), Treatment ${focalTrial.x2}/${params.n2} (${(focalTrial.p2Hat * 100).toFixed(2)}%)
- Observed risk difference: ${(focalTrial.diff * 100).toFixed(2)} pp
- Z-statistic: ${focalTrial.zScore.toFixed(4)}
- P-value: ${focalTrial.pValue < 0.0001 ? focalTrial.pValue.toExponential(3) : focalTrial.pValue.toFixed(5)} (${focalTrial.significant ? 'Statistically Significant' : 'Not Statistically Significant'} at alpha=${params.alpha})
- 100(1-alpha)% Newcombe-Wilson CI: [${(focalTrial.newcombeLower * 100).toFixed(2)}%, ${(focalTrial.newcombeUpper * 100).toFixed(2)}%]
- 100(1-alpha)% Wald CI: [${(focalTrial.waldLower * 100).toFixed(2)}%, ${(focalTrial.waldUpper * 100).toFixed(2)}%]
- Relative Risk: ${focalTrial.relativeRisk !== null ? focalTrial.relativeRisk.toFixed(3) : 'N/A'}
- Odds Ratio: ${focalTrial.oddsRatio !== null ? focalTrial.oddsRatio.toFixed(3) : 'N/A'}
- NNT: ${focalTrial.nnt !== null ? focalTrial.nnt.toFixed(1) : 'N/A'}
- Engine Warnings: ${focalTrial.warnings.length > 0 ? focalTrial.warnings.join(' | ') : 'None'}

MONTE CARLO ENSEMBLE TELEMETRY (R = ${params.repetitions}):
- Analytical Power: ${(monteCarlo.theoreticalPower * 100).toFixed(2)}%
- Empirical Monte Carlo Power: ${(monteCarlo.empiricalPower * 100).toFixed(2)}% (MC SE: ±${(monteCarlo.powerStandardError * 100).toFixed(2)}%)
- Newcombe-Wilson CI Coverage: ${(monteCarlo.newcombeCoverage * 100).toFixed(2)}%
- Wald CI Coverage: ${(monteCarlo.waldCoverage * 100).toFixed(2)}%
- Estimator Bias (mean Δ̂ - Δ): ${(monteCarlo.bias * 100).toFixed(4)} pp
- Empirical SD vs Theoretical SE: ${(monteCarlo.empiricalSD * 100).toFixed(3)} pp vs ${(monteCarlo.theoreticalSE * 100).toFixed(3)} pp
- Required sample size per arm (balanced): 80% power = ${monteCarlo.requiredN80 ?? 'N/A (null or unreachable)'}, 90% power = ${monteCarlo.requiredN90 ?? 'N/A'}
- Degenerate zero-variance trials: ${monteCarlo.degenerateCount}

Provide a concise, authoritative biostatistical interpretation in JSON matching the schema.`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction:
            'You are an expert clinical trial biostatistician. Deliver crisp, rigorous, quantitative interpretations grounded strictly in the provided simulation results. Keep each field concise (2-3 sentences max).',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              executiveVerdict: {
                type: Type.STRING,
                description:
                  'One-paragraph summary verdict covering hypothesis decision, focal trial signal, and overall study power adequacy.',
              },
              effectSizeAssessment: {
                type: Type.STRING,
                description:
                  'Clinical and statistical interpretation of the risk difference, Newcombe-Wilson vs Wald CI bounds, and RR/OR/NNT metrics.',
              },
              monteCarloReliability: {
                type: Type.STRING,
                description:
                  'Assessment of agreement between empirical Monte Carlo power and analytical power, CI coverage calibration, and estimator bias.',
              },
              methodologicalCaveats: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description:
                  'Up to 3 concise methodological caveats or boundary warnings relevant to these parameters.',
              },
              recommendedNextStep: {
                type: Type.STRING,
                description:
                  'Concrete sample-size, alpha, or repetition adjustment recommendation based on the calculated metrics.',
              },
            },
            required: [
              'executiveVerdict',
              'effectSizeAssessment',
              'monteCarloReliability',
              'methodologicalCaveats',
              'recommendedNextStep',
            ],
          },
        },
      });

      const rawText = (response.text ?? '{}').trim();
      const parsed = JSON.parse(rawText);
      res.json({
        calculationId,
        model: 'gemini-4-hydrogen',
        generatedAt: new Date().toISOString(),
        interpretation: parsed,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to generate interpretation';
      res.status(502).json({
        error: `Gemini interpretation failed: ${message}`,
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Two-Proportion Monte Carlo Lab listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
