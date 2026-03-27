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
