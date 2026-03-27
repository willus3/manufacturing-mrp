// Location List page — /inventory/locations
// Simple list (no pagination — locations are few per tenant).

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
    accessorKey: 'code',
    header: 'Code',
    enableSorting: true,
  },
  {
    accessorKey: 'name',
    header: 'Name',
    enableSorting: true,
  },
  {
    accessorKey: 'description',
    header: 'Description',
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

const LocationListPage = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['locations', { search }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const queryStr = params.toString();
      return api.get(`/locations${queryStr ? `?${queryStr}` : ''}`);
    },
    placeholderData: (prev) => prev,
  });

  const locations = data?.data ?? [];

  const handleSearchChange = useCallback((e) => {
    setSearch(e.target.value);
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Locations"
        action="/inventory/locations/new"
        actionLabel="New Location"
        actionIcon={Plus}
      />

      <div className="flex flex-wrap items-center gap-4">
        <Input
          placeholder="Search name or code..."
          value={search}
          onChange={handleSearchChange}
          className="max-w-sm"
        />
      </div>

      <DataTable
        columns={columns}
        data={locations}
        onRowClick={(location) => navigate(`/inventory/locations/${location.id}`)}
        isLoading={isLoading}
        emptyMessage="No locations found. Add your first warehouse or storage area."
      />
    </div>
  );
};

export default LocationListPage;
