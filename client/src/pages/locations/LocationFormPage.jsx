// Location form page — handles Create and Edit for inventory locations.
// Locations are simple: name, code, description.

import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const locationFormSchema = z.object({
  name: z.string().min(1, 'Location name is required').max(200),
  code: z.string().min(1, 'Location code is required').max(50),
  description: z.string().max(1000).optional(),
});

const FormField = ({ label, error, children }) => (
  <div className="space-y-1.5">
    <Label className={error ? 'text-destructive' : ''}>{label}</Label>
    {children}
    {error && <p className="text-sm text-destructive">{error}</p>}
  </div>
);

const LocationFormPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const isEdit = Boolean(id);

  const { data: existingLocation, isLoading: isLoadingLocation } = useQuery({
    queryKey: ['locations', id],
    queryFn: () => api.get(`/locations/${id}`),
    enabled: isEdit,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(locationFormSchema),
    defaultValues: { name: '', code: '', description: '' },
  });

  useEffect(() => {
    if (existingLocation?.data) {
      const loc = existingLocation.data;
      reset({
        name: loc.name,
        code: loc.code,
        description: loc.description ?? '',
      });
    }
  }, [existingLocation, reset]);

  const mutation = useMutation({
    mutationFn: (data) => {
      const cleaned = { ...data };
      if (cleaned.description === '') cleaned.description = null;
      if (isEdit) return api.put(`/locations/${id}`, cleaned);
      return api.post('/locations', cleaned);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      toast.success(isEdit ? 'Location updated' : 'Location created');
      navigate('/inventory/locations');
    },
    onError: (err) => {
      if (err.status === 409) {
        toast.error('A location with that code already exists');
      } else {
        toast.error(err.message || 'Something went wrong');
      }
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: () => api.patch(`/locations/${id}/deactivate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      toast.success('Location deactivated');
      navigate('/inventory/locations');
    },
    onError: (err) => {
      // REFERENCE_CONFLICT = location has stock
      if (err.data?.error?.code === 'REFERENCE_CONFLICT') {
        toast.error('Cannot deactivate — this location has existing inventory stock');
      } else {
        toast.error(err.message || 'Failed to deactivate');
      }
    },
  });

  const onSubmit = (data) => mutation.mutate(data);

  if (isEdit && isLoadingLocation) {
    return (
      <div className="space-y-6">
        <PageHeader title="Edit Location" />
        <p className="text-muted-foreground">Loading location...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title={isEdit ? 'Edit Location' : 'New Location'} />

      <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Location Name" error={errors.name?.message}>
            <Input {...register('name')} placeholder="e.g., Warehouse A" />
          </FormField>
          <FormField label="Code" error={errors.code?.message}>
            <Input {...register('code')} placeholder="e.g., WH-A" />
          </FormField>
        </div>

        <FormField label="Description" error={errors.description?.message}>
          <Input {...register('description')} placeholder="Optional description" />
        </FormField>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isSubmitting || mutation.isPending}>
            {mutation.isPending ? 'Saving...' : isEdit ? 'Update Location' : 'Create Location'}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate('/inventory/locations')}>
            Cancel
          </Button>
          {isEdit && hasPermission('inventory:write') && existingLocation?.data?.isActive && (
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

export default LocationFormPage;
