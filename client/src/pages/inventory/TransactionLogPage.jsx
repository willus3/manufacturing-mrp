// Transaction Log page — /inventory/transactions
// Filterable, paginated audit trail of all inventory movements.

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import PageHeader from '@/components/shared/PageHeader';
import DataTable from '@/components/shared/DataTable';
import { Badge } from '@/components/ui/badge';

const TYPE_VARIANTS = {
  receipt: 'default',
  issue: 'destructive',
  adjustment: 'secondary',
  transfer: 'outline',
  scrap: 'destructive',
};

const columns = [
  {
    accessorKey: 'performedAt',
    header: 'Date',
    enableSorting: false,
    cell: ({ getValue }) => new Date(getValue()).toLocaleString(),
  },
  {
    accessorKey: 'transactionType',
    header: 'Type',
    enableSorting: false,
    cell: ({ getValue }) => {
      const type = getValue();
      return (
        <Badge variant={TYPE_VARIANTS[type] ?? 'outline'}>
          {type.charAt(0).toUpperCase() + type.slice(1)}
        </Badge>
      );
    },
  },
  {
    accessorKey: 'item.partNumber',
    header: 'Item',
    enableSorting: false,
    cell: ({ row }) => row.original.item?.partNumber,
  },
  {
    accessorKey: 'location.code',
    header: 'Location',
    enableSorting: false,
    cell: ({ row }) => row.original.location?.code,
  },
  {
    accessorKey: 'quantity',
    header: 'Qty',
    enableSorting: false,
    cell: ({ getValue }) => {
      const qty = Number(getValue());
      return (
        <span className={qty < 0 ? 'text-destructive' : 'text-green-600'}>
          {qty > 0 ? '+' : ''}{qty}
        </span>
      );
    },
  },
  {
    accessorKey: 'user',
    header: 'By',
    enableSorting: false,
    cell: ({ row }) => {
      const user = row.original.user;
      return user ? `${user.firstName} ${user.lastName}` : '—';
    },
  },
  {
    accessorKey: 'notes',
    header: 'Notes',
    enableSorting: false,
    cell: ({ getValue }) => getValue() || '—',
  },
];

const TRANSACTION_TYPES = ['receipt', 'issue', 'adjustment', 'transfer', 'scrap'];

const TransactionLogPage = () => {
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('');
  const [itemFilter, setItemFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Load items and locations for filter dropdowns
  const { data: itemsData } = useQuery({
    queryKey: ['items', 'all'],
    queryFn: () => api.get('/items?pageSize=100&sort=partNumber&order=asc'),
  });
  const { data: locsData } = useQuery({
    queryKey: ['locations', 'active'],
    queryFn: () => api.get('/locations?isActive=true'),
  });
  const items = itemsData?.data ?? [];
  const locations = locsData?.data ?? [];

  const { data, isLoading } = useQuery({
    queryKey: ['inventory-transactions', { page, type: typeFilter, itemId: itemFilter, locationId: locationFilter, dateFrom, dateTo }],
    queryFn: () => {
      const params = new URLSearchParams({ page, pageSize: 25 });
      if (typeFilter) params.set('type', typeFilter);
      if (itemFilter) params.set('itemId', itemFilter);
      if (locationFilter) params.set('locationId', locationFilter);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      return api.get(`/inventory/transactions?${params}`);
    },
    placeholderData: (prev) => prev,
  });

  const transactions = data?.data ?? [];
  const meta = data?.meta ?? {};

  const handleTypeChange = useCallback((e) => { setTypeFilter(e.target.value); setPage(1); }, []);
  const handleItemChange = useCallback((e) => { setItemFilter(e.target.value); setPage(1); }, []);
  const handleLocationChange = useCallback((e) => { setLocationFilter(e.target.value); setPage(1); }, []);
  const handleDateFromChange = useCallback((e) => { setDateFrom(e.target.value); setPage(1); }, []);
  const handleDateToChange = useCallback((e) => { setDateTo(e.target.value); setPage(1); }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="Transaction Log" />

      <div className="flex flex-wrap items-center gap-4">
        <select
          value={typeFilter}
          onChange={handleTypeChange}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm text-foreground"
        >
          <option value="">All Types</option>
          {TRANSACTION_TYPES.map((type) => (
            <option key={type} value={type}>
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </option>
          ))}
        </select>

        <select
          value={itemFilter}
          onChange={handleItemChange}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm text-foreground"
        >
          <option value="">All Items</option>
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.partNumber} — {item.description}
            </option>
          ))}
        </select>

        <select
          value={locationFilter}
          onChange={handleLocationChange}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm text-foreground"
        >
          <option value="">All Locations</option>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.code} — {loc.name}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={dateFrom}
          onChange={handleDateFromChange}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm text-foreground"
          aria-label="Date from"
        />
        <span className="text-sm text-muted-foreground">to</span>
        <input
          type="date"
          value={dateTo}
          onChange={handleDateToChange}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm text-foreground"
          aria-label="Date to"
        />
      </div>

      <DataTable
        columns={columns}
        data={transactions}
        meta={meta}
        onPageChange={setPage}
        isLoading={isLoading}
        emptyMessage="No transactions recorded yet."
      />
    </div>
  );
};

export default TransactionLogPage;
