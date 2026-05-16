# Restaurant Management System — Phase 1 MVP Feature Specification

**Target market:** Morocco
**Goal:** Feature-complete MVP at parity with Foodics for the Moroccan market.
**Team size:** 2–4 developers
**Target launch:** Month 8–9 from project start
**Existing product to integrate with:** QR Menu App (already shipped, with ordering + fidelity + social-media-shareable direct ordering link)

---

## How to read this spec

Each module is broken down into:
- **Must-have (M)** — non-negotiable for MVP launch
- **Should-have (S)** — strongly preferred in MVP, can slip to v1.1 if timeline forces it
- **Nice-to-have (N)** — explicitly deferred, here only so the team knows it's planned

Every feature lists *what it does*, *acceptance criteria*, and *Morocco-specific notes* where relevant.

---

# PHASE 0 — FOUNDATION (Weeks 1–6, before feature work)

Before any module is coded, these architectural decisions must be locked. Skipping or rushing this phase will force a costly rewrite in year 2.

## 0.1 Tech stack recommendation

| Layer | Recommended | Why |
|---|---|---|
| Backend | Node.js (NestJS) or Python (FastAPI/Django) | Mature, hireable in MA, async-friendly |
| Database | PostgreSQL | Multi-tenant via row-level security, mature, free |
| Cache / queue | Redis | Sessions, order queue, real-time |
| Real-time | WebSockets (Socket.io) | KDS updates, live order status |
| Frontend (web/admin) | React + TypeScript | Standard, hireable |
| POS terminal app | React Native or Flutter | Same codebase iOS/Android/web; offline-first |
| Local DB (offline) | SQLite via WatermelonDB or Realm | Battle-tested offline sync |
| API contract | OpenAPI 3 + auto-generated SDKs | QR menu app and future apps consume this |
| Cloud | AWS or GCP, Paris/Frankfurt region | Latency to MA is acceptable |
| File storage | S3-compatible (AWS S3 or Wasabi) | Cheap, durable |
| CI/CD | GitHub Actions or GitLab CI | Standard |

## 0.2 Multi-tenant architecture (M)

- **One database, schema-per-tenant or row-level isolation** via PostgreSQL RLS
- Every entity carries a `restaurant_id` (tenant key)
- Tenant onboarding flow creates: account, default roles, default tax config, default payment methods, sample menu
- Subdomain per tenant: `restaurantname.yourapp.ma`
- Super-admin panel (for your team) lives separately on its own subdomain

## 0.3 API-first design (M)

- Every feature exposed through versioned REST API (`/v1/...`)
- OpenAPI spec auto-generated and published
- API authentication: OAuth2 + API keys per tenant
- The internal POS UI is **just the first client of this API**
- The QR menu app becomes the second client
- Future mobile owner-dashboard becomes the third
- **No business logic in the UI layer.** Ever.

## 0.4 Offline-first (M)

- POS terminal works fully offline for at least 24 hours of operation
- Local SQLite cache holds: menu, prices, recipes, current open orders, customer DB
- Outbound queue holds: closed orders, stock movements, payments, fidelity events
- On reconnect: queue flushes in chronological order
- Conflict resolution: server timestamps win; UI surfaces conflicts for manager review
- Connection status indicator visible at all times in the POS UI
- Card payments offline: store-and-forward via CMI's offline auth flow

## 0.5 Trilingual UI engine (M)

- Languages: Arabic (RTL), French (default for management), Darija (optional fallback)
- i18n via standard library (i18next, react-intl, or framework equivalent)
- Strings externalized from day 1 — no hardcoded text
- RTL flips entire layout (not just text direction)
- Receipts and KDS support per-restaurant default language choice
- Customer-facing screens (QR menu integration) inherit customer's browser language

## 0.6 Hardware compatibility list (M)

Must support, out of the box, generic standards (no proprietary lock-in):

- **Terminals:** any Android tablet 8"+ (Android 10+), iPad (iPadOS 15+), Windows tablets
- **Printers:** any ESC/POS thermal printer over USB, Bluetooth, or Network (Epson TM-T20/T88, Star TSP100, generic Chinese knockoffs)
- **Cash drawers:** any RJ11/RJ12 drawer triggered by printer pulse
- **Card readers:** CMI-certified terminals; integration via CMI API
- **Barcode/QR scanners:** any USB or Bluetooth HID device
- **Kitchen printers:** ESC/POS network printers
- **Customer-facing displays:** any HDMI screen + tablet

## 0.7 Security & compliance baseline (M)

