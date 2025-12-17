import { printManager } from '../src/printManager.js';

describe('PrintManager (basic)', () => {
  test('exposes required public API', () => {
    expect(printManager).toBeDefined();
    expect(typeof printManager.enqueue).toBe('function');
    expect(typeof printManager.list).toBe('function');
    expect(typeof printManager.processOnce).toBe('function');
  });
});
