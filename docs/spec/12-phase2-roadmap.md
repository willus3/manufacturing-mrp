## 14. Phase 2 Roadmap

Features confirmed for future phases, in approximate priority order:

| Feature | Notes |
|---------|-------|
| File Attachments | Polymorphic Attachment entity, cloud storage (S3/R2). Tabs on item, BOM, PO, WO detail pages. |
| MRP Lead Time Cascading | Multi-level lead time offsetting through BOM tree — V1 offsets at single level only. Cascade parent assembly lead times so component order dates account for each BOM level (e.g., raw material PO date = demand date − assembly lead time − sub-assembly lead time − supplier lead time). |
| MRP Bulk PO Conversion | When converting purchase suggestions, option to consolidate all items from the same supplier into a single PO instead of one PO per item. V1 creates one PO per suggestion. |
| PO-to-WO Linking | Link purchase orders to work orders they supply materials for. Enables traceability from demand → WO → PO and helps coordinate timing between procurement and production. |
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
