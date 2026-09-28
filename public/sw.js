const CACHE='jeongjin-kendo-build-20260919-12';
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(
  caches.keys()
    .then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
    .then(()=>self.clients.claim())
    .then(()=>self.clients.matchAll({type:'window',includeUncontrolled:true}))
    .then(clients=>Promise.all(clients.map(client=>client.navigate(client.url))))
));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  // The document and manifest must always ask Vercel for the newest build.
  if(event.request.mode==='navigate'||url.pathname.endsWith('manifest.webmanifest')){event.respondWith(fetch(event.request).catch(()=>caches.match(event.request)));return;}
  // Only hashed static assets may be reused offline.
  if(!/\/assets\/.+\.[a-z0-9_-]{8,}\.(js|css)$/.test(url.pathname))return;
  event.respondWith(caches.open(CACHE).then(cache=>cache.match(event.request).then(hit=>hit||fetch(event.request).then(response=>{cache.put(event.request,response.clone());return response;}))));
});
