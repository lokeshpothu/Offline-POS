# Senior Frontend Engineer Assessment – Architecture & System Design Answers

This document answers **Part 1** of the assessment and explains how the implementation meets the constraints.

## 1) Offline‑First Architecture
### a) Data synchronization strategy (orders, inventory, menu)
**Pattern:** local-first + operation log (oplog) + periodic bidirectional sync.

- **Local source of truth:** IndexedDB stores `products`, `orders`, `inventory`.
- **Offline writes:** Any write is immediately committed locally, and also appended to an **oplog** (`oplog` store) as `{PUT|DEL, entity, key, payload, createdAt, deviceId}`.
- **Sync loop:** When online (or on interval), the client:
  1) **Pushes** oplog entries to `/api/sync/push`
  2) **Pulls** server changes since `lastSync` using `/api/sync/pull?since=...`
  3) Applies changes locally with conflict resolution.
- **Partial sync:** Pull is bounded to avoid large datasets at once (batching); menu/product catalogs can be synced by category or updatedAt windows in a real backend.
- **Receipt printing:** Print jobs are always queued locally and processed asynchronously; they are not blocked by network state.

### b) Conflict resolution (multi-device offline edits)
Each record contains `{version, updatedAt, deviceId}`. Resolution rules:
- Prefer the record with **higher version**
- If versions tie, prefer **newer updatedAt** (LWW)
- **Domain rule for orders:** order status is **monotonic** (`pending → preparing → ready → completed`) and never goes backward. If two devices update the same order, the “higher status rank” wins.

### c) Data consistency across devices
- **Eventual consistency:** Sync ensures convergence when devices reconnect.
- **Idempotent ops:** oplog entries can be safely retried.
- **Referential integrity:** Order creation writes order + lines inside a single IndexedDB transaction.
- **Visibility:** UI shows offline/sync states and errors.

## 2) Performance Constraints (Android tablets ~2GB RAM, older CPU)
### a/b) Bundle size & runtime performance
- Prefer vanilla JS + tiny helper libs (`idb` only).
- Avoid heavy UI frameworks; minimize dependencies.
- Cache product lists locally and query in-memory with lightweight filters.
- Cap rendered product list (show top N results) and rely on search/filter to reduce DOM load.

### c) Efficient DOM manipulation & memory
- Use event delegation for list interactions.
- Avoid re-rendering huge lists; render only a window (in production you’d add virtualization).
- Keep data structures simple (plain objects, arrays); prune logs (oplog bounded; server change-log bounded).

## 3) Multi‑Device Coordination
### a) Real-time order status updates
- When online: WebSocket/SSE from backend to push order status changes to all devices.
- When offline but on same local network: use local network discovery + WebRTC DataChannel or mDNS + WebSocket to coordinate.
- In this prototype: the REST sync loop approximates real-time via short intervals and online events.

### b) Shared thermal printer queue
- Maintain a print queue with priority and destinations (`receipt`, `kitchen`, `bar`).
- Single “printer owner” device can be elected (lease/heartbeat). Others enqueue jobs; owner processes in order.
- Retry and persistence are mandatory to prevent lost receipts.

### c) Device discovery & pairing
- mDNS/Bonjour service advertisement for devices on LAN.
- Pairing via QR code / PIN.
- Store paired device identifiers and capabilities locally.

## 4) Data Storage Strategy
### a) IndexedDB vs WebSQL vs localStorage
- **IndexedDB:** best for structured data, indexes, transactions, large storage → recommended.
- **WebSQL:** deprecated, inconsistent support → avoid.
- **localStorage:** synchronous, small limits, no indexing → unsuitable for catalogs/queues.

### b) Efficient local querying for large catalogs
- Use IDB indexes on `category` and `name` for fast range queries.
- Cache common query results; support prefix search.
- In prototype: basic filtering + capped render list; IDB indexes exist and can be used for cursor queries.

### c) Data pruning strategy
- Bound oplog length (e.g., keep last N ops or last X days).
- For orders: archive completed orders after retention period.
- For print jobs: delete jobs with `done` status after confirmation.
- For product catalogs: keep only active categories or delta updates.

---
## Implementation mapping (Part 2)
- Order entry (catalog, search/filter, cart, customization, totals)
- Offline queue management (oplog + sync engine + sync status)
- Print job handler (destinations, retry, prioritization, templates, persistence)
- Local data management (IndexedDB + indexes + pruning hooks)
