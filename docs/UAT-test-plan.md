# User Acceptance Testing (UAT) Plan

**Version:** 1.0
**Date:** 2026-03-29
**System:** Manufacturing MRP — V1 Prototype
**Tester:** Manual (human)

---

## Test Environment Setup

**Prerequisites:**
- Docker running (PostgreSQL on port 5433)
- Database seeded: `cd server && npx prisma db seed`
- Backend running: `cd server && node src/index.js` (port 3000)
- Frontend running: `cd client && npx vite` (port 5173)

**Test Accounts:**
| User | Email | Password | Tenant Slug | Role |
|------|-------|----------|-------------|------|
| Tenant Admin | `admin@test.com` | `password123` | `test-shop` | Admin (all permissions) |
| Super Admin | `superadmin@mrp.system` | `superadmin123` | *(leave blank)* | Super Admin |

**How to use this document:**
Work through each section in order. Check the box when a test passes. If a test fails, note what happened in the "Notes" column. Some tests depend on data created in earlier tests, so order matters.

---

## 1. Authentication

### 1.1 Login

| # | Test | Steps | Expected Result | Pass | Notes |
|---|------|-------|-----------------|------|-------|
| 1.1.1 | Successful login | Go to `localhost:5173`. Enter `admin@test.com`, `password123`, tenant slug `test-shop`. Click Login. | Redirected to Dashboard. Welcome message shows "Welcome back, Admin." | [ ] | |
| 1.1.2 | Wrong password | Enter correct email and slug but wrong password. Click Login. | Error message displayed: "Invalid credentials" or similar. Stay on login page. | [ ] | |
| 1.1.3 | Wrong tenant slug | Enter correct email and password but wrong slug (e.g., `fake-shop`). Click Login. | Error message. Stay on login page. | [ ] | |
| 1.1.4 | Empty fields | Leave all fields blank. Click Login. | Form validation prevents submission or shows error. | [ ] | |
| 1.1.5 | Redirect after login | While logged out, navigate directly to `localhost:5173/items`. Login. | After login, redirected to `/items` (not dashboard). | [ ] | |

### 1.2 Session & Logout

| # | Test | Steps | Expected Result | Pass | Notes |
|---|------|-------|-----------------|------|-------|
| 1.2.1 | Logout | Click user menu in top bar. Click Logout. | Redirected to login page. Attempting to navigate to `/items` redirects back to login. | [ ] | |
| 1.2.2 | Session persistence | Login. Close the browser tab. Open `localhost:5173` again. | Still logged in — dashboard loads without re-entering credentials. | [ ] | |
| 1.2.3 | Protected route guard | While logged out, navigate to `localhost:5173/items`. | Redirected to login page. | [ ] | |

---

## 2. Dashboard

**Prerequisite:** Logged in as `admin@test.com`.

| # | Test | Steps | Expected Result | Pass | Notes |
|---|------|-------|-----------------|------|-------|
| 2.1 | Dashboard loads | Navigate to `/` (click Dashboard in sidebar). | Page loads with 4 cards: Low Stock Alerts, Purchase Orders, Work Orders, MRP & Demand. No errors. | [ ] | |
| 2.2 | Low Stock Alerts — empty | With no reorder points configured, check the Low Stock card. | Shows "0" and "All items above reorder point." | [ ] | |
| 2.3 | Low Stock Alerts — trigger | Go to Items. Edit an item. Set reorder point to a number higher than current stock (e.g., 9999). Save. Return to Dashboard. | Low Stock Alerts card shows count >= 1. The item's part number appears with current qty vs. reorder point. | [ ] | |
| 2.4 | Low Stock Alerts — clear | Go back to the item. Remove the reorder point (clear the field) or set it to 0. Save. Return to Dashboard. | Low Stock Alerts count goes back down. | [ ] | |
| 2.5 | PO counts | Check the Purchase Orders card. | Shows counts for Draft, Sent, Partial, Overdue. Numbers should match what you see on the PO List page. | [ ] | |
| 2.6 | WO counts | Check the Work Orders card. | Shows counts for Planned, Released, In Progress, Completed. Numbers should match the WO List page. | [ ] | |
| 2.7 | Open demand count | Check the MRP & Demand card. | Shows count of open demand entries. If no demand exists, shows 0. | [ ] | |
| 2.8 | Last MRP run | If an MRP run has been done, check the MRP card. | Shows "Last run: [date]" and unconverted suggestions count (if any). | [ ] | |
| 2.9 | Card navigation — POs | Click the Purchase Orders card. | Navigated to `/purchase-orders`. | [ ] | |
| 2.10 | Card navigation — WOs | Click the Work Orders card. | Navigated to `/work-orders`. | [ ] | |
| 2.11 | Card navigation — Inventory | Click the Low Stock Alerts card. | Navigated to `/inventory`. | [ ] | |
| 2.12 | Card navigation — MRP | Click the MRP & Demand card. | Navigated to `/mrp/demand`. | [ ] | |
| 2.13 | Unconverted suggestions link | If unconverted suggestions exist, click the "X unconverted suggestions" link in the MRP card. | Navigated to `/mrp/results/:runId` for that run. | [ ] | |

