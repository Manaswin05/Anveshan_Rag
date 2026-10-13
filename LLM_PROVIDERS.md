# Multi-LLM Provider Support

Anveshan RAG supports multiple LLM providers, enabling you to choose between cloud-based and local inference engines based on your requirements for privacy, cost, and performance.

## Overview

This system supports four LLM provider categories:

- **Google Gemini** (Cloud): Fast, reliable cloud-based models with automatic fallback support
- **Ollama** (Local): Open-source local inference server with support for Llama, Mistral, and other popular models
- **LM Studio** (Local): User-friendly desktop application with OpenAI-compatible API
- **LocalAI** (Local): Self-hosted, Kubernetes-native OpenAI alternative

---

## Supported Providers

### 1. Google Gemini (Cloud)

Google's Gemini models provide state-of-the-art language understanding with automatic fallback support between model versions.

#### Available Models

| Model Name | Description | Use Case |
|------------|-------------|----------|
| `gemini-2.0-flash-exp` | Latest experimental Flash model | Cutting-edge features, fastest responses |
| `gemini-1.5-pro` | High-capability pro model | Complex reasoning, long context windows |
| `gemini-1.5-flash` | Balanced speed and quality | General-purpose RAG (recommended) |
| `gemini-1.0-pro` | Stable legacy model | Production stability |

#### Setup Instructions

