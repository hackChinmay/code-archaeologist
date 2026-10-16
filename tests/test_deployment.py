"""Deployment readiness integration test suite for Code Archaeologist (RepoMind).
Tests health check, repository ingestion, AST symbols, architecture DAG,
ChromaDB semantic search, RAG Q&A, and documentation generation.
"""
import unittest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.database.mysql_db import SessionLocal
from backend.app.services.repository_service import RepositoryService
from backend.app.rag.chroma_service import ChromaService


class TestDeploymentReadiness(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        # Ensure seed repo is loaded
        db = SessionLocal()
        try:
            repo_svc = RepositoryService(chroma_service=ChromaService())
            repos = repo_svc.list_repositories(db)
            if not repos:
                repo_svc.analyze_repository(db=db, sample_id="repo-python-fastapi")
        finally:
            db.close()

    def test_01_root_endpoint(self):
        """Root endpoint must return 200 with service metadata."""
        res = self.client.get("/")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("service", data)
        self.assertIn("docs", data)

    def test_02_health_endpoint(self):
        """Health check /health must return 200 with component statuses."""
        res = self.client.get("/health")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("status", data)
        self.assertEqual(data["service"], "repomind-fastapi")
        self.assertIn("database", data)
        self.assertIn("vector_store", data)

    def test_03_list_repositories(self):
        """GET /api/repositories must return non-empty list of repositories."""
        res = self.client.get("/api/repositories")
        self.assertEqual(res.status_code, 200)
        repos = res.json()
        self.assertIsInstance(repos, list)
        self.assertGreaterEqual(len(repos), 1)
        self.assertIn("id", repos[0])
        self.assertIn("name", repos[0])
        self.assertIn("stats", repos[0])

    def test_04_get_repository_details(self):
        """GET /api/repositories/{id} must return single repo object."""
        res = self.client.get("/api/repositories")
        repo_id = res.json()[0]["id"]

        detail_res = self.client.get(f"/api/repositories/{repo_id}")
        self.assertEqual(detail_res.status_code, 200)
        data = detail_res.json()
        self.assertEqual(data["id"], repo_id)
        self.assertIn("stats", data)

    def test_05_get_files_and_file_detail(self):
        """GET /api/repositories/{id}/files and /{id}/files/{file_id} must return files."""
        res = self.client.get("/api/repositories")
        repo_id = res.json()[0]["id"]

        files_res = self.client.get(f"/api/repositories/{repo_id}/files")
        self.assertEqual(files_res.status_code, 200)
        files = files_res.json()
        self.assertIsInstance(files, list)
        self.assertGreaterEqual(len(files), 1)

        first_file = files[0]
        file_id = first_file["id"]
        detail_res = self.client.get(f"/api/repositories/{repo_id}/files/{file_id}")
        self.assertEqual(detail_res.status_code, 200)
        data = detail_res.json()
        self.assertTrue("file" in data or "content" in data)

    def test_06_get_symbols_endpoint(self):
        """GET /api/repositories/{id}/symbols must return AST symbols with camelCase & filePath."""
        res = self.client.get("/api/repositories")
        repo_id = res.json()[0]["id"]

        sym_res = self.client.get(f"/api/repositories/{repo_id}/symbols")
        self.assertEqual(sym_res.status_code, 200)
        symbols = sym_res.json()
        self.assertIsInstance(symbols, list)
        self.assertGreaterEqual(len(symbols), 1)
        self.assertIn("filePath", symbols[0])
        self.assertIn("name", symbols[0])
        self.assertIn("type", symbols[0])
        self.assertIn("startLine", symbols[0])

    def test_07_get_architecture_dag(self):
        """GET /api/repositories/{id}/architecture must return nodes and edges."""
        res = self.client.get("/api/repositories")
        repo_id = res.json()[0]["id"]

        arch_res = self.client.get(f"/api/repositories/{repo_id}/architecture")
        self.assertEqual(arch_res.status_code, 200)
        data = arch_res.json()
        self.assertIn("nodes", data)
        self.assertIn("edges", data)
        self.assertIn("summary", data)
        self.assertGreaterEqual(len(data["nodes"]), 1)

    def test_08_get_dependencies(self):
        """GET /api/repositories/{id}/dependencies must return dependency graph."""
        res = self.client.get("/api/repositories")
        repo_id = res.json()[0]["id"]

        deps_res = self.client.get(f"/api/repositories/{repo_id}/dependencies")
        self.assertEqual(deps_res.status_code, 200)
        deps = deps_res.json()
        self.assertIsInstance(deps, list)

    def test_09_semantic_search(self):
        """POST /api/repositories/{id}/search must retrieve relevant code chunks."""
        res = self.client.get("/api/repositories")
        repo_id = res.json()[0]["id"]

        search_res = self.client.post(
            f"/api/repositories/{repo_id}/search",
            json={"query": "JWT token authentication and login verification", "topK": 3},
        )
        self.assertEqual(search_res.status_code, 200)
        data = search_res.json()
        self.assertIn("results", data)
        if data["results"]:
            chunk = data["results"][0]["chunk"]
            self.assertTrue("filePath" in chunk or "file_path" in chunk)
            self.assertTrue("startLine" in chunk or "start_line" in chunk)

    def test_10_rag_assistant_query(self):
        """POST /api/repositories/{id}/ask must return answer with evidence citations."""
        res = self.client.get("/api/repositories")
        repo_id = res.json()[0]["id"]

        ask_res = self.client.post(
            f"/api/repositories/{repo_id}/ask",
            json={"question": "Where is the authentication endpoint defined?"},
        )
        self.assertEqual(ask_res.status_code, 200)
        data = ask_res.json()
        self.assertIn("answer", data)
        self.assertTrue("confidenceStatus" in data or "confidence_status" in data)
        self.assertIn("evidence", data)
        if data["evidence"]:
            ev = data["evidence"][0]
            self.assertTrue("filePath" in ev or "file_path" in ev)

    def test_11_documentation_generation(self):
        """POST /api/repositories/{id}/documentation must generate structured technical docs."""
        res = self.client.get("/api/repositories")
        repo_id = res.json()[0]["id"]

        doc_res = self.client.post(
            f"/api/repositories/{repo_id}/documentation",
            json={"scope": "project", "targetPath": "app/main.py"},
        )
        self.assertEqual(doc_res.status_code, 200)
        data = doc_res.json()
        self.assertIn("content", data)
        self.assertIn("title", data)
        self.assertIn("evidenceSources", data)

    def test_12_evaluation_metrics(self):
        """GET /api/repositories/{id}/evaluation must return empirical metrics without fabrication."""
        res = self.client.get("/api/repositories")
        repo_id = res.json()[0]["id"]

        eval_res = self.client.get(f"/api/repositories/{repo_id}/evaluation")
        self.assertEqual(eval_res.status_code, 200)
        data = eval_res.json()
        self.assertIn("retrieval", data)
        self.assertIn("benchmarkQueries", data)
        self.assertIn("mrr", data["retrieval"])

    def test_13_measure_benchmark_probe(self):
        """POST /api/repositories/{id}/evaluation/measure must execute live benchmark query."""
        res = self.client.get("/api/repositories")
        repo_id = res.json()[0]["id"]

        probe_res = self.client.post(
            f"/api/repositories/{repo_id}/evaluation/measure",
            json={"customQuery": "Where is token decoding implemented?", "expectedFile": "tokens.py"},
        )
        self.assertEqual(probe_res.status_code, 200)
        data = probe_res.json()
        self.assertIn("latencyMs", data)
        self.assertIn("retrievedFiles", data)

    def test_14_local_file_upload(self):
        """POST /api/repositories/analyze must accept and index local uploaded files."""
        res = self.client.post(
            "/api/repositories/analyze",
            json={
                "localFiles": [
                    {
                        "path": "server.py",
                        "content": "from fastapi import FastAPI\napp = FastAPI()\n@app.get('/')\ndef index(): return {'ok': True}",
                    },
                    {
                        "path": "config.py",
                        "content": "class Config:\n    SECRET = 'test'",
                    },
                ]
            },
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("id", data)
        self.assertEqual(data["stats"]["filesCount"], 2)


if __name__ == "__main__":
    unittest.main()
