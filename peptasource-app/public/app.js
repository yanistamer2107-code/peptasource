// Helpers partagés : appels API + notifications
const api = {
  async get(url){ const r = await fetch(url, { credentials:'same-origin' }); return safe(r); },
  async post(url, body){ return send('POST', url, body); },
  async put(url, body){ return send('PUT', url, body); },
  async patch(url, body){ return send('PATCH', url, body); },
  async del(url){ return send('DELETE', url); },
  async me(){ try { const { user } = await api.get('/api/auth/me'); return user; } catch { return null; } },
};
async function send(method, url, body){
  const r = await fetch(url, {
    method, credentials:'same-origin',
    headers:{ 'Content-Type':'application/json' },
    body: body!==undefined ? JSON.stringify(body) : undefined
  });
  return safe(r);
}
async function safe(r){
  let data = {};
  try { data = await r.json(); } catch {}
  if(!r.ok && !data.error) data.error = 'Erreur réseau ('+r.status+').';
  return data;
}

let _toastTimer;
function toast(msg, isErr=false){
  const el = document.getElementById('toast');
  if(!el) return;
  el.querySelector('.t').textContent = msg;
  el.classList.toggle('err', isErr);
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(()=>el.classList.remove('show'), 3200);
}
