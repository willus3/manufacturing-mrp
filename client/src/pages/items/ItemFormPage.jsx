// Item form page — handles both Create (/items/new) and Edit (/items/:id).
//
// In edit mode, loads the existing item and pre-fills the form.
// Uses React Hook Form + Zod for client-side validation matching the server schemas.
// On success, shows a toast and navigates back to the item list.

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
import { Badge } from '@/components/ui/badge';

// ============================================
// Validation schema (mirrors server-side Zod)
// ============================================
const ITEM_TYPES = ['raw_material', 'purchased_component', 'sub_assembly', 'finished_good', 'consumable'];
const TRACKING_METHODS = ['none', 'lot', 'serial'];

const TYPE_LABELS = {
  raw_material: 'Raw Material',
  purchased_component: 'Purchased Component',
  sub_assembly: 'Sub-Assembly',
  finished_good: 'Finished Good',
  consumable: 'Consumable',
};

const TRACKING_LABELS = {
  none: 'None',
  lot: 'Lot Tracking',
  serial: 'Serial Tracking',
};

const itemFormSchema = z.object({
  partNumber: z.string().min(1, 'Part number is required').max(100),
  description: z.string().min(1, 'Description is required').max(500),
  type: z.enum(ITEM_TYPES, { message: 'Select an item type' }),
  trackingMethod: z.enum(TRACKING_METHODS).optional().default('none'),
  unitOfMeasure: z.string().min(1, 'Unit of measure is required').max(20),
  reorderPoint: z.coerce.number().nonnegative().optional().nullable(),
  reorderQuantity: z.coerce.number().nonnegative().optional().nullable(),
  leadTimeDays: z.coerce.number().int().nonnegative().optional().nullable(),
});

// ============================================
// Form field component — keeps JSX clean
// ============================================
const FormField = ({ label, error, children }) => (
  <div className="space-y-1.5">
    <Label className={error ? 'text-destructive' : ''}>{label}</Label>
    {children}
    {error && <p className="text-sm text-destructive">{error}</p>}
  </div>
);

