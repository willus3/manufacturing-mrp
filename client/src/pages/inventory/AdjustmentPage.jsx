// Inventory Adjustment page — /inventory/adjust
// Form to add or remove stock for an item at a location.

import { useNavigate } from 'react-router-dom';
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

const adjustSchema = z.object({
  itemId: z.string().min(1, 'Select an item'),
  locationId: z.string().min(1, 'Select a location'),
  quantity: z.coerce.number().refine((n) => n !== 0, 'Quantity cannot be zero'),
  lotNumber: z.string().optional(),
  serialNumber: z.string().optional(),
  notes: z.string().optional(),
});

const FormField = ({ label, error, children }) => (
  <div className="space-y-1.5">
    <Label className={error ? 'text-destructive' : ''}>{label}</Label>
    {children}
    {error && <p className="text-sm text-destructive">{error}</p>}
  </div>
);

const AdjustmentPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Load items and locations for dropdowns
  const { data: itemsData } = useQuery({
    queryKey: ['items', 'all'],
    queryFn: () => api.get('/items?pageSize=100&sort=partNumber&order=asc&isActive=true'),
  });
  const { data: locsData } = useQuery({
    queryKey: ['locations', 'active'],
    queryFn: () => api.get('/locations?isActive=true'),
  });

  const items = itemsData?.data ?? [];
  const locations = locsData?.data ?? [];

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(adjustSchema),
    defaultValues: { itemId: '', locationId: '', quantity: '', lotNumber: '', serialNumber: '', notes: '' },
  });

  const mutation = useMutation({
    mutationFn: (data) => {
      const cleaned = {
        ...data,
        lotNumber: data.lotNumber || null,
        serialNumber: data.serialNumber || null,
        notes: data.notes || null,
      };
      return api.post('/inventory/adjust', cleaned);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-transactions'] });
      toast.success('Adjustment recorded');
      navigate('/inventory');
    },
    onError: (err) => toast.error(err.message || 'Adjustment failed'),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Inventory Adjustment" />

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="max-w-2xl space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Item" error={errors.itemId?.message}>
            <select
              {...register('itemId')}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Select item...</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.partNumber} — {item.description}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Location" error={errors.locationId?.message}>
            <select
              {...register('locationId')}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Select location...</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.code} — {loc.name}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <FormField label="Quantity (positive to add, negative to remove)" error={errors.quantity?.message}>
          <Input type="number" step="any" {...register('quantity')} placeholder="e.g., 50 or -10" />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Lot Number (optional)" error={errors.lotNumber?.message}>
            <Input {...register('lotNumber')} placeholder="For lot-tracked items" />
          </FormField>
          <FormField label="Serial Number (optional)" error={errors.serialNumber?.message}>
            <Input {...register('serialNumber')} placeholder="For serial-tracked items" />
          </FormField>
        </div>

        <FormField label="Notes" error={errors.notes?.message}>
          <Input {...register('notes')} placeholder="Reason for adjustment" />
        </FormField>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Recording...' : 'Record Adjustment'}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate('/inventory')}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
};

export default AdjustmentPage;
