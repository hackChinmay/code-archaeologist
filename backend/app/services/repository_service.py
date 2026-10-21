"""Repository ingestion and analysis orchestration service using Tree-sitter, ChromaDB, and SQLAlchemy."""
import os
import json
import time
import base64
import logging
import requests
import io
import zipfile
import gc
from typing import List, Dict, Any, Optional, Set, Tuple
from fastapi import HTTPException
from sqlalchemy.orm import Session

from backend.app.database.mysql_db import Base, engine
from backend.app.models.entities import (
    RepositoryModel,
    FileModel,
    SymbolModel,
    DependencyModel,
    CodeChunkModel,
)
from backend.app.analyzers.tree_sitter_parser import TreeSitterParser
from backend.app.analyzers.static_analyzer import StaticAnalyzer
from backend.app.analyzers.code_chunker import CodeChunker
from backend.app.rag.chroma_service import ChromaService

logger = logging.getLogger("code_archaeologist.repo_service")

# Auto-create all tables in the configured database (SQLite or MySQL)
Base.metadata.create_all(bind=engine)

# Configurable limits from environment
DEFAULT_MAX_REPO_FILES = 60
DEFAULT_MAX_FILE_SIZE_BYTES = 256 * 1024  # 256 KB per file
DEFAULT_MAX_REPO_TOTAL_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB total repo


def get_max_repo_files() -> int:
    """Fetch configured maximum repository files limit from environment."""
    return int(os.getenv("MAX_REPO_FILES", str(DEFAULT_MAX_REPO_FILES)))


def get_max_file_size() -> int:
    """Fetch configured maximum file size in bytes from environment."""
    return int(os.getenv("MAX_FILE_SIZE_BYTES", str(DEFAULT_MAX_FILE_SIZE_BYTES)))


def get_max_repo_total_size() -> int:
    """Fetch configured maximum repository total size in bytes from environment."""
    return int(os.getenv("MAX_REPO_TOTAL_SIZE_BYTES", str(DEFAULT_MAX_REPO_TOTAL_SIZE_BYTES)))


# Module-level aliases for direct access and backwards compatibility
MAX_REPO_FILES = get_max_repo_files()
MAX_FILE_SIZE_BYTES = get_max_file_size()
MAX_REPO_TOTAL_SIZE_BYTES = get_max_repo_total_size()

IGNORED_DIRECTORIES = {
    # Version control
    ".git", ".github", ".svn", ".hg", ".bzr",
    # Package managers & dependencies
    "node_modules", "bower_components", "vendor", "gems", "pods",
    ".yarn", ".pnpm-store", ".npm",
    # Virtual environments
    ".venv", "venv", "env", ".env", "virtualenv", "site-packages",
    # Build & distribution output
    "dist", "build", "out", "target", "bin", "obj", ".output", ".next", ".nuxt", ".turbo",
    ".parcel-cache", ".cache", "release",
    # Python cache & tooling
    "__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache", ".tox", ".eggs",
    # IDEs & editors
    ".idea", ".vscode", ".vs",
    # Testing & coverage
    "coverage", ".nyc_output",
    # Application runtime data & temporary folders
    "chroma_data", "tmp", "temp", ".serverless", ".terraform",
}

IGNORED_FILE_NAMES = {
    # Lockfiles
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "composer.lock",
    "cargo.lock", "poetry.lock", "gemfile.lock", "mix.lock", "pipfile.lock",
    "bun.lockb", "flake.lock",
    # Environment & secrets files
    ".env", ".env.local", ".env.production", ".env.development",
    # Git & config files without code
    ".gitignore", ".gitattributes", ".gitmodules",
    ".dockerignore", ".editorconfig", ".npmignore",
    # License & legal files
    "license", "license.txt", "license.md", "licence",
}

IGNORED_EXTENSIONS = {
    # Binaries & compiled artifacts
    ".exe", ".dll", ".so", ".dylib", ".class", ".jar", ".war", ".ear",
    ".pyc", ".pyd", ".pyo", ".bin", ".dat", ".wasm", ".iso",
    ".db", ".sqlite", ".sqlite3", ".o", ".a", ".lib",
    # Images & Media
    ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg", ".webp", ".avif", ".bmp", ".tiff",
    ".mp3", ".wav", ".ogg", ".flac", ".mp4", ".mov", ".avi", ".mkv", ".webm",
    # Compressed archives
    ".zip", ".tar", ".gz", ".tgz", ".7z", ".rar", ".bz2", ".xz", ".zst",
    # Web fonts
    ".woff", ".woff2", ".ttf", ".eot", ".otf",
    # Documents
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    # Sourcemaps
    ".map",
}

SUPPORTED_CODE_EXTENSIONS = {
    ".py", ".ts", ".tsx", ".js", ".jsx", ".java", ".go", ".rs",
    ".c", ".cpp", ".cc", ".cxx", ".h", ".hpp", ".cs", ".rb",
    ".php", ".swift", ".kt", ".scala", ".sql", ".html", ".css",
    ".scss", ".json", ".yaml", ".yml", ".md", ".toml", ".xml", ".sh",
}


def is_eligible_file(path: str, size: Optional[int] = None, content: Optional[str] = None) -> Tuple[bool, Optional[str]]:
    """Determine whether a file path/size/content should be parsed and indexed.
    Filters out .git, node_modules, build output, virtual environments, binaries, lockfiles, and oversized files.
    """
    normalized_path = path.replace("\\", "/").strip().lstrip("/")
    parts = normalized_path.split("/")
    filename = parts[-1].lower() if parts else ""
    effective_max_file_size = get_max_file_size()

    # 1. Directory exclusion
    for part in parts[:-1]:
        part_clean = part.strip()
        if part_clean.lower() in IGNORED_DIRECTORIES or part_clean.startswith("."):
            return False, f"ignored directory: {part}"

    # 2. Specific lockfile and generated file exclusion
    if filename in IGNORED_FILE_NAMES:
        return False, f"ignored lockfile: {filename}"

    # 3. Minified / bundled assets exclusion
    if (
        filename.endswith(".min.js")
        or filename.endswith(".min.css")
        or filename.endswith(".bundle.js")
        or filename.endswith(".bundle.css")
        or filename.endswith(".chunk.js")
        or filename.endswith(".chunk.css")
        or filename.endswith(".min.map")
        or filename.endswith(".map")
    ):
        return False, "minified/bundled asset"

    # 4. Extension validation
    base, ext = os.path.splitext(filename)
    ext = ext.lower()
    if ext in IGNORED_EXTENSIONS:
        return False, f"ignored file extension: {ext}"

    if ext not in SUPPORTED_CODE_EXTENSIONS:
        return False, f"unsupported file extension: {ext}"

    # 5. File size boundary check
    if size is not None and size > effective_max_file_size:
        return False, f"file size {size} exceeds max {effective_max_file_size} bytes"

    # 6. Binary content check (null bytes)
    if content is not None:
        if "\x00" in content:
            return False, "binary content detected"
        if len(content.encode("utf-8", errors="ignore")) > effective_max_file_size:
            return False, f"content exceeds max {effective_max_file_size} bytes"

    return True, None


