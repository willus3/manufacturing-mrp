// Item List page — /items
// Server-side paginated table with search, type filter, and sorting.
// Clicking a row navigates to the item detail/edit page.

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api';
import PageHeader from '@/components/shared/PageHeader';
import DataTable from '@/components/shared/DataTable';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

// Human-friendly labels for item types
const TYPE_LABELS = {
  raw_material: 'Raw Material',
  purchased_component: 'Purchased',
  sub_assembly: 'Sub-Assembly',
  finished_good: 'Finished Good',
  consumable: 'Consumable',
};

const ITEM_TYPES = Object.keys(TYPE_LABELS);

// Column definitions for TanStack Table
const columns = [
  {
    accessorKey: 'partNumber',
    header: 'Part Number',
    enableSorting: true,
  },
  {
    accessorKey: 'description',
    header: 'Description',
    enableSorting: true,
  },
  {
    accessorKey: 'type',
    header: 'Type',
    enableSorting: true,
    cell: ({ getValue }) => (
      <Badge variant="secondary">{TYPE_LABELS[getValue()] ?? getValue()}</Badge>
    ),
  },
  {
    accessorKey: 'unitOfMeasure',
    header: 'UoM',
    enableSorting: false,
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

const ItemListPage = () => {
  const navigate = useNavigate();

  // Query state — drives the API call
  const [page, setPage] = useState(1);
  const [sorting, setSorting] = useState([{ id: 'partNumber', desc: false }]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  // Build query params from state
  const sort = sorting[0]?.id ?? 'partNumber';
  const order = sorting[0]?.desc ? 'desc' : 'asc';

  // Fetch items from the API
  const { data, isLoading } = useQuery({
    queryKey: ['items', { page, sort, order, search, type: typeFilter }],
    queryFn: async () => {
      const params = new URLSearchParams({ page, pageSize: 25, sort, order });
      if (search) params.set('search', search);
      if (typeFilter) params.set('type', typeFilter);
      return api.get(`/items?${params}`);
    },
    // Keep previous data visible while fetching next page
    placeholderData: (prev) => prev,
  });

  const items = data?.data ?? [];
  const meta = data?.meta ?? {};

  // Debounced search — reset to page 1 on new search
  const handleSearchChange = useCallback((e) => {
    setSearch(e.target.value);
    setPage(1);
  }, []);

  const handleTypeChange = useCallback((e) => {
    setTypeFilter(e.target.value);
    setPage(1);
  }, []);

  const handleSortingChange = useCallback((updater) => {
    setSorting(updater);
    setPage(1);
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Items"
        action="/items/new"
        actionLabel="New Item"
        actionIcon={Plus}
      />

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-4">
        <Input
          placeholder="Search part number or description..."
          value={search}
          onChange={handleSearchChange}
          className="max-w-sm"
        />
        <select
          value={typeFilter}
          onChange={handleTypeChange}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm text-foreground"
        >
          <option value="">All Types</option>
          {ITEM_TYPES.map((type) => (
            <option key={type} value={type}>
              {TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </div>

      {/* Data table */}
      <DataTable
        columns={columns}
        data={items}
        meta={meta}
        sorting={sorting}
        onSortingChange={handleSortingChange}
        onPageChange={setPage}
        onRowClick={(item) => navigate(`/items/${item.id}`)}
        isLoading={isLoading}
        emptyMessage="No items found. Create your first item to get started."
      />
    </div>
  );
};

export default ItemListPage;
