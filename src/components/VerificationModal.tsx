import React, { useState } from 'react';
import { CheckCircle2, Play, ShieldCheck, X, XCircle } from 'lucide-react';
import { runVerificationSuite, type VerificationCaseResult } from '../engine/verification';

interface Props {
  open: boolean;
  onClose: () => void;
}

export const VerificationModal: React.FC<Props> = ({ open, onClose }) => {
  const [cases, setCases] = useState<VerificationCaseResult[]>(() => runVerificationSuite());

  if (!open) return null;

  const passedCount = cases.filter((c) => c.passed).length;

  return (
    <div className="fixed inset-0 z-50 bg-[#090e19]/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-[#0e131e] border border-[#38bdf8]/40 shadow-2xl max-h-[88vh] flex flex-col">
        <div className="px-4 py-3 border-b border-[#334155] bg-[#171b27] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-[#4cd7f6]" />
            <span className="font-display text-xs font-bold uppercase tracking-[0.08em] text-[#dee2f2]">
              [MATH_VERIFY.09] Automated Edge-Case & Mathematical Correctness Suite
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCases(runVerificationSuite())}
              className="px-3 py-1 border border-[#334155] hover:border-[#06b6d4] text-xs font-mono text-[#4cd7f6] flex items-center gap-1.5"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>Re-Run Suite</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 border border-[#334155] hover:border-[#ffb4ab] text-[#cfc2d6]"
              aria-label="Close verification suite"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="px-4 py-2.5 border-b border-[#1e293b] bg-[#090e19] flex items-center justify-between text-xs font-mono tabular-nums">
          <span className="text-[#cfc2d6]">
            ASSERTIONS PASSED: {passedCount} / {cases.length}
          </span>
          <span className={passedCount === cases.length ? 'text-[#4cd7f6]' : 'text-[#ffb4ab]'}>
            {passedCount === cases.length ? 'ALL INVARIANTS VERIFIED' : 'FAILURE DETECTED'}
          </span>
        </div>

        <div className="p-4 overflow-y-auto space-y-2.5">
          {cases.map((tc) => (
            <div
              key={tc.id}
              className="p-3 border border-[#1e293b] bg-[#171b27] flex flex-col gap-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {tc.passed ? (
                    <CheckCircle2 className="w-4 h-4 text-[#4cd7f6] shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-[#ffb4ab] shrink-0" />
                  )}
                  <span className="font-mono text-xs text-[#ddb7ff]">{tc.id}</span>
                  <span className="font-display text-sm font-semibold text-[#dee2f2]">
                    {tc.name}
                  </span>
                </div>
                <span className="text-[11px] font-mono text-[#988d9f]">{tc.category}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono pl-6">
                <div className="text-[#988d9f]">
                  Expected: <span className="text-[#cfc2d6]">{tc.expected}</span>
                </div>
                <div className="text-[#988d9f]">
                  Actual: <span className="text-[#4cd7f6]">{tc.actual}</span>
                </div>
              </div>
              <div className="text-[11px] font-mono text-[#988d9f] pl-6">{tc.detail}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
