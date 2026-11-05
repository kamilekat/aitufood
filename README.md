# AituFood: lunch pre-order for AITU cafés

ICT 101 · Assignment 3 prototype · Kamila Tangirbergen and Karlygash Duisenbayeva (SE-2626)

**Live app: https://aitufood.web.app** · Firebase project `aitufood` (owner: Kamila Tangirbergen)

Stack (same as Project Stage 1): **React + Vite + Tailwind**, **Firebase Authentication**, **Cloud Firestore**
(region europe-west3, Frankfurt), **Firestore Security Rules**, **Firebase Hosting**. Free Spark plan, no bank card.

## Try it

Open https://aitufood.web.app on a phone or laptop. Nothing to install.

| Role | E-mail | Password |
|---|---|---|
| Student | `240001@astanait.edu.kz` | `Aitu2026!` |
| Café staff | `cafe@astanait.edu.kz` | `Cafe2026!` |

Live demo: open the student on a phone (or Chrome DevTools at 360 px) and the staff dashboard in an incognito
window. Place an order as the student; it appears on the dashboard without refreshing. Tap "Start cooking" →
"Mark ready"; the student sees "Your order #… is ready".

Before 13:50 (Astana time) students order for today, after that for tomorrow; the dashboard opens on the same day.
If no slots are open for that day, the café account sees a button **"Open 12 slots (12:00–13:50)"**.

## What the prototype does

| Screen | Operation | Requirement |
|---|---|---|
| Login / Register | Firebase Auth, only `@astanait.edu.kz`, consent checkbox | R1, R11, R15 |
| Menu (student) | **READ**: live menu, sold-out dishes hidden | R2, R9 |
| Cart + pickup slot | full slots disabled ("Full") | R3, R4 |
| Place order | **WRITE**: one transaction creates the order and its lines, books the slot, takes the next order number | R4, R5 |
| My orders (student) | **READ**: live status New → Cooking → Ready → Picked up | R6 |
| Orders dashboard (staff) | **READ** live + **UPDATE** status; open the day's slots | R8, R4 |
| Menu editor (staff) | **UPDATE**: sold out / on sale, price | R9 |

## Development (for the team)

Requirements: Node.js 20+, Java 11+ (only for the rules tests), Google Chrome.

```bash
npm install
cp .env.example .env.local      # paste the web config: Project settings -> Your apps -> aitufood-web
npm run dev                     # local copy of the app at http://localhost:5173, uses the cloud database
npm run test:rules              # 17 Security Rules tests in a local Firestore emulator
npm run deploy                  # build + deploy Hosting, Firestore rules and indexes
```

`npx firebase login` must be done once with the owner's (or an Editor's) Google account.

### Admin scripts (need the service-account key)

Firebase console → Project settings → Service accounts → **Generate new private key** → save as
`serviceAccount.json` in this folder. **It is secret:** it bypasses the Security Rules. Never send it or commit it
(`.gitignore` excludes it). If it leaks, delete it in the console and generate a new one.

```bash
npm run seed:reset                                         # DELETES all data and accounts, loads demo data
npm run backup                                             # -> backups/aitufood_YYYY-MM-DD_HHMM.json
npm run restore -- backups/aitufood_2026-10-14_1358.json   # puts Firestore back exactly as in the file
npx firebase auth:export accounts.json --format=json       # Auth accounts with scrypt password hashes
```

Run `npm run seed:reset` on the morning of the defense so "today" has live orders.

## Test data (after `seed:reset`)

| Collection | Documents |
|---|---|
| `orders` (main) | 139 |
| `orders/{id}/items` (order lines) | 293 |
| `auditLog` | about 206 (depends on the time of seeding) |
| `timeSlots` | 60 (5 days × 12 slots, 12:00–13:50) |
| `users` | 43 (40 students, 3 staff) |
| `menuItems` | 40 |
| `categories` | 10 |
| `counters` | 1 (technical: next order number) |

## Where to find things for the defense

| Question | File / line |
|---|---|
| How is injection prevented? | `src/lib/orders.js`: values go to `where()`, `doc()`, `tx.set()` as parameters, never into a query string |
| Where are roles checked? | `firestore.rules`: `isStaff()` and the `orders` `update` rule |
| Where is the price protected? | `firestore.rules`: `priceAtOrder == menuItem().price` |
| Where is a full slot blocked? | `firestore.rules` `timeSlots` update rule + transaction in `src/lib/orders.js` |
| Where are passwords? | Not in Firestore. Firebase Auth stores a salted scrypt hash (`auth:export` shows `passwordHash`, `salt`). |
| Can anyone read the database from the Internet? | No: an anonymous request gets `403 PERMISSION_DENIED`, even for the menu. |

## Access for the team and the instructor

Firebase console → ⚙ Project settings → **Users and permissions** → **Add member**:
Karlygash Duisenbayeva as **Editor**, the instructor as **Viewer** (sees the database, rules and usage, cannot change them).
