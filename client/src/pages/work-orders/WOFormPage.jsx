// WO Form page — handles Create (/work-orders/new) and Detail (/work-orders/:id).
//
// Features:
// - Create: BOM selector, quantity, priority, schedule dates
// - Detail: read-only header, status badge, status transition buttons
// - Material lines table (WOLineTable): shows required vs. issued quantities
// - Issue Material section: for released/in_progress WOs, issue material from inventory
// - On completion: backend auto-creates inventory receipt for finished item

import { useEffect, useState, useCallback } from 'react';
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
// Constants
// ============================================
const STATUS_VARIANTS = {
  planned: 'secondary',
  released: 'default',
  in_progress: 'outline',
  completed: 'default',
  cancelled: 'destructive',
};

const STATUS_LABELS = {
  planned: 'Planned',
  released: 'Released',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

// Valid next statuses from each current status
const NEXT_STATUSES = {
  planned: ['released', 'cancelled'],
  released: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
};

// ============================================
// Validation
// ============================================
const woFormSchema = z.object({
  bomId: z.string().min(1, 'Select a BOM'),
  quantity: z.coerce.number().positive('Quantity must be greater than 0'),
  priority: z.coerce.number().int().min(0).default(0),
  scheduledStart: z.string().optional(),
  scheduledEnd: z.string().optional(),
  notes: z.string().max(2000).optional(),
});

const FormField = ({ label, error, children }) => (
  <div className="space-y-1.5">
    <Label className={error ? 'text-destructive' : ''}>{label}</Label>
    {children}
    {error && <p className="text-sm text-destructive">{error}</p>}
  </div>
);

// ============================================
// WO Line Table — shows required vs. issued material
// ============================================
const WOLineTable = ({ lines }) => {
  if (!lines || lines.length === 0) return null;

  return (
    <div className="space-y-3">
      <Label>Material Lines</Label>
      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-3 py-2 text-left font-medium">Item</th>
              <th className="px-3 py-2 text-left font-medium">UOM</th>
              <th className="px-3 py-2 text-left font-medium w-28">Required</th>
              <th className="px-3 py-2 text-left font-medium w-28">Issued</th>
              <th className="px-3 py-2 text-left font-medium w-28">Remaining</th>
              <th className="px-3 py-2 text-left font-medium">Location</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const required = Number(line.quantityRequired);
              const issued = Number(line.quantityIssued);
              const remaining = required - issued;
              return (
                <tr key={line.id} className="border-b last:border-0">
                  <td className="px-3 py-2">
                    {line.item?.partNumber} — {line.item?.description}
                  </td>
                  <td className="px-3 py-2">{line.item?.unitOfMeasure}</td>
                  <td className="px-3 py-2">{required}</td>
                  <td className="px-3 py-2">
                    <span className={issued >= required ? 'text-green-600' : ''}>
                      {issued}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-medium">
                    {remaining > 0 ? remaining : '—'}
                  </td>
                  <td className="px-3 py-2">
                    {line.location ? `${line.location.code} — ${line.location.name}` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ============================================
// Issue Material Form — for released/in_progress WOs
// ============================================
const IssueMaterialForm = ({ woId, lines, locations, onSuccess }) => {
  // Only show lines that still have material to issue
  const openLines = lines.filter(
    (l) => Number(l.quantityIssued) < Number(l.quantityRequired)
  );

  const [issueLines, setIssueLines] = useState({});
  const [sharedLocationId, setSharedLocationId] = useState('');

  const updateIssueLine = (woLineId, field, value) => {
    setIssueLines((prev) => ({
      ...prev,
      [woLineId]: { ...prev[woLineId], [field]: value },
    }));
  };

  const mutation = useMutation({
    mutationFn: (payload) => api.post(`/work-orders/${woId}/issue`, payload),
    onSuccess: () => {
      toast.success('Material issued successfully');
      setIssueLines({});
      onSuccess();
    },
    onError: (err) => toast.error(err.message || 'Issue failed'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();

    const issueLinesPayload = openLines
      .filter((l) => {
        const il = issueLines[l.id];
        return il?.quantity && Number(il.quantity) > 0;
      })
      .map((l) => {
        const il = issueLines[l.id];
        return {
          woLineId: l.id,
          quantity: Number(il.quantity),
          locationId: il.locationId || sharedLocationId,
          lotNumber: il.lotNumber || null,
          serialNumber: il.serialNumber || null,
        };
      });

    if (issueLinesPayload.length === 0) {
      toast.error('Enter a quantity for at least one line');
      return;
    }

    const missingLocation = issueLinesPayload.some((l) => !l.locationId);
    if (missingLocation) {
      toast.error('All issue lines need a location');
      return;
    }

    mutation.mutate({ lines: issueLinesPayload });
  };

  if (openLines.length === 0) {
    return (
      <div className="space-y-3">
        <Label>Issue Material</Label>
        <p className="text-sm text-muted-foreground">All material has been issued.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Label className="text-base font-semibold">Issue Material</Label>

      {/* Shared location */}
      <div className="max-w-sm space-y-1.5">
        <Label>Issue Location (all lines)</Label>
        <select
          value={sharedLocationId}
          onChange={(e) => setSharedLocationId(e.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">Select location...</option>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.code} — {loc.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Override per line below if issuing from multiple locations.
        </p>
      </div>

      {/* Issue lines table */}
      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-3 py-2 text-left font-medium">Item</th>
              <th className="px-3 py-2 text-left font-medium w-24">Required</th>
              <th className="px-3 py-2 text-left font-medium w-24">Issued</th>
              <th className="px-3 py-2 text-left font-medium w-24">Remaining</th>
              <th className="px-3 py-2 text-left font-medium w-28">Issue Qty</th>
              <th className="px-3 py-2 text-left font-medium w-40">Location</th>
              <th className="px-3 py-2 text-left font-medium w-32">Lot #</th>
            </tr>
          </thead>
          <tbody>
            {openLines.map((line) => {
              const required = Number(line.quantityRequired);
              const issued = Number(line.quantityIssued);
              const remaining = required - issued;
              const il = issueLines[line.id] || {};

              return (
                <tr key={line.id} className="border-b last:border-0">
                  <td className="px-3 py-2">
                    {line.item?.partNumber} — {line.item?.description}
                  </td>
                  <td className="px-3 py-2">{required}</td>
                  <td className="px-3 py-2">{issued}</td>
                  <td className="px-3 py-2 font-medium">{remaining}</td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min="0"
                      max={remaining}
                      step="any"
                      value={il.quantity || ''}
                      onChange={(e) => updateIssueLine(line.id, 'quantity', e.target.value)}
                      placeholder="0"
                      className="h-8"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={il.locationId || ''}
                      onChange={(e) => updateIssueLine(line.id, 'locationId', e.target.value)}
                      className="w-full rounded border border-input bg-transparent px-2 py-1 text-sm"
                    >
                      <option value="">{sharedLocationId ? '(shared)' : 'Select...'}</option>
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.code}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      value={il.lotNumber || ''}
                      onChange={(e) => updateIssueLine(line.id, 'lotNumber', e.target.value)}
                      placeholder="Optional"
                      className="h-8"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? 'Issuing...' : 'Issue Material'}
      </Button>
    </form>
  );
};

// ============================================
// Main WO Form Page
// ============================================
const WOFormPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const isEdit = Boolean(id);

  // Load existing WO in edit mode
  const { data: existingWO, isLoading: isLoadingWO } = useQuery({
    queryKey: ['work-orders', id],
    queryFn: () => api.get(`/work-orders/${id}`),
    enabled: isEdit,
  });

  // Load active BOMs for the create form
  const { data: bomsData } = useQuery({
    queryKey: ['boms', 'active'],
    queryFn: () => api.get('/boms?status=active&pageSize=100'),
    enabled: !isEdit,
  });
  const activeBOMs = bomsData?.data ?? [];

  // Load locations for issue material
  const { data: locsData } = useQuery({
    queryKey: ['locations', 'active'],
    queryFn: () => api.get('/locations?isActive=true'),
    enabled: isEdit,
  });
  const locations = locsData?.data ?? [];

  const wo = existingWO?.data;
  const status = wo?.status;
  const isPlanned = status === 'planned';
  const canEdit = !isEdit || isPlanned;
  const canIssue = ['released', 'in_progress'].includes(status);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(woFormSchema),
    defaultValues: {
      bomId: '',
      quantity: 1,
      priority: 0,
      scheduledStart: '',
      scheduledEnd: '',
      notes: '',
    },
  });

  // Pre-fill form when editing a planned WO
  useEffect(() => {
    if (wo && isPlanned) {
      reset({
        bomId: wo.bomId,
        quantity: Number(wo.quantity),
        priority: wo.priority ?? 0,
        scheduledStart: wo.scheduledStart ? wo.scheduledStart.split('T')[0] : '',
        scheduledEnd: wo.scheduledEnd ? wo.scheduledEnd.split('T')[0] : '',
        notes: wo.notes ?? '',
      });
    }
  }, [wo, isPlanned, reset]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (formData) => {
      const payload = {
        ...formData,
        scheduledStart: formData.scheduledStart || null,
        scheduledEnd: formData.scheduledEnd || null,
        notes: formData.notes || null,
      };
      return api.post('/work-orders', payload);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      toast.success('Work order created');
      navigate(`/work-orders/${data.data.id}`);
    },
    onError: (err) => toast.error(err.message || 'Create failed'),
  });

  // Update mutation (planned WOs only)
  const updateMutation = useMutation({
    mutationFn: (formData) => {
      const payload = {
        quantity: formData.quantity,
        priority: formData.priority,
        scheduledStart: formData.scheduledStart || null,
        scheduledEnd: formData.scheduledEnd || null,
        notes: formData.notes || null,
      };
      return api.put(`/work-orders/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      toast.success('Work order updated');
      navigate('/work-orders');
    },
    onError: (err) => toast.error(err.message || 'Update failed'),
  });

  // Status change mutation
  const statusMutation = useMutation({
    mutationFn: (newStatus) => api.patch(`/work-orders/${id}/status`, { status: newStatus }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-transactions'] });
      const result = data.data;
      if (result.warning) {
        toast.warning(result.warning);
      }
      toast.success(`Status changed to ${STATUS_LABELS[result.workOrder?.status || result.status] || 'updated'}`);
    },
    onError: (err) => toast.error(err.message || 'Status change failed'),
  });

  const onSubmit = useCallback((formData) => {
    if (isEdit) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  }, [isEdit, updateMutation, createMutation]);

  // Callback for after material issue succeeds — refetch the WO
  const handleIssueSuccess = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['work-orders', id] });
    queryClient.invalidateQueries({ queryKey: ['inventory-stock'] });
    queryClient.invalidateQueries({ queryKey: ['inventory-transactions'] });
  }, [queryClient, id]);

  if (isEdit && isLoadingWO) {
    return (
      <div className="space-y-6">
        <PageHeader title="Work Order" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // ---- Create mode or Edit (planned) mode ----
  if (!isEdit || isPlanned) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <PageHeader
            title={isEdit ? `WO ${wo?.woNumber ?? ''}` : 'New Work Order'}
          />
          {status && (
            <Badge variant={STATUS_VARIANTS[status]} className="mt-1">
              {STATUS_LABELS[status]}
            </Badge>
          )}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="max-w-2xl grid gap-4 sm:grid-cols-2">
            {/* BOM selector — only on create */}
            {!isEdit && (
              <FormField label="BOM (Product)" error={errors.bomId?.message}>
                <select
                  {...register('bomId')}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">Select an active BOM...</option>
                  {activeBOMs.map((bom) => (
                    <option key={bom.id} value={bom.id}>
                      {bom.item?.partNumber} — {bom.item?.description} (Rev {bom.revision})
                    </option>
                  ))}
                </select>
              </FormField>
            )}

            {/* Show BOM info read-only when editing */}
            {isEdit && wo?.bom && (
              <div className="space-y-1.5">
                <Label>BOM (Product)</Label>
                <p className="text-sm py-1.5">
                  {wo.bom.item?.partNumber} — {wo.bom.item?.description} (Rev {wo.bom.revision})
                </p>
              </div>
            )}

            <FormField label="Quantity" error={errors.quantity?.message}>
              <Input
                type="number"
                min="0.001"
                step="any"
                {...register('quantity')}
              />
            </FormField>

            <FormField label="Priority" error={errors.priority?.message}>
              <Input
                type="number"
                min="0"
                step="1"
                {...register('priority')}
              />
            </FormField>

            <FormField label="Scheduled Start" error={errors.scheduledStart?.message}>
              <Input type="date" {...register('scheduledStart')} />
            </FormField>

            <FormField label="Scheduled End" error={errors.scheduledEnd?.message}>
              <Input type="date" {...register('scheduledEnd')} />
            </FormField>
          </div>

          <div className="max-w-2xl">
            <FormField label="Notes" error={errors.notes?.message}>
              <Input
                {...register('notes')}
                placeholder="Optional notes"
              />
            </FormField>
          </div>

          {/* Show material lines in edit (planned) mode */}
          {isEdit && wo?.lines && <WOLineTable lines={wo.lines} />}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="submit"
              disabled={isSubmitting || createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending)
                ? 'Saving...'
                : isEdit ? 'Update Work Order' : 'Create Work Order'}
            </Button>

            <Button type="button" variant="outline" onClick={() => navigate('/work-orders')}>
              Cancel
            </Button>

            {/* Status actions for planned WOs */}
            {isEdit && isPlanned && hasPermission('workorder:status') && (
              <>
                <Button
                  type="button"
                  variant="default"
                  onClick={() => statusMutation.mutate('released')}
                  disabled={statusMutation.isPending}
                  className="ml-auto"
                >
                  {statusMutation.isPending ? 'Updating...' : 'Release'}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => statusMutation.mutate('cancelled')}
                  disabled={statusMutation.isPending}
                >
                  Cancel WO
                </Button>
              </>
            )}
          </div>
        </form>
      </div>
    );
  }

  // ---- Detail mode (released, in_progress, completed, cancelled) ----
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <PageHeader title={`WO ${wo?.woNumber ?? ''}`} />
        {status && (
          <Badge variant={STATUS_VARIANTS[status]} className="mt-1">
            {STATUS_LABELS[status]}
          </Badge>
        )}
      </div>

      {/* Read-only header info */}
      <div className="max-w-2xl grid gap-4 sm:grid-cols-2 text-sm">
        <div>
          <Label className="text-muted-foreground">Product (BOM)</Label>
          <p>{wo?.bom?.item?.partNumber} — {wo?.bom?.item?.description} (Rev {wo?.bom?.revision})</p>
        </div>
        <div>
          <Label className="text-muted-foreground">Quantity</Label>
          <p>{Number(wo?.quantity)}</p>
        </div>
        <div>
          <Label className="text-muted-foreground">Priority</Label>
          <p>{wo?.priority ?? 0}</p>
        </div>
        <div>
          <Label className="text-muted-foreground">Created By</Label>
          <p>{wo?.creator ? `${wo.creator.firstName} ${wo.creator.lastName}` : '—'}</p>
        </div>
        <div>
          <Label className="text-muted-foreground">Scheduled Start</Label>
          <p>{wo?.scheduledStart ? new Date(wo.scheduledStart).toLocaleDateString() : '—'}</p>
        </div>
        <div>
          <Label className="text-muted-foreground">Scheduled End</Label>
          <p>{wo?.scheduledEnd ? new Date(wo.scheduledEnd).toLocaleDateString() : '—'}</p>
        </div>
        {wo?.actualStart && (
          <div>
            <Label className="text-muted-foreground">Actual Start</Label>
            <p>{new Date(wo.actualStart).toLocaleString()}</p>
          </div>
        )}
        {wo?.actualEnd && (
          <div>
            <Label className="text-muted-foreground">Actual End</Label>
            <p>{new Date(wo.actualEnd).toLocaleString()}</p>
          </div>
        )}
        {wo?.notes && (
          <div className="sm:col-span-2">
            <Label className="text-muted-foreground">Notes</Label>
            <p>{wo.notes}</p>
          </div>
        )}
      </div>

      {/* Material lines */}
      {wo?.lines && <WOLineTable lines={wo.lines} />}

      {/* Issue Material — only for released/in_progress with write permission */}
      {canIssue && hasPermission('workorder:write') && (
        <IssueMaterialForm
          woId={id}
          lines={wo.lines}
          locations={locations}
          onSuccess={handleIssueSuccess}
        />
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={() => navigate('/work-orders')}>
          Back to List
        </Button>

        {hasPermission('workorder:status') && NEXT_STATUSES[status] && (
          <>
            {NEXT_STATUSES[status]
              .filter((s) => s !== 'cancelled')
              .map((nextStatus) => (
                <Button
                  key={nextStatus}
                  variant="default"
                  onClick={() => statusMutation.mutate(nextStatus)}
                  disabled={statusMutation.isPending}
                  className="ml-auto"
                >
                  {statusMutation.isPending ? 'Updating...' : STATUS_LABELS[nextStatus]}
                </Button>
              ))}

            {NEXT_STATUSES[status].includes('cancelled') && (
              <Button
                variant="destructive"
                onClick={() => statusMutation.mutate('cancelled')}
                disabled={statusMutation.isPending}
              >
                {statusMutation.isPending ? 'Cancelling...' : 'Cancel WO'}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default WOFormPage;
