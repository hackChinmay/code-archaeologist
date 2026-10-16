"""Hierarchical AST-driven code chunking module."""
from typing import List, Dict, Any

class CodeChunker:
    """Divides repository files into contextual chunks based on AST symbol boundaries."""

    @staticmethod
    def chunk_single_file(
        repository_id: str,
        file: Dict[str, Any],
        file_symbols: List[Dict[str, Any]],
        start_chunk_idx: int = 0,
        max_chunk_lines: int = 60,
    ) -> List[Dict[str, Any]]:
        """Chunk a single file based on AST symbols or sliding window without loading entire repo."""
        chunks: List[Dict[str, Any]] = []
        path = file["path"]
        content = file.get("content", "")
        lines = content.split("\n")
        lang = file.get("language", "Text")
        file_id = file.get("id")
        current_idx = start_chunk_idx

        if file_symbols:
            for sym in file_symbols:
                start_l = max(1, sym.get("start_line", 1))
                end_l = min(len(lines), sym.get("end_line", len(lines)))
                chunk_lines = lines[start_l - 1:end_l]
                chunk_content = "\n".join(chunk_lines)

                if chunk_content.strip():
                    current_idx += 1
                    chunks.append({
                        "id": f"chunk-{repository_id}-{current_idx}",
                        "repository_id": repository_id,
                        "file_id": file_id,
                        "file_path": path,
                        "language": lang,
                        "symbol_name": sym.get("name", ""),
                        "symbol_type": sym.get("type", "symbol"),
                        "start_line": start_l,
                        "end_line": end_l,
                        "content": chunk_content,
                    })
        else:
            # Sliding window chunking for files with no class/function symbols (e.g. config, sql, scripts)
            step = 40
            for start_idx in range(0, len(lines), step):
                end_idx = min(len(lines), start_idx + max_chunk_lines)
                window_content = "\n".join(lines[start_idx:end_idx])
                if window_content.strip():
                    current_idx += 1
                    chunks.append({
                        "id": f"chunk-{repository_id}-{current_idx}",
                        "repository_id": repository_id,
                        "file_id": file_id,
                        "file_path": path,
                        "language": lang,
                        "symbol_name": file.get("name", path),
                        "symbol_type": "file_block",
                        "start_line": start_idx + 1,
                        "end_line": end_idx,
                        "content": window_content,
                    })

        return chunks

    @staticmethod
    def chunk_repository(
        repository_id: str,
        files: List[Dict[str, Any]],
        symbols: List[Dict[str, Any]],
        max_chunk_lines: int = 60,
    ) -> List[Dict[str, Any]]:
        chunks: List[Dict[str, Any]] = []
        chunk_idx = 0

        # Group symbols by file path
        symbols_by_file: Dict[str, List[Dict[str, Any]]] = {}
        for s in symbols:
            fp = s.get("file_path", "")
            if fp:
                if fp not in symbols_by_file:
                    symbols_by_file[fp] = []
                symbols_by_file[fp].append(s)

        for file in files:
            path = file["path"]
            file_symbols = symbols_by_file.get(path, [])
            file_chunks = CodeChunker.chunk_single_file(
                repository_id=repository_id,
                file=file,
                file_symbols=file_symbols,
                start_chunk_idx=chunk_idx,
                max_chunk_lines=max_chunk_lines,
            )
            chunk_idx += len(file_chunks)
            chunks.extend(file_chunks)

        return chunks
