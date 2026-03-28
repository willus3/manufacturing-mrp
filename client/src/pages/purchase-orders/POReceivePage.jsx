// PO Receive page — /purchase-orders/:id/receive
// Shows open PO lines with remaining quantities and lets user enter receive amounts.

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const POReceivePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Load the PO with lines — always refetch on mount to get latest status
  const { data: poData, isLoading, isFetching } = useQuery({
    queryKey: ['purchase-orders', id],
    queryFn: () => api.get(`/purchase-orders/${id}`),
    refetchOnMount: 'always',
    staleTime: 0,
  });

  // Load locations for the location selector
  const { data: locsData } = useQuery({
    queryKey: ['locations', 'active'],
    queryFn: () => api.get('/locations?isActive=true'),
  });
  const locations = locsData?.data ?? [];

  // Receive line state: keyed by poLineId
  const [receiveLines, setReceiveLines] = useState({});
  // Shared location for all lines (most common workflow)
  const [sharedLocationId, setSharedLocationId] = useState('');

  const po = poData?.data;
  const openLines = (po?.lines ?? []).filter(
    (l) => Number(l.quantityReceived) < Number(l.quantityOrdered)
  );

  const updateReceiveLine = (poLineId, field, value) => {
    setReceiveLines((prev) => ({
      ...prev,
      [poLineId]: { ...prev[poLineId], [field]: value },
    }));
  };

  const mutation = useMutation({
    mutationFn: (payload) => api.post(`/purchase-orders/${id}/receive`, payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-transactions'] });
      toast.success(`Receipt recorded — PO is now ${data.data.newStatus}`);
      navigate(`/purchase-orders/${id}`);
    },
    onError: (err) => toast.error(err.message || 'Receive failed'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();

    // Build receive lines from state — only include lines with quantity > 0
    const lines = openLines
      .filter((l) => {
        const rl = receiveLines[l.id];
        return rl?.quantity && Number(rl.quantity) > 0;
      })
      .map((l) => {
        const rl = receiveLines[l.id];
        return {
          poLineId: l.id,
          quantity: Number(rl.quantity),
          locationId: rl.locationId || sharedLocationId,
          lotNumber: rl.lotNumber || null,
          serialNumber: rl.serialNumber || null,
        };
      });

    if (lines.length === 0) {
      toast.error('Enter a quantity for at least one line');
      return;
    }

    // Validate all lines have a location
    const missingLocation = lines.some((l) => !l.locationId);
    if (missingLocation) {
      toast.error('All receive lines need a location');
      return;
    }

    mutation.mutate({ lines });
  };

  // Show loading while initial fetch OR background refetch is in progress
  // This prevents stale cached data (e.g. 'draft' status) from flashing
  // the "cannot be received" error before the fresh data arrives.
  if (isLoading || isFetching) {
    return (
      <div className="space-y-6">
        <PageHeader title="Receive PO" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!po || !['sent', 'partial'].includes(po.status)) {
    return (
      <div className="space-y-6">
        <PageHeader title="Receive PO" />
        <p className="text-muted-foreground">This PO cannot be received against.</p>
        <Button variant="outline" onClick={() => navigate('/purchase-orders')}>
          Back to List
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title={`Receive — ${po.poNumber}`} />

      <p className="text-sm text-muted-foreground">
        Supplier: <strong>{po.supplier?.name}</strong> — Enter quantities received for each line.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Shared location selector */}
        <div className="max-w-sm space-y-1.5">
          <Label>Receive Location (all lines)</Label>
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
            Override per line below if receiving to multiple locations.
          </p>
        </div>

        {/* Lines to receive */}
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-2 text-left font-medium">Item</th>
                <th className="px-3 py-2 text-left font-medium w-24">Ordered</th>
                <th className="px-3 py-2 text-left font-medium w-24">Received</th>
                <th className="px-3 py-2 text-left font-medium w-24">Remaining</th>
                <th className="px-3 py-2 text-left font-medium w-28">Receive Qty</th>
                <th className="px-3 py-2 text-left font-medium w-40">Location</th>
                <th className="px-3 py-2 text-left font-medium w-32">Lot #</th>
              </tr>
            </thead>
            <tbody>
              {openLines.map((line) => {
                const ordered = Number(line.quantityOrdered);
                const received = Number(line.quantityReceived);
                const remaining = ordered - received;
                const rl = receiveLines[line.id] || {};

                return (
                  <tr key={line.id} className="border-b last:border-0">
                    <td className="px-3 py-2">
                      {line.item?.partNumber} — {line.item?.description}
                    </td>
                    <td className="px-3 py-2">{ordered}</td>
                    <td className="px-3 py-2">{received}</td>
                    <td className="px-3 py-2 font-medium">{remaining}</td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        min="0"
                        max={remaining}
                        step="any"
                        value={rl.quantity || ''}
                        onChange={(e) => updateReceiveLine(line.id, 'quantity', e.target.value)}
                        placeholder="0"
                        className="h-8"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={rl.locationId || ''}
                        onChange={(e) => updateReceiveLine(line.id, 'locationId', e.target.value)}
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
                        value={rl.lotNumber || ''}
                        onChange={(e) => updateReceiveLine(line.id, 'lotNumber', e.target.value)}
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

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Recording...' : 'Record Receipt'}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate(`/purchase-orders/${id}`)}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
};

export default POReceivePage;
