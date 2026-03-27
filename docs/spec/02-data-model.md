## 3. Data Model

### Entity Reference

18 entities organized into four layers:

**Foundation:** Tenant, User, Role, Permission (+ join tables UserRole, RolePermission)
**Master Data:** Item, Supplier, ItemSupplier, InventoryLocation
**Inventory:** InventoryStock, InventoryTransaction
**Transactions:** PurchaseOrder, PurchaseOrderLine, PurchaseOrderReceipt, WorkOrder, WorkOrderLine, DemandEntry, MrpRun, MrpResult

### Entity Definitions

#### Tenant

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| id | UUID | yes | auto | Primary key |
| name | String | yes | — | Company name |
| slug | String | yes | — | Unique, URL-safe identifier |
| status | Enum | yes | `trial` | `active`, `suspended`, `trial` |
| plan | Enum | yes | `starter` | Subscription tier (for future billing) |
| createdAt | DateTime | yes | auto | |
| updatedAt | DateTime | yes | auto | |

#### User

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| id | UUID | yes | auto | Primary key |
| tenantId | UUID | yes | — | FK → Tenant |
| email | String | yes | — | Unique per tenant |
| passwordHash | String | yes | — | bcrypt |
| firstName | String | yes | — | |
| lastName | String | yes | — | |
| isActive | Boolean | yes | `true` | Soft disable |
| lastLoginAt | DateTime | no | — | |
| createdAt | DateTime | yes | auto | |
| updatedAt | DateTime | yes | auto | |

**Relationships:** User → many Roles (via UserRole join table)

#### Role

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| id | UUID | yes | auto | Primary key |
| tenantId | UUID | yes | — | FK → Tenant (roles are per-tenant) |
| name | String | yes | — | e.g., "Production Manager" |
| isDefault | Boolean | yes | `false` | True for system-created defaults |
| createdAt | DateTime | yes | auto | |

**Relationships:** Role → many Permissions (via RolePermission join table)

#### Permission

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| id | UUID | yes | auto | Primary key |
| code | String | yes | — | e.g., `bom:write` — globally unique |
| description | String | yes | — | Human-readable |

#### Item

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| id | UUID | yes | auto | Primary key |
| tenantId | UUID | yes | — | FK → Tenant |
| partNumber | String | yes | — | Unique per tenant |
| description | String | yes | — | Human-readable name |
| type | Enum | yes | — | `raw_material`, `purchased_component`, `sub_assembly`, `finished_good`, `consumable` |
| trackingMethod | Enum | yes | `none` | `none`, `lot`, `serial` |
| unitOfMeasure | String | yes | — | e.g., "ea", "ft", "lb", "gal" |
| reorderPoint | Decimal | no | — | Low-stock alert threshold |
| reorderQuantity | Decimal | no | — | Suggested reorder qty |
| leadTimeDays | Integer | no | — | Default supplier lead time |
| isActive | Boolean | yes | `true` | Soft disable, never hard delete |
| createdAt | DateTime | yes | auto | |
| updatedAt | DateTime | yes | auto | |

> **Architecture Note:** The `type` field drives MRP logic. Raw materials and purchased components get purchased (PO suggestions). Sub-assemblies and finished goods get produced (WO suggestions). The `trackingMethod` field determines whether inventory transactions require lot numbers, serial numbers, or neither.

#### Supplier

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| id | UUID | yes | auto | Primary key |
| tenantId | UUID | yes | — | FK → Tenant |
| name | String | yes | — | Company name |
| code | String | no | — | Short code, unique per tenant |
| contactName | String | no | — | |
| contactEmail | String | no | — | |
| contactPhone | String | no | — | |
| address | Text | no | — | Free-form for V1 |
| notes | Text | no | — | |
| isActive | Boolean | yes | `true` | |
| createdAt | DateTime | yes | auto | |
| updatedAt | DateTime | yes | auto | |