- HTTPS everywhere, HSTS enforced
- Passwords: bcrypt or argon2, minimum 8 chars, rate-limited login
- PIN codes for staff: 4–6 digits, rate-limited, lockout after 5 fails
- Audit log table for every sensitive action (void, refund, price change, permission change)
- Encryption at rest for sensitive fields (customer phone, card tokens — never raw cards)
- Card data: tokenize via CMI gateway, never store PAN
- Backup: daily automated to S3 with 30-day retention
- Data residency: Moroccan customer data stored in EU region (closest legal jurisdiction)

## 0.8 Performance targets (M)

| Action | Target |
|---|---|
| POS terminal cold start | < 3 seconds |
| Add item to order | < 100 ms (UI feedback) |
| Send order to kitchen | < 500 ms |
| Print receipt | < 2 seconds |
| Generate daily report | < 5 seconds |
| Sync 100 offline orders | < 30 seconds |
| KDS order appearance latency | < 1 second |

---

# PHASE 1 — MVP MODULES

## Module 1 — Authentication & Access Control

### 1.1 Account & login (M)
- Email + password login for owner/admin (web)
- PIN code login for staff (POS terminal) — fast, no email needed
- Forgot password via email
- Two-factor authentication optional for owner/admin

### 1.2 Roles & permissions (M)
Predefined roles, each with a customizable permission matrix:
- **Owner** — everything, including billing and account deletion
- **Manager** — everything operational, no billing
- **Cashier** — POS only, no reports, no settings
- **Waiter** — POS only, can't void/refund without manager approval
- **Kitchen** — KDS only, no money handling
- **Custom** — owner can create custom roles

Permission matrix covers ~40 distinct actions (void, comp, discount > X%, change price, edit menu, view reports, manage staff, etc.).

### 1.3 Manager override (M)
- Any restricted action prompts a manager PIN
- Manager PIN unlocks the single action, doesn't switch the session
- Override events logged with: who attempted, who approved, what was done, timestamp

### 1.4 Audit log (M)
- Every sensitive action recorded immutably
- Searchable by user, action type, date range
- Exportable

---

## Module 2 — Restaurant Setup & Configuration

### 2.1 Restaurant profile (M)
- Legal name, trade name, ICE number, RC number, IF (Identifiant Fiscal), Patente, CNSS number
- Address (with Moroccan postcode validation)
- Phone, email, website, social media links
- Logo upload
- Cuisine type, seating capacity
- Currency (MAD default, with secondary display currency option)
- Time zone (Africa/Casablanca default)
- Default language (FR/AR/Darija)

### 2.2 Branch management (M)
- One owner account can manage multiple branches
- Each branch has its own menu, stock, employees, reports
- Owner can switch between branches from a dropdown
- Cross-branch reports available in v1.1 (deferred)

### 2.3 Operating hours (M)
- Per day of week
- Special hours for Ramadan (toggle "Ramadan mode" → uses Ramadan schedule)
- Closed days
- Used for: reports, scheduling, KDS warnings if order arrives outside hours

### 2.4 Tax configuration (M)
- Moroccan TVA rates preconfigured: 20%, 14%, 10% (default for restaurant food), 7%, 0%
- Tax applied per item or per category
- Mixed tax on one bill handled automatically (food at 10%, alcohol at 20%, soft drinks at 20%)
- Display "Prix TTC" or "Prix HT + TVA" on receipts — owner's choice
- Service charge (frais de service) optional, configurable %

### 2.5 Receipt customization (M)
- Logo on top
- Custom header lines (e.g., "Bismillah", or restaurant slogan)
- Custom footer lines (e.g., "Merci, شكرا")
- Show/hide: item codes, tax breakdown, server name, table number
- Bilingual receipts (FR + AR side by side or stacked)
- Receipt size: 58mm or 80mm thermal
- QR code on receipt (links to fidelity signup or restaurant social media)

### 2.6 Printer setup wizard (M)
- Auto-discover network printers
- Manual add via IP or USB
- Test print button
- Assign printer to: receipts, kitchen station, bar, customer copy
- Printer fallback (if printer A is down, route to printer B)

### 2.7 Payment methods configuration (M)
- Enable/disable: Cash, CMI card, Inwi Money, Orange Money, MarocPay, Voucher, Comp, Other
- Custom payment methods for special cases
- Cash drawer auto-open on cash payment

---

## Module 3 — Menu Management