1. **Get API Key**: Visit [Google AI Studio](https://aistudio.google.com/) and create a new API key
2. **Configure Environment**: Add to your `.env` file:
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```
3. **Select Model**: Choose any Gemini model from the dropdown in the UI

#### Features

- ✅ Automatic fallback to `gemini-1.5-flash` if primary model hits rate limits
- ✅ Structured output support for confidence scoring
- ✅ Integrated with Google's embedding API for RAG
- ✅ No local setup required

---

### 2. Ollama (Local Inference)

Ollama is an open-source tool that makes it easy to run large language models locally on your machine.

#### Installation

**Linux / macOS:**
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

**Windows:**
Download and install from [ollama.com](https://ollama.com)

#### Pull Models

After installation, download models you want to use:

```bash
# Recommended for RAG workloads
ollama pull llama3.2          # Meta's Llama 3.2 (3B/7B)
ollama pull mistral           # Mistral 7B v0.3
ollama pull qwen2.5:7b        # Alibaba's Qwen 2.5

# Larger models (require 16GB+ RAM)
ollama pull llama3.1:70b
ollama pull mixtral:8x7b
```

#### Verify Installation

```bash
# List installed models
ollama list

# Test a model
ollama run llama3.2
```

#### Configuration

1. **Start Ollama Server** (usually runs automatically after installation):
   ```bash
   # If not running, start manually
   ollama serve
   ```

2. **Set Base URL** (optional, defaults to `http://localhost:11434`):
   ```env
   OLLAMA_BASE_URL=http://localhost:11434
   ```

3. **Select Model**: The UI will auto-detect available Ollama models, or use the "Configure Local LLM" option

#### Model Recommendations

| Model | Size | RAM Required | Best For |
|-------|------|--------------|----------|
| `llama3.2:3b` | 3B | 4GB | Fast responses, basic Q&A |
| `llama3.2:7b` | 7B | 8GB | Balanced quality/speed |
| `mistral:7b` | 7B | 8GB | Code understanding, technical docs |
| `qwen2.5:7b` | 7B | 8GB | Multilingual support |
| `llama3.1:70b` | 70B | 64GB | Maximum quality (enterprise) |

---

### 3. LM Studio (Local Runtime)

LM Studio is a user-friendly desktop application for running local LLMs with an OpenAI-compatible API server.

#### Installation

1. **Download**: Visit [lmstudio.ai](https://lmstudio.ai) and download for your platform (Windows/macOS/Linux)
2. **Install**: Run the installer and launch LM Studio

#### Setup Instructions

1. **Download a Model**:
   - Open LM Studio
   - Click the 🔍 Search tab
   - Search for models (e.g., "Llama 3.2", "Mistral 7B")
   - Click Download on your preferred model

2. **Load the Model**:
   - Go to the 💬 Chat tab
   - Select your downloaded model from the dropdown
   - Wait for model to load into memory

3. **Start API Server**:
   - Click the ⚡ Local Server tab (bottom left)
   - Click "Start Server"
   - Note the server URL (default: `http://localhost:1234`)

4. **Configure Anveshan RAG**:
   - In the UI, select "LM Studio: Configure..." from the model dropdown
   - Enter base URL: `http://localhost:1234/v1`
   - Enter the exact model name shown in LM Studio
   - Test connection and apply

#### Recommended Models

- **Llama 3.2 8B Instruct** - Great balance of speed and quality
- **Mistral 7B Instruct v0.3** - Excellent for code and technical content
- **Phi-3 Medium** - Compact but powerful (14B parameters)
- **Qwen 2.5 7B Instruct** - Strong multilingual capabilities

---

### 4. LocalAI (Self-Hosted)

LocalAI is a drop-in replacement for OpenAI's API that runs completely on your infrastructure.

#### Docker Installation (Recommended)

1. **Create docker-compose.yml**:
   ```yaml
   version: '3.9'
   services:
     localai:
       image: quay.io/go-skynet/local-ai:latest
       ports:
         - "8080:8080"
       environment:
         - THREADS=4
         - CONTEXT_SIZE=4096
       volumes:
         - ./models:/models
       command: --models-path /models
   ```

2. **Download Models**:
   ```bash
   mkdir -p models
   cd models
   # Download a GGUF model (e.g., from HuggingFace)
   wget https://huggingface.co/TheBloke/Llama-2-7B-GGUF/resolve/main/llama-2-7b.Q4_K_M.gguf
   ```

3. **Start LocalAI**:
   ```bash
   docker-compose up -d
   ```

4. **Configure Anveshan RAG**:
   - Select "LocalAI: Configure..." from the model dropdown
   - Enter base URL: `http://localhost:8080/v1`
   - Enter model name: `llama-2-7b.Q4_K_M.gguf`
   - Test connection and apply

#### Manual Installation

See the [LocalAI documentation](https://localai.io/basics/getting_started/) for building from source or using pre-built binaries.

---

## Configuration Reference

### Environment Variables

All base URLs are optional and have sensible defaults:

```env
# Gemini (required for embeddings)
GEMINI_API_KEY=your_gemini_api_key_here

# Ollama (optional, defaults to localhost:11434)
OLLAMA_BASE_URL=http://localhost:11434

# LM Studio (optional, defaults to localhost:1234/v1)
LMSTUDIO_BASE_URL=http://localhost:1234/v1

# LocalAI (optional, defaults to localhost:8080/v1)
LOCALAI_BASE_URL=http://localhost:8080/v1
```

### Model Configuration Object

The backend expects model configurations in this format:

```typescript
{
  provider: "gemini" | "ollama" | "lmstudio" | "localai",
  model_name: string,
  api_key?: string,      // Required for Gemini
  base_url?: string      // Required for local providers
}
```

---

## Performance Comparison

| Provider | Latency (Avg) | Context Window | Structured Output | Cost |
|----------|---------------|----------------|-------------------|------|
| Gemini 1.5 Flash | 200-500ms | 1M tokens | ✅ Yes | $$ (pay per use) |
| Gemini 1.5 Pro | 800-1500ms | 2M tokens | ✅ Yes | $$$ (pay per use) |
| Ollama (7B) | 500-2000ms | 4-8K tokens | ⚠️ Limited | Free (local compute) |
| Ollama (70B) | 3000-8000ms | 4-8K tokens | ⚠️ Limited | Free (high compute) |
| LM Studio (7B) | 500-2000ms | 4-8K tokens | ⚠️ Limited | Free (local compute) |
| LocalAI (varies) | Varies | Model-dependent | ⚠️ Limited | Free (local compute) |

**Note**: Local model performance heavily depends on hardware (CPU/GPU, RAM, disk speed).

---

## API Endpoints

### List Available Models
```bash
curl http://localhost:5000/api/models/list
```

**Response:**
```json
{
  "gemini": ["gemini-2.0-flash-exp", "gemini-1.5-pro", ...],
  "ollama": ["llama3.2", "mistral", ...],
  "lmstudio": [],
  "localai": []
}
```

### Test Connection
```bash
curl -X POST http://localhost:5000/api/models/test \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "ollama",
    "model_name": "llama3.2",
    "base_url": "http://localhost:11434"
  }'
```

**Response:**
```json
{
  "ok": true,
  "message": "Successfully connected to ollama - llama3.2",
  "latency_ms": 145
}
```

---

## Troubleshooting

### Ollama Issues

**Problem**: "Connection refused" error  
**Solution**: 
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# If not, start Ollama
ollama serve
```

**Problem**: Model not appearing in dropdown  
**Solution**: Ensure the model is pulled locally
```bash
ollama list
# If missing:
ollama pull llama3.2
```

### LM Studio Issues

**Problem**: Connection timeout  
**Solution**: 
1. Verify the API server is started (⚡ Local Server tab)
2. Check the server URL matches your configuration
3. Ensure a model is loaded in the Chat tab

**Problem**: "Model not found" error  
**Solution**: Use the exact model name shown in LM Studio's dropdown (case-sensitive)

### LocalAI Issues

**Problem**: Docker container not starting  
**Solution**: Check logs for port conflicts
```bash
docker logs localai
# Change port if 8080 is in use
```

**Problem**: Slow inference  
**Solution**: 
1. Increase `THREADS` in docker-compose.yml to match your CPU cores
2. Use quantized models (Q4_K_M or Q5_K_M) for faster inference
3. Consider GPU acceleration (see LocalAI docs)

### General Issues

**Problem**: Structured output failures with local LLMs  
**Solution**: This is expected with smaller models. The system automatically falls back to simple text parsing with a confidence score of 1.0.

**Problem**: High memory usage  
**Solution**: 
- Use smaller quantized models (e.g., 7B instead of 70B)
- Close other applications to free RAM
- For Ollama, unload models when not in use: `ollama stop <model>`

---

## Best Practices

### For Privacy-Sensitive Documents
- Use Ollama or LM Studio with local models
- Keep all inference on-premises
- Note: Embeddings currently require Gemini API (roadmap: local embedding support)

### For Production Workloads
- Use Gemini for reliability and automatic fallback
- Monitor API quota usage in Google Cloud Console
- Consider caching frequently asked questions

### For Development/Testing
- Start with Gemini 1.5 Flash for quick iteration
- Test with Ollama (llama3.2:7b) before deploying local inference
- Benchmark latency with your specific documents and queries

### For Cost Optimization
- Use local models (Ollama/LM Studio) for high-volume scenarios
- Reserve Gemini for complex queries requiring advanced reasoning
- Implement query caching at the application level

---

## Contributing

We welcome contributions to expand LLM provider support!

### Adding a New Provider

1. Update `rag_engine.py`:
   - Add provider case to `create_llm()` function
   - Implement connectivity check in `check_local_llm_connectivity()`

2. Update `server.py`:
   - Add provider to `/api/models/list` endpoint
   - Add default base URL to environment configuration

3. Update `ModelSelector.tsx`:
   - Add provider option to dropdown
   - Update default base URL mapping

4. Document setup instructions in this file

### Reporting Issues

If you encounter problems with a specific provider:
- Open an issue on GitHub with the provider name, model, and error message
- Include your system specs (OS, RAM, CPU/GPU)
- Share logs from the Flask server console

---

## Roadmap

- [ ] **Multi-embedding support**: Allow local embedding models (sentence-transformers)
- [ ] **Provider-specific optimizations**: Tune chunk size and overlap per provider
- [ ] **Cost tracking**: Display estimated API costs for Gemini usage
- [ ] **Model comparison**: Side-by-side inference with multiple models
- [ ] **GPU acceleration**: Improved setup guides for CUDA/ROCm/Metal
- [ ] **Additional providers**: Anthropic Claude (API), OpenAI (API), Cohere

---

## License & Privacy

- **Gemini**: Subject to [Google's Generative AI Terms](https://ai.google.dev/terms)
- **Ollama**: Apache 2.0 License
- **LM Studio**: Proprietary (free for personal use)
- **LocalAI**: MIT License

**Privacy Note**: When using cloud providers (Gemini), your documents and queries are sent to Google's servers. For complete data privacy, use local providers exclusively. Note that embeddings currently require Gemini API.

---

## Additional Resources

- [Ollama Model Library](https://ollama.com/library)
- [LM Studio Model Explorer](https://lmstudio.ai/models)
- [LocalAI Model Gallery](https://localai.io/models/)
- [HuggingFace GGUF Models](https://huggingface.co/models?library=gguf)
- [Anveshan RAG GitHub Issues](https://github.com/your-repo/issues)

---

**Last Updated**: 2024  
**Version**: 1.0.0