---

## 3. Items (Master Data)

### 3.1 Item List

| # | Test | Steps | Expected Result | Pass | Notes |
|---|------|-------|-----------------|------|-------|
| 3.1.1 | List loads | Navigate to Items in sidebar. | Item list page loads. Shows table with columns: Part Number, Description, Type, UOM, Status. | [ ] | |
| 3.1.2 | Empty state | If no items exist, verify the empty message. | Shows "No items found" message with guidance. | [ ] | |
| 3.1.3 | Search | Type a partial part number or description in the search box. | Table filters to matching items. | [ ] | |
| 3.1.4 | Type filter | Use the type filter dropdown (if available). Select "Raw Material." | Only raw materials shown. | [ ] | |
| 3.1.5 | Pagination | If more than 25 items exist, check bottom of table. | Pagination controls appear. Can navigate between pages. | [ ] | |
| 3.1.6 | Column sorting | Click a sortable column header (e.g., Part Number). | Table re-sorts. Click again to reverse order. | [ ] | |
| 3.1.7 | Row click | Click on an item row. | Navigated to item detail/edit page (`/items/:id`). | [ ] | |

### 3.2 Create Item

| # | Test | Steps | Expected Result | Pass | Notes |
|---|------|-------|-----------------|------|-------|
| 3.2.1 | Navigate to create | Click "New Item" button on Item List page. | Form loads at `/items/new` with empty fields. | [ ] | |
| 3.2.2 | Create raw material | Fill in: Part Number: `UAT-RAW-001`, Description: `UAT Test Raw Material`, Type: `raw_material`, UOM: `ea`. Click save. | Item created. Success toast. Redirected to item list. New item appears. | [ ] | |
| 3.2.3 | Create finished good | Create item: Part Number: `UAT-FG-001`, Description: `UAT Finished Good`, Type: `finished_good`, UOM: `ea`. | Item created successfully. | [ ] | |
| 3.2.4 | Create sub-assembly | Create item: Part Number: `UAT-SA-001`, Description: `UAT Sub Assembly`, Type: `sub_assembly`, UOM: `ea`. | Item created successfully. | [ ] | |
| 3.2.5 | Duplicate part number | Try to create another item with Part Number `UAT-RAW-001`. | Error: duplicate part number. Item not created. | [ ] | |
| 3.2.6 | Validation — empty fields | Try to save with required fields blank. | Validation errors shown inline below empty fields. Form does not submit. | [ ] | |
| 3.2.7 | Reorder point | Edit `UAT-RAW-001`. Set reorder point to `50` and reorder quantity to `100`. Save. | Fields saved. Visible on item detail. | [ ] | |
| 3.2.8 | Lead time | Edit `UAT-RAW-001`. Set lead time days to `14`. Save. | Lead time saved. | [ ] | |

### 3.3 Edit & Deactivate Item

| # | Test | Steps | Expected Result | Pass | Notes |
|---|------|-------|-----------------|------|-------|
| 3.3.1 | Edit item | Click on `UAT-RAW-001`. Change description. Save. | Description updated. Success toast. | [ ] | |
| 3.3.2 | Deactivate item | Click on `UAT-RAW-001`. Click Deactivate button. | Item deactivated. Status shows "Inactive." Redirected to list. | [ ] | |
| 3.3.3 | Inactive items visible | On item list, check if deactivated item is visible (may need to adjust filter). | Deactivated item shows with "Inactive" badge. | [ ] | |

---

## 4. Suppliers (Master Data)

