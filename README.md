# Offline POS (Offline‑First) – Full Prototype

This repository is a **submission‑ready prototype** for the **“POS Systems – Offline‑First Mobile/Web Applications”**.
---

## 1. Quick Start (Mac)

```bash
npm install
npm run start
```

- **Frontend (Vite)**: http://localhost:5173  
- **Mock REST API**: http://localhost:8787  

---

## 2. Offline‑First Validation (Recommended Demo Flow)

1. Open Chrome DevTools → Network → **Offline**
2. Browse products, add items, customize orders
3. Place orders and enqueue print jobs
4. Refresh the page (data persists via IndexedDB)
5. Go back **Online**
6. Observe automatic sync and updated sync status badge

This demonstrates:
- Local‑first writes
- Durable queues
- Eventual consistency

---

## 3. Core Features Implemented

### Order Entry Interface
- Product catalog with search and category filters
- Cart management with real‑time totals
- Product customization (size, add‑ons, special requests)
- Touch‑friendly and keyboard‑enabled UI

### Offline Queue Management
- Local operation log (oplog) for offline writes
- Automatic retry with exponential backoff
- Sync status persisted and reflected in UI

### Print Job Handler
- Persistent print queue
- Retry logic for failed jobs
- Multiple destinations (receipt / kitchen – demo)
- ESC/POS command builder (simulation)

### Local Data Management
- IndexedDB as primary data store
- Efficient querying for 1000+ catalog items
- Referential integrity between orders and products

---

## 4. Keyboard Shortcuts

- **Ctrl / ⌘ + K** → Focus product search  
- **Ctrl / ⌘ + N** → New order (clear cart)  
- **Ctrl / ⌘ + P** → Print receipt (queued)  
- **Esc** → Close dialogs  

Designed for **high‑throughput POS usage**.

---

## 5. Architecture Overview

**High‑level flow:**

```
UI (Vanilla JS)
   ↓
Offline Data Store (IndexedDB)
   ↓
Operation Log (Offline Queue)
   ↓
Sync Engine (Push / Pull)
   ↓
Mock REST API
```

Print Queue operates independently using local persistence and retry semantics.

---

## 6. Testing

### Test Philosophy
Tests are intentionally **minimal and focused**, covering:
- Deterministic business logic
- Event‑driven behavior
- State transitions

This aligns with assessment scope and avoids over‑engineering.

### Included Tests
Located in `/tests`:

- `orderDomain.test.js` → Order total & tax calculations
- `eventbus.test.js` → EventBus publish/subscribe behavior
- `syncState.test.js` → Sync state persistence
- `printManager.test.js` → Print queue enqueue behavior (mocked)

### Run Tests

```bash
npm test
```

Notes:
- Jest is configured in **ESM mode**
- Browser APIs (IndexedDB, localStorage) are mocked where required
- Tests focus on correctness, not UI rendering

---

## 7. Performance Considerations

- Vanilla JavaScript (no heavy frameworks)
- Small bundle size (Vite + idb)
- Explicit re‑rendering for predictable DOM updates
- Optimistic UI updates for cart operations

Designed to run smoothly on **low‑end tablets (2GB RAM)**.

---

## 8. AI Usage Disclosure

AI tools were used **only for**:
- Reviewing architectural clarity
- Improving documentation wording
- Identifying edge cases during testing

**All core implementation, logic, and design decisions are indigenous and human‑driven.**

---

## 9. Notes & Assumptions

- Payment processing is mocked (out of scope for frontend)
- Printer integration is simulated (ESC/POS output shown in UI)
- Device discovery / pairing is discussed conceptually (live interview)

---

## 10. Final Remarks

This prototype prioritizes:
- Correctness over complexity
- Clarity over abstraction
- Reliability under poor connectivity

It is intentionally scoped to demonstrate **senior‑level frontend judgment**, not framework usage.

---

**Author:** Lokesh Pothu  
