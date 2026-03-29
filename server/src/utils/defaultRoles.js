// Default roles and their permission assignments.
// Shared between prisma/seed.js and super admin tenant creation
// so both use the same role definitions.

const PERMISSIONS = [
  { code: 'bom:read', description: 'View BOMs' },
  { code: 'bom:write', description: 'Create/edit BOMs' },
  { code: 'bom:delete', description: 'Delete/archive BOMs' },
  { code: 'inventory:read', description: 'View inventory levels' },
  { code: 'inventory:write', description: 'Perform inventory transactions (receipts, adjustments, transfers)' },
  { code: 'item:read', description: 'View item master' },
  { code: 'item:write', description: 'Create/edit items' },
  { code: 'po:read', description: 'View purchase orders' },
  { code: 'po:write', description: 'Create/edit purchase orders' },
  { code: 'po:receive', description: 'Receive against purchase orders' },
  { code: 'supplier:read', description: 'View suppliers' },
  { code: 'supplier:write', description: 'Create/edit suppliers' },
  { code: 'workorder:read', description: 'View work orders' },
  { code: 'workorder:write', description: 'Create/edit work orders' },
  { code: 'workorder:status', description: 'Update work order status' },
  { code: 'mrp:run', description: 'Execute MRP calculation and manage demand' },
  { code: 'users:manage', description: 'Create/edit/deactivate users within the tenant' },
  { code: 'settings:manage', description: 'Configure tenant settings' },
];

const DEFAULT_ROLES = [
  {
    name: 'Admin',
    permissions: 'ALL',
  },
  {
    name: 'Production Manager',
    permissions: [
      'bom:read', 'bom:write',
      'workorder:read', 'workorder:write', 'workorder:status',
      'inventory:read',
      'mrp:run',
      'po:read',
      'item:read', 'item:write',
    ],
  },
  {
    name: 'Purchasing Agent',
    permissions: [
      'po:read', 'po:write', 'po:receive',
      'supplier:read', 'supplier:write',
      'inventory:read',
      'bom:read',
      'item:read', 'item:write',
    ],
  },
  {
    name: 'Shop Floor Supervisor',
    permissions: [
      'workorder:read', 'workorder:status',
      'bom:read',
      'inventory:read',
      'item:read',
    ],
  },
  {
    name: 'Inventory Clerk',
    permissions: [
      'inventory:read', 'inventory:write',
      'item:read',
      'bom:read',
    ],
  },
];

module.exports = { PERMISSIONS, DEFAULT_ROLES };
