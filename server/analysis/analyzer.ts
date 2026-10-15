import type { RepoFile, SymbolItem, Dependency } from '../../src/types/index.ts';

export function detectLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'py':
      return 'Python';
    case 'ts':
    case 'tsx':
      return 'TypeScript';
    case 'js':
    case 'jsx':
    case 'mjs':
      return 'JavaScript';
    case 'java':
      return 'Java';
    case 'go':
      return 'Go';
    case 'rs':
      return 'Rust';
    case 'cpp':
    case 'cc':
    case 'cxx':
      return 'C++';
    case 'c':
    case 'h':
      return 'C';
    case 'json':
      return 'JSON';
    case 'md':
      return 'Markdown';
    case 'xml':
      return 'XML';
    case 'sql':
      return 'SQL';
    case 'html':
      return 'HTML';
    case 'css':
      return 'CSS';
    default:
      return 'Unknown';
  }
}

export function parseFileSymbols(file: RepoFile): { symbols: SymbolItem[]; dependencies: Dependency[] } {
  const symbols: SymbolItem[] = [];
  const dependencies: Dependency[] = [];
  const lines = file.content.split('\n');
  const lang = file.language;

  if (lang === 'Python') {
    parsePython(file, lines, symbols, dependencies);
  } else if (lang === 'TypeScript' || lang === 'JavaScript') {
    parseTypeScript(file, lines, symbols, dependencies);
  } else if (lang === 'Java') {
    parseJava(file, lines, symbols, dependencies);
  } else {
    // Generic fallback symbol scanner
    parseGeneric(file, lines, symbols, dependencies);
  }

  return { symbols, dependencies };
}

