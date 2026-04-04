// BOMTreeView — recursive multi-level BOM explosion tree.
// Fetches from GET /boms/:bomId/tree and renders a collapsible hierarchy.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, ChevronDown, Package, Layers, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';

// Item types that act as assemblies (have their own BOMs / children)
const ASSEMBLY_TYPES = ['sub_assembly', 'finished_good'];

// ============================================
// TreeNode — renders one BOM line + its children recursively
// ============================================
const TreeNode = ({ node, depth }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const hasChildren = node.children && node.children.length > 0;
  const isAssembly = ASSEMBLY_TYPES.includes(node.item?.type);
  const scrapPct = Number(node.scrapFactor);

  // Cap indentation at 6 levels to prevent overflow on deep trees
  const indentPx = Math.min(depth, 6) * 20 + 8;

  return (
    <div>
      <div
        className="flex items-center gap-2 py-1 px-2 rounded hover:bg-muted/50 text-sm"
        style={{ paddingLeft: `${indentPx}px` }}
      >
        {/* Expand / collapse toggle — only shown when there are children and no circular ref */}
        {hasChildren && !node._circular ? (
          <button
            type="button"
            onClick={() => setIsExpanded((e) => !e)}
            className="text-muted-foreground hover:text-foreground shrink-0"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded
              ? <ChevronDown className="h-4 w-4" />
              : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : (
          // Spacer keeps part numbers aligned regardless of whether node is expandable
          <span className="inline-block w-4 h-4 shrink-0" />
        )}

        {/* Type icon */}
        {isAssembly
          ? <Layers className="h-4 w-4 text-blue-500 shrink-0" />
          : <Package className="h-4 w-4 text-muted-foreground shrink-0" />}

        {/* Part number */}
        <span className="font-mono text-xs font-medium shrink-0">
          {node.item?.partNumber ?? '—'}
        </span>

        <span className="text-muted-foreground shrink-0">—</span>

        {/* Description */}
        <span className="flex-1 truncate text-foreground">
          {node.item?.description ?? ''}
        </span>

        {/* Quantity × UOM */}
        <span className="text-muted-foreground text-xs shrink-0">
          {Number(node.quantity)} {node.unitOfMeasure}
        </span>

        {/* Scrap factor (only shown when > 0) */}
        {scrapPct > 0 && (
          <span className="text-xs text-amber-600 shrink-0">
            scrap: {(scrapPct * 100).toFixed(1)}%
          </span>
        )}

        {/* Circular reference warning */}
        {node._circular && (
          <span className="flex items-center gap-1 text-xs text-amber-500 shrink-0">
            <AlertTriangle className="h-3 w-3" />
            circular ref
          </span>
        )}
      </div>

      {/* Render children when expanded (never recurse into circular refs) */}
      {hasChildren && isExpanded && !node._circular && (
        <div>
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================
// BOMTreeView — container component, owns the fetch
// ============================================
const BOMTreeView = ({ bomId }) => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['boms', bomId, 'tree'],
    queryFn: () => api.get(`/boms/${bomId}/tree`),
    enabled: Boolean(bomId),
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading tree...</p>;
  }

  if (isError) {
    return <p className="text-sm text-destructive">Failed to load BOM tree.</p>;
  }

  const treeData = data?.data;
  if (!treeData) return null;

  return (
    <div className="rounded-md border">
      {/* Root item header row */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/50 text-sm font-medium">
        <Layers className="h-4 w-4 text-blue-500 shrink-0" />
        <span className="font-mono text-xs">{treeData.item?.partNumber}</span>
        <span className="text-muted-foreground">—</span>
        <span className="flex-1 truncate">{treeData.item?.description}</span>
        <span className="ml-auto text-xs text-muted-foreground shrink-0">
          Rev {treeData.revision}
        </span>
      </div>

      {/* Tree lines */}
      {treeData.tree.length === 0 ? (
        <p className="px-3 py-4 text-sm text-muted-foreground">
          No components in this BOM.
        </p>
      ) : (
        <div className="py-1">
          {treeData.tree.map((node) => (
            <TreeNode key={node.id} node={node} depth={0} />
          ))}
        </div>
      )}
    </div>
  );
};

export default BOMTreeView;
