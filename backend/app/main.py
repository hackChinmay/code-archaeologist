"""RepoMind FastAPI Main Application.
Official backend providing Tree-sitter AST parsing, ChromaDB vector indexing,
LangChain RAG, and Google Gemini code intelligence.
"""
import os
import time
import logging
from typing import List, Dict, Any, Optional

from fastapi import FastAPI, HTTPException, Depends, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from backend.app.database.mysql_db import get_db, SessionLocal
from backend.app.rag.chroma_service import ChromaService
from backend.app.rag.rag_service import RAGService
from backend.app.services.repository_service import RepositoryService
from backend.app.services.documentation_service import DocumentationService
from backend.app.services.evaluation_service import EvaluationService
from backend.app.schemas.pydantic_schemas import (
    AnalyzeRequest,
    SearchRequest,
    AskRequest,
    DocumentationRequest,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("repomind.api")

app = FastAPI(
    title="RepoMind Backend API",
    description="Official Python FastAPI Backend for RepoMind: AI-Powered Codebase Understanding and Software Analysis Platform.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Singletons for service layer
chroma_service = ChromaService()
rag_service = RAGService(chroma_service=chroma_service)
repo_service = RepositoryService(chroma_service=chroma_service)
doc_service = DocumentationService(chroma_service=chroma_service)
eval_service = EvaluationService(chroma_service=chroma_service)


@app.on_event("startup")
def startup_event():
    """Seed initial repository if empty so user has an immediately explorable codebase."""
    db = SessionLocal()
    try:
        repos = repo_service.list_repositories(db)
        if not repos:
            logger.info("Database empty on startup; seeding sample repository 'repo-python-fastapi'...")
            repo_service.analyze_repository(db=db, sample_id="repo-python-fastapi")
            logger.info("Sample repository successfully indexed into ChromaDB and SQLite/MySQL.")
    except Exception as exc:
        logger.error(f"Startup initialization error: {exc}")
    finally:
        db.close()


@app.get("/health")
def health():
    """System health check reporting active service components."""
    return {
        "status": "healthy",
        "service": "repomind-fastapi",
        "database": "SQLAlchemy (SQLite / MySQL)",
        "vector_store": "ChromaDB",
        "parser": "Tree-sitter AST",
        "rag": "LangChain + Google Gemini 3.8 Flash",
        "timestamp": time.time(),
    }


# ----------------------------------------------------------------------
# Repository Ingestion & Management
# ----------------------------------------------------------------------

@app.get("/api/repositories")
def list_repositories(db: Session = Depends(get_db)):
    """List all analyzed repositories."""
    return repo_service.list_repositories(db)


@app.post("/api/repositories/analyze")
def analyze_repository(req: AnalyzeRequest, db: Session = Depends(get_db)):
    """
    Ingest and analyze repository from GitHub URL, local directory, or sample ID.
    Performs Tree-sitter parsing, dependency extraction, chunking, and ChromaDB indexing.
    """
    try:
        url = req.url
        sample_id = req.sample_id or getattr(req, "sampleId", None)
        github_token = req.github_token or getattr(req, "githubToken", None)
        local_files = getattr(req, "local_files", None) or getattr(req, "localFiles", None)

        repo = repo_service.analyze_repository(
            db=db,
            url=url,
            sample_id=sample_id,
            local_files=local_files,
            github_token=github_token,
        )
        return repo
    except Exception as exc:
        logger.error(f"Analysis failed: {exc}", exc_info=True)
        raise HTTPException(status_code=400, detail=str(exc))


@app.get("/api/repositories/{repo_id}")
def get_repository(repo_id: str, db: Session = Depends(get_db)):
    """Get repository metadata and statistics."""
    repo = repo_service.get_repository(repo_id, db)
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
    return repo


@app.get("/api/repositories/{repo_id}/status")
def get_repository_status(repo_id: str, db: Session = Depends(get_db)):
    """Get current processing status."""
    repo = repo_service.get_repository(repo_id, db)
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
    return {
        "id": repo["id"],
        "status": repo["status"],
        "progress": repo["progress"],
        "message": repo["statusMessage"],
        "stats": repo.get("stats", {}),
    }


@app.get("/api/repositories/{repo_id}/files")
def get_repository_files(repo_id: str, db: Session = Depends(get_db)):
    """Fetch all source files and extracted AST symbols."""
    return repo_service.get_files(repo_id, db)


@app.get("/api/repositories/{repo_id}/files/{file_id:path}")
def get_repository_file(repo_id: str, file_id: str, db: Session = Depends(get_db)):
    """Fetch single source file content and metadata."""
    f = repo_service.get_file(repo_id, file_id, db)
    if not f:
        raise HTTPException(status_code=404, detail="File not found")
    return f


@app.get("/api/repositories/{repo_id}/architecture")
def get_repository_architecture(repo_id: str, db: Session = Depends(get_db)):
    """Generate Directed Acyclic Graph (DAG) for ArchitectureView."""
    return repo_service.get_architecture(repo_id, db)


@app.get("/api/repositories/{repo_id}/dependencies")
def get_repository_dependencies(repo_id: str, db: Session = Depends(get_db)):
    """Fetch internal and external dependency links."""
    return repo_service.get_dependencies(repo_id, db)


# ----------------------------------------------------------------------
# Semantic Search, LangChain RAG & Documentation
# ----------------------------------------------------------------------

@app.post("/api/repositories/{repo_id}/search")
def semantic_search(repo_id: str, req: SearchRequest, db: Session = Depends(get_db)):
    """Retrieve top-K semantic code chunks from ChromaDB."""
    query = req.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query parameter required")

    chunks = chroma_service.similarity_search(repo_id, query, top_k=req.top_k)
    return {
        "query": query,
        "totalResults": len(chunks),
        "results": [
            {
                "chunk": c,
                "score": c.get("similarity_score", 0.8),
                "explanation": f"Matched in {c['symbol_name']} ({c['file_path']})",
            }
            for c in chunks
        ],
    }


@app.post("/api/repositories/{repo_id}/ask")
def ask_question(repo_id: str, req: AskRequest, db: Session = Depends(get_db)):
    """
    Execute LangChain RAG pipeline with Google Gemini 3.8 Flash.
    Returns grounded answer accompanied by verifiable evidence cards.
    """
    repo = repo_service.get_repository(repo_id, db)
    repo_name = repo["name"] if repo else repo_id
    question = req.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    return rag_service.ask(repository_id=repo_id, repo_name=repo_name, question=question)


@app.post("/api/repositories/{repo_id}/documentation")
def generate_documentation(repo_id: str, req: DocumentationRequest, db: Session = Depends(get_db)):
    """Generate technical documentation using code chunks and Gemini."""
    repo = repo_service.get_repository(repo_id, db)
    repo_name = repo["name"] if repo else repo_id
    target = req.target_path or req.symbol_name

    return doc_service.generate_documentation(
        repository_id=repo_id,
        repo_name=repo_name,
        scope=req.scope,
        target=target,
    )


# ----------------------------------------------------------------------
# Academic Evaluation Metrics
# ----------------------------------------------------------------------

@app.get("/api/repositories/{repo_id}/evaluation")
def get_evaluation(repo_id: str, db: Session = Depends(get_db)):
    """
    Return empirical retrieval metrics (MRR, P@1, P@3, P@5, Latency) calculated live against ChromaDB.
    Un-evaluated subjective metrics are returned as 'Evaluation Pending' with zero fabricated numbers.
    """
    try:
        return eval_service.get_evaluation_metrics(repo_id, db)
    except Exception as exc:
        logger.error(f"Evaluation error: {exc}")
        raise HTTPException(status_code=404, detail=str(exc))


@app.post("/api/repositories/{repo_id}/evaluation/measure")
def measure_benchmark(repo_id: str, payload: Dict[str, Any], db: Session = Depends(get_db)):
    """Live benchmark probe measuring latency, hit rank, and retrieved files."""
    query = payload.get("customQuery") or payload.get("query") or "Where is authentication handled?"
    expected = payload.get("expectedFile")
    return eval_service.measure_single_query(repo_id, query, expected)
