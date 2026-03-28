// PO Form page — handles Create (/purchase-orders/new) and Edit/Detail (/purchase-orders/:id).
//
// Features:
// - Header fields: supplier selector, dates, notes
// - Inline PO line editor: add/remove item rows with qty and unit cost
// - Status actions: send, cancel (draft), receive button (sent/partial)
// - Only draft POs are editable

import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

// ============================================
// Validation
// ============================================
const poFormSchema = z.object({
  supplierId: z.string().min(1, 'Select a supplier'),
  orderDate: z.string().optional(),
  expectedDate: z.string().optional(),
  notes: z.string().max(2000).optional(),
});

const FormField = ({ label, error, children }) => (
  <div className="space-y-1.5">
    <Label className={error ? 'text-destructive' : ''}>{label}</Label>
    {children}
    {error && <p className="text-sm text-destructive">{error}</p>}
  </div>
);

const STATUS_VARIANTS = {
  draft: 'secondary',
  sent: 'default',
  partial: 'outline',
  received: 'default',
  cancelled: 'destructive',
};

// ============================================
// PO Line Editor component
// ============================================
const POLineEditor = ({ lines, onChange, disabled, items }) => {
  const addLine = () => {
    onChange([...lines, { itemId: '', quantityOrdered: 1, unitCost: '' }]);
  };

  const removeLine = (idx) => {
    onChange(lines.filter((_, i) => i !== idx));
  };

  const updateLine = (idx, field, value) => {
    const updated = lines.map((line, i) => (i === idx ? { ...line, [field]: value } : line));
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Order Lines</Label>
        {!disabled && (
          <Button type="button" variant="outline" size="sm" onClick={addLine}>
            <Plus className="mr-1 h-4 w-4" /> Add Line
          </Button>
        )}
      </div>

      {lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">No lines yet. Add at least one item.</p>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-2 text-left font-medium">Item</th>
                <th className="px-3 py-2 text-left font-medium w-28">Qty Ordered</th>
                <th className="px-3 py-2 text-left font-medium w-28">Unit Cost</th>
                {!disabled && <th className="px-3 py-2 w-12" />}
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => (
                <tr key={idx} className="border-b last:border-0">
                  <td className="px-3 py-2">
                    <select
                      value={line.itemId}
                      onChange={(e) => updateLine(idx, 'itemId', e.target.value)}
                      disabled={disabled}
                      className="w-full rounded border border-input bg-transparent px-2 py-1 text-sm"
                    >
                      <option value="">Select item...</option>
                      {items.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.partNumber} — {item.description}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min="0.001"
                      step="any"
                      value={line.quantityOrdered}
                      onChange={(e) => updateLine(idx, 'quantityOrdered', e.target.value)}
                      disabled={disabled}
                      className="h-8"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.unitCost}
                      onChange={(e) => updateLine(idx, 'unitCost', e.target.value)}
                      disabled={disabled}
                      placeholder="0.00"
                      className="h-8"
                    />
                  </td>
                  {!disabled && (
                    <td className="px-3 py-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeLine(idx)}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ============================================
// Receipt history (shown on sent/partial/received POs)
// ============================================
const ReceiptHistory = ({ lines }) => {
  // Flatten all receipts across all lines
  const allReceipts = lines.flatMap((line) =>
    (line.receipts || []).map((r) => ({ ...r, partNumber: line.item?.partNumber }))
  );

  if (allReceipts.length === 0) return null;

  return (
    <div className="space-y-3">
      <Label>Receipt History</Label>
      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-3 py-2 text-left font-medium">Date</th>
              <th className="px-3 py-2 text-left font-medium">Item</th>
              <th className="px-3 py-2 text-left font-medium">Qty</th>
              <th className="px-3 py-2 text-left font-medium">Location</th>
              <th className="px-3 py-2 text-left font-medium">Received By</th>
            </tr>
          </thead>
          <tbody>
            {allReceipts.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="px-3 py-2">{new Date(r.receivedAt).toLocaleString()}</td>
                <td className="px-3 py-2">{r.partNumber}</td>
                <td className="px-3 py-2">{Number(r.quantityReceived)}</td>
                <td className="px-3 py-2">{r.location?.code} — {r.location?.name}</td>
                <td className="px-3 py-2">
                  {r.user ? `${r.user.firstName} ${r.user.lastName}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ============================================
// Main PO Form Page
// ============================================
const POFormPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const isEdit = Boolean(id);

  // PO lines state (managed separately from react-hook-form)
  const [lines, setLines] = useState([]);
  const [linesError, setLinesError] = useState('');

  // Load existing PO in edit mode
  const { data: existingPO, isLoading: isLoadingPO } = useQuery({
    queryKey: ['purchase-orders', id],
    queryFn: () => api.get(`/purchase-orders/${id}`),
    enabled: isEdit,
  });

  // Load suppliers for dropdown
  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers', 'all'],
    queryFn: () => api.get('/suppliers?pageSize=100&sort=name&order=asc'),
  });
  const suppliers = suppliersData?.data ?? [];

  // Load items for line editor
  const { data: itemsData } = useQuery({
    queryKey: ['items', 'all'],
    queryFn: () => api.get('/items?pageSize=100&sort=partNumber&order=asc&isActive=true'),
  });
  const allItems = itemsData?.data ?? [];

  const isDraft = !isEdit || existingPO?.data?.status === 'draft';
  const status = existingPO?.data?.status;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(poFormSchema),
    defaultValues: { supplierId: '', orderDate: '', expectedDate: '', notes: '' },
  });

  // Pre-fill form when editing
  useEffect(() => {
    if (existingPO?.data) {
      const po = existingPO.data;
      reset({
        supplierId: po.supplierId,
        orderDate: po.orderDate ? po.orderDate.split('T')[0] : '',
        expectedDate: po.expectedDate ? po.expectedDate.split('T')[0] : '',
        notes: po.notes ?? '',
      });
      setLines(
        po.lines.map((line) => ({
          itemId: line.itemId,
          quantityOrdered: Number(line.quantityOrdered),
          unitCost: line.unitCost ? Number(line.unitCost) : '',
        }))
      );
    }
  }, [existingPO, reset]);

  // Create / Update mutation
  const mutation = useMutation({
    mutationFn: (headerData) => {
      const payload = {
        ...headerData,
        orderDate: headerData.orderDate || null,
        expectedDate: headerData.expectedDate || null,
        notes: headerData.notes || null,
        lines: lines.map((line) => ({
          itemId: line.itemId,
          quantityOrdered: Number(line.quantityOrdered),
          unitCost: line.unitCost ? Number(line.unitCost) : null,
        })),
      };

      if (isEdit) return api.put(`/purchase-orders/${id}`, payload);
      return api.post('/purchase-orders', payload);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast.success(isEdit ? 'PO updated' : 'PO created');
      // Navigate to detail for new POs so user can send
      if (!isEdit) navigate(`/purchase-orders/${data.data.id}`);
      else navigate('/purchase-orders');
    },
    onError: (err) => toast.error(err.message || 'Something went wrong'),
  });

  // Send mutation
  const sendMutation = useMutation({
    mutationFn: () => api.patch(`/purchase-orders/${id}/send`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast.success('PO sent to supplier');
      navigate('/purchase-orders');
    },
    onError: (err) => toast.error(err.message || 'Send failed'),
  });

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: () => api.patch(`/purchase-orders/${id}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast.success('PO cancelled');
      navigate('/purchase-orders');
    },
    onError: (err) => toast.error(err.message || 'Cancel failed'),
  });

  const onSubmit = useCallback((headerData) => {
    if (lines.length === 0) {
      setLinesError('At least one order line is required');
      return;
    }
    const hasEmptyItem = lines.some((l) => !l.itemId);
    if (hasEmptyItem) {
      setLinesError('All lines must have an item selected');
      return;
    }
    setLinesError('');
    mutation.mutate(headerData);
  }, [lines, mutation]);

  if (isEdit && isLoadingPO) {
    return (
      <div className="space-y-6">
        <PageHeader title="Purchase Order" />
        <p className="text-muted-foreground">Loading PO...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <PageHeader
          title={isEdit ? `PO ${existingPO?.data?.poNumber ?? ''}` : 'New Purchase Order'}
        />
        {status && (
          <Badge variant={STATUS_VARIANTS[status]} className="mt-1">
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Header fields */}
        <div className="max-w-2xl grid gap-4 sm:grid-cols-2">
          <FormField label="Supplier" error={errors.supplierId?.message}>
            <select
              {...register('supplierId')}
              disabled={!isDraft}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
            >
              <option value="">Select supplier...</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code ? `${s.code} — ` : ''}{s.name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Expected Date" error={errors.expectedDate?.message}>
            <Input
              type="date"
              {...register('expectedDate')}
              disabled={!isDraft}
            />
          </FormField>
        </div>

        <div className="max-w-2xl">
          <FormField label="Notes" error={errors.notes?.message}>
            <Input
              {...register('notes')}
              placeholder="Optional notes"
              disabled={!isDraft}
            />
          </FormField>
        </div>

        {/* PO Lines */}
        {isDraft ? (
          <POLineEditor
            lines={lines}
            onChange={setLines}
            disabled={!isDraft}
            items={allItems}
          />
        ) : (
          // Read-only line display for non-draft POs
          <div className="space-y-3">
            <Label>Order Lines</Label>
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2 text-left font-medium">Item</th>
                    <th className="px-3 py-2 text-left font-medium w-28">Ordered</th>
                    <th className="px-3 py-2 text-left font-medium w-28">Received</th>
                    <th className="px-3 py-2 text-left font-medium w-28">Unit Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {existingPO?.data?.lines?.map((line) => (
                    <tr key={line.id} className="border-b last:border-0">
                      <td className="px-3 py-2">
                        {line.item?.partNumber} — {line.item?.description}
                      </td>
                      <td className="px-3 py-2">{Number(line.quantityOrdered)}</td>
                      <td className="px-3 py-2">
                        <span className={Number(line.quantityReceived) >= Number(line.quantityOrdered) ? 'text-green-600' : ''}>
                          {Number(line.quantityReceived)}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {line.unitCost ? `$${Number(line.unitCost).toFixed(2)}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {linesError && <p className="text-sm text-destructive">{linesError}</p>}

        {/* Receipt history for non-draft POs */}
        {isEdit && !isDraft && existingPO?.data?.lines && (
          <ReceiptHistory lines={existingPO.data.lines} />
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {isDraft && (
            <Button type="submit" disabled={isSubmitting || mutation.isPending}>
              {mutation.isPending ? 'Saving...' : isEdit ? 'Update PO' : 'Create PO'}
            </Button>
          )}

          <Button type="button" variant="outline" onClick={() => navigate('/purchase-orders')}>
            {isDraft ? 'Cancel' : 'Back to List'}
          </Button>

          {/* Status actions */}
          {isEdit && hasPermission('po:write') && (
            <>
              {status === 'draft' && (
                <Button
                  type="button"
                  variant="default"
                  onClick={() => sendMutation.mutate()}
                  disabled={sendMutation.isPending}
                  className="ml-auto"
                >
                  {sendMutation.isPending ? 'Sending...' : 'Send to Supplier'}
                </Button>
              )}

              {['sent', 'partial'].includes(status) && (
                <Button
                  type="button"
                  variant="default"
                  onClick={() => navigate(`/purchase-orders/${id}/receive`)}
                  className="ml-auto"
                >
                  Receive Items
                </Button>
              )}

              {['draft', 'sent'].includes(status) && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => cancelMutation.mutate()}
                  disabled={cancelMutation.isPending}
                >
                  {cancelMutation.isPending ? 'Cancelling...' : 'Cancel PO'}
                </Button>
              )}
            </>
          )}
        </div>
      </form>
    </div>
  );
};

export default POFormPage;
