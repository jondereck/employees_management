if(!self.define){let e,a={};const s=(s,t)=>(s=new URL(s+".js",t).href,a[s]||new Promise((a=>{if("document"in self){const e=document.createElement("script");e.src=s,e.onload=a,document.head.appendChild(e)}else e=s,importScripts(s),a()})).then((()=>{let e=a[s];if(!e)throw new Error(`Module ${s} didn’t register its module`);return e})));self.define=(t,c)=>{const n=e||("document"in self?document.currentScript.src:"")||location.href;if(a[n])return;let i={};const r=e=>s(e,n),d={module:{uri:n},exports:i,require:r};a[n]=Promise.all(t.map((e=>d[e]||r(e)))).then((e=>(c(...e),i)))}}define(["./workbox-4754cb34"],(function(e){"use strict";importScripts(),self.skipWaiting(),e.clientsClaim(),e.precacheAndRoute([{url:"/_next/app-build-manifest.json",revision:"a28c4edff32e65afecaa17df90c4f63e"},{url:"/_next/static/Jq_ZKVDdvEaehG7cghwea/_buildManifest.js",revision:"f73e8c19daa8474d229371b8da40f744"},{url:"/_next/static/Jq_ZKVDdvEaehG7cghwea/_ssgManifest.js",revision:"b6652df95db52feb4daf4eca35380933"},{url:"/_next/static/chunks/0e5ce63c-fa042ff66616226f.js",revision:"Jq_ZKVDdvEaehG7cghwea"},{url:"/_next/static/chunks/1255-33d0bd81428600e7.js",revision:"Jq_ZKVDdvEaehG7cghwea"},{url:"/_next/static/chunks/1379-2c8c74f591d3c853.js",revision:"Jq_ZKVDdvEaehG7cghwea"},{url:"/_next/static/chunks/138-13104b5d46b706c0.js",revision:"Jq_ZKVDdvEaehG7cghwea"},{url:"/_next/static/chunks/13b76428-ccac6b34b8b9518b.js",revision:"Jq_ZKVDdvEaehG7cghwea"},{url:"/_next/static/chunks/2057-e72d51ba6dad9ddd.js",revision:"Jq_ZKVDdvEaehG7cghwea"},{url:"/_next/static/chunks/2593-38236a64d1a5a536.js",revision:"Jq_ZKVDdvEaehG7cghwea"},{url:"/_next/static/chunks/2647-672addfbc83eb6a3.js",revision:"Jq_ZKVDdvEaehG7cghwea"},{url:"/_next/static/chunks/2807-3ba3c2a190094762.js",revision:"Jq_ZKVDdvEaehG7cghwea"},{url:"/_next/static/chunks/3563-d141749021abd11a.js",revision:"Jq_ZKVDdvEaehG7cghwea"},{url:"/_next/static/chunks/4059-1fd0e123940a1c40.js",revision:"Jq_ZKVDdvEaehG7cghwea"},{url:"/_next/static/chunks/4073-3610fadb11d9ac4c.js",revision:"Jq_ZKVDdvEaehG7cghwea"},{url:"/_next/static/chunks/4431-ae8d3f5450d2dc1d.js",revision:"Jq_ZKVDdvEaehG7cghwea"},{url:"/_next/static/chunks/4460-bad4fe86818359b9.js",revision:"Jq_ZKVDdvEaehG7cghwea"},{url:"/_next/static/chunks/5526-eb060c7ef17325b7.js",revision:"Jq_ZKVDdvEaehG7cghwea"},{url:"/_next/static/chunks/585-ef20c69470a9923d.js",revision:"Jq_ZKVDdvEaehG7cghwea"},{url:"/_next/static/chunks/596-a9f1b868ebfe4c8e.js",revision:"Jq_ZKVDdvEaehG7cghwea"},{url:"/_next/static/chunks/6065-542c1e5585e97cdc.js",revision:"Jq_ZKVDdvEaehG7cghwea"},{url:"/_next/static/chunks/6685-116868070858b26a.js",revision:"Jq_ZKVDdvEaehG7cghwea"},{url:"/_next/static/chunks/6691-c5561caa668da03a.js",revision:"Jq_ZKVDdvEaehG7cghwea"},{url:"/_next/static/chunks/6767-d85bea9249ca63b5.js",revision:"Jq_ZKVDdvEaehG7cghwea"},{url:"/_next/static/chunks/7016-1b752c41838ee19f.js",revision:"Jq_ZKVDdvEaehG7cghwea"},{url:"/_next/static/chunks/786-94f0f55edb4e0d9b.js",revision:"Jq_ZKVDdvEaehG7cghwea"},{url:"/_next/static/chunks/7931-829e272c77bb0939.js",revision:"Jq_ZKVDdvEaehG7cghwea"},{url:"/_next/static/chunks/8111-934e66b999655659.js",revision:"Jq_ZKVDdvEaehG7cghwea"},{url:"/_next/static/chunks/8746-5ba5ff359aa9aefa.js",revision:"Jq_ZKVDdvEaehG7cghwea"},{url:"/_next/static/chunks/909-a234685b3c3910f6.js",revision:"Jq_ZKVDdvEaehG7cghwea"},{url:"/_next/static/chunks/917-45ea31746c945699.js",revision:"Jq_ZKVDdvEaehG7cghwea"},{url:"/_next/static/chunks/9222-0b87edff29c22664.js",revision:"Jq_ZKVDdvEaehG7cghwea"},{url:"/_next/static/chunks/9233-45ede1723909f682.js",revision:"Jq_ZKVDdvEaehG7cghwea"},{url:"/_next/static/chunks/9518-66150b40624de3e5.js",revision:"Jq_ZKVDdvEaehG7cghwea"},{url:"/_next/static/chunks/9842-9b2e2d07c936371c.js",revision:"Jq_ZKVDdvEaehG7cghwea"},{url:"/_next/static/chunks/app/(auth)/(routes)/sign-in/%5B%5B...sign-in%5D%5D/page-1501578b66f41514.js",revision:"Jq_ZKVDdvEaehG7cghwea"},{url:"/_next/static/chunks/app/(auth)/(routes)/sign-up/%5B%5B...sign-up%5D%5D/page-7139400e7c77b897.js",revision:"Jq_ZKVDdvEaehG7cghwea"},{url:"/_next/static/chunks/app/(auth)/layout-0376041caa7b4c0d.js",revision:"Jq_ZKVDdvEaehG7cghwea"},{url:"/_next/static/chunks/app/(dashboard)/%5BdepartmentId%5D/(routes)/(frontend)/view/employee/%5BemployeeId%5D/page-d53b5ffb00e9ac62.js",revision:"Jq_ZKVDdvEaehG7cghwea"},{url:"/_next/static/chunks/app/(dashboard)/%5BdepartmentId%5D/(routes)/(frontend)/view/offices/%5BofficeId%5D/page-d3ea31e1f234dee5.js",revision:"Jq_ZKVDdvEaehG7cghwea"},{url:"/_next/static/chunks/app/(dashboard)/%5BdepartmentId%5D/(routes)/(frontend)/view/page-2a56ca2953212709.js",revision:"Jq_ZKVDdvEaehG7cghwea"},{url:"/_next/static/chunks/app/(dashboard)/%5BdepartmentId%5D/(routes)/billboards/%5BbillboardId%5D/page-4b7da067802892b8.js",revision:"Jq_ZKVDdvEaehG7cghwea"},{url:"/_next/static/chunks/app/(dashboard)/%5BdepartmentId%5D/(routes)/billboards/page-ad42497c2a1e0e25.js",revision:"Jq_ZKVDdvEaehG7cghwea"},{url:"/_next/static/chunks/app/(dashboard)/%5BdepartmentId%5D/(routes)/eligibility/%5BeligibilityId%5D/page-fcd71f0922691b8c.js",revision:"Jq_ZKVDdvEaehG7cghwea"},{url:"/_next/static/chunks/app/(dashboard)/%5BdepartmentId%5D/(routes)/eligibility/page-f09e578369888769.js",revision:"Jq_ZKVDdvEaehG7cghwea"},{url:"/_next/static/chunks/app/(dashboard)/%5BdepartmentId%5D/(routes)/employee_type/%5BemployeeTypeId%5D/page-054bbda795a4ee05.js",revision:"Jq_ZKVDdvEaehG7cghwea"},{url:"/_next/static/chunks/app/(dashboard)/%5BdepartmentId%5D/(routes)/employee_type/page-684b60ec4813f45a.js",revision:"Jq_ZKVDdvEaehG7cghwea"},{url:"/_next/static/chunks/app/(dashboard)/%5BdepartmentId%5D/(routes)/employees/%5BemployeesId%5D/page-e8b917cc6a177a83.js",revision:"Jq_ZKVDdvEaehG7cghwea"},{url:"/_next/static/chunks/app/(dashboard)/%5BdepartmentId%5D/(routes)/employees/page-85279897b99e9466.js",revision:"Jq_ZKVDdvEaehG7cghwea"},{url:"/_next/static/chunks/app/(dashboard)/%5BdepartmentId%5D/(routes)/offices/%5BofficeId%5D/page-67e1b37776dd8fd6.js",revision:"Jq_ZKVDdvEaehG7cghwea"},{url:"/_next/static/chunks/app/(dashboard)/%5BdepartmentId%5D/(routes)/offices/page-56cea5d1aca00c14.js",revision:"Jq_ZKVDdvEaehG7cghwea"},{url:"/_next/static/chunks/app/(dashboard)/%5BdepartmentId%5D/(routes)/page-df9b0272abef753b.js",revision:"Jq_ZKVDdvEaehG7cghwea"},{url:"/_next/static/chunks/app/(dashboard)/%5BdepartmentId%5D/(routes)/settings/page-66998e923b6f60c6.js",revision:"Jq_ZKVDdvEaehG7cghwea"},{url:"/_next/static/chunks/app/(dashboard)/%5BdepartmentId%5D/layout-c1b6eae318c5e6b7.js",revision:"Jq_ZKVDdvEaehG7cghwea"},{url:"/_next/static/chunks/app/(root)/(routes)/page-10e672fb181c68e7.js",revision:"Jq_ZKVDdvEaehG7cghwea"},{url:"/_next/static/chunks/app/(root)/layout-103e5d5139180184.js",revision:"Jq_ZKVDdvEaehG7cghwea"},{url:"/_next/static/chunks/app/layout-32a05c093ba1d1f5.js",revision:"Jq_ZKVDdvEaehG7cghwea"},{url:"/_next/static/chunks/app/loading-38b0c80198598597.js",revision:"Jq_ZKVDdvEaehG7cghwea"},{url:"/_next/static/chunks/fd9d1056-c342f7a9ec5f72d3.js",revision:"Jq_ZKVDdvEaehG7cghwea"},{url:"/_next/static/chunks/framework-4498e84bb0ba1830.js",revision:"Jq_ZKVDdvEaehG7cghwea"},{url:"/_next/static/chunks/main-7f10751864eccf37.js",revision:"Jq_ZKVDdvEaehG7cghwea"},{url:"/_next/static/chunks/main-app-eea8ab6446f8d1e2.js",revision:"Jq_ZKVDdvEaehG7cghwea"},{url:"/_next/static/chunks/pages/_app-8af45f6c5c3cbc8e.js",revision:"Jq_ZKVDdvEaehG7cghwea"},{url:"/_next/static/chunks/pages/_error-6aec2ce618e2a362.js",revision:"Jq_ZKVDdvEaehG7cghwea"},{url:"/_next/static/chunks/polyfills-78c92fac7aa8fdd8.js",revision:"79330112775102f91e1010318bae2bd3"},{url:"/_next/static/chunks/webpack-9ea22fc59a94464c.js",revision:"Jq_ZKVDdvEaehG7cghwea"},{url:"/_next/static/css/22aecb0fc7232875.css",revision:"22aecb0fc7232875"},{url:"/_next/static/media/26a46d62cd723877-s.woff2",revision:"befd9c0fdfa3d8a645d5f95717ed6420"},{url:"/_next/static/media/55c55f0601d81cf3-s.woff2",revision:"43828e14271c77b87e3ed582dbff9f74"},{url:"/_next/static/media/581909926a08bbc8-s.woff2",revision:"f0b86e7c24f455280b8df606b89af891"},{url:"/_next/static/media/6d93bde91c0c2823-s.woff2",revision:"621a07228c8ccbfd647918f1021b4868"},{url:"/_next/static/media/97e0cb1ae144a2a9-s.woff2",revision:"e360c61c5bd8d90639fd4503c829c2dc"},{url:"/_next/static/media/a34f9d1faa5f3315-s.p.woff2",revision:"d4fe31e6a2aebc06b8d6e558c9141119"},{url:"/_next/static/media/df0a9ae256c0569c-s.woff2",revision:"d54db44de5ccb18886ece2fda72bdfe0"},{url:"/icon-192x192.png",revision:"2a0780bf6e7df6df5075624548cccfe9"},{url:"/icon-256x256.png",revision:"e55934cdd61c42e5a45dc5718f65d5b4"},{url:"/icon-384x384.png",revision:"b32c1e0bf94752d5347921305ac4774b"},{url:"/icon-512x512.png",revision:"ab7c54f2b743757e9486555fd843dda5"},{url:"/manifest.json",revision:"429eee2d6251254860fe5a2332e2c79d"},{url:"/next.svg",revision:"8e061864f388b47f33a1c3780831193e"},{url:"/service-worker.js",revision:"54446edad877f5d04b00f1f2f6f7872e"},{url:"/vercel.svg",revision:"61c6b19abff40ea7acd577be818f3976"}],{ignoreURLParametersMatching:[]}),e.cleanupOutdatedCaches(),e.registerRoute("/",new e.NetworkFirst({cacheName:"start-url",plugins:[{cacheWillUpdate:async({request:e,response:a,event:s,state:t})=>a&&"opaqueredirect"===a.type?new Response(a.body,{status:200,statusText:"OK",headers:a.headers}):a}]}),"GET"),e.registerRoute(/^https:\/\/fonts\.(?:gstatic)\.com\/.*/i,new e.CacheFirst({cacheName:"google-fonts-webfonts",plugins:[new e.ExpirationPlugin({maxEntries:4,maxAgeSeconds:31536e3})]}),"GET"),e.registerRoute(/^https:\/\/fonts\.(?:googleapis)\.com\/.*/i,new e.StaleWhileRevalidate({cacheName:"google-fonts-stylesheets",plugins:[new e.ExpirationPlugin({maxEntries:4,maxAgeSeconds:604800})]}),"GET"),e.registerRoute(/\.(?:eot|otf|ttc|ttf|woff|woff2|font.css)$/i,new e.StaleWhileRevalidate({cacheName:"static-font-assets",plugins:[new e.ExpirationPlugin({maxEntries:4,maxAgeSeconds:604800})]}),"GET"),e.registerRoute(/\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,new e.StaleWhileRevalidate({cacheName:"static-image-assets",plugins:[new e.ExpirationPlugin({maxEntries:64,maxAgeSeconds:86400})]}),"GET"),e.registerRoute(/\/_next\/image\?url=.+$/i,new e.StaleWhileRevalidate({cacheName:"next-image",plugins:[new e.ExpirationPlugin({maxEntries:64,maxAgeSeconds:86400})]}),"GET"),e.registerRoute(/\.(?:mp3|wav|ogg)$/i,new e.CacheFirst({cacheName:"static-audio-assets",plugins:[new e.RangeRequestsPlugin,new e.ExpirationPlugin({maxEntries:32,maxAgeSeconds:86400})]}),"GET"),e.registerRoute(/\.(?:mp4)$/i,new e.CacheFirst({cacheName:"static-video-assets",plugins:[new e.RangeRequestsPlugin,new e.ExpirationPlugin({maxEntries:32,maxAgeSeconds:86400})]}),"GET"),e.registerRoute(/\.(?:js)$/i,new e.StaleWhileRevalidate({cacheName:"static-js-assets",plugins:[new e.ExpirationPlugin({maxEntries:32,maxAgeSeconds:86400})]}),"GET"),e.registerRoute(/\.(?:css|less)$/i,new e.StaleWhileRevalidate({cacheName:"static-style-assets",plugins:[new e.ExpirationPlugin({maxEntries:32,maxAgeSeconds:86400})]}),"GET"),e.registerRoute(/\/_next\/data\/.+\/.+\.json$/i,new e.StaleWhileRevalidate({cacheName:"next-data",plugins:[new e.ExpirationPlugin({maxEntries:32,maxAgeSeconds:86400})]}),"GET"),e.registerRoute(/\.(?:json|xml|csv)$/i,new e.NetworkFirst({cacheName:"static-data-assets",plugins:[new e.ExpirationPlugin({maxEntries:32,maxAgeSeconds:86400})]}),"GET"),e.registerRoute((({url:e})=>{if(!(self.origin===e.origin))return!1;const a=e.pathname;return!a.startsWith("/api/auth/")&&!!a.startsWith("/api/")}),new e.NetworkFirst({cacheName:"apis",networkTimeoutSeconds:10,plugins:[new e.ExpirationPlugin({maxEntries:16,maxAgeSeconds:86400})]}),"GET"),e.registerRoute((({url:e})=>{if(!(self.origin===e.origin))return!1;return!e.pathname.startsWith("/api/")}),new e.NetworkFirst({cacheName:"others",networkTimeoutSeconds:10,plugins:[new e.ExpirationPlugin({maxEntries:32,maxAgeSeconds:86400})]}),"GET"),e.registerRoute((({url:e})=>!(self.origin===e.origin)),new e.NetworkFirst({cacheName:"cross-origin",networkTimeoutSeconds:10,plugins:[new e.ExpirationPlugin({maxEntries:32,maxAgeSeconds:3600})]}),"GET")}));
