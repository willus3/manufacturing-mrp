// App root — defines all routes and wraps authenticated pages in the AppShell layout.
// Public routes (login) sit outside the shell.
// Protected routes check authentication and optionally check permissions.

import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import AppShell from '@/components/layout/AppShell';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import PlaceholderPage from '@/pages/PlaceholderPage';
import ItemListPage from '@/pages/items/ItemListPage';
import ItemFormPage from '@/pages/items/ItemFormPage';

const App = () => {
  const { isAuthenticated, isLoading } = useAuth();

  // Avoid flash of login page while checking stored tokens
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
      />

      {/* Authenticated routes — wrapped in AppShell */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          {/* Dashboard — any authenticated user */}
          <Route path="/" element={<DashboardPage />} />

          {/* Items */}
          <Route element={<ProtectedRoute permission="item:read" />}>
            <Route path="/items" element={<ItemListPage />} />
            <Route element={<ProtectedRoute permission="item:write" />}>
              <Route path="/items/new" element={<ItemFormPage />} />
            </Route>
            <Route path="/items/:id" element={<ItemFormPage />} />
          </Route>

          {/* BOMs */}
          <Route element={<ProtectedRoute permission="bom:read" />}>
            <Route path="/boms" element={<PlaceholderPage title="Bills of Materials" />} />
            <Route path="/boms/new" element={<PlaceholderPage title="Create BOM" />} />
            <Route path="/boms/:id" element={<PlaceholderPage title="BOM Detail" />} />
          </Route>

          {/* Inventory */}
          <Route element={<ProtectedRoute permission="inventory:read" />}>
            <Route path="/inventory" element={<PlaceholderPage title="Inventory" />} />
            <Route path="/inventory/transactions" element={<PlaceholderPage title="Transaction Log" />} />
            <Route path="/inventory/adjust" element={<PlaceholderPage title="Inventory Adjustment" />} />
            <Route path="/inventory/transfer" element={<PlaceholderPage title="Inventory Transfer" />} />
            <Route path="/inventory/locations" element={<PlaceholderPage title="Locations" />} />
          </Route>

          {/* Suppliers */}
          <Route element={<ProtectedRoute permission="supplier:read" />}>
            <Route path="/suppliers" element={<PlaceholderPage title="Suppliers" />} />
            <Route path="/suppliers/new" element={<PlaceholderPage title="Create Supplier" />} />
            <Route path="/suppliers/:id" element={<PlaceholderPage title="Supplier Detail" />} />
          </Route>

          {/* Purchase Orders */}
          <Route element={<ProtectedRoute permission="po:read" />}>
            <Route path="/purchase-orders" element={<PlaceholderPage title="Purchase Orders" />} />
            <Route path="/purchase-orders/new" element={<PlaceholderPage title="Create PO" />} />
            <Route path="/purchase-orders/:id" element={<PlaceholderPage title="PO Detail" />} />
            <Route path="/purchase-orders/:id/receive" element={<PlaceholderPage title="Receive PO" />} />
          </Route>

          {/* Work Orders */}
          <Route element={<ProtectedRoute permission="workorder:read" />}>
            <Route path="/work-orders" element={<PlaceholderPage title="Work Orders" />} />
            <Route path="/work-orders/new" element={<PlaceholderPage title="Create Work Order" />} />
            <Route path="/work-orders/:id" element={<PlaceholderPage title="Work Order Detail" />} />
          </Route>

          {/* MRP */}
          <Route element={<ProtectedRoute permission="mrp:run" />}>
            <Route path="/mrp/demand" element={<PlaceholderPage title="Demand Entries" />} />
            <Route path="/mrp/demand/new" element={<PlaceholderPage title="Create Demand" />} />
            <Route path="/mrp/run" element={<PlaceholderPage title="Run MRP" />} />
            <Route path="/mrp/results/:runId" element={<PlaceholderPage title="MRP Results" />} />
          </Route>

          {/* Admin */}
          <Route element={<ProtectedRoute permission="users:manage" />}>
            <Route path="/admin/users" element={<PlaceholderPage title="User Management" />} />
            <Route path="/admin/users/new" element={<PlaceholderPage title="Create User" />} />
            <Route path="/admin/users/:id" element={<PlaceholderPage title="User Detail" />} />
            <Route path="/admin/roles" element={<PlaceholderPage title="Role Management" />} />
          </Route>

          <Route element={<ProtectedRoute permission="settings:manage" />}>
            <Route path="/admin/settings" element={<PlaceholderPage title="Tenant Settings" />} />
          </Route>

          {/* Catch-all — redirect to dashboard */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  );
};

export default App;
