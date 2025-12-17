import { calcOrder } from '../src/orderDomain.js';

describe('Order calculations (pure logic)', () => {
  test('calculates subtotal correctly', () => {
    const lines = [
      { unitPrice: 100, qty: 2, lineTotal: 200 },
      { unitPrice: 50, qty: 1, lineTotal: 50 }
    ];

    const totals = calcOrder(lines);
    expect(totals.subtotal).toBe(250);
  });

  test('applies tax correctly', () => {
    const lines = [
      { unitPrice: 100, qty: 1, lineTotal: 100 }
    ];

    const totals = calcOrder(lines);
    expect(totals.tax).toBeGreaterThan(0);
    expect(totals.total).toBeGreaterThan(totals.subtotal);
  });
});
