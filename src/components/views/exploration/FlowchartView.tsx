import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Download,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Cpu,
  Search,
  Settings,
  BarChart3,
  ListChecks,
  User,
  ArrowRight,
  FileCode,
  FileText,
  Binary,
  ShieldCheck,
  ExternalLink,
  Sun,
  Moon,
  Info,
  ChevronRight,
  X,
  Code2,
  Database,
  Terminal,
} from 'lucide-react';
import type { Repository, RepoFile, SymbolItem } from '../../../types/index.ts';

export type FlowchartMode = 'pipeline' | 'repository';
export type FlowchartTheme = 'light' | 'dark';

export interface FlowchartNode {
  id: string;
  type: 'start' | 'input' | 'process' | 'decision' | 'success' | 'error' | 'ai' | 'user' | 'finish';
  title: string;
  subtitle?: string;
  category?: string;
  iconName?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  files?: string[];
  symbols?: string[];
  details?: string;
  codeSnippet?: string;
}

export interface FlowchartEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  dashed?: boolean;
  color?: string;
  points: { x: number; y: number }[];
}

interface FlowchartViewProps {
  currentRepo: Repository | null;
  files: RepoFile[];
  symbols?: SymbolItem[];
  onSelectFile?: (file: RepoFile) => void;
  onAskAI?: (question: string) => void;
}

