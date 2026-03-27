// Supplier List page — /suppliers
// Server-side paginated table with search. Clicking a row navigates to edit.

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api';
import PageHeader from '@/components/shared/PageHeader';
import DataTable from '@/components/shared/DataTable';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

const columns = [
  {
    accessorKey: 'name',
    header: 'Supplier Name',
    enableSorting: true,
  },
  {
    accessorKey: 'code',
    header: 'Code',
    enableSorting: true,
    cell: ({ getValue }) => getValue() || '—',
  },
  {
    accessorKey: 'contactName',
    header: 'Contact',
    enableSorting: true,
    cell: ({ getValue }) => getValue() || '—',
  },
  {
    accessorKey: 'contactEmail',
    header: 'Email',
    enableSorting: false,
    cell: ({ getValue }) => getValue() || '—',
  },
  {
    accessorKey: 'isActive',
    header: 'Status',
    enableSorting: false,
    cell: ({ getValue }) => (
      <Badge variant={getValue() ? 'default' : 'outline'}>
        {getValue() ? 'Active' : 'Inactive'}
      </Badge>
    ),
  },
];

const SupplierListPage = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [sorting, setSorting] = useState([{ id: 'name', desc: false }]);
  const [search, setSearch] = useState('');

  const sort = sorting[0]?.id ?? 'name';
  const order = sorting[0]?.desc ? 'desc' : 'asc';

  const { data, isLoading } = useQuery({
    queryKey: ['suppliers', { page, sort, order, search }],
    queryFn: async () => {
      const params = new URLSearchParams({ page, pageSize: 25, sort, order });
      if (search) params.set('search', search);
      return api.get(`/suppliers?${params}`);
    },
    placeholderData: (prev) => prev,
  });

  const suppliers = data?.data ?? [];
  const meta = data?.meta ?? {};

  const handleSearchChange = useCallback((e) => {
    setSearch(e.target.value);
    setPage(1);
  }, []);

  const handleSortingChange = useCallback((updater) => {
    setSorting(updater);
    setPage(1);
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Suppliers"
        action="/suppliers/new"
        actionLabel="New Supplier"
        actionIcon={Plus}
      />

      <div className="flex flex-wrap items-center gap-4">
        <Input
          placeholder="Search name, code, or contact..."
          value={search}
          onChange={handleSearchChange}
          className="max-w-sm"
        />
      </div>

      <DataTable
        columns={columns}
        data={suppliers}
        meta={meta}
        sorting={sorting}
        onSortingChange={handleSortingChange}
        onPageChange={setPage}
        onRowClick={(supplier) => navigate(`/suppliers/${supplier.id}`)}
        isLoading={isLoading}
        emptyMessage="No suppliers found. Add your first supplier to get started."
      />
    </div>
  );
};

export default SupplierListPage;
