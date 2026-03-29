# Manufacturing MRP — User Guide

**Version:** 1.0 (V1 Prototype)
**Last Updated:** 2026-03-29

---

## What Is This Software?

Manufacturing MRP is a cloud-based Material Requirements Planning system built for small to medium manufacturers. It replaces spreadsheet-based planning with a structured system that manages your bills of materials, inventory, purchase orders, work orders, and material planning — all in one place.

Think of it as the bridge between "we track everything in spreadsheets and people's heads" and a full enterprise ERP like Oracle or SAP, at a fraction of the cost and complexity.

### Who Is It For?

- **Small to medium manufacturers** (5-250 employees), any industry
- **Production Managers** who need to know what to build and when
- **Purchasing Agents** who need to know what to buy and when
- **Shop Floor Supervisors** who need to see work order status
- **Inventory Clerks** who manage stock counts and material movement
- **Owners/Executives** who want operational visibility

### What Can It Do Right Now?

The V1 prototype includes these core modules:

1. **Item Master** — Your catalog of every part, material, and product
2. **Supplier Management** — Track who you buy from, with pricing and lead times
3. **Bill of Materials (BOM)** — Define what goes into each product, multi-level
4. **Inventory Control** — Real-time stock levels, adjustments, transfers, full audit trail
5. **Purchase Orders** — Create, send, receive (partial and full), track PO status
6. **Work Orders** — Plan production, issue materials, complete and receipt finished goods
7. **MRP Engine** — Explode BOMs against demand, calculate net requirements, suggest what to buy and build
8. **Dashboard** — At-a-glance summary of stock alerts, open orders, and MRP status
9. **User & Role Management** — Create users, assign roles, control who can do what

---

## Getting Started

### Logging In

