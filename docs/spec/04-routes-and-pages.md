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