#### ItemSupplier

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| id | UUID | yes | auto | Primary key |
| itemId | UUID | yes | — | FK → Item |
| supplierId | UUID | yes | — | FK → Supplier |
| supplierPartNumber | String | no | — | Supplier's own part number |
| unitCost | Decimal | no | — | Price per unit |
| leadTimeDays | Integer | no | — | Overrides Item.leadTimeDays |
| isPreferred | Boolean | yes | `false` | One preferred supplier per item |
| minOrderQuantity | Decimal | no | — | Minimum order qty |
| createdAt | DateTime | yes | auto | |
| updatedAt | DateTime | yes | auto | |

**Constraint:** Unique combination of itemId + supplierId

#### InventoryLocation

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| id | UUID | yes | auto | Primary key |
| tenantId | UUID | yes | — | FK → Tenant |
| name | String | yes | — | e.g., "Warehouse A" |
| code | String | yes | — | Short code, unique per tenant |
| description | Text | no | — | |
| isActive | Boolean | yes | `true` | |
| createdAt | DateTime | yes | auto | |
| updatedAt | DateTime | yes | auto | |

#### InventoryStock

Represents current state — how much of each item is at each location, by lot/serial and status.

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| id | UUID | yes | auto | Primary key |
| tenantId | UUID | yes | — | FK → Tenant |
| itemId | UUID | yes | — | FK → Item |
| locationId | UUID | yes | — | FK → InventoryLocation |
| lotNumber | String | no | — | Required if Item.trackingMethod = `lot` |
| serialNumber | String | no | — | Required if Item.trackingMethod = `serial` |
| inventoryStatus | Enum | yes | `available` | `available`, `allocated`, `issued`, `in_transit`, `quarantine` |
| quantityOnHand | Decimal | yes | 0 | For serial-tracked items, always 0 or 1 |
| createdAt | DateTime | yes | auto | |
| updatedAt | DateTime | yes | auto | |

**Constraints:**
- Unique: `tenantId` + `itemId` + `locationId` + `lotNumber` + `serialNumber` + `inventoryStatus`
- If trackingMethod = `serial`: quantityOnHand must be 0 or 1
- If trackingMethod = `none`: lotNumber and serialNumber must be null

> **Architecture Note:** Each row is like a bin on a shelf: "50 units of Part 1234, Lot A-2024, in Warehouse A, status available." The MRP engine reads available stock to determine what's on hand before generating requirements.

#### InventoryTransaction

Audit trail — every change to inventory is logged.

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| id | UUID | yes | auto | Primary key |
| tenantId | UUID | yes | — | FK → Tenant |
| itemId | UUID | yes | — | FK → Item |
| locationId | UUID | yes | — | FK → InventoryLocation |
| lotNumber | String | no | — | Matches tracking rules from Item |
| serialNumber | String | no | — | Matches tracking rules from Item |
| transactionType | Enum | yes | — | `receipt`, `issue`, `adjustment`, `transfer`, `scrap` |
| quantity | Decimal | yes | — | Positive for adds, negative for removals |
| referenceType | Enum | no | — | `purchase_order`, `work_order`, `manual` |
| referenceId | UUID | no | — | FK → the PO or WO that caused this |
| notes | Text | no | — | |
| performedBy | UUID | yes | — | FK → User |
| performedAt | DateTime | yes | — | When the transaction occurred |
| createdAt | DateTime | yes | auto | |

> **Architecture Note:** Never update stock directly — always create a transaction, which then updates stock. This gives you full auditability. If a count is wrong, trace the transactions to find where it went wrong. This is the manufacturing equivalent of a general ledger.

#### BOM (Header)

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| id | UUID | yes | auto | Primary key |
| tenantId | UUID | yes | — | FK → Tenant |
| itemId | UUID | yes | — | FK → Item (the item this BOM produces) |
| revision | String | yes | — | e.g., "A", "B", "Rev-2" |
| status | Enum | yes | `draft` | `draft`, `active`, `obsolete` |
| effectiveDate | Date | no | — | When this revision becomes active |
| notes | Text | no | — | |
| createdAt | DateTime | yes | auto | |
| updatedAt | DateTime | yes | auto | |

**Constraint:** Only one `active` BOM per item per tenant.

