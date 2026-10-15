"""Pydantic request and response validation schemas."""
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, HttpUrl

class AnalyzeRequest(BaseModel):
    url: Optional[str] = None
    sample_id: Optional[str] = None
    github_token: Optional[str] = None

class SearchRequest(BaseModel):
    query: str
    top_k: int = 5

class AskRequest(BaseModel):
    question: str

class DocumentationRequest(BaseModel):
    scope: str = "project"  # project, folder, file, symbol
    target_path: Optional[str] = None
    symbol_name: Optional[str] = None

class SymbolSchema(BaseModel):
    id: str
    name: str
    type: str
    file_path: str
    start_line: int
    end_line: int
    signature: Optional[str] = None
    docstring: Optional[str] = None
    detected_from: str = "Tree-sitter AST"

class DependencySchema(BaseModel):
    id: str
    source: str
    target: str
    relationship_type: str
    category: str

class EvidenceSchema(BaseModel):
    file_path: str
    symbol_name: str
    symbol_type: str
    start_line: int
    end_line: int
    snippet: str
    retrieval_reason: str

class RAGResponseSchema(BaseModel):
    question: str
    answer: str
    grounded: bool
    confidence_status: str
    retrieved_chunks_count: int
    relevant_files: List[str]
    evidence: List[EvidenceSchema]
    duration_ms: float
