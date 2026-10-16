"""Pydantic request and response validation schemas."""
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, ConfigDict

class AnalyzeRequest(BaseModel):
    model_config = ConfigDict(extra="allow")

    url: Optional[str] = None
    sample_id: Optional[str] = None
    sampleId: Optional[str] = None
    github_token: Optional[str] = None
    githubToken: Optional[str] = None
    local_files: Optional[List[Dict[str, Any]]] = None
    localFiles: Optional[List[Dict[str, Any]]] = None

class SearchRequest(BaseModel):
    model_config = ConfigDict(extra="allow")

    query: str
    top_k: int = 5
    topK: Optional[int] = None

class AskRequest(BaseModel):
    model_config = ConfigDict(extra="allow")

    question: str

class DocumentationRequest(BaseModel):
    model_config = ConfigDict(extra="allow")

    scope: str = "project"  # project, folder, file, symbol
    target_path: Optional[str] = None
    targetPath: Optional[str] = None
    symbol_name: Optional[str] = None
    symbolName: Optional[str] = None

class SymbolSchema(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    name: str
    type: str
    file_path: Optional[str] = None
    filePath: Optional[str] = None
    start_line: int
    startLine: Optional[int] = None
    end_line: int
    endLine: Optional[int] = None
    signature: Optional[str] = None
    docstring: Optional[str] = None
    detected_from: str = "Tree-sitter AST"

class DependencySchema(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    source: str
    target: str
    relationship_type: Optional[str] = None
    relationshipType: Optional[str] = None
    category: str

class EvidenceSchema(BaseModel):
    model_config = ConfigDict(extra="allow")

    file_path: Optional[str] = None
    filePath: Optional[str] = None
    symbol_name: Optional[str] = None
    symbolName: Optional[str] = None
    symbol_type: Optional[str] = None
    symbolType: Optional[str] = None
    start_line: Optional[int] = None
    startLine: Optional[int] = None
    end_line: Optional[int] = None
    endLine: Optional[int] = None
    snippet: str
    retrieval_reason: Optional[str] = None
    retrievalReason: Optional[str] = None

class RAGResponseSchema(BaseModel):
    model_config = ConfigDict(extra="allow")

    question: str
    answer: str
    grounded: bool
    confidence_status: Optional[str] = None
    confidenceStatus: Optional[str] = None
    retrieved_chunks_count: Optional[int] = None
    retrievedChunksCount: Optional[int] = None
    relevant_files: Optional[List[str]] = None
    relevantFiles: Optional[List[str]] = None
    evidence: List[EvidenceSchema]
    duration_ms: Optional[float] = None
    durationMs: Optional[float] = None
