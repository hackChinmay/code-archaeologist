"""RepoMind FastAPI Main Application.
Official backend providing Tree-sitter AST parsing, ChromaDB vector indexing,
LangChain RAG, and Google Gemini code intelligence.
"""
import sys
from pathlib import Path

# Ensure project root is in sys.path so 'backend.app...' imports work regardless of execution directory
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import os
import time
import logging
from typing import List, Dict, Any, Optional

from fastapi import FastAPI, HTTPException, Depends, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from backend.app.database.mysql_db import get_db, SessionLocal, engine
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

import gc
from fastapi.responses import JSONResponse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("repomind.api")

app = FastAPI(
    title="RepoMind Backend API",
    description="Official Python FastAPI Backend for RepoMind: AI-Powered Codebase Understanding and Software Analysis Platform.",
    version="1.0.0",
)

# CORS Configuration
# Reads allowed origins from environment variable ALLOWED_ORIGINS or FRONTEND_URL.
# Multiple comma-separated origins can be specified for staging and production domains.
allowed_origins_env = os.getenv("ALLOWED_ORIGINS") or os.getenv("FRONTEND_URL")
if allowed_origins_env:
    allowed_origins = [o.strip() for o in allowed_origins_env.split(",") if o.strip()]
else:
    allowed_origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

allow_all_origins = "*" in allowed_origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"^https://.*\.vercel\.app$" if not allow_all_origins else None,
    allow_credentials=not allow_all_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _get_cors_headers(request: Request) -> Dict[str, str]:
    """Ensure CORS headers are appended to error responses for Vercel frontend connectivity."""
    headers = {}
    origin = request.headers.get("origin")
    if allow_all_origins:
        headers["Access-Control-Allow-Origin"] = "*"
    elif origin:
        # If an origin is sent by the browser (local, Vercel preview/production, or custom domain), echo it back
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
        headers["Access-Control-Allow-Headers"] = "*"
        headers["Access-Control-Allow-Methods"] = "*"
    elif allowed_origins and allowed_origins[0] != "*":
        headers["Access-Control-Allow-Origin"] = allowed_origins[0]
        headers["Access-Control-Allow-Credentials"] = "true"
        headers["Access-Control-Allow-Headers"] = "*"
        headers["Access-Control-Allow-Methods"] = "*"
    return headers


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    cors_headers = _get_cors_headers(request)
    if exc.headers:
        cors_headers.update(exc.headers)
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=cors_headers,
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled server error on {request.url}: {exc}", exc_info=True)
    cors_headers = _get_cors_headers(request)
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {str(exc)}"},
        headers=cors_headers,
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
            logger.info("Sample repository successfully indexed into ChromaDB and database.")
    except Exception as exc:
        logger.error(f"Startup initialization error: {exc}")
    finally:
        db.close()
        gc.collect()


@app.get("/")
def root():
    """Root endpoint providing service metadata and discovery links."""
    return {
        "service": "Code Archaeologist / RepoMind API",
        "status": "healthy",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
        "endpoints": {
            "repositories": "/api/repositories",
            "analyze": "/api/repositories/analyze",
        },
    }


@app.get("/health")
def health():
    """System health check reporting active service components."""
    db_status = "connected"
    try:
        with engine.connect() as conn:
            pass
    except Exception:
        db_status = "degraded"

    chroma_status = "available" if (chroma_service and chroma_service.client) else "unavailable"
    gemini_status = bool(os.getenv("GEMINI_API_KEY", "").strip())

    return {
        "status": "healthy" if db_status == "connected" else "degraded",
        "service": "repomind-fastapi",
        "database": db_status,
        "vector_store": chroma_status,
        "parser": "Tree-sitter AST",
        "gemini_configured": gemini_status,
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
        sample_id = req.sample_id or req.sampleId
        github_token = req.github_token or req.githubToken
        local_files = req.local_files or req.localFiles

        repo = repo_service.analyze_repository(
            db=db,
            url=url,
            sample_id=sample_id,
            local_files=local_files,
            github_token=github_token,
        )
        return repo
    except HTTPException:
        db.rollback()
        raise
    except ValueError as exc:
        db.rollback()
        logger.warning(f"Validation error during analysis: {exc}")
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        db.rollback()
        logger.error(f"Analysis failed: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(exc)}")


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


@app.get("/api/repositories/{repo_id}/symbols")
def get_repository_symbols(repo_id: str, db: Session = Depends(get_db)):
    """Fetch all extracted AST symbols across the repository."""
    return repo_service.get_symbols(repo_id, db)


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

    top_k = req.top_k or req.topK or 5
    chunks = chroma_service.similarity_search(repo_id, query, top_k=top_k)
    return {
        "query": query,
        "totalResults": len(chunks),
        "results": [
            {
                "chunk": c,
                "score": c.get("similarityScore") or c.get("similarity_score", 0.8),
                "explanation": f"Matched in {c.get('symbolName') or c.get('symbol_name', 'code')} ({c.get('filePath') or c.get('file_path', '')})",
            }
            for c in chunks
        ],
    }


@app.post("/api/repositories/{repo_id}/ask")
def ask_question(repo_id: str, req: AskRequest, db: Session = Depends(get_db)):
    """
    Execute LangChain RAG pipeline with Google Gemini.
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
    target = req.target_path or req.targetPath or req.symbol_name or req.symbolName

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


if __name__ == "__main__":
    import uvicorn
    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", 8000))
    logger.info(f"Starting server on {host}:{port}")
    uvicorn.run("backend.app.main:app", host=host, port=port, reload=False)
