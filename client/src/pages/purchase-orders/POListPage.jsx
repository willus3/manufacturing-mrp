// PO List page — /purchase-orders
// Paginated, filterable list of purchase orders with status badges.

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import PageHeader from '@/components/shared/PageHeader';
import DataTable from '@/components/shared/DataTable';
import { Badge } from '@/components/ui/badge';

const STATUS_VARIANTS = {
  draft: 'secondary',
  sent: 'default',
  partial: 'outline',
  received: 'default',
  cancelled: 'destructive',
};

const STATUS_LABELS = {
  draft: 'Draft',
  sent: 'Sent',
  partial: 'Partial',
  received: 'Received',
  cancelled: 'Cancelled',
};

const PO_STATUSES = ['draft', 'sent', 'partial', 'received', 'cancelled'];

const columns = [
  {
    accessorKey: 'poNumber',
    header: 'PO Number',
    enableSorting: true,
  },
  {
    accessorKey: 'supplier.name',
    header: 'Supplier',
    enableSorting: false,
    cell: ({ row }) => row.original.supplier?.name,
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
    accessorKey: '_count.lines',
    header: 'Lines',
    enableSorting: false,
    cell: ({ row }) => row.original._count?.lines ?? 0,
  },
  {
    accessorKey: 'orderDate',
    header: 'Order Date',
    enableSorting: true,
    cell: ({ getValue }) => {
      const val = getValue();
      return val ? new Date(val).toLocaleDateString() : '—';
    },
  },
  {
    accessorKey: 'expectedDate',
    header: 'Expected',
    enableSorting: true,
    cell: ({ getValue }) => {
      const val = getValue();
      return val ? new Date(val).toLocaleDateString() : '—';
    },
  },
  {
    accessorKey: 'createdAt',
    header: 'Created',
    enableSorting: true,
    cell: ({ getValue }) => new Date(getValue()).toLocaleDateString(),
  },
];

const POListPage = () => {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [page, setPage] = useState(1);
  const [sorting, setSorting] = useState([{ id: 'createdAt', desc: true }]);
  const [statusFilter, setStatusFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');

  const sortField = sorting[0]?.id || 'createdAt';
  const sortOrder = sorting[0]?.desc ? 'desc' : 'asc';

  // Load suppliers for filter dropdown
  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers', 'all'],
    queryFn: () => api.get('/suppliers?pageSize=100&sort=name&order=asc'),
  });
  const suppliers = suppliersData?.data ?? [];

  const { data, isLoading } = useQuery({
    queryKey: ['purchase-orders', { page, sortField, sortOrder, status: statusFilter, supplierId: supplierFilter }],
    queryFn: () => {
      const params = new URLSearchParams({
        page,
        pageSize: 25,
        sort: sortField,
        order: sortOrder,
      });
      if (statusFilter) params.set('status', statusFilter);
      if (supplierFilter) params.set('supplierId', supplierFilter);
      return api.get(`/purchase-orders?${params}`);
    },
    placeholderData: (prev) => prev,
  });

  const purchaseOrders = data?.data ?? [];
  const meta = data?.meta ?? {};

  const handleStatusChange = useCallback((e) => {
    setStatusFilter(e.target.value);
    setPage(1);
  }, []);

  const handleSupplierChange = useCallback((e) => {
    setSupplierFilter(e.target.value);
    setPage(1);
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Orders"
        actionLabel={hasPermission('po:write') ? 'Create PO' : undefined}
        action={hasPermission('po:write') ? '/purchase-orders/new' : undefined}
      />

      <div className="flex flex-wrap items-center gap-4">
        <select
          value={statusFilter}
          onChange={handleStatusChange}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm text-foreground"
        >
          <option value="">All Statuses</option>
          {PO_STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>

        <select
          value={supplierFilter}
          onChange={handleSupplierChange}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm text-foreground"
        >
          <option value="">All Suppliers</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      <DataTable
        columns={columns}
        data={purchaseOrders}
        meta={meta}
        sorting={sorting}
        onSortingChange={setSorting}
        onPageChange={setPage}
        onRowClick={(row) => navigate(`/purchase-orders/${row.id}`)}
        isLoading={isLoading}
        emptyMessage="No purchase orders yet."
      />
    </div>
  );
};

export default POListPage;
