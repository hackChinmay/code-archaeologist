"""SQLAlchemy database entity models for RepoMind."""
import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    ForeignKey,
    Float,
    JSON,
    Enum,
)
from sqlalchemy.orm import relationship
from backend.app.database.mysql_db import Base

class RepositoryModel(Base):
    __tablename__ = "repositories"

    id = Column(String(100), primary_key=True, index=True)
    name = Column(String(150), nullable=False, index=True)
    url = Column(String(255), nullable=False)
    owner = Column(String(100), nullable=False)
    default_branch = Column(String(50), default="main")
    status = Column(String(50), default="QUEUED")
    progress = Column(Integer, default=0)
    status_message = Column(Text, nullable=True)
    description = Column(Text, nullable=True)
    summary = Column(Text, nullable=True)
    architecture_summary = Column(Text, nullable=True)
    stats = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    files = relationship("FileModel", back_populates="repository", cascade="all, delete-orphan")
    symbols = relationship("SymbolModel", back_populates="repository", cascade="all, delete-orphan")
    dependencies = relationship("DependencyModel", back_populates="repository", cascade="all, delete-orphan")
    chunks = relationship("CodeChunkModel", back_populates="repository", cascade="all, delete-orphan")


class FileModel(Base):
    __tablename__ = "files"

    id = Column(String(120), primary_key=True, index=True)
    repository_id = Column(String(100), ForeignKey("repositories.id"), nullable=False, index=True)
    path = Column(String(300), nullable=False, index=True)
    language = Column(String(50), nullable=False)
    size = Column(Integer, default=0)
    lines_count = Column(Integer, default=0)
    content = Column(Text, nullable=True)
    file_hash = Column(String(64), nullable=True)

    repository = relationship("RepositoryModel", back_populates="files")
    symbols = relationship("SymbolModel", back_populates="file", cascade="all, delete-orphan")


class SymbolModel(Base):
    __tablename__ = "symbols"

    id = Column(String(150), primary_key=True, index=True)
    repository_id = Column(String(100), ForeignKey("repositories.id"), nullable=False, index=True)
    file_id = Column(String(120), ForeignKey("files.id"), nullable=False, index=True)
    name = Column(String(150), nullable=False, index=True)
    type = Column(String(50), nullable=False)  # class, function, method, variable, interface
    start_line = Column(Integer, nullable=False)
    end_line = Column(Integer, nullable=False)
    signature = Column(Text, nullable=True)
    docstring = Column(Text, nullable=True)
    detected_from = Column(String(50), default="Tree-sitter AST")

    repository = relationship("RepositoryModel", back_populates="symbols")
    file = relationship("FileModel", back_populates="symbols")


class DependencyModel(Base):
    __tablename__ = "dependencies"

    id = Column(String(150), primary_key=True, index=True)
    repository_id = Column(String(100), ForeignKey("repositories.id"), nullable=False, index=True)
    source = Column(String(200), nullable=False)
    target = Column(String(200), nullable=False)
    relationship_type = Column(String(50), nullable=False)  # imports, calls, inherits, depends_on
    category = Column(String(50), default="internal")       # internal, external
    source_line = Column(Integer, nullable=True)

    repository = relationship("RepositoryModel", back_populates="dependencies")


class CodeChunkModel(Base):
    __tablename__ = "code_chunks"

    id = Column(String(200), primary_key=True, index=True)
    repository_id = Column(String(100), ForeignKey("repositories.id"), nullable=False, index=True)
    file_id = Column(String(120), ForeignKey("files.id"), nullable=True)
    symbol_name = Column(String(150), nullable=True)
    symbol_type = Column(String(50), nullable=True)
    start_line = Column(Integer, nullable=False)
    end_line = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    embedding_reference = Column(String(100), nullable=True)

    repository = relationship("RepositoryModel", back_populates="chunks")


class EvaluationModel(Base):
    __tablename__ = "evaluations"

    id = Column(String(100), primary_key=True, index=True)
    repository_id = Column(String(100), ForeignKey("repositories.id"), nullable=False)
    precision_at_1 = Column(Float, default=0.0)
    precision_at_3 = Column(Float, default=0.0)
    precision_at_5 = Column(Float, default=0.0)
    recall_at_5 = Column(Float, default=0.0)
    mrr = Column(Float, default=0.0)
    faithfulness_score = Column(Float, default=0.0)
    correctness_score = Column(Float, default=0.0)
    latency_ms = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
