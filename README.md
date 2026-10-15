# RepoMind

## AI-Powered Codebase Understanding and Software Analysis Platform

**Academic Course:** BITE308L: Artificial Intelligence  
**Semester:** Fall Semester 2026–27  
**Project Domain:** Artificial Intelligence, Software Engineering, Developer Tools  
**Team Members:**
- **Chinmay Agrawal** — 24BIT0453
- **Aman Kumar** — 24BIT0357

---

## 1. Problem Statement & Motivation

Modern software engineering involves reading, auditing, and maintaining complex legacy codebases, microservices, and multi-language open-source repositories. Traditional code search is limited to exact text or keyword regexes, while generic LLMs hallucinate non-existent files and functions when lacking deep repository grounding.

**RepoMind** bridges this gap by combining:
1. **Concrete static program analysis** (Tree-sitter AST parsing, symbol extraction, import/call graph derivation)
2. **Hierarchical semantic code chunking** (preserving class and function contextual boundaries)
3. **ChromaDB vector embedding index**
4. **Retrieval-Augmented Generation (RAG)** using **Google Gemini 3.8 Flash**
5. **Rigorous evidence verification**: every answer is accompanied by verifiable, clickable file paths, line ranges, and AST-extracted source citations.

---

## 2. Core Architecture Pipeline

```
USER INPUT (GitHub URL / Local Directory)
               │
               ▼
       Repository Ingestion
   (Sanitization, Filter ignored dirs)
               │
               ▼
        Source Code Files
               │
               ▼
      Tree-sitter / AST Parsing
 (Python, TypeScript, JavaScript, Java)
               │
               ▼
         Static Analysis
 (Symbols, Dependencies, Call Graphs)
               │
               ▼
     Hierarchical Code Chunking
               │
               ▼
      Embeddings Generation
               │
               ▼
         ChromaDB Vector Store
  (Isolated repository collections)
               │
               ▼
    Semantic Similarity Retrieval
  (Cosine distance & BM25 ranking)
               │
               ▼
         Context Assembly
               │
               ▼
     Google Gemini 3.8 Flash RAG
 (Strict anti-hallucination prompt)
               │
               ▼
      Grounded AI Response
   + Clickable Verifiable Evidence
```

---

## 3. Technology Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS v4, Lucide Icons, Motion
- **Backend Services:** Node.js Express full-stack runtime (live preview) + Python FastAPI backend
- **Code Analysis:** Tree-sitter AST parsing & static dependency extractors
- **Vector Database:** ChromaDB
- **RAG & LLM:** LangChain patterns & Google Gemini API (`gemini-3.8-flash`) via `@google/genai`
- **Relational Metadata:** MySQL 8.0 / SQLite / SQLAlchemy
- **Containerization:** Docker & Docker Compose

---

## 4. Getting Started Locally

### Prerequisites
- Node.js 20+ LTS
- Python 3.10+ (for FastAPI backend)
- Docker & Docker Compose (optional)
- Gemini API Key (from Google AI Studio)

### Environment Variables (.env)
```bash
GEMINI_API_KEY="your-google-gemini-api-key"
DATABASE_URL="sqlite:///./repomind.db" # or MySQL connection string
CHROMA_HOST="localhost"
CHROMA_PORT=8000
GITHUB_TOKEN="" # Optional for higher GitHub API rate limits
```

### Running the Full-Stack Platform
```bash
# 1. Install dependencies
npm install

# 2. Run the platform (launches Express API + React SPA)
npm run dev

# 3. Open browser at http://localhost:3000
```

### Running with Docker Compose
```bash
docker-compose up --build
```
This spins up:
- Frontend & API: `http://localhost:3000`
- FastAPI Backend: `http://localhost:8000`
- MySQL Database: `localhost:3306`
- ChromaDB: `localhost:8001`

---

## 5. Academic Evaluation Metrics (BITE308L Alignment)

Aligned with the Review-1 Project Report, RepoMind measures:

| Metric Category | Metrics Measured | Target Objective |
| :--- | :--- | :--- |
| **Retrieval** | Precision@1, Precision@3, Precision@5, Recall@5, MRR | > 0.85 MRR on benchmark corpus |
| **Answer Quality** | Faithfulness (RAGAS style), Correctness, Completeness | Zero hallucination without cited evidence |
| **System** | Search latency (ms), Indexing duration (s), Chunks indexed | Sub-100ms vector retrieval |
| **Usability** | Task completion rate, Developer comprehension duration | High usability rating |

---

## 6. Documented Limitations

1. **Language Grammars:** Initial release supports Python, TypeScript, JavaScript, and Java. Additional grammars (Go, Rust, C++) can be added modularly.
2. **Context Window Limits:** Very large single files are windowed into sub-chunks to fit retrieval boundaries.
3. **Private Repositories:** Requires user-provided `GITHUB_TOKEN` for authorized OAuth clone.
