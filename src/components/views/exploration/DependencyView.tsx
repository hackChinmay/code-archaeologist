import React, { useState, useMemo } from 'react';
import {
  GitFork,
  Layers,
  Search,
  Filter,
  ArrowRight,
  ExternalLink,
  PackageCheck,
  Package,
} from 'lucide-react';
import type { Dependency } from '../../../types/index.ts';

interface DependencyViewProps {
  dependencies: Dependency[];
}

export const DependencyView: React.FC<DependencyViewProps> = ({ dependencies }) => {
  const [filterType, setFilterType] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'internal' | 'external'>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    return dependencies.filter((d) => {
      if (categoryFilter !== 'all' && d.category !== categoryFilter) return false;
      if (filterType !== 'all' && d.relationshipType !== filterType) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return d.source.toLowerCase().includes(q) || d.target.toLowerCase().includes(q);
      }
      return true;
    });
  }, [dependencies, filterType, categoryFilter, search]);

  // Aggregate external packages
  const externalPackages = useMemo(() => {
    const pkgs = new Set<string>();
    dependencies.filter((d) => d.category === 'external').forEach((d) => pkgs.add(d.target));
    return Array.from(pkgs);
  }, [dependencies]);

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold text-white font-mono flex items-center space-x-2">
                <GitFork className="w-5 h-5 text-cyan-400" />
                <span>Dependency &amp; Module Relationship Matrix</span>
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 font-semibold">
                Static Analysis
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Static relationship graph: internal file imports, class inheritance, function calls, and external packages.
            </p>
          </div>
          <div className="text-xs font-mono text-slate-400">
            Total Dependencies: <span className="text-cyan-400 font-bold">{dependencies.length}</span>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-800">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search source or target..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#0b0f17] border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full bg-[#0b0f17] border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="all">All Relationships</option>
              <option value="imports">Imports</option>
              <option value="inherits">Inherits (extends)</option>
              <option value="calls">Calls</option>
              <option value="depends_on">Depends On</option>
            </select>
          </div>

          <div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as any)}
              className="w-full bg-[#0b0f17] border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="all">All Categories</option>
              <option value="internal">Internal Modules</option>
              <option value="external">External Third-Party</option>
            </select>
          </div>
        </div>
      </div>

      {/* External Packages Pills */}
      {externalPackages.length > 0 && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center space-x-2 text-xs font-mono font-bold text-amber-300">
            <Package className="w-3.5 h-3.5" />
            <span>Detected External Libraries &amp; Packages ({externalPackages.length})</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {externalPackages.map((pkg, idx) => (
              <span
                key={idx}
                className="text-xs font-mono bg-[#0b0f17] border border-slate-700 px-2.5 py-1 rounded-md text-slate-200 flex items-center space-x-1"
              >
                <span>{pkg}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Dependencies Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-[#090d16] border-b border-slate-800 text-slate-400">
              <tr>
                <th className="p-3 pl-4">Source Component</th>
                <th className="p-3 text-center">Relationship</th>
                <th className="p-3">Target Component</th>
                <th className="p-3">Category</th>
                <th className="p-3 pr-4">Location</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-slate-200">
              {filtered.map((dep) => (
                <tr key={dep.id} className="hover:bg-slate-800/40 transition">
                  <td className="p-3 pl-4 font-semibold text-cyan-300 truncate max-w-xs">{dep.source}</td>
                  <td className="p-3 text-center">
                    <span
                      className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border inline-block ${
                        dep.relationshipType === 'inherits'
                          ? 'bg-amber-950/70 text-amber-300 border-amber-800/60'
                          : dep.relationshipType === 'calls'
                          ? 'bg-purple-950/70 text-purple-300 border-purple-800/60'
                          : 'bg-blue-950/70 text-blue-300 border-blue-800/60'
                      }`}
                    >
                      {dep.relationshipType}
                    </span>
                  </td>
                  <td className="p-3 font-semibold text-teal-300 truncate max-w-xs">{dep.target}</td>
                  <td className="p-3">
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                        dep.category === 'internal'
                          ? 'text-cyan-400 bg-cyan-950/40 border border-cyan-800/40'
                          : 'text-amber-400 bg-amber-950/40 border border-amber-800/40'
                      }`}
                    >
                      {dep.category}
                    </span>
                  </td>
                  <td className="p-3 pr-4 text-slate-500">
                    {dep.sourceLine ? `Line ${dep.sourceLine}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