// ============================================
// Main component
// ============================================
const ItemFormPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const isEdit = Boolean(id);

  // Load existing item in edit mode
  const { data: existingItem, isLoading: isLoadingItem } = useQuery({
    queryKey: ['items', id],
    queryFn: () => api.get(`/items/${id}`),
    enabled: isEdit,
  });

  // React Hook Form setup
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(itemFormSchema),
    defaultValues: {
      partNumber: '',
      description: '',
      type: '',
      trackingMethod: 'none',
      unitOfMeasure: 'ea',
      reorderPoint: '',
      reorderQuantity: '',
      leadTimeDays: '',
    },
  });

  // Pre-fill form when editing an existing item
  useEffect(() => {
    if (existingItem?.data) {
      const item = existingItem.data;
      reset({
        partNumber: item.partNumber,
        description: item.description,
        type: item.type,
        trackingMethod: item.trackingMethod ?? 'none',
        unitOfMeasure: item.unitOfMeasure,
        reorderPoint: item.reorderPoint ?? '',
        reorderQuantity: item.reorderQuantity ?? '',
        leadTimeDays: item.leadTimeDays ?? '',
      });
    }
  }, [existingItem, reset]);

  // Create or update mutation
  const mutation = useMutation({
    mutationFn: (data) => {
      // Convert empty strings to null for optional number fields
      const cleaned = { ...data };
      if (cleaned.reorderPoint === '' || cleaned.reorderPoint === undefined) cleaned.reorderPoint = null;
      if (cleaned.reorderQuantity === '' || cleaned.reorderQuantity === undefined) cleaned.reorderQuantity = null;
      if (cleaned.leadTimeDays === '' || cleaned.leadTimeDays === undefined) cleaned.leadTimeDays = null;

      if (isEdit) {
        return api.put(`/items/${id}`, cleaned);
      }
      return api.post('/items', cleaned);
    },
    onSuccess: () => {
      // Invalidate the items list cache so it re-fetches
      queryClient.invalidateQueries({ queryKey: ['items'] });
      toast.success(isEdit ? 'Item updated successfully' : 'Item created successfully');
      navigate('/items');
    },
    onError: (err) => {
      // Show specific error for duplicate part numbers
      if (err.status === 409) {
        toast.error('A record with that part number already exists');
      } else {
        toast.error(err.message || 'Something went wrong');
      }
    },
  });

  // Deactivate mutation (edit mode only)
  const deactivateMutation = useMutation({
    mutationFn: () => api.patch(`/items/${id}/deactivate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      toast.success('Item deactivated');
      navigate('/items');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to deactivate item');
    },
  });

  const onSubmit = (data) => mutation.mutate(data);

  // Show loading state while fetching existing item
  if (isEdit && isLoadingItem) {
    return (
      <div className="space-y-6">
        <PageHeader title="Edit Item" />
        <p className="text-muted-foreground">Loading item...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title={isEdit ? 'Edit Item' : 'New Item'} />

      <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-6">
        {/* Core fields */}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Part Number" error={errors.partNumber?.message}>
            <Input {...register('partNumber')} placeholder="e.g., RM-001" />
          </FormField>

          <FormField label="Unit of Measure" error={errors.unitOfMeasure?.message}>
            <Input {...register('unitOfMeasure')} placeholder="e.g., ea, kg, ft" />
          </FormField>
        </div>

        <FormField label="Description" error={errors.description?.message}>
          <Input {...register('description')} placeholder="Describe the item" />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Type" error={errors.type?.message}>
            <select
              {...register('type')}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Select type...</option>
              {ITEM_TYPES.map((type) => (
                <option key={type} value={type}>
                  {TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Tracking Method" error={errors.trackingMethod?.message}>
            <select
              {...register('trackingMethod')}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {TRACKING_METHODS.map((method) => (
                <option key={method} value={method}>
                  {TRACKING_LABELS[method]}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        {/* Inventory planning fields */}
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="Reorder Point" error={errors.reorderPoint?.message}>
            <Input
              type="number"
              min="0"
              step="any"
              {...register('reorderPoint')}
              placeholder="Min stock level"
            />
          </FormField>

          <FormField label="Reorder Quantity" error={errors.reorderQuantity?.message}>
            <Input
              type="number"
              min="0"
              step="any"
              {...register('reorderQuantity')}
              placeholder="Order qty"
            />
          </FormField>

          <FormField label="Lead Time (days)" error={errors.leadTimeDays?.message}>
            <Input
              type="number"
              min="0"
              step="1"
              {...register('leadTimeDays')}
              placeholder="Days"
            />
          </FormField>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isSubmitting || mutation.isPending}>
            {mutation.isPending ? 'Saving...' : isEdit ? 'Update Item' : 'Create Item'}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate('/items')}>
            Cancel
          </Button>
          {isEdit && hasPermission('item:write') && existingItem?.data?.isActive && (
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

      {/* Related data sections — only shown when viewing an existing item */}
      {isEdit && existingItem?.data && (
        <div className="space-y-8 border-t pt-8">
          {/* Suppliers */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Suppliers ({existingItem.data.itemSuppliers?.length ?? 0})</h2>
            {existingItem.data.itemSuppliers?.length > 0 ? (
              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2 text-left font-medium">Supplier</th>
                      <th className="px-3 py-2 text-left font-medium">Code</th>
                      <th className="px-3 py-2 text-left font-medium">Supplier Part #</th>
                      <th className="px-3 py-2 text-left font-medium">Unit Cost</th>
                      <th className="px-3 py-2 text-left font-medium">Lead Time</th>
                      <th className="px-3 py-2 text-left font-medium">Preferred</th>
                    </tr>
                  </thead>
                  <tbody>
                    {existingItem.data.itemSuppliers.map((is) => (
                      <tr
                        key={is.id}
                        className="border-b last:border-0 cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/suppliers/${is.supplier?.id}`)}
                      >
                        <td className="px-3 py-2">{is.supplier?.name}</td>
                        <td className="px-3 py-2">{is.supplier?.code || '—'}</td>
                        <td className="px-3 py-2">{is.supplierPartNumber || '—'}</td>
                        <td className="px-3 py-2">{is.unitCost ? `$${Number(is.unitCost).toFixed(2)}` : '—'}</td>
                        <td className="px-3 py-2">{is.leadTimeDays ? `${is.leadTimeDays} days` : '—'}</td>
                        <td className="px-3 py-2">{is.isPreferred ? 'Yes' : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No suppliers linked to this item.</p>
            )}
          </div>

          {/* Inventory Stock */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Inventory Stock</h2>
            {existingItem.data.inventoryStocks?.length > 0 ? (
              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2 text-left font-medium">Location</th>
                      <th className="px-3 py-2 text-left font-medium">Qty On Hand</th>
                      <th className="px-3 py-2 text-left font-medium">Lot</th>
                      <th className="px-3 py-2 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {existingItem.data.inventoryStocks.map((stock) => (
                      <tr key={stock.id} className="border-b last:border-0">
                        <td className="px-3 py-2">{stock.location?.code} — {stock.location?.name}</td>
                        <td className="px-3 py-2">{Number(stock.quantityOnHand)}</td>
                        <td className="px-3 py-2">{stock.lotNumber || '—'}</td>
                        <td className="px-3 py-2">
                          <Badge variant="outline">{stock.inventoryStatus?.replace('_', ' ')}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No inventory stock for this item.</p>
            )}
          </div>

          {/* BOMs */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Bills of Materials</h2>
            {existingItem.data.bomHeaders?.length > 0 ? (
              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2 text-left font-medium">Revision</th>
                      <th className="px-3 py-2 text-left font-medium">Status</th>
                      <th className="px-3 py-2 text-left font-medium">Lines</th>
                      <th className="px-3 py-2 text-left font-medium">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {existingItem.data.bomHeaders.map((bom) => (
                      <tr
                        key={bom.id}
                        className="border-b last:border-0 cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/boms/${bom.id}`)}
                      >
                        <td className="px-3 py-2 font-medium">{bom.revision}</td>
                        <td className="px-3 py-2">
                          <Badge variant={bom.status === 'active' ? 'default' : bom.status === 'draft' ? 'secondary' : 'outline'}>
                            {bom.status.charAt(0).toUpperCase() + bom.status.slice(1)}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">{bom._count?.bomLines ?? 0}</td>
                        <td className="px-3 py-2">{new Date(bom.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No BOMs for this item.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ItemFormPage;
