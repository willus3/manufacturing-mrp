# Manufacturing MRP System — Build Specification

**Version:** 1.0
**Date:** 2026-03-22
**Stage:** Prototype
**Mode:** Learner (includes Architecture Notes)

---

## Table of Contents

1. [Project Overview & Goals](#1-project-overview--goals)
2. [Users & Roles](#2-users--roles)
3. [Data Model](#3-data-model)
4. [Auth & Authorization](#4-auth--authorization)
5. [Pages, Routes & Navigation](#5-pages-routes--navigation)
6. [Component Architecture](#6-component-architecture)
7. [State Management](#7-state-management)
8. [API / Service Layer](#8-api--service-layer)
9. [Error Handling](#9-error-handling)
10. [Third-Party Integrations](#10-third-party-integrations)
11. [Deployment & Environment](#11-deployment--environment)
12. [Feature Build Order](#12-feature-build-order)
13. [Code Quality Standards](#13-code-quality-standards)
14. [Phase 2 Roadmap](#14-phase-2-roadmap)

---

## 1. Project Overview & Goals

### Problem Statement
Small to medium manufacturers (5–250 employees) are underserved by the MRP/ERP market. Enterprise solutions (Oracle, SAP) cost $100K+ and are designed for large organizations. SMB manufacturers run on spreadsheets, tribal knowledge, and manual processes — leading to stockouts, missed ship dates, overbuying, and inability to scale.

### Solution
A cloud-hosted, multi-tenant SaaS MRP platform that gives SMB manufacturers planning and operational visibility at an affordable price point. Industry-agnostic. Commercially sold via tiered subscription by user count.

### Project Stage
**Prototype** — clean but not hardened. Code quality is "professional but pragmatic." Accessibility (WCAG 2.1 AA) is non-negotiable even at prototype stage. Advanced security hardening, comprehensive input validation, and rate limiting are deferred to production hardening.

### Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Database | PostgreSQL | Manufacturing data is deeply relational (BOMs, POs, WOs, inventory transactions). Foreign keys, joins, and transactions are essential. |
| ORM | Prisma | Schema-driven, auto-generates client, handles migrations. Friendlier than raw SQL. |
| Backend | Node.js + Express | Minimal, well-documented, largest ecosystem. |
| Frontend | React (via Vite) | Massive ecosystem, mature component libraries for data-dense UIs. |
| CSS | Tailwind CSS | Utility-first, fast to build, no style conflicts. |
| Component Library | Shadcn/ui | Accessible components (Radix-based) copied into project — full ownership. |
| Data Tables | TanStack Table | Industry standard for sortable, filterable, paginated tables. |
| Forms | React Hook Form + Zod | Lightweight form management + schema-based validation. |
| Icons | Lucide React | Clean, consistent. Ships with Shadcn. |
| Server State | TanStack Query | Fetching, caching, background refetching, loading/error states. |
| Local Dev DB | Docker Compose | Portable, reproducible, no permanent install. |
| Backend Hosting | Railway | Git-push deploys, managed Postgres, $5–20/month at prototype scale. |
| Frontend Hosting | Vercel | Free tier, global CDN, purpose-built for React. |

> **Architecture Note:** Why PostgreSQL over MongoDB? BOMs have parent/child hierarchies, POs reference suppliers and items, work orders reference BOMs and consume inventory. These are relationships, and relational databases are literally named for handling them. MongoDB can do this, but you'd be fighting the tool.

> **Architecture Note:** Why Shadcn instead of Material UI or Ant Design? MUI and Ant are full frameworks that control everything. Shadcn gives you the same quality components as your own code — you can modify any component directly. For custom things like BOM tree views and MRP result tables, that flexibility matters.

### Success Metrics (V1)
- A shop can fully replace their spreadsheet-based planning workflow
- Users can answer "Do we have enough material to run?" in real time
- Purchase orders and work orders are generated from the MRP engine rather than manually
- A new shop can onboard and be operational within a single work day

### Timeline & Constraints
- No hard deadline — iterative build
- Self-funded, cost-conscious
- Prototype acceptable as first milestone

---

## 2. Users & Roles

### Tenancy Model
**Soft multi-tenancy** — all tenants share one database. Every table has a `tenantId` column. Tenant isolation is enforced at the middleware layer so individual queries never filter by tenant manually.

> **Architecture Note:** Think of tenantId like a factory badge. Every piece of data wears a badge saying which shop it belongs to. The middleware automatically filters everything to the logged-in user's shop. The alternative — separate databases per shop — is safer but far more expensive to maintain at this stage.

### Permission-Based RBAC

Roles are bundles of permissions. Users can be assigned multiple roles and receive the union of all permissions.

#### Permissions

| Code | Description |
|------|-------------|
| `bom:read` | View BOMs |
| `bom:write` | Create/edit BOMs |
| `bom:delete` | Delete/archive BOMs |
| `inventory:read` | View inventory levels |
| `inventory:write` | Perform transactions (receipts, adjustments, transfers) |
| `item:read` | View item master |
| `item:write` | Create/edit items |
| `po:read` | View purchase orders |
| `po:write` | Create/edit POs |
| `po:receive` | Receive against POs |
| `supplier:read` | View suppliers |
| `supplier:write` | Create/edit suppliers |
| `workorder:read` | View work orders |
| `workorder:write` | Create/edit work orders |
| `workorder:status` | Update work order status |
| `mrp:run` | Execute MRP calculation and manage demand |
| `users:manage` | Create/edit/deactivate users within the tenant |
| `settings:manage` | Configure tenant settings |

#### Default Roles

| Role | Permissions |
|------|------------|
| **Admin** | All permissions |
| **Production Manager** | `bom:read`, `bom:write`, `workorder:read`, `workorder:write`, `workorder:status`, `inventory:read`, `mrp:run`, `po:read`, `item:read`, `item:write` |
| **Purchasing Agent** | `po:read`, `po:write`, `po:receive`, `supplier:read`, `supplier:write`, `inventory:read`, `bom:read`, `item:read`, `item:write` |
| **Shop Floor Supervisor** | `workorder:read`, `workorder:status`, `bom:read`, `inventory:read`, `item:read` |
| **Inventory Clerk** | `inventory:read`, `inventory:write`, `item:read`, `bom:read` |

Admins can create custom roles and assign individual permissions. Default roles cannot be edited but can be cloned and customized.

### System Admin (Super-User)
Exists outside the tenant model. This is the SaaS operator.

| Capability | Description |
|-----------|-------------|
| Provision new tenants | Create a new shop account with initial admin user |
| Manage tenant status | Activate, suspend |
| View across tenants | Support and debugging access |
| Impersonate tenant admin | Log in as a shop's admin for support |

---

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

---

## 4. Auth & Authorization

### Authentication

| Decision | Choice |
|----------|--------|
| Method | Email + password |
| Password hashing | bcrypt (12 rounds) |
| Session handling | JWT |
| Access token expiry | 1 hour |
| Refresh token expiry | 7 days |
| Password policy | Minimum 8 characters (strengthen for production) |
| Password reset | Not in V1 — admin resets manually via user management |

### JWT Payload

```json
{
  "userId": "uuid",
  "tenantId": "uuid",
  "permissions": ["bom:read", "bom:write", "..."]
}
```

### Tenant Identification at Login

Tenant selector on a single login page (prototype). User enters email, system resolves tenant(s). If multiple tenants, user selects. Migrate to subdomain-based (`acme.app.com`) for production.

### Authorization Flow

Every API request passes through this middleware chain:

1. **Authenticate:** Validate JWT → extract userId, tenantId, permissions. Reject with 401 if invalid/expired.
2. **Scope tenant:** Inject tenantId filter into all database queries. This happens at the middleware level — route handlers never filter by tenant manually.
3. **Check permission:** Verify the user has the required permission for the requested action. Reject with 403 if insufficient.

> **Architecture Note:** Tenant scoping at the middleware level is the single most important security decision. Like a lens filter on a camera — once it's on, everything is filtered to that tenant. No developer can accidentally forget it.

### Token Refresh Flow

1. Access token expires (1 hour)
2. Frontend detects 401 response
3. Automatically sends refresh token to `/auth/refresh`
4. Receives new access token + refresh token
5. Retries the original request
6. If refresh fails → redirect to login

---

## 5. Pages, Routes & Navigation

### Layout

Sidebar + top bar shell:

```
┌──────────────────────────────────────────────┐
│  Top Bar: App name | Tenant name | User menu │
├────────┬─────────────────────────────────────┤
│        │                                     │
│  Side  │          Main Content               │
│  Nav   │                                     │
│        │                                     │
│  Items │                                     │
│  BOMs  │                                     │
│  Inv.  │                                     │
│  POs   │                                     │
│  Work  │                                     │
│  MRP   │                                     │
│        │                                     │
│ ────── │                                     │
│ Admin  │                                     │
│        │                                     │
└────────┴─────────────────────────────────────┘
```

Admin section visible only to users with `users:manage` or `settings:manage` permissions.

### Route Table

| Route | Page | Data Required | Key Actions | Permission |
|-------|------|---------------|-------------|------------|
| `/login` | Login | — | Email/password submit, tenant select | Public |
| `/` | Dashboard | Summary counts, alerts | Navigate to modules | Any authenticated |
| **Items** | | | | |
| `/items` | Item List | Paginated items | Create, CSV import, filter by type | `item:read` |
| `/items/new` | Create Item | Empty form | Save | `item:write` |
| `/items/:id` | Item Detail | Item + suppliers + inventory + BOMs | Edit, deactivate | `item:read` |
| **BOMs** | | | | |
| `/boms` | BOM List | Paginated BOMs | Create, filter by status/item | `bom:read` |
| `/boms/new` | Create BOM | Item selector, empty lines | Add lines, save | `bom:write` |
| `/boms/:id` | BOM Detail | Header + lines + tree | Edit, status change, revise | `bom:read` |
| **Inventory** | | | | |
| `/inventory` | Stock Overview | Stock by item/location/lot/status | Filter, search | `inventory:read` |
| `/inventory/transactions` | Transaction Log | Filterable history | Filter by date/type/item | `inventory:read` |
| `/inventory/adjust` | Adjustment Form | Item/location selector | Create adjustment | `inventory:write` |
| `/inventory/transfer` | Transfer Form | From/to location | Move stock | `inventory:write` |
| `/inventory/locations` | Location List | All locations | Create, edit, deactivate | `inventory:write` |
| **Suppliers** | | | | |
| `/suppliers` | Supplier List | Paginated suppliers | Create, CSV import | `supplier:read` |
| `/suppliers/new` | Create Supplier | Empty form | Save | `supplier:write` |
| `/suppliers/:id` | Supplier Detail | Supplier + items + PO history | Edit, deactivate | `supplier:read` |
| **Purchase Orders** | | | | |
| `/purchase-orders` | PO List | Paginated POs | Create, filter by status/supplier | `po:read` |
| `/purchase-orders/new` | Create PO | Supplier selector, line table | Add lines, save, send | `po:write` |
| `/purchase-orders/:id` | PO Detail | Header + lines + receipts | Edit, receive, cancel | `po:read` |
| `/purchase-orders/:id/receive` | Receive Form | Open lines with qty remaining | Enter qty, location, lot/serial | `po:receive` |
| **Work Orders** | | | | |
| `/work-orders` | WO List | Paginated WOs | Create, filter by status/priority | `workorder:read` |
| `/work-orders/new` | Create WO | BOM selector, qty, schedule | Save | `workorder:write` |
| `/work-orders/:id` | WO Detail | Header + material lines | Edit, status change, issue material | `workorder:read` |
| **MRP** | | | | |
| `/mrp/demand` | Demand List | Open demand entries | Create, edit, cancel | `mrp:run` |
| `/mrp/demand/new` | Create Demand | Item selector, qty, date | Save | `mrp:run` |
| `/mrp/run` | Run MRP | Parameters | Execute calculation | `mrp:run` |
| `/mrp/results/:runId` | MRP Results | Suggestions | Convert to PO/WO, dismiss | `mrp:run` |
| **Admin** | | | | |
| `/admin/users` | User List | All tenant users | Create, edit, deactivate | `users:manage` |
| `/admin/users/new` | Create User | Empty form + role selector | Save | `users:manage` |
| `/admin/users/:id` | User Detail | User info + roles | Edit, assign roles, deactivate | `users:manage` |
| `/admin/roles` | Role List | Roles + permissions | Create custom, edit | `users:manage` |
| `/admin/settings` | Tenant Settings | Company info, defaults | Save | `settings:manage` |
| **Super Admin** | | | | |
| `/super/tenants` | Tenant List | All shops | Create, suspend, activate | Super admin only |
| `/super/tenants/:id` | Tenant Detail | Shop info, user count | Edit, impersonate | Super admin only |

### Dashboard Content

- Low stock alerts (items below reorder point)
- Open POs by status, overdue flagged
- Work orders by status, in-progress count
- Open demand entries (unfulfilled)
- Last MRP run summary, unconverted suggestions count

Each card links to its respective module.

---

## 6. Component Architecture

### Shared Components

| Component | Usage | Notes |
|-----------|-------|-------|
| `<DataTable>` | Every list page | Wraps TanStack Table: pagination, search, column sorting, consistent styling |
| `<PageHeader>` | Top of every page | Title, breadcrumb, primary action button |
| `<FormField>` | Every form | Label + input + validation error |
| `<SelectField>` | Dropdowns | Searchable select for large lists (item picker, supplier picker) |
| `<StatusBadge>` | PO/WO/inventory status | Color-coded pill per status |
| `<ConfirmDialog>` | Destructive actions | Modal: "Are you sure?" |
| `<EmptyState>` | Any list with no data | Message + call-to-action |
| `<LoadingState>` | Async data fetch | Skeleton loader matching layout |
| `<CSVImport>` | Items, suppliers, inventory | File upload, column mapping, preview, confirm |
| `<DetailPanel>` | Item/supplier detail | Two-column: info left, related data (tabs) right |

### Module-Specific Components

| Component | Module |
|-----------|--------|
| `<BOMTreeView>` | BOMs — expandable multi-level tree |
| `<BOMLineEditor>` | BOM create/edit — inline table editor |
| `<POLineEditor>` | PO create/edit — line item table |
| `<WOLineTable>` | WO detail — required vs. issued material |
| `<ReceiveForm>` | PO receiving — per-line qty with lot/serial |
| `<MRPResultsTable>` | MRP results — grouped by action, bulk convert |
| `<InventoryByLocation>` | Inventory — grouped item → location → lot |
| `<StockAlertCard>` | Dashboard — low stock items |

### Design Tokens

| Token | Value |
|-------|-------|
| Primary color | Blue (exact shade TBD) |
| Destructive | Red |
| Success | Green |
| Warning | Amber |
| Neutral | Slate/Gray |
| Font | Inter |
| Base font size | 14px |
| Border radius | 6px |
| Spacing scale | 4px base (4, 8, 12, 16, 24, 32, 48) |

---

## 7. State Management

### Data Fetching

| Decision | Choice |
|----------|--------|
| Server state | TanStack Query (React Query) |
| Client state | React Context (minimal — sidebar, auth session) |
| URL state | Search params (filters, sort, pagination, active tab) |

### Caching & Staleness

| Data Type | Stale Time | Refetch On |
|-----------|-----------|------------|
| Item master, suppliers, BOMs | 5 minutes | Window focus |
| Inventory stock levels | 30 seconds | Window focus + interval |
| PO list, WO list | 1 minute | Window focus |
| MRP results | No cache | Manual refetch only |
| Current user / permissions | Session lifetime | Login only |

### State Location

| State | Location |
|-------|----------|
| Server data (all entities) | TanStack Query cache |
| Current user session | React Context |
| Table filters & sort | URL search params |
| Pagination | URL search params |
| Active tab on detail pages | URL search params |
| Sidebar collapsed | Local state (useState) |
| Form draft in progress | React Hook Form (local) |

### Loading / Error / Empty States

| State | Display |
|-------|---------|
| Loading (first) | Skeleton loader matching layout |
| Loading (refetch) | Silent — data updates in background |
| Error | Inline message with retry button |
| Empty | Friendly message + call-to-action |
| Stale | Show cached data + "Last updated" indicator |

### Real-Time

No WebSockets in V1. TanStack Query background refetching provides "near real-time." True real-time is Phase 2.

---

## 8. API / Service Layer

### Conventions

| Decision | Choice |
|----------|--------|
| Style | REST |
| Base URL | `/api/v1` |
| Auth | Bearer token in Authorization header |
| Tenant scoping | Extracted from JWT (not URL) |
| Response format | `{ data, meta, error }` |
| Pagination | `?page=1&pageSize=25` → `meta: { total, page, pageSize, totalPages }` |
| Filtering | Query params: `?status=active&type=raw_material` |
| Sorting | `?sort=partNumber&order=asc` |

### Response Shapes

**Success (single):**
```json
{ "data": { ... }, "meta": null, "error": null }
```

**Success (list):**
```json
{ "data": [ ... ], "meta": { "total": 142, "page": 1, "pageSize": 25, "totalPages": 6 }, "error": null }
```

**Error:**
```json
{ "data": null, "meta": null, "error": { "code": "ITEM_NOT_FOUND", "message": "..." } }
```

### Endpoints

#### Auth
| Method | Endpoint | Input | Returns | Errors |
|--------|----------|-------|---------|--------|
| POST | `/auth/login` | `{ email, password, tenantSlug }` | `{ accessToken, refreshToken, user }` | 401 |
| POST | `/auth/refresh` | `{ refreshToken }` | `{ accessToken, refreshToken }` | 401 |
| POST | `/auth/logout` | — | `{ success: true }` | — |
| GET | `/auth/me` | — | Current user + permissions | 401 |

#### Items
| Method | Endpoint | Input | Returns | Errors |
|--------|----------|-------|---------|--------|
| GET | `/items` | Query: type, search, isActive, page, pageSize, sort, order | Paginated list | — |
| GET | `/items/:id` | — | Item + suppliers + inventory + BOMs | 404 |
| POST | `/items` | Item fields | Created item | 400, 409 duplicate partNumber |
| PUT | `/items/:id` | Item fields | Updated item | 400, 404 |
| PATCH | `/items/:id/deactivate` | — | Deactivated item | 404 |
| POST | `/items/import` | CSV file | `{ imported, skipped, errors }` | 400 |

#### BOMs
| Method | Endpoint | Input | Returns | Errors |
|--------|----------|-------|---------|--------|
| GET | `/boms` | Query: itemId, status, page, pageSize | Paginated list | — |
| GET | `/boms/:id` | — | Header + lines + tree | 404 |
| GET | `/boms/:id/tree` | — | Full multi-level exploded tree | 404, 400 circular ref |
| POST | `/boms` | Header + lines | Created BOM | 400, 409 active exists |
| PUT | `/boms/:id` | Header + lines | Updated BOM | 400, 404 |
| PATCH | `/boms/:id/status` | `{ status }` | Updated | 400 invalid transition |
| POST | `/boms/:id/revise` | — | New revision, old → obsolete | 404 |

#### Inventory
| Method | Endpoint | Input | Returns | Errors |
|--------|----------|-------|---------|--------|
| GET | `/inventory/stock` | Query: itemId, locationId, status, page, pageSize | Paginated stock | — |
| GET | `/inventory/stock/summary` | Query: itemId | Aggregated per item | — |
| GET | `/inventory/transactions` | Query: itemId, locationId, type, dateFrom, dateTo, page, pageSize | Paginated log | — |
| POST | `/inventory/adjust` | `{ itemId, locationId, quantity, lotNumber?, serialNumber?, notes }` | Transaction + stock | 400 |
| POST | `/inventory/transfer` | `{ itemId, fromLocationId, toLocationId, quantity, lotNumber?, serialNumber? }` | Two transactions + stock | 400 insufficient |

#### Locations
| Method | Endpoint | Input | Returns | Errors |
|--------|----------|-------|---------|--------|
| GET | `/locations` | Query: search, isActive | All locations | — |
| POST | `/locations` | Fields | Created | 400, 409 |
| PUT | `/locations/:id` | Fields | Updated | 400, 404 |
| PATCH | `/locations/:id/deactivate` | — | Deactivated | 404, 400 has stock |

#### Suppliers
| Method | Endpoint | Input | Returns | Errors |
|--------|----------|-------|---------|--------|
| GET | `/suppliers` | Query: search, isActive, page, pageSize | Paginated list | — |
| GET | `/suppliers/:id` | — | Supplier + items + POs | 404 |
| POST | `/suppliers` | Fields | Created | 400, 409 |
| PUT | `/suppliers/:id` | Fields | Updated | 400, 404 |
| PATCH | `/suppliers/:id/deactivate` | — | Deactivated | 404 |
| POST | `/suppliers/import` | CSV file | Import result | 400 |

#### Item-Supplier Links
| Method | Endpoint | Input | Returns | Errors |
|--------|----------|-------|---------|--------|
| GET | `/items/:itemId/suppliers` | — | Linked suppliers | 404 |
| POST | `/items/:itemId/suppliers` | `{ supplierId, unitCost, leadTimeDays, ... }` | Created link | 400, 409 |
| PUT | `/items/:itemId/suppliers/:supplierId` | Fields | Updated | 404 |
| DELETE | `/items/:itemId/suppliers/:supplierId` | — | Removed | 404 |

#### Purchase Orders
| Method | Endpoint | Input | Returns | Errors |
|--------|----------|-------|---------|--------|
| GET | `/purchase-orders` | Query: status, supplierId, page, pageSize, sort, order | Paginated list | — |
| GET | `/purchase-orders/:id` | — | Header + lines + receipts | 404 |
| POST | `/purchase-orders` | Header + lines | Created PO (draft) | 400 |
| PUT | `/purchase-orders/:id` | Header + lines | Updated | 400, 404 |
| PATCH | `/purchase-orders/:id/send` | — | Status → sent | 404, 400 |
| PATCH | `/purchase-orders/:id/cancel` | — | Status → cancelled | 404, 400 |
| POST | `/purchase-orders/:id/receive` | `{ lines: [{ poLineId, quantity, locationId, lotNumber?, serialNumber? }] }` | Receipts + inventory | 400 |

#### Work Orders
| Method | Endpoint | Input | Returns | Errors |
|--------|----------|-------|---------|--------|
| GET | `/work-orders` | Query: status, priority, page, pageSize, sort, order | Paginated list | — |
| GET | `/work-orders/:id` | — | Header + lines | 404 |
| POST | `/work-orders` | `{ bomId, quantity, priority, scheduledStart?, scheduledEnd? }` | Created WO + material lines | 400 |
| PUT | `/work-orders/:id` | Fields | Updated | 400, 404 |
| PATCH | `/work-orders/:id/status` | `{ status }` | Updated. On `completed`: inventory receipt for finished item | 400, 404 |
| POST | `/work-orders/:id/issue` | `{ lines: [{ woLineId, quantity, locationId, lotNumber?, serialNumber? }] }` | Material issued + inventory | 400 |

#### MRP
| Method | Endpoint | Input | Returns | Errors |
|--------|----------|-------|---------|--------|
| GET | `/mrp/demand` | Query: status, itemId, page, pageSize | Paginated demand | — |
| POST | `/mrp/demand` | `{ itemId, quantityRequired, dateRequired, notes? }` | Created | 400 |
| PUT | `/mrp/demand/:id` | Fields | Updated | 400, 404 |
| PATCH | `/mrp/demand/:id/cancel` | — | Cancelled | 404 |
| POST | `/mrp/run` | `{ planningHorizonDays? }` | Run + results | 400 no demand |
| GET | `/mrp/runs` | Query: page, pageSize | Run history | — |
| GET | `/mrp/runs/:id/results` | Query: actionType, status | Result lines | 404 |
| POST | `/mrp/runs/:id/results/:resultId/convert` | — | Created PO or WO | 400, 404 |
| PATCH | `/mrp/runs/:id/results/:resultId/dismiss` | — | Dismissed | 404 |

#### Admin
| Method | Endpoint | Input | Returns | Errors |
|--------|----------|-------|---------|--------|
| GET | `/admin/users` | Query: search, isActive | User list + roles | — |
| POST | `/admin/users` | `{ email, firstName, lastName, password, roleIds }` | Created | 400, 409 |
| PUT | `/admin/users/:id` | Fields | Updated | 400, 404 |
| PATCH | `/admin/users/:id/deactivate` | — | Deactivated | 404, 400 self |
| GET | `/admin/roles` | — | Roles + permissions | — |
| POST | `/admin/roles` | `{ name, permissionIds }` | Created role | 400 |
| PUT | `/admin/roles/:id` | Fields | Updated | 400, 404 |
| GET | `/admin/permissions` | — | All permissions | — |

#### Super Admin
| Method | Endpoint | Input | Returns | Errors |
|--------|----------|-------|---------|--------|
| GET | `/super/tenants` | Query: search, status | All tenants | — |
| POST | `/super/tenants` | `{ name, slug, adminEmail, adminPassword }` | Tenant + admin | 400, 409 |
| PUT | `/super/tenants/:id` | Fields | Updated | 400, 404 |
| PATCH | `/super/tenants/:id/suspend` | — | Suspended | 404 |
| PATCH | `/super/tenants/:id/activate` | — | Activated | 404 |
| POST | `/super/tenants/:id/impersonate` | — | Admin JWT | 404 |

---

## 9. Error Handling

### Validation Strategy

| Layer | What | How |
|-------|------|-----|
| Client-side | Required fields, format, min/max | Zod + React Hook Form (blur + submit) |
| Server-side | Same rules + business logic | Zod on request body, business rules in service layer |
| Database | Last-line constraints | Unique indexes, FKs, not-null via Prisma |

### Error Display

| Type | Display |
|------|---------|
| Field validation | Inline below field, red text |
| Form-level | Alert banner at top of form |
| Action success | Toast (green, auto-dismiss 3s) |
| Action failure | Toast (red, manual dismiss) |
| Permission denied | Toast + redirect |
| Not found | Full page with back button |
| Network error | Toast with retry button |
| Unexpected error | Toast: "Something went wrong. Try again or contact support." |

### Error Codes

| Code | HTTP | Meaning |
|------|------|---------|
| `VALIDATION_ERROR` | 400 | Schema validation failed |
| `DUPLICATE_ENTRY` | 409 | Unique constraint violated |
| `NOT_FOUND` | 404 | Entity doesn't exist |
| `INVALID_TRANSITION` | 400 | Status change not allowed |
| `INSUFFICIENT_STOCK` | 400 | Not enough inventory |
| `UNAUTHORIZED` | 401 | Not logged in / token expired |
| `FORBIDDEN` | 403 | Lacks permission |
| `REFERENCE_CONFLICT` | 400 | Can't deactivate — dependencies exist |
| `INTERNAL_ERROR` | 500 | Unexpected failure |

### Logging (Server)

| What | Details |
|------|---------|
| Every API request | timestamp, method, path, userId, tenantId, duration, status |
| Errors | + error code, message, stack (5xx only) |
| MRP runs | parameters, counts, duration, result count |
| Auth events | login success/fail, refresh, logout |

Prototype: log to stdout. Production: pipe to logging service.

### Retry & Timeout

| Scenario | Behavior |
|----------|----------|
| API timeout | 30s. Network error toast with retry. |
| Failed mutation | No auto-retry. Show error, manual retry. |
| Failed query | 3 retries, exponential backoff (1s, 2s, 4s). Then error state. |
| Token expired | Auto-refresh. If fails, redirect to login. |

---

## 10. Third-Party Integrations

**SKIPPED** — V1 is a standalone system. No external integrations. Integrations (accounting, e-commerce, barcode hardware) are Phase 2+.

---

## 11. Deployment & Environment

### Hosting

| Component | Platform | Cost |
|-----------|----------|------|
| Backend (Node/Express) | Railway | $5–20/month |
| Database (PostgreSQL) | Railway (managed) | Included |
| Frontend (React) | Vercel | Free tier |

### Local Development

Docker Compose for PostgreSQL. One command: `docker-compose up`.

### Environment Variables

**Backend (.env):**

| Variable | Example | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | `postgresql://user:pass@host:5432/mrp` | Prisma connection |
| `JWT_SECRET` | random 64-char string | Signs access tokens |
| `JWT_REFRESH_SECRET` | different random 64-char string | Signs refresh tokens |
| `JWT_EXPIRY` | `1h` | Access token lifetime |
| `JWT_REFRESH_EXPIRY` | `7d` | Refresh token lifetime |
| `PORT` | `3000` | Server port |
| `NODE_ENV` | `development` / `production` | Logging, error detail |
| `CORS_ORIGIN` | `https://app.vercel.app` | Allowed frontend origin |
| `BCRYPT_ROUNDS` | `12` | Password hashing cost |

**Frontend (.env):**

| Variable | Example | Purpose |
|----------|---------|---------|
| `VITE_API_URL` | `https://api.railway.app/api/v1` | Backend base URL |

### Deploy Pipeline

```
Push to main → Railway auto-deploys backend → Vercel auto-deploys frontend
Railway build: npx prisma migrate deploy && node dist/server.js
```

### Environments

| Environment | Database |
|-------------|----------|
| Local dev | Docker Compose Postgres |
| Production | Railway managed Postgres |

Staging deferred to Phase 2.

### Seed Data

Run via `npx prisma db seed`:
- All 17 permissions
- 5 default roles with permission assignments
- Super admin user account
- One test tenant with admin user (dev only)

---

## 12. Feature Build Order

### Phase 0 — Foundation

| # | Feature | Dependencies |
|---|---------|-------------|
| 0.1 | Project setup: Git, Docker Compose, Express, Prisma, Vite + React, Tailwind + Shadcn | None |
| 0.2 | Database schema: all 18 entities in Prisma, initial migration | 0.1 |
| 0.3 | Auth system: login/logout, JWT issue/verify, refresh, auth middleware, tenant scoping | 0.2 |
| 0.4 | RBAC middleware: permission checks, seed permissions and roles | 0.3 |
| 0.5 | App shell UI: sidebar, top bar, routing, auth context, protected routes, login page | 0.3 |
| 0.6 | Seed script: super admin, test tenant, tenant admin, default roles | 0.4 |

**Review gate:** Log in, see app shell, redirect when unauthenticated.

### Phase 1 — Master Data

| # | Feature | Dependencies |
|---|---------|-------------|
| 1.1 | Item Master: CRUD API + pages, CSV import, search/filter | 0.5 |
| 1.2 | Inventory Locations: CRUD API + pages | 0.5 |
| 1.3 | Supplier Master: CRUD API + pages, CSV import | 0.5 |
| 1.4 | Item-Supplier Links: API + UI on item detail (suppliers tab) | 1.1, 1.3 |

**Review gate:** Create items, locations, suppliers. Link suppliers to items. CSV import works.

### Phase 2 — BOM Management

| # | Feature | Dependencies |
|---|---------|-------------|
| 2.1 | BOM CRUD: header + line editor, status management | 1.1 |
| 2.2 | BOM Tree View: multi-level visualization | 2.1 |
| 2.3 | BOM Revision: create new revision, auto-obsolete previous | 2.1 |

**Review gate:** Multi-level BOMs, tree view, revisions, one active per item enforced.

### Phase 3 — Inventory Control

| # | Feature | Dependencies |
|---|---------|-------------|
| 3.1 | Stock Overview: filterable by item/location/status, grouped display | 1.1, 1.2 |
| 3.2 | Inventory Adjustments: form + API, lot/serial handling | 3.1 |
| 3.3 | Inventory Transfers: between locations, paired transactions | 3.1 |
| 3.4 | Transaction Log: filterable history | 3.2 |
| 3.5 | CSV Inventory Import: bulk initial stock with location/lot data | 3.1 |

**Review gate:** Full inventory visibility, adjustments, transfers, transaction audit trail, CSV import.

### Phase 4 — Purchase Orders

| # | Feature | Dependencies |
|---|---------|-------------|
| 4.1 | PO CRUD: header + line editor, auto-fill from ItemSupplier | 1.3, 1.4 |
| 4.2 | PO Status Flow: draft → sent → partial → received → cancelled | 4.1 |
| 4.3 | PO Receiving: per-line receipt, location/lot/serial, inventory transactions | 4.1, 3.2 |

**Review gate:** Full PO lifecycle. Receiving increases inventory with traceability.

### Phase 5 — Work Orders

| # | Feature | Dependencies |
|---|---------|-------------|
| 5.1 | WO CRUD: create from BOM, auto-generate material lines | 2.1 |
| 5.2 | WO Status Flow: planned → released → in_progress → completed | 5.1 |
| 5.3 | Material Issue: issue from inventory to WO lines, lot/serial | 5.1, 3.2 |
| 5.4 | WO Completion: inventory receipt for finished item | 5.3 |

**Review gate:** Full production cycle. Material consumed, finished goods produced, full traceability.

### Phase 6 — MRP Engine

| # | Feature | Dependencies |
|---|---------|-------------|
| 6.1 | Demand Entry: manual CRUD | 1.1 |
| 6.2 | MRP Calculation: BOM explosion, net requirements, lead time offset | 6.1, 2.1, 3.1, 4.1, 5.1 |
| 6.3 | MRP Results View: grouped, sortable, bulk actions | 6.2 |
| 6.4 | Convert to PO/WO: one-click conversion from suggestion | 6.3, 4.1, 5.1 |

**Review gate:** Enter demand → run MRP → review suggestions → convert to POs and WOs. The core MRP loop works.

### Phase 7 — Admin & Dashboard

| # | Feature | Dependencies |
|---|---------|-------------|
| 7.1 | User Management: CRUD, role assignment | 0.4 |
| 7.2 | Role Management: view/create custom roles, assign permissions | 0.4 |
| 7.3 | Dashboard: low stock, PO summary, WO status, demand, MRP summary | 3.1, 4.1, 5.1, 6.2 |
| 7.4 | Super Admin: tenant CRUD, suspend/activate, impersonate | 0.4 |
| 7.5 | Tenant Settings: company info, defaults, number prefixes | 0.5 |

**Review gate:** Fully functional app. User/role management, dashboard, super admin, tenant settings.

### Review Gate Protocol

After each feature, the builder must:

1. **Summarize** what was built, files changed, decisions beyond spec
2. **Testability checklist** — specific steps to verify the feature works
3. **Flag decisions** needing approval
4. **Present:**

```
⏸ FEATURE REVIEW — [Feature Name]

Please review and confirm:
✅ APPROVED — continue to next feature
🔁 REVISE — [describe what to change]
❓ QUESTION — [ask a clarifying question]
```

5. **Do not proceed** until explicit approval.

---

## 13. Code Quality Standards

### Prototype-Level Standards

Code quality is "professional but pragmatic." Clean, readable, well-structured — but not hardened for production edge cases.

**Naming:**
- camelCase: variables, functions
- PascalCase: components, component files
- UPPER_SNAKE_CASE: constants
- kebab-case: utility files, CSS classes

**Functions:**
- Max 40 lines, single responsibility
- Async functions always handle errors

**Components:**
- Props typed via JSDoc or TypeScript interfaces
- Max 5 props before using config object
- Side effects in hooks only

**Accessibility (non-negotiable even for prototype):**
- WCAG 2.1 AA baseline
- Keyboard navigation on all interactive elements
- Color contrast: 4.5:1 text, 3:1 UI elements
- Labels on all form inputs
- Visible focus states
- Logical heading hierarchy
- aria-live for dynamic content (toasts, alerts)

**Documentation:**
- JSDoc on all exports
- Comments explain why, not what
- README with verified setup instructions

### Deferred to Production Hardening
- Advanced input sanitization
- Rate limiting
- CSRF protection
- Security headers (Helmet.js)
- Comprehensive error boundaries
- Performance optimization
- Automated testing (unit, integration, e2e)
- API documentation (Swagger/OpenAPI)

---

## 14. Phase 2 Roadmap

Features confirmed for future phases, in approximate priority order:

| Feature | Notes |
|---------|-------|
| File Attachments | Polymorphic Attachment entity, cloud storage (S3/R2). Tabs on item, BOM, PO, WO detail pages. |
| Demand Forecasting | Sales history analysis, trend-based planning |
| Capacity Planning | Machine hours, labor hours, floor space constraints |
| Shop Floor Tracking | Real-time job progress, operator input |
| Costing & COGS | Material + labor + overhead rollup, margin analysis |
| Quality & Traceability | Lot tracking, inspection records, NCRs |
| Supplier Scoring | OTD, quality, pricing performance metrics |
| Reporting & Analytics | OTD, inventory turns, scrap rates, production efficiency |
| Email Notifications | Low stock alerts, PO reminders, WO status changes |
| Accounting Integration | QuickBooks, Xero |
| Subdomain Tenancy | `acme.yourapp.com` instead of tenant selector |
| On-Premise Option | Enterprise tier, self-hosted deployment |
| Mobile App | Shop floor optimized |
| Password Reset Flow | Self-service forgot password |
| Approval Workflows | PO approval chains |
| Multi-Currency | Support for international suppliers |
| Real-Time Updates | WebSocket push for inventory changes |

---

*This specification represents the complete architectural blueprint for the Manufacturing MRP System V1, as confirmed through the specification session on 2026-03-22. The builder should follow this document as the source of truth and flag any deviation through the Review Gate Protocol.*
