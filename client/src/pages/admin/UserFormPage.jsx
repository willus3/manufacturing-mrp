// Admin User Form — handles Create (/admin/users/new) and Edit (/admin/users/:id).
// Fields: firstName, lastName, email, password (required on create, optional on edit), roles.
// Deactivation available on edit (cannot deactivate yourself).

import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

// ---- Zod schemas ----
// Create requires password + at least one role; edit makes them optional
const createSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  email: z.string().email('Valid email is required'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  roleIds: z.array(z.string()).min(1, 'At least one role is required'),
});

const editSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  email: z.string().email('Valid email is required'),
  password: z.string().max(128).optional().or(z.literal('')),
  roleIds: z.array(z.string()).min(1, 'At least one role is required'),
});

// ---- Reusable form field ----
const FormField = ({ label, error, children }) => (
  <div className="space-y-1.5">
    <Label className={error ? 'text-destructive' : ''}>{label}</Label>
    {children}
    {error && <p className="text-sm text-destructive">{error}</p>}
  </div>
);

const UserFormPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const isEdit = Boolean(id);

  // Fetch existing user data when editing
  const { data: existingUser, isLoading: isLoadingUser } = useQuery({
    queryKey: ['admin-users', id],
    queryFn: () => api.get(`/admin/users/${id}`),
    enabled: isEdit,
  });

  // Fetch all roles for the role selector
  const { data: rolesData } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: () => api.get('/admin/roles'),
  });

  const roles = rolesData?.data ?? [];

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(isEdit ? editSchema : createSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      roleIds: [],
    },
  });

  // Populate form when editing
  useEffect(() => {
    if (existingUser?.data) {
      const u = existingUser.data;
      reset({
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        password: '',
        roleIds: u.roles.map((r) => r.id),
      });
    }
  }, [existingUser, reset]);

  // ---- Save mutation ----
  const saveMutation = useMutation({
    mutationFn: (formData) => {
      // Clean up: remove empty password on edit
      const payload = { ...formData };
      if (isEdit && (!payload.password || payload.password === '')) {
        delete payload.password;
      }
      if (isEdit) return api.put(`/admin/users/${id}`, payload);
      return api.post('/admin/users', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success(isEdit ? 'User updated' : 'User created');
      navigate('/admin/users');
    },
    onError: (err) => {
      if (err.status === 409) {
        toast.error('A user with that email already exists');
      } else {
        toast.error(err.message || 'Something went wrong');
      }
    },
  });

  // ---- Deactivate mutation ----
  const deactivateMutation = useMutation({
    mutationFn: () => api.patch(`/admin/users/${id}/deactivate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('User deactivated');
      navigate('/admin/users');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to deactivate');
    },
  });

  const onSubmit = (data) => saveMutation.mutate(data);

  // Is this the current user's own record?
  const isSelf = isEdit && id === currentUser?.id;

  // ---- Loading state ----
  if (isEdit && isLoadingUser) {
    return (
      <div className="space-y-6">
        <PageHeader title="Edit User" />
        <p className="text-muted-foreground">Loading user...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title={isEdit ? 'Edit User' : 'New User'} />

      <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-6">
        {/* Name fields */}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="First Name" error={errors.firstName?.message}>
            <Input {...register('firstName')} placeholder="e.g., Jane" />
          </FormField>
          <FormField label="Last Name" error={errors.lastName?.message}>
            <Input {...register('lastName')} placeholder="e.g., Smith" />
          </FormField>
        </div>

        {/* Email */}
        <FormField label="Email" error={errors.email?.message}>
          <Input {...register('email')} type="email" placeholder="user@company.com" />
        </FormField>

        {/* Password */}
        <FormField
          label={isEdit ? 'New Password (leave blank to keep current)' : 'Password'}
          error={errors.password?.message}
        >
          <Input
            {...register('password')}
            type="password"
            placeholder={isEdit ? 'Leave blank to keep unchanged' : 'Minimum 8 characters'}
          />
        </FormField>

        {/* Role selector — checkbox list */}
        <Controller
          name="roleIds"
          control={control}
          render={({ field }) => (
            <FormField label="Roles" error={errors.roleIds?.message}>
              <div className="rounded-md border border-border p-4 space-y-2 max-h-60 overflow-y-auto">
                {roles.length === 0 && (
                  <p className="text-sm text-muted-foreground">Loading roles...</p>
                )}
                {roles.map((role) => (
                  <label
                    key={role.id}
                    className="flex items-center gap-3 cursor-pointer rounded px-2 py-1.5 hover:bg-muted/50"
                  >
                    <input
                      type="checkbox"
                      checked={field.value.includes(role.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          field.onChange([...field.value, role.id]);
                        } else {
                          field.onChange(field.value.filter((rid) => rid !== role.id));
                        }
                      }}
                      className="size-4 rounded border-border"
                    />
                    <span className="text-sm font-medium">{role.name}</span>
                    {role.isDefault && (
                      <Badge variant="outline" className="text-xs">Default</Badge>
                    )}
                  </label>
                ))}
              </div>
            </FormField>
          )}
        />

        {/* Action buttons */}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isSubmitting || saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving...' : isEdit ? 'Update User' : 'Create User'}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate('/admin/users')}>
            Cancel
          </Button>
          {isEdit && !isSelf && existingUser?.data?.isActive && (
            <Button
              type="button"
              variant="destructive"
              onClick={() => deactivateMutation.mutate()}
              disabled={deactivateMutation.isPending}
              className="ml-auto"
            >
              {deactivateMutation.isPending ? 'Deactivating...' : 'Deactivate'}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
};

export default UserFormPage;