export const FlowchartView: React.FC<FlowchartViewProps> = ({
  currentRepo,
  files,
  symbols = [],
  onSelectFile,
  onAskAI,
}) => {
  const [mode, setMode] = useState<FlowchartMode>('pipeline');
  const [theme, setTheme] = useState<FlowchartTheme>('light');

  // Base coordinate bounding box for SVG viewBox (Zero clipping guaranteed, generous margins)
  const BASE_VB = useMemo(() => {
    return mode === 'pipeline'
      ? { x: 0, y: 0, w: 1040, h: 950 }
      : { x: 0, y: 0, w: 1040, h: 860 };
  }, [mode]);

  const [vb, setVb] = useState(BASE_VB);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [vbStart, setVbStart] = useState(BASE_VB);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(-1);
  const [isLegendOpen, setIsLegendOpen] = useState(true);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Sync viewBox on mode change
  useEffect(() => {
    setVb(BASE_VB);
  }, [BASE_VB]);

  // -------------------------------------------------------------
  // Data Model for Mode 1: Python Syntax & AI Repair Pipeline (Reference Image 2)
  // -------------------------------------------------------------
  const pipelineFlow = useMemo(() => {
    const nodes: FlowchartNode[] = [
      {
        id: 'start',
        type: 'start',
        title: 'Start',
        x: 340,
        y: 35,
        width: 140,
        height: 38,
        details: 'Initial entrypoint of the syntax analysis and verification pipeline.',
      },
      {
        id: 'input',
        type: 'input',
        title: 'Enter Python Source Code',
        subtitle: '(User Input)',
        iconName: 'file-text',
        x: 340,
        y: 105,
        width: 280,
        height: 58,
        files: files.slice(0, 3).map((f) => f.path),
        details: 'Ingestion of raw developer source code from editor, CLI, or repository clone.',
        codeSnippet: `def authenticate_user(username: str, password: str):\n    # User provided source file\n    return verify_hash(password, stored_hash)`,
      },
      {
        id: 'parser',
        type: 'process',
        title: 'Python Syntax Parser',
        subtitle: '(ast.parse) Analyze code for syntax errors',
        category: 'AST Parsing',
        iconName: 'python',
        x: 340,
        y: 190,
        width: 300,
        height: 66,
        files: files.filter((f) => f.path.includes('parser') || f.language === 'Python').map((f) => f.path),
        symbols: ['TreeSitterParser', 'parse_file', 'ast.parse'],
        details: 'Constructs Concrete / Abstract Syntax Tree to validate grammar tokens and indentations.',
        codeSnippet: `import ast\ntree = ast.parse(source_code, filename="auth.py")`,
      },
      {
        id: 'decision',
        type: 'decision',
        title: 'Parsing Successful?',
        x: 340,
        y: 295,
        width: 170,
        height: 95,
        details: 'Grammar gatekeeper: Checks if source code passes language syntax rules without SyntaxError.',
      },
      // Left Branch (Yes)
      {
        id: 'valid',
        type: 'success',
        title: 'Display Syntax Valid',
        subtitle: '(No errors found)',
        iconName: 'check-circle',
        x: 165,
        y: 415,
        width: 210,
        height: 70,
        details: 'Source code satisfies all language syntax rules. Safe to proceed to semantic chunking & indexing.',
      },
      // Right Branch (No)
      {
        id: 'classify_err',
        type: 'error',
        title: 'Classify Syntax Error',
        subtitle: '(Error type, location, message)',
        iconName: 'search',
        x: 620,
        y: 360,
        width: 270,
        height: 62,
        details: 'Isolates syntax token anomalies, line/column coordinates, and error category (e.g. IndentationError, UnterminatedString).',
      },
      {
        id: 'gen_repair',
        type: 'process',
        title: 'Generate Repair Candidates',
        subtitle: '(Apply predefined rules)',
        category: 'Rule Engine',
        iconName: 'settings',
        x: 620,
        y: 442,
        width: 270,
        height: 62,
        details: 'Synthesizes structural repair proposals using heuristic grammar substitution and AST rewrite rules.',
      },
      {
        id: 'rank_cand',
        type: 'process',
        title: 'Rank Candidates',
        subtitle: '(Token-level edit distance and other criteria)',
        category: 'Optimization',
        iconName: 'bar-chart',
        x: 620,
        y: 526,
        width: 270,
        height: 66,
        details: 'Evaluates candidates based on Levenshtein token edit distance, symbol continuity, and compile probability.',
      },
      {
        id: 'reparse_cand',
        type: 'process',
        title: 'Re-parse Each Candidate',
        subtitle: '(Validate using syntax parser)',
        category: 'Verification',
        iconName: 'terminal',
        x: 620,
        y: 610,
        width: 270,
        height: 62,
        details: 'Re-runs the AST parser on candidate patches to guarantee generated repairs produce valid syntax.',
      },
      {
        id: 'display_results',
        type: 'error',
        title: 'Display Validated Results',
        subtitle: '(Candidate list with validation status and edit cost)',
        iconName: 'list-checks',
        x: 620,
        y: 696,
        width: 290,
        height: 70,
        details: 'Presents verified candidate fixes to developer alongside semantic confidence scores.',
      },
      // Auxiliary AI Component (Dashed)
      {
        id: 'ai_explainer',
        type: 'ai',
        title: 'Optional AI Explanation Component',
        subtitle: 'Generate natural language explanation of the error and suggested fixes (Based on parser findings)',
        iconName: 'sparkles',
        x: 890,
        y: 440,
        width: 210,
        height: 200,
        symbols: ['Google Gemini 3.8 Flash', 'RAG Engine'],
        details: 'Utilizes Google Gemini 3.8 Flash to interpret compiler error traces and recommend idiomatic code patches.',
      },
      // Convergence (Bottom)
      {
        id: 'user_review',
        type: 'user',
        title: 'User Reviews Result',
        subtitle: '(Accept a suggestion, modify code, or try again)',
        iconName: 'user',
        x: 450,
        y: 785,
        width: 360,
        height: 64,
        details: 'Developer examines proposed repairs, diffs, or chooses to write custom adjustments.',
      },
      // Finish / Loopback
      {
        id: 'finish',
        type: 'finish',
        title: 'Modify Code or Finish',
        subtitle: '(Repeat Analysis if needed)',
        x: 450,
        y: 865,
        width: 260,
        height: 44,
        details: 'End of current iteration. Loops back to input step for re-analysis.',
      },
    ];

    const edges: FlowchartEdge[] = [
      // Start -> Input
      {
        id: 'e-start-input',
        from: 'start',
        to: 'input',
        points: [
          { x: 340, y: 54 },
          { x: 340, y: 76 },
        ],
      },
      // Input -> Parser
      {
        id: 'e-input-parser',
        from: 'input',
        to: 'parser',
        points: [
          { x: 340, y: 134 },
          { x: 340, y: 157 },
        ],
      },
      // Parser -> Decision
      {
        id: 'e-parser-decision',
        from: 'parser',
        to: 'decision',
        points: [
          { x: 340, y: 223 },
          { x: 340, y: 247 },
        ],
      },
      // Decision -> Yes (Display Syntax Valid)
      {
        id: 'e-decision-yes',
        from: 'decision',
        to: 'valid',
        label: 'Yes',
        points: [
          { x: 255, y: 295 },
          { x: 165, y: 295 },
          { x: 165, y: 380 },
        ],
      },
      // Decision -> No (Classify Syntax Error)
      {
        id: 'e-decision-no',
        from: 'decision',
        to: 'classify_err',
        label: 'No',
        points: [
          { x: 425, y: 295 },
          { x: 620, y: 295 },
          { x: 620, y: 329 },
        ],
      },
      // Classify -> Generate Repair
      {
        id: 'e-classify-repair',
        from: 'classify_err',
        to: 'gen_repair',
        points: [
          { x: 620, y: 391 },
          { x: 620, y: 411 },
        ],
      },
      // Generate Repair -> Rank Candidates
      {
        id: 'e-repair-rank',
        from: 'gen_repair',
        to: 'rank_cand',
        points: [
          { x: 620, y: 473 },
          { x: 620, y: 493 },
        ],
      },
      // Rank -> Re-parse
      {
        id: 'e-rank-reparse',
        from: 'rank_cand',
        to: 'reparse_cand',
        points: [
          { x: 620, y: 559 },
          { x: 620, y: 579 },
        ],
      },
      // Re-parse -> Display Results
      {
        id: 'e-reparse-display',
        from: 'reparse_cand',
        to: 'display_results',
        points: [
          { x: 620, y: 641 },
          { x: 620, y: 661 },
        ],
      },
      // Classify -> AI Explainer (dashed)
      {
        id: 'e-classify-ai',
        from: 'classify_err',
        to: 'ai_explainer',
        dashed: true,
        color: '#0284c7',
        points: [
          { x: 755, y: 360 },
          { x: 890, y: 360 },
          { x: 890, y: 340 },
        ],
      },
      // AI Explainer -> Display Results (dashed)
      {
        id: 'e-ai-display',
        from: 'ai_explainer',
        to: 'display_results',
        dashed: true,
        color: '#0284c7',
        points: [
          { x: 890, y: 540 },
          { x: 890, y: 696 },
          { x: 765, y: 696 },
        ],
      },
      // Display Syntax Valid -> User Review
      {
        id: 'e-valid-user',
        from: 'valid',
        to: 'user_review',
        points: [
          { x: 165, y: 450 },
          { x: 165, y: 785 },
          { x: 270, y: 785 },
        ],
      },
      // Display Results -> User Review (Routed cleanly to right edge of User Reviews Result)
      {
        id: 'e-display-user',
        from: 'display_results',
        to: 'user_review',
        points: [
          { x: 620, y: 731 },
          { x: 620, y: 755 },
          { x: 690, y: 755 },
          { x: 690, y: 785 },
          { x: 630, y: 785 },
        ],
      },
      // User Review -> Finish
      {
        id: 'e-user-finish',
        from: 'user_review',
        to: 'finish',
        points: [
          { x: 450, y: 817 },
          { x: 450, y: 843 },
        ],
      },
      // Feedback Loopback Arrow: Finish -> Input (around left side, cleanly docked into parallelogram)
      {
        id: 'e-loopback',
        from: 'finish',
        to: 'input',
        points: [
          { x: 320, y: 865 },
          { x: 45, y: 865 },
          { x: 45, y: 105 },
          { x: 204, y: 105 },
        ],
      },
    ];

    const simulationSteps = [
      'start',
      'input',
      'parser',
      'decision',
      'classify_err',
      'ai_explainer',
      'gen_repair',
      'rank_cand',
      'reparse_cand',
      'display_results',
      'user_review',
      'finish',
      'input',
      'parser',
      'decision',
      'valid',
      'user_review',
      'finish',
    ];

    return { nodes, edges, simulationSteps };
  }, [files]);

  // -------------------------------------------------------------
  // Data Model for Mode 2: Dynamic Repository Execution Architecture Flow
  // -------------------------------------------------------------
  const repoFlow = useMemo(() => {
    const repoName = currentRepo?.name || 'repository';
    const isAuthService = repoName.includes('auth') || repoName.includes('fastapi');
    const isSpringService = repoName.includes('spring') || repoName.includes('inventory');

    const entryFile =
      files.find((f) => f.name.includes('main') || f.name.includes('app') || f.name.includes('Application'))?.path ||
      'app/main.py';
    const routerFiles = files.filter((f) => f.path.includes('router') || f.path.includes('controller')).map((f) => f.path);
    const serviceFiles = files.filter((f) => f.path.includes('service') || f.path.includes('security')).map((f) => f.path);
    const dbFiles = files.filter((f) => f.path.includes('model') || f.path.includes('database') || f.path.includes('repo')).map((f) => f.path);

    const nodes: FlowchartNode[] = [
      {
        id: 'repo_start',
        type: 'start',
        title: 'Start Request',
        x: 340,
        y: 35,
        width: 150,
        height: 38,
        details: `Client initiates transaction against ${repoName}.`,
      },
      {
        id: 'repo_input',
        type: 'input',
        title: isAuthService ? 'HTTP Request: POST /auth/login' : isSpringService ? 'REST Request: GET /api/inventory' : 'Client Ingress / API Request',
        subtitle: `Target: ${entryFile}`,
        iconName: 'file-text',
        x: 340,
        y: 105,
        width: 290,
        height: 58,
        files: [entryFile],
        details: `Network listener receiving HTTP payload, headers, and query parameters.`,
        codeSnippet: `@app.post("/auth/login")\ndef login(credentials: OAuth2PasswordRequestForm): ...`,
      },
      {
        id: 'repo_dispatcher',
        type: 'process',
        title: isAuthService ? 'FastAPI Router Dispatcher' : isSpringService ? 'Spring MVC Request Handler' : 'Application Router Dispatcher',
        subtitle: routerFiles.length > 0 ? `Mapped to ${routerFiles.slice(0, 2).join(', ')}` : 'Route matching & payload validation',
        category: 'Routing Layer',
        iconName: isAuthService ? 'python' : 'binary',
        x: 340,
        y: 190,
        width: 300,
        height: 66,
        files: routerFiles.length > 0 ? routerFiles : [entryFile],
        symbols: symbols.filter((s) => s.type === 'function').slice(0, 4).map((s) => s.name),
        details: 'Validates DTO schema types, extracts JWT Bearer authorization headers, and binds parameters.',
      },
      {
        id: 'repo_decision',
        type: 'decision',
        title: isAuthService ? 'JWT & Credentials Valid?' : 'Validation & State Valid?',
        x: 340,
        y: 295,
        width: 170,
        height: 95,
        details: 'Security & Business validation gate. Verifies password hashes, token expiry, and domain constraints.',
      },
      // Branch Yes (Authorized / Valid)
      {
        id: 'repo_service_ok',
        type: 'process',
        title: isAuthService ? 'Issue Session & Claims' : 'Execute Business Service Logic',
        subtitle: serviceFiles.length > 0 ? serviceFiles.slice(0, 2).join(', ') : 'Domain Service Layer',
        category: 'Business Logic',
        iconName: 'shield',
        x: 165,
        y: 410,
        width: 220,
        height: 64,
        files: serviceFiles,
        symbols: symbols.filter((s) => s.type === 'class' || s.name.includes('token') || s.name.includes('hash')).map((s) => s.name),
        details: 'Performs cryptographic signing, password hash verification (bcrypt), and state mutation.',
      },
      {
        id: 'repo_db_ok',
        type: 'process',
        title: 'Query Database ORM Session',
        subtitle: dbFiles.length > 0 ? dbFiles.slice(0, 2).join(', ') : 'Data Access Layer',
        category: 'Persistence',
        iconName: 'database',
        x: 165,
        y: 500,
        width: 220,
        height: 64,
        files: dbFiles,
        symbols: symbols.filter((s) => s.name.includes('User') || s.name.includes('Session') || s.name.includes('Repo')).map((s) => s.name),
        details: 'Executes transactional read/write SQL queries via SQLAlchemy ORM or Spring Data JPA.',
      },
      {
        id: 'repo_resp_ok',
        type: 'success',
        title: 'Return HTTP 200 OK',
        subtitle: isAuthService ? '(Access Token & User JSON)' : '(Validated Entity Response)',
        iconName: 'check-circle',
        x: 165,
        y: 595,
        width: 215,
        height: 68,
        details: 'Encodes JSON response with HTTP 200 status code and returns to client.',
      },
      // Branch No (Unauthorized / Error)
      {
        id: 'repo_err_classify',
        type: 'error',
        title: isAuthService ? 'Classify Auth / Token Error' : 'Classify Request Error',
        subtitle: 'HTTP 401 Unauthorized / 422 Unprocessable',
        iconName: 'search',
        x: 620,
        y: 360,
        width: 270,
        height: 62,
        details: 'Captures invalid credentials, malformed signatures, or expired token exceptions.',
      },
      {
        id: 'repo_err_ai',
        type: 'ai',
        title: 'AI Root Cause & Diagnostics',
        subtitle: 'Google Gemini 3.8 Flash analyzes error trace, security rules, and produces corrective remedies',
        iconName: 'sparkles',
        x: 890,
        y: 440,
        width: 210,
        height: 200,
        details: 'Grounded AI engine provides contextual security analysis without hallucination.',
      },
      {
        id: 'repo_err_remedy',
        type: 'process',
        title: 'Generate Remediation Hint',
        subtitle: 'Provide WWW-Authenticate challenge header',
        category: 'Error Handler',
        iconName: 'settings',
        x: 620,
        y: 442,
        width: 270,
        height: 62,
        details: 'Generates standard RFC-6750 Bearer challenge response instructing client how to re-authenticate.',
      },
      {
        id: 'repo_err_audit',
        type: 'process',
        title: 'Audit & Rate Limiter Log',
        subtitle: 'Record failed attempt in security journal',
        category: 'Observability',
        iconName: 'bar-chart',
        x: 620,
        y: 526,
        width: 270,
        height: 62,
        details: 'Prevents brute force attempts by checking IP throttling windows.',
      },
      {
        id: 'repo_err_resp',
        type: 'error',
        title: 'Return HTTP 401 / 422 Response',
        subtitle: '(Structured Error Detail & Retry Directive)',
        iconName: 'list-checks',
        x: 620,
        y: 610,
        width: 280,
        height: 64,
        details: 'Emits structured error JSON containing error code and remediation link.',
      },
      // Convergence
      {
        id: 'repo_client_consume',
        type: 'user',
        title: 'Client Consumes Response',
        subtitle: '(Store JWT token, update session, or display error)',
        iconName: 'user',
        x: 450,
        y: 705,
        width: 360,
        height: 64,
        details: 'Client application updates state, stores bearer token in local storage, or alerts user.',
      },
      {
        id: 'repo_finish',
        type: 'finish',
        title: 'Next Transaction or Finish',
        subtitle: '(Repeat API Request Cycle)',
        x: 450,
        y: 785,
        width: 260,
        height: 44,
        details: 'Transaction cycle completed. Ready for subsequent HTTP requests.',
      },
    ];

    const edges: FlowchartEdge[] = [
      {
        id: 're-start-input',
        from: 'repo_start',
        to: 'repo_input',
        points: [
          { x: 340, y: 54 },
          { x: 340, y: 76 },
        ],
      },
      {
        id: 're-input-dispatcher',
        from: 'repo_input',
        to: 'repo_dispatcher',
        points: [
          { x: 340, y: 134 },
          { x: 340, y: 157 },
        ],
      },
      {
        id: 're-dispatcher-decision',
        from: 'repo_dispatcher',
        to: 'repo_decision',
        points: [
          { x: 340, y: 223 },
          { x: 340, y: 247 },
        ],
      },
      // Yes branch
      {
        id: 're-decision-yes',
        from: 'repo_decision',
        to: 'repo_service_ok',
        label: 'Yes',
        points: [
          { x: 255, y: 295 },
          { x: 165, y: 295 },
          { x: 165, y: 378 },
        ],
      },
      {
        id: 're-service-db',
        from: 'repo_service_ok',
        to: 'repo_db_ok',
        points: [
          { x: 165, y: 442 },
          { x: 165, y: 468 },
        ],
      },
      {
        id: 're-db-resp',
        from: 'repo_db_ok',
        to: 'repo_resp_ok',
        points: [
          { x: 165, y: 532 },
          { x: 165, y: 561 },
        ],
      },
      // No branch
      {
        id: 're-decision-no',
        from: 'repo_decision',
        to: 'repo_err_classify',
        label: 'No',
        points: [
          { x: 425, y: 295 },
          { x: 620, y: 295 },
          { x: 620, y: 329 },
        ],
      },
      {
        id: 're-classify-ai',
        from: 'repo_err_classify',
        to: 'repo_err_ai',
        dashed: true,
        color: '#0284c7',
        points: [
          { x: 755, y: 360 },
          { x: 890, y: 360 },
          { x: 890, y: 340 },
        ],
      },
      {
        id: 're-classify-remedy',
        from: 'repo_err_classify',
        to: 'repo_err_remedy',
        points: [
          { x: 620, y: 391 },
          { x: 620, y: 411 },
        ],
      },
      {
        id: 're-remedy-audit',
        from: 'repo_err_remedy',
        to: 'repo_err_audit',
        points: [
          { x: 620, y: 473 },
          { x: 620, y: 493 },
        ],
      },
      {
        id: 're-audit-resp',
        from: 'repo_err_audit',
        to: 'repo_err_resp',
        points: [
          { x: 620, y: 559 },
          { x: 620, y: 578 },
        ],
      },
      {
        id: 're-ai-resp',
        from: 'repo_err_ai',
        to: 'repo_err_resp',
        dashed: true,
        color: '#0284c7',
        points: [
          { x: 890, y: 540 },
          { x: 890, y: 610 },
          { x: 760, y: 610 },
        ],
      },
      // Merge into client consume
      {
        id: 're-ok-client',
        from: 'repo_resp_ok',
        to: 'repo_client_consume',
        points: [
          { x: 165, y: 629 },
          { x: 165, y: 705 },
          { x: 270, y: 705 },
        ],
      },
      {
        id: 're-err-client',
        from: 'repo_err_resp',
        to: 'repo_client_consume',
        points: [
          { x: 620, y: 642 },
          { x: 620, y: 673 },
          { x: 690, y: 673 },
          { x: 690, y: 705 },
          { x: 630, y: 705 },
        ],
      },
      {
        id: 're-client-finish',
        from: 'repo_client_consume',
        to: 'repo_finish',
        points: [
          { x: 450, y: 737 },
          { x: 450, y: 763 },
        ],
      },
      // Loopback
      {
        id: 're-loopback',
        from: 'repo_finish',
        to: 'repo_input',
        points: [
          { x: 320, y: 785 },
          { x: 45, y: 785 },
          { x: 45, y: 105 },
          { x: 204, y: 105 },
        ],
      },
    ];

    const simulationSteps = [
      'repo_start',
      'repo_input',
      'repo_dispatcher',
      'repo_decision',
      'repo_service_ok',
      'repo_db_ok',
      'repo_resp_ok',
      'repo_client_consume',
      'repo_finish',
    ];

    return { nodes, edges, simulationSteps };
  }, [currentRepo, files, symbols]);

  const activeFlow = mode === 'pipeline' ? pipelineFlow : repoFlow;
  const activeNodes = activeFlow.nodes;
  const activeEdges = activeFlow.edges;
  const simulationSteps = activeFlow.simulationSteps;

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return activeNodes.find((n) => n.id === selectedNodeId) || null;
  }, [selectedNodeId, activeNodes]);

  // -------------------------------------------------------------
  // Simulation Runner
  // -------------------------------------------------------------
  useEffect(() => {
    let timer: any;
    if (isSimulating) {
      timer = setInterval(() => {
        setActiveStepIndex((prev) => {
          const next = prev + 1;
          if (next >= simulationSteps.length) {
            setIsSimulating(false);
            return -1;
          }
          // If drawer is already open, track along; otherwise leave canvas unobstructed
          setSelectedNodeId((curr) => (curr ? simulationSteps[next] : null));
          return next;
        });
      }, 1200);
    }
    return () => clearInterval(timer);
  }, [isSimulating, simulationSteps]);

  const handleStartSimulation = () => {
    setActiveStepIndex(0);
    setIsSimulating(true);
  };

  const handleStopSimulation = () => {
    setIsSimulating(false);
    setActiveStepIndex(-1);
  };

  // -------------------------------------------------------------
  // Pan and Zoom via SVG ViewBox (Zero clipping guaranteed)
  // -------------------------------------------------------------
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setVbStart({ ...vb });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const dx = ((e.clientX - dragStart.x) * vbStart.w) / rect.width;
    const dy = ((e.clientY - dragStart.y) * vbStart.h) / rect.height;
    setVb({
      ...vbStart,
      x: vbStart.x - dx,
      y: vbStart.y - dy,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 0.92 : 1.08;
    setVb((prev) => {
      const newW = Math.min(BASE_VB.w * 3, Math.max(BASE_VB.w * 0.35, prev.w * zoomFactor));
      const newH = Math.min(BASE_VB.h * 3, Math.max(BASE_VB.h * 0.35, prev.h * zoomFactor));
      return {
        x: prev.x + (prev.w - newW) / 2,
        y: prev.y + (prev.h - newH) / 2,
        w: newW,
        h: newH,
      };
    });
  };

  const handleZoomIn = () => {
    setVb((prev) => {
      const scale = 0.88;
      const newW = Math.max(BASE_VB.w * 0.35, prev.w * scale);
      const newH = Math.max(BASE_VB.h * 0.35, prev.h * scale);
      return {
        x: prev.x + (prev.w - newW) / 2,
        y: prev.y + (prev.h - newH) / 2,
        w: newW,
        h: newH,
      };
    });
  };

  const handleZoomOut = () => {
    setVb((prev) => {
      const scale = 1.12;
      const newW = Math.min(BASE_VB.w * 3, prev.w * scale);
      const newH = Math.min(BASE_VB.h * 3, prev.h * scale);
      return {
        x: prev.x + (prev.w - newW) / 2,
        y: prev.y + (prev.h - newH) / 2,
        w: newW,
        h: newH,
      };
    });
  };

  const handleFit = () => {
    setVb(BASE_VB);
  };

  const handleReset = () => {
    setVb(BASE_VB);
    setSelectedNodeId(null);
    setIsSimulating(false);
    setActiveStepIndex(-1);
  };

  const handleExportSVG = () => {
    if (!svgRef.current) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svgRef.current);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `repomind-${mode}-flowchart.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const zoomPercent = Math.round((BASE_VB.w / vb.w) * 100);

  // Helper icon renderer
  const renderIcon = (name?: string, className = 'w-4 h-4') => {
    switch (name) {
      case 'file-text':
        return <FileText className={className} />;
      case 'python':
        return (
          <span className="font-mono font-bold text-xs px-1 py-0.5 rounded bg-amber-400 text-slate-900 leading-none">
            Py
          </span>
        );
      case 'check-circle':
        return <CheckCircle2 className={className} />;
      case 'search':
        return <Search className={className} />;
      case 'settings':
        return <Settings className={className} />;
      case 'bar-chart':
        return <BarChart3 className={className} />;
      case 'terminal':
        return <Terminal className={className} />;
      case 'list-checks':
        return <ListChecks className={className} />;
      case 'sparkles':
        return <Sparkles className={className} />;
      case 'user':
        return <User className={className} />;
      case 'shield':
        return <ShieldCheck className={className} />;
      case 'database':
        return <Database className={className} />;
      default:
        return <Cpu className={className} />;
    }
  };

  const isDark = theme === 'dark';

  return (
    <div className={`h-full flex flex-col select-none relative ${isDark ? 'bg-[#06090f] text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      {/* 1. Header Toolbar */}
      <div className={`border-b px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 z-10 shrink-0 ${isDark ? 'bg-[#080d17] border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
        {/* Title & Mode Switcher */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <div className={`p-2 rounded-xl ${isDark ? 'bg-cyan-950/80 text-cyan-400 border border-cyan-800/60' : 'bg-cyan-100 text-cyan-800 border border-cyan-200'}`}>
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="font-bold text-sm tracking-wide">ARCHITECTURE FLOWCHART</h1>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold border ${isDark ? 'bg-emerald-950/70 text-emerald-300 border-emerald-800/80' : 'bg-emerald-100 text-emerald-800 border-emerald-300'}`}>
                  HIGH READABILITY
                </span>
              </div>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Complete execution pipeline with decision branches, candidate repair, and AI explanation
              </p>
            </div>
          </div>

          {/* Mode Pill Toggle */}
          <div className={`flex items-center p-0.5 rounded-lg border ml-2 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
            <button
              onClick={() => {
                setMode('pipeline');
                setSelectedNodeId(null);
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium font-mono transition flex items-center space-x-1.5 ${
                mode === 'pipeline'
                  ? isDark
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'bg-white text-cyan-800 shadow-sm border border-slate-200'
                  : isDark
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>AST &amp; Repair Pipeline</span>
            </button>
            <button
              onClick={() => {
                setMode('repository');
                setSelectedNodeId(null);
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium font-mono transition flex items-center space-x-1.5 ${
                mode === 'repository'
                  ? isDark
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'bg-white text-cyan-800 shadow-sm border border-slate-200'
                  : isDark
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Repository Architecture</span>
            </button>
          </div>
        </div>

        {/* Action Controls & Simulation */}
        <div className="flex items-center space-x-2">
          {/* Flow Simulation Runner */}
          {!isSimulating ? (
            <button
              onClick={handleStartSimulation}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition active:scale-95"
              title="Simulate execution flow through the entire diagram"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>Simulate Flow</span>
            </button>
          ) : (
            <button
              onClick={handleStopSimulation}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium bg-amber-600 hover:bg-amber-500 text-white shadow-sm transition animate-pulse"
              title="Pause execution simulation"
            >
              <Pause className="w-3.5 h-3.5 fill-white" />
              <span>Stop Simulation ({activeStepIndex + 1}/{simulationSteps.length})</span>
            </button>
          )}

          {/* Theme Switcher */}
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className={`p-1.5 rounded-lg border text-xs transition ${
              isDark
                ? 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white'
                : 'bg-white border-slate-200 text-slate-700 hover:text-slate-900 shadow-sm'
            }`}
            title={`Switch to ${isDark ? 'Light' : 'Dark'} Theme`}
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
          </button>

          {/* Zoom & Fit */}
          <div className={`flex items-center rounded-lg border p-0.5 space-x-0.5 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
            <button
              onClick={handleZoomIn}
              className={`p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600'}`}
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleZoomOut}
              className={`p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600'}`}
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleFit}
              className={`px-2 py-1 rounded text-xs font-mono font-medium hover:bg-slate-200 dark:hover:bg-slate-800 transition ${isDark ? 'text-cyan-400 font-bold' : 'text-cyan-700 font-bold'}`}
              title="Auto-Fit Full Flowchart to Screen"
            >
              Fit
            </button>
            <button
              onClick={handleReset}
              className={`p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600'}`}
              title="Reset View"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Zoom Percentage */}
          <span className={`text-[11px] font-mono px-2 py-1 rounded border hidden sm:inline ${isDark ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'}`}>
            {zoomPercent}%
          </span>

          {/* Export SVG */}
          <button
            onClick={handleExportSVG}
            className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border text-xs font-mono transition ${
              isDark
                ? 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white'
                : 'bg-white border-slate-200 text-slate-700 hover:text-slate-900 shadow-sm'
            }`}
            title="Download Flowchart as high-res SVG"
          >
            <Download className="w-3.5 h-3.5 text-cyan-500" />
            <span className="hidden sm:inline">Export SVG</span>
          </button>
        </div>
      </div>

      {/* 2. Interactive Flowchart Canvas with Native ViewBox (Guarantees zero clipping) */}
      <div
        ref={containerRef}
        className={`flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing ${
          isDark ? 'bg-[#090d16]' : 'bg-[#f8fafc]'
        }`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        {/* Crisp grid pattern */}
        <div
          className="absolute inset-0 pointer-events-none opacity-40"
          style={{
            backgroundImage: isDark
              ? 'radial-gradient(circle, #334155 1px, transparent 1px)'
              : 'radial-gradient(circle, #cbd5e1 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        <svg
          ref={svgRef}
          viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-full absolute inset-0 block select-none"
        >
          <defs>
            {/* Standard arrowhead */}
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 9 5 L 0 9 z" fill={isDark ? '#94a3b8' : '#334155'} />
            </marker>

            {/* Blue dashed arrowhead for AI */}
            <marker
              id="arrow-ai"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 9 5 L 0 9 z" fill="#0284c7" />
            </marker>

            {/* Active pulse glowing filter */}
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#38bdf8" floodOpacity="0.8" />
            </filter>
          </defs>

          {/* Render Connections / Edges */}
          {activeEdges.map((edge) => {
            const pathData = edge.points
              .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`)
              .join(' ');

            const isHighlighted =
              selectedNodeId && (selectedNodeId === edge.from || selectedNodeId === edge.to);

            return (
              <g key={edge.id} className="transition-all duration-300">
                <path
                  d={pathData}
                  fill="none"
                  stroke={
                    edge.dashed
                      ? '#0284c7'
                      : isHighlighted
                      ? '#38bdf8'
                      : isDark
                      ? '#475569'
                      : '#64748b'
                  }
                  strokeWidth={isHighlighted ? 3 : 2}
                  strokeDasharray={edge.dashed ? '6,4' : undefined}
                  markerEnd={edge.dashed ? 'url(#arrow-ai)' : 'url(#arrow)'}
                  strokeLinejoin="round"
                />

                {/* Edge Label (e.g. Yes / No) */}
                {edge.label && (
                  <g>
                    <rect
                      x={(edge.points[0].x + edge.points[1].x) / 2 - 16}
                      y={(edge.points[0].y + edge.points[1].y) / 2 - 12}
                      width="32"
                      height="20"
                      rx="4"
                      fill={isDark ? '#0f172a' : '#ffffff'}
                      stroke={edge.label === 'Yes' ? '#16a34a' : '#dc2626'}
                      strokeWidth="1.5"
                    />
                    <text
                      x={(edge.points[0].x + edge.points[1].x) / 2}
                      y={(edge.points[0].y + edge.points[1].y) / 2 + 2}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="font-bold text-[11px]"
                      fill={edge.label === 'Yes' ? '#16a34a' : '#dc2626'}
                    >
                      {edge.label}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Render Nodes */}
          {activeNodes.map((node) => {
            const isSelected = selectedNodeId === node.id;
            const isStepActive =
              activeStepIndex >= 0 && simulationSteps[activeStepIndex] === node.id;

            // Compute top-left position from center coordinates
            const x = node.x - node.width / 2;
            const y = node.y - node.height / 2;

            return (
              <g
                key={node.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedNodeId(node.id);
                }}
                className="cursor-pointer transition-transform duration-200"
                filter={isStepActive ? 'url(#glow)' : undefined}
              >
                {/* 1. Terminal Node (Pill Shape: Start & Modify Code or Finish) */}
                {(node.type === 'start' || node.type === 'finish') && (
                  <g>
                    <rect
                      x={x}
                      y={y}
                      width={node.width}
                      height={node.height}
                      rx={node.height / 2}
                      fill={isDark ? '#064e3b' : '#dcfce7'}
                      stroke={isSelected ? '#38bdf8' : '#16a34a'}
                      strokeWidth={isSelected ? 3 : 2}
                      className="transition-all"
                    />
                    <text
                      x={node.x}
                      y={node.subtitle ? node.y - 5 : node.y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="font-bold text-xs font-sans tracking-wide"
                      fill={isDark ? '#86efac' : '#15803d'}
                    >
                      {node.title}
                    </text>
                    {node.subtitle && (
                      <text
                        x={node.x}
                        y={node.y + 11}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="text-[10px] font-sans"
                        fill={isDark ? '#6ee7b7' : '#166534'}
                      >
                        {node.subtitle}
                      </text>
                    )}
                  </g>
                )}

                {/* 2. Input Node (Slanted Parallelogram: Enter Python Source Code) */}
                {node.type === 'input' && (
                  <g>
                    <polygon
                      points={`
                        ${x + 18},${y}
                        ${x + node.width},${y}
                        ${x + node.width - 18},${y + node.height}
                        ${x},${y + node.height}
                      `}
                      fill={isDark ? '#0c4a6e' : '#e0f2fe'}
                      stroke={isSelected ? '#38bdf8' : '#0284c7'}
                      strokeWidth={isSelected ? 3 : 2}
                    />
                    <foreignObject
                      x={x + 22}
                      y={y + 8}
                      width={node.width - 44}
                      height={node.height - 16}
                    >
                      <div className="h-full flex items-center space-x-2.5 select-none">
                        <div
                          className={`p-1.5 rounded-lg shrink-0 ${
                            isDark ? 'bg-sky-900 text-sky-200' : 'bg-sky-200 text-sky-800'
                          }`}
                        >
                          {renderIcon(node.iconName, 'w-4 h-4')}
                        </div>
                        <div className="overflow-hidden flex-1">
                          <p
                            className={`font-bold text-xs leading-tight ${
                              isDark ? 'text-sky-100' : 'text-sky-950'
                            }`}
                          >
                            {node.title}
                          </p>
                          {node.subtitle && (
                            <p
                              className={`text-[10.5px] leading-tight mt-0.5 ${
                                isDark ? 'text-sky-300' : 'text-sky-700'
                              }`}
                            >
                              {node.subtitle}
                            </p>
                          )}
                        </div>
                      </div>
                    </foreignObject>
                  </g>
                )}

                {/* 3. Decision Diamond Node: Parsing Successful? */}
                {node.type === 'decision' && (
                  <g>
                    <polygon
                      points={`
                        ${node.x},${y}
                        ${x + node.width},${node.y}
                        ${node.x},${y + node.height}
                        ${x},${node.y}
                      `}
                      fill={isDark ? '#713f12' : '#fef9c3'}
                      stroke={isSelected ? '#38bdf8' : '#ca8a04'}
                      strokeWidth={isSelected ? 3.5 : 2.5}
                    />
                    <text
                      x={node.x}
                      y={node.y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="font-bold text-xs font-sans tracking-tight"
                      fill={isDark ? '#fef08a' : '#854d0e'}
                    >
                      {node.title}
                    </text>
                  </g>
                )}

                {/* 4. Process Cards & Success / Error / User Cards */}
                {(node.type === 'process' ||
                  node.type === 'success' ||
                  node.type === 'error' ||
                  node.type === 'user') && (
                  <g>
                    {(() => {
                      let bgFill = isDark ? '#1e293b' : '#ffffff';
                      let strokeColor = isDark ? '#475569' : '#cbd5e1';
                      let iconBg = isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700';

                      if (node.type === 'success') {
                        bgFill = isDark ? '#064e3b' : '#f0fdf4';
                        strokeColor = '#22c55e';
                        iconBg = isDark ? 'bg-emerald-900 text-emerald-300' : 'bg-emerald-100 text-emerald-700';
                      } else if (node.type === 'error') {
                        bgFill = isDark ? '#450a0a' : '#fff1f2';
                        strokeColor = '#f43f5e';
                        iconBg = isDark ? 'bg-rose-900 text-rose-300' : 'bg-rose-100 text-rose-700';
                      } else if (node.type === 'user') {
                        bgFill = isDark ? '#172554' : '#eff6ff';
                        strokeColor = '#3b82f6';
                        iconBg = isDark ? 'bg-blue-900 text-blue-300' : 'bg-blue-100 text-blue-700';
                      } else if (node.iconName === 'python') {
                        bgFill = isDark ? '#3b0764' : '#faf5ff';
                        strokeColor = '#a855f7';
                        iconBg = isDark ? 'bg-purple-900 text-purple-300' : 'bg-purple-100 text-purple-700';
                      } else if (node.iconName === 'settings') {
                        bgFill = isDark ? '#431407' : '#fff7ed';
                        strokeColor = '#f97316';
                        iconBg = isDark ? 'bg-orange-900 text-orange-300' : 'bg-orange-100 text-orange-700';
                      } else if (node.iconName === 'bar-chart') {
                        bgFill = isDark ? '#082f49' : '#f0f9ff';
                        strokeColor = '#0ea5e9';
                        iconBg = isDark ? 'bg-sky-900 text-sky-300' : 'bg-sky-100 text-sky-700';
                      } else if (node.iconName === 'terminal') {
                        bgFill = isDark ? '#2e1065' : '#f5f3ff';
                        strokeColor = '#8b5cf6';
                        iconBg = isDark ? 'bg-violet-900 text-violet-300' : 'bg-violet-100 text-violet-700';
                      }

                      return (
                        <>
                          <rect
                            x={x}
                            y={y}
                            width={node.width}
                            height={node.height}
                            rx="12"
                            fill={bgFill}
                            stroke={isSelected ? '#38bdf8' : strokeColor}
                            strokeWidth={isSelected ? 3 : 2}
                            className="transition-all"
                          />
                          <foreignObject
                            x={x + 10}
                            y={y + 6}
                            width={node.width - 20}
                            height={node.height - 12}
                          >
                            <div className="h-full flex items-center space-x-2.5 select-none">
                              <div
                                className={`p-1.5 rounded-lg shrink-0 flex items-center justify-center ${iconBg}`}
                              >
                                {renderIcon(node.iconName, 'w-4 h-4')}
                              </div>
                              <div className="overflow-hidden flex-1">
                                <p
                                  className={`font-bold text-xs leading-tight ${
                                    isDark ? 'text-white' : 'text-slate-900'
                                  }`}
                                >
                                  {node.title}
                                </p>
                                {node.subtitle && (
                                  <p
                                    className={`text-[10px] leading-snug mt-0.5 ${
                                      isDark ? 'text-slate-300' : 'text-slate-600'
                                    }`}
                                  >
                                    {node.subtitle}
                                  </p>
                                )}
                              </div>
                            </div>
                          </foreignObject>
                        </>
                      );
                    })()}
                  </g>
                )}

                {/* 5. Optional AI Explanation Component (Dashed Border Card) */}
                {node.type === 'ai' && (
                  <g>
                    <rect
                      x={x}
                      y={y}
                      width={node.width}
                      height={node.height}
                      rx="14"
                      fill={isDark ? '#082f49' : '#f0f9ff'}
                      stroke={isSelected ? '#38bdf8' : '#0284c7'}
                      strokeWidth={isSelected ? 3 : 2}
                      strokeDasharray="6,4"
                    />
                    <foreignObject
                      x={x + 10}
                      y={y + 12}
                      width={node.width - 20}
                      height={node.height - 24}
                    >
                      <div className="h-full flex flex-col items-center justify-between text-center select-none py-1">
                        <div className="w-full">
                          <p
                            className={`font-bold text-xs leading-tight ${
                              isDark ? 'text-cyan-200' : 'text-cyan-950'
                            }`}
                          >
                            {node.title}
                          </p>
                        </div>
                        {/* Centered AI / Gemini Icon */}
                        <div
                          className={`p-2.5 rounded-full my-1 ${
                            isDark
                              ? 'bg-cyan-950/90 text-cyan-400 border border-cyan-800'
                              : 'bg-white text-cyan-600 shadow border border-cyan-200'
                          }`}
                        >
                          <Sparkles className="w-7 h-7 text-cyan-500 animate-pulse" />
                        </div>
                        <div>
                          <p
                            className={`text-[9.5px] leading-snug px-1 ${
                              isDark ? 'text-cyan-300' : 'text-cyan-800'
                            }`}
                          >
                            {node.subtitle}
                          </p>
                        </div>
                      </div>
                    </foreignObject>
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {/* 3. Node Details Inspector Drawer (Opens when a node is clicked) */}
        {selectedNode && (
          <div
            className={`absolute top-4 right-4 w-96 rounded-2xl border p-5 shadow-2xl z-20 max-h-[calc(100%-2rem)] flex flex-col overflow-hidden animate-in fade-in slide-in-from-right-4 duration-200 ${
              isDark ? 'bg-[#0f172a] border-slate-700/80' : 'bg-white border-slate-200'
            }`}
          >
            {/* Drawer Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <div className="flex items-center space-x-2.5">
                <div
                  className={`p-2 rounded-xl ${
                    isDark ? 'bg-cyan-950 text-cyan-400' : 'bg-cyan-100 text-cyan-800'
                  }`}
                >
                  {renderIcon(selectedNode.iconName, 'w-5 h-5')}
                </div>
                <div>
                  <h3 className="font-bold text-sm leading-tight">{selectedNode.title}</h3>
                  <span className="text-[11px] font-mono text-cyan-500 font-semibold uppercase">
                    Stage: {selectedNode.type}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedNodeId(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="overflow-y-auto py-3 space-y-4 text-xs font-sans">
              {/* Description */}
              {selectedNode.details && (
                <div>
                  <h4 className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Function &amp; Purpose
                  </h4>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-800">
                    {selectedNode.details}
                  </p>
                </div>
              )}

              {/* Linked Code Files */}
              {selectedNode.files && selectedNode.files.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span>Associated Repository Files ({selectedNode.files.length})</span>
                  </h4>
                  <div className="space-y-1.5">
                    {selectedNode.files.map((fp) => {
                      const matchedFile = files.find((f) => f.path === fp);
                      return (
                        <div
                          key={fp}
                          className="flex items-center justify-between p-2 rounded-lg bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 hover:border-cyan-500/50 transition group"
                        >
                          <div className="flex items-center space-x-2 truncate">
                            <FileCode className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                            <span className="font-mono text-[11px] text-slate-800 dark:text-slate-200 truncate">
                              {fp}
                            </span>
                          </div>
                          {matchedFile && onSelectFile && (
                            <button
                              onClick={() => onSelectFile(matchedFile)}
                              className="text-cyan-600 dark:text-cyan-400 hover:underline text-[11px] font-mono flex items-center space-x-0.5 shrink-0 ml-2"
                            >
                              <span>View</span>
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* AST Symbols */}
              {selectedNode.symbols && selectedNode.symbols.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Extracted AST Symbols
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedNode.symbols.map((sym) => (
                      <span
                        key={sym}
                        className="px-2 py-0.5 rounded-md font-mono text-[10.5px] bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60"
                      >
                        {sym}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Code Snippet Preview */}
              {selectedNode.codeSnippet && (
                <div>
                  <h4 className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Code Implementation Snippet
                  </h4>
                  <pre className="p-3 rounded-lg bg-slate-900 text-slate-200 font-mono text-[10.5px] overflow-x-auto border border-slate-800">
                    <code>{selectedNode.codeSnippet}</code>
                  </pre>
                </div>
              )}
            </div>

            {/* Drawer Footer Actions */}
            {onAskAI && (
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 shrink-0">
                <button
                  onClick={() =>
                    onAskAI(
                      `Explain the architectural role of "${selectedNode.title}" in repository ${currentRepo?.name || ''}, citing how it connects to surrounding stages.`,
                    )
                  }
                  className="w-full flex items-center justify-center space-x-2 py-2 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-medium transition shadow-md"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Ask AI About This Stage</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* 4. Bottom Quick Guide & Legend (Collapsible so it never blocks diagram) */}
        {isLegendOpen ? (
          <div
            className={`absolute bottom-3 left-4 rounded-xl border px-3 py-1.5 text-xs font-mono flex items-center space-x-3 shadow-md pointer-events-auto backdrop-blur-sm z-10 transition-all ${
              isDark ? 'bg-slate-900/90 border-slate-800 text-slate-400' : 'bg-white/95 border-slate-200 text-slate-600'
            }`}
          >
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
              <span>Start / Valid</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rotate-45 bg-amber-400 inline-block"></span>
              <span>Decision Diamond</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
              <span>Error Classification</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-2 rounded border border-dashed border-sky-400 inline-block"></span>
              <span>AI Component</span>
            </div>
            <div className="hidden md:flex items-center text-slate-400 border-l pl-3 dark:border-slate-800">
              <span>Click node for details</span>
            </div>
            <button
              onClick={() => setIsLegendOpen(false)}
              className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 ml-1 transition"
              title="Minimize Legend"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsLegendOpen(true)}
            className={`absolute bottom-3 left-4 rounded-xl border px-2.5 py-1 text-[11px] font-mono flex items-center space-x-1.5 shadow-sm pointer-events-auto backdrop-blur-sm z-10 transition hover:scale-105 ${
              isDark ? 'bg-slate-900/90 border-slate-800 text-slate-400 hover:text-slate-200' : 'bg-white/95 border-slate-200 text-slate-600 hover:text-slate-900'
            }`}
            title="Expand Legend"
          >
            <Info className="w-3.5 h-3.5 text-cyan-500" />
            <span>Legend</span>
          </button>
        )}
      </div>
    </div>
  );
};