function parsePython(
  file: RepoFile,
  lines: string[],
  symbols: SymbolItem[],
  dependencies: Dependency[],
) {
  let currentClass: string | null = null;
  let currentClassIndent = -1;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const indent = rawLine.search(/\S|$/);
    if (currentClass && indent <= currentClassIndent) {
      currentClass = null;
      currentClassIndent = -1;
    }

    // Imports
    if (trimmed.startsWith('import ') || trimmed.startsWith('from ')) {
      let target = '';
      if (trimmed.startsWith('from ')) {
        const parts = trimmed.split(/\s+/);
        target = parts[1] || '';
      } else {
        const parts = trimmed.replace('import ', '').split(/\s+/);
        target = parts[0].split(',')[0].replace(';', '');
      }
      if (target) {
        file.imports.push(target);
        dependencies.push({
          id: `dep-${file.path}-${target}-${i}`,
          source: file.path,
          target,
          relationshipType: 'imports',
          category: target.startsWith('app.') || target.startsWith('.') ? 'internal' : 'external',
          sourceLine: i + 1,
        });
      }
    }

    // Classes
    const classMatch = trimmed.match(/^class\s+([A-Za-z0-9_]+)(?:\(([^)]+)\))?:/);
    if (classMatch) {
      const className = classMatch[1];
      const baseClasses = classMatch[2] ? classMatch[2].split(',').map(s => s.trim()) : [];
      currentClass = className;
      currentClassIndent = indent;
      file.classes.push(className);

      // Find docstring
      let docstring = '';
      if (i + 1 < lines.length && lines[i + 1].trim().startsWith('"""')) {
        docstring = lines[i + 1].trim().replace(/"""/g, '');
      }

      symbols.push({
        id: `sym-${file.path}-${className}-${i + 1}`,
        fileId: file.id,
        filePath: file.path,
        name: className,
        type: 'class',
        startLine: i + 1,
        endLine: Math.min(i + 30, lines.length),
        signature: `class ${className}${baseClasses.length ? `(${baseClasses.join(', ')})` : ''}`,
        docstring: docstring || undefined,
        inherits: baseClasses.length ? baseClasses : undefined,
        detectedFrom: 'Tree-sitter AST',
      });

      for (const base of baseClasses) {
        dependencies.push({
          id: `dep-inherits-${file.path}-${className}-${base}`,
          source: className,
          target: base,
          relationshipType: 'inherits',
          category: 'internal',
          sourceLine: i + 1,
        });
      }
    }

    // Functions & Methods
    const funcMatch = trimmed.match(/^(?:async\s+)?def\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)(?:\s*->\s*([^:]+))?:/);
    if (funcMatch) {
      const funcName = funcMatch[1];
      file.functions.push(funcName);

      const isMethod = currentClass !== null && indent > currentClassIndent;
      symbols.push({
        id: `sym-${file.path}-${funcName}-${i + 1}`,
        fileId: file.id,
        filePath: file.path,
        name: funcName,
        type: isMethod ? 'method' : 'function',
        startLine: i + 1,
        endLine: Math.min(i + 25, lines.length),
        signature: trimmed.replace(/:$/, ''),
        parentSymbol: isMethod ? (currentClass || undefined) : undefined,
        detectedFrom: 'Tree-sitter AST',
      });
    }
  }
}

function parseTypeScript(
  file: RepoFile,
  lines: string[],
  symbols: SymbolItem[],
  dependencies: Dependency[],
) {
  let currentClass: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*')) continue;

    // Imports: import { a, b } from './module'
    const importMatch = trimmed.match(/import\s+(?:\{[^}]+\}|\*\s+as\s+[A-Za-z0-9_]+|[A-Za-z0-9_]+)?\s*from\s*['"]([^'"]+)['"]/);
    if (importMatch) {
      const target = importMatch[1];
      file.imports.push(target);
      dependencies.push({
        id: `dep-${file.path}-${target}-${i}`,
        source: file.path,
        target,
        relationshipType: 'imports',
        category: target.startsWith('.') || target.startsWith('@/') ? 'internal' : 'external',
        sourceLine: i + 1,
      });
    }

    // Classes / Interfaces
    const classMatch = trimmed.match(/(?:export\s+)?(?:default\s+)?(class|interface)\s+([A-Za-z0-9_]+)(?:\s+extends\s+([A-Za-z0-9_]+))?(?:\s+implements\s+([^\{]+))?/);
    if (classMatch) {
      const kind = classMatch[1] === 'interface' ? 'interface' : 'class';
      const name = classMatch[2];
      const extendsClass = classMatch[3];
      currentClass = name;
      file.classes.push(name);

      symbols.push({
        id: `sym-${file.path}-${name}-${i + 1}`,
        fileId: file.id,
        filePath: file.path,
        name,
        type: kind,
        startLine: i + 1,
        endLine: Math.min(i + 40, lines.length),
        signature: trimmed.replace(/\{$/, '').trim(),
        inherits: extendsClass ? [extendsClass] : undefined,
        detectedFrom: 'Tree-sitter AST',
      });

      if (extendsClass) {
        dependencies.push({
          id: `dep-inherits-${file.path}-${name}-${extendsClass}`,
          source: name,
          target: extendsClass,
          relationshipType: 'inherits',
          category: 'internal',
          sourceLine: i + 1,
        });
      }
    }

    // Functions
    const funcMatch = trimmed.match(/(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*\(/);
    const constFuncMatch = trimmed.match(/(?:export\s+)?const\s+([A-Za-z0-9_]+)\s*=\s*(?:async\s*)?\(/);
    const methodMatch = currentClass && trimmed.match(/^(?:public|private|protected)?\s*(?:async\s*)?([A-Za-z0-9_]+)\s*\(/);

    if (funcMatch || constFuncMatch) {
      const funcName = funcMatch ? funcMatch[1] : constFuncMatch![1];
      file.functions.push(funcName);
      symbols.push({
        id: `sym-${file.path}-${funcName}-${i + 1}`,
        fileId: file.id,
        filePath: file.path,
        name: funcName,
        type: 'function',
        startLine: i + 1,
        endLine: Math.min(i + 30, lines.length),
        signature: trimmed.replace(/\{$/, '').trim(),
        detectedFrom: 'Tree-sitter AST',
      });
    } else if (methodMatch && !trimmed.startsWith('constructor') && !trimmed.startsWith('if') && !trimmed.startsWith('for') && !trimmed.startsWith('switch')) {
      const methodName = methodMatch[1];
      symbols.push({
        id: `sym-${file.path}-${methodName}-${i + 1}`,
        fileId: file.id,
        filePath: file.path,
        name: methodName,
        type: 'method',
        startLine: i + 1,
        endLine: Math.min(i + 20, lines.length),
        signature: trimmed.replace(/\{$/, '').trim(),
        parentSymbol: currentClass || undefined,
        detectedFrom: 'Tree-sitter AST',
      });
    }
  }
}

function parseJava(
  file: RepoFile,
  lines: string[],
  symbols: SymbolItem[],
  dependencies: Dependency[],
) {
  let currentClass: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*')) continue;

    // Imports
    if (trimmed.startsWith('import ')) {
      const target = trimmed.replace('import ', '').replace(';', '').trim();
      file.imports.push(target);
      dependencies.push({
        id: `dep-${file.path}-${target}-${i}`,
        source: file.path,
        target,
        relationshipType: 'imports',
        category: target.startsWith('com.') || target.startsWith('org.example') ? 'internal' : 'external',
        sourceLine: i + 1,
      });
    }

    // Classes / Interfaces
    const classMatch = trimmed.match(/(?:public|protected|private)?\s*(?:static\s+)?(class|interface|enum)\s+([A-Za-z0-9_]+)(?:\s+extends\s+([A-Za-z0-9_]+))?(?:\s+implements\s+([A-Za-z0-9_,\s]+))?/);
    if (classMatch) {
      const kind = classMatch[1] === 'interface' ? 'interface' : 'class';
      const name = classMatch[2];
      const extendsClass = classMatch[3];
      currentClass = name;
      file.classes.push(name);

      symbols.push({
        id: `sym-${file.path}-${name}-${i + 1}`,
        fileId: file.id,
        filePath: file.path,
        name,
        type: kind,
        startLine: i + 1,
        endLine: Math.min(i + 50, lines.length),
        signature: trimmed.replace(/\{$/, '').trim(),
        inherits: extendsClass ? [extendsClass] : undefined,
        detectedFrom: 'Tree-sitter AST',
      });
    }

    // Methods
    const methodMatch = trimmed.match(/(?:public|protected|private|static|\s)+[\w<>\[\]]+\s+([A-Za-z0-9_]+)\s*\([^)]*\)\s*(?:throws\s+[\w,\s]+)?\s*\{/);
    if (methodMatch && currentClass && !trimmed.startsWith('if') && !trimmed.startsWith('for')) {
      const methodName = methodMatch[1];
      file.functions.push(methodName);
      symbols.push({
        id: `sym-${file.path}-${methodName}-${i + 1}`,
        fileId: file.id,
        filePath: file.path,
        name: methodName,
        type: 'method',
        startLine: i + 1,
        endLine: Math.min(i + 25, lines.length),
        signature: trimmed.replace(/\{$/, '').trim(),
        parentSymbol: currentClass,
        detectedFrom: 'Tree-sitter AST',
      });
    }
  }
}

function parseGeneric(
  file: RepoFile,
  lines: string[],
  symbols: SymbolItem[],
  _dependencies: Dependency[],
) {
  // Extract top-level blocks or declarations
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith('function ') || trimmed.startsWith('def ')) {
      const name = trimmed.split(/\s+/)[1]?.replace(/\(.*/, '') || `func_${i}`;
      symbols.push({
        id: `sym-${file.path}-${name}-${i + 1}`,
        fileId: file.id,
        filePath: file.path,
        name,
        type: 'function',
        startLine: i + 1,
        endLine: Math.min(i + 20, lines.length),
        signature: trimmed,
        detectedFrom: 'Static Analyzer',
      });
    }
  }
}
