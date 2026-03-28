// Demand Form page — Create (/mrp/demand/new) and Edit (/mrp/demand/:id).
// Item selector only shows finished goods and sub-assemblies per spec.

import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

const STATUS_VARIANTS = {
  open: 'default',
  planned: 'secondary',
  fulfilled: 'default',
  cancelled: 'destructive',
};

const demandFormSchema = z.object({
  itemId: z.string().min(1, 'Select an item'),
  quantityRequired: z.coerce.number().positive('Quantity must be greater than 0'),
  dateRequired: z.string().min(1, 'Date is required'),
  notes: z.string().max(2000).optional(),
});

const FormField = ({ label, error, children }) => (
  <div className="space-y-1.5">
    <Label className={error ? 'text-destructive' : ''}>{label}</Label>
    {children}
    {error && <p className="text-sm text-destructive">{error}</p>}
  </div>
);

const DemandFormPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();
  const isEdit = Boolean(id);

  // Load existing demand in edit mode
  const { data: existingResp, isLoading: isLoadingExisting } = useQuery({
    queryKey: ['mrp-demand', id],
    queryFn: () => api.get(`/mrp/demand/${id}`),
    enabled: isEdit,
  });
  const existingData = existingResp?.data ?? null;

  // Load items (only finished goods and sub-assemblies)
  const { data: itemsData } = useQuery({
    queryKey: ['items', 'producible'],
    queryFn: () => api.get('/items?pageSize=100&sort=partNumber&order=asc&isActive=true'),
  });
  const producibleItems = (itemsData?.data ?? []).filter(
    (i) => ['finished_good', 'sub_assembly'].includes(i.type)
  );

  const isOpen = !isEdit || existingData?.status === 'open';
  const status = existingData?.status;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(demandFormSchema),
    defaultValues: { itemId: '', quantityRequired: '', dateRequired: '', notes: '' },
  });

  // Pre-fill form when editing
  useEffect(() => {
    if (existingData) {
      reset({
        itemId: existingData.itemId,
        quantityRequired: Number(existingData.quantityRequired),
        dateRequired: existingData.dateRequired ? existingData.dateRequired.split('T')[0] : '',
        notes: existingData.notes ?? '',
      });
    }
  }, [existingData, reset]);

  const mutation = useMutation({
    mutationFn: (formData) => {
      const payload = {
        ...formData,
        dateRequired: formData.dateRequired,
        notes: formData.notes || null,
      };
      if (isEdit) return api.put(`/mrp/demand/${id}`, payload);
      return api.post('/mrp/demand', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mrp-demand'] });
      toast.success(isEdit ? 'Demand updated' : 'Demand created');
      navigate('/mrp/demand');
    },
    onError: (err) => toast.error(err.message || 'Something went wrong'),
  });

  const onSubmit = (formData) => mutation.mutate(formData);

  if (isEdit && isLoadingExisting) {
    return (
      <div className="space-y-6">
        <PageHeader title="Demand Entry" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (isEdit && !existingData) {
    return (
      <div className="space-y-6">
        <PageHeader title="Demand Entry" />
        <p className="text-muted-foreground">Demand entry not found.</p>
        <Button variant="outline" onClick={() => navigate('/mrp/demand')}>Back to List</Button>
      </div>
    );
  }

  if (isEdit && !isOpen) {
    // Read-only view for non-open entries
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <PageHeader title="Demand Entry" />
          <Badge variant={STATUS_VARIANTS[status]} className="mt-1">
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
        </div>

        <div className="max-w-2xl grid gap-4 sm:grid-cols-2 text-sm">
          <div>
            <Label className="text-muted-foreground">Item</Label>
            <p>{existingData.item?.partNumber} — {existingData.item?.description}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Quantity Required</Label>
            <p>{Number(existingData.quantityRequired)}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Date Required</Label>
            <p>{new Date(existingData.dateRequired).toLocaleDateString()}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Source</Label>
            <p>{existingData.source === 'manual' ? 'Manual' : existingData.source}</p>
          </div>
          {existingData.notes && (
            <div className="sm:col-span-2">
              <Label className="text-muted-foreground">Notes</Label>
              <p>{existingData.notes}</p>
            </div>
          )}
        </div>

        <Button variant="outline" onClick={() => navigate('/mrp/demand')}>Back to List</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <PageHeader title={isEdit ? 'Edit Demand' : 'New Demand Entry'} />
        {status && (
          <Badge variant={STATUS_VARIANTS[status]} className="mt-1">
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="max-w-2xl grid gap-4 sm:grid-cols-2">
          <FormField label="Item (Finished Good / Sub-Assembly)" error={errors.itemId?.message}>
            <select
              {...register('itemId')}
              disabled={isEdit}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
            >
              <option value="">Select an item...</option>
              {producibleItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.partNumber} — {item.description}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Quantity Required" error={errors.quantityRequired?.message}>
            <Input
              type="number"
              min="0.001"
              step="any"
              {...register('quantityRequired')}
            />
          </FormField>

          <FormField label="Date Required" error={errors.dateRequired?.message}>
            <Input type="date" {...register('dateRequired')} />
          </FormField>
        </div>

        <div className="max-w-2xl">
          <FormField label="Notes" error={errors.notes?.message}>
            <Input
              {...register('notes')}
              placeholder="Customer name, order reference, etc."
            />
          </FormField>
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isSubmitting || mutation.isPending}>
            {mutation.isPending ? 'Saving...' : isEdit ? 'Update Demand' : 'Create Demand'}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate('/mrp/demand')}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
};

export default DemandFormPage;
