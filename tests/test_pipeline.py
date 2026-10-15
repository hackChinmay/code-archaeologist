"""Unit tests for RepoMind parsing and chunking pipeline."""
import unittest
from backend.app.analyzers.tree_sitter_parser import TreeSitterParser

class TestRepoMindPipeline(unittest.TestCase):
    def test_python_ast_parsing(self):
        parser = TreeSitterParser()
        code = """
class AuthService:
    def authenticate_user(self, username: str, password: str):
        return True
"""
        result = parser.parse_file("auth.py", code, "Python")
        symbols = result if isinstance(result, list) else result.get("symbols", [])
        self.assertGreaterEqual(len(symbols), 2)
        class_syms = [s for s in symbols if s["type"] == "class"]
        func_syms = [s for s in symbols if s["type"] in ["function", "method"]]
        self.assertEqual(len(class_syms), 1)
        self.assertEqual(class_syms[0]["name"], "AuthService")
        self.assertEqual(len(func_syms), 1)
        self.assertEqual(func_syms[0]["name"], "authenticate_user")

    def test_typescript_symbol_extraction(self):
        parser = TreeSitterParser()
        code = """
export class VectorStore {
  public search(query: string) {
    return [];
  }
}
"""
        result = parser.parse_file("vector.ts", code, "TypeScript")
        symbols = result if isinstance(result, list) else result.get("symbols", [])
        self.assertTrue(any(s["name"] == "VectorStore" for s in symbols))

if __name__ == "__main__":
    unittest.main()
