/**
 * ModelSelector Component
 * 
 * A comprehensive LLM provider selection component supporting:
 * - Google Gemini (cloud-based, multiple models)
 * - Ollama (local inference server)
 * - LM Studio (local OpenAI-compatible runtime)
 * - LocalAI (self-hosted OpenAI alternative)
 * 
 * Features:
 * - Grouped dropdown for easy provider/model selection
 * - Configuration modal for local LLM setup
 * - Connection testing with latency feedback
 * - Auto-detection of Ollama models
 * 
 * @component
 * @example
 * ```tsx
 * <ModelSelector
 *   currentConfig={{ provider: 'gemini', model_name: 'gemini-1.5-flash' }}
 *   onModelChange={(config) => setModelConfig(config)}
 * />
 * ```
 */

import React, { useState, useEffect } from "react";
import { ModelConfig } from "../types";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, AlertCircle, Cloud, Server } from "lucide-react";

interface ModelSelectorProps {
  /** Current active model configuration */
  currentConfig: ModelConfig;
  /** Callback fired when user selects a new model */
  onModelChange: (config: ModelConfig) => void;
  /** Optional CSS class name */
  className?: string;
}

interface AvailableModels {
  gemini: string[];
  ollama: string[];
  lmstudio: string[];
  localai: string[];
}

/**
 * ModelSelector component for multi-LLM provider selection
 */
