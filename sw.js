// Always load the latest commit: fetch this site's files from the network, skipping the
// browser cache (GitHub Pages caches for 10 minutes). Falls back to the last copy offline.
const CACHE='tracker';
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET'||new URL(req.url).origin!==location.origin)return;
  e.respondWith(fetch(req,{cache:'no-store'}).then(res=>{
    if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy))}
    return res;
  }).catch(()=>caches.match(req,{ignoreSearch:true})));
});
