import { store } from './offlineStore';
import { notify } from './toast';
import { bus } from './eventbus';

// Conflict resolution strategy (practical & explainable):
// - Each record has {version, updatedAt, deviceId}
// - On concurrent updates, prefer higher version; if equal, prefer newer updatedAt (LWW)
// - Domain rule for orders: status progression is monotonic (never move backwards)

function resolveConflict(localRec, remoteRec, entity){
  if (!localRec) return remoteRec;
  if (!remoteRec) return localRec;

  if (entity === 'orders'){
    // ensure status doesn't go backwards
    const rank = { pending: 1, preparing: 2, ready: 3, completed: 4 };
    const localRank = rank[localRec.status] || 0;
    const remoteRank = rank[remoteRec.status] || 0;
    const best = remoteRank >= localRank ? remoteRec : localRec;
    // merge totals/lines from latest updatedAt
    return best.updatedAt >= (best===remoteRec?localRec.updatedAt:remoteRec.updatedAt) ? best : (best===remoteRec?localRec:remoteRec);
  }

  if ((remoteRec.version || 1) > (localRec.version || 1)) return remoteRec;
  if ((remoteRec.version || 1) < (localRec.version || 1)) return localRec;
  return (remoteRec.updatedAt || 0) >= (localRec.updatedAt || 0) ? remoteRec : localRec;
}

function backoff(attempt){
  const base = 800;
  const max = 15000;
  const jitter = Math.random() * 250;
  return Math.min(max, base * (2 ** attempt)) + jitter;
}

export const syncEngine = {
  _busy: false,
  _attempt: 0,

  async kick(reason='manual'){
    if (!navigator.onLine) {
      await store.setMeta("sync.status", {
        state: "syncing",
        reason,
        at: Date.now(),
      });
      bus.emit("sync:status");
      return;
    }
    if (this._busy) return;
    this._busy = true;
    await store.setMeta('sync.status', { state: 'syncing', reason, at: Date.now() });

    try {
      // 1) push local ops
      const ops = await store.getOplog(150);
      if (ops.length){
        const res = await fetch('/api/sync/push', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ops })
        });
        if (!res.ok) throw new Error('push failed: ' + res.status);
        const { applied } = await res.json();
        for (const opId of applied) await store.deleteOplog(opId);
      }

      // 2) pull remote changes since lastSync
      const last = await store.getMeta('sync.last', 0);
      const pullRes = await fetch('/api/sync/pull?since=' + encodeURIComponent(last));
      if (!pullRes.ok) throw new Error('pull failed: ' + pullRes.status);
      const payload = await pullRes.json();

      // apply with conflicts
      for (const entity of ['products','orders','inventory']){
        const changes = payload[entity] || [];
        for (const remoteRec of changes){
          const key = entity === 'inventory' ? remoteRec.sku : remoteRec.id;
          const localRec = await store.get(entity, key);
          const resolved = resolveConflict(localRec, remoteRec, entity);
          await store.put(entity, resolved, entity === 'inventory' ? 'sku' : 'id');
        }
      }

      await store.setMeta('sync.last', payload.serverTime || Date.now());
      await store.setMeta('sync.status', { state: 'synced', reason, at: Date.now() });
      bus.emit('sync:complete');

      this._attempt = 0;
    } catch (e) {
      await store.setMeta('sync.status', {
        state: 'error',
        reason: String(e.message || e),
        at: Date.now()
      });
      bus.emit('sync:error', e);
      notify('Sync error', String(e.message || e));
      const delay = backoff(this._attempt++);
      setTimeout(() => this.kick('retry'), delay);
    } finally {
      this._busy = false;
    }
  }
};
