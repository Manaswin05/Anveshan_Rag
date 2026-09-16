import React, { useState } from "react";
import { AlertTriangle, Check, ShieldAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md border bg-surface-1">
              <ShieldAlert className="h-5 w-5 text-warning" />
            </div>
            <div>
              <DialogTitle className="text-sm uppercase tracking-wider text-accent">
                Human-in-the-Loop Intervention
              </DialogTitle>
              <p className="mt-1 text-xs text-warning">
                Trigger: Cross-Encoder Score below threshold (0.68)
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          <div className="rounded-lg border bg-surface-0 p-4">
            <div className="mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <span className="text-xs font-medium text-foreground">Flagged Query Under Review:</span>
            </div>
            <Input
              value={flaggedQuery}
              onChange={(e) => setFlaggedQuery(e.target.value)}
              className="font-mono text-sm"
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-medium uppercase tracking-wider text-foreground">
                Supervisor Override Directive:
              </label>
              <span className="text-[10px] uppercase tracking-wider text-accent">Supervisor: SV-402</span>
            </div>
            <Textarea
              value={supervisorNotes}
              onChange={(e) => setSupervisorNotes(e.target.value)}
              rows={4}
              className="font-mono text-sm"
              placeholder="Type supervisor override rationale..."
            />
          </div>

          <div className="rounded-md border border-warning/20 bg-warning/10 p-3">
            <p className="text-xs leading-relaxed text-warning">
              <strong>System Impact:</strong> Applying this override logs an immutable cryptographically stamped audit entry and immediately updates the active chat context with tier-3 supervisor endorsement.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            CANCEL
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <span>PROCESSING...</span>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                <span>RESUME WITH OVERRIDE</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