#### BOMLine

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| id | UUID | yes | auto | Primary key |
| bomId | UUID | yes | — | FK → BOM |
| itemId | UUID | yes | — | FK → Item (the component) |
| quantity | Decimal | yes | — | Qty per 1 unit of parent |
| unitOfMeasure | String | yes | — | Should match component item's UOM |
| position | Integer | no | — | Assembly sequence / sort order |
| scrapFactor | Decimal | no | 0 | Expected waste (0.05 = 5%) |
| notes | Text | no | — | |

> **Architecture Note:** Multi-level BOMs work naturally: a BOMLine points to an Item, and that Item can have its own BOM. The MRP engine explodes recursively down the tree. The scrapFactor ensures planning accounts for expected waste.

#### PurchaseOrder (Header)

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| id | UUID | yes | auto | Primary key |
| tenantId | UUID | yes | — | FK → Tenant |
| poNumber | String | yes | — | Auto-generated, unique per tenant. Format: `{prefix}-{sequence}` |
| supplierId | UUID | yes | — | FK → Supplier |
| status | Enum | yes | `draft` | `draft`, `sent`, `partial`, `received`, `cancelled` |
| orderDate | Date | no | — | When the PO was placed |
| expectedDate | Date | no | — | When delivery is expected |
| notes | Text | no | — | |
| createdBy | UUID | yes | — | FK → User |
| createdAt | DateTime | yes | auto | |
| updatedAt | DateTime | yes | auto | |

**Number generation:** Auto-generated. Tenant-configurable prefix (default "PO"), incrementing sequence per tenant. Format: `PO-0001`, `PO-0002`, etc.

#### PurchaseOrderLine

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| id | UUID | yes | auto | Primary key |
| purchaseOrderId | UUID | yes | — | FK → PurchaseOrder |
| itemId | UUID | yes | — | FK → Item |
| quantityOrdered | Decimal | yes | — | |
| quantityReceived | Decimal | yes | 0 | Incremented on receipt |
| unitCost | Decimal | no | — | Price per unit for this line |
| dueDate | Date | no | — | Line-level due date |
| notes | Text | no | — | |
| createdAt | DateTime | yes | auto | |
| updatedAt | DateTime | yes | auto | |

**Status derivation:** PO status is derived from lines — all unreceived = `sent`, some received = `partial`, all received = `received`.

#### PurchaseOrderReceipt

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| id | UUID | yes | auto | Primary key |
| tenantId | UUID | yes | — | FK → Tenant |
| poLineId | UUID | yes | — | FK → PurchaseOrderLine |
| quantityReceived | Decimal | yes | — | Qty received in this receipt |
| locationId | UUID | yes | — | FK → InventoryLocation |
| lotNumber | String | no | — | Required if item is lot-tracked |
| serialNumber | String | no | — | Required if item is serial-tracked |
| receivedBy | UUID | yes | — | FK → User |
| receivedAt | DateTime | yes | — | |
| notes | Text | no | — | |
| createdAt | DateTime | yes | auto | |

**On save triggers:**
1. Update PurchaseOrderLine.quantityReceived
2. Create InventoryTransaction (type: `receipt`, referenceType: `purchase_order`)
3. Update/create InventoryStock for item/location/lot

#### WorkOrder (Header)

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| id | UUID | yes | auto | Primary key |
| tenantId | UUID | yes | — | FK → Tenant |
| woNumber | String | yes | — | Auto-generated, unique per tenant. Format: `{prefix}-{sequence}` |
| bomId | UUID | yes | — | FK → BOM |
| quantity | Decimal | yes | — | How many units to produce |
| status | Enum | yes | `planned` | `planned`, `released`, `in_progress`, `completed`, `cancelled` |
| priority | Integer | yes | 0 | Higher = higher priority |
| scheduledStart | Date | no | — | |
| scheduledEnd | Date | no | — | |
| actualStart | DateTime | no | — | Set on status → `in_progress` |
| actualEnd | DateTime | no | — | Set on status → `completed` |
| notes | Text | no | — | |
| createdBy | UUID | yes | — | FK → User |
| createdAt | DateTime | yes | auto | |
| updatedAt | DateTime | yes | auto | |