class RepositoryService:
    """Coordinates repository cloning, file scanning, AST parsing, chunking, and vector indexing."""

    def __init__(self, chroma_service: ChromaService):
        self.chroma_service = chroma_service
        self.parser = TreeSitterParser()
        self.static_analyzer = StaticAnalyzer()
        self.chunker = CodeChunker()

    def list_repositories(self, db: Session) -> List[Dict[str, Any]]:
        """Return all analyzed repositories."""
        repos = db.query(RepositoryModel).all()
        result = []
        for r in repos:
            result.append(self._repo_to_dict(r))
        return result

    def get_repository(self, repo_id: str, db: Session) -> Optional[Dict[str, Any]]:
        """Fetch single repository metadata by ID."""
        repo = db.query(RepositoryModel).filter(RepositoryModel.id == repo_id).first()
        return self._repo_to_dict(repo) if repo else None

    def get_files(self, repo_id: str, db: Session) -> List[Dict[str, Any]]:
        """Fetch all files belonging to a repository."""
        files = db.query(FileModel).filter(FileModel.repository_id == repo_id).all()
        all_symbols = db.query(SymbolModel).filter(SymbolModel.repository_id == repo_id).all()
        symbols_by_file: Dict[str, List[SymbolModel]] = {}
        for s in all_symbols:
            symbols_by_file.setdefault(s.file_id, []).append(s)

        res = []
        for f in files:
            symbols = symbols_by_file.get(f.id, [])
            res.append({
                "id": f.id,
                "repositoryId": f.repository_id,
                "path": f.path,
                "name": os.path.basename(f.path),
                "language": f.language,
                "size": f.size,
                "linesCount": f.lines_count,
                "content": f.content,
                "symbolsCount": len(symbols),
                "symbols": [
                    {
                        "id": s.id,
                        "name": s.name,
                        "type": s.type,
                        "startLine": s.start_line,
                        "endLine": s.end_line,
                        "signature": s.signature,
                        "docstring": s.docstring,
                    }
                    for s in symbols
                ],
            })
        return res

    def get_file(self, repo_id: str, file_path_or_id: str, db: Session) -> Optional[Dict[str, Any]]:
        """Fetch a specific file by path or ID."""
        f = (
            db.query(FileModel)
            .filter(
                FileModel.repository_id == repo_id,
                (FileModel.id == file_path_or_id) | (FileModel.path == file_path_or_id),
            )
            .first()
        )
        if not f:
            return None
        symbols = db.query(SymbolModel).filter(SymbolModel.file_id == f.id).all()
        sym_list = [
            {
                "id": s.id,
                "fileId": s.file_id,
                "filePath": f.path,
                "name": s.name,
                "type": s.type,
                "startLine": s.start_line,
                "endLine": s.end_line,
                "signature": s.signature,
                "docstring": s.docstring,
                "detectedFrom": s.detected_from or "Tree-sitter AST",
            }
            for s in symbols
        ]
        file_dict = {
            "id": f.id,
            "repositoryId": f.repository_id,
            "path": f.path,
            "name": os.path.basename(f.path),
            "language": f.language,
            "size": f.size,
            "linesCount": f.lines_count,
            "content": f.content,
            "symbolsCount": len(symbols),
            "symbols": sym_list,
        }
        return {
            "file": file_dict,
            "symbols": sym_list,
            **file_dict,
        }

    def get_symbols(self, repo_id: str, db: Session) -> List[Dict[str, Any]]:
        """Fetch all AST symbols extracted for repository."""
        symbols = (
            db.query(SymbolModel, FileModel.path)
            .join(FileModel, SymbolModel.file_id == FileModel.id)
            .filter(SymbolModel.repository_id == repo_id)
            .all()
        )
        return [
            {
                "id": s.id,
                "fileId": s.file_id,
                "filePath": file_path,
                "name": s.name,
                "type": s.type,
                "startLine": s.start_line,
                "endLine": s.end_line,
                "signature": s.signature,
                "docstring": s.docstring,
                "detectedFrom": s.detected_from or "Tree-sitter AST",
            }
            for s, file_path in symbols
        ]

    def get_dependencies(self, repo_id: str, db: Session) -> List[Dict[str, Any]]:
        """Fetch extracted dependency graph edges."""
        deps = db.query(DependencyModel).filter(DependencyModel.repository_id == repo_id).all()
        return [
            {
                "id": d.id,
                "repositoryId": d.repository_id,
                "source": d.source,
                "target": d.target,
                "relationshipType": d.relationship_type,
                "category": d.category,
                "sourceLine": d.source_line,
            }
            for d in deps
        ]

    def get_architecture(self, repo_id: str, db: Session) -> Dict[str, Any]:
        """Generate dynamic DAG architecture graph from database models."""
        repo = db.query(RepositoryModel).filter(RepositoryModel.id == repo_id).first()
        if not repo:
            return {"nodes": [], "edges": []}

        files = db.query(FileModel).filter(FileModel.repository_id == repo_id).all()
        symbols = db.query(SymbolModel).filter(SymbolModel.repository_id == repo_id).all()
        deps = db.query(DependencyModel).filter(DependencyModel.repository_id == repo_id).all()

        file_path_map = {f.id: f.path for f in files}
        files_data = [
            {
                "id": f.id,
                "path": f.path,
                "name": os.path.basename(f.path),
                "language": f.language,
                "lines_count": f.lines_count,
                "symbols_count": len([s for s in symbols if s.file_id == f.id]),
            }
            for f in files
        ]

        symbols_data = [
            {
                "id": s.id,
                "name": s.name,
                "type": s.type,
                "file_path": file_path_map.get(s.file_id, ""),
                "signature": s.signature,
                "docstring": s.docstring,
            }
            for s in symbols
        ]

        deps_data = [
            {
                "id": d.id,
                "source": d.source,
                "target": d.target,
                "relationship_type": d.relationship_type,
                "category": d.category,
            }
            for d in deps
        ]

        repo_dict = self._repo_to_dict(repo)
        return self.static_analyzer.build_architecture_graph(repo_dict, files_data, symbols_data, deps_data)

    def analyze_repository(
        self,
        db: Session,
        url: Optional[str] = None,
        sample_id: Optional[str] = None,
        local_files: Optional[List[Dict[str, Any]]] = None,
        github_token: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Ingest, parse via Tree-sitter, analyze static dependencies, chunk, and index into ChromaDB.
        """
        # 1. Check Sample Repositories
        if sample_id or (url and any(s in (url or "") for s in ["fastapi-jwt-auth-service", "repomind-core-engine", "spring-boot-inventory-service"])):
            target_sample = sample_id or ("repo-ts-code-archaeologist" if "repomind-core" in url else ("repo-java-spring-microservice" if "spring" in url else "repo-python-fastapi"))
            return self._seed_sample(db, target_sample)

        # 2. Local Files Upload
        if local_files:
            return self._ingest_local_files(db, local_files)

        # 3. GitHub Ingestion
        if not url:
            raise ValueError("Please provide a valid GitHub repository URL or select a sample repository.")

        return self._ingest_github_repository(db, url, github_token)

    def _clean_repo_records(self, db: Session, repo_id: str):
        """Purge any previous records for a repository ID to guarantee clean state and prevent memory leaks."""
        db.query(SymbolModel).filter(SymbolModel.repository_id == repo_id).delete()
        db.query(CodeChunkModel).filter(CodeChunkModel.repository_id == repo_id).delete()
        db.query(DependencyModel).filter(DependencyModel.repository_id == repo_id).delete()
        db.query(FileModel).filter(FileModel.repository_id == repo_id).delete()
        db.query(RepositoryModel).filter(RepositoryModel.id == repo_id).delete()
        db.commit()

    def _ingest_local_files(self, db: Session, local_files: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Ingest uploaded files incrementally without loading all files simultaneously into memory."""
        if not local_files:
            raise HTTPException(status_code=400, detail="No valid files provided for local upload.")

        max_files = get_max_repo_files()
        max_file_size = get_max_file_size()
        max_repo_size = get_max_repo_total_size()

        repo_id = f"repo-local-{int(time.time())}"
        repo_name = "local-project-upload"

        def generate_local_stream():
            cumulative_size = 0
            eligible_count = 0
            for lf in local_files:
                path = lf.get("path", "")
                content = lf.get("content", "")
                ok, reason = is_eligible_file(path, size=len(content), content=content)
                if not ok:
                    logger.info(f"Skipping local file '{path}': {reason}")
                    continue

                content_len = len(content.encode("utf-8", errors="ignore"))
                if content_len > max_file_size:
                    content = content[:max_file_size] + "\n// [Truncated: Exceeded file size limit]"
                    content_len = len(content)

                cumulative_size += content_len
                if cumulative_size > max_repo_size:
                    raise HTTPException(
                        status_code=413,
                        detail=f"Total repository size ({round(cumulative_size / (1024 * 1024), 2)}MB) exceeds maximum memory safety limit of {max_repo_size // (1024 * 1024)}MB.",
                    )

                eligible_count += 1
                yield {
                    "id": f"f-{repo_id}-{eligible_count}",
                    "repository_id": repo_id,
                    "path": path,
                    "name": os.path.basename(path),
                    "language": self._detect_language(path),
                    "size": content_len,
                    "content": content,
                }

                if eligible_count >= max_files:
                    logger.warning(f"Reached MAX_REPO_FILES limit of {max_files}; remaining files omitted.")
                    break

        return self._process_and_persist(
            db=db,
            repo_id=repo_id,
            repo_name=repo_name,
            owner="local-developer",
            url="local://workspace",
            description="Locally uploaded project workspace.",
            raw_files=generate_local_stream(),
        )

    def _ingest_github_repository(self, db: Session, url: str, github_token: Optional[str] = None) -> Dict[str, Any]:
        """Stream GitHub repository files incrementally, enforcing size boundaries and releasing buffers."""
        parts = url.rstrip("/").split("/")
        if len(parts) < 2:
            raise HTTPException(status_code=400, detail="Invalid GitHub URL format.")
        owner = parts[-2]
        repo_name = parts[-1]
        repo_id = f"repo-{owner}-{repo_name}".lower()

        # Check existing to prevent duplicate work and memory pressure
        existing = db.query(RepositoryModel).filter(RepositoryModel.id == repo_id).first()
        if existing and existing.status == "COMPLETED":
            return self._repo_to_dict(existing)

        max_files = get_max_repo_files()
        max_file_size = get_max_file_size()
        max_repo_size = get_max_repo_total_size()

        # Fetch files from GitHub REST API
        headers = {"Accept": "application/vnd.github.v3+json"}
        token = github_token or os.getenv("GITHUB_TOKEN")
        if token:
            headers["Authorization"] = f"Bearer {token}"

        api_url = f"https://api.github.com/repos/{owner}/{repo_name}"
        try:
            meta_res = requests.get(api_url, headers=headers, timeout=15)
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Failed to connect to GitHub API: {str(e)}")

        if meta_res.status_code == 404:
            raise HTTPException(status_code=404, detail="GitHub repository not found or private.")
        if meta_res.status_code == 403:
            raise HTTPException(status_code=429, detail="GitHub API rate limit exceeded or access forbidden.")
        if meta_res.status_code != 200:
            raise HTTPException(status_code=400, detail=f"GitHub API error: HTTP {meta_res.status_code}")

        meta = meta_res.json()
        default_branch = meta.get("default_branch", "main")
        desc = meta.get("description", "GitHub repository")
        del meta, meta_res

        # Attempt downloading repository archive in a single request (avoids 60+ API calls and rate limit exhaustion)
        zip_bytes = None
        zip_candidates = [
            f"https://github.com/{owner}/{repo_name}/archive/refs/heads/{default_branch}.zip",
            f"https://api.github.com/repos/{owner}/{repo_name}/zipball/{default_branch}",
        ]
        for z_url in zip_candidates:
            try:
                z_res = requests.get(z_url, headers=headers, timeout=25)
                if z_res.status_code == 200 and len(z_res.content) > 100:
                    zip_bytes = z_res.content
                    del z_res
                    break
            except Exception as e:
                logger.debug(f"Zip download from {z_url} failed: {e}")

        if zip_bytes:
            def generate_zip_stream():
                nonlocal zip_bytes
                total_downloaded_bytes = 0
                file_idx = 0
                zf = zipfile.ZipFile(io.BytesIO(zip_bytes))
                names = zf.namelist()
                for name in names:
                    if name.endswith("/") or "/" not in name:
                        continue
                    # Strip root folder (e.g. repo-main/)
                    rel_path = "/".join(name.split("/")[1:])
                    if not rel_path:
                        continue
                    zinfo = zf.getinfo(name)
                    blob_size = zinfo.file_size
                    ok, _ = is_eligible_file(rel_path, size=blob_size)
                    if not ok:
                        continue

                    try:
                        content = zf.read(name).decode("utf-8", errors="replace")
                    except Exception:
                        continue

                    if "\x00" in content:
                        del content
                        continue

                    content_bytes_len = len(content.encode("utf-8", errors="ignore"))
                    if content_bytes_len > max_file_size:
                        content = content[:max_file_size] + "\n// [Truncated: Exceeded file size limit]"
                        content_bytes_len = len(content)

                    total_downloaded_bytes += content_bytes_len
                    if total_downloaded_bytes > max_repo_size:
                        del content
                        break

                    file_idx += 1
                    if file_idx > max_files:
                        break

                    yield {
                        "id": f"f-{repo_id}-{file_idx}",
                        "repository_id": repo_id,
                        "path": rel_path,
                        "name": os.path.basename(rel_path),
                        "language": self._detect_language(rel_path),
                        "size": content_bytes_len,
                        "content": content,
                    }
                del zip_bytes, zf
                gc.collect()

            return self._process_and_persist(
                db=db,
                repo_id=repo_id,
                repo_name=repo_name,
                owner=owner,
                url=url,
                default_branch=default_branch,
                description=desc,
                raw_files=generate_zip_stream(),
            )

        # Fallback: Fetch Git Tree recursively and individual blobs
        tree_url = f"https://api.github.com/repos/{owner}/{repo_name}/git/trees/{default_branch}?recursive=1"
        try:
            tree_res = requests.get(tree_url, headers=headers, timeout=20)
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Failed to retrieve repository git tree: {str(e)}")

        if tree_res.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to retrieve repository git tree from GitHub.")

        tree_data = tree_res.json().get("tree", [])

        # Filter candidate blobs before downloading
        candidate_blobs = []
        for item in tree_data:
            if item.get("type") == "blob":
                path = item.get("path", "")
                blob_size = item.get("size")
                ok, reason = is_eligible_file(path, size=blob_size)
                if ok:
                    candidate_blobs.append(item)

        # Release raw tree data immediately to reclaim RAM
        del tree_data, tree_res
        gc.collect()

        if not candidate_blobs:
            raise HTTPException(
                status_code=400,
                detail=f"No eligible source code files found in repository within size ({max_file_size // 1024}KB) and file limits.",
            )

        # Check pre-computed total size if available in git tree
        known_sizes = [b.get("size", 0) for b in candidate_blobs if b.get("size") is not None]
        if known_sizes and sum(known_sizes) > max_repo_size:
            total_mb = round(sum(known_sizes) / (1024 * 1024), 2)
            limit_mb = max_repo_size // (1024 * 1024)
            raise HTTPException(
                status_code=413,
                detail=f"Total repository size ({total_mb}MB) exceeds maximum memory safety limit of {limit_mb}MB. Please analyze a smaller repository or reduce file size.",
            )

        # Enforce maximum number of files to process
        if len(candidate_blobs) > max_files:
            candidate_blobs = candidate_blobs[:max_files]

        def generate_github_stream():
            total_downloaded_bytes = 0
            file_idx = 0
            for item in candidate_blobs:
                path = item.get("path", "")
                blob_url = item.get("url")
                if not blob_url:
                    continue

                try:
                    blob_res = requests.get(blob_url, headers=headers, timeout=10)
                except Exception:
                    continue

                if blob_res.status_code != 200:
                    continue

                b_data = blob_res.json()
                del blob_res

                content = ""
                if b_data.get("encoding") == "base64":
                    try:
                        content = base64.b64decode(b_data["content"]).decode("utf-8", errors="replace")
                    except Exception:
                        del b_data
                        continue
                else:
                    content = b_data.get("content", "")
                del b_data

                # Exclude binary null bytes
                if "\x00" in content:
                    del content
                    continue

                content_bytes_len = len(content.encode("utf-8", errors="ignore"))
                if content_bytes_len > max_file_size:
                    content = content[:max_file_size] + "\n// [Truncated: Exceeded file size limit]"
                    content_bytes_len = len(content)

                total_downloaded_bytes += content_bytes_len
                if total_downloaded_bytes > max_repo_size:
                    del content
                    raise HTTPException(
                        status_code=413,
                        detail=f"Repository size ({round(total_downloaded_bytes / (1024 * 1024), 2)}MB) exceeds maximum memory safety limit of {max_repo_size // (1024 * 1024)}MB.",
                    )

                file_idx += 1
                yield {
                    "id": f"f-{repo_id}-{file_idx}",
                    "repository_id": repo_id,
                    "path": path,
                    "name": os.path.basename(path),
                    "language": self._detect_language(path),
                    "size": content_bytes_len,
                    "content": content,
                }

        return self._process_and_persist(
            db=db,
            repo_id=repo_id,
            repo_name=repo_name,
            owner=owner,
            url=url,
            default_branch=default_branch,
            description=desc,
            raw_files=generate_github_stream(),
        )

    def _process_and_persist(
        self,
        db: Session,
        repo_id: str,
        repo_name: str,
        owner: str,
        url: str,
        description: str,
        raw_files: Any,
        default_branch: str = "main",
    ) -> Dict[str, Any]:
        """Incremental Tree-sitter AST parse, dependency analysis, chunking, and database insertion."""
        # 1. Reset collection in ChromaDB and clear existing records in DB
        self.chroma_service.reset_collection(repo_id)
        self._clean_repo_records(db, repo_id)

        # 2. Incremental per-file processing
        file_import_map: Dict[str, List[str]] = {}
        file_paths: Set[str] = set()
        total_loc = 0
        total_symbols_count = 0
        total_chunks_count = 0
        total_classes_count = 0
        total_functions_count = 0
        lang_counts: Dict[str, int] = {}
        dir_set: Set[str] = set()

        sym_idx = 0
        chunk_idx = 0
        total_files = 0
        chunk_buffer: List[Dict[str, Any]] = []
        CHROMA_BATCH_SIZE = 20

        for f_idx, f in enumerate(raw_files):
            total_files += 1
            path = f["path"]
            content = f["content"]
            lang = f["language"]
            loc = f.get("lines_count") or (content.count("\n") + (1 if content else 0))
            total_loc += loc
            file_paths.add(path)
            d = os.path.dirname(path)
            if d:
                dir_set.add(d)
            lang_counts[lang] = lang_counts.get(lang, 0) + 1

            # Extract AST symbols for this file
            symbols = self.parser.parse_file(path, content, lang)
            for s in symbols:
                s["file_id"] = f["id"]
                s["repository_id"] = repo_id
                s["file_path"] = path

            # Extract imports for dependency analysis
            imports: List[str] = []
            for line in content.splitlines():
                l = line.strip()
                if l.startswith("from ") and "import" in l:
                    parts = l.split()
                    if len(parts) >= 2:
                        imports.append(parts[1])
                elif l.startswith("import "):
                    parts = l.split()
                    if len(parts) >= 2:
                        imports.append(parts[1].split(",")[0].strip(";\"'"))
            file_import_map[path] = imports

            # Chunk single file incrementally
            file_chunks = self.chunker.chunk_single_file(
                repository_id=repo_id,
                file=f,
                file_symbols=symbols,
                start_chunk_idx=chunk_idx,
            )
            chunk_idx += len(file_chunks)
            total_chunks_count += len(file_chunks)
            total_symbols_count += len(symbols)

            total_classes_count += sum(1 for s in symbols if s.get("type") == "class")
            total_functions_count += sum(1 for s in symbols if s.get("type") in ["function", "method"])

            # Buffer chunks and write in bounded batches
            if file_chunks:
                chunk_buffer.extend(file_chunks)
                if len(chunk_buffer) >= CHROMA_BATCH_SIZE:
                    self.chroma_service.add_chunks_batch(repo_id, chunk_buffer)
                    chunk_buffer.clear()

            # Persist FileModel
            db.add(FileModel(
                id=f["id"],
                repository_id=repo_id,
                path=path,
                language=lang,
                size=f.get("size") or len(content.encode("utf-8", errors="ignore")),
                lines_count=loc,
                content=content,
            ))

            # Persist SymbolModels
            for s in symbols:
                sym_idx += 1
                db.add(SymbolModel(
                    id=f"sym-{repo_id}-{sym_idx}",
                    repository_id=repo_id,
                    file_id=f["id"],
                    name=s["name"],
                    type=s.get("type", "symbol"),
                    start_line=s.get("start_line", 1),
                    end_line=s.get("end_line", 1),
                    signature=s.get("signature"),
                    docstring=s.get("docstring"),
                    detected_from=s.get("detected_from", "Tree-sitter AST"),
                ))

            # Persist CodeChunkModels
            for c in file_chunks:
                db.add(CodeChunkModel(
                    id=c["id"],
                    repository_id=repo_id,
                    file_id=f["id"],
                    symbol_name=c.get("symbol_name"),
                    symbol_type=c.get("symbol_type"),
                    start_line=c["start_line"],
                    end_line=c["end_line"],
                    content=c["content"],
                ))

            # Periodically flush every 10 files to keep memory usage low
            if (f_idx + 1) % 10 == 0:
                db.flush()
                gc.collect()

            del symbols, file_chunks, content

        if total_files == 0:
            raise HTTPException(
                status_code=400,
                detail="No eligible source code files found in repository within memory limits.",
            )

        # Flush any remaining chunks in buffer to ChromaDB
        if chunk_buffer:
            self.chroma_service.add_chunks_batch(repo_id, chunk_buffer)
            chunk_buffer.clear()

        # 3. Static Dependency Analysis
        dependencies = self.static_analyzer.analyze_dependencies_from_imports(
            repo_id,
            file_paths=file_paths,
            file_import_map=file_import_map,
        )

        for d in dependencies:
            db.add(DependencyModel(
                id=d["id"],
                repository_id=repo_id,
                source=d["source"],
                target=d["target"],
                relationship_type=d["relationship_type"],
                category=d.get("category", "internal"),
            ))

        # 4. Language Breakdown
        lang_colors = {
            "Python": "#3572A5",
            "TypeScript": "#3178c6",
            "JavaScript": "#f1e05a",
            "Java": "#b07219",
            "JSON": "#292929",
            "Markdown": "#083fa1",
        }
        languages = [
            {
                "name": lang,
                "filesCount": count,
                "percentage": round((count / total_files) * 100, 1) if total_files > 0 else 0,
                "color": lang_colors.get(lang, "#8b949e"),
            }
            for lang, count in lang_counts.items()
        ]

        # 5. Create Repository Record
        repo_model = RepositoryModel(
            id=repo_id,
            name=repo_name,
            owner=owner,
            url=url,
            default_branch=default_branch,
            description=description,
            status="COMPLETED",
            progress=100,
            status_message=f"Analysis completed. {total_files} files parsed, {total_symbols_count} symbols extracted, {total_chunks_count} chunks indexed.",
            summary=f"Project consisting of {total_files} files in {', '.join(lang_counts.keys())}. Parsed {total_symbols_count} Tree-sitter symbols and {total_chunks_count} semantic chunks.",
            architecture_summary=f"Architecture extracted from AST import and call hierarchy graphs across {total_files} files.",
            stats={
                "filesCount": total_files,
                "dirsCount": len(dir_set),
                "classesCount": total_classes_count,
                "functionsCount": total_functions_count,
                "dependenciesCount": len(dependencies),
                "linesOfCode": total_loc,
                "chunksCount": total_chunks_count,
                "languages": languages,
            },
        )
        db.add(repo_model)
        db.commit()

        # Explicit garbage collection to release intermediate buffers
        gc.collect()

        return self._repo_to_dict(repo_model)

    def _seed_fastapi_sample(self, db: Session, sample_id: str) -> Dict[str, Any]:
        """Seed pre-packaged FastAPI auth microservice with genuine files and AST symbols."""
        repo_id = "repo-python-fastapi"
        existing = db.query(RepositoryModel).filter(RepositoryModel.id == repo_id).first()
        if existing:
            return self._repo_to_dict(existing)

        raw_files = [
            {
                "id": "f-py-1",
                "repository_id": repo_id,
                "path": "app/main.py",
                "name": "main.py",
                "language": "Python",
                "size": 1420,
                "lines_count": 45,
                "content": '''"""FastAPI application entry point and router assembly."""
from fastapi import FastAPI, Depends
from app.routers import auth, users
from app.core.config import settings
from app.database.session import engine, Base

app = FastAPI(title="Auth Microservice", version="1.0.0")

@app.on_event("startup")
async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/users", tags=["Users"])

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "auth-service"}
''',
            },
            {
                "id": "f-py-2",
                "repository_id": repo_id,
                "path": "app/routers/auth.py",
                "name": "auth.py",
                "language": "Python",
                "size": 2840,
                "lines_count": 78,
                "content": '''"""Authentication endpoints for login, token refresh, and registration."""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from app.database.session import get_db
from app.security.tokens import create_access_token, create_refresh_token
from app.security.passwords import verify_password, get_password_hash
from app.models.user import User

router = APIRouter()

@router.post("/login")
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    """Authenticate user credentials and issue JWT tokens."""
    user = await authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")
    access_token = create_access_token(data={"sub": user.username, "roles": user.roles})
    refresh_token = create_refresh_token(data={"sub": user.username})
    return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer"}

async def authenticate_user(db: AsyncSession, username: str, password: str) -> User:
    """Verify user existence and validate password hash."""
    user = await User.get_by_username(db, username)
    if not user or not verify_password(password, user.hashed_password):
        return None
    return user
''',
            },
            {
                "id": "f-py-3",
                "repository_id": repo_id,
                "path": "app/security/tokens.py",
                "name": "tokens.py",
                "language": "Python",
                "size": 1820,
                "lines_count": 52,
                "content": '''"""JWT token issuance, verification, and decoding."""
from datetime import datetime, timedelta
from jose import jwt, JWTError
from app.core.config import settings

def create_access_token(data: dict, expires_delta: timedelta = None) -> str:
    """Generate signed HMAC-SHA256 JWT access token."""
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def create_refresh_token(data: dict) -> str:
    """Generate refresh token with extended TTL."""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def decode_token(token: str) -> dict:
    """Decode and validate JWT token claims."""
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None
''',
            },
            {
                "id": "f-py-4",
                "repository_id": repo_id,
                "path": "app/security/passwords.py",
                "name": "passwords.py",
                "language": "Python",
                "size": 950,
                "lines_count": 28,
                "content": '''"""Bcrypt password hashing and validation."""
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify raw password against bcrypt salted hash."""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Generate bcrypt hash for storage."""
    return pwd_context.hash(password)
''',
            },
            {
                "id": "f-py-5",
                "repository_id": repo_id,
                "path": "app/database/session.py",
                "name": "session.py",
                "language": "Python",
                "size": 1100,
                "lines_count": 34,
                "content": '''"""Async database engine and session factory."""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=False)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
Base = declarative_base()

async def get_db():
    """Dependency for injecting async database session into endpoints."""
    async with AsyncSessionLocal() as session:
        yield session
''',
            },
            {
                "id": "f-py-6",
                "repository_id": repo_id,
                "path": "app/models/user.py",
                "name": "user.py",
                "language": "Python",
                "size": 1640,
                "lines_count": 48,
                "content": '''"""SQLAlchemy User entity model with role definitions."""
from sqlalchemy import Column, Integer, String, Boolean, DateTime
from app.database.session import Base

class User(Base):
    """User account entity model."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    roles = Column(String(100), default="user")

    @classmethod
    async def get_by_username(cls, db, username: str):
        from sqlalchemy import select
        res = await db.execute(select(cls).where(cls.username == username))
        return res.scalar_one_or_none()
''',
            },
        ]

        return self._process_and_persist(
            db=db,
            repo_id=repo_id,
            repo_name="fastapi-jwt-auth-service",
            owner="code-archaeologist",
            url="https://github.com/code-archaeologist/fastapi-jwt-auth-service",
            default_branch="main",
            description="Production-ready FastAPI authentication and user authorization microservice featuring JWT, OAuth2 scopes, SQLAlchemy ORM, and bcrypt password hashing.",
            raw_files=raw_files,
        )

    def _seed_sample(self, db: Session, sample_id: str) -> Dict[str, Any]:
        """Seed sample repository based on requested ID."""
        if sample_id == "repo-ts-code-archaeologist" or "repomind-core" in sample_id:
            return self._seed_ts_sample(db)
        elif sample_id == "repo-java-spring-microservice" or "spring" in sample_id or "inventory" in sample_id:
            return self._seed_java_sample(db)
        else:
            return self._seed_fastapi_sample(db, sample_id)

    def _seed_ts_sample(self, db: Session) -> Dict[str, Any]:
        """Seed TypeScript code analysis engine sample."""
        repo_id = "repo-ts-code-archaeologist"
        existing = db.query(RepositoryModel).filter(RepositoryModel.id == repo_id).first()
        if existing:
            return self._repo_to_dict(existing)

        raw_files = [
            {
                "id": "f-ts-1",
                "repository_id": repo_id,
                "path": "src/analyzers/ast-parser.ts",
                "name": "ast-parser.ts",
                "language": "TypeScript",
                "size": 2400,
                "lines_count": 68,
                "content": '''import Parser from 'web-tree-sitter';
import { SymbolItem, SourceLocation } from '../types';

export class ASTParser {
  private parser: Parser | null = null;
  private language: string;

  constructor(language: string) {
    this.language = language;
  }

  public async initialize(): Promise<void> {
    await Parser.init();
    this.parser = new Parser();
  }

  public parseSourceFile(code: string, filePath: string): SymbolItem[] {
    if (!this.parser) {
      throw new Error('Parser not initialized. Call initialize() first.');
    }
    const tree = this.parser.parse(code);
    return this.extractSymbols(tree.rootNode, filePath);
  }

  private extractSymbols(rootNode: Parser.SyntaxNode, filePath: string): SymbolItem[] {
    const symbols: SymbolItem[] = [];
    this.traverseAST(rootNode, (node) => {
      if (node.type === 'class_declaration' || node.type === 'class') {
        symbols.push({
          id: `${filePath}-${node.startPosition.row}`,
          name: node.childForFieldName('name')?.text || 'AnonymousClass',
          type: 'class',
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          filePath,
        });
      } else if (node.type === 'function_declaration' || node.type === 'method_definition') {
        symbols.push({
          id: `${filePath}-${node.startPosition.row}`,
          name: node.childForFieldName('name')?.text || 'anonymousFunction',
          type: node.type === 'method_definition' ? 'method' : 'function',
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          filePath,
        });
      }
    });
    return symbols;
  }

  private traverseAST(node: Parser.SyntaxNode, callback: (n: Parser.SyntaxNode) => void): void {
    callback(node);
    for (let i = 0; i < node.namedChildCount; i++) {
      const child = node.namedChild(i);
      if (child) this.traverseAST(child, callback);
    }
  }
}
''',
            },
            {
                "id": "f-ts-2",
                "repository_id": repo_id,
                "path": "src/analyzers/chunker.ts",
                "name": "chunker.ts",
                "language": "TypeScript",
                "size": 1950,
                "lines_count": 52,
                "content": '''import { SymbolItem, CodeChunk } from '../types';

export class SemanticChunker {
  private maxChunkLines: number;

  constructor(maxChunkLines: number = 80) {
    this.maxChunkLines = maxChunkLines;
  }

  public chunkFile(filePath: string, content: string, symbols: SymbolItem[], language: string): CodeChunk[] {
    const lines = content.split('\\n');
    const chunks: CodeChunk[] = [];

    for (const sym of symbols) {
      if (sym.type === 'class' || sym.type === 'function' || sym.type === 'method') {
        const symbolLines = lines.slice(sym.startLine - 1, sym.endLine);
        chunks.push({
          id: `chk-${filePath}-${sym.name}-${sym.startLine}`,
          repositoryId: 'repo-ts-code-archaeologist',
          filePath,
          language,
          symbolType: sym.type,
          symbolName: sym.name,
          startLine: sym.startLine,
          endLine: sym.endLine,
          content: symbolLines.join('\\n'),
        });
      }
    }
    return chunks;
  }
}
''',
            },
            {
                "id": "f-ts-3",
                "repository_id": repo_id,
                "path": "src/vector/chroma-client.ts",
                "name": "chroma-client.ts",
                "language": "TypeScript",
                "size": 2200,
                "lines_count": 58,
                "content": '''import { ChromaClient, Collection } from 'chromadb';
import { CodeChunk } from '../types';

export class ChromaVectorStore {
  private client: ChromaClient;
  private collection: Collection | null = null;

  constructor(host: string = 'http://localhost:8000') {
    this.client = new ChromaClient({ path: host });
  }

  public async initializeCollection(name: string): Promise<void> {
    this.collection = await this.client.getOrCreateCollection({ name });
  }

  public async insertChunks(chunks: CodeChunk[]): Promise<number> {
    if (!this.collection) throw new Error('Vector collection not initialized');
    await this.collection.add({
      ids: chunks.map(c => c.id),
      documents: chunks.map(c => c.content),
      metadatas: chunks.map(c => ({ filePath: c.filePath, symbolName: c.symbolName })),
    });
    return chunks.length;
  }
}
''',
            },
            {
                "id": "f-ts-4",
                "repository_id": repo_id,
                "path": "src/rag/gemini-orchestrator.ts",
                "name": "gemini-orchestrator.ts",
                "language": "TypeScript",
                "size": 2500,
                "lines_count": 65,
                "content": '''import { GoogleGenAI } from '@google/genai';
import { CodeChunk, RAGResponse } from '../types';

export class GeminiRAGOrchestrator {
  private ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  public async generateAnswer(question: string, contextChunks: CodeChunk[]): Promise<RAGResponse> {
    const context = contextChunks.map(c => `File: ${c.filePath}\\n${c.content}`).join('\\n\\n');
    const prompt = `Context:\\n${context}\\n\\nQuestion: ${question}\\nAnswer strictly with citations:`;
    const response = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return {
      question,
      answer: response.text || '',
      grounded: true,
      confidenceStatus: 'Supported by repository evidence',
      retrievedChunksCount: contextChunks.length,
      relevantFiles: Array.from(new Set(contextChunks.map(c => c.filePath))),
      evidence: [],
      durationMs: 420.5,
    };
  }
}
''',
            },
            {
                "id": "f-ts-5",
                "repository_id": repo_id,
                "path": "src/index.ts",
                "name": "index.ts",
                "language": "TypeScript",
                "size": 1800,
                "lines_count": 48,
                "content": '''import { ASTParser } from './analyzers/ast-parser';
import { SemanticChunker } from './analyzers/chunker';
import { ChromaVectorStore } from './vector/chroma-client';
import { GeminiRAGOrchestrator } from './rag/gemini-orchestrator';

export async function runAnalysisPipeline(sourceFiles: { path: string; content: string }[]) {
  const parser = new ASTParser('typescript');
  await parser.initialize();
  const chunker = new SemanticChunker();
  const vectorStore = new ChromaVectorStore();
  await vectorStore.initializeCollection('repomind_ts');

  console.log(`Starting analysis for ${sourceFiles.length} files...`);
}
''',
            },
        ]

        return self._process_and_persist(
            db=db,
            repo_id=repo_id,
            repo_name="repomind-core-engine",
            owner="code-archaeologist",
            url="https://github.com/code-archaeologist/repomind-core-engine",
            default_branch="main",
            description="Core TypeScript engine for AST parsing, code chunking, ChromaDB vector indexing, and Gemini-powered retrieval augmented generation.",
            raw_files=raw_files,
        )

    def _seed_java_sample(self, db: Session) -> Dict[str, Any]:
        """Seed Spring Boot Java microservice sample."""
        repo_id = "repo-java-spring-microservice"
        existing = db.query(RepositoryModel).filter(RepositoryModel.id == repo_id).first()
        if existing:
            return self._repo_to_dict(existing)

        raw_files = [
            {
                "id": "f-jv-1",
                "repository_id": repo_id,
                "path": "src/main/java/com/repomind/inventory/InventoryApplication.java",
                "name": "InventoryApplication.java",
                "language": "Java",
                "size": 1100,
                "lines_count": 30,
                "content": '''package com.repomind.inventory;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class InventoryApplication {
    public static void main(String[] args) {
        SpringApplication.run(InventoryApplication.class, args);
    }
}
''',
            },
            {
                "id": "f-jv-2",
                "repository_id": repo_id,
                "path": "src/main/java/com/repomind/inventory/controller/ProductController.java",
                "name": "ProductController.java",
                "language": "Java",
                "size": 2400,
                "lines_count": 65,
                "content": '''package com.repomind.inventory.controller;

import com.repomind.inventory.model.Product;
import com.repomind.inventory.service.ProductService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/products")
public class ProductController {
    private final ProductService productService;

    public ProductController(ProductService productService) {
        this.productService = productService;
    }

    @GetMapping
    public List<Product> getAllProducts() {
        return productService.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Product> getProductById(@PathVariable Long id) {
        return productService.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public Product createProduct(@RequestBody Product product) {
        return productService.save(product);
    }
}
''',
            },
            {
                "id": "f-jv-3",
                "repository_id": repo_id,
                "path": "src/main/java/com/repomind/inventory/service/ProductService.java",
                "name": "ProductService.java",
                "language": "Java",
                "size": 2100,
                "lines_count": 55,
                "content": '''package com.repomind.inventory.service;

import com.repomind.inventory.model.Product;
import com.repomind.inventory.repository.ProductRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.Optional;

@Service
@Transactional
public class ProductService {
    private final ProductRepository productRepository;

    public ProductService(ProductRepository productRepository) {
        this.productRepository = productRepository;
    }

    public List<Product> findAll() {
        return productRepository.findAll();
    }

    public Optional<Product> findById(Long id) {
        return productRepository.findById(id);
    }

    public Product save(Product product) {
        return productRepository.save(product);
    }
}
''',
            },
            {
                "id": "f-jv-4",
                "repository_id": repo_id,
                "path": "src/main/java/com/repomind/inventory/repository/ProductRepository.java",
                "name": "ProductRepository.java",
                "language": "Java",
                "size": 950,
                "lines_count": 25,
                "content": '''package com.repomind.inventory.repository;

import com.repomind.inventory.model.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface ProductRepository extends JpaRepository<Product, Long> {
    Optional<Product> findBySku(String sku);
}
''',
            },
            {
                "id": "f-jv-5",
                "repository_id": repo_id,
                "path": "src/main/java/com/repomind/inventory/model/Product.java",
                "name": "Product.java",
                "language": "Java",
                "size": 1800,
                "lines_count": 48,
                "content": '''package com.repomind.inventory.model;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "products")
public class Product {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String sku;

    @Column(nullable = false)
    private String name;

    private BigDecimal price;
    private Integer quantity;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getSku() { return sku; }
    public void setSku(String sku) { this.sku = sku; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public BigDecimal getPrice() { return price; }
    public void setPrice(BigDecimal price) { this.price = price; }
    public Integer getQuantity() { return quantity; }
    public void setQuantity(Integer quantity) { this.quantity = quantity; }
}
''',
            },
        ]

        return self._process_and_persist(
            db=db,
            repo_id=repo_id,
            repo_name="spring-boot-inventory-service",
            owner="code-archaeologist",
            url="https://github.com/code-archaeologist/spring-boot-inventory-service",
            default_branch="main",
            description="Spring Boot microservice with REST controllers, transactional services, and Spring Data JPA repositories.",
            raw_files=raw_files,
        )

    def _detect_language(self, path: str) -> str:
        ext = os.path.splitext(path)[1].lower()
        mapping = {
            ".py": "Python",
            ".ts": "TypeScript",
            ".tsx": "TypeScript",
            ".js": "JavaScript",
            ".jsx": "JavaScript",
            ".java": "Java",
            ".json": "JSON",
            ".md": "Markdown",
            ".sql": "SQL",
        }
        return mapping.get(ext, "Unknown")

    def _repo_to_dict(self, repo: RepositoryModel) -> Dict[str, Any]:
        return {
            "id": repo.id,
            "name": repo.name,
            "owner": repo.owner,
            "url": repo.url,
            "defaultBranch": repo.default_branch,
            "description": repo.description,
            "status": repo.status,
            "progress": repo.progress,
            "statusMessage": repo.status_message,
            "summary": repo.summary,
            "architectureSummary": repo.architecture_summary,
            "stats": repo.stats or {},
            "createdAt": repo.created_at.isoformat() if repo.created_at else None,
            "updatedAt": repo.updated_at.isoformat() if repo.updated_at else None,
        }
