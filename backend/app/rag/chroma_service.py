"""ChromaDB vector store integration managing repository-segregated dense vector collections."""
import os
import logging
from typing import List, Dict, Any, Optional

import gc
from backend.app.rag.embeddings import EmbeddingService, RepoMindEmbeddingFunction

logger = logging.getLogger("code_archaeologist.chroma")

try:
    import chromadb
    CHROMA_AVAILABLE = True
except Exception as exc:
    logger.error(f"ChromaDB library unavailable: {exc}")
    CHROMA_AVAILABLE = False


class ChromaService:
    """Manages ChromaDB collections, vector embeddings, and similarity queries with strict memory boundaries."""

    def __init__(self, persist_directory: Optional[str] = None):
        persist_dir = persist_directory or os.getenv("CHROMA_PERSIST_DIR") or os.getenv("CHROMA_DATA_DIR") or "./chroma_data"
        self.persist_directory = persist_dir
        self.client = None
        self.embedding_service = EmbeddingService()
        self.embedding_function = RepoMindEmbeddingFunction(self.embedding_service)

        if CHROMA_AVAILABLE:
            try:
                host = os.getenv("CHROMA_HOST")
                port = os.getenv("CHROMA_PORT")
                ssl_env = os.getenv("CHROMA_SSL", "false").lower() in ("true", "1", "yes")
                auth_token = os.getenv("CHROMA_AUTH_TOKEN") or os.getenv("CHROMA_API_KEY")
                headers = {"Authorization": f"Bearer {auth_token}"} if auth_token else None

                if host:
                    clean_host = host.strip()
                    if clean_host.startswith("https://"):
                        clean_host = clean_host.replace("https://", "")
                        ssl_env = True
                    elif clean_host.startswith("http://"):
                        clean_host = clean_host.replace("http://", "")

                    target_port = int(port) if port else (443 if ssl_env else 8000)
                    self.client = chromadb.HttpClient(
                        host=clean_host,
                        port=target_port,
                        ssl=ssl_env,
                        headers=headers,
                    )
                    logger.info(f"Connected to remote ChromaDB at {clean_host}:{target_port} (ssl={ssl_env})")
                else:
                    os.makedirs(self.persist_directory, exist_ok=True)
                    self.client = chromadb.PersistentClient(path=self.persist_directory)
                    logger.info(f"ChromaDB persistent client initialized at {self.persist_directory}")
            except Exception as e:
                logger.warning(f"Persistent ChromaDB initialization failed ({e}); using in-process client.")
                self.client = chromadb.Client()

    def _get_collection_name(self, repository_id: str) -> str:
        """Format safe collection name for ChromaDB."""
        safe_id = repository_id.replace("-", "_").replace("/", "_").replace(".", "_")
        return f"repo_{safe_id}"[:63]

    def reset_collection(self, repository_id: str):
        """Re-create collection to guarantee clean state and repository isolation."""
        if not self.client:
            return None
        col_name = self._get_collection_name(repository_id)
        try:
            self.client.delete_collection(name=col_name)
        except Exception:
            pass
        return self.client.get_or_create_collection(
            name=col_name,
            metadata={"repository_id": repository_id},
            embedding_function=self.embedding_function,
        )

    def add_chunks_batch(self, repository_id: str, chunks: List[Dict[str, Any]]) -> int:
        """Add a batch of code chunks directly to ChromaDB without global memory pooling."""
        if not self.client or not chunks:
            return 0

        col_name = self._get_collection_name(repository_id)
        collection = self.client.get_or_create_collection(
            name=col_name,
            metadata={"repository_id": repository_id},
            embedding_function=self.embedding_function,
        )

        batch_size = 20
        for i in range(0, len(chunks), batch_size):
            batch = chunks[i:i + batch_size]
            ids = [c["id"] for c in batch]
            docs = [
                f"{c.get('symbol_name') or c.get('symbolName', '')} in {c.get('file_path') or c.get('filePath', '')} ({c.get('language', '')}):\n{c.get('content', '')}"
                for c in batch
            ]
            metadatas = [
                {
                    "repository_id": repository_id,
                    "file_path": c.get("file_path") or c.get("filePath", ""),
                    "file_id": str(c.get("file_id") or c.get("fileId", "")),
                    "symbol_name": str(c.get("symbol_name") or c.get("symbolName", "")),
                    "symbol_type": str(c.get("symbol_type") or c.get("symbolType", "")),
                    "language": str(c.get("language", "")),
                    "start_line": int(c.get("start_line") or c.get("startLine", 1)),
                    "end_line": int(c.get("end_line") or c.get("endLine", 1)),
                }
                for c in batch
            ]
            try:
                if hasattr(collection, "upsert"):
                    collection.upsert(ids=ids, documents=docs, metadatas=metadatas)
                else:
                    collection.add(ids=ids, documents=docs, metadatas=metadatas)
            except Exception as e:
                logger.warning(f"ChromaDB batch insertion fallback on error ({e}); using individual upserts.")
                for b_id, b_doc, b_meta in zip(ids, docs, metadatas):
                    try:
                        if hasattr(collection, "upsert"):
                            collection.upsert(ids=[b_id], documents=[b_doc], metadatas=[b_meta])
                        else:
                            collection.add(ids=[b_id], documents=[b_doc], metadatas=[b_meta])
                    except Exception:
                        pass
            del ids, docs, metadatas, batch

        return len(chunks)

    def index_chunks(self, repository_id: str, chunks: List[Dict[str, Any]]) -> int:
        """Store code chunks in a repository-segregated ChromaDB collection using streaming batches."""
        if not self.client or not chunks:
            return 0

        self.reset_collection(repository_id)
        count = self.add_chunks_batch(repository_id, chunks)
        col_name = self._get_collection_name(repository_id)
        logger.info(f"Successfully indexed {count} code chunks into ChromaDB collection {col_name}")
        gc.collect()
        return count

    def similarity_search(
        self,
        repository_id: str,
        query: str,
        top_k: int = 5,
    ) -> List[Dict[str, Any]]:
        """
        Retrieve top-K semantic code chunks for a query from repository collection.
        Guarantees isolation by querying solely the repository-specific collection.
        """
        if not self.client:
            return []

        col_name = self._get_collection_name(repository_id)
        try:
            collection = self.client.get_collection(
                name=col_name,
                embedding_function=self.embedding_function,
            )
            count = collection.count()
            if count == 0:
                return []

            results = collection.query(
                query_texts=[query],
                n_results=min(top_k, count),
            )

            retrieved: List[Dict[str, Any]] = []
            if results and "documents" in results and results["documents"]:
                for idx, doc in enumerate(results["documents"][0]):
                    meta = results["metadatas"][0][idx] if "metadatas" in results and results["metadatas"] else {}
                    distance = results["distances"][0][idx] if "distances" in results and results["distances"] else 0.0
                    chunk_id = results["ids"][0][idx] if "ids" in results and results["ids"] else ""

                    content_parts = doc.split(":\n", 1)
                    raw_content = content_parts[1] if len(content_parts) > 1 else doc

                    fp = meta.get("file_path", "")
                    sym_name = meta.get("symbol_name", "")
                    sym_type = meta.get("symbol_type", "")
                    start_l = int(meta.get("start_line", 1))
                    end_l = int(meta.get("end_line", 1))
                    lang = meta.get("language", "")
                    sim_score = round(max(0.0, 1.0 - (distance / 2.0)), 3)

                    retrieved.append({
                        "id": chunk_id,
                        # Both snake_case and camelCase for seamless frontend & backend compatibility
                        "file_path": fp,
                        "filePath": fp,
                        "symbol_name": sym_name,
                        "symbolName": sym_name,
                        "symbol_type": sym_type,
                        "symbolType": sym_type,
                        "language": lang,
                        "start_line": start_l,
                        "startLine": start_l,
                        "end_line": end_l,
                        "endLine": end_l,
                        "content": raw_content,
                        "similarity_score": sim_score,
                        "similarityScore": sim_score,
                        "distance": round(distance, 4),
                    })

            return retrieved
        except Exception as e:
            logger.warning(f"ChromaDB search failed on collection {col_name} ({e})")
            return []
