// Demand List page — /mrp/demand
// Paginated list of demand entries with status and item filters.
// Inline cancel action. Links to create and edit forms.

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import PageHeader from '@/components/shared/PageHeader';
import DataTable from '@/components/shared/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const STATUS_VARIANTS = {
  open: 'default',
  planned: 'secondary',
  fulfilled: 'default',
  cancelled: 'destructive',
};

const STATUS_LABELS = {
  open: 'Open',
  planned: 'Planned',
  fulfilled: 'Fulfilled',
  cancelled: 'Cancelled',
};

const DEMAND_STATUSES = ['open', 'planned', 'fulfilled', 'cancelled'];

const DemandListPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [itemFilter, setItemFilter] = useState('');

  // Load items for filter dropdown (only finished goods and sub-assemblies)
  const { data: itemsData } = useQuery({
    queryKey: ['items', 'producible'],
    queryFn: () => api.get('/items?pageSize=100&sort=partNumber&order=asc&isActive=true'),
  });
  const allItems = (itemsData?.data ?? []).filter(
    (i) => ['finished_good', 'sub_assembly'].includes(i.type)
  );

  const { data, isLoading } = useQuery({
    queryKey: ['mrp-demand', { page, status: statusFilter, itemId: itemFilter }],
    queryFn: () => {
      const params = new URLSearchParams({ page, pageSize: 25 });
      if (statusFilter) params.set('status', statusFilter);
      if (itemFilter) params.set('itemId', itemFilter);
      return api.get(`/mrp/demand?${params}`);
    },
    placeholderData: (prev) => prev,
  });

  const demand = data?.data ?? [];
  const meta = data?.meta ?? {};

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: (id) => api.patch(`/mrp/demand/${id}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mrp-demand'] });
      toast.success('Demand entry cancelled');
    },
    onError: (err) => toast.error(err.message || 'Cancel failed'),
  });

  const handleStatusChange = useCallback((e) => { setStatusFilter(e.target.value); setPage(1); }, []);
  const handleItemChange = useCallback((e) => { setItemFilter(e.target.value); setPage(1); }, []);

  const columns = [
    {
      accessorKey: 'item.partNumber',
      header: 'Item',
      enableSorting: false,
      cell: ({ row }) => {
        const item = row.original.item;
        return item ? `${item.partNumber} — ${item.description}` : '—';
      },
    },
    {
      accessorKey: 'quantityRequired',
      header: 'Qty Required',
      enableSorting: false,
      cell: ({ getValue }) => Number(getValue()),
    },
    {
      accessorKey: 'dateRequired',
      header: 'Date Required',
      enableSorting: false,
      cell: ({ getValue }) => new Date(getValue()).toLocaleDateString(),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      enableSorting: false,
      cell: ({ getValue }) => {
        const status = getValue();
        return (
          <Badge variant={STATUS_VARIANTS[status] ?? 'outline'}>
            {STATUS_LABELS[status] ?? status}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'source',
      header: 'Source',
      enableSorting: false,
      cell: ({ getValue }) => getValue() === 'manual' ? 'Manual' : getValue(),
    },
    {
      accessorKey: 'notes',
      header: 'Notes',
      enableSorting: false,
      cell: ({ getValue }) => {
        const val = getValue();
        return val ? (val.length > 40 ? val.slice(0, 40) + '...' : val) : '—';
      },
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      enableSorting: false,
      cell: ({ getValue }) => new Date(getValue()).toLocaleDateString(),
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => {
        const d = row.original;
        if (d.status !== 'open') return null;
        return (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => { e.stopPropagation(); navigate(`/mrp/demand/${d.id}`); }}
            >
              Edit
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={(e) => { e.stopPropagation(); cancelMutation.mutate(d.id); }}
              disabled={cancelMutation.isPending}
            >
              Cancel
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Demand Entries"
        actionLabel="Create Demand"
        action="/mrp/demand/new"
      />

      <div className="flex flex-wrap items-center gap-4">
        <select
          value={statusFilter}
          onChange={handleStatusChange}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm text-foreground"
        >
          <option value="">All Statuses</option>
          {DEMAND_STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>

        <select
          value={itemFilter}
          onChange={handleItemChange}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm text-foreground"
        >
          <option value="">All Items</option>
          {allItems.map((item) => (
            <option key={item.id} value={item.id}>
              {item.partNumber} — {item.description}
            </option>
          ))}
        </select>

        <Button variant="outline" onClick={() => navigate('/mrp/run')} className="ml-auto">
          Run MRP
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={demand}
        meta={meta}
        onPageChange={setPage}
        isLoading={isLoading}
        emptyMessage="No demand entries yet. Create one to get started."
      />
    </div>
  );
};

export default DemandListPage;