### 3.1 Menu structure (M)
- Categories (e.g., Entrées, Tagines, Couscous, Pizzas, Boissons, Desserts)
- Subcategories (optional, one level deep)
- Items within categories
- Drag-and-drop reordering
- Bulk import via Excel/CSV (critical for onboarding — most restaurants have 100+ items)

### 3.2 Menu items (M)
Each item has:
- Name (per language: FR, AR, Darija optional)
- Description (per language)
- Image (one main, up to 3 additional)
- Price (one or multiple price variants — e.g., small/medium/large)
- Cost (calculated from recipe — see Module 4)
- Tax rate (inherited from category or overridden)
- Item code / SKU (optional, auto-generated)
- Color tag (visible on POS button)
- Available channels: dine-in, takeaway, delivery, QR menu, online — each toggle independently
- Available times: all day, breakfast only, lunch only, dinner only
- Availability toggle: in stock / 86'd (out of stock) — instant
- Featured / hidden flag

### 3.3 Modifiers & options (M)
- Modifier groups: "Cuisson" (rare/medium/well-done), "Suppléments", "Sans...", "Boisson incluse"
- Required vs optional modifiers
- Single-select vs multi-select
- Price impact: +X MAD, free, or no price change
- **Each modifier affects recipe/stock** (extra cheese → deducts cheese)
- Modifier groups reusable across items

### 3.4 Combos / set menus (S)
- Combo = parent item containing N child items at a combined price
- Child items chosen from a pool (e.g., choose 1 starter from list of 5)
- Recipe still deducted per actual child item chosen

### 3.5 Allergens & dietary tags (S)
- Tag items: vegetarian, vegan, halal, gluten-free, contains nuts, contains dairy, spicy level 1–3
- Displayed on QR menu (consumer-facing) — important for tourists
- Inherited from recipe ingredients (auto-detected if ingredient is tagged)

### 3.6 KDS routing rules (M)
- Per item: which kitchen station receives the ticket
- Stations: cold, hot/grill, fryer, dessert, bar, expediter
- Default rule by category, override per item

### 3.7 Time-based menus (S)
- Define menu schedules (breakfast 7-11h, lunch 12-15h, dinner 19-23h)
- Items auto-activate/deactivate
- Special menu for Ramadan (iftar, suhoor)

---

## Module 4 — Recipe & Ingredient Engine **(YOUR CORE DIFFERENTIATOR — invest here)**

### 4.1 Ingredients catalog (M)
- Each ingredient has:
  - Name (per language)
  - Category (meat, dairy, vegetable, spice, dry good, beverage, alcohol, packaging)
  - Unit of measure (UOM): kg, g, L, ml, unit, dozen, etc.
  - Default supplier (linked to Module 5)
  - Current cost per UOM (auto-updated from latest purchase)
  - Tracking: tracked-in-stock vs not-tracked
  - Allergen tags (auto-flow into menu items)
  - Storage location (kitchen fridge, freezer, dry storage, bar, cold storage)
- Bulk import via Excel

### 4.2 Unit conversion engine (M)
- Recipes can use any UOM; system converts on the fly
- Example: ingredient stored in kg, recipe uses 200g, stock decremented by 0.2 kg
- Custom conversions (e.g., 1 onion = 150g; 1 lemon = 60ml juice)

### 4.3 Recipe builder (M)
Each menu item → one recipe. Recipe has:
- List of ingredients with quantities and UOMs
- Yield (how many portions the recipe produces — usually 1)
- Preparation notes (text)
- Optional photo / video link
- Auto-calculated cost (sum of ingredient costs × quantities)
- Auto-calculated food cost % (cost / price)
- Margin alert (if food cost % > threshold, flag in red)

### 4.4 Sub-recipes (M)
- A recipe can include another recipe as an ingredient
- Example: "Sauce Harissa Maison" is a recipe (yields 500g, costs 12 MAD); used in 8 dishes
- When the ingredient prices of the sub-recipe change, all parent recipes auto-update
- Sub-recipes can be batched (prep in advance) — see 4.7

### 4.5 Yield management (M)
- Raw → cooked yield % per ingredient (chicken breast raw 1kg → cooked 700g; 70% yield)
- System uses the raw weight for stock deduction
- Recipe specifies cooked or raw — both supported

### 4.6 Portion control & modifiers (M)
- Modifier affects ingredient quantity: "Extra fromage" → +30g fromage râpé
- "Sans olives" → -10g olives (no impact on customer price but tracked)
- "Double viande" → 2× viande portion + 25 MAD

