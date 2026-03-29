// Dashboard page — shows summary cards with live data from GET /dashboard.
// Each card links to its respective module for quick navigation.

import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import {
  AlertTriangle,
  ClipboardList,
  HardHat,
  Calculator,
  ArrowRight,
} from 'lucide-react';

// ============================================
// Dashboard card — reusable summary tile
// ============================================
const DashCard = ({ title, icon: Icon, children, onClick, className = '' }) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-lg border border-border bg-card p-6 text-card-foreground text-left w-full
      cursor-pointer hover:border-primary/40 transition-colors
      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className}`}
    aria-label={`${title} — click to view details`}
  >
    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
      <Icon className="size-4" aria-hidden="true" />
      {title}
    </div>
    <div className="mt-3">{children}</div>
  </button>
);

// ============================================
// Status row — label + count on one line
// ============================================
const StatusRow = ({ label, count, highlight = false }) => (
  <div className="flex items-center justify-between text-sm">
    <span className={highlight ? 'font-medium text-destructive' : 'text-muted-foreground'}>
      {label}
    </span>
    <span className={highlight ? 'font-bold text-destructive' : 'font-medium text-foreground'}>
      {count}
    </span>
  </div>
);

const DashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/dashboard'),
    // Inventory-level data — 30s stale per spec, auto-refetch on focus
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const summary = data?.data;

  // ---- Loading skeleton ----
  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Loading dashboard...</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-lg border border-border bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  // ---- Error state ----
  if (isError || !summary) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">
          Failed to load dashboard data. Try refreshing the page.
        </p>
      </div>
    );
  }

  const po = summary.purchaseOrders;
  const wo = summary.workOrders;
  const lowStock = summary.lowStockAlerts;
  const mrp = summary.lastMrpRun;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="mt-1 text-muted-foreground">
          Welcome back, {user?.firstName}. Here's what's happening in {user?.tenantName}.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* ---- Low Stock Alerts ---- */}
        <DashCard
          title="Low Stock Alerts"
          icon={AlertTriangle}
          onClick={() => navigate('/inventory')}
        >
          <p className="text-3xl font-bold">{lowStock.count}</p>
          {lowStock.count > 0 ? (
            <div className="mt-3 space-y-1">
              {lowStock.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-xs">
                  <span className="truncate text-muted-foreground" title={item.description}>
                    {item.partNumber}
                  </span>
                  <span className="ml-2 shrink-0 font-medium text-destructive">
                    {item.availableQty} / {item.reorderPoint} {item.unitOfMeasure}
                  </span>
                </div>
              ))}
              {lowStock.count > 5 && (
                <p className="text-xs text-muted-foreground">
                  +{lowStock.count - 5} more...
                </p>
              )}
            </div>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">All items above reorder point</p>
          )}
        </DashCard>

        {/* ---- Purchase Orders ---- */}
        <DashCard
          title="Purchase Orders"
          icon={ClipboardList}
          onClick={() => navigate('/purchase-orders')}
        >
          <p className="text-3xl font-bold">{po.sent + po.partial}</p>
          <p className="text-sm text-muted-foreground">Open orders</p>
          <div className="mt-3 space-y-1">
            <StatusRow label="Draft" count={po.draft} />
            <StatusRow label="Sent" count={po.sent} />
            <StatusRow label="Partial" count={po.partial} />
            <StatusRow label="Overdue" count={po.overdue} highlight={po.overdue > 0} />
          </div>
        </DashCard>

        {/* ---- Work Orders ---- */}
        <DashCard
          title="Work Orders"
          icon={HardHat}
          onClick={() => navigate('/work-orders')}
        >
          <p className="text-3xl font-bold">{wo.released + wo.in_progress}</p>
          <p className="text-sm text-muted-foreground">Active orders</p>
          <div className="mt-3 space-y-1">
            <StatusRow label="Planned" count={wo.planned} />
            <StatusRow label="Released" count={wo.released} />
            <StatusRow label="In Progress" count={wo.in_progress} />
            <StatusRow label="Completed" count={wo.completed} />
          </div>
        </DashCard>

        {/* ---- MRP & Demand ---- */}
        <DashCard
          title="MRP & Demand"
          icon={Calculator}
          onClick={() => navigate('/mrp/demand')}
        >
          <div className="space-y-2">
            <div>
              <p className="text-3xl font-bold">{summary.openDemand}</p>
              <p className="text-sm text-muted-foreground">Open demand entries</p>
            </div>
            {mrp ? (
              <div className="rounded-md bg-muted/50 p-2 text-xs">
                <p className="text-muted-foreground">
                  Last run: {new Date(mrp.ranAt).toLocaleDateString()}
                </p>
                {mrp.unconvertedSuggestions > 0 && (
                  <span
                    role="link"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/mrp/results/${mrp.id}`);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.stopPropagation();
                        navigate(`/mrp/results/${mrp.id}`);
                      }
                    }}
                    className="mt-1 flex items-center gap-1 text-primary hover:underline cursor-pointer"
                  >
                    {mrp.unconvertedSuggestions} unconverted suggestions
                    <ArrowRight className="size-3" aria-hidden="true" />
                  </span>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No MRP runs yet</p>
            )}
          </div>
        </DashCard>
      </div>
    </div>
  );
};

export default DashboardPage;