export const ModelSelector: React.FC<ModelSelectorProps> = ({
  currentConfig,
  onModelChange,
  className = ""
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [availableModels, setAvailableModels] = useState<AvailableModels>({
    gemini: [
      "gemini-2.0-flash-exp",
      "gemini-1.5-pro",
      "gemini-1.5-flash",
      "gemini-1.0-pro"
    ],
    ollama: [],
    lmstudio: [],
    localai: []
  });

  // Local LLM configuration state
  const [localProvider, setLocalProvider] = useState<'ollama' | 'lmstudio' | 'localai'>('ollama');
  const [baseUrl, setBaseUrl] = useState('http://localhost:11434');
  const [modelName, setModelName] = useState('');
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{
    ok?: boolean;
    message?: string;
    latency_ms?: number;
  }>({});

  /**
   * Fetch available models from the backend on component mount
   */
  useEffect(() => {
    fetchAvailableModels();
  }, []);

  /**
   * Fetches the list of available models from the backend API
   */
  const fetchAvailableModels = async () => {
    try {
      const response = await fetch('/api/models/list');
      if (response.ok) {
        const models = await response.json();
        setAvailableModels(models);
      }
    } catch (error) {
      console.error('Failed to fetch available models:', error);
    }
  };

  /**
   * Updates base URL when local provider selection changes
   */
  useEffect(() => {
    const defaultUrls = {
      ollama: 'http://localhost:11434',
      lmstudio: 'http://localhost:1234/v1',
      localai: 'http://localhost:8080/v1'
    };
    setBaseUrl(defaultUrls[localProvider]);
    setConnectionStatus({});
  }, [localProvider]);

  /**
   * Handles Gemini model selection from dropdown
   */
  const handleGeminiSelect = (modelName: string) => {
    onModelChange({
      provider: 'gemini',
      model_name: modelName,
      api_key: currentConfig.api_key || ''
    });
  };

  /**
   * Handles Ollama model selection from dropdown
   */
  const handleOllamaSelect = (modelName: string) => {
    onModelChange({
      provider: 'ollama',
      model_name: modelName,
      base_url: 'http://localhost:11434'
    });
  };

  /**
   * Opens the local LLM configuration modal
   */
  const handleConfigureLocal = () => {
    setIsModalOpen(true);
    setConnectionStatus({});
  };

  /**
   * Tests connection to the local LLM server
   */
  const handleTestConnection = async () => {
    if (!modelName.trim()) {
      setConnectionStatus({
        ok: false,
        message: 'Please enter a model name'
      });
      return;
    }

    setTestingConnection(true);
    setConnectionStatus({});

    try {
      const response = await fetch('/api/models/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: localProvider,
          model_name: modelName,
          base_url: baseUrl
        })
      });

      const result = await response.json();
      setConnectionStatus(result);
    } catch (error) {
      setConnectionStatus({
        ok: false,
        message: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setTestingConnection(false);
    }
  };

  /**
   * Applies the local LLM configuration and closes the modal
   */
  const handleApplyConfig = () => {
    if (connectionStatus.ok) {
      onModelChange({
        provider: localProvider,
        model_name: modelName,
        base_url: baseUrl
      });
      setIsModalOpen(false);
    }
  };

  /**
   * Formats the current model config for display
   */
  const getDisplayLabel = (): string => {
    if (currentConfig.provider === 'gemini') {
      return currentConfig.model_name.toUpperCase();
    }
    return `${currentConfig.provider.toUpperCase()}: ${currentConfig.model_name}`;
  };

  return (
    <>
      <div className={`flex items-center gap-2 ${className}`}>
        <select
          value={JSON.stringify({
            provider: currentConfig.provider,
            model_name: currentConfig.model_name
          })}
          onChange={(e) => {
            const selected = JSON.parse(e.target.value);
            if (selected.provider === 'gemini') {
              handleGeminiSelect(selected.model_name);
            } else if (selected.provider === 'ollama') {
              handleOllamaSelect(selected.model_name);
            } else {
              handleConfigureLocal();
            }
          }}
          className="rounded-md border bg-surface-0 px-3 py-1.5 font-mono text-[11px] font-medium text-foreground outline-none hover:bg-surface-1 transition-colors"
        >
          <optgroup label="☁️ Cloud Providers">
            {availableModels.gemini.map((model) => (
              <option 
                key={`gemini-${model}`}
                value={JSON.stringify({ provider: 'gemini', model_name: model })}
              >
                Gemini: {model}
              </option>
            ))}
          </optgroup>

          <optgroup label="🏠 Local LLMs">
            {availableModels.ollama.length > 0 ? (
              availableModels.ollama.map((model) => (
                <option
                  key={`ollama-${model}`}
                  value={JSON.stringify({ provider: 'ollama', model_name: model })}
                >
                  Ollama: {model}
                </option>
              ))
            ) : (
              <option value={JSON.stringify({ provider: 'ollama', model_name: 'configure' })}>
                Ollama: Configure...
              </option>
            )}
            <option value={JSON.stringify({ provider: 'lmstudio', model_name: 'configure' })}>
              LM Studio: Configure...
            </option>
            <option value={JSON.stringify({ provider: 'localai', model_name: 'configure' })}>
              LocalAI: Configure...
            </option>
          </optgroup>
        </select>

        <Badge variant="outline" className="gap-1.5 font-mono text-[9px] tracking-wider">
          {currentConfig.provider === 'gemini' ? (
            <Cloud className="h-3 w-3" />
          ) : (
            <Server className="h-3 w-3" />
          )}
          {currentConfig.provider.toUpperCase()}
        </Badge>
      </div>

      {/* Local LLM Configuration Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="font-mono text-base font-semibold">
              Configure Local LLM Provider
            </DialogTitle>
            <DialogDescription>
              Set up a local LLM server for inference. Ensure the server is running before testing.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            {/* Provider Selection */}
            <div className="flex flex-col gap-2">
              <label className="font-mono text-xs font-medium text-foreground">
                Provider
              </label>
              <select
                value={localProvider}
                onChange={(e) => setLocalProvider(e.target.value as 'ollama' | 'lmstudio' | 'localai')}
                className="rounded-md border bg-surface-0 px-3 py-2 font-mono text-sm text-foreground outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="ollama">Ollama (localhost:11434)</option>
                <option value="lmstudio">LM Studio (localhost:1234)</option>
                <option value="localai">LocalAI (localhost:8080)</option>
              </select>
            </div>

            {/* Base URL Input */}
            <div className="flex flex-col gap-2">
              <label className="font-mono text-xs font-medium text-foreground">
                Base URL
              </label>
              <Input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="http://localhost:11434"
                className="font-mono text-sm"
              />
            </div>

            {/* Model Name Input */}
            <div className="flex flex-col gap-2">
              <label className="font-mono text-xs font-medium text-foreground">
                Model Name
              </label>
              <Input
                type="text"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                placeholder={localProvider === 'ollama' ? 'llama3.2' : 'model-name'}
                className="font-mono text-sm"
              />
              <span className="font-mono text-[10px] text-muted-foreground">
                {localProvider === 'ollama' && 'Run "ollama list" to see available models'}
                {localProvider === 'lmstudio' && 'Check the model name in LM Studio settings'}
                {localProvider === 'localai' && 'Refer to your LocalAI configuration'}
              </span>
            </div>

            {/* Test Connection Button */}
            <Button
              onClick={handleTestConnection}
              disabled={testingConnection || !modelName.trim()}
              variant="outline"
              className="w-full gap-2 font-mono text-xs"
            >
              {testingConnection ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Testing Connection...
                </>
              ) : (
                <>
                  <Server className="h-4 w-4" />
                  Test Connection
                </>
              )}
            </Button>

            {/* Connection Status Display */}
            {connectionStatus.message && (
              <div
                className={`flex items-start gap-2 rounded-md border p-3 ${
                  connectionStatus.ok
                    ? 'border-success/30 bg-success/10'
                    : 'border-destructive/30 bg-destructive/10'
                }`}
              >
                {connectionStatus.ok ? (
                  <Check className="h-4 w-4 text-success mt-0.5" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
                )}
                <div className="flex flex-col gap-1">
                  <span
                    className={`font-mono text-xs font-medium ${
                      connectionStatus.ok ? 'text-success' : 'text-destructive'
                    }`}
                  >
                    {connectionStatus.message}
                  </span>
                  {connectionStatus.latency_ms !== undefined && (
                    <span className="font-mono text-[10px] text-muted-foreground">
                      Latency: {connectionStatus.latency_ms}ms
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              className="font-mono text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleApplyConfig}
              disabled={!connectionStatus.ok}
              className="font-mono text-xs font-bold tracking-widest"
            >
              APPLY CONFIG
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
