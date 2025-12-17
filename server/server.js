import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// In-memory DB for demo (server-side). In real deployments this is your backend DB.
const db = {
  products: new Map(),
  orders: new Map(),
  inventory: new Map(),
  changes: [] // {entity, record, at}
};

const now = () => Date.now();

function recordChange(entity, record){
  db.changes.push({ entity, record, at: now() });
  // basic pruning on server change log
  if (db.changes.length > 5000) db.changes.splice(0, 1000);
}

// Seed server with a few products to support pull demo
function seedServer(){
  if (db.products.size) return;
  for (let i=0;i<20;i++){
    const sku = 'SRV' + String(i).padStart(3,'0');
    const rec = { id: sku, sku, name: 'Server Item ' + (i+1), category:'Server', basePrice: 3.5 + i*0.2, options:{ sizes:[{label:'M',delta:0}], addons:[] }, version:1, updatedAt: now() };
    db.products.set(sku, rec);
    recordChange('products', rec);
  }
}
seedServer();

// PUSH: client oplog operations
app.post('/api/sync/push', (req, res) => {
  const ops = (req.body && req.body.ops) || [];
  const applied = [];
  for (const op of ops){
    const { opId, type, entity, key, payload } = op;
    if (!['products','orders','inventory'].includes(entity)) { applied.push(opId); continue; }
    const map = db[entity];
    if (type === 'PUT'){
      const rec = payload;
      map.set(key, rec);
      recordChange(entity, rec);
      applied.push(opId);
    } else if (type === 'DEL'){
      map.delete(key);
      recordChange(entity, { id:key, deleted:true, updatedAt: now(), version: 999999 });
      applied.push(opId);
    }
  }
  res.json({ ok:true, applied });
});

// PULL: server changes since timestamp
app.get('/api/sync/pull', (req, res) => {
  const since = Number(req.query.since || 0);
  const changes = db.changes.filter(c => c.at > since);
  const out = { products:[], orders:[], inventory:[], serverTime: now() };
  for (const c of changes){
    out[c.entity].push(c.record);
  }
  // Support partial sync: return at most N changes per entity
  const N = 500;
  for (const k of ['products','orders','inventory']){
    if (out[k].length > N) out[k] = out[k].slice(-N);
  }
  res.json(out);
});

app.listen(8787, () => console.log('Mock POS API running on http://localhost:8787'));
