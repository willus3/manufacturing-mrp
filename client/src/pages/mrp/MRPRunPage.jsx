// MRP Run page — /mrp/run
// Allows user to set planning horizon and execute the MRP calculation.
// Shows run history below the form.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

const RUN_STATUS_VARIANTS = {
  running: 'outline',
  completed: 'default',
  failed: 'destructive',
};

const MRPRunPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [planningHorizonDays, setPlanningHorizonDays] = useState(90);

  // Load run history
  const { data: runsData, isLoading } = useQuery({
    queryKey: ['mrp-runs'],
    queryFn: () => api.get('/mrp/runs?pageSize=25'),
  });
  const runs = runsData?.data ?? [];

  // Run MRP mutation
  const runMutation = useMutation({
    mutationFn: () => api.post('/mrp/run', { planningHorizonDays: Number(planningHorizonDays) }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['mrp-runs'] });
      queryClient.invalidateQueries({ queryKey: ['mrp-demand'] });
      const resultCount = data.data?.results?.length ?? 0;
      toast.success(`MRP run complete — ${resultCount} suggestion${resultCount !== 1 ? 's' : ''} generated`);
      // Navigate to results page
      navigate(`/mrp/results/${data.data.id}`);
    },
    onError: (err) => toast.error(err.message || 'MRP run failed'),
  });

  const handleRun = (e) => {
    e.preventDefault();
    runMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Run MRP" />

      <form onSubmit={handleRun} className="space-y-4 max-w-sm">
        <div className="space-y-1.5">
          <Label>Planning Horizon (days)</Label>
          <Input
            type="number"
            min="1"
            max="365"
            value={planningHorizonDays}
            onChange={(e) => setPlanningHorizonDays(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Only demand entries with date required within this window will be included.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={runMutation.isPending}>
            {runMutation.isPending ? 'Running...' : 'Run MRP Calculation'}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate('/mrp/demand')}>
            Back to Demand
          </Button>
        </div>
      </form>

      {/* Run History */}
      <div className="space-y-3">
        <Label className="text-base font-semibold">Run History</Label>
        {isLoading && <p className="text-muted-foreground text-sm">Loading...</p>}
        {!isLoading && runs.length === 0 && (
          <p className="text-sm text-muted-foreground">No MRP runs yet.</p>
        )}
        {runs.length > 0 && (
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium">Date</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-left font-medium">Run By</th>
                  <th className="px-3 py-2 text-left font-medium">Results</th>
                  <th className="px-3 py-2 text-left font-medium">Horizon</th>
                  <th className="px-3 py-2 w-24" />
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id} className="border-b last:border-0">
                    <td className="px-3 py-2">{new Date(run.ranAt).toLocaleString()}</td>
                    <td className="px-3 py-2">
                      <Badge variant={RUN_STATUS_VARIANTS[run.status] ?? 'outline'}>
                        {run.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      {run.user ? `${run.user.firstName} ${run.user.lastName}` : '—'}
                    </td>
                    <td className="px-3 py-2">{run._count?.results ?? 0}</td>
                    <td className="px-3 py-2">{run.parameters?.planningHorizonDays ?? '—'} days</td>
                    <td className="px-3 py-2">
                      {run.status === 'completed' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/mrp/results/${run.id}`)}
                        >
                          View
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default MRPRunPage;
