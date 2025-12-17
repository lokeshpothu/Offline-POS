export const device = {
  idKey: 'pos.deviceId',
  ensureDeviceId(){
    let id = localStorage.getItem(this.idKey);
    if (!id){
      id = 'dev_' + Math.random().toString(16).slice(2) + '_' + Date.now().toString(16);
      localStorage.setItem(this.idKey, id);
    }
    return id;
  },
  getId(){ return localStorage.getItem(this.idKey) || this.ensureDeviceId(); }
};
