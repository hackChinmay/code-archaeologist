"""Static code analyzer extracting dependency graphs, call hierarchies, and architectural modules."""
import os
from typing import List, Dict, Any, Set

class StaticAnalyzer:
    """Computes internal/external dependencies, fan-in/fan-out, and architecture graphs."""

    @staticmethod
    def analyze_dependencies_from_imports(
        repository_id: str,
        file_paths: Set[str],
        file_import_map: Dict[str, List[str]],
    ) -> List[Dict[str, Any]]:
        """
        Derive internal file-to-file dependencies and external package references
        using lightweight path and import string sets, without holding file contents in RAM.
        """
        dependencies: List[Dict[str, Any]] = []
        file_modules = {os.path.splitext(os.path.basename(p))[0]: p for p in file_paths}

        dep_idx = 0
        for path, imported_targets in file_import_map.items():
            for imp in imported_targets:
                dep_idx += 1
                clean_imp = imp.strip().replace(";", "").strip("\"'")
                root_module = clean_imp.split(".")[0].split("/")[0]
                leaf_module = clean_imp.split(".")[-1].split("/")[-1]
                normalized_imp_path = clean_imp.replace(".", "/")

                # Check if this import matches a project file
                matched_internal_path = None
                if clean_imp in file_paths:
                    matched_internal_path = clean_imp
                elif leaf_module in file_modules:
                    matched_internal_path = file_modules[leaf_module]
                elif root_module in file_modules:
                    matched_internal_path = file_modules[root_module]
                else:
                    # Check partial directory match or slash normalized path
                    for fp in file_paths:
                        if (
                            clean_imp in fp
                            or normalized_imp_path in fp
                            or fp.endswith(f"{clean_imp}.py")
                            or fp.endswith(f"{clean_imp}.ts")
                            or fp.endswith(f"/{leaf_module}.py")
                            or fp.endswith(f"/{leaf_module}.ts")
                        ):
                            matched_internal_path = fp
                            break

                if matched_internal_path and matched_internal_path != path:
                    dependencies.append({
                        "id": f"dep-{repository_id}-{dep_idx}",
                        "repository_id": repository_id,
                        "source": path,
                        "target": matched_internal_path,
                        "relationship_type": "imports",
                        "category": "internal",
                    })
                elif not matched_internal_path:
                    # External third-party package
                    dependencies.append({
                        "id": f"dep-{repository_id}-{dep_idx}",
                        "repository_id": repository_id,
                        "source": path,
                        "target": root_module,
                        "relationship_type": "imports",
                        "category": "external",
                    })

        return dependencies

    @staticmethod
    def analyze_dependencies(
        repository_id: str,
        files: List[Dict[str, Any]],
        parsed_results: Dict[str, Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """
        Derive internal file-to-file dependencies and external package references.
        """
        file_paths = {f["path"] for f in files}
        file_import_map: Dict[str, List[str]] = {}
        for f in files:
            path = f["path"]
            parse_info = parsed_results.get(path, {"symbols": [], "imports": [], "calls": []})
            file_import_map[path] = parse_info.get("imports", [])

        return StaticAnalyzer.analyze_dependencies_from_imports(
            repository_id=repository_id,
            file_paths=file_paths,
            file_import_map=file_import_map,
        )

    @staticmethod
    def build_architecture_graph(
        repository: Dict[str, Any],
        files: List[Dict[str, Any]],
        symbols: List[Dict[str, Any]],
        dependencies: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Build topological Directed Acyclic Graph structure matching ArchitectureView.
        """
        repo_id = repository["id"]
        repo_name = repository.get("name", repo_id)
        repo_node_id = f"repo-{repo_id}"

        nodes_map: Dict[str, Dict[str, Any]] = {}
        edges: List[Dict[str, Any]] = []

        # 1. Root Repository Node
        nodes_map[repo_node_id] = {
            "id": repo_node_id,
            "name": repo_name,
            "type": "repository",
            "degree": 0,
            "inDegree": 0,
            "outDegree": 0,
            "symbolCount": len(symbols),
            "linesCount": sum(f.get("lines_count", 0) for f in files),
            "language": repository.get("stats", {}).get("languages", [{}])[0].get("name", "Polyglot") if repository.get("stats") else "Codebase",
        }

        # 2. Extract Inferred Modules / Directories
        dir_set: Set[str] = set()
        for f in files:
            d = os.path.dirname(f["path"])
            if d and d not in [".", ""]:
                dir_set.add(d)

        for d in dir_set:
            dir_id = f"dir-{d}"
            dir_name = os.path.basename(d) or d
            nodes_map[dir_id] = {
                "id": dir_id,
                "name": dir_name,
                "type": "directory",
                "path": d,
                "directory": d,
                "parent": repo_node_id,
                "degree": 0,
                "inDegree": 0,
                "outDegree": 0,
                "symbolCount": sum(f.get("symbols_count", 0) for f in files if f["path"].startswith(d)),
            }
            edges.append({
                "id": f"edge-{repo_node_id}-{dir_id}",
                "source": repo_node_id,
                "target": dir_id,
                "relationship": "contains",
            })

        # 3. Add File Nodes & Containment
        for f in files:
            d = os.path.dirname(f["path"])
            parent_dir_id = f"dir-{d}" if (d and d not in [".", ""]) else repo_node_id
            path = f["path"]

            nodes_map[path] = {
                "id": path,
                "name": f.get("name", os.path.basename(path)),
                "type": "file",
                "path": path,
                "directory": d if d != "." else "root",
                "parent": parent_dir_id,
                "language": f.get("language", "Text"),
                "symbolCount": f.get("symbols_count", 0),
                "linesCount": f.get("lines_count", 0),
                "degree": 0,
                "inDegree": 0,
                "outDegree": 0,
            }
            edges.append({
                "id": f"edge-{parent_dir_id}-{path}",
                "source": parent_dir_id,
                "target": path,
                "relationship": "contains",
            })

        # 4. Add Class Symbols
        for s in symbols:
            if s.get("type") == "class":
                class_id = f"class-{s['file_path']}-{s['name']}"
                method_count = len([m for m in symbols if m.get("file_path") == s["file_path"] and m.get("parent_symbol") == s["name"]])
                nodes_map[class_id] = {
                    "id": class_id,
                    "name": s["name"],
                    "type": "class",
                    "path": s["file_path"],
                    "parent": s["file_path"],
                    "degree": 0,
                    "inDegree": 0,
                    "outDegree": 0,
                    "details": {
                        "signature": s.get("signature"),
                        "methodsCount": method_count,
                        "docstring": s.get("docstring"),
                    },
                }
                edges.append({
                    "id": f"edge-{s['file_path']}-{class_id}",
                    "source": s["file_path"],
                    "target": class_id,
                    "relationship": "contains",
                })

        # 5. Add Function Symbols
        for s in symbols:
            if s.get("type") == "function" and not s.get("parent_symbol"):
                func_id = f"func-{s['file_path']}-{s['name']}"
                nodes_map[func_id] = {
                    "id": func_id,
                    "name": s["name"],
                    "type": "function",
                    "path": s["file_path"],
                    "parent": s["file_path"],
                    "degree": 0,
                    "inDegree": 0,
                    "outDegree": 0,
                    "details": {
                        "signature": s.get("signature"),
                        "docstring": s.get("docstring"),
                    },
                }
                edges.append({
                    "id": f"edge-{s['file_path']}-{func_id}",
                    "source": s["file_path"],
                    "target": func_id,
                    "relationship": "contains",
                })

        # 6. Add External Package Nodes & Dependency Edges
        for d in dependencies:
            target = d["target"]
            if target not in nodes_map:
                nodes_map[target] = {
                    "id": target,
                    "name": target,
                    "type": "external" if d.get("category") == "external" else "module",
                    "degree": 0,
                    "inDegree": 0,
                    "outDegree": 0,
                }

            edges.append({
                "id": d["id"],
                "source": d["source"],
                "target": target,
                "relationship": d.get("relationship_type", "imports"),
            })

        # 7. Calculate Degrees
        for edge in edges:
            src = nodes_map.get(edge["source"])
            tgt = nodes_map.get(edge["target"])
            if src:
                src["outDegree"] = src.get("outDegree", 0) + 1
                src["degree"] = src.get("degree", 0) + 1
            if tgt:
                tgt["inDegree"] = tgt.get("inDegree", 0) + 1
                tgt["degree"] = tgt.get("degree", 0) + 1

        all_nodes = list(nodes_map.values())
        files_list = [n for n in all_nodes if n["type"] == "file"]
        dir_list = [n for n in all_nodes if n["type"] == "directory"]
        class_list = [n for n in all_nodes if n["type"] == "class"]
        func_list = [n for n in all_nodes if n["type"] == "function"]
        ext_list = [n for n in all_nodes if n["type"] == "external"]

        # Main Entry Point Detection
        entry_candidates = ["main.py", "app.py", "index.ts", "server.ts", "main.ts", "Application.java", "InventoryApplication.java"]
        main_entry_point = None
        for cand in entry_candidates:
            found = next((f for f in files if f.get("name", "").lower() == cand.lower() or f["path"].lower().endswith(cand.lower())), None)
            if found:
                main_entry_point = found.get("name", os.path.basename(found["path"]))
                break
        if not main_entry_point and files_list:
            main_entry_point = files_list[0]["name"]

        # Most Connected Module
        non_root = [n for n in all_nodes if n["type"] != "repository"]
        non_root.sort(key=lambda x: x.get("degree", 0), reverse=True)
        most_connected = non_root[0]["name"] if non_root else None

        primary_language = files[0].get("language", "Polyglot") if files else "Polyglot"

        summary = {
            "totalNodes": len(all_nodes),
            "totalEdges": len(edges),
            "filesCount": len(files_list),
            "modulesCount": len(dir_set),
            "classesCount": len(class_list),
            "functionsCount": len(func_list),
            "externalDepsCount": len(ext_list),
            "mainEntryPoint": main_entry_point,
            "mostConnectedModule": most_connected,
            "primaryLanguage": primary_language,
            "aiSummary": repository.get("architecture_summary") or f"Code Archaeologist static analysis identified {len(dir_set)} architectural modules and {len(files_list)} source files. The primary entry point is {main_entry_point}, with dependency hubs around {most_connected}.",
        }

        return {
            "nodes": all_nodes,
            "edges": edges,
            "summary": summary,
        }
