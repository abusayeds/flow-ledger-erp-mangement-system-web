# Web ↔ Backend Integration Tracking

Base `/api/v1` (tunnel `https://temp-api.ssh.bd`). Rule: **no web UI/design/field changes** — data layer only. Backend edits must stay mobile-safe. Every endpoint/write verified live with the test login (`company@gmail.com` / `1qazxsw2`).

Legend: ✅ done & (where noted) live-verified · 🟡 partial · ⬜ todo · ⛔ blocked

## Core — sync registry (`src/lib/db/sync.ts`) — read + write-through
| Feature | Read | Create | Edit | Delete | Verified |
|---|---|---|---|---|---|
| Customers | ✅ | ✅ | ✅ | ✅ | ✅ create+edit(currency) 200 |
| Vendors | ✅ | ✅ | ✅ | ✅ | ✅ create 200 |
| Products | ✅ | ✅ | ✅ | ✅ | ✅ create 200 |
| Services / Taxes / Categories | ✅ | ✅ | ✅ | ✅ | ✅ |
| Invoices | ✅ | ✅ | ✅ | ✅ | ✅ create 200 + PDF 200 |
| Estimates / Proformas / Sales Receipts / Delivery Challans / Credit Notes | ✅ | ✅ | ✅ | ✅ | ✅ creates 200/201 |
| Bills / Purchase Orders | ✅ | ✅ | ✅ | ✅ | ✅ creates 200/201 |
| Debit Notes | ✅ | ✅ | ✅ | ✅ | ✅ NEW PATCH /account/debit-notes/update/:id (draft-only, recompute) 200→500 |
| Expenses | ✅ | ✅ | ✅ | ✅ | ✅ create 200 |
| Payment Received | ✅ | ✅ | ✅ | ✅ | ✅ create 200 |
| Payment Made | ✅ | ✅ | n/a | ✅ | ✅ NEW POST /account/vendor-payments/record (no-allocation); bill balance via bills spec; record 201/list 200/delete 200 |
| Timelogs | ✅ | ✅ | ✅ | ✅ | endpoints verified |
| Projects | ✅ | ✅ | ✅ | ✅ | /project/create-update (create+update) + /project/delete; status Ongoing/Onhold/Completed↔Finished; members/clients names→ids via /project/users |

## Module dashboards
- ✅ POS Dashboard ← existing `/pos/dashboard`. Verified 200.
- ✅ Project Dashboard ← existing `/project/dashboard/home` (stats/projectStatus/taskPriority/teamPerformance/monthlyProgress/bugStats/recentTasks; 5 inline stat cards wired). Verified 200.
- ✅ CRM Dashboard ← **NEW** `/crm/dashboard` (stats, dealsByStage, callsByDay, recentDeals, recentLeads). Verified 200.
- ✅ Recruitment Dashboard ← **NEW** `/recruitment/dashboard` (statusOverview, hiringFunnel, onboardingProgress, upcomingInterviews, recentCandidates, openPositions). Verified 200.
- ✅ Support Dashboard ← **NEW** `/support/dashboard` (statCards, ticketTrends, statusDistribution, categoryDistribution, recentTickets). Verified 200.
- ✅ HRM Dashboard ← `/hrm/dashboard` (existing service **enriched** with departmentDistribution, employeesOnLeave, recentLeaveApplications, announcements, teamMembers, upcomingBirthdays; 8 stat cards wired). Verified 200 real data.
- ✅ Account Dashboard ← existing `/account/dashboard` (stats, monthlyCustomer/VendorPayments, recentRevenues/Expenses; 4 top cards + 4 footer cards wired). Verified 200.

All 7 module dashboards are now backend-backed.

## Backend PDF preview (eye/print → server PDF, spinner, our chrome, Download/Print)
✅ invoice, proforma, sales receipt, estimate, delivery challan, credit note, bill, purchase order, debit note, payment received, payment made. (`serverPdf.ts`, `PdfPreviewModal.tsx`.)

## Module pages — component-state fetch (read)
| Feature | Status |
|---|---|
| CRM Deals / Leads / System Setup + **Deal/Lead detail** (`/crm/{deals,leads}/:id`) | ✅ |
| CRM **Deal Reports** + **Lead Reports** ← `/crm/reports/{deals,leads}` (general/staff/client/pipeline tabs, date filter → refetch; backend enriched with weeklyWonLost + weeklyDetailed/staffDetailed conversions) | ✅ |
| Support Tickets | ✅ |
| Recruitment: Candidates, Job Postings, Offers, Job Locations, Interview Rounds, Custom Questions, Interviews, Interview Feedback, Candidate Assessments, Candidate Onboarding, System Setup | ✅ |
| Dashboard (stat cards ← `/dashboard/summary`, exact server figures) | ✅ |
| web Reports page (report grids computed from the now-real synced collections) | ✅ |
| Banking (`/account/bank-accounts/all`) | ✅ |
| **Form Builder** ← `POST /form-builder/forms/create` (backend already existed — full form+fields schema). Save wired; **drag-to-reorder fields via @dnd-kit** (NOT fabric.js — this is a structured form/schema builder, not a canvas tool). Verified create 200 / list / delete. | ✅ |

## Backend changes (mobile-safe)
- `/customers`, `/invoices` REST aliases (reuse existing controllers).
- `allCustomerFull` → web `/customers` returns FULL docs (fixed blank details/currency).

## Remaining — everything with a usable backend is now wired
- ✅ **Built from scratch this project** (new backend modules, all mounted + live-verified): Contracts (`/contract/*`), Companies (`/company-register/*`), Rewards referral invites (`POST /referral/invite`, `GET /referral/all` — Rewards.tsx hydrates + posts, UI untouched).
- ✅ **POS orders** — NEW backend `pos/order` module (`POST /pos/order/create`, `GET /pos/order/all|single/:id`, `DELETE /pos/order/delete/:id`; server recomputes sub_total/tax/total). `posOrderStore` now hydrates from backend on login and `create()` posts each completed sale; product-stock decrement already backend-wired. Verified 201 (sub 102/tax 18.36/total 115.36), list + delete 200.
- ✅ Recruitment **Checklist Items** (`ChecklistItems.tsx`) — REWRITTEN as a true checklist-items page (user-approved UI change): task_name/description/category/assigned_to_role/due_day/is_required/status + onboarding-checklist picker. Full CRUD wired to `/recruitment/checklist-items` (create/all/edit/delete) with the picker sourced from `/recruitment/onboarding-checklists/all`. Verified create 201 / list 200 / edit 200 / delete 200.
- ✅ Payment-made write: NEW backend `POST /account/vendor-payments/record` (records the payment with NO purchase-invoice allocation — the strict `create` is mobile-only and untouched); bill balance still updates via the bills spec. Optional `payment_method` added to the model (additive). Verified record 201 → list 200 → delete 200.
- Debit-note edit: NEW backend `PATCH /account/debit-notes/update/:id` (draft-only, recomputes totals via calculateInvoice) built + wired; verified 200→500 recompute.
