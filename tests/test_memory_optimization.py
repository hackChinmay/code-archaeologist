"""Unit and integration tests verifying memory optimization, file filtering,
size limits, batched processing, and CORS error handling for Render 512MB RAM constraints.
"""
import unittest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.services.repository_service import (
    is_eligible_file,
    MAX_FILE_SIZE_BYTES,
    MAX_REPO_FILES,
    MAX_REPO_TOTAL_SIZE_BYTES,
)
from backend.app.analyzers.code_chunker import CodeChunker
from backend.app.analyzers.static_analyzer import StaticAnalyzer
from backend.app.rag.embeddings import get_shared_onnx_embedding_function, RepoMindEmbeddingFunction, EmbeddingService
from backend.app.rag.chroma_service import ChromaService


class TestMemoryOptimization(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_01_file_filtering_ignored_directories(self):
        """Must exclude .git, node_modules, build, dist, venv, and cache directories."""
        self.assertFalse(is_eligible_file(".git/config")[0])
        self.assertFalse(is_eligible_file("node_modules/express/index.js")[0])
        self.assertFalse(is_eligible_file("src/node_modules/foo.js")[0])
        self.assertFalse(is_eligible_file("dist/assets/index.js")[0])
        self.assertFalse(is_eligible_file("build/main.js")[0])
        self.assertFalse(is_eligible_file("backend/venv/lib/site-packages/os.py")[0])
        self.assertFalse(is_eligible_file("backend/.venv/bin/python")[0])
        self.assertFalse(is_eligible_file("app/__pycache__/main.cpython-312.pyc")[0])
        self.assertFalse(is_eligible_file(".idea/workspace.xml")[0])
        self.assertFalse(is_eligible_file(".vscode/settings.json")[0])

    def test_02_file_filtering_binary_and_media(self):
        """Must exclude binary, executable, database, archive, and image files."""
        self.assertFalse(is_eligible_file("assets/logo.png")[0])
        self.assertFalse(is_eligible_file("assets/icon.ico")[0])
        self.assertFalse(is_eligible_file("static/hero.jpg")[0])
        self.assertFalse(is_eligible_file("data/archive.zip")[0])
        self.assertFalse(is_eligible_file("bin/run.exe")[0])
        self.assertFalse(is_eligible_file("lib/native.so")[0])
        self.assertFalse(is_eligible_file("code_archaeologist.db")[0])
        self.assertFalse(is_eligible_file("data/dump.sqlite3")[0])

    def test_03_file_filtering_lockfiles_and_minified(self):
        """Must exclude dependency lockfiles and minified/bundled assets."""
        self.assertFalse(is_eligible_file("package-lock.json")[0])
        self.assertFalse(is_eligible_file("yarn.lock")[0])
        self.assertFalse(is_eligible_file("pnpm-lock.yaml")[0])
        self.assertFalse(is_eligible_file("static/bundle.min.js")[0])
        self.assertFalse(is_eligible_file("static/styles.min.css")[0])
        self.assertFalse(is_eligible_file("static/vendor.bundle.js")[0])

    def test_04_file_filtering_eligible_source_code(self):
        """Must allow genuine source code files across supported languages."""
        self.assertTrue(is_eligible_file("backend/app/main.py")[0])
        self.assertTrue(is_eligible_file("src/components/Header.tsx")[0])
        self.assertTrue(is_eligible_file("src/services/api.ts")[0])
        self.assertTrue(is_eligible_file("src/index.js")[0])
        self.assertTrue(is_eligible_file("src/main/java/App.java")[0])
        self.assertTrue(is_eligible_file("schema.sql")[0])
        self.assertTrue(is_eligible_file("README.md")[0])
        self.assertTrue(is_eligible_file("package.json")[0])

    def test_05_file_filtering_size_and_binary_content(self):
        """Must reject files exceeding max file size or containing null bytes."""
        # Oversized file
        oversized = MAX_FILE_SIZE_BYTES + 100
        ok, reason = is_eligible_file("large.py", size=oversized)
        self.assertFalse(ok)
        self.assertIn("exceeds max", reason)

        # Content with null bytes
        binary_content = "def test():\n    pass\x00\x00"
        ok, reason = is_eligible_file("fake.py", content=binary_content)
        self.assertFalse(ok)
        self.assertIn("binary content", reason)

    def test_06_single_file_chunking(self):
        """CodeChunker.chunk_single_file must chunk individual files without loading full repository."""
        file_obj = {
            "id": "f-test-1",
            "path": "app/calculator.py",
            "language": "Python",
            "content": "class Calculator:\n    def add(self, a, b):\n        return a + b\n\n    def sub(self, a, b):\n        return a - b\n",
        }
        symbols = [
            {"name": "Calculator", "type": "class", "start_line": 1, "end_line": 6},
            {"name": "add", "type": "method", "start_line": 2, "end_line": 3},
            {"name": "sub", "type": "method", "start_line": 5, "end_line": 6},
        ]
        chunks = CodeChunker.chunk_single_file(
            repository_id="repo-test",
            file=file_obj,
            file_symbols=symbols,
            start_chunk_idx=0,
        )
        self.assertEqual(len(chunks), 3)
        self.assertEqual(chunks[0]["symbol_name"], "Calculator")
        self.assertEqual(chunks[1]["symbol_name"], "add")
        self.assertEqual(chunks[2]["symbol_name"], "sub")
        self.assertEqual(chunks[0]["id"], "chunk-repo-test-1")
        self.assertEqual(chunks[1]["id"], "chunk-repo-test-2")
        self.assertEqual(chunks[2]["id"], "chunk-repo-test-3")

    def test_07_lightweight_dependency_analysis(self):
        """StaticAnalyzer.analyze_dependencies_from_imports must compute dependencies from lightweight sets."""
        file_paths = {"app/main.py", "app/routers/auth.py", "app/database/session.py"}
        import_map = {
            "app/main.py": ["app.routers.auth", "fastapi"],
            "app/routers/auth.py": ["app.database.session", "jose"],
            "app/database/session.py": ["sqlalchemy"],
        }
        deps = StaticAnalyzer.analyze_dependencies_from_imports("repo-test", file_paths, import_map)
        self.assertGreaterEqual(len(deps), 3)

        internal_deps = [d for d in deps if d["category"] == "internal"]
        external_deps = [d for d in deps if d["category"] == "external"]

        self.assertGreaterEqual(len(internal_deps), 2)
        self.assertGreaterEqual(len(external_deps), 2)

    def test_08_embedding_model_singleton_reuse(self):
        """DefaultEmbeddingFunction must be lazily loaded and cached as a shared singleton."""
        fn1 = get_shared_onnx_embedding_function()
        fn2 = get_shared_onnx_embedding_function()
        self.assertIs(fn1, fn2, "Multiple calls must return the identical cached model instance.")

        emb_service = EmbeddingService()
        chroma_ef = RepoMindEmbeddingFunction(emb_service)
        self.assertEqual(chroma_ef.name(), "default")
        self.assertEqual(chroma_ef.get_config(), {})

    def test_09_batched_chroma_indexing(self):
        """ChromaService.add_chunks_batch must write chunks directly in bounded batches."""
        chroma_svc = ChromaService()
        test_chunks = [
            {
                "id": f"chunk-test-batch-{i}",
                "file_path": f"src/module_{i}.py",
                "file_id": f"f-{i}",
                "symbol_name": f"func_{i}",
                "symbol_type": "function",
                "language": "Python",
                "start_line": 1,
                "end_line": 10,
                "content": f"def func_{i}():\n    return {i}\n",
            }
            for i in range(15)
        ]
        chroma_svc.reset_collection("repo-test-batch")
        indexed_count = chroma_svc.add_chunks_batch("repo-test-batch", test_chunks)
        self.assertEqual(indexed_count, 15)

        # Verify retrieval works
        results = chroma_svc.similarity_search("repo-test-batch", "func_5", top_k=2)
        self.assertGreaterEqual(len(results), 1)

    def test_10_oversized_repository_error_handling(self):
        """Analysis must return HTTP 413 when total repository size exceeds memory limit."""
        # Create an oversized local payload
        huge_chunk = "x" * (200 * 1024)  # 200KB per file
        # 60 files * 200KB = 12MB > 10MB default limit
        oversized_files = [
            {"path": f"src/file_{i}.py", "content": f"# file {i}\n" + huge_chunk}
            for i in range(60)
        ]
        res = self.client.post("/api/repositories/analyze", json={"local_files": oversized_files})
        self.assertIn(res.status_code, [400, 413])
        self.assertIn("exceeds", res.json()["detail"].lower())

    def test_11_empty_eligible_files_error_handling(self):
        """Analysis must return HTTP 400 when repository contains no eligible code files."""
        ignored_only_files = [
            {"path": "package-lock.json", "content": '{"name": "test"}'},
            {"path": "node_modules/lib/index.js", "content": "console.log(1);"},
            {"path": "assets/photo.png", "content": "fake image binary data"},
        ]
        res = self.client.post("/api/repositories/analyze", json={"local_files": ignored_only_files})
        self.assertEqual(res.status_code, 400)
        self.assertIn("no eligible", res.json()["detail"].lower())

    def test_12_cors_headers_on_error_responses(self):
        """Error responses must carry Access-Control-Allow-Origin headers so Vercel can display the error."""
        # Trigger 400 error with empty body
        headers = {"Origin": "http://localhost:3000"}
        res = self.client.post("/api/repositories/analyze", json={}, headers=headers)
        self.assertGreaterEqual(res.status_code, 400)
        self.assertIn("access-control-allow-origin", res.headers)
        self.assertEqual(res.headers["access-control-allow-origin"], "http://localhost:3000")

    def test_13_cors_headers_with_vercel_domain(self):
        """Vercel production/preview deployment origins must be permitted and echoed on error responses."""
        vercel_origin = "https://code-archaeologist-preview-123.vercel.app"
        headers = {"Origin": vercel_origin}
        res = self.client.post("/api/repositories/analyze", json={}, headers=headers)
        self.assertGreaterEqual(res.status_code, 400)
        self.assertIn("access-control-allow-origin", res.headers)
        self.assertEqual(res.headers["access-control-allow-origin"], vercel_origin)
        self.assertEqual(res.headers.get("access-control-allow-credentials"), "true")

    def test_14_dynamic_environment_limits(self):
        """Configurable limits must dynamically reflect environment variable overrides."""
        import os
        from backend.app.services.repository_service import (
            get_max_file_size,
            get_max_repo_files,
            get_max_repo_total_size,
        )

        old_file_limit = os.environ.get("MAX_FILE_SIZE_BYTES")
        try:
            os.environ["MAX_FILE_SIZE_BYTES"] = "1024"
            self.assertEqual(get_max_file_size(), 1024)
            # A 2KB file must be rejected under 1KB limit
            ok, reason = is_eligible_file("test.py", size=2048)
            self.assertFalse(ok)
            self.assertIn("exceeds max", reason)
        finally:
            if old_file_limit is not None:
                os.environ["MAX_FILE_SIZE_BYTES"] = old_file_limit
            else:
                os.environ.pop("MAX_FILE_SIZE_BYTES", None)

    def test_15_generator_streaming_processing(self):
        """_process_and_persist must support streaming generator of files without pre-accumulating lists."""
        from backend.app.services.repository_service import RepositoryService
        from backend.app.database.mysql_db import SessionLocal

        db = SessionLocal()
        try:
            repo_svc = RepositoryService(chroma_service=ChromaService())
            repo_id = "repo-test-stream"

            def stream_files():
                for i in range(3):
                    yield {
                        "id": f"f-{repo_id}-{i}",
                        "repository_id": repo_id,
                        "path": f"src/stream_mod_{i}.py",
                        "name": f"stream_mod_{i}.py",
                        "language": "Python",
                        "size": 50,
                        "content": f"def stream_fn_{i}():\n    return {i}\n",
                    }

            result = repo_svc._process_and_persist(
                db=db,
                repo_id=repo_id,
                repo_name="stream-test-repo",
                owner="tester",
                url="local://stream",
                description="Testing generator streaming pipeline",
                raw_files=stream_files(),
            )
            self.assertEqual(result["id"], repo_id)
            self.assertEqual(result["stats"]["filesCount"], 3)
            self.assertGreaterEqual(result["stats"]["functionsCount"], 3)
        finally:
            db.close()

    def test_16_file_filtering_additional_exclusions(self):
        """Must exclude site-packages, Pipfile.lock, and bundled stylesheets."""
        self.assertFalse(is_eligible_file("venv/site-packages/pkg.py")[0])
        self.assertFalse(is_eligible_file("Pipfile.lock")[0])
        self.assertFalse(is_eligible_file("dist/assets/app.bundle.css")[0])
        self.assertFalse(is_eligible_file(".yarn/cache/foo.js")[0])


if __name__ == "__main__":
    unittest.main()

