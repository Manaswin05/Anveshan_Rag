import fitz  # PyMuPDF
import base64
import requests
import gc
import numpy as np
import faiss
from rank_bm25 import BM25Okapi
from fastembed import TextEmbedding

OLLAMA_BASE_URL = "http://127.0.0.1:11434"

# Initialize local ONNX embedding model
embed_model = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")

def chunk_text(text: str, chunk_size: int = 800, overlap: int = 150) -> list[str]:
    if len(text) <= chunk_size:
        return [text]
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end].strip())
        start += chunk_size - overlap
    return [c for c in chunks if c]

def describe_image_with_moondream(png_bytes: bytes) -> str:
    encoded_image = base64.b64encode(png_bytes).decode("utf-8")
    
    payload = {
        "model": "moondream",
        "prompt": "Describe this image, chart, diagram, or table in detail. Include all visible labels, numbers, and text.",
        "images": [encoded_image],
        "stream": False,
        "keep_alive": "5m",  
        "options": {
            "num_gpu": 0,         # Force CPU mapping
            "use_mmap": False,    # Stop contiguous allocation
            "num_thread": 6,
            "num_ctx": 2048
        }
    }
    
    try:
        res = requests.post(f"{OLLAMA_BASE_URL}/api/generate", json=payload, timeout=90)
        if res.status_code == 200:
            resp_text = res.json().get("response", "").strip()
            return resp_text if resp_text else "Visual asset detected (no text description returned by model)."
        else:
            return f"Vision API Error (HTTP {res.status_code}): {res.text}"
    except Exception as e:
        return f"Vision connection error: {str(e)}"

def unload_moondream():
    try:
        requests.post(
            f"{OLLAMA_BASE_URL}/api/generate",
            json={"model": "moondream", "prompt": "", "keep_alive": 0},
            timeout=10
        )
    except Exception:
        pass

def process_pdf(file_bytes: bytes, filename: str, start_vector_id: int = 0):
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    chunks = []
    metadata = []
    extracted_images = []
    
    clean_doc_prefix = "".join([c if c.isalnum() else "_" for c in filename.rsplit(".", 1)[0]])[:12]
    current_vec_id = start_vector_id
    total_pages = len(doc)

    for page_idx, page in enumerate(doc):
        page_num = page_idx + 1
        
        text = page.get_text("text").strip()
        if text:
            sub_chunks = chunk_text(text)
            for sub_idx, sc in enumerate(sub_chunks):
                chunk_id = f"{clean_doc_prefix}_P{page_num}_C{sub_idx+1}"
                chunks.append(sc)
                metadata.append({
                    "vector_id": current_vec_id,
                    "chunk_id": chunk_id,
                    "source": filename,
                    "page": page_num,
                    "type": "text"
                })
                current_vec_id += 1
            
        image_list = page.get_images(full=True)
        for img_idx, img_info in enumerate(image_list):
            xref = img_info[0]
            try:
                pix = fitz.Pixmap(doc, xref)
                if pix.width < 80 or pix.height < 80:
                    pix = None
                    continue
                
                if pix.n - pix.alpha > 3:
                    pix = fitz.Pixmap(fitz.csRGB, pix)
                
                png_bytes = pix.tobytes("png")
                pix = None
                
                img_alias = f"IMG_{clean_doc_prefix}_P{page_num}_{img_idx+1}"
                desc = describe_image_with_moondream(png_bytes)
                
                chunk_text_formatted = (
                    f"[Visual Asset ID: {img_alias} | Source: {filename} | Page: {page_num}]\n"
                    f"Visual Description: {desc}"
                )
                
                chunks.append(chunk_text_formatted)
                metadata.append({
                    "vector_id": current_vec_id,
                    "chunk_id": img_alias,
                    "source": filename,
                    "page": page_num,
                    "type": "image"
                })
                extracted_images.append({
                    "id": img_alias,
                    "source": filename,
                    "page": page_num,
                    "description": desc,
                    "image_bytes": png_bytes
                })
                current_vec_id += 1
            except Exception as e:
                print(f"Skipping unreadable image on page {page_num}: {e}")

    doc.close()
    unload_moondream()  
    gc.collect()
    
    doc_stats = {
        "Document Name": filename,
        "Total Pages": total_pages,
        "Text Chunks": sum(1 for m in metadata if m["type"] == "text"),
        "Images Analyzed": len(extracted_images),
        "Total Indexed Vectors": len(chunks),
        "Vector Index Range": f"{start_vector_id} – {current_vec_id - 1}" if chunks else "None"
    }
    
    return chunks, metadata, extracted_images, doc_stats

def build_indices(chunks: list[str]):
    if not chunks:
        return None, None
        
    embeddings = list(embed_model.embed(chunks))
    embedding_matrix = np.array(embeddings, dtype="float32")
    faiss.normalize_L2(embedding_matrix)
    
    dimension = embedding_matrix.shape[1]
    faiss_index = faiss.IndexFlatIP(dimension)
    faiss_index.add(embedding_matrix)
    
    tokenized_corpus = [chunk.lower().split() for chunk in chunks]
    bm25_index = BM25Okapi(tokenized_corpus)
    
    return faiss_index, bm25_index