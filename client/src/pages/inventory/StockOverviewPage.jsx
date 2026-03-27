// Stock Overview page — /inventory
// Shows current inventory stock with item/location details, filterable.

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import PageHeader from '@/components/shared/PageHeader';
import DataTable from '@/components/shared/DataTable';
import { Badge } from '@/components/ui/badge';

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

  const { data, isLoading } = useQuery({
    queryKey: ['inventory-stock', { page }],
    queryFn: () => api.get(`/inventory/stock?page=${page}&pageSize=25`),
    placeholderData: (prev) => prev,
  });

  const stock = data?.data ?? [];
  const meta = data?.meta ?? {};

  return (
    <div className="space-y-6">
      <PageHeader title="Inventory Stock" />

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
