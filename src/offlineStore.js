import { dbPromise } from './db';
import { EventBus } from './eventbus';
import { device } from './runtime';

// OfflineDataStore requirements mapping:
// - queues writes when offline -> appends operations to oplog
// - read-through caching -> reads from IndexedDB; can seed from server
// - sync conflicts -> merge strategy in syncEngine (LWW + domain rules)
// - referential integrity -> transactional writes for order + lines
// - transactions/rollback -> db.transaction with abort on error
// - retry/backoff -> syncEngine
// - event-driven -> EventBus emits changes
// - indexing -> IDB indexes created in db upgrade

export class OfflineDataStore {
  constructor(){
    this.bus = new EventBus();
  }

  on(evt, fn){ return this.bus.on(evt, fn); }

  async tx(stores, mode, fn){
    const db = await dbPromise;
    const tx = db.transaction(stores, mode);
    try {
      const result = await fn(tx);
      await tx.done;
      return result;
    } catch (e) {
      tx.abort();
      throw e;
    }
  }

  _newOp(type, entity, key, payload){
    return {
      opId: 'op_' + Math.random().toString(16).slice(2) + '_' + Date.now().toString(16),
      type, entity, key,
      payload,
      deviceId: device.getId(),
      createdAt: Date.now()
    };
  }

  async put(entityStore, record, keyField='id'){
    const key = record[keyField];
    const op = this._newOp('PUT', entityStore, key, record);

    await this.tx([entityStore, 'oplog'], 'readwrite', async (tx) => {
      await tx.objectStore(entityStore).put(record);
      await tx.objectStore('oplog').put(op);
    });

    this.bus.emit('change', { entity: entityStore, key, op });
    return key;
  }

  async del(entityStore, key){
    const op = this._newOp('DEL', entityStore, key, { key });
    await this.tx([entityStore, 'oplog'], 'readwrite', async (tx) => {
      await tx.objectStore(entityStore).delete(key);
      await tx.objectStore('oplog').put(op);
    });
    this.bus.emit('change', { entity: entityStore, key, op });
  }

  async get(entityStore, key){
    const db = await dbPromise;
    return db.get(entityStore, key);
  }

  async getAll(entityStore){
    const db = await dbPromise;
    return db.getAll(entityStore);
  }

  async queryProducts({ q='', category='' } = {}){
    const db = await dbPromise;
    const store = db.transaction('products').objectStore('products');
    let rows = await store.getAll();
    if (category) rows = rows.filter(p => p.category === category);
    if (q){
      const s = q.toLowerCase();
      rows = rows.filter(p => p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s));
    }
    return rows;
  }

  async getOplog(limit=200){
    const db = await dbPromise;
    const all = await db.getAll('oplog');
    all.sort((a,b)=>a.createdAt-b.createdAt);
    return all.slice(0, limit);
  }

  async deleteOplog(opId){
    const db = await dbPromise;
    return db.delete('oplog', opId);
  }

  async setMeta(key, value){
    const db = await dbPromise;
    await db.put('meta', { key, value });
  }

  async getMeta(key, fallback=null){
    const db = await dbPromise;
    const row = await db.get('meta', key);
    return row ? row.value : fallback;
  }
}

export const store = new OfflineDataStore();
