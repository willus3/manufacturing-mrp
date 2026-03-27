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
