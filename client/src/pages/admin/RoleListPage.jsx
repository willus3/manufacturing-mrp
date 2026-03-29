// Admin Role List page — /admin/roles
// Shows all roles (default + custom) with permission counts.
// Create new custom roles and edit existing custom roles.
// Default roles cannot be edited (spec: "Default roles cannot be edited but can be cloned").

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Pencil, Eye, ChevronDown, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

// ============================================
// Permission checkbox grid — reusable for create/edit
// ============================================
const PermissionGrid = ({ allPermissions, selectedIds, onChange, disabled = false }) => {
  // Group permissions by module (prefix before the colon)
  const groups = {};
  for (const perm of allPermissions) {
    const module = perm.code.split(':')[0];
    if (!groups[module]) groups[module] = [];
    groups[module].push(perm);
  }

  const toggle = (id) => {
    if (disabled) return;
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((pid) => pid !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  return (
    <div className="rounded-md border border-border p-4 space-y-3 max-h-72 overflow-y-auto">
      {Object.entries(groups).map(([module, perms]) => (
        <div key={module}>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            {module}
          </p>
          <div className="space-y-1">
            {perms.map((perm) => (
              <label
                key={perm.id}
                className={`flex items-center gap-3 rounded px-2 py-1 text-sm ${
                  disabled ? 'opacity-60' : 'cursor-pointer hover:bg-muted/50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(perm.id)}
                  onChange={() => toggle(perm.id)}
                  disabled={disabled}
                  className="size-4 rounded border-border"
                />
                <span className="font-mono text-xs">{perm.code}</span>
                <span className="text-muted-foreground">— {perm.description}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

// ============================================
// Role card — shows one role with expand/collapse for permissions
// ============================================
const RoleCard = ({ role, allPermissions, onEdit }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            aria-label={expanded ? 'Collapse permissions' : 'Expand permissions'}
            aria-expanded={expanded}
          >
            {expanded
              ? <ChevronDown className="size-4" />
              : <ChevronRight className="size-4" />
            }
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground">{role.name}</span>
              {role.isDefault && (
                <Badge variant="outline" className="text-xs">Default</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {role.permissions.length} permissions · {role.userCount} user{role.userCount !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEdit(role)}
          aria-label={role.isDefault ? `View ${role.name} permissions` : `Edit ${role.name}`}
        >
          {role.isDefault
            ? <><Eye className="mr-1 size-4" /> View</>
            : <><Pencil className="mr-1 size-4" /> Edit</>
          }
        </Button>
      </div>

      {/* Expanded permission list */}
      {expanded && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {role.permissions.map((p) => (
            <Badge key={p.id} variant="secondary" className="text-xs font-mono">
              {p.code}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================
// Role form — inline create/edit form
// ============================================
const RoleForm = ({ role, allPermissions, onCancel, onSaved }) => {
  const queryClient = useQueryClient();
  const isEdit = Boolean(role);
  const isDefault = role?.isDefault ?? false;

  const [name, setName] = useState(role?.name ?? '');
  const [selectedPermissionIds, setSelectedPermissionIds] = useState(
    role?.permissions.map((p) => p.id) ?? []
  );

  const mutation = useMutation({
    mutationFn: (payload) => {
      if (isEdit) return api.put(`/admin/roles/${role.id}`, payload);
      return api.post('/admin/roles', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] });
      toast.success(isEdit ? 'Role updated' : 'Role created');
      onSaved();
    },
    onError: (err) => {
      if (err.status === 409) {
        toast.error('A role with that name already exists');
      } else if (err.status === 403) {
        toast.error('Default roles cannot be edited');
      } else {
        toast.error(err.message || 'Something went wrong');
      }
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Role name is required');
      return;
    }
    if (selectedPermissionIds.length === 0) {
      toast.error('Select at least one permission');
      return;
    }
    mutation.mutate({ name: name.trim(), permissionIds: selectedPermissionIds });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border-2 border-primary/30 bg-card p-6 space-y-4"
    >
      <h3 className="text-lg font-semibold text-foreground">
        {isDefault ? `Viewing: ${role.name}` : isEdit ? `Edit Role: ${role.name}` : 'Create Custom Role'}
      </h3>

      {!isDefault && (
        <div className="space-y-1.5 max-w-sm">
          <Label htmlFor="role-name">Role Name</Label>
          <Input
            id="role-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Quality Inspector"
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label>Permissions</Label>
        <PermissionGrid
          allPermissions={allPermissions}
          selectedIds={selectedPermissionIds}
          onChange={setSelectedPermissionIds}
          disabled={isDefault}
        />
      </div>

      <div className="flex items-center gap-3">
        {!isDefault && (
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving...' : isEdit ? 'Update Role' : 'Create Role'}
          </Button>
        )}
        <Button type="button" variant="outline" onClick={onCancel}>
          {isDefault ? 'Close' : 'Cancel'}
        </Button>
      </div>
    </form>
  );
};

// ============================================
// Main page component
// ============================================
const RoleListPage = () => {
  // null = list view, 'new' = creating, or a role object = editing/viewing
  const [formState, setFormState] = useState(null);

  const { data: rolesData, isLoading: isLoadingRoles } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: () => api.get('/admin/roles'),
  });

  const { data: permData } = useQuery({
    queryKey: ['admin-permissions'],
    queryFn: () => api.get('/admin/permissions'),
  });

  const roles = rolesData?.data ?? [];
  const allPermissions = permData?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Role Management</h1>
        {!formState && (
          <Button onClick={() => setFormState('new')}>
            <Plus className="mr-2 h-4 w-4" />
            New Role
          </Button>
        )}
      </div>

      {/* Inline form for create/edit/view */}
      {formState && (
        <RoleForm
          role={formState === 'new' ? null : formState}
          allPermissions={allPermissions}
          onCancel={() => setFormState(null)}
          onSaved={() => setFormState(null)}
        />
      )}

      {/* Role list */}
      {isLoadingRoles ? (
        <p className="text-muted-foreground">Loading roles...</p>
      ) : roles.length === 0 ? (
        <p className="text-muted-foreground">No roles found.</p>
      ) : (
        <div className="space-y-3">
          {roles.map((role) => (
            <RoleCard
              key={role.id}
              role={role}
              allPermissions={allPermissions}
              onEdit={(r) => setFormState(r)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default RoleListPage;
