// BOM Form page — handles Create (/boms/new) and Edit/Detail (/boms/:id).
//
// Features:
// - Header fields: item selector, revision, notes
// - Inline BOM line editor: add/remove component rows
// - Status actions: activate, obsolete, revise (edit mode only)
// - Only draft BOMs are editable

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
const bomFormSchema = z.object({
  itemId: z.string().min(1, 'Select an item'),
  revision: z.string().min(1, 'Revision is required').max(50),
  notes: z.string().max(2000).optional(),
});

const FormField = ({ label, htmlFor, error, children }) => (
  <div className="space-y-1.5">
    <Label htmlFor={htmlFor} className={error ? 'text-destructive' : ''}>{label}</Label>
    {children}
    {error && <p className="text-sm text-destructive">{error}</p>}
  </div>
);

const STATUS_VARIANTS = { draft: 'secondary', active: 'default', obsolete: 'outline' };

// ============================================
// BOM Line Editor component
// ============================================
const BOMLineEditor = ({ lines, onChange, disabled, items }) => {
  const addLine = () => {
    onChange([...lines, { itemId: '', quantity: 1, unitOfMeasure: 'ea', scrapFactor: 0, notes: '' }]);
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
        <Label>BOM Lines</Label>
        {!disabled && (
          <Button type="button" variant="outline" size="sm" onClick={addLine}>
            <Plus className="mr-1 h-4 w-4" /> Add Line
          </Button>
        )}
      </div>

      {lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">No lines yet. Add at least one component.</p>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-2 text-left font-medium">Component</th>
                <th className="px-3 py-2 text-left font-medium w-24">Qty</th>
                <th className="px-3 py-2 text-left font-medium w-20">UoM</th>
                <th className="px-3 py-2 text-left font-medium w-24">Scrap %</th>
                <th className="px-3 py-2 text-left font-medium">Notes</th>
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
                      value={line.quantity}
                      onChange={(e) => updateLine(idx, 'quantity', e.target.value)}
                      disabled={disabled}
                      className="h-8"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      value={line.unitOfMeasure}
                      onChange={(e) => updateLine(idx, 'unitOfMeasure', e.target.value)}
                      disabled={disabled}
                      className="h-8"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={line.scrapFactor ? (line.scrapFactor * 100) : 0}
                      onChange={(e) => updateLine(idx, 'scrapFactor', Number(e.target.value) / 100)}
                      disabled={disabled}
                      className="h-8"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      value={line.notes || ''}
                      onChange={(e) => updateLine(idx, 'notes', e.target.value)}
                      disabled={disabled}
                      placeholder="Optional"
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
// Main BOM Form Page
// ============================================
const BOMFormPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const isEdit = Boolean(id);

  // BOM lines state (managed separately from react-hook-form)
  const [lines, setLines] = useState([]);
  const [linesError, setLinesError] = useState('');

  // Load existing BOM in edit mode
  const { data: existingBom, isLoading: isLoadingBom } = useQuery({
    queryKey: ['boms', id],
    queryFn: () => api.get(`/boms/${id}`),
    enabled: isEdit,
  });

  // Load all items for the component selector
  const { data: itemsData } = useQuery({
    queryKey: ['items', 'all'],
    queryFn: () => api.get('/items?pageSize=100&sort=partNumber&order=asc'),
  });
  const allItems = itemsData?.data ?? [];

  const isDraft = !isEdit || existingBom?.data?.status === 'draft';

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(bomFormSchema),
    defaultValues: { itemId: '', revision: '', notes: '' },
  });

  // Pre-fill form when editing
  useEffect(() => {
    if (existingBom?.data) {
      const bom = existingBom.data;
      reset({
        itemId: bom.itemId,
        revision: bom.revision,
        notes: bom.notes ?? '',
      });
      setLines(
        bom.bomLines.map((line) => ({
          itemId: line.itemId,
          quantity: Number(line.quantity),
          unitOfMeasure: line.unitOfMeasure,
          scrapFactor: Number(line.scrapFactor),
          notes: line.notes ?? '',
        }))
      );
    }
  }, [existingBom, reset]);

  // Create / Update mutation
  const mutation = useMutation({
    mutationFn: (headerData) => {
      const payload = {
        ...headerData,
        notes: headerData.notes || null,
        lines: lines.map((line, idx) => ({
          ...line,
          quantity: Number(line.quantity),
          scrapFactor: Number(line.scrapFactor) || 0,
          notes: line.notes || null,
          position: idx + 1,
        })),
      };

      if (isEdit) return api.put(`/boms/${id}`, payload);
      return api.post('/boms', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boms'] });
      toast.success(isEdit ? 'BOM updated' : 'BOM created');
      navigate('/boms');
    },
    onError: (err) => {
      toast.error(err.message || 'Something went wrong');
    },
  });

  // Status change mutation
  const statusMutation = useMutation({
    mutationFn: (newStatus) => api.patch(`/boms/${id}/status`, { status: newStatus }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['boms'] });
      toast.success(`BOM status changed to ${data.data.status}`);
      navigate('/boms');
    },
    onError: (err) => toast.error(err.message || 'Status change failed'),
  });

  // Revise mutation
  const reviseMutation = useMutation({
    mutationFn: () => api.post(`/boms/${id}/revise`),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['boms'] });
      toast.success('New revision created');
      navigate(`/boms/${data.data.id}`);
    },
    onError: (err) => toast.error(err.message || 'Revise failed'),
  });

  const onSubmit = useCallback((headerData) => {
    // Validate lines separately
    if (lines.length === 0) {
      setLinesError('At least one BOM line is required');
      return;
    }
    const hasEmptyItem = lines.some((l) => !l.itemId);
    if (hasEmptyItem) {
      setLinesError('All lines must have a component selected');
      return;
    }
    setLinesError('');
    mutation.mutate(headerData);
  }, [lines, mutation]);

  if (isEdit && isLoadingBom) {
    return (
      <div className="space-y-6">
        <PageHeader title="BOM" />
        <p className="text-muted-foreground">Loading BOM...</p>
      </div>
    );
  }

  const status = existingBom?.data?.status;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <PageHeader title={isEdit ? 'BOM Detail' : 'New BOM'} />
        {status && (
          <Badge variant={STATUS_VARIANTS[status]} className="mt-1">
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Header fields */}
        <div className="max-w-2xl grid gap-4 sm:grid-cols-2">
          <FormField label="Item (produces)" htmlFor="itemId" error={errors.itemId?.message}>
            <select
              id="itemId"
              {...register('itemId')}
              disabled={isEdit}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
            >
              <option value="">Select item...</option>
              {allItems
                .filter((i) => ['finished_good', 'sub_assembly'].includes(i.type))
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.partNumber} — {item.description}
                  </option>
                ))}
            </select>
          </FormField>

          <FormField label="Revision" htmlFor="revision" error={errors.revision?.message}>
            <Input id="revision" {...register('revision')} placeholder="e.g., A, Rev-1" disabled={!isDraft} />
          </FormField>
        </div>

        <div className="max-w-2xl">
          <FormField label="Notes" htmlFor="notes" error={errors.notes?.message}>
            <Input id="notes" {...register('notes')} placeholder="Optional notes about this BOM" disabled={!isDraft} />
          </FormField>
        </div>

        {/* BOM Lines */}
        <BOMLineEditor
          lines={lines}
          onChange={setLines}
          disabled={!isDraft}
          items={allItems}
        />
        {linesError && <p className="text-sm text-destructive">{linesError}</p>}

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {isDraft && (
            <Button type="submit" disabled={isSubmitting || mutation.isPending}>
              {mutation.isPending ? 'Saving...' : isEdit ? 'Update BOM' : 'Create BOM'}
            </Button>
          )}

          <Button type="button" variant="outline" onClick={() => navigate('/boms')}>
            {isDraft ? 'Cancel' : 'Back to List'}
          </Button>

          {/* Status actions (edit mode only) */}
          {isEdit && hasPermission('bom:write') && (
            <>
              {status === 'draft' && (
                <Button
                  type="button"
                  variant="default"
                  onClick={() => statusMutation.mutate('active')}
                  disabled={statusMutation.isPending}
                  className="ml-auto"
                >
                  {statusMutation.isPending ? 'Activating...' : 'Activate'}
                </Button>
              )}
              {status === 'active' && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => reviseMutation.mutate()}
                    disabled={reviseMutation.isPending}
                    className="ml-auto"
                  >
                    {reviseMutation.isPending ? 'Creating revision...' : 'Revise'}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => statusMutation.mutate('obsolete')}
                    disabled={statusMutation.isPending}
                  >
                    Obsolete
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      </form>
    </div>
  );
};

export default BOMFormPage;