### 4.7 Batch / prep recipes (S)
- Mark a recipe as "Batch" (e.g., harissa, dough, marinade)
- Kitchen records "Made 2 kg of harissa today" → stock of ingredients deducted, stock of harissa increased
- Tracks batch expiry dates

### 4.8 Recipe cards (S)
- Printable recipe card with photo, ingredients, steps
- For consistency across staff and across branches
- Versioning (chef updates recipe → previous version archived)

### 4.9 Automatic stock deduction on sale (M) **— core promise**
- Every closed order triggers stock deduction
- Cascades through sub-recipes
- Atomic transaction (succeeds or fails, no partial deduction)
- If an ingredient goes negative: alert manager but don't block (kitchen knows reality, system just flags)

---

## Module 5 — Inventory Management

### 5.1 Stock tracking (M)
- Real-time quantity per ingredient per location
- Stock value (qty × current cost)
- Visible per branch, per storage location

### 5.2 Stock adjustments (M)
- Manual adjustments with mandatory reason code:
  - Waste (spoiled, dropped, burnt)
  - Theft
  - Staff meal
  - Tasting / quality check
  - Inventory correction
  - Gift / promo
- Photo attachment optional
- Logged in audit trail

### 5.3 Stock counts (M)
- Full count (Z-count): walk through every ingredient and enter actual qty
- Partial count: count only a category (e.g., "Viandes" today, "Boissons" tomorrow)
- Mobile-optimized count screen (tablet or phone)
- Variance report: system qty vs counted qty, with value impact
- Multiple staff can count simultaneously (different sections)

### 5.4 Transfers between locations (S)
- Move stock from kitchen to bar, central kitchen to branch, etc.
- Sender confirms, receiver confirms
- Tracks shrinkage during transfer

### 5.5 Waste tracking (M)
- Dedicated waste log
- Daily waste report
- Waste % of revenue calculated

### 5.6 Par levels & alerts (M)
- Set min / max par per ingredient per location
- Alert when below min (in-app + WhatsApp + email)
- Suggested reorder qty = max - current stock

### 5.7 Suppliers (M)
- Supplier profile: name, contact, RIB, ICE, delivery days, payment terms
- Linked to ingredients (one ingredient can have multiple suppliers with different prices)
- Preferred supplier per ingredient
- Performance tracking: on-time delivery rate, quality issues count

### 5.8 Purchase orders (M)
- Create PO from low-stock alerts or manually
- Send PO to supplier via WhatsApp, email, or PDF
- Status: draft → sent → confirmed → received → invoiced → paid
- Editable until "sent"

### 5.9 Goods receiving (M)
- Receive against a PO, or receive without PO (walk-in delivery)
- Enter received quantities (may differ from ordered)
- Enter actual unit cost on invoice (may differ from PO)
- Cost updates flow into recipe costs automatically
- Photo of invoice attached (prep for future OCR — Phase 5)
- Quick "Receive all as ordered" button for common case

### 5.10 Expiry / FIFO tracking (S)
- Per receiving, optionally enter expiry date
- System suggests FIFO usage
- Expiry alerts 3 days before

---

## Module 6 — POS / Order Taking

### 6.1 Order creation flow (M)
- POS home: floor plan view OR category grid (configurable per user)
- Order types selectable: **Dine-in, Takeaway, Delivery, Drive-thru, QR menu (incoming)**
- For dine-in: select table → select guest count → start order
- For takeaway/delivery: optionally attach customer (phone lookup)

### 6.2 Add items to order (M)
- Tap category → tap item → modifier selection (if any) → added to order
- Search bar (filter by name or code)
- Recently used items pinned at top
- Favorites per user
- Quantity stepper (+ / -)
- Special request note per item (free text)

