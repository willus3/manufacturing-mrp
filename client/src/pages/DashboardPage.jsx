// Placeholder dashboard — will show summary cards in Phase 7.
// For now, just confirms the user is logged in and the shell works.

import { useAuth } from '@/contexts/AuthContext';

const DashboardPage = () => {
  const { user } = useAuth();

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
      <p className="mt-2 text-muted-foreground">
        Welcome back, {user?.firstName}. This is {user?.tenantName}.
      </p>

      {/* Placeholder for future dashboard cards */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {['Low Stock Alerts', 'Open POs', 'Active Work Orders', 'Pending Demand'].map(
          (title) => (
            <div
              key={title}
              className="rounded-lg border border-border bg-card p-6 text-card-foreground"
            >
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
              <p className="mt-2 text-3xl font-bold">—</p>
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
