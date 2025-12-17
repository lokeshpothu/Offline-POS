import { store } from './offlineStore';
import { escposReceipt } from './escpos';
import { notify } from './toast';

// Required capabilities:
// 1) Multiple destinations 2) Retry logic 3) Prioritization 4) Templates
// Persistence across restarts: stored in IndexedDB printJobs
// Error handling + user notifications: notify()

export class PrintJobManager {
  async enqueue({ destination='receipt', priority=5, payload }){
    const job = {
      id: 'pj_' + Math.random().toString(16).slice(2) + '_' + Date.now().toString(16),
      destination,
      priority,
      payload,
      status: 'queued',
      attempts: 0,
      lastError: null,
      createdAt: Date.now()
    };
    await store.put('printJobs', job, 'id');
    notify('Print queued', `Destination: ${destination}`);
    return job.id;
  }

  async list(){
    const jobs = await store.getAll('printJobs');
    jobs.sort((a,b)=> (a.status===b.status? (a.priority-b.priority) : (a.status==='queued'?-1:1)) );
    return jobs;
  }

  async _simulatePrinterSend(job){
    // Demo printer: randomly fail sometimes to prove retries
    if (Math.random() < 0.18) throw new Error('Printer not reachable');
    return true;
  }

  async processOnce(){
    const jobs = await this.list();
    const queued = jobs.filter(j => j.status === 'queued').sort((a,b)=>a.priority-b.priority);
    if (!queued.length) return;

    const job = queued[0];
    job.attempts += 1;
    job.status = 'printing';
    await store.put('printJobs', job, 'id');

    try {
      // Template selection (receipt/kitchen/bar)
      let data = '';
      if (job.destination === 'receipt'){
        const { order } = job.payload;
        data = escposReceipt({
          header: 'FOOD TRUCK POS',
          lines: order.lines.map(l => ({ name: l.name, qty: l.qty, price: l.lineTotal, note: l.specialRequest || '' })),
          total: order.total,
          footer: 'Thank you!'
        });
      } else {
        data = '[TEMPLATE:' + job.destination.toUpperCase() + '] ' + JSON.stringify(job.payload).slice(0, 140);
      }

      await this._simulatePrinterSend(job);
      job.status = 'done';
      job.lastError = null;
      await store.put('printJobs', job, 'id');
      notify('Printed', `Job ${job.id} (${job.destination})`);
    } catch (e) {
      job.status = 'queued';
      job.lastError = String(e.message || e);
      await store.put('printJobs', job, 'id');
      notify('Print failed', `${job.lastError} (retry queued)`);
      // Retry policy handled by UI timer calling processOnce periodically
    }
  }

  async clearDone(){
    const jobs = await this.list();
    for (const j of jobs){
      if (j.status === 'done') await store.del('printJobs', j.id);
    }
  }
}

export const printManager = new PrintJobManager();
