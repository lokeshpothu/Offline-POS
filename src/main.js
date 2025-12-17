import './styles.css';
import { uiInit } from './ui';
import { registerSW } from './pwa';
import { syncEngine } from './syncEngine';
import { device } from './runtime';

registerSW();
uiInit();

// Start sync loop (online + interval)
window.addEventListener('online', () => syncEngine.kick('online'));
setInterval(() => syncEngine.kick('interval'), 5000);

// Keep a stable device id (for conflict resolution)
device.ensureDeviceId();
