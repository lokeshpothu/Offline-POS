
import { syncEngine } from '../src/syncEngine.js';

test('sync engine initializes with idle state', () => {
  expect(syncEngine._busy).toBe(false);
});