| # | Test | Steps | Expected Result | Pass | Notes |
|---|------|-------|-----------------|------|-------|
| 4.1 | List loads | Navigate to Suppliers. | Supplier list loads with table. | [ ] | |
| 4.2 | Create supplier | Click "New Supplier." Fill in: Name: `UAT Supplier Inc`, Code: `UAT-SUP`. Save. | Supplier created. Success toast. | [ ] | |
| 4.3 | Edit supplier | Click the supplier. Add contact name, email, phone. Save. | Contact details saved. | [ ] | |
| 4.4 | Duplicate code | Create another supplier with code `UAT-SUP`. | Error: duplicate code. | [ ] | |
| 4.5 | Search | Search for "UAT" on the supplier list. | Finds the UAT supplier. | [ ] | |
| 4.6 | Deactivate | Open supplier. Click Deactivate. | Supplier deactivated. | [ ] | |

---

## 5. Locations (Master Data)

| # | Test | Steps | Expected Result | Pass | Notes |
|---|------|-------|-----------------|------|-------|
| 5.1 | List loads | Navigate to Inventory > Locations (sidebar or `/inventory/locations`). | Location list loads. | [ ] | |
| 5.2 | Create location | Click "New Location." Name: `UAT Warehouse`, Code: `UAT-WH`. Save. | Location created. | [ ] | |
| 5.3 | Create second location | Name: `UAT Staging`, Code: `UAT-STG`. Save. | Second location created. | [ ] | |
| 5.4 | Edit location | Click `UAT Warehouse`. Add description. Save. | Description saved. | [ ] | |
| 5.5 | Duplicate code | Try to create a location with code `UAT-WH`. | Error: duplicate code. | [ ] | |

---

## 6. Item-Supplier Links

| # | Test | Steps | Expected Result | Pass | Notes |
|---|------|-------|-----------------|------|-------|
| 6.1 | Link supplier to item | Navigate to a raw material item detail. Find the supplier section/tab. Link `UAT Supplier Inc` to the item. | Link created. Supplier appears in item's supplier list. | [ ] | |
| 6.2 | Set preferred supplier | Mark the linked supplier as preferred. Set unit cost and lead time. | Preferred flag set. Cost and lead time saved. | [ ] | |
| 6.3 | Multiple suppliers | Link a second supplier to the same item. | Both suppliers shown. Only one can be preferred. | [ ] | |

---

## 7. BOM Management

**Prerequisite:** Create these items first if they don't exist:
- `UAT-FG-001` (finished_good) — the product we'll build a BOM for
- `UAT-SA-001` (sub_assembly) — a sub-assembly component
- `UAT-RAW-001`, `UAT-RAW-002`, `UAT-RAW-003` (raw_material) — raw material components

### 7.1 BOM List

| # | Test | Steps | Expected Result | Pass | Notes |
|---|------|-------|-----------------|------|-------|
| 7.1.1 | List loads | Navigate to BOMs. | BOM list page loads. | [ ] | |
| 7.1.2 | Empty state | If no BOMs exist, empty message shown. | Shows appropriate empty message. | [ ] | |

### 7.2 Create BOM

| # | Test | Steps | Expected Result | Pass | Notes |
|---|------|-------|-----------------|------|-------|
| 7.2.1 | Create BOM | Click "New BOM." Select item `UAT-FG-001`. Revision: `A`. | Form shows with empty BOM lines section. | [ ] | |
| 7.2.2 | Add BOM lines | Add 3 component lines: `UAT-RAW-001` qty 2, `UAT-RAW-002` qty 1, `UAT-SA-001` qty 1. Save. | BOM created with 3 lines. Status is "Draft." Success toast. | [ ] | |
| 7.2.3 | Scrap factor | Edit the BOM. Set scrap factor on `UAT-RAW-001` to 0.05 (5%). Save. | Scrap factor saved. MRP will plan for 5% extra. | [ ] | |
| 7.2.4 | Validation — no lines | Try to create a BOM with no component lines. | Error: at least one line required. | [ ] | |

### 7.3 BOM Status Transitions

| # | Test | Steps | Expected Result | Pass | Notes |
|---|------|-------|-----------------|------|-------|
| 7.3.1 | Activate BOM | Open the draft BOM for `UAT-FG-001`. Click Activate. | Status changes to "Active." BOM lines become read-only. | [ ] | |
| 7.3.2 | Only one active | Create another BOM for `UAT-FG-001` (Revision B). Try to activate it. | Error: only one active BOM per item. Must obsolete Revision A first. | [ ] | |
| 7.3.3 | Revise BOM | On the active BOM (Rev A), click Revise. | New draft BOM created (Rev A-rev or similar) with same lines copied. Original stays active. | [ ] | |
| 7.3.4 | Obsolete BOM | On the active BOM, click Obsolete. | Status changes to "Obsolete." | [ ] | |

