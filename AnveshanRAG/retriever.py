import numpy as np
import faiss
from flashrank import Ranker, RerankRequest
# Import the existing embedding model to prevent duplicate RAM allocation
from ingestion import embed_model

ranker = Ranker(model_name="ms-marco-TinyBERT-L-2-v2")

def get_hybrid_candidates(
    query: str,
    faiss_index,
    bm25_index,
    chunks: list[str],
    metadata: list[dict],
    target_doc: str = "All Documents",
    top_k: int = 8
) -> list[dict]:
    candidates = {}
    total_chunks = len(chunks)
    if total_chunks == 0:
        return []

    # 1. Dense Retrieval (FAISS Cosine Similarity)
    search_k = min(total_chunks, max(top_k * 4, 25))
    query_embedding = list(embed_model.embed([query]))[0]
    query_matrix = np.array([query_embedding], dtype="float32")
    faiss.normalize_L2(query_matrix)

    dense_scores, dense_indices = faiss_index.search(query_matrix, search_k)
    
    dense_added = 0
    for score, idx in zip(dense_scores[0], dense_indices[0]):
        if idx == -1:
            continue
        meta = metadata[idx]
        if target_doc != "All Documents" and meta["source"] != target_doc:
            continue
            
        candidates[int(idx)] = {
            "id": int(idx),
            "text": chunks[idx],
            "meta": meta,
            "dense_score": float(max(0.0, score)),
            "bm25_score": 0.0,
            "retrieval_source": "dense"
        }
        dense_added += 1
        if dense_added >= top_k:
            break

    # 2. Sparse Retrieval (BM25)
    tokenized_query = [t for t in query.lower().split() if len(t) > 1]
    bm25_scores = bm25_index.get_scores(tokenized_query) if tokenized_query else np.zeros(total_chunks)
    max_bm25 = float(np.max(bm25_scores)) if len(bm25_scores) > 0 and np.max(bm25_scores) > 0 else 1.0
    bm25_top_indices = np.argsort(bm25_scores)[::-1]
    
    bm25_added = 0
    for idx in bm25_top_indices:
        idx = int(idx)
        meta = metadata[idx]
        if target_doc != "All Documents" and meta["source"] != target_doc:
            continue
            
        norm_bm25 = float(bm25_scores[idx]) / max_bm25 if max_bm25 > 0 else 0.0
        exact_id_match = meta["chunk_id"].lower() in query.lower()

        if bm25_scores[idx] > 0 or exact_id_match:
            if idx in candidates:
                candidates[idx]["retrieval_source"] = "hybrid"
                candidates[idx]["bm25_score"] = norm_bm25
            else:
                try:
                    chunk_vec = faiss_index.reconstruct(idx)
                    actual_dense = float(np.dot(query_matrix[0], chunk_vec))
                except Exception:
                    actual_dense = 0.50
                    
                candidates[idx] = {
                    "id": idx,
                    "text": chunks[idx],
                    "meta": meta,
                    "dense_score": max(0.0, actual_dense),
                    "bm25_score": 1.0 if exact_id_match else norm_bm25,
                    "retrieval_source": "sparse"
                }
            bm25_added += 1
            if bm25_added >= top_k:
                break

    return list(candidates.values())

def retrieve_and_rerank(
    query: str,
    faiss_index,
    bm25_index,
    chunks: list[str],
    metadata: list[dict],
    target_doc: str = "All Documents",
    top_k: int = 8,
    threshold: float = 0.60,
    max_passages: int = 4
) -> tuple[list[dict], float, bool]:
    passages = get_hybrid_candidates(query, faiss_index, bm25_index, chunks, metadata, target_doc, top_k)
    if not passages:
        return [], 0.0, False

    rerank_request = RerankRequest(query=query, passages=passages)
    reranked_results = ranker.rerank(rerank_request)

    scored_candidates = []
    for res in reranked_results:
        raw_ce = float(res.get("score", 0.0))
        
        if raw_ce < 0 or raw_ce > 1.0:
            ce_prob = float(1 / (1 + np.exp(-(raw_ce + 1.5))))
        else:
            ce_prob = float(np.sqrt(max(0.0, raw_ce)))

        dense_raw = float(res.get("dense_score", 0.5))
        dense_prob = min(1.0, max(0.0, (dense_raw - 0.35) / 0.45))

        bm25_prob = float(res.get("bm25_score", 0.0))
        chunk_id_lower = res["meta"]["chunk_id"].lower()
        
        if chunk_id_lower in query.lower():
            chunk_conf = max(0.95, ce_prob)
        else:
            blended = (0.50 * ce_prob) + (0.35 * dense_prob) + (0.15 * bm25_prob)
            chunk_conf = max(blended, dense_prob * 0.90, ce_prob * 0.95)

        res["confidence"] = round(min(0.99, max(0.01, chunk_conf)), 4)
        scored_candidates.append(res)

    scored_candidates.sort(key=lambda x: x["confidence"], reverse=True)

    qualifying_chunks = [c for c in scored_candidates if c["confidence"] >= threshold]
    qualifying_chunks = qualifying_chunks[:max_passages]

    if qualifying_chunks:
        if len(qualifying_chunks) == 1:
            aggregated_confidence = qualifying_chunks[0]["confidence"]
        else:
            top_score = qualifying_chunks[0]["confidence"]
            supporting_avg = sum(c["confidence"] for c in qualifying_chunks[1:]) / len(qualifying_chunks[1:])
            aggregated_confidence = (0.60 * top_score) + (0.40 * supporting_avg)
            
        return qualifying_chunks, round(aggregated_confidence, 2), True
    else:
        near_misses = scored_candidates[:2]
        best_score = scored_candidates[0]["confidence"] if scored_candidates else 0.0
        return near_misses, round(best_score, 2), False