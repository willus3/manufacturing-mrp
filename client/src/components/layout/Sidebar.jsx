// Sidebar navigation — shows module links grouped by category.
// Admin section only visible to users with users:manage or settings:manage.
// Collapsible via the `collapsed` prop.

import { NavLink } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Package,
  FileText,
  Warehouse,
  Truck,
  ClipboardList,
  HardHat,
  Calculator,
  Users,
  Shield,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';

// Navigation items — each needs a permission to be visible.
// null permission means any authenticated user can see it.
const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, permission: null },
  { to: '/items', label: 'Items', icon: Package, permission: 'item:read' },
  { to: '/boms', label: 'BOMs', icon: FileText, permission: 'bom:read' },
  { to: '/inventory', label: 'Inventory', icon: Warehouse, permission: 'inventory:read' },
  { to: '/suppliers', label: 'Suppliers', icon: Truck, permission: 'supplier:read' },
  { to: '/purchase-orders', label: 'Purchase Orders', icon: ClipboardList, permission: 'po:read' },
  { to: '/work-orders', label: 'Work Orders', icon: HardHat, permission: 'workorder:read' },
  { to: '/mrp/demand', label: 'MRP', icon: Calculator, permission: 'mrp:run' },
];

const ADMIN_ITEMS = [
  { to: '/admin/users', label: 'Users', icon: Users, permission: 'users:manage' },
  { to: '/admin/roles', label: 'Roles', icon: Shield, permission: 'users:manage' },
];

const NavItem = ({ to, label, icon: Icon, collapsed }) => (
  <NavLink
    to={to}
    end={to === '/'}
    className={({ isActive }) =>
      cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isActive
          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
          : 'text-sidebar-foreground/70',
        collapsed && 'justify-center px-2'
      )
    }
    title={collapsed ? label : undefined}
  >
    <Icon className="size-5 shrink-0" />
    {!collapsed && <span>{label}</span>}
  </NavLink>
);

const Sidebar = ({ collapsed, onToggle }) => {
  const { hasPermission } = useAuth();

  // Filter nav items to only show what the user has permission for
  const visibleNavItems = NAV_ITEMS.filter(
    (item) => !item.permission || hasPermission(item.permission)
  );

  const visibleAdminItems = ADMIN_ITEMS.filter(
    (item) => hasPermission(item.permission)
  );

  return (
    <aside
      className={cn(
        'flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-200',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo / App name */}
      <div className="flex h-14 items-center border-b border-sidebar-border px-4">
        {!collapsed && (
          <span className="text-lg font-bold text-sidebar-foreground">MRP</span>
        )}
        <button
          onClick={onToggle}
          className={cn(
            'inline-flex items-center justify-center rounded-md p-1.5 text-sidebar-foreground/70',
            'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            collapsed ? 'mx-auto' : 'ml-auto'
          )}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
        </button>
      </div>

      {/* Main navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Main navigation">
        {visibleNavItems.map((item) => (
          <NavItem key={item.to} {...item} collapsed={collapsed} />
        ))}

        {/* Admin section — only shown if user has any admin permissions */}
        {visibleAdminItems.length > 0 && (
          <>
            <Separator className="my-3" />
            {!collapsed && (
              <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                Admin
              </p>
            )}
            {visibleAdminItems.map((item) => (
              <NavItem key={item.to} {...item} collapsed={collapsed} />
            ))}
          </>
        )}
      </nav>
    </aside>
  );
};

export default Sidebar;