1. Open the application in your browser
2. Enter your **email address**
3. Enter your **password**
4. Enter your **tenant slug** (this is your company's short identifier — your admin will tell you what it is)
5. Click **Login**

After login, you'll land on the Dashboard.

### The Interface

The application has three main areas:

```
+------------------+----------------------------------------+
|  Top Bar         | App name    | Company name | User menu |
+--------+---------+----------------------------------------+
|        |                                                  |
| Side   |              Main Content Area                   |
| bar    |                                                  |
|        |    This is where pages, forms, and tables        |
| Items  |    are displayed.                                |
| BOMs   |                                                  |
| Inv.   |                                                  |
| etc.   |                                                  |
|        |                                                  |
| -----  |                                                  |
| Admin  |                                                  |
+--------+--------------------------------------------------+
```

- **Sidebar** — Navigate between modules. Click any module name to go to its list page. The sidebar can be collapsed to give more screen space.
- **Top Bar** — Shows the app name, your company name, and a user menu (for logging out).
- **Main Content** — Where everything happens. Lists, forms, detail pages.

The sidebar only shows modules you have permission to access. If you don't see a module, your admin hasn't assigned you a role that includes it.

---

## Module Guide

### Dashboard

**What it shows:** A bird's-eye view of your operation right now.

- **Low Stock Alerts** — Items where current available inventory is below the reorder point you've set. Shows the top 5 worst shortfalls with current qty vs. reorder point. Click to go to Inventory.
- **Purchase Orders** — Count of POs by status (draft, sent, partial) plus how many are overdue. Click to go to POs.
- **Work Orders** — Count of WOs by status (planned, released, in progress, completed). Click to go to WOs.
- **MRP & Demand** — Count of open demand entries plus last MRP run date and unconverted suggestion count. Click to go to MRP.

The dashboard auto-refreshes every 60 seconds. Each card is clickable — click it to jump to that module.

---

### Items

**Purpose:** Your master list of every part, raw material, sub-assembly, and finished good.

**Item Types:**
| Type | What It Is | MRP Behavior |
|------|-----------|--------------|
| Raw Material | Stuff you buy to make things (steel, screws, paint) | MRP suggests **purchasing** |
| Purchased Component | Ready-made parts you buy (motors, circuit boards) | MRP suggests **purchasing** |
| Sub-Assembly | Something you build that goes into a bigger product | MRP suggests **producing** |
| Finished Good | Your end product that you sell | MRP suggests **producing** |
| Consumable | Shop supplies that don't go into a BOM (gloves, sandpaper) | Not planned by MRP |

**Key Fields:**
- **Part Number** — Your unique identifier (must be unique within your company)
- **Description** — Human-readable name
- **Unit of Measure** — How you count it (ea, ft, lb, gal, etc.)
- **Reorder Point** — When stock drops below this number, the dashboard will alert you
- **Reorder Quantity** — Suggested quantity to reorder
- **Lead Time Days** — Default time from order to delivery (can be overridden per supplier)
- **Tracking Method** — `none` (most items), `lot` (batch tracking), or `serial` (individual unit tracking)

**How to use:**
1. Go to **Items** in the sidebar
2. Click **New Item** to create
3. Click any row to view/edit
4. Use the search bar to find items quickly
5. Use the type filter to narrow down by item type

**Deactivating items:** Items are never deleted — they are deactivated. This preserves history. Deactivated items don't appear in dropdowns but remain in historical records.

---

### Suppliers

**Purpose:** Track who you buy from, with contact details.

**Key Fields:**
- **Name** — Supplier company name
- **Code** — Short identifier (optional but useful, must be unique)
- **Contact Info** — Name, email, phone
- **Address** — Free-form text
- **Notes** — Any additional info

**How to use:**
1. Go to **Suppliers** in the sidebar
2. Click **New Supplier** to create
3. Click any row to view/edit

---

### Item-Supplier Links

**Purpose:** Connect items to their suppliers with pricing and lead time information. One item can have multiple suppliers, but one should be marked as "preferred."

**How to set up:**
1. Navigate to an **Item** detail page
2. In the supplier section, link a supplier
3. Set the **unit cost**, **lead time days**, and optionally a **supplier part number**
4. Mark one supplier as **Preferred** — the MRP engine will use this supplier when generating purchase suggestions

**Why this matters for MRP:** When the MRP engine determines you need to buy 500 units of a raw material, it looks at the preferred supplier to get the lead time and creates the suggestion with the right order date (date needed minus lead time).

---

### Locations

**Purpose:** Define where inventory is stored — warehouses, staging areas, production floors, etc.

**How to use:**
1. Go to **Inventory > Locations** (or `/inventory/locations`)
2. Click **New Location** — give it a name and code
3. Locations are used when adjusting inventory, receiving POs, and issuing material to work orders

---

### Bill of Materials (BOM)

**Purpose:** Define the recipe for building a product. A BOM says "to make 1 unit of Product X, you need these components in these quantities."

**Key Concepts:**

- **Multi-level BOMs** — A finished good's BOM can include sub-assemblies, which have their own BOMs. The system handles this recursively.
- **Scrap Factor** — Expected waste percentage. If you set 5% scrap on a component, MRP and WOs will plan for 5% extra.
- **Revisions** — BOMs are versioned. Only one revision can be "Active" at a time per item.

**BOM Statuses:**
| Status | Meaning |
|--------|---------|
| Draft | Being worked on. Editable. |
| Active | The current production version. Read-only. Used by MRP and Work Orders. |
| Obsolete | No longer used. Kept for historical reference. |

**How to create a BOM:**
1. Go to **BOMs** in the sidebar
2. Click **New BOM**
3. Select the **item** this BOM produces (must be a finished good or sub-assembly)
4. Enter a **revision** identifier (e.g., "A", "Rev-1")
5. Add **component lines** — for each component, select the item, quantity per unit, unit of measure, and optional scrap factor
6. Click **Save** (creates as Draft)
7. When ready, click **Activate** to make it the production version

**Revising a BOM:**
1. Open the active BOM
2. Click **Revise**
3. A new draft copy is created with all the lines copied over
4. Edit the new draft as needed
5. When ready, obsolete the old revision and activate the new one

---

### Inventory Control

**Purpose:** Track what you have, where it is, and every movement in and out.

**Four sub-pages:**

#### Stock Overview (`/inventory`)
Shows current stock levels for all active items, organized by item and location. Items with zero stock still appear so you can see everything at a glance.

#### Adjustments (`/inventory/adjust`)
Add or remove stock. Common uses:
- **Initial setup:** Enter starting inventory when onboarding
- **Cycle counts:** Correct stock to match physical count
- **Scrap/damage:** Remove damaged goods

How to adjust:
1. Select an item
2. Select a location
3. Enter quantity: **positive** to add, **negative** to remove
4. Optionally add lot/serial number and notes
5. Submit

#### Transfers (`/inventory/transfer`)
Move stock between locations without creating or destroying it.

How to transfer:
1. Select item
2. Select **From** location and **To** location
3. Enter quantity
4. Submit

The total stock remains the same — it just moves from one place to another.

#### Transaction Log (`/inventory/transactions`)
Every inventory change is logged permanently. This is your audit trail. You can see:
- What changed (item, quantity, location)
- When it changed
- What type of transaction (receipt, issue, adjustment, transfer)
- What triggered it (manual, purchase order, work order)
- Who did it

You can filter by item, transaction type, and date range.

---

### Purchase Orders

**Purpose:** Create and track orders to suppliers. POs flow through a lifecycle from creation to full receipt.

**PO Lifecycle:**
```
Draft → Sent → Partial → Received
  ↓
Cancelled
```

- **Draft** — Being prepared. Lines can be added/edited.
- **Sent** — Sent to supplier. Lines are locked. Waiting for delivery.
- **Partial** — Some lines have been partially received.
- **Received** — All lines fully received. Terminal state.
- **Cancelled** — Order cancelled. Terminal state.

**How to create a PO:**
1. Go to **Purchase Orders** in the sidebar
2. Click **New PO**
3. Select a **supplier**
4. Add **lines** — for each line, select an item, enter quantity ordered and unit cost
5. Set an **expected delivery date**
6. Click **Save** (creates as Draft)
7. When ready, click **Send** to mark as sent to supplier

**How to receive against a PO:**
1. Open a sent or partially received PO
2. Click **Receive**
3. For each line, enter the **quantity received** in this shipment
4. Select the **location** where the goods are being put away
5. Optionally enter lot/serial numbers
6. Submit

What happens on receive:
- PO line quantities update
- Inventory stock increases at the receiving location
- An inventory transaction is logged (type: receipt, reference: purchase order)
- PO status auto-updates to Partial or Received based on line completion

**PO numbers** are auto-generated in the format `PO-0001`, `PO-0002`, etc.

---

### Work Orders

**Purpose:** Plan and track production. A work order says "build X units of this product using this BOM."

**WO Lifecycle:**
```
Planned → Released → In Progress → Completed
  ↓          ↓           ↓
Cancelled  Cancelled   Cancelled
```

- **Planned** — Scheduled but not started. Can be edited.
- **Released** — Ready for the shop floor. Material can now be issued.
- **In Progress** — Production is underway.
- **Completed** — Finished. Finished goods are automatically receipted into inventory.
- **Cancelled** — Cancelled at any pre-completion stage.

**How to create a WO:**
1. Go to **Work Orders** in the sidebar
2. Click **New WO**
3. Select an **active BOM** (only active BOMs are available)
4. Enter the **quantity** to produce
5. Set **priority** (higher number = higher priority)
6. Set **scheduled start and end dates**
7. Click **Save**

When you save, the system auto-generates **material lines** from the BOM. Each line calculates: `BOM quantity x WO quantity x (1 + scrap factor)`.

**Issuing material:**
1. Release the WO (status: Released)
2. On the WO detail page, use the **Issue Material** section
3. For each material line, select the location to pull from and confirm the quantity
4. Submit — inventory decreases, transaction is logged

**Completing a WO:**
1. Move to In Progress, then Complete
2. On completion, the system automatically creates an inventory receipt for the finished good
3. Your finished goods stock increases by the WO quantity

**WO numbers** are auto-generated in the format `WO-0001`, `WO-0002`, etc.

---

### MRP Engine

**Purpose:** The brain of the system. MRP takes your demand (what you need to deliver) and calculates exactly what to buy and build, accounting for what you already have.

**Three sub-pages:**

#### Demand List (`/mrp/demand`)
Demand entries are the input to MRP. In V1, demand is entered manually (future versions could pull from sales orders).

How to create demand:
1. Click **New Demand**
2. Select a **finished good or sub-assembly**
3. Enter **quantity required** and **date required**
4. Add optional notes (customer name, order reference, etc.)
5. Save

Demand statuses: Open, Planned, Fulfilled, Cancelled.

#### Run MRP (`/mrp/run`)
This is where you execute the MRP calculation.

How to run:
1. Set the **planning horizon** (how far ahead to plan, default 90 days)
2. Click **Run MRP**
3. The engine processes all open demand within the horizon

**What MRP does step by step:**
1. Takes all open demand entries within the planning horizon
2. **Explodes BOMs** — breaks finished goods into components, sub-assemblies into their components, recursively through all levels
3. **Nets against stock** — subtracts current available inventory from gross requirements
4. **Nets against open orders** — subtracts quantities from open POs and WOs that haven't been received/completed yet
5. **Generates suggestions:**
   - **Purchase** suggestions for raw materials and purchased components (with preferred supplier and lead-time-offset order date)
   - **Produce** suggestions for sub-assemblies and finished goods

The run history shows all past runs with their status.

#### MRP Results (`/mrp/results/:runId`)
After a run, review the suggestions:

- **Purchase suggestions** tell you what to buy, how much, from which supplier, and when to order (accounting for lead time)
- **Produce suggestions** tell you what to build and when to start

For each suggestion you can:
- **Convert to PO** — creates a real purchase order
- **Convert to WO** — creates a real work order
- **Dismiss** — ignore the suggestion (maybe you have an alternate plan)

Use the filters to view by action type (purchase/produce) or status (suggested/converted/dismissed).

---

### Admin — User Management

**Purpose:** Manage who has access to the system and what they can do. Requires `users:manage` permission.

**How to create a user:**
1. Go to **Admin > Users** in the sidebar
2. Click **New User**
3. Fill in first name, last name, email, and password (min 8 characters)
4. Check one or more **roles** to assign
5. Save

**How to edit a user:**
1. Click on a user in the list
2. Change name, email, or roles as needed
3. To change password: enter a new password. Leave blank to keep the current one.
4. Save

**Deactivating users:**
- Click Deactivate on a user's edit page
- Deactivated users cannot log in
- You cannot deactivate your own account (safety measure)
- Deactivation is soft — the user record is preserved for audit history

**Searching and filtering:**
- Use the search box to find users by name or email
- Use the status filter to show Active, Inactive, or All users

---

### Admin — Role Management

**Purpose:** Define what each role can do by assigning permissions. Requires `users:manage` permission.

**Default Roles (read-only, cannot be edited):**

| Role | What They Can Do |
|------|-----------------|
| **Admin** | Everything — all 18 permissions |
| **Production Manager** | BOMs, work orders, inventory (view), MRP, items, POs (view) |
| **Purchasing Agent** | POs (full), suppliers, inventory (view), BOMs (view), items |
| **Shop Floor Supervisor** | Work order status, BOMs (view), inventory (view), items (view) |
| **Inventory Clerk** | Inventory (full), items (view), BOMs (view) |

**Creating custom roles:**
1. Go to **Admin > Roles**
2. Click **New Role**
3. Enter a role name
4. Check the permissions you want this role to have (grouped by module)
5. Save

**Editing custom roles:**
1. Click Edit on a custom role
2. Change name and/or permissions
3. Save

You can view the permissions on default roles (click View), but you cannot edit them. If you need a modified version of a default role, create a custom role with the permissions you want.

**All 18 Permissions:**

| Permission | Controls |
|------------|----------|
| `bom:read` | View bills of materials |
| `bom:write` | Create and edit BOMs |
| `bom:delete` | Delete/archive BOMs |
| `inventory:read` | View stock levels and transactions |
| `inventory:write` | Adjust, transfer, and receipt inventory |
| `item:read` | View the item master |
| `item:write` | Create and edit items |
| `po:read` | View purchase orders |
| `po:write` | Create and edit POs |
| `po:receive` | Receive against POs |
| `supplier:read` | View suppliers |
| `supplier:write` | Create and edit suppliers |
| `workorder:read` | View work orders |
| `workorder:write` | Create and edit WOs |
| `workorder:status` | Change work order status |
| `mrp:run` | Run MRP and manage demand |
| `users:manage` | Manage users and roles |
| `settings:manage` | Configure tenant settings |

---

## Common Workflows

### Setting Up a New Product

1. **Create raw material items** — all the components you need to buy
2. **Create the finished good item** — the product you're making
3. **Create suppliers** and link them to raw material items (set one as preferred for each)
4. **Create a BOM** for the finished good — add all component lines with quantities and scrap factors
5. **Activate the BOM** — it's now the production version
6. **Create inventory locations** — where materials are stored and where finished goods go

### Planning a Production Run

1. **Enter demand** — how many units of the finished good do you need, and by when?
2. **Run MRP** — the engine calculates everything you need to buy and build
3. **Review suggestions** — are the quantities and dates reasonable?
4. **Convert purchase suggestions to POs** — send orders to suppliers
5. **Convert produce suggestions to WOs** — schedule production
6. **Receive PO deliveries** as materials arrive
7. **Release WOs** when materials are available
8. **Issue material** from inventory to work orders
9. **Complete WOs** — finished goods auto-receipt into inventory

### Correcting Inventory

1. Go to **Inventory > Adjust**
2. Select the item and location
3. Enter the difference: positive to add, negative to remove
4. Add notes explaining why (e.g., "Cycle count correction," "Damaged goods scrapped")
5. Submit — the adjustment is permanently logged in the transaction history

---

## Current Limitations (V1 Prototype)

These features are not yet available but are planned for future versions:

- **No email notifications** — low stock alerts and PO reminders are visible on the dashboard but don't send emails
- **No CSV import** — initial data must be entered manually (CSV import endpoints exist on the backend but the UI isn't built)
- **No tenant settings page** — company info and default configurations aren't configurable through the UI yet
- **No super admin UI** — the SaaS operator (super admin) can manage tenants via API but there's no frontend for it yet
- **No reporting/analytics** — no charts, graphs, or exportable reports beyond what the dashboard shows
- **No demand forecasting** — demand is entered manually, no historical analysis
- **No capacity planning** — MRP doesn't consider machine hours or labor availability
- **No costing/COGS** — purchase prices are tracked on PO lines but there's no cost rollup or cost-of-goods-sold calculation
- **No integrations** — standalone system, no connections to accounting, e-commerce, or other software
- **No mobile app** — desktop browser only (works on tablets but not optimized)
- **Single-session login** — logging in on a new device doesn't invalidate the old session (refresh tokens expire after 7 days)

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Can't log in | Check email, password, and tenant slug are correct. If your account was deactivated, ask your admin to reactivate it. |
| Can't see a module in the sidebar | Your role doesn't include the required permission. Ask your admin to update your role. |
| Dashboard shows wrong numbers | The dashboard auto-refreshes every 60 seconds. Wait a moment or refresh the page. |
| "Access Denied" on a page | You navigated to a page your role doesn't permit. Use the sidebar to navigate to pages you have access to. |
| Data didn't save | Check for red validation errors on the form. All required fields must be filled in. |
| PO lines are read-only | POs can only be edited in Draft status. Once sent, lines are locked. |
| Can't activate a BOM | Only one BOM can be active per item. Obsolete the current active BOM first. |
| MRP shows no suggestions | Check that you have open demand entries within the planning horizon, and that the demanded items have active BOMs. |
| Finished goods didn't receipt after WO completion | This should happen automatically. Check the transaction log to verify. If missing, there may have been an error — check the browser console. |
