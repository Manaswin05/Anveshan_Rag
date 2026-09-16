import React, { useEffect, useState } from "react";
import { Search, Zap, FileText, Shield, Sparkles, RefreshCw } from "lucide-react";
import { RAGTabId } from "../types";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTab: (tab: RAGTabId) => void;
  onOpenHitl: () => void;
  onOpenImageAnalysis: () => void;
  onReindex: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onSelectTab,
  onOpenHitl,
  onOpenImageAnalysis,
  onReindex,
}) => {
  return (
    <CommandDialog open={isOpen} onOpenChange={onClose}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No matching commands found.</CommandEmpty>
        
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => { onSelectTab("workspace"); onClose(); }}>
            <Zap className="mr-2 h-4 w-4" />
            <span>Navigate to Workspace</span>
          </CommandItem>
          <CommandItem onSelect={() => { onSelectTab("documents"); onClose(); }}>
            <FileText className="mr-2 h-4 w-4" />
            <span>View Indexed Documents (12 Files)</span>
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading="Telemetry & Inspection">
          <CommandItem onSelect={() => { onSelectTab("pipeline"); onClose(); }}>
            <Zap className="mr-2 h-4 w-4" />
            <span>Inspect 9-Stage Hybrid Pipeline</span>
          </CommandItem>
          <CommandItem onSelect={() => { onSelectTab("retrieval"); onClose(); }}>
            <FileText className="mr-2 h-4 w-4" />
            <span>View Deep Candidate Inspector Matrix</span>
          </CommandItem>
          <CommandItem onSelect={() => { onSelectTab("audit"); onClose(); }}>
            <Shield className="mr-2 h-4 w-4" />
            <span>Audit Trail & Cryptographic Verifications</span>
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading="Supervisor Actions">
          <CommandItem onSelect={() => { onOpenHitl(); onClose(); }}>
            <Shield className="mr-2 h-4 w-4 text-warning" />
            <span>Simulate Human-in-the-Loop Escalation</span>
          </CommandItem>
          <CommandItem onSelect={() => { onOpenImageAnalysis(); onClose(); }}>
            <Sparkles className="mr-2 h-4 w-4 text-info" />
            <span>Analyze Image / Document Scan with Gemini 3.1 Pro</span>
          </CommandItem>
          <CommandItem onSelect={() => { onReindex(); onClose(); }}>
            <RefreshCw className="mr-2 h-4 w-4" />
            <span>Trigger Instant Corpus Re-indexing</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
};
