// Admin User List page — /admin/users
// Shows all users in the tenant with search and active/inactive filter.
// Requires users:manage permission (enforced by route guard).

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api';
import PageHeader from '@/components/shared/PageHeader';
import DataTable from '@/components/shared/DataTable';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const columns = [
  {
    accessorKey: 'firstName',
    header: 'Name',
    enableSorting: true,
    cell: ({ row }) => {
      const u = row.original;
      return `${u.firstName} ${u.lastName}`;
    },
  },
  {
    accessorKey: 'email',
    header: 'Email',
    enableSorting: true,
  },
  {
    accessorKey: 'roles',
    header: 'Roles',
    enableSorting: false,
    cell: ({ getValue }) => {
      const roles = getValue() || [];
      if (roles.length === 0) return <span className="text-muted-foreground">No roles</span>;
      return (
        <div className="flex flex-wrap gap-1">
          {roles.map((role) => (
            <Badge key={role.id} variant="outline" className="text-xs">
              {role.name}
            </Badge>
          ))}
        </div>
      );
    },
  },
  {
    accessorKey: 'isActive',
    header: 'Status',
    enableSorting: false,
    cell: ({ getValue }) => (
      <Badge variant={getValue() ? 'default' : 'secondary'}>
        {getValue() ? 'Active' : 'Inactive'}
      </Badge>
    ),
  },
  {
    accessorKey: 'lastLoginAt',
    header: 'Last Login',
    enableSorting: false,
    cell: ({ getValue }) => {
      const val = getValue();
      if (!val) return <span className="text-muted-foreground">Never</span>;
      return new Date(val).toLocaleDateString();
    },
  },
];

const UserListPage = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('true'); // 'true', 'false', 'all'

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', { search, isActive: activeFilter }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (activeFilter !== 'all') params.set('isActive', activeFilter);
      const queryStr = params.toString();
      return api.get(`/admin/users${queryStr ? `?${queryStr}` : ''}`);
    },
    placeholderData: (prev) => prev,
  });

  const users = data?.data ?? [];

  const handleSearchChange = useCallback((e) => {
    setSearch(e.target.value);
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        action="/admin/users/new"
        actionLabel="New User"
        actionIcon={Plus}
      />

      <div className="flex flex-wrap items-center gap-4">
        <Input
          placeholder="Search by name or email..."
          value={search}
          onChange={handleSearchChange}
          className="max-w-sm"
          aria-label="Search users"
        />
        <Select value={activeFilter} onValueChange={setActiveFilter}>
          <SelectTrigger className="w-40" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">Active</SelectItem>
            <SelectItem value="false">Inactive</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={users}
        onRowClick={(user) => navigate(`/admin/users/${user.id}`)}
        isLoading={isLoading}
        emptyMessage="No users found."
      />
    </div>
  );
};

export default UserListPage;
