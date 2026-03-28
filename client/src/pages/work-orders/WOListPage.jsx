// WO List page — /work-orders
// Paginated, filterable list of work orders with status badges and priority.

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import PageHeader from '@/components/shared/PageHeader';
import DataTable from '@/components/shared/DataTable';
import { Badge } from '@/components/ui/badge';

const STATUS_VARIANTS = {
  planned: 'secondary',
  released: 'default',
  in_progress: 'outline',
  completed: 'default',
  cancelled: 'destructive',
};

const STATUS_LABELS = {
  planned: 'Planned',
  released: 'Released',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const WO_STATUSES = ['planned', 'released', 'in_progress', 'completed', 'cancelled'];

const columns = [
  {
    accessorKey: 'woNumber',
    header: 'WO Number',
    enableSorting: true,
  },
  {
    accessorKey: 'bom.item.partNumber',
    header: 'Product',
    enableSorting: false,
    cell: ({ row }) => {
      const item = row.original.bom?.item;
      return item ? `${item.partNumber} — ${item.description}` : '—';
    },
  },
  {
    accessorKey: 'quantity',
    header: 'Qty',
    enableSorting: false,
    cell: ({ getValue }) => Number(getValue()),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    enableSorting: true,
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
    accessorKey: 'priority',
    header: 'Priority',
    enableSorting: true,
    cell: ({ getValue }) => getValue() || 0,
  },
  {
    accessorKey: 'scheduledStart',
    header: 'Start',
    enableSorting: true,
    cell: ({ getValue }) => {
      const val = getValue();
      return val ? new Date(val).toLocaleDateString() : '—';
    },
  },
  {
    accessorKey: 'scheduledEnd',
    header: 'End',
    enableSorting: true,
    cell: ({ getValue }) => {
      const val = getValue();
      return val ? new Date(val).toLocaleDateString() : '—';
    },
  },
  {
    accessorKey: '_count.lines',
    header: 'Lines',
    enableSorting: false,
    cell: ({ row }) => row.original._count?.lines ?? 0,
  },
  {
    accessorKey: 'createdAt',
    header: 'Created',
    enableSorting: true,
    cell: ({ getValue }) => new Date(getValue()).toLocaleDateString(),
  },
];

const WOListPage = () => {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [page, setPage] = useState(1);
  const [sorting, setSorting] = useState([{ id: 'createdAt', desc: true }]);
  const [statusFilter, setStatusFilter] = useState('');

  const sortField = sorting[0]?.id || 'createdAt';
  const sortOrder = sorting[0]?.desc ? 'desc' : 'asc';

  const { data, isLoading } = useQuery({
    queryKey: ['work-orders', { page, sortField, sortOrder, status: statusFilter }],
    queryFn: () => {
      const params = new URLSearchParams({
        page,
        pageSize: 25,
        sort: sortField,
        order: sortOrder,
      });
      if (statusFilter) params.set('status', statusFilter);
      return api.get(`/work-orders?${params}`);
    },
    placeholderData: (prev) => prev,
  });

  const workOrders = data?.data ?? [];
  const meta = data?.meta ?? {};

  const handleStatusChange = useCallback((e) => {
    setStatusFilter(e.target.value);
    setPage(1);
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Work Orders"
        actionLabel={hasPermission('workorder:write') ? 'Create Work Order' : undefined}
        action={hasPermission('workorder:write') ? '/work-orders/new' : undefined}
      />

      <div className="flex flex-wrap items-center gap-4">
        <select
          value={statusFilter}
          onChange={handleStatusChange}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm text-foreground"
        >
          <option value="">All Statuses</option>
          {WO_STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
      </div>

      <DataTable
        columns={columns}
        data={workOrders}
        meta={meta}
        sorting={sorting}
        onSortingChange={setSorting}
        onPageChange={setPage}
        onRowClick={(row) => navigate(`/work-orders/${row.id}`)}
        isLoading={isLoading}
        emptyMessage="No work orders yet."
      />
    </div>
  );
};

export default WOListPage;