### 7.4 Sub-Assembly BOM

| # | Test | Steps | Expected Result | Pass | Notes |
|---|------|-------|-----------------|------|-------|
| 7.4.1 | Create SA BOM | Create a BOM for `UAT-SA-001` with raw material components. Activate it. | Sub-assembly has its own active BOM. | [ ] | |
| 7.4.2 | Multi-level tree | View the BOM for `UAT-FG-001`. If there's a tree view, it should show the sub-assembly expanding into its own components. | Multi-level BOM tree renders correctly. | [ ] | |

---

## 8. Inventory Control

### 8.1 Stock Overview

| # | Test | Steps | Expected Result | Pass | Notes |
|---|------|-------|-----------------|------|-------|
| 8.1.1 | Overview loads | Navigate to Inventory (sidebar). | Stock overview page loads. Shows all active items, including those with zero stock. | [ ] | |
| 8.1.2 | Zero stock items | Verify that newly created items with no stock appear. | Items show with 0 quantity. | [ ] | |

### 8.2 Inventory Adjustment

| # | Test | Steps | Expected Result | Pass | Notes |
|---|------|-------|-----------------|------|-------|
| 8.2.1 | Navigate to adjust | Click Adjust (or navigate to `/inventory/adjust`). | Adjustment form loads with item selector, location selector, quantity field. | [ ] | |
| 8.2.2 | Add stock | Select `UAT-RAW-001`, location `UAT Warehouse`, quantity `100`. Notes: "Initial stock for UAT." Submit. | Success toast. | [ ] | |
| 8.2.3 | Verify stock | Go to Stock Overview. | `UAT-RAW-001` shows 100 at `UAT Warehouse`. | [ ] | |
| 8.2.4 | Add more stock | Adjust `UAT-RAW-002` at `UAT Warehouse`, quantity `50`. | Stock shows 50. | [ ] | |
| 8.2.5 | Negative adjustment | Adjust `UAT-RAW-001` at `UAT Warehouse`, quantity `-20`. | Stock reduced to 80. | [ ] | |
| 8.2.6 | Zero quantity rejected | Try to submit an adjustment with quantity `0`. | Validation error: quantity cannot be zero. | [ ] | |
| 8.2.7 | Stock for SA | Add stock for `UAT-SA-001`: 10 units at `UAT Warehouse`. | SA stock shows 10. | [ ] | |

### 8.3 Inventory Transfer

| # | Test | Steps | Expected Result | Pass | Notes |
|---|------|-------|-----------------|------|-------|
| 8.3.1 | Transfer stock | Navigate to `/inventory/transfer`. Transfer 25 units of `UAT-RAW-001` from `UAT Warehouse` to `UAT Staging`. | Success toast. | [ ] | |
| 8.3.2 | Verify transfer | Check stock overview. | `UAT-RAW-001`: 55 at Warehouse, 25 at Staging. Total still 80. | [ ] | |

### 8.4 Transaction Log

| # | Test | Steps | Expected Result | Pass | Notes |
|---|------|-------|-----------------|------|-------|
| 8.4.1 | Log loads | Navigate to `/inventory/transactions`. | Transaction log page loads with history of all adjustments and transfers. | [ ] | |
| 8.4.2 | Entries correct | Verify the log shows the adjustments (+100, +50, -20) and transfer. | Each transaction appears with correct type, quantity, item, location, and timestamp. | [ ] | |
| 8.4.3 | Filter | If filters exist, filter by item or transaction type. | Filtered results are correct. | [ ] | |

---

## 9. Purchase Orders

### 9.1 Create PO

| # | Test | Steps | Expected Result | Pass | Notes |
|---|------|-------|-----------------|------|-------|
| 9.1.1 | Navigate to create | Click "New PO" on PO list page. | PO form loads with supplier selector and empty line table. | [ ] | |
| 9.1.2 | Create PO | Select `UAT Supplier Inc`. Add line: `UAT-RAW-001`, qty 200, unit cost $5.00. Set expected date to 2 weeks from now. Save. | PO created with auto-generated number (e.g., `PO-XXXX`). Status: Draft. Success toast. | [ ] | |
| 9.1.3 | Multiple lines | Edit the PO. Add a second line: `UAT-RAW-002`, qty 100. Save. | PO now has 2 lines. | [ ] | |
| 9.1.4 | PO number format | Check the PO number. | Follows `PO-XXXX` format (e.g., `PO-0001`). | [ ] | |

### 9.2 PO Status Transitions

