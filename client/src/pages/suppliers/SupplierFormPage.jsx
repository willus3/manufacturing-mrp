// Supplier form page — handles both Create (/suppliers/new) and Edit (/suppliers/:id).
// Uses React Hook Form + Zod for client-side validation.

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

const supplierFormSchema = z.object({
  name: z.string().min(1, 'Supplier name is required').max(200),
  code: z.string().max(50).optional(),
  contactName: z.string().max(200).optional(),
  contactEmail: z.string().email('Invalid email').max(200).optional().or(z.literal('')),
  contactPhone: z.string().max(50).optional(),
  address: z.string().max(1000).optional(),
  notes: z.string().max(2000).optional(),
});

const FormField = ({ label, error, children }) => (
  <div className="space-y-1.5">
    <Label className={error ? 'text-destructive' : ''}>{label}</Label>
    {children}
    {error && <p className="text-sm text-destructive">{error}</p>}
  </div>
);

const SupplierFormPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const isEdit = Boolean(id);

  const { data: existingSupplier, isLoading: isLoadingSupplier } = useQuery({
    queryKey: ['suppliers', id],
    queryFn: () => api.get(`/suppliers/${id}`),
    enabled: isEdit,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(supplierFormSchema),
    defaultValues: {
      name: '',
      code: '',
      contactName: '',
      contactEmail: '',
      contactPhone: '',
      address: '',
      notes: '',
    },
  });

  useEffect(() => {
    if (existingSupplier?.data) {
      const s = existingSupplier.data;
      reset({
        name: s.name,
        code: s.code ?? '',
        contactName: s.contactName ?? '',
        contactEmail: s.contactEmail ?? '',
        contactPhone: s.contactPhone ?? '',
        address: s.address ?? '',
        notes: s.notes ?? '',
      });
    }
  }, [existingSupplier, reset]);

  const mutation = useMutation({
    mutationFn: (data) => {
      // Convert empty strings to null for optional fields
      const cleaned = { ...data };
      for (const key of ['code', 'contactName', 'contactEmail', 'contactPhone', 'address', 'notes']) {
        if (cleaned[key] === '') cleaned[key] = null;
      }
      if (isEdit) return api.put(`/suppliers/${id}`, cleaned);
      return api.post('/suppliers', cleaned);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success(isEdit ? 'Supplier updated' : 'Supplier created');
      navigate('/suppliers');
    },
    onError: (err) => {
      if (err.status === 409) {
        toast.error('A supplier with that code already exists');
      } else {
        toast.error(err.message || 'Something went wrong');
      }
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: () => api.patch(`/suppliers/${id}/deactivate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('Supplier deactivated');
      navigate('/suppliers');
    },
    onError: (err) => toast.error(err.message || 'Failed to deactivate'),
  });

  const onSubmit = (data) => mutation.mutate(data);

  if (isEdit && isLoadingSupplier) {
    return (
      <div className="space-y-6">
        <PageHeader title="Edit Supplier" />
        <p className="text-muted-foreground">Loading supplier...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title={isEdit ? 'Edit Supplier' : 'New Supplier'} />

      <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Supplier Name" error={errors.name?.message}>
            <Input {...register('name')} placeholder="e.g., Acme Steel" />
          </FormField>
          <FormField label="Code" error={errors.code?.message}>
            <Input {...register('code')} placeholder="e.g., ACME (optional)" />
          </FormField>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="Contact Name" error={errors.contactName?.message}>
            <Input {...register('contactName')} placeholder="Name" />
          </FormField>
          <FormField label="Contact Email" error={errors.contactEmail?.message}>
            <Input {...register('contactEmail')} type="email" placeholder="email@example.com" />
          </FormField>
          <FormField label="Contact Phone" error={errors.contactPhone?.message}>
            <Input {...register('contactPhone')} placeholder="555-1234" />
          </FormField>
        </div>

        <FormField label="Address" error={errors.address?.message}>
          <Input {...register('address')} placeholder="Street, City, State, ZIP" />
        </FormField>

        <FormField label="Notes" error={errors.notes?.message}>
          <Input {...register('notes')} placeholder="Internal notes about this supplier" />
        </FormField>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isSubmitting || mutation.isPending}>
            {mutation.isPending ? 'Saving...' : isEdit ? 'Update Supplier' : 'Create Supplier'}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate('/suppliers')}>
            Cancel
          </Button>
          {isEdit && hasPermission('supplier:write') && existingSupplier?.data?.isActive && (
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

export default SupplierFormPage;
