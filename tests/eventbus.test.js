import { EventBus } from '../src/eventbus.js';

test('event bus delivers events to subscribers', () => {
  const bus = new EventBus();
  let received = null;

  bus.on('ping', (data) => {
    received = data;
  });

  bus.emit('ping', 'hello');

  expect(received).toBe('hello');
});