| # | Test | Steps | Expected Result | Pass | Notes |
|---|------|-------|-----------------|------|-------|
| 9.2.1 | Send PO | Open the draft PO. Click Send. | Status changes to "Sent." PO lines become read-only. | [ ] | |
| 9.2.2 | Cannot edit sent PO | Try to edit a sent PO's header or lines. | Edit is disabled or not available. | [ ] | |
| 9.2.3 | Cancel PO | Create a new draft PO. Click Cancel. | Status changes to "Cancelled." | [ ] | |

### 9.3 Receiving

| # | Test | Steps | Expected Result | Pass | Notes |
|---|------|-------|-----------------|------|-------|
| 9.3.1 | Navigate to receive | On the sent PO, click Receive (or navigate to `/purchase-orders/:id/receive`). | Receive form loads showing open lines with remaining quantities. | [ ] | |
| 9.3.2 | Partial receive | Receive 50 of 200 for `UAT-RAW-001`. Select location `UAT Warehouse`. Submit. | Success. PO status changes to "Partial." Line shows 50/200 received. | [ ] | |
| 9.3.3 | Verify inventory | Check stock overview for `UAT-RAW-001`. | Stock increased by 50 (now 130 at Warehouse). | [ ] | |
| 9.3.4 | Verify transaction | Check transaction log. | New receipt transaction: +50 `UAT-RAW-001`, reference: purchase_order. | [ ] | |
| 9.3.5 | Complete receive | Receive remaining 150 of `UAT-RAW-001` and all 100 of `UAT-RAW-002`. | PO status changes to "Received." All lines fully received. | [ ] | |
| 9.3.6 | Over-receive blocked | Try to receive more than the remaining quantity on a line. | Error or validation prevents over-receiving. | [ ] | |

---

## 10. Work Orders

**Prerequisite:** Ensure `UAT-FG-001` has an active BOM and sufficient raw material inventory.

### 10.1 Create WO

| # | Test | Steps | Expected Result | Pass | Notes |
|---|------|-------|-----------------|------|-------|
| 10.1.1 | Navigate to create | Click "New WO" on WO list page. | WO form loads with BOM selector, quantity, priority, schedule date fields. | [ ] | |
| 10.1.2 | Create WO | Select the active BOM for `UAT-FG-001`. Quantity: 10. Priority: 1. Set scheduled start/end dates. Save. | WO created with auto-generated number (e.g., `WO-0001`). Status: Planned. Material lines auto-generated from BOM (including scrap factor). | [ ] | |
| 10.1.3 | Material lines | View the WO detail. Check the material lines table. | Shows each BOM component with `quantityRequired` = BOM qty x WO qty x (1 + scrapFactor). `quantityIssued` = 0 for all. | [ ] | |
| 10.1.4 | WO number format | Check the WO number. | Follows `WO-XXXX` format. | [ ] | |

### 10.2 WO Status Transitions

| # | Test | Steps | Expected Result | Pass | Notes |
|---|------|-------|-----------------|------|-------|
| 10.2.1 | Release WO | Click Release on the planned WO. | Status changes to "Released." Issue Material section becomes available. | [ ] | |
| 10.2.2 | Issue material | In the Issue Material section, issue material for each component line from `UAT Warehouse`. | `quantityIssued` updates for each line. Success toast per issue. | [ ] | |
| 10.2.3 | Verify stock consumed | Check stock overview. | Raw material stock decreased by issued quantities. | [ ] | |
| 10.2.4 | Verify transactions | Check transaction log. | Issue transactions: negative quantities for raw materials, reference: work_order. | [ ] | |
| 10.2.5 | Start production | Click to move status to "In Progress." | Status changes. `actualStart` timestamp recorded. | [ ] | |
| 10.2.6 | Complete WO | Click Complete. | Status changes to "Completed." `actualEnd` recorded. Finished good receipt auto-created. | [ ] | |
| 10.2.7 | Verify FG receipt | Check stock overview for `UAT-FG-001`. | Stock increased by 10 (WO quantity). | [ ] | |
| 10.2.8 | Verify receipt transaction | Check transaction log. | Receipt transaction: +10 `UAT-FG-001`, reference: work_order. | [ ] | |
| 10.2.9 | Cancel WO | Create a new planned WO. Click Cancel. | Status changes to "Cancelled." | [ ] | |

---

## 11. MRP Engine

**Prerequisite:** Ensure:
- `UAT-FG-001` has an active BOM with raw material and sub-assembly components
- Sub-assembly `UAT-SA-001` has its own active BOM
- Some raw materials have preferred suppliers with lead times set
- Inventory levels are known (from previous tests)

