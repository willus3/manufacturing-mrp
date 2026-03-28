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
import SupplierListPage from '@/pages/suppliers/SupplierListPage';
import SupplierFormPage from '@/pages/suppliers/SupplierFormPage';
import LocationListPage from '@/pages/locations/LocationListPage';
import LocationFormPage from '@/pages/locations/LocationFormPage';
import BOMListPage from '@/pages/boms/BOMListPage';
import BOMFormPage from '@/pages/boms/BOMFormPage';
import StockOverviewPage from '@/pages/inventory/StockOverviewPage';
import TransactionLogPage from '@/pages/inventory/TransactionLogPage';
import AdjustmentPage from '@/pages/inventory/AdjustmentPage';
import TransferPage from '@/pages/inventory/TransferPage';
import POListPage from '@/pages/purchase-orders/POListPage';
import POFormPage from '@/pages/purchase-orders/POFormPage';
import POReceivePage from '@/pages/purchase-orders/POReceivePage';
import WOListPage from '@/pages/work-orders/WOListPage';
import WOFormPage from '@/pages/work-orders/WOFormPage';

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
            <Route path="/boms" element={<BOMListPage />} />
            <Route element={<ProtectedRoute permission="bom:write" />}>
              <Route path="/boms/new" element={<BOMFormPage />} />
            </Route>
            <Route path="/boms/:id" element={<BOMFormPage />} />
          </Route>

          {/* Inventory */}
          <Route element={<ProtectedRoute permission="inventory:read" />}>
            <Route path="/inventory" element={<StockOverviewPage />} />
            <Route path="/inventory/transactions" element={<TransactionLogPage />} />
            <Route element={<ProtectedRoute permission="inventory:write" />}>
              <Route path="/inventory/adjust" element={<AdjustmentPage />} />
              <Route path="/inventory/transfer" element={<TransferPage />} />
            </Route>
            <Route path="/inventory/locations" element={<LocationListPage />} />
            <Route element={<ProtectedRoute permission="inventory:write" />}>
              <Route path="/inventory/locations/new" element={<LocationFormPage />} />
            </Route>
            <Route path="/inventory/locations/:id" element={<LocationFormPage />} />
          </Route>

          {/* Suppliers */}
          <Route element={<ProtectedRoute permission="supplier:read" />}>
            <Route path="/suppliers" element={<SupplierListPage />} />
            <Route element={<ProtectedRoute permission="supplier:write" />}>
              <Route path="/suppliers/new" element={<SupplierFormPage />} />
            </Route>
            <Route path="/suppliers/:id" element={<SupplierFormPage />} />
          </Route>

          {/* Purchase Orders */}
          <Route element={<ProtectedRoute permission="po:read" />}>
            <Route path="/purchase-orders" element={<POListPage />} />
            <Route element={<ProtectedRoute permission="po:write" />}>
              <Route path="/purchase-orders/new" element={<POFormPage />} />
            </Route>
            <Route path="/purchase-orders/:id" element={<POFormPage />} />
            <Route element={<ProtectedRoute permission="po:receive" />}>
              <Route path="/purchase-orders/:id/receive" element={<POReceivePage />} />
            </Route>
          </Route>

          {/* Work Orders */}
          <Route element={<ProtectedRoute permission="workorder:read" />}>
            <Route path="/work-orders" element={<WOListPage />} />
            <Route element={<ProtectedRoute permission="workorder:write" />}>
              <Route path="/work-orders/new" element={<WOFormPage />} />
            </Route>
            <Route path="/work-orders/:id" element={<WOFormPage />} />
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