### 6.3 Modify orders (M)
- Edit qty, add modifier, change price (with permission)
- Remove item (void) with reason + manager approval if already sent
- Move items between courses
- Move items between tables (transfer)
- Hold item (don't send to kitchen yet)

### 6.4 Send to kitchen (M)
- "Envoyer" / "إرسال" button
- Items routed to correct KDS station per Module 3.6
- Sent items show ✓ on POS
- Re-send option for missed items
- "Fire course" command for course-by-course service

### 6.5 Discounts (M)
- % discount or fixed amount
- Per item or whole order
- Predefined discount reasons: Happy Hour, Staff, VIP, Complaint, Manager comp
- Permission required for discounts above threshold
- Auto-applied promotions (e.g., Tuesday 10% off, configurable rules)

### 6.6 Service charge & tips (M)
- Optional auto-service-charge (configurable % per restaurant)
- Tip prompt at payment (cash) — % or fixed
- Tips tracked per server for reporting

### 6.7 Void & refund (M)
- Void: order/item canceled before payment, with reason + manager approval
- Refund: post-payment reversal, with reason + manager approval
- Voids and refunds visible in dedicated report

### 6.8 Order parking & retrieval (S)
- Park an order (hold without sending) — useful for phone orders being taken
- Named/numbered tabs for bar service
- Retrieve and resume

---

## Module 7 — Table & Floor Management

### 7.1 Floor plan editor (M)
- Drag-and-drop visual editor (web admin, then deployed to terminals)
- Place tables: round/square/rectangle, configurable size
- Define zones / sections (terrace, indoor, VIP, bar)
- Walls, doors, decorative elements for orientation
- Save multiple layouts (e.g., "Été" with terrace, "Hiver" indoor only)

### 7.2 Table states (M)
- **Free** (gray/white)
- **Occupied** (green) with order timer
- **Awaiting payment** (yellow)
- **Reserved** (blue, with name + time)
- **Dirty / needs cleaning** (orange)
- **Out of service** (red)

### 7.3 Table operations (M)
- Open new order on table
- Transfer table (move order from table 5 to table 12)
- Merge tables (combine into one order, e.g., two tables pushed together)
- Split table (split one order into separate bills per guest)
- Add/change guest count
- Assign server to table

### 7.4 Server sections (S)
- Define which server handles which zone
- Auto-assign orders to server on table open
- Manager can reassign

### 7.5 Reservations (S — MVP basic, advanced in v1.1)
- Walk-in vs reservation
- Basic reservation entry: name, phone, time, guests, table
- Reservation list view for the host
- SMS/WhatsApp confirmation to customer (link to confirm/cancel)
- No availability calendar / online booking in MVP (deferred)

---

## Module 8 — Bill & Payment Processing

### 8.1 Bill generation (M)
- One-click bill preview
- Bill shows: items, modifiers, subtotal, tax breakdown, service charge, discount, total
- Customer copy + restaurant copy
- Bilingual print

### 8.2 Split bill (M)
- **By item:** drag items to separate sub-bills
- **By guest:** N equal splits
- **Custom amounts:** pay 200 from this person, rest from that
- **Equal split with remainder:** divide total by N, last person rounds

### 8.3 Multiple payment methods on one bill (M)
- Customer pays 100 MAD cash + 250 MAD card → recorded as two payments
- Partial payments tracked
- Outstanding balance shown until zero

### 8.4 Cash payment (M)
- Amount tendered entry
- Change calculation displayed
- Cash drawer opens automatically
- "Exact amount" shortcut

### 8.5 CMI card payment (M)
- Integrated terminal flow (depending on CMI gateway choice — pinpad on POS, or standalone with manual confirmation)
- Tokenization for repeat customers
- Receipt prints both for restaurant and customer
- Offline mode: store and forward when reconnected

### 8.6 Mobile wallet payment (M)
- Inwi Money OR Orange Money in MVP (pick one based on which has the easier B2B integration at the time)
- QR code generated, customer scans, confirms in their app
- POS waits for confirmation webhook, completes payment
- Timeout 90s then offers retry

### 8.7 Tip handling (M)
- Tip entered at payment time
- Cash tips: tracked but not deposited
- Card tips: added to charge if terminal supports, or tracked separately
- Daily tip report per server for distribution

### 8.8 Refunds (M)
- Refund a closed bill with manager approval + reason
- Reverses stock deduction (items return to inventory unless marked "consumed")
- Reverses fidelity points
- Card refunds via CMI integration

### 8.9 Receipt delivery (M)
- Print thermal
- Email (if customer attached)
- WhatsApp (clickable link to receipt PDF) — **big win in Morocco**
- SMS link
- No-receipt option (customer declined)

### 8.10 End of shift / Z-report (M)
- Cashier closes shift → counts cash drawer → reports variance
- Z-report prints: total sales, by payment method, by category, voids/discounts/refunds
- Drawer reset to opening float
- Manager review and approval

---

## Module 9 — Kitchen Display System (KDS)

### 9.1 Display modes (M)
- Per-station view (cold station sees cold items only)
- Expediter / all-station view
- Bar view (drinks only)

### 9.2 Order card layout (M)
- Order number / table / order type
- Server name
- Time elapsed (auto-counting)
- Course indicator
- Items with modifiers and notes
- Color code:
  - Green: 0–5 min
  - Yellow: 5–10 min
  - Red: 10+ min
- Stations color-coded too

### 9.3 KDS actions (M)
- Tap item to mark as "in progress"
- Tap again to "ready" (bumped from screen)
- Long-press to recall (got bumped by mistake)
- Print backup ticket button (in case kitchen prefers paper)

### 9.4 Course management (M)
- Course 1 (entrées) visible
- Course 2 (mains) held until expediter "fires" the course
- Expediter sees the whole table

### 9.5 Special notes & allergens (M)
- Bold / red highlight for allergen warnings
- "Sans gluten", "Bien cuit", "Allergique aux noix" — surface prominently

### 9.6 Multiple KDS screens per restaurant (M)
- One license covers unlimited KDS screens
- Each screen configurable (station, theme, font size)

### 9.7 KDS reports (S)
- Avg ticket time per item
- Avg ticket time per station
- Bottleneck analysis

---

## Module 10 — Customer Management & Fidelity (integrated with existing QR menu app)

### 10.1 Customer profile (M)
- Phone (Moroccan format, primary identifier, +212 prefix auto-handled)
- Name (optional, can be added later)
- Email (optional)
- Birthday (optional)
- Tags (VIP, regular, family, business, tourist)
- Notes (allergies, preferences — "n'aime pas la coriandre")
- Address (for delivery)

### 10.2 Customer linkage at POS (M)
- "Attach customer to order" — search by phone
- Auto-create on first encounter
- Quick add (just phone) or full profile

### 10.3 Order history (M)
- All orders by this customer across channels (dine-in, QR menu, delivery, takeaway)
- Total spent
- Average ticket
- Last visit
- Favorite items (top 3 most ordered)

### 10.4 Fidelity engine (M) **— integrated with existing QR menu app**
- Configurable point rules per restaurant:
  - X points per MAD spent
  - Bonus points on birthday
  - Bonus points for specific items
  - Channel multipliers (e.g., 2× points on QR menu orders to encourage direct ordering)
- Points balance per customer
- **Same balance across POS, QR menu, delivery, and social-media-direct-order link** — single source of truth via API

### 10.5 Rewards (M)
- Configurable rewards: "100 points = 1 free dessert", "500 points = -50 MAD"
- Customer can redeem at POS (cashier selects from available rewards)
- Customer can redeem on QR menu app (cross-channel consistency)

### 10.6 Customer segments (S)
- Auto-segments: New (1 visit), Regular (5+ visits), Loyal (20+ visits), VIP (config'd threshold), Lapsed (no visit in 60 days)
- Manual segments by tag

### 10.7 Marketing actions (S)
- Send WhatsApp campaign to a segment ("Lapsed customers get 20% off this week")
- Birthday auto-greeting with reward
- Configurable templates

### 10.8 GDPR-equivalent privacy (M)
- Customer can request data deletion via QR menu or in-store
- Anonymized in reports after deletion (not removed entirely for accounting)

---

## Module 11 — Employee Management (basic — no CNSS/payroll for MVP)

### 11.1 Employee profile (M)
- Name, photo, phone, email
- Role (links to permissions)
- Hire date
- Hourly rate or monthly salary (informational only for MVP — no payroll generation)
- Status (active, on leave, terminated)

### 11.2 PIN-based login (M)
- 4–6 digit PIN per employee
- PIN reset by manager
- Lockout after 5 failed attempts

### 11.3 Clock in/out (M)
- Clock in: PIN + optional photo (anti-buddy-punching)
- Clock out: PIN + tip declaration
- Break tracking (optional)
- Manager can edit time entries with reason + audit log

### 11.4 Shift scheduling (M)
- Weekly calendar view, drag-and-drop
- Assign shifts: start time, end time, role, section
- Publish schedule → WhatsApp notification to each employee
- Employees see their schedule on a simple web link (no app needed)
- Shift swap requests (S — manager approves)

### 11.5 Hours worked report (M)
- Per employee per period
- Regular hours, overtime hours (>44 hr/week per Moroccan law), night hours
- **Note: this is reporting only. CNSS/payroll calculation is explicitly OUT of MVP scope.**

### 11.6 Sales attribution (M)
- Sales per server
- Tips per server
- Voids/discounts per server (loss prevention signal)

### 11.7 Activity log (M)
- Every staff action timestamped and attributed
- Cross-reference with Module 1.4 audit log

---

## Module 12 — Reports & Analytics

### 12.1 Today dashboard (M)
- Visible from any device, optimized for owner's phone
- Live sales count, current open tables, today's revenue vs yesterday
- Top 5 selling items today
- Staff currently clocked in
- Refresh every 30 seconds

### 12.2 Sales reports (M)
Filterable by date range, branch, channel, payment method:
- Total sales (gross, net, tax)
- Sales by day / hour / day-of-week
- Sales by category / item
- Top sellers (revenue and units)
- Dead items (zero sales in period)
- Sales by employee
- Sales by table / section
- Sales by payment method
- Sales by order type (dine-in / takeaway / delivery / QR menu)

### 12.3 X-report & Z-report (M)
- X-report: any-time snapshot
- Z-report: end-of-shift, locks the period
- Standard receipt format

### 12.4 Food cost report (M)
- Theoretical food cost (sum of recipe costs × items sold)
- Actual food cost (purchases - waste - end stock + start stock)
- Variance (the gap that signals theft, waste, over-portioning)
- Per item breakdown

### 12.5 Inventory reports (M)
- Current stock value
- Stock movement log (in/out/adjustment)
- Slow-moving stock
- Waste report

### 12.6 Employee report (M)
- Hours worked, sales attribution, tips, void rate

### 12.7 Customer & fidelity report (M)
- New customers, returning customers, churn
- Top customers by spend
- Fidelity points outstanding (liability)
- Rewards redeemed

### 12.8 Tax report (M)
- TVA collected per rate
- TVA-ready format for accountant
- Monthly + quarterly views

### 12.9 Export & sharing (M)
- PDF (formatted)
- Excel (raw data)
- Email a report to a recipient
- Schedule automated daily/weekly email of key reports

---

## Module 13 — QR Menu App Integration (the bridge to your existing product)

### 13.1 API endpoints exposed (M)
- `GET /menu` — full menu with categories, items, modifiers, prices, images
- `GET /menu/availability` — real-time availability changes
- `POST /orders` — incoming order from QR menu
- `GET /customers/lookup?phone=...` — customer lookup by phone
- `POST /customers` — create customer from QR menu
- `POST /loyalty/award` — award points
- `POST /loyalty/redeem` — redeem reward
- `GET /loyalty/balance?customer_id=...` — current balance

### 13.2 Webhooks emitted (M)
- `order.created` — fired when POS creates an order
- `order.status_changed`
- `order.completed`
- `inventory.item_unavailable` — auto-unlist on QR menu
- `customer.updated`
- `loyalty.balance_changed`

### 13.3 Shared customer & fidelity DB (M)
- QR menu reads/writes against POS as the source of truth
- Real-time sync (WebSocket or polling)

### 13.4 Shared menu (M)
- Menu defined once in POS admin
- Pushed to QR menu app via API
- Image URLs, multilingual fields, modifiers — all consistent
- Update in POS → reflected in QR menu within seconds

### 13.5 QR-menu orders flow into POS (M)
- Order arrives via API → appears in POS as "QR Menu" order type
- Auto-routed to KDS like any other order
- Counts toward reports, fidelity, stock deduction

---

## Module 14 — Settings & Administration

### 14.1 Subscription & billing (M)
- Plan selection: tiered (Lite / Pro / Enterprise) — pricing TBD
- Payment method (CMI card or bank transfer)
- Invoice history
- Auto-renewal toggle

### 14.2 Backup & restore (M)
- Auto daily backup to cloud (system-side)
- Manual on-demand backup
- Restore from a backup point (admin only, with confirmation)

### 14.3 Activity logs (M)
- See Module 1.4

### 14.4 Notifications (M)
- Per-channel: email, WhatsApp, in-app
- Per-event: low stock, large discount, refund, daily summary, no internet warning, payment failure
- Each role can configure their own notifications

### 14.5 Hardware setup wizard (M)
- Walk through: connect printers, connect cash drawer, test, connect card reader, connect KDS screens
- Diagnostic mode (test each device individually)

### 14.6 Help & support (M)
- In-app help articles (FR, AR)
- Chat with support (WhatsApp business)
- Video tutorials embedded
- "Request feature" form

---

## Module 15 — Offline Mode

### 15.1 What works offline (M)
- Take orders (all order types)
- Process cash payments
- Process card payments (store-and-forward via CMI offline auth)
- Print receipts
- Print KDS tickets (if KDS is local network, no internet needed)
- Add/edit customers
- View customer history (cached)
- View menu, recipes
- Clock in/out

### 15.2 What requires connectivity (M, but acceptable)
- Mobile wallet payments (Inwi/Orange Money) — needs internet
- New menu items from admin
- New employee added by admin
- Reports beyond today
- QR menu app integration (orders queue if offline)

### 15.3 Sync (M)
- Background sync every 30s when online
- Manual "Sync now" button
- Sync indicator: green (synced), yellow (queued), red (offline)
- Conflict resolution: server timestamp wins; UI surfaces conflicts to manager

### 15.4 Offline duration limits (M)
- System operates fully offline for 24h
- Warning at 12h offline
- After 24h offline: cash payments only (card auth too risky)

---

# CROSS-CUTTING REQUIREMENTS

## Localization
- All UI strings in FR + AR from day 1; Darija slot reserved (can be populated post-MVP)
- All dates in DD/MM/YYYY (FR) or AR equivalent
- All currency in MAD with 2 decimals
- Phone format: +212 XXX-XXXXXX

## Accessibility
- Font size scalable (4 levels) for older managers
- High-contrast mode
- Color choices safe for color-blind users (don't rely on color alone for status)

## Browser & device support
- POS terminal app: Android 10+, iPadOS 15+
- Web admin: Chrome, Safari, Firefox, Edge (latest 2 versions)
- Mobile owner dashboard: responsive web (no native app in MVP)

## Documentation & onboarding
- Owner onboarding flow: 15 minutes from signup to first order
- Sample restaurant pre-loaded for trial
- In-app tour for first-time users
- Knowledge base in FR + AR

---

# OUT OF SCOPE FOR MVP (explicit, so the team isn't tempted)

| Feature | Phase |
|---|---|
| DGI e-invoicing module | Phase 2 (immediately post-MVP) |
| Delivery aggregator hub (Glovo/Jumia/Yassir/Jibli M3ak) | Phase 3 |
| CNSS / payroll module | On hold indefinitely |
| All AI features (forecasting, OCR, conversational assistant, anomaly detection, dynamic pricing, customer behavior AI) | Phase 5 (year 2+) |
| Multi-branch central control & cross-branch reports | Phase 4 |
| Self-service kiosks | Phase 4 |
| Native mobile owner app | Phase 4 |
| Online table reservation calendar | v1.1 |
| Tourist multi-currency + VAT refund tickets | Phase 4 |
| Advanced menu engineering matrix | Phase 4 |
| Self-delivery driver app with GPS | Phase 3 |
| WhatsApp marketing campaigns at scale | Phase 4 |
| Halal supplier certification tracking | Phase 4 |

---

# TIMELINE (realistic, for 2–4 dev team)

| Months | Focus | Risk |
|---|---|---|
| 1–1.5 | Phase 0: architecture, tech stack, multi-tenant, API foundation, offline framework, i18n engine | If this is rushed, everything later suffers |
| 2 | Modules 1, 2, 14 (auth, setup, admin) | Low |
| 3 | Modules 3, 4 (menu + recipe engine) | Medium — recipe engine is intricate |
| 4 | Module 5 (inventory) + Module 11 (employees) | Medium |
| 5 | Modules 6, 7 (POS + tables) | High — this is the most-used surface; polish matters |
| 6 | Module 8 (payments) + Module 9 (KDS) | High — CMI integration can drag |
| 7 | Module 10 (customers + fidelity) + Module 13 (QR menu integration) | Medium |
| 8 | Module 12 (reports) + Module 15 (offline polish) + bug bash | Medium |
| 9 | Pilot launch with 3–5 friendly restaurants, then GA | — |

**Risks to watch:**
1. CMI integration paperwork can take 6–8 weeks alone — start this in month 2, not month 6.
2. Offline mode is the single most underestimated area. Budget 50% more time than feels right.
3. The recipe engine with sub-recipes and yields is the most intricate logic — assign your strongest dev.
4. Don't skip the architecture phase. Every shortcut here costs 10× later.

---

# DEFINITION OF "DONE" FOR MVP

A restaurant must be able to:
1. Sign up, configure their restaurant, import their menu and recipes (Day 1)
2. Take orders dine-in, takeaway, delivery, and from the QR menu app (Day 1)
3. Send orders to kitchen via KDS or printer (Day 1)
4. Take cash, card (CMI), and mobile wallet payments (Day 1)
5. Auto-deduct stock from sales (Day 1)
6. Run a Z-report at end of day with a clear food cost % (Day 1)
7. Manage staff schedules and clock in/out (Day 1)
8. Track and reward loyal customers across all channels (Day 1)
9. Survive a 4-hour internet outage without losing a single order or payment (Day 1)
10. Be operated by a Darija-speaking cashier with 1 hour of training (Day 1)

If any of those ten cannot be done with confidence at launch, the MVP isn't done.