### 11.1 Demand Management

| # | Test | Steps | Expected Result | Pass | Notes |
|---|------|-------|-----------------|------|-------|
| 11.1.1 | Demand list | Navigate to MRP (sidebar). | Demand list page loads. | [ ] | |
| 11.1.2 | Create demand | Click "New Demand." Select `UAT-FG-001`, quantity 50, date required 30 days from now. Notes: "UAT Test Order." Save. | Demand entry created. Status: Open. | [ ] | |
| 11.1.3 | Create second demand | Create demand for `UAT-FG-001`, quantity 25, date 45 days from now. | Second demand created. | [ ] | |
| 11.1.4 | Edit demand | Open the first demand entry. Change quantity to 60. Save. | Quantity updated. | [ ] | |
| 11.1.5 | Cancel demand | Open the second demand. Click Cancel. | Status changes to "Cancelled." | [ ] | |

### 11.2 Run MRP

| # | Test | Steps | Expected Result | Pass | Notes |
|---|------|-------|-----------------|------|-------|
| 11.2.1 | Navigate to run | Go to `/mrp/run`. | MRP Run page loads with planning horizon field and run history. | [ ] | |
| 11.2.2 | Execute run | Set planning horizon to 90 days. Click Run MRP. | Run completes. Success toast with result count. Run appears in history with "Completed" status. | [ ] | |
| 11.2.3 | View results | Click on the completed run (or follow the link). | Results page loads showing suggestions grouped by action type (purchase/produce). | [ ] | |
| 11.2.4 | Purchase suggestions | Check purchase suggestions. | Should suggest purchasing raw materials needed to fulfill the 60-unit demand (net of current stock). Shows suggested supplier, quantity, date needed, and suggested order date (date needed minus lead time). | [ ] | |
| 11.2.5 | Produce suggestions | Check produce suggestions. | Should suggest producing the sub-assembly (`UAT-SA-001`) and finished good (`UAT-FG-001`) — multi-level explosion. | [ ] | |
| 11.2.6 | Netting logic | Verify quantities account for existing stock. | Suggested quantities = gross requirement minus on-hand stock minus open PO/WO quantities. | [ ] | |

### 11.3 Convert Suggestions

| # | Test | Steps | Expected Result | Pass | Notes |
|---|------|-------|-----------------|------|-------|
| 11.3.1 | Convert to PO | On a purchase suggestion, click Convert (or similar action). | A new PO is created for the suggested supplier/item/qty. Suggestion status changes to "Converted." | [ ] | |
| 11.3.2 | Verify PO created | Go to Purchase Orders list. | New PO appears with the item and quantity from the suggestion. | [ ] | |
| 11.3.3 | Convert to WO | On a produce suggestion, click Convert. | A new WO is created for the suggested item/qty. Suggestion status changes to "Converted." | [ ] | |
| 11.3.4 | Verify WO created | Go to Work Orders list. | New WO appears. | [ ] | |
| 11.3.5 | Dismiss suggestion | On a remaining suggestion, click Dismiss. | Status changes to "Dismissed." | [ ] | |
| 11.3.6 | Filter results | Use the action type and status filters on the results page. | Filters work correctly — can isolate purchase vs. produce, suggested vs. converted vs. dismissed. | [ ] | |

---

## 12. Admin — User Management

### 12.1 User List

| # | Test | Steps | Expected Result | Pass | Notes |
|---|------|-------|-----------------|------|-------|
| 12.1.1 | Navigate to users | Click Users under Admin in sidebar. | User list page loads. Shows current tenant's users with name, email, roles, status, last login. | [ ] | |
| 12.1.2 | Search | Type "admin" in search box. | Filters to users matching "admin" in name or email. | [ ] | |
| 12.1.3 | Status filter | Switch filter to "All" then "Inactive." | Filter shows appropriate users. | [ ] | |

### 12.2 Create User

| # | Test | Steps | Expected Result | Pass | Notes |
|---|------|-------|-----------------|------|-------|
| 12.2.1 | Navigate to create | Click "New User." | User form loads with name, email, password, and role checkboxes. | [ ] | |
| 12.2.2 | Create user | First name: `Jane`, Last name: `Tester`, Email: `jane@test.com`, Password: `testpass123`. Check "Shop Floor Supervisor" role. Save. | User created. Success toast. Redirected to user list. Jane appears. | [ ] | |
| 12.2.3 | Duplicate email | Try to create another user with email `jane@test.com`. | Error: email already exists. | [ ] | |
| 12.2.4 | Validation — short password | Try to create a user with password `abc`. | Validation error: password must be at least 8 characters. | [ ] | |
| 12.2.5 | Validation — no role | Try to create a user with all role checkboxes unchecked. | Validation error: at least one role required. | [ ] | |

