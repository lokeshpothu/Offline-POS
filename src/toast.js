let timer = null;

export function notify(title, msg){
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<div class="title">${escapeHtml(title)}</div><div class="msg">${escapeHtml(msg)}</div>`;
  document.body.appendChild(el);
  clearTimeout(timer);
  timer = setTimeout(() => {
    el.remove();
  }, 5000);
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, (c)=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
