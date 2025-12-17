import { openDB } from 'idb';

export const DB_NAME = 'pos-db';
export const DB_VERSION = 2;

export const dbPromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(db, oldVersion, newVersion, transaction) {

    // Version 1 stores
    if (oldVersion < 1) {
      db.createObjectStore('products', { keyPath: 'id' });
      db.createObjectStore('orders', { keyPath: 'id' });
      db.createObjectStore('inventory', { keyPath: 'sku' });
      db.createObjectStore('printJobs', { keyPath: 'id' });
      db.createObjectStore('oplog', { keyPath: 'opId' });
      db.createObjectStore('meta', { keyPath: 'key' });
    }

    // Version 2 indexes (IMPORTANT FIX)
    if (oldVersion < 2) {
      const productStore = transaction.objectStore('products');
      productStore.createIndex('byName', 'name');
      productStore.createIndex('byCategory', 'category');

      const orderStore = transaction.objectStore('orders');
      orderStore.createIndex('byStatus', 'status');
      orderStore.createIndex('byCreatedAt', 'createdAt');
    }
  }
});
