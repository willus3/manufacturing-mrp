// Item List page — /items
// Server-side paginated table with search, type filter, and sorting.
// Clicking a row navigates to the item detail/edit page.

import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import PageHeader from '@/components/shared/PageHeader';
import DataTable from '@/components/shared/DataTable';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

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
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const fileInputRef = useRef(null);
  const [isImporting, setIsImporting] = useState(false);

  // CSV import handler
  const handleImport = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await api.upload('/items/import', formData);
      const d = result.data;

      queryClient.invalidateQueries({ queryKey: ['items'] });

      // Build a detailed toast message
      let msg = `Imported ${d.imported} item(s).`;
      if (d.skipped) msg += ` ${d.skipped.join('. ')}`;
      if (d.errors) msg += ` ${d.errors.length} row(s) had errors.`;
      toast.success(msg);

      if (d.errors?.length > 0) {
        console.log('Import errors:', d.errors);
      }
    } catch (err) {
      toast.error(err.message || 'Import failed');
    } finally {
      setIsImporting(false);
      // Reset the file input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [queryClient]);

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

        {hasPermission('item:write') && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleImport}
              className="hidden"
              aria-label="Import items CSV"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
            >
              <Upload className="mr-1 h-4 w-4" />
              {isImporting ? 'Importing...' : 'Import CSV'}
            </Button>
          </>
        )}
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
