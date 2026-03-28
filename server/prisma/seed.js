// Prisma seed script — run with: npx prisma db seed (from server/)
// Idempotent: safe to re-run without duplicating data.
//
// Seeds:
//   1. All 18 permissions (global, no tenant)
//   2. Test tenant "Test Shop"
//   3. 5 default roles with permission assignments for Test Shop
//   4. Tenant admin user (admin@test.com) with Admin role
//   5. Super admin user (superadmin@mrp.system) with NO tenant

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// ============================================
// PERMISSIONS — 18 total, globally unique
// ============================================
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

// ============================================
// DEFAULT ROLES — per-tenant, isDefault: true
// "Admin" gets ALL permissions.
// ============================================
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

const main = async () => {
  console.log('Seeding database...\n');

  // ---- 1. Seed permissions ----
  console.log('1. Seeding permissions...');
  const permissionRecords = {};
  for (const perm of PERMISSIONS) {
    const record = await prisma.permission.upsert({
      where: { code: perm.code },
      update: { description: perm.description },
      create: perm,
    });
    permissionRecords[perm.code] = record;
  }
  console.log(`   ${Object.keys(permissionRecords).length} permissions seeded.`);

  // ---- 2. Create test tenant ----
  console.log('2. Creating test tenant...');
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'test-shop' },
    update: {},
    create: { name: 'Test Shop', slug: 'test-shop' },
  });
  console.log(`   Tenant: ${tenant.name} (${tenant.id})`);

  // ---- 3. Create default roles with permission assignments ----
  console.log('3. Creating default roles...');
  const allPermissionCodes = PERMISSIONS.map((p) => p.code);

  for (const roleDef of DEFAULT_ROLES) {
    // Resolve which permission codes this role gets
    const permCodes = roleDef.permissions === 'ALL'
      ? allPermissionCodes
      : roleDef.permissions;

    // Upsert the role
    const role = await prisma.role.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: roleDef.name } },
      update: {},
      create: {
        tenantId: tenant.id,
        name: roleDef.name,
        isDefault: true,
      },
    });

    // Clear existing permission assignments and re-create them
    // This ensures the role's permissions always match the spec
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: permCodes.map((code) => ({
        roleId: role.id,
        permissionId: permissionRecords[code].id,
      })),
    });

    console.log(`   ${roleDef.name}: ${permCodes.length} permissions`);
  }

  // ---- 4. Create tenant admin user with Admin role ----
  console.log('4. Creating tenant admin user...');
  const adminPasswordHash = await bcrypt.hash('password123', 12);

  const adminUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'admin@test.com' } },
    update: { passwordHash: adminPasswordHash },
    create: {
      tenantId: tenant.id,
      email: 'admin@test.com',
      passwordHash: adminPasswordHash,
      firstName: 'Test',
      lastName: 'Admin',
    },
  });

  // Assign Admin role to the tenant admin
  const adminRole = await prisma.role.findUnique({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Admin' } },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: adminRole.id } },
    update: {},
    create: { userId: adminUser.id, roleId: adminRole.id },
  });
  console.log(`   admin@test.com / password123 → Admin role`);

  // ---- 5. Create super admin (NO tenant) ----
  console.log('5. Creating super admin user...');
  const superPasswordHash = await bcrypt.hash('superadmin123', 12);

  // Super admin exists outside all tenants (tenantId is null).
  // The unique constraint is (tenantId, email), but SQL treats NULLs as distinct,
  // so we search all users with this email and pick the one with no tenant.
  const allWithEmail = await prisma.user.findMany({
    where: { email: 'superadmin@mrp.system' },
  });
  const existingSuperAdmin = allWithEmail.find((u) => u.tenantId === null);

  if (existingSuperAdmin) {
    await prisma.user.update({
      where: { id: existingSuperAdmin.id },
      data: { passwordHash: superPasswordHash, isSuperAdmin: true },
    });
    console.log(`   superadmin@mrp.system (updated)`);
  } else {
    await prisma.user.create({
      data: {
        tenantId: null,
        email: 'superadmin@mrp.system',
        passwordHash: superPasswordHash,
        firstName: 'Super',
        lastName: 'Admin',
        isSuperAdmin: true,
      },
    });
    console.log(`   superadmin@mrp.system / superadmin123 (created)`);
  }

  // ============================================
  // SAMPLE MANUFACTURING DATA — Dendro Designs
  // ============================================
  console.log('\n--- Seeding sample manufacturing data ---\n');

  // ---- 6. Inventory Locations ----
  console.log('6. Creating inventory locations...');
  const locations = {};
  const locationDefs = [
    { code: 'MAIN-WH', name: 'Main Warehouse', description: 'Primary raw material and finished goods storage' },
    { code: 'SHOP-FL', name: 'Shop Floor', description: 'Active production area' },
    { code: 'RECV', name: 'Receiving', description: 'Incoming material inspection area' },
  ];
  for (const loc of locationDefs) {
    locations[loc.code] = await prisma.inventoryLocation.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: loc.code } },
      update: {},
      create: { tenantId: tenant.id, ...loc },
    });
  }
  console.log(`   ${Object.keys(locations).length} locations created.`);

  // ---- 7. Suppliers ----
  console.log('7. Creating suppliers...');
  const suppliers = {};
  const supplierDefs = [
    {
      code: 'WOOD-SUP',
      name: 'Woodcraft Supply Co',
      contactName: 'Mike Holden',
      contactEmail: 'mike@woodcraftsupply.com',
      contactPhone: '(904) 555-0101',
      address: '1200 Lumber Ln, Jacksonville, FL 32256',
      notes: 'Primary lumber supplier — kiln-dried hardwoods, reliable 7-day lead time',
    },
    {
      code: 'FAST-DEP',
      name: 'Fastener Depot',
      contactName: 'Sarah Chen',
      contactEmail: 'sarah@fastenerdepot.com',
      contactPhone: '(904) 555-0202',
      address: '850 Industrial Blvd, Jacksonville, FL 32216',
      notes: 'Hardware and fasteners — next-day delivery available',
    },
    {
      code: 'FIN-SOL',
      name: 'Finishing Solutions Inc',
      contactName: 'James Rivera',
      contactEmail: 'james@finishingsolutions.com',
      contactPhone: '(904) 555-0303',
      address: '340 Coatings Dr, Jacksonville, FL 32211',
      notes: 'Finishes, abrasives, and surface prep materials',
    },
  ];
  for (const sup of supplierDefs) {
    suppliers[sup.code] = await prisma.supplier.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: sup.code } },
      update: {},
      create: { tenantId: tenant.id, ...sup },
    });
  }
  console.log(`   ${Object.keys(suppliers).length} suppliers created.`);

  // ---- 8. Items ----
  console.log('8. Creating items...');
  const items = {};
  const itemDefs = [
    // Raw Materials
    { partNumber: 'WD-OAK-1x6', description: 'White Oak Board 1"×6"×8\'', type: 'raw_material', unitOfMeasure: 'bd ft', leadTimeDays: 7 },
    { partNumber: 'WD-WAL-1x4', description: 'Black Walnut Board 1"×4"×6\'', type: 'raw_material', unitOfMeasure: 'bd ft', leadTimeDays: 7 },
    { partNumber: 'WD-MAP-2x2', description: 'Hard Maple Turning Blank 2"×2"×24"', type: 'raw_material', unitOfMeasure: 'each', leadTimeDays: 7 },
    { partNumber: 'HW-SCREW-114', description: '#8 Wood Screw 1-1/4" (box of 100)', type: 'purchased_component', unitOfMeasure: 'box', leadTimeDays: 3 },
    { partNumber: 'HW-DOWEL-38', description: 'Hardwood Dowel Pin 3/8"×2"', type: 'purchased_component', unitOfMeasure: 'each', leadTimeDays: 3 },
    { partNumber: 'HW-GLUE-TB3', description: 'Titebond III Wood Glue 16oz', type: 'consumable', unitOfMeasure: 'each', leadTimeDays: 3 },
    { partNumber: 'FN-POLY-QT', description: 'Oil-Based Polyurethane Quart', type: 'consumable', unitOfMeasure: 'each', leadTimeDays: 5 },
    { partNumber: 'FN-SAND-220', description: 'Sandpaper 220 Grit Sheet', type: 'consumable', unitOfMeasure: 'each', leadTimeDays: 3 },
    { partNumber: 'HW-BRACKET-L', description: 'L-Bracket Steel 3"', type: 'purchased_component', unitOfMeasure: 'each', leadTimeDays: 3 },

    // Sub-Assemblies
    { partNumber: 'SA-TBL-TOP', description: 'Glued-Up Table Top Panel (White Oak)', type: 'sub_assembly', unitOfMeasure: 'each', leadTimeDays: 3 },
    { partNumber: 'SA-TBL-LEG', description: 'Turned Table Leg (Hard Maple)', type: 'sub_assembly', unitOfMeasure: 'each', leadTimeDays: 2 },
    { partNumber: 'SA-TBL-APRON', description: 'Table Apron Assembly (Black Walnut)', type: 'sub_assembly', unitOfMeasure: 'each', leadTimeDays: 2 },
    { partNumber: 'SA-SHELF-PNL', description: 'Bookshelf Panel (White Oak)', type: 'sub_assembly', unitOfMeasure: 'each', leadTimeDays: 2 },

    // Finished Goods
    { partNumber: 'FG-DIN-TBL', description: 'Farmhouse Dining Table', type: 'finished_good', unitOfMeasure: 'each', leadTimeDays: 5 },
    { partNumber: 'FG-BOOKSHELF', description: 'Craftsman Bookshelf', type: 'finished_good', unitOfMeasure: 'each', leadTimeDays: 4 },
    { partNumber: 'FG-CUT-BOARD', description: 'End-Grain Cutting Board', type: 'finished_good', unitOfMeasure: 'each', leadTimeDays: 2 },
  ];
  for (const item of itemDefs) {
    items[item.partNumber] = await prisma.item.upsert({
      where: { tenantId_partNumber: { tenantId: tenant.id, partNumber: item.partNumber } },
      update: {},
      create: { tenantId: tenant.id, ...item },
    });
  }
  console.log(`   ${Object.keys(items).length} items created.`);

  // ---- 9. Item-Supplier Links ----
  console.log('9. Linking items to suppliers...');
  const itemSupplierDefs = [
    // Woodcraft Supply — lumber
    { item: 'WD-OAK-1x6', supplier: 'WOOD-SUP', unitCost: 8.50, leadTimeDays: 7, isPreferred: true, supplierPartNumber: 'WC-OAK-1x6-8' },
    { item: 'WD-WAL-1x4', supplier: 'WOOD-SUP', unitCost: 12.75, leadTimeDays: 7, isPreferred: true, supplierPartNumber: 'WC-WAL-1x4-6' },
    { item: 'WD-MAP-2x2', supplier: 'WOOD-SUP', unitCost: 6.00, leadTimeDays: 7, isPreferred: true, supplierPartNumber: 'WC-MAP-BLANK-2x24' },

    // Fastener Depot — hardware
    { item: 'HW-SCREW-114', supplier: 'FAST-DEP', unitCost: 8.99, leadTimeDays: 2, isPreferred: true, supplierPartNumber: 'FD-WS8-125-100' },
    { item: 'HW-DOWEL-38', supplier: 'FAST-DEP', unitCost: 0.15, leadTimeDays: 2, isPreferred: true, supplierPartNumber: 'FD-DP-375-2' },
    { item: 'HW-BRACKET-L', supplier: 'FAST-DEP', unitCost: 1.25, leadTimeDays: 2, isPreferred: true, supplierPartNumber: 'FD-LBR-3' },
    { item: 'HW-GLUE-TB3', supplier: 'FAST-DEP', unitCost: 9.49, leadTimeDays: 2, isPreferred: true, supplierPartNumber: 'FD-TB3-16' },

    // Finishing Solutions — finishes and abrasives
    { item: 'FN-POLY-QT', supplier: 'FIN-SOL', unitCost: 14.99, leadTimeDays: 5, isPreferred: true, supplierPartNumber: 'FS-POLY-OB-QT' },
    { item: 'FN-SAND-220', supplier: 'FIN-SOL', unitCost: 0.65, leadTimeDays: 3, isPreferred: true, supplierPartNumber: 'FS-SP-220-9x11' },

    // Cross-supplier options (gives MRP alternatives)
    { item: 'HW-GLUE-TB3', supplier: 'WOOD-SUP', unitCost: 10.99, leadTimeDays: 7, isPreferred: false, supplierPartNumber: 'WC-GLUE-TB3' },
    { item: 'FN-SAND-220', supplier: 'FAST-DEP', unitCost: 0.75, leadTimeDays: 3, isPreferred: false, supplierPartNumber: 'FD-SP-220' },
  ];
  let linkCount = 0;
  for (const link of itemSupplierDefs) {
    const itemId = items[link.item].id;
    const supplierId = suppliers[link.supplier].id;
    await prisma.itemSupplier.upsert({
      where: { itemId_supplierId: { itemId, supplierId } },
      update: {},
      create: {
        itemId,
        supplierId,
        unitCost: link.unitCost,
        leadTimeDays: link.leadTimeDays,
        isPreferred: link.isPreferred,
        supplierPartNumber: link.supplierPartNumber,
      },
    });
    linkCount++;
  }
  console.log(`   ${linkCount} item-supplier links created.`);

  // ---- 10. BOMs (multi-level) ----
  console.log('10. Creating BOMs...');

  // Helper: create BOM with lines
  const createBom = async (itemPartNumber, revision, lines) => {
    const item = items[itemPartNumber];
    // Check for existing active BOM
    const existing = await prisma.bom.findFirst({
      where: { tenantId: tenant.id, itemId: item.id, revision, status: 'active' },
    });
    if (existing) {
      console.log(`   BOM ${itemPartNumber} rev ${revision} already exists — skipping.`);
      return existing;
    }
    // Also check for draft
    const existingDraft = await prisma.bom.findFirst({
      where: { tenantId: tenant.id, itemId: item.id, revision },
    });
    if (existingDraft) {
      console.log(`   BOM ${itemPartNumber} rev ${revision} already exists — skipping.`);
      return existingDraft;
    }

    const bom = await prisma.bom.create({
      data: {
        tenantId: tenant.id,
        itemId: item.id,
        revision,
        status: 'active',
        effectiveDate: new Date(),
        notes: `Standard BOM for ${item.description}`,
        bomLines: {
          create: lines.map((line, idx) => ({
            itemId: items[line.item].id,
            quantity: line.qty,
            unitOfMeasure: items[line.item].unitOfMeasure,
            position: idx + 1,
            scrapFactor: line.scrap ?? 0,
            notes: line.notes ?? null,
          })),
        },
      },
    });
    return bom;
  };

  // Sub-assembly BOMs (create these first — they're components of finished goods)
  await createBom('SA-TBL-TOP', 'A', [
    { item: 'WD-OAK-1x6', qty: 12, scrap: 0.10, notes: 'Glue-up — allow 10% for jointing waste' },
    { item: 'HW-GLUE-TB3', qty: 1 },
    { item: 'HW-DOWEL-38', qty: 16, notes: 'Alignment dowels for panel glue-up' },
  ]);

  await createBom('SA-TBL-LEG', 'A', [
    { item: 'WD-MAP-2x2', qty: 1, scrap: 0.05, notes: 'Lathe turning — 5% scrap' },
    { item: 'FN-SAND-220', qty: 2, notes: 'Sanding on lathe' },
  ]);

  await createBom('SA-TBL-APRON', 'A', [
    { item: 'WD-WAL-1x4', qty: 6, scrap: 0.08, notes: 'Miter joints — 8% waste' },
    { item: 'HW-SCREW-114', qty: 1, notes: 'Pocket screws for joinery' },
    { item: 'HW-BRACKET-L', qty: 8, notes: 'Corner brackets for rigidity' },
  ]);

  await createBom('SA-SHELF-PNL', 'A', [
    { item: 'WD-OAK-1x6', qty: 6, scrap: 0.10, notes: 'Edge-glued panel — 10% waste' },
    { item: 'HW-GLUE-TB3', qty: 1 },
  ]);

  // Finished goods BOMs
  await createBom('FG-DIN-TBL', 'A', [
    { item: 'SA-TBL-TOP', qty: 1, notes: 'Glued-up top panel' },
    { item: 'SA-TBL-LEG', qty: 4, notes: 'Turned maple legs' },
    { item: 'SA-TBL-APRON', qty: 1, notes: 'Walnut apron frame' },
    { item: 'HW-SCREW-114', qty: 2, notes: 'Tabletop attachment hardware' },
    { item: 'FN-POLY-QT', qty: 2, notes: '3 coats polyurethane' },
    { item: 'FN-SAND-220', qty: 10, notes: 'Between-coat sanding' },
  ]);

  await createBom('FG-BOOKSHELF', 'A', [
    { item: 'SA-SHELF-PNL', qty: 4, notes: '4 shelves including top and bottom' },
    { item: 'WD-WAL-1x4', qty: 8, scrap: 0.08, notes: 'Side panels and dividers' },
    { item: 'HW-SCREW-114', qty: 3 },
    { item: 'HW-DOWEL-38', qty: 24, notes: 'Shelf pin holes' },
    { item: 'FN-POLY-QT', qty: 1 },
    { item: 'FN-SAND-220', qty: 8 },
  ]);

  await createBom('FG-CUT-BOARD', 'A', [
    { item: 'WD-WAL-1x4', qty: 2, scrap: 0.15, notes: 'End-grain strips — high waste from crosscuts' },
    { item: 'WD-MAP-2x2', qty: 2, scrap: 0.15, notes: 'Contrasting end-grain strips' },
    { item: 'HW-GLUE-TB3', qty: 1, notes: 'Waterproof glue for food safety' },
    { item: 'FN-SAND-220', qty: 4, notes: 'Progressive sanding to 220' },
  ]);

  console.log('   7 BOMs created (4 sub-assembly + 3 finished goods).');

  // ---- 11. Inventory Stock ----
  console.log('11. Seeding inventory stock...');
  const stockDefs = [
    { item: 'WD-OAK-1x6', location: 'MAIN-WH', qty: 50 },
    { item: 'WD-WAL-1x4', location: 'MAIN-WH', qty: 30 },
    { item: 'WD-MAP-2x2', location: 'MAIN-WH', qty: 20 },
    { item: 'HW-SCREW-114', location: 'MAIN-WH', qty: 10 },
    { item: 'HW-DOWEL-38', location: 'MAIN-WH', qty: 100 },
    { item: 'HW-GLUE-TB3', location: 'MAIN-WH', qty: 5 },
    { item: 'FN-POLY-QT', location: 'MAIN-WH', qty: 3 },
    { item: 'FN-SAND-220', location: 'MAIN-WH', qty: 25 },
    { item: 'HW-BRACKET-L', location: 'MAIN-WH', qty: 16 },
    // A few sub-assemblies already in stock (simulate prior production)
    { item: 'SA-TBL-LEG', location: 'SHOP-FL', qty: 8 },
    { item: 'SA-SHELF-PNL', location: 'SHOP-FL', qty: 2 },
  ];
  for (const stock of stockDefs) {
    const itemId = items[stock.item].id;
    const locationId = locations[stock.location].id;
    // Prisma doesn't allow null in composite unique for upsert, so find-or-create
    const existing = await prisma.inventoryStock.findFirst({
      where: {
        tenantId: tenant.id,
        itemId,
        locationId,
        lotNumber: null,
        serialNumber: null,
        inventoryStatus: 'available',
      },
    });
    if (existing) {
      await prisma.inventoryStock.update({
        where: { id: existing.id },
        data: { quantityOnHand: stock.qty },
      });
    } else {
      await prisma.inventoryStock.create({
        data: {
          tenantId: tenant.id,
          itemId,
          locationId,
          quantityOnHand: stock.qty,
          inventoryStatus: 'available',
        },
      });
    }
  }
  console.log(`   ${stockDefs.length} stock records created.`);

  // ---- 12. Open Demand Entries (ready for MRP testing) ----
  console.log('12. Creating demand entries...');
  const now = new Date();
  const demandDefs = [
    { item: 'FG-DIN-TBL', qty: 5, daysOut: 30, notes: 'Customer order — Johnson wedding gift (5 tables)' },
    { item: 'FG-BOOKSHELF', qty: 3, daysOut: 45, notes: 'Interior designer order — home office project' },
    { item: 'FG-CUT-BOARD', qty: 10, daysOut: 14, notes: 'Batch for upcoming craft fair' },
  ];
  for (const d of demandDefs) {
    const dateRequired = new Date(now);
    dateRequired.setDate(dateRequired.getDate() + d.daysOut);

    // Skip if demand already exists for this item with same notes
    const existing = await prisma.demandEntry.findFirst({
      where: { tenantId: tenant.id, itemId: items[d.item].id, notes: d.notes },
    });
    if (!existing) {
      await prisma.demandEntry.create({
        data: {
          tenantId: tenant.id,
          itemId: items[d.item].id,
          quantityRequired: d.qty,
          dateRequired,
          source: 'manual',
          status: 'open',
          notes: d.notes,
          createdBy: adminUser.id,
        },
      });
    }
  }
  console.log(`   ${demandDefs.length} demand entries created.`);

  console.log('\nSeed complete! 🪵');
};

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