**Number generation:** Same pattern as PO. Default prefix "WO". Format: `WO-0001`.

**Valid status transitions:**
```
planned → released → in_progress → completed
  ↓          ↓           ↓
cancelled  cancelled   cancelled (warning if material issued)
```

#### WorkOrderLine

Auto-generated from BOM when work order is created.

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| id | UUID | yes | auto | Primary key |
| workOrderId | UUID | yes | — | FK → WorkOrder |
| itemId | UUID | yes | — | FK → Item (component to consume) |
| quantityRequired | Decimal | yes | — | BOM qty × WO qty × (1 + scrapFactor) |
| quantityIssued | Decimal | yes | 0 | How much pulled from inventory |
| locationId | UUID | no | — | FK → InventoryLocation (where to pull from) |
| lotNumber | String | no | — | Which lot was consumed |
| serialNumber | String | no | — | Which serial was consumed |
| createdAt | DateTime | yes | auto | |
| updatedAt | DateTime | yes | auto | |

**On material issue:** Update quantityIssued, create InventoryTransaction (type: `issue`, referenceType: `work_order`), decrease InventoryStock.

**On WO completion:** Create InventoryTransaction (type: `receipt`, referenceType: `work_order`) for the finished item. Increase InventoryStock.

#### DemandEntry

Input to the MRP engine — manual in V1.

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| id | UUID | yes | auto | Primary key |
| tenantId | UUID | yes | — | FK → Tenant |
| itemId | UUID | yes | — | FK → Item (must be `finished_good` or `sub_assembly`) |
| quantityRequired | Decimal | yes | — | |
| dateRequired | Date | yes | — | |
| source | Enum | yes | `manual` | `manual`, `sales_order` (future) |
| status | Enum | yes | `open` | `open`, `planned`, `fulfilled`, `cancelled` |
| notes | Text | no | — | Customer name, order ref, etc. |
| createdBy | UUID | yes | — | FK → User |
| createdAt | DateTime | yes | auto | |
| updatedAt | DateTime | yes | auto | |

#### MrpRun

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| id | UUID | yes | auto | Primary key |
| tenantId | UUID | yes | — | FK → Tenant |
| status | Enum | yes | — | `running`, `completed`, `failed` |
| ranBy | UUID | yes | — | FK → User |
| ranAt | DateTime | yes | — | |
| completedAt | DateTime | no | — | |
| parameters | JSON | no | — | Snapshot of inputs (planning horizon, etc.) |
| createdAt | DateTime | yes | auto | |

#### MrpResult

Each line is a recommendation from the MRP engine.

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| id | UUID | yes | auto | Primary key |
| mrpRunId | UUID | yes | — | FK → MrpRun |
| itemId | UUID | yes | — | FK → Item |
| actionType | Enum | yes | — | `purchase`, `produce` |
| quantityNeeded | Decimal | yes | — | Net requirement |
| dateNeeded | Date | yes | — | When it must be available |
| suggestedOrderDate | Date | yes | — | dateNeeded minus lead time |
| supplierId | UUID | no | — | FK → Supplier (preferred, for `purchase` actions) |
| status | Enum | yes | `suggested` | `suggested`, `converted`, `dismissed` |
| convertedToId | UUID | no | — | FK → PO or WO once acted on |
| convertedToType | Enum | no | — | `purchase_order` or `work_order` |
| createdAt | DateTime | yes | auto | |

> **Architecture Note:** The MRP engine creates suggestions, not orders. The planner reviews and converts approved suggestions into real POs and work orders. Automatic order creation without human review is dangerous in manufacturing.

### Entity Relationship Map

```
Tenant
 ├── User ←→ Role ←→ Permission
 ├── Item ←→ ItemSupplier ←→ Supplier
 ├── BOM → BOMLine → Item
 ├── InventoryLocation
 ├── InventoryStock (Item + Location + Lot/Serial + Status)
 ├── InventoryTransaction
 ├── PurchaseOrder → POLine → POReceipt
 ├── WorkOrder → WOLine
 ├── DemandEntry
 └── MrpRun → MrpResult
```
