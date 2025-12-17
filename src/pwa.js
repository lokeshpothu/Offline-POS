export async function registerSW(){
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('/sw.js');
  } catch (e) {
    // non-fatal
    console.warn('SW registration failed', e);
  }
}
