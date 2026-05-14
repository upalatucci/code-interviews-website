(()=>{var a={};a.id=14,a.ids=[14],a.modules={261:a=>{"use strict";a.exports=require("next/dist/shared/lib/router/utils/app-paths")},2502:a=>{"use strict";a.exports=import("prettier/plugins/html")},2549:(a,b,c)=>{"use strict";c.d(b,{N:()=>h});var d=c(29662),e=c(28342),f=c(27143);function g(a){return{id:a.id,name:a.name,email:a.email,emailVerified:a.email_verified?new Date(a.email_verified):null,image:a.image}}let h={adapter:{async createUser(a){await (0,f.K_)();let{rows:b}=await (0,f.ll)`
        INSERT INTO auth_users (email, name, email_verified, image)
        VALUES (${a.email}, ${a.name??null}, ${a.emailVerified?.toISOString()??null}, ${a.image??null})
        RETURNING *
      `;return g(b[0])},async getUser(a){await (0,f.K_)();let{rows:b}=await (0,f.ll)`SELECT * FROM auth_users WHERE id = ${a}`;return b.length?g(b[0]):null},async getUserByEmail(a){await (0,f.K_)();let{rows:b}=await (0,f.ll)`SELECT * FROM auth_users WHERE email = ${a}`;return b.length?g(b[0]):null},async updateUser(a){await (0,f.K_)();let{rows:b}=await (0,f.ll)`
        UPDATE auth_users
        SET name = ${a.name??null},
            email_verified = ${a.emailVerified?.toISOString()??null}
        WHERE id = ${a.id}
        RETURNING *
      `;return g(b[0])},createVerificationToken:async({identifier:a,expires:b,token:c})=>(await (0,f.K_)(),await (0,f.ll)`
        INSERT INTO auth_verification_tokens (identifier, token, expires)
        VALUES (${a}, ${c}, ${b.toISOString()})
        ON CONFLICT (identifier, token)
        DO UPDATE SET expires = EXCLUDED.expires
      `,{identifier:a,token:c,expires:b}),async useVerificationToken({identifier:a,token:b}){await (0,f.K_)();let{rows:c}=await (0,f.ll)`
        DELETE FROM auth_verification_tokens
        WHERE identifier = ${a} AND token = ${b}
        RETURNING *
      `;if(!c.length)return null;let d=c[0];return{identifier:d.identifier,token:d.token,expires:new Date(d.expires)}},getUserByAccount:async()=>null,async linkAccount(){},createSession:async a=>a,getSessionAndUser:async()=>null,updateSession:async()=>null,async deleteSession(){},async deleteUser(){},async unlinkAccount(){}},providers:[(0,d.A)({sendVerificationRequest:async({identifier:a,url:b})=>{let c=new e.u(process.env.RESEND_API_KEY),d=process.env.AUTH_EMAIL_FROM??"noreply@example.com";await c.emails.send({from:d,to:a,subject:"Sign in to the Interview Platform",html:`
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
              <h2 style="color:#ee0000">Red Hat Interview Platform</h2>
              <p>Click the button below to sign in. This link expires in 24 hours.</p>
              <a href="${b}"
                 style="display:inline-block;background:#ee0000;color:#fff;padding:12px 24px;border-radius:4px;text-decoration:none;font-weight:600;margin:16px 0">
                Sign in
              </a>
              <p style="color:#666;font-size:13px">Or copy this URL into your browser:<br/>${b}</p>
            </div>
          `})}})],session:{strategy:"jwt"},pages:{signIn:"/auth/signin",verifyRequest:"/auth/verify-request",error:"/auth/signin"},callbacks:{session:async({session:a,token:b})=>(b.sub&&(a.user.id=b.sub),a)}}},3295:a=>{"use strict";a.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},3421:(a,b,c)=>{"use strict";Object.defineProperty(b,"I",{enumerable:!0,get:function(){return g}});let d=c(71237),e=c(55088),f=c(17679);async function g(a,b,c,g){if((0,d.isNodeNextResponse)(b)){var h;b.statusCode=c.status,b.statusMessage=c.statusText;let d=["set-cookie","www-authenticate","proxy-authenticate","vary"];null==(h=c.headers)||h.forEach((a,c)=>{if("x-middleware-set-cookie"!==c.toLowerCase())if("set-cookie"===c.toLowerCase())for(let d of(0,f.splitCookiesString)(a))b.appendHeader(c,d);else{let e=void 0!==b.getHeader(c);(d.includes(c.toLowerCase())||!e)&&b.appendHeader(c,a)}});let{originalResponse:i}=b;c.body&&"HEAD"!==a.method?await (0,e.pipeToNodeResponse)(c.body,i,g):i.end()}}},10846:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},11723:a=>{"use strict";a.exports=require("querystring")},12412:a=>{"use strict";a.exports=require("assert")},14329:(a,b,c)=>{"use strict";c.r(b),c.d(b,{handler:()=>D,patchFetch:()=>C,routeModule:()=>y,serverHooks:()=>B,workAsyncStorage:()=>z,workUnitAsyncStorage:()=>A});var d={};c.r(d),c.d(d,{GET:()=>x,POST:()=>x});var e=c(95736),f=c(9117),g=c(4044),h=c(39326),i=c(32324),j=c(261),k=c(54290),l=c(85328),m=c(38928),n=c(46595),o=c(3421),p=c(17679),q=c(41681),r=c(63446),s=c(86439),t=c(51356),u=c(52963),v=c.n(u),w=c(2549);let x=v()(w.N),y=new e.AppRouteRouteModule({definition:{kind:f.RouteKind.APP_ROUTE,page:"/api/auth/[...nextauth]/route",pathname:"/api/auth/[...nextauth]",filename:"route",bundlePath:"app/api/auth/[...nextauth]/route"},distDir:".next",relativeProjectDir:"",resolvedPagePath:"/Users/upalatuc/code-interviews-website/app/api/auth/[...nextauth]/route.ts",nextConfigOutput:"",userland:d}),{workAsyncStorage:z,workUnitAsyncStorage:A,serverHooks:B}=y;function C(){return(0,g.patchFetch)({workAsyncStorage:z,workUnitAsyncStorage:A})}async function D(a,b,c){var d;let e="/api/auth/[...nextauth]/route";"/index"===e&&(e="/");let g=await y.prepare(a,b,{srcPage:e,multiZoneDraftMode:!1});if(!g)return b.statusCode=400,b.end("Bad Request"),null==c.waitUntil||c.waitUntil.call(c,Promise.resolve()),null;let{buildId:u,params:v,nextConfig:w,isDraftMode:x,prerenderManifest:z,routerServerContext:A,isOnDemandRevalidate:B,revalidateOnlyGenerated:C,resolvedPathname:D}=g,E=(0,j.normalizeAppPath)(e),F=!!(z.dynamicRoutes[E]||z.routes[D]);if(F&&!x){let a=!!z.routes[D],b=z.dynamicRoutes[E];if(b&&!1===b.fallback&&!a)throw new s.NoFallbackError}let G=null;!F||y.isDev||x||(G="/index"===(G=D)?"/":G);let H=!0===y.isDev||!F,I=F&&!H,J=a.method||"GET",K=(0,i.getTracer)(),L=K.getActiveScopeSpan(),M={params:v,prerenderManifest:z,renderOpts:{experimental:{cacheComponents:!!w.experimental.cacheComponents,authInterrupts:!!w.experimental.authInterrupts},supportsDynamicResponse:H,incrementalCache:(0,h.getRequestMeta)(a,"incrementalCache"),cacheLifeProfiles:null==(d=w.experimental)?void 0:d.cacheLife,isRevalidate:I,waitUntil:c.waitUntil,onClose:a=>{b.on("close",a)},onAfterTaskError:void 0,onInstrumentationRequestError:(b,c,d)=>y.onRequestError(a,b,d,A)},sharedContext:{buildId:u}},N=new k.NodeNextRequest(a),O=new k.NodeNextResponse(b),P=l.NextRequestAdapter.fromNodeNextRequest(N,(0,l.signalFromNodeResponse)(b));try{let d=async c=>y.handle(P,M).finally(()=>{if(!c)return;c.setAttributes({"http.status_code":b.statusCode,"next.rsc":!1});let d=K.getRootSpanAttributes();if(!d)return;if(d.get("next.span_type")!==m.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${d.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let e=d.get("next.route");if(e){let a=`${J} ${e}`;c.setAttributes({"next.route":e,"http.route":e,"next.span_name":a}),c.updateName(a)}else c.updateName(`${J} ${a.url}`)}),g=async g=>{var i,j;let k=async({previousCacheEntry:f})=>{try{if(!(0,h.getRequestMeta)(a,"minimalMode")&&B&&C&&!f)return b.statusCode=404,b.setHeader("x-nextjs-cache","REVALIDATED"),b.end("This page could not be found"),null;let e=await d(g);a.fetchMetrics=M.renderOpts.fetchMetrics;let i=M.renderOpts.pendingWaitUntil;i&&c.waitUntil&&(c.waitUntil(i),i=void 0);let j=M.renderOpts.collectedTags;if(!F)return await (0,o.I)(N,O,e,M.renderOpts.pendingWaitUntil),null;{let a=await e.blob(),b=(0,p.toNodeOutgoingHttpHeaders)(e.headers);j&&(b[r.NEXT_CACHE_TAGS_HEADER]=j),!b["content-type"]&&a.type&&(b["content-type"]=a.type);let c=void 0!==M.renderOpts.collectedRevalidate&&!(M.renderOpts.collectedRevalidate>=r.INFINITE_CACHE)&&M.renderOpts.collectedRevalidate,d=void 0===M.renderOpts.collectedExpire||M.renderOpts.collectedExpire>=r.INFINITE_CACHE?void 0:M.renderOpts.collectedExpire;return{value:{kind:t.CachedRouteKind.APP_ROUTE,status:e.status,body:Buffer.from(await a.arrayBuffer()),headers:b},cacheControl:{revalidate:c,expire:d}}}}catch(b){throw(null==f?void 0:f.isStale)&&await y.onRequestError(a,b,{routerKind:"App Router",routePath:e,routeType:"route",revalidateReason:(0,n.c)({isRevalidate:I,isOnDemandRevalidate:B})},A),b}},l=await y.handleResponse({req:a,nextConfig:w,cacheKey:G,routeKind:f.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:z,isRoutePPREnabled:!1,isOnDemandRevalidate:B,revalidateOnlyGenerated:C,responseGenerator:k,waitUntil:c.waitUntil});if(!F)return null;if((null==l||null==(i=l.value)?void 0:i.kind)!==t.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==l||null==(j=l.value)?void 0:j.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});(0,h.getRequestMeta)(a,"minimalMode")||b.setHeader("x-nextjs-cache",B?"REVALIDATED":l.isMiss?"MISS":l.isStale?"STALE":"HIT"),x&&b.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let m=(0,p.fromNodeOutgoingHttpHeaders)(l.value.headers);return(0,h.getRequestMeta)(a,"minimalMode")&&F||m.delete(r.NEXT_CACHE_TAGS_HEADER),!l.cacheControl||b.getHeader("Cache-Control")||m.get("Cache-Control")||m.set("Cache-Control",(0,q.getCacheControlHeader)(l.cacheControl)),await (0,o.I)(N,O,new Response(l.value.body,{headers:m,status:l.value.status||200})),null};L?await g(L):await K.withPropagatedContext(a.headers,()=>K.trace(m.BaseServerSpan.handleRequest,{spanName:`${J} ${a.url}`,kind:i.SpanKind.SERVER,attributes:{"http.method":J,"http.target":a.url}},g))}catch(b){if(b instanceof s.NoFallbackError||await y.onRequestError(a,b,{routerKind:"App Router",routePath:E,routeType:"route",revalidateReason:(0,n.c)({isRevalidate:I,isOnDemandRevalidate:B})}),F)throw b;return await (0,o.I)(N,O,new Response(null,{status:500})),null}}},27143:(a,b,c)=>{"use strict";c.d(b,{CY:()=>j,K_:()=>h,fv:()=>i,ll:()=>f,vs:()=>k});var d=c(9608);let e=null;function f(a,...b){return(function(){if(!e){if(!process.env.POSTGRES_URL)throw Error("POSTGRES_URL env var is not set");e=(0,d.lw)(process.env.POSTGRES_URL,{fullResults:!0})}return e})()(a,...b)}let g=!1;async function h(){g||(await f`CREATE TABLE IF NOT EXISTS challenges (
    id                 SERIAL PRIMARY KEY,
    title              TEXT NOT NULL,
    time_limit_minutes INTEGER DEFAULT NULL,
    created_at         TIMESTAMPTZ DEFAULT NOW()
  )`,await f`CREATE TABLE IF NOT EXISTS coding_challenges (
    id           SERIAL PRIMARY KEY,
    challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    title        TEXT NOT NULL DEFAULT '',
    description  TEXT NOT NULL DEFAULT '',
    starter_code TEXT DEFAULT '',
    language     TEXT DEFAULT 'javascript',
    position     INTEGER DEFAULT 0,
    created_at   TIMESTAMPTZ DEFAULT NOW()
  )`,await f`CREATE TABLE IF NOT EXISTS interview_questions (
    id           SERIAL PRIMARY KEY,
    challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    text         TEXT NOT NULL DEFAULT '',
    position     INTEGER DEFAULT 0,
    created_at   TIMESTAMPTZ DEFAULT NOW()
  )`,await f`CREATE TABLE IF NOT EXISTS interview_links (
    id              SERIAL PRIMARY KEY,
    challenge_id    INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    token           TEXT UNIQUE NOT NULL,
    candidate_name  TEXT DEFAULT '',
    candidate_email TEXT DEFAULT '',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    first_opened_at TIMESTAMPTZ,
    started_at      TIMESTAMPTZ,
    submitted_at    TIMESTAMPTZ
  )`,await f`CREATE TABLE IF NOT EXISTS saves (
    id       SERIAL PRIMARY KEY,
    link_id  INTEGER NOT NULL REFERENCES interview_links(id) ON DELETE CASCADE,
    codes    TEXT NOT NULL DEFAULT '{}',
    answers  TEXT NOT NULL DEFAULT '{}',
    saved_at TIMESTAMPTZ DEFAULT NOW(),
    is_final BOOLEAN NOT NULL DEFAULT FALSE
  )`,await f`CREATE TABLE IF NOT EXISTS auth_users (
    id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name           TEXT,
    email          TEXT UNIQUE,
    email_verified TIMESTAMPTZ,
    image          TEXT
  )`,await f`CREATE TABLE IF NOT EXISTS auth_verification_tokens (
    identifier TEXT NOT NULL,
    token      TEXT UNIQUE NOT NULL,
    expires    TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (identifier, token)
  )`,await f`ALTER TABLE interview_links ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ`,await f`ALTER TABLE saves ADD COLUMN IF NOT EXISTS codes    TEXT    NOT NULL DEFAULT '{}'`,await f`ALTER TABLE saves ADD COLUMN IF NOT EXISTS answers  TEXT    NOT NULL DEFAULT '{}'`,await f`ALTER TABLE saves ADD COLUMN IF NOT EXISTS is_final BOOLEAN NOT NULL DEFAULT FALSE`,g=!0)}async function i(){await h();let{rows:a}=await f`SELECT * FROM challenges ORDER BY created_at DESC`;for(let b of a){let{rows:a}=await f`SELECT * FROM coding_challenges WHERE challenge_id = ${b.id} ORDER BY position`,{rows:c}=await f`SELECT * FROM interview_questions WHERE challenge_id = ${b.id} ORDER BY position`;b.coding_challenges=a,b.interview_questions=c}return a}async function j(){await h();let{rows:a}=await f`
    SELECT il.*, c.title AS challenge_title
    FROM interview_links il JOIN challenges c ON c.id = il.challenge_id
    ORDER BY il.created_at DESC
  `;return a}async function k(a){await h();let{rows:b}=await f`
    SELECT il.*, c.title AS challenge_title, c.time_limit_minutes
    FROM interview_links il JOIN challenges c ON c.id = il.challenge_id
    WHERE il.id = ${a}
  `;if(!b.length)return null;let c=b[0],[{rows:d},{rows:e},{rows:g}]=await Promise.all([f`SELECT id, saved_at, is_final, codes, answers FROM saves WHERE link_id = ${a} ORDER BY saved_at DESC`,f`SELECT * FROM coding_challenges WHERE challenge_id = ${c.challenge_id} ORDER BY position`,f`SELECT * FROM interview_questions WHERE challenge_id = ${c.challenge_id} ORDER BY position`]);return{link:c,saves:d,codingChallenges:e,questions:g}}},27910:a=>{"use strict";a.exports=require("stream")},28354:a=>{"use strict";a.exports=require("util")},29294:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-async-storage.external.js")},30787:(a,b,c)=>{"use strict";Object.defineProperty(b,"__esModule",{value:!0}),Object.defineProperty(b,"createDedupedByCallsiteServerErrorLoggerDev",{enumerable:!0,get:function(){return i}});let d=function(a,b){if(a&&a.__esModule)return a;if(null===a||"object"!=typeof a&&"function"!=typeof a)return{default:a};var c=e(b);if(c&&c.has(a))return c.get(a);var d={__proto__:null},f=Object.defineProperty&&Object.getOwnPropertyDescriptor;for(var g in a)if("default"!==g&&Object.prototype.hasOwnProperty.call(a,g)){var h=f?Object.getOwnPropertyDescriptor(a,g):null;h&&(h.get||h.set)?Object.defineProperty(d,g,h):d[g]=a[g]}return d.default=a,c&&c.set(a,d),d}(c(74515));function e(a){if("function"!=typeof WeakMap)return null;var b=new WeakMap,c=new WeakMap;return(e=function(a){return a?c:b})(a)}let f={current:null},g="function"==typeof d.cache?d.cache:a=>a,h=console.warn;function i(a){return function(...b){h(a(...b))}}g(a=>{try{h(f.current)}finally{f.current=null}})},44870:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},55511:a=>{"use strict";a.exports=require("crypto")},55591:a=>{"use strict";a.exports=require("https")},57075:a=>{"use strict";a.exports=require("node:stream")},63033:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},66834:()=>{},74075:a=>{"use strict";a.exports=require("zlib")},78335:()=>{},79428:a=>{"use strict";a.exports=require("buffer")},79551:a=>{"use strict";a.exports=require("url")},81630:a=>{"use strict";a.exports=require("http")},83505:a=>{"use strict";a.exports=import("prettier/standalone")},84297:a=>{"use strict";a.exports=require("async_hooks")},86439:a=>{"use strict";a.exports=require("next/dist/shared/lib/no-fallback-error.external")},94735:a=>{"use strict";a.exports=require("events")},95736:(a,b,c)=>{"use strict";a.exports=c(44870)},96487:()=>{}};var b=require("../../../../webpack-runtime.js");b.C(a);var c=b.X(0,[996,608,713],()=>b(b.s=14329));module.exports=c})();