### 12.3 Edit User

| # | Test | Steps | Expected Result | Pass | Notes |
|---|------|-------|-----------------|------|-------|
| 12.3.1 | Edit user | Click on Jane. Change last name to `Supervisor`. Save. | Name updated. Success toast. | [ ] | |
| 12.3.2 | Change roles | Edit Jane. Uncheck "Shop Floor Supervisor." Check "Inventory Clerk." Save. | Role changed. Jane now has Inventory Clerk. | [ ] | |
| 12.3.3 | Change password | Edit Jane. Enter new password `newpass456`. Save. | Password updated (verify by logging in as Jane if desired). | [ ] | |
| 12.3.4 | Leave password blank | Edit Jane. Leave password field blank. Change first name. Save. | First name updated. Password unchanged (Jane can still login with previous password). | [ ] | |

### 12.4 Deactivate User

| # | Test | Steps | Expected Result | Pass | Notes |
|---|------|-------|-----------------|------|-------|
| 12.4.1 | Cannot deactivate self | Open your own user record (the Admin user). | Deactivate button should not appear (or be disabled). | [ ] | |
| 12.4.2 | Deactivate other user | Open Jane's record. Click Deactivate. | Jane deactivated. Status changes to "Inactive." Success toast. | [ ] | |
| 12.4.3 | Deactivated user login | (Optional) Try logging in as `jane@test.com` with her password. | Login should fail — deactivated users cannot log in. | [ ] | |

---

## 13. Admin — Role Management

| # | Test | Steps | Expected Result | Pass | Notes |
|---|------|-------|-----------------|------|-------|
| 13.1 | Navigate to roles | Click Roles under Admin in sidebar. | Role list page loads. Shows 5 default roles + any custom roles. | [ ] | |
| 13.2 | Default roles present | Verify all 5 default roles: Admin, Production Manager, Purchasing Agent, Shop Floor Supervisor, Inventory Clerk. | All 5 present with "Default" badge. | [ ] | |
| 13.3 | Expand role | Click the expand arrow on "Production Manager." | Permission badges appear showing all permissions for that role. | [ ] | |
| 13.4 | View default role | Click "View" on a default role. | Opens form in view-only mode. Permission checkboxes are visible but disabled. | [ ] | |
| 13.5 | Cannot edit default | Verify you cannot save changes to a default role. | No save button (or save is disabled) when viewing a default role. | [ ] | |
| 13.6 | Create custom role | Click "New Role." Name: `Quality Inspector`. Check permissions: `item:read`, `inventory:read`, `bom:read`. Save. | Custom role created. Appears in the list without a "Default" badge. | [ ] | |
| 13.7 | Edit custom role | Click "Edit" on `Quality Inspector`. Add `workorder:read` permission. Save. | Permission added. Success toast. | [ ] | |
| 13.8 | Duplicate name | Try to create a role named "Admin" (already exists). | Error: role name already exists. | [ ] | |
| 13.9 | User count | Check that each role shows the count of users assigned to it. | Count is accurate (e.g., Admin role shows 1 if only the admin user has it). | [ ] | |

---

## 14. RBAC — Permission Enforcement

**Goal:** Verify that permissions actually restrict access. You'll need the `jane@test.com` user (re-activate if deactivated) with a limited role.

| # | Test | Steps | Expected Result | Pass | Notes |
|---|------|-------|-----------------|------|-------|
| 14.1 | Setup test user | As admin: re-activate Jane (if needed). Assign her only the "Inventory Clerk" role (permissions: `inventory:read`, `inventory:write`, `item:read`, `bom:read`). | Jane has limited permissions. | [ ] | |
| 14.2 | Login as limited user | Logout. Login as `jane@test.com`. | Dashboard loads. | [ ] | |
| 14.3 | Sidebar visibility | Check the sidebar. | Jane should see: Dashboard, Items (read), BOMs (read), Inventory. Should NOT see: Suppliers, Purchase Orders, Work Orders, MRP, Admin section. | [ ] | |
| 14.4 | Can view items | Click Items. | Item list loads successfully (read access). | [ ] | |
| 14.5 | Cannot create items | Check for "New Item" button. | Button should not appear (Jane lacks `item:write`). | [ ] | |
| 14.6 | Can view inventory | Navigate to Inventory. | Stock overview loads. | [ ] | |
| 14.7 | Can adjust inventory | Navigate to `/inventory/adjust`. | Adjustment form loads (Jane has `inventory:write`). | [ ] | |
| 14.8 | Direct URL blocked | Try navigating directly to `/purchase-orders` in the browser URL bar. | Access denied message displayed. | [ ] | |
| 14.9 | Admin blocked | Try navigating to `/admin/users`. | Access denied message displayed. | [ ] | |
| 14.10 | Restore admin | Logout. Login as `admin@test.com`. | Admin access restored. | [ ] | |

