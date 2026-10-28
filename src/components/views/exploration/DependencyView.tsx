import React, { useState, useMemo } from 'react';
import {
  GitFork,
  Search,
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
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-[#262C28] border border-[#414A43] rounded-lg p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-semibold text-[#F1F0E9] font-mono flex items-center space-x-2">
                <GitFork className="w-4 h-4 text-[#78A887]" />
                <span>Dependency &amp; Relationship Matrix</span>
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#263A2D] text-[#81C995] border border-[#537B5D] font-medium">
                Static Analysis
              </span>
            </div>
            <p className="text-xs text-[#858E86] mt-0.5">
              Deterministic dependency graph: module imports, class inheritance, function calls, and external packages.
            </p>
          </div>
          <div className="text-xs font-mono text-[#858E86]">
            Total Records: <span className="text-[#F1F0E9] font-medium">{dependencies.length}</span>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-3 border-t border-[#343B36]">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#858E86] absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search source or target..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#171A19] border border-[#414A43] focus:border-[#78A887] rounded px-8 py-1.5 text-xs text-[#F1F0E9] placeholder-[#858E86] font-mono focus:outline-none"
            />
          </div>

          <div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full bg-[#171A19] border border-[#414A43] focus:border-[#78A887] rounded px-2.5 py-1.5 text-xs text-[#F1F0E9] font-mono focus:outline-none cursor-pointer"
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
              className="w-full bg-[#171A19] border border-[#414A43] focus:border-[#78A887] rounded px-2.5 py-1.5 text-xs text-[#F1F0E9] font-mono focus:outline-none cursor-pointer"
            >
              <option value="all">All Categories</option>
              <option value="internal">Internal Modules</option>
              <option value="external">External Packages</option>
            </select>
          </div>
        </div>
      </div>

      {/* External Packages Pills */}
      {externalPackages.length > 0 && (
        <div className="bg-[#262C28] border border-[#414A43] rounded-lg p-4 space-y-2">
          <div className="flex items-center space-x-2 text-xs font-mono font-medium text-[#D6A85F]">
            <Package className="w-3.5 h-3.5" />
            <span>Detected External Dependencies ({externalPackages.length})</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {externalPackages.map((pkg, idx) => (
              <span
                key={idx}
                className="text-xs font-mono bg-[#202522] border border-[#343B36] px-2 py-0.5 rounded text-[#B1B7B1]"
              >
                {pkg}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Data-dense Dependencies Table */}
      <div className="bg-[#262C28] border border-[#414A43] rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-[#202522] border-b border-[#343B36] text-[#858E86]">
              <tr>
                <th className="py-2.5 px-3.5 font-medium">Source Component</th>
                <th className="py-2.5 px-3 text-center font-medium">Relationship</th>
                <th className="py-2.5 px-3 font-medium">Target Component</th>
                <th className="py-2.5 px-3 font-medium">Category</th>
                <th className="py-2.5 px-3.5 font-medium">Line</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#343B36] text-[#F1F0E9]">
              {filtered.map((dep) => (
                <tr key={dep.id} className="hover:bg-[#202522] transition-colors">
                  <td className="py-2 px-3.5 font-medium text-[#F1F0E9] truncate max-w-xs" title={dep.source}>
                    {dep.source}
                  </td>
                  <td className="py-2 px-3 text-center">
                    <span
                      className={`text-[9px] uppercase font-mono px-1.5 py-0.2 rounded border inline-block ${
                        dep.relationshipType === 'inherits'
                          ? 'bg-[#202522] text-[#D6A85F] border-[#343B36]'
                          : dep.relationshipType === 'calls'
                          ? 'bg-[#202522] text-[#91B8D2] border-[#343B36]'
                          : 'bg-[#263A2D] text-[#81C995] border-[#537B5D]'
                      }`}
                    >
                      {dep.relationshipType}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-[#B1B7B1] truncate max-w-xs" title={dep.target}>
                    {dep.target}
                  </td>
                  <td className="py-2 px-3">
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded font-mono border ${
                        dep.category === 'internal'
                          ? 'text-[#81C995] bg-[#263A2D] border-[#537B5D]'
                          : 'text-[#D6A85F] bg-[#202522] border-[#343B36]'
                      }`}
                    >
                      {dep.category}
                    </span>
                  </td>
                  <td className="py-2 px-3.5 text-[#858E86]">
                    {dep.sourceLine ? `L${dep.sourceLine}` : '—'}
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
