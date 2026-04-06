// MRP Results page — /mrp/results/:runId
// Shows suggestions from an MRP run, grouped by action type (purchase/produce).
// Each result can be converted to a PO or WO, or dismissed.

import { useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';

const ACTION_LABELS = { purchase: 'Purchase', produce: 'Produce' };
const STATUS_VARIANTS = {
  suggested: 'outline',
  converted: 'default',
  dismissed: 'secondary',
};
const STATUS_LABELS = {
  suggested: 'Suggested',
  converted: 'Converted',
  dismissed: 'Dismissed',
};

const RUN_STATUS_VARIANTS = {
  running: 'outline',
  completed: 'default',
  failed: 'destructive',
};

const MRPResultsPage = () => {
  const { runId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [actionFilter, setActionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  // Selected purchase suggestion IDs for bulk PO creation
  const [selectedIds, setSelectedIds] = useState(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ['mrp-results', runId, { actionType: actionFilter, status: statusFilter }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (actionFilter) params.set('actionType', actionFilter);
      if (statusFilter) params.set('status', statusFilter);
      return api.get(`/mrp/runs/${runId}/results?${params}`);
    },
  });

  const run = data?.data?.run;
  const results = data?.data?.results ?? [];

  // Group results by action type for display
  const purchaseResults = results.filter((r) => r.actionType === 'purchase');
  const produceResults = results.filter((r) => r.actionType === 'produce');

  // Convert mutation
  const convertMutation = useMutation({
    mutationFn: (resultId) => api.post(`/mrp/runs/${runId}/results/${resultId}/convert`),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['mrp-results'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      const result = data.data;
      if (result.type === 'purchase_order') {
        toast.success(`Created PO ${result.po.poNumber}`);
      } else {
        toast.success(`Created WO ${result.wo.woNumber}`);
      }
    },
    onError: (err) => toast.error(err.message || 'Conversion failed'),
  });

  // Dismiss mutation
  const dismissMutation = useMutation({
    mutationFn: (resultId) => api.patch(`/mrp/runs/${runId}/results/${resultId}/dismiss`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mrp-results'] });
      toast.success('Suggestion dismissed');
    },
    onError: (err) => toast.error(err.message || 'Dismiss failed'),
  });

  // Bulk convert mutation — groups selected purchase suggestions by supplier into POs
  const bulkConvertMutation = useMutation({
    mutationFn: (resultIds) =>
      api.post(`/mrp/runs/${runId}/results/convert-bulk`, { resultIds }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['mrp-results'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      const { converted, purchaseOrdersCreated } = data.data;
      toast.success(
        `Created ${purchaseOrdersCreated} PO${purchaseOrdersCreated !== 1 ? 's' : ''} from ${converted} suggestion${converted !== 1 ? 's' : ''}`
      );
      setSelectedIds(new Set());
    },
    onError: (err) => toast.error(err.message || 'Bulk conversion failed'),
  });

  const handleActionFilterChange = useCallback((e) => setActionFilter(e.target.value), []);
  const handleStatusFilterChange = useCallback((e) => setStatusFilter(e.target.value), []);

  const toggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // Renders a results table for a given action type.
  // Purchase tables support bulk selection via checkboxes.
  const ResultsTable = ({ title, rows, actionType }) => {
    if (rows.length === 0) return null;

    const suggestedRows = rows.filter((r) => r.status === 'suggested');
    const allSuggestedSelected =
      suggestedRows.length > 0 && suggestedRows.every((r) => selectedIds.has(r.id));

    const toggleSelectAll = () => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (allSuggestedSelected) {
          suggestedRows.forEach((r) => next.delete(r.id));
        } else {
          suggestedRows.forEach((r) => next.add(r.id));
        }
        return next;
      });
    };

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Label className="text-base font-semibold">{title} ({rows.length})</Label>
          {actionType === 'purchase' && selectedIds.size > 0 && (
            <Button
              size="sm"
              onClick={() => bulkConvertMutation.mutate([...selectedIds])}
              disabled={bulkConvertMutation.isPending}
            >
              {bulkConvertMutation.isPending
                ? 'Creating...'
                : `Create POs (${selectedIds.size} selected)`}
            </Button>
          )}
        </div>
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                {actionType === 'purchase' && (
                  <th className="px-3 py-2 w-8">
                    {suggestedRows.length > 0 && (
                      <input
                        type="checkbox"
                        checked={allSuggestedSelected}
                        onChange={toggleSelectAll}
                        aria-label="Select all suggested"
                        className="cursor-pointer"
                      />
                    )}
                  </th>
                )}
                <th className="px-3 py-2 text-left font-medium">Item</th>
                <th className="px-3 py-2 text-left font-medium">UOM</th>
                <th className="px-3 py-2 text-left font-medium w-28">Qty Needed</th>
                <th className="px-3 py-2 text-left font-medium w-28">Date Needed</th>
                <th className="px-3 py-2 text-left font-medium w-28">Order By</th>
                {actionType === 'purchase' && (
                  <th className="px-3 py-2 text-left font-medium">Supplier</th>
                )}
                <th className="px-3 py-2 text-left font-medium w-24">Status</th>
                <th className="px-3 py-2 w-48" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  {actionType === 'purchase' && (
                    <td className="px-3 py-2">
                      {r.status === 'suggested' && (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(r.id)}
                          onChange={() => toggleSelect(r.id)}
                          aria-label={`Select ${r.item?.partNumber}`}
                          className="cursor-pointer"
                        />
                      )}
                    </td>
                  )}
                  <td className="px-3 py-2">
                    {r.item?.partNumber} — {r.item?.description}
                  </td>
                  <td className="px-3 py-2">{r.item?.unitOfMeasure}</td>
                  <td className="px-3 py-2">{Number(r.quantityNeeded)}</td>
                  <td className="px-3 py-2">{new Date(r.dateNeeded).toLocaleDateString()}</td>
                  <td className="px-3 py-2">{new Date(r.suggestedOrderDate).toLocaleDateString()}</td>
                  {actionType === 'purchase' && (
                    <td className="px-3 py-2">
                      {r.supplier ? `${r.supplier.code || ''} ${r.supplier.name}`.trim() : '—'}
                    </td>
                  )}
                  <td className="px-3 py-2">
                    <Badge variant={STATUS_VARIANTS[r.status]}>
                      {STATUS_LABELS[r.status]}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    {r.status === 'suggested' && (
                      <div className="flex gap-2">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => convertMutation.mutate(r.id)}
                          disabled={convertMutation.isPending}
                        >
                          {actionType === 'purchase' ? 'Create PO' : 'Create WO'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => dismissMutation.mutate(r.id)}
                          disabled={dismissMutation.isPending}
                        >
                          Dismiss
                        </Button>
                      </div>
                    )}
                    {r.status === 'converted' && (
                      <span className="text-xs text-muted-foreground">
                        → {r.convertedToType === 'purchase_order' ? 'PO' : 'WO'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="MRP Results" />
        <p className="text-muted-foreground">Loading results...</p>
      </div>
    );
  }

  // Summary counts
  const suggestedCount = results.filter((r) => r.status === 'suggested').length;
  const convertedCount = results.filter((r) => r.status === 'converted').length;
  const dismissedCount = results.filter((r) => r.status === 'dismissed').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <PageHeader title="MRP Results" />
        {run && (
          <Badge variant={RUN_STATUS_VARIANTS[run.status]} className="mt-1">
            {run.status}
          </Badge>
        )}
      </div>

      {/* Run info */}
      {run && (
        <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
          <span>Run: {new Date(run.ranAt).toLocaleString()}</span>
          <span>Horizon: {run.parameters?.planningHorizonDays ?? '—'} days</span>
          <span>Total: {results.length} suggestions</span>
          <span className="text-foreground font-medium">{suggestedCount} pending</span>
          <span>{convertedCount} converted</span>
          <span>{dismissedCount} dismissed</span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <select
          value={actionFilter}
          onChange={handleActionFilterChange}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm text-foreground"
        >
          <option value="">All Actions</option>
          <option value="purchase">Purchase</option>
          <option value="produce">Produce</option>
        </select>

        <select
          value={statusFilter}
          onChange={handleStatusFilterChange}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm text-foreground"
        >
          <option value="">All Statuses</option>
          <option value="suggested">Suggested</option>
          <option value="converted">Converted</option>
          <option value="dismissed">Dismissed</option>
        </select>

        <Button variant="outline" onClick={() => navigate('/mrp/run')} className="ml-auto">
          Back to Run
        </Button>
        <Button variant="outline" onClick={() => navigate('/mrp/demand')}>
          Demand List
        </Button>
      </div>

      {/* Results grouped by action */}
      {results.length === 0 ? (
        <p className="text-muted-foreground">No results match the current filters.</p>
      ) : (
        <div className="space-y-8">
          <ResultsTable title="Purchase Suggestions" rows={purchaseResults} actionType="purchase" />
          <ResultsTable title="Production Suggestions" rows={produceResults} actionType="produce" />
        </div>
      )}
    </div>
  );
};

export default MRPResultsPage;
