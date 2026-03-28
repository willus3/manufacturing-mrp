// Stock Overview page — /inventory
// Shows current inventory stock with item/location details, filterable.

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import PageHeader from '@/components/shared/PageHeader';
import DataTable from '@/components/shared/DataTable';
import { Badge } from '@/components/ui/badge';

const INVENTORY_STATUSES = ['available', 'allocated', 'quarantine', 'in_transit', 'issued'];

const STATUS_VARIANTS = {
  available: 'default',
  allocated: 'secondary',
  quarantine: 'destructive',
  in_transit: 'outline',
  issued: 'outline',
};

const columns = [
  {
    accessorKey: 'item.partNumber',
    header: 'Part Number',
    enableSorting: false,
    cell: ({ row }) => row.original.item?.partNumber,
  },
  {
    accessorKey: 'item.description',
    header: 'Description',
    enableSorting: false,
    cell: ({ row }) => row.original.item?.description,
  },
  {
    accessorKey: 'location.name',
    header: 'Location',
    enableSorting: false,
    cell: ({ row }) => {
      const loc = row.original.location;
      return `${loc?.code} — ${loc?.name}`;
    },
  },
  {
    accessorKey: 'quantityOnHand',
    header: 'Qty On Hand',
    enableSorting: false,
    cell: ({ getValue, row }) => {
      const qty = Number(getValue());
      const uom = row.original.item?.unitOfMeasure || '';
      return `${qty} ${uom}`;
    },
  },
  {
    accessorKey: 'lotNumber',
    header: 'Lot',
    enableSorting: false,
    cell: ({ getValue }) => getValue() || '—',
  },
  {
    accessorKey: 'inventoryStatus',
    header: 'Status',
    enableSorting: false,
    cell: ({ getValue }) => {
      const status = getValue();
      return (
        <Badge variant={STATUS_VARIANTS[status] ?? 'outline'}>
          {status.replace('_', ' ')}
        </Badge>
      );
    },
  },
];

const StockOverviewPage = () => {
  const [page, setPage] = useState(1);
  const [itemFilter, setItemFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

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
    queryKey: ['inventory-stock', { page, itemId: itemFilter, locationId: locationFilter, status: statusFilter }],
    queryFn: () => {
      const params = new URLSearchParams({ page, pageSize: 25 });
      if (itemFilter) params.set('itemId', itemFilter);
      if (locationFilter) params.set('locationId', locationFilter);
      if (statusFilter) params.set('status', statusFilter);
      return api.get(`/inventory/stock?${params}`);
    },
    placeholderData: (prev) => prev,
  });

  const stock = data?.data ?? [];
  const meta = data?.meta ?? {};

  const handleItemChange = useCallback((e) => { setItemFilter(e.target.value); setPage(1); }, []);
  const handleLocationChange = useCallback((e) => { setLocationFilter(e.target.value); setPage(1); }, []);
  const handleStatusChange = useCallback((e) => { setStatusFilter(e.target.value); setPage(1); }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="Inventory Stock" />

      <div className="flex flex-wrap items-center gap-4">
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

        <select
          value={statusFilter}
          onChange={handleStatusChange}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm text-foreground"
        >
          <option value="">All Statuses</option>
          {INVENTORY_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
            </option>
          ))}
        </select>
      </div>

      <DataTable
        columns={columns}
        data={stock}
        meta={meta}
        onPageChange={setPage}
        isLoading={isLoading}
        emptyMessage="No inventory stock. Use Adjustments to add initial stock."
      />
    </div>
  );
};

export default StockOverviewPage;