---

## 15. Cross-Module Integration (End-to-End Flow)

This test walks through a complete manufacturing cycle: demand to delivery.

| # | Step | Actions | Verify | Pass | Notes |
|---|------|---------|--------|------|-------|
| 15.1 | Enter demand | Create demand: 20 units of `UAT-FG-001`, needed in 30 days. | Demand appears in list as "Open." | [ ] | |
| 15.2 | Run MRP | Go to MRP Run. Execute with 90-day horizon. | Run completes. Suggestions generated for raw materials (purchase) and finished goods (produce). | [ ] | |
| 15.3 | Convert purchase suggestion | Convert a raw material purchase suggestion to a PO. | PO created in draft status with correct supplier/item/qty. | [ ] | |
| 15.4 | Send PO | Open the new PO. Click Send. | PO status: Sent. | [ ] | |
| 15.5 | Receive materials | Receive the PO (full receipt to `UAT Warehouse`). | PO status: Received. Inventory increased. Transaction logged. | [ ] | |
| 15.6 | Convert produce suggestion | Convert the produce suggestion to a WO. | WO created as Planned with material lines from BOM. | [ ] | |
| 15.7 | Release WO | Release the WO. | Status: Released. | [ ] | |
| 15.8 | Issue material | Issue all required materials from `UAT Warehouse`. | Material `quantityIssued` matches `quantityRequired`. Stock decreases. | [ ] | |
| 15.9 | Complete WO | Move to In Progress, then Complete. | WO completed. Finished goods receipt auto-created. `UAT-FG-001` stock increases by 20. | [ ] | |
| 15.10 | Verify dashboard | Go to Dashboard. | Counts reflect the completed work: PO received, WO completed, stock levels updated. | [ ] | |

---

## 16. Edge Cases & Error Handling

| # | Test | Steps | Expected Result | Pass | Notes |
|---|------|-------|-----------------|------|-------|
| 16.1 | 404 route | Navigate to a nonexistent URL like `/nonexistent`. | Redirected to dashboard (catch-all route). | [ ] | |
| 16.2 | Nonexistent record | Navigate to `/items/00000000-0000-0000-0000-000000000000`. | 404 error or "not found" message displayed gracefully. | [ ] | |
| 16.3 | Network error | Stop the backend server. Try to load the Dashboard. | Error state displayed: "Failed to load" or similar. No white screen / crash. | [ ] | |
| 16.4 | Session expired | Open browser dev tools. Delete the `mrp_access_token` from localStorage. Perform an action. | Auto-refresh should attempt using refresh token. If refresh token also missing/expired, redirected to login. | [ ] | |
| 16.5 | Concurrent edit | Open the same item in two browser tabs. Edit and save in both. | Second save either succeeds with latest data or shows a clear error. No silent data loss. | [ ] | |

---

## Test Summary

| Module | Tests | Passed | Failed |
|--------|-------|--------|--------|
| 1. Authentication | 8 | | |
| 2. Dashboard | 13 | | |
| 3. Items | 11 | | |
| 4. Suppliers | 6 | | |
| 5. Locations | 5 | | |
| 6. Item-Supplier Links | 3 | | |
| 7. BOM Management | 8 | | |
| 8. Inventory Control | 11 | | |
| 9. Purchase Orders | 9 | | |
| 10. Work Orders | 9 | | |
| 11. MRP Engine | 12 | | |
| 12. Admin Users | 11 | | |
| 13. Admin Roles | 9 | | |
| 14. RBAC Permissions | 10 | | |
| 15. End-to-End Flow | 10 | | |
| 16. Edge Cases | 5 | | |
| **TOTAL** | **140** | | |

**Sign-off:**
- Tester: ___________________________
- Date: ___________________________
- Result: [ ] PASS — all critical tests passed / [ ] FAIL — see notes
