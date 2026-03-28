// BOM List page — /boms
// Shows all BOMs with item name, revision, status, and line count.

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api';
import PageHeader from '@/components/shared/PageHeader';
import DataTable from '@/components/shared/DataTable';
import { Badge } from '@/components/ui/badge';

const STATUS_VARIANTS = {
  draft: 'secondary',
  active: 'default',
  obsolete: 'outline',
};

const columns = [
  {
    accessorKey: 'item.partNumber',
    header: 'Item',
    enableSorting: false,
    cell: ({ row }) => {
      const item = row.original.item;
      return (
        <div>
          <span className="font-medium">{item?.partNumber}</span>
          <span className="ml-2 text-muted-foreground">{item?.description}</span>
        </div>
      );
    },
  },
  {
    accessorKey: 'revision',
    header: 'Revision',
    enableSorting: true,
  },
  {
    accessorKey: 'status',
    header: 'Status',
    enableSorting: true,
    cell: ({ getValue }) => {
      const status = getValue();
      return (
        <Badge variant={STATUS_VARIANTS[status] ?? 'outline'}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Badge>
      );
    },
  },
  {
    id: 'lineCount',
    header: 'Lines',
    enableSorting: false,
    cell: ({ row }) => row.original._count?.bomLines ?? 0,
  },
  {
    accessorKey: 'createdAt',
    header: 'Created',
    enableSorting: true,
    cell: ({ getValue }) => new Date(getValue()).toLocaleDateString(),
  },
];

const BOMListPage = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [sorting, setSorting] = useState([{ id: 'createdAt', desc: true }]);
  const [statusFilter, setStatusFilter] = useState('');
  const [itemFilter, setItemFilter] = useState('');

  const sort = sorting[0]?.id ?? 'createdAt';
  const order = sorting[0]?.desc ? 'desc' : 'asc';

  // Load items for filter dropdown
  const { data: itemsData } = useQuery({
    queryKey: ['items', 'all'],
    queryFn: () => api.get('/items?pageSize=100&sort=partNumber&order=asc'),
  });
  const items = itemsData?.data ?? [];

  const { data, isLoading } = useQuery({
    queryKey: ['boms', { page, sort, order, status: statusFilter, itemId: itemFilter }],
    queryFn: async () => {
      const params = new URLSearchParams({ page, pageSize: 25, sort, order });
      if (statusFilter) params.set('status', statusFilter);
      if (itemFilter) params.set('itemId', itemFilter);
      return api.get(`/boms?${params}`);
    },
    placeholderData: (prev) => prev,
  });

  const boms = data?.data ?? [];
  const meta = data?.meta ?? {};

  const handleStatusChange = useCallback((e) => {
    setStatusFilter(e.target.value);
    setPage(1);
  }, []);

  const handleItemChange = useCallback((e) => {
    setItemFilter(e.target.value);
    setPage(1);
  }, []);

  const handleSortingChange = useCallback((updater) => {
    setSorting(updater);
    setPage(1);
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bills of Materials"
        action="/boms/new"
        actionLabel="New BOM"
        actionIcon={Plus}
      />

      <div className="flex flex-wrap items-center gap-4">
        <select
          value={statusFilter}
          onChange={handleStatusChange}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm text-foreground"
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="obsolete">Obsolete</option>
        </select>

        <select
          value={itemFilter}
          onChange={handleItemChange}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm text-foreground"
        >
          <option value="">All Items</option>
          {items
            .filter((i) => ['finished_good', 'sub_assembly'].includes(i.type))
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.partNumber} — {item.description}
              </option>
            ))}
        </select>
      </div>

      <DataTable
        columns={columns}
        data={boms}
        meta={meta}
        sorting={sorting}
        onSortingChange={handleSortingChange}
        onPageChange={setPage}
        onRowClick={(bom) => navigate(`/boms/${bom.id}`)}
        isLoading={isLoading}
        emptyMessage="No BOMs found. Create your first bill of materials."
      />
    </div>
  );
};

export default BOMListPage;
