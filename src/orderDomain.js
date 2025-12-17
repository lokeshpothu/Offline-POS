import { store } from './offlineStore';
import { device } from './runtime';
// jest.mock('../src/db', () => ({}));


function money(n){ return Math.round(n*100)/100; }

export function calcLine(product, { size='M', addons=[], qty=1, specialRequest='' } = {}){
  const sizeObj = product.options.sizes.find(s => s.label===size) || product.options.sizes[1];
  const addonsObj = addons.map(a => product.options.addons.find(x => x.label===a)).filter(Boolean);
  const unit = product.basePrice + sizeObj.delta + addonsObj.reduce((s,a)=>s+a.delta,0);
  const lineTotal = money(unit * qty);
  return {
    sku: product.sku,
    name: product.name,
    size,
    addons,
    qty,
    specialRequest,
    unitPrice: money(unit),
    lineTotal
  };
}

export function calcOrder(lines){
  const subtotal = money(lines.reduce((s,l)=>s+l.lineTotal,0));
  const tax = money(subtotal * 0.05);
  const total = money(subtotal + tax);
  return { subtotal, tax, total };
}

export async function createOrderFromCart(cart){
  const now = Date.now();
  const id = 'ord_' + now.toString(16) + '_' + Math.random().toString(16).slice(2);
  const totals = calcOrder(cart.lines);
  const order = {
    id,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    deviceId: device.getId(),
    version: 1,
    ...totals,
    lines: cart.lines
  };
  await store.put('orders', order, 'id');
  return order;
}

export async function updateOrderStatus(orderId, nextStatus){
  const order = await store.get('orders', orderId);
  if (!order) return null;
  const now = Date.now();
  const allowed = {
    pending: ['preparing'],
    preparing: ['ready'],
    ready: ['completed'],
    completed: []
  };
  if (!allowed[order.status].includes(nextStatus)) return order;

  order.status = nextStatus;
  order.updatedAt = now;
  order.version = (order.version || 1) + 1;
  await store.put('orders', order, 'id');
  return order;
}
