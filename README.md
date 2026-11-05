# AituFood: lunch pre-order for AITU cafés

ICT 101 · Final Project · Kamila Tangirbergen and Karlygash Duisenbayeva (SE-2626, Astana IT University)

**Live app: https://aitufood.web.app** · Firebase project `aitufood` (owner: Kamila Tangirbergen) · version 0.5.0

A student chooses dishes and a 10-minute pickup slot; the café sees the order live on its dashboard and moves it
through New → Cooking → Ready → Picked up. The student sees every status change at once.

Stack: **React 18 + Vite 6 + Tailwind 4**, **Firebase Authentication**, **Cloud Firestore** (region europe-west3,
Frankfurt), **Firestore Security Rules**, **Firebase Hosting** (also serves the photos and the sound). Free Spark plan.

## Test accounts (one per role)

| Role | Sign in with | Password | What to try |
|---|---|---|---|
| Student | `240001` (the form adds `@astanait.edu.kz`) | `Aitu2026!` | Menu → add dishes → "Choose a pickup time ↓" → Place order → My orders |
| Café staff | `cafe` | `Cafe2026!` | Orders dashboard (live), Daily report, Menu editor (sold out, price, add a dish) |
| Café staff (cooks) | `cook1.cafe`, `cook2.cafe` | `Cook2026!` | same as café staff |
| Visitor (no account) | — | — | Home page; Register with your own student ID (a non-AITU e-mail is rejected) |

Live demo: open the student on a phone (or Chrome DevTools at 360 px) and the staff dashboard in an incognito window.
Place an order as the student; it appears on the dashboard without refreshing (with a chime if "Sound on").
"Start cooking" → "Mark ready": the student sees "Your order #… is ready". A student can cancel a new order within 30 s.

Pickup slots: every 10 minutes from 09:00 to 17:50, every day, up to 10 orders each. They are created automatically by
the first visitor of the day. Before 17:50 (Astana time) students order for today, afterwards for tomorrow.

## Run it locally (exact steps)

Requirements: **Node.js 20+** and Git. Java 11+ only for the rules tests.

```bash
git clone https://github.com/<GITHUB_LOGIN>/aitufood.git
cd aitufood
npm install
cp .env.example .env.local      # public web config of the live project (see the comment in the file)
npm run dev                     # http://localhost:5173 — NOTE: uses the real cloud database
```

Other commands:

```bash
npm run build                   # production build into dist/
npm run test:rules              # 21 Security Rules tests in a temporary local Firestore emulator (needs Java 11+)
npm run deploy                  # build + deploy Hosting, Firestore rules and indexes (needs `npx firebase login`)
```

### Admin scripts (need the service-account key, owner only)

Firebase console → Project settings → Service accounts → **Generate new private key** → save as
`serviceAccount.json` in this folder. **It is secret:** it bypasses the Security Rules. It is in `.gitignore` and is
never committed. If it leaks, delete it in the console and generate a new one.

```bash
npm run seed:reset                                   # DELETES all data and accounts, loads demo data (dates from today)
npm run backup                                       # -> backups/aitufood_YYYY-MM-DD_HHMM.json (not committed)
npm run restore -- backups/<file>.json               # puts Firestore back exactly as in the file
npm run test:results -- 2026-11-01                   # read only: usability-test orders of a day with secondsToOrder
```

## What the system does

| Screen | Operation | Requirement |
|---|---|---|
| Home (visitor) | problem, how it works, Sign in / Register | — |
| Sign in / Register | Firebase Auth; student ID only (`@astanait.edu.kz` added), Show password, consent checkbox | R1, R11, R15 |
| Menu (student) | **READ** live menu with category photos; sold-out dishes hidden | R2, R9 |
| Cart + pickup slot | full slots disabled, past slots hidden, bottom bar jumps to the slots | R3, R4 |
| Place order | **WRITE** one transaction: order + lines + slot booking + next order number | R4, R5 |
| My orders (student) | live status; **cancel within 30 s** (slot place released) | R6 |
| Orders dashboard (staff) | **READ** live + **UPDATE** status; new-order chime + visual notice | R7, R8 |
| Daily report (staff) | orders per slot, top 5 dishes, average order | R10 |
| Menu editor (staff) | **UPDATE** sold out / price, **CREATE** a dish | R9 |

## Repository map

| Path | Content |
|---|---|
| `src/pages/` | `Home`, `Login`, `Menu`, `MyOrders`, `Dashboard`, `MenuEditor` |
| `src/lib/orders.js` | `placeOrder` transaction, `cancelOrder`, `setOrderStatus`, `setAvailable`, `openSlots` |
| `firestore.rules` | data schema, roles, constraints (NOT NULL / CHECK / FK / UNIQUE equivalents), 30-s cancel window |
| `tests/rules.test.mjs` | 21 Security Rules tests |
| `scripts/` | seed, backup, restore, admin, test results (Admin SDK) |
| `docs/` | ERD, architecture diagrams, IoT extension, SQL equivalent of the schema |
| `analysis/` | CSV exports, SQL queries and charts of Stage 2 data analysis |
| `media/` | photo credits and licences, sound, measurements (Assignment 4), test evidence |

## Where to find things for the defense

| Question | File |
|---|---|
| How is injection prevented? | `src/lib/orders.js`: values go to `where()`, `doc()`, `tx.set()` as parameters, never into a query string |
| Where are roles checked? | `firestore.rules`: `isStaff()` and the `orders` `update` rule; role = custom claim set only by `scripts/seed.mjs` |
| Where is the price protected? | `firestore.rules`: `priceAtOrder == menuItem().price` |
| Where is a full slot blocked? | `firestore.rules` `timeSlots` update rule + transaction in `src/lib/orders.js` |
| Where are passwords? | Not in Firestore. Firebase Auth stores a salted scrypt hash. |
| Can anyone read the database from the Internet? | No: an anonymous request gets `403 PERMISSION_DENIED`, even for the menu. |
| Where is personal data stored? | Firestore in Frankfurt (EU). Law of RK No. 94-V Art. 12 requires storage in Kazakhstan, so the prototype holds only test data. |

## Team and commit history

Code commits in this repository are made by **Kamila Tangirbergen** (architecture, Firestore, rules, tests, deployment).
Git was started at the final stage (Week 10): the first commit contains the system as built through Project Stage 2,
and every Week 10 change is a separate commit. **Karlygash Duisenbayeva**'s work (menu and test-data content, UX of
menu / cart / slots / My orders, usability tests, privacy, IoT extension, normalisation) is listed in the Final report
(contribution statements and table) with the files it is in.
