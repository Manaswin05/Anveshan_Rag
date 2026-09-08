import React, { useState } from "react";
import { AlertTriangle, X, Check, ShieldAlert } from "lucide-react";

interface HitlModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyOverride: (directive: string, query: string) => void;
}

export const HitlModal: React.FC<HitlModalProps> = ({
  isOpen,
  onClose,
  onApplyOverride,
}) => {
  const [flaggedQuery, setFlaggedQuery] = useState(
    'Can an executive rollover unused sabbatical leave into immediate retirement severance?'
  );
  const [supervisorNotes, setSupervisorNotes] = useState(
    'Inject Section 8.4 Amendment: Sabbatical balances are strictly non-monetizable upon departure and immediately expire upon notice of resignation.'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/escalation/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guidance: supervisorNotes,
        }),
      });
      const data = await res.json();
      onApplyOverride(
        data.response || supervisorNotes,
        flaggedQuery
      );
    } catch (err) {
      console.warn("HITL override API fallback:", err);
      onApplyOverride(supervisorNotes, flaggedQuery);
    } finally {
      setIsSubmitting(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="tactile-card w-full max-w-2xl rounded-2xl p-6 border-amber-500/40 shadow-[0_0_50px_rgba(245,158,11,0.2)]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-400 font-bold">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold font-mono text-white uppercase tracking-wider">
                HUMAN-IN-THE-LOOP INTERVENTION DEMO
              </h3>
              <p className="text-sm font-mono text-amber-400/90 mt-0.5">
                Trigger: Cross-Encoder Score below threshold (0.68) or ambiguous policy clause
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white font-mono text-sm p-1.5 rounded-md hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="space-y-4">
          <div className="tactile-recessed p-4 rounded-xl space-y-2 text-sm font-mono">
            <div className="text-slate-300 font-medium flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>Flagged Query Under Review:</span>
            </div>
            <input
              type="text"
              value={flaggedQuery}
              onChange={(e) => setFlaggedQuery(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-amber-400/50"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-mono text-sm text-slate-200 font-semibold tracking-wide">
                SUPERVISOR OVERRIDE DIRECTIVE / POLICY GUIDANCE:
              </label>
              <span className="text-xs font-mono text-emerald-400 font-semibold">Supervisor Tier: SV-402</span>
            </div>
            <textarea
              className="w-full rounded-xl bg-obsidian-950 p-3.5 text-sm font-mono text-slate-100 border border-white/10 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 leading-relaxed shadow-inner"
              rows={4}
              value={supervisorNotes}
              onChange={(e) => setSupervisorNotes(e.target.value)}
              placeholder="Type supervisor override rationale or specify approved clause for synthesis..."
            />
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3.5 text-xs sm:text-sm font-mono text-amber-300/90 leading-relaxed">
            <strong>System Impact:</strong> Applying this override logs an immutable cryptographically stamped audit entry in the AUDIT matrix and immediately updates the active chat context with tier-3 supervisor endorsement.
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-white/10 font-mono text-sm">
          <button
            onClick={onClose}
            className="tactile-raised-btn px-4 py-2.5 rounded-lg text-slate-300 hover:text-white"
          >
            CANCEL
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="tactile-emerald-btn px-5 py-2.5 rounded-lg font-bold text-white shadow-[0_0_12px_rgba(16,185,129,0.3)] flex items-center gap-2"
          >
            {isSubmitting ? (
              <span>PROCESSING OVERRIDE...</span>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>RESUME EXECUTION WITH OVERRIDE</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
