export class EventBus {
  constructor(){ this.map = new Map(); }
  on(evt, fn){
    const arr = this.map.get(evt) || [];
    arr.push(fn);
    this.map.set(evt, arr);
    return () => this.off(evt, fn);
  }
  off(evt, fn){
    const arr = this.map.get(evt) || [];
    this.map.set(evt, arr.filter(x => x !== fn));
  }
  emit(evt, payload){
    const arr = this.map.get(evt) || [];
    for (const fn of arr) { try { fn(payload); } catch(e){ console.error(e); } }
  }
}

export const bus = new EventBus();
