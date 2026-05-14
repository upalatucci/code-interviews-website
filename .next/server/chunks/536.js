exports.id=536,exports.ids=[536],exports.modules={2549:(a,b,c)=>{"use strict";c.d(b,{N:()=>h});var d=c(29662),e=c(28342),f=c(27143);function g(a){return{id:a.id,name:a.name,email:a.email,emailVerified:a.email_verified?new Date(a.email_verified):null,image:a.image}}let h={adapter:{async createUser(a){await (0,f.K_)();let{rows:b}=await (0,f.ll)`
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
          `})}})],session:{strategy:"jwt"},pages:{signIn:"/auth/signin",verifyRequest:"/auth/verify-request",error:"/auth/signin"},callbacks:{session:async({session:a,token:b})=>(b.sub&&(a.user.id=b.sub),a)}}},6771:(a,b,c)=>{Promise.resolve().then(c.bind(c,11861))},11861:(a,b,c)=>{"use strict";c.d(b,{default:()=>d});let d=(0,c(97954).registerClientReference)(function(){throw Error("Attempted to call the default export of \"/Users/upalatuc/code-interviews-website/components/admin/AdminShell.tsx\" from the server, but it's on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.")},"/Users/upalatuc/code-interviews-website/components/admin/AdminShell.tsx","default")},16953:(a,b,c)=>{"use strict";c.r(b),c.d(b,{default:()=>f,metadata:()=>e});var d=c(75338);c(82704);let e={title:"Red Hat Interview Platform",description:"Async code interview platform"};function f({children:a}){return(0,d.jsx)("html",{lang:"en",children:(0,d.jsx)("body",{children:a})})}},24364:(a,b,c)=>{Promise.resolve().then(c.t.bind(c,81170,23)),Promise.resolve().then(c.t.bind(c,23597,23)),Promise.resolve().then(c.t.bind(c,36893,23)),Promise.resolve().then(c.t.bind(c,89748,23)),Promise.resolve().then(c.t.bind(c,6060,23)),Promise.resolve().then(c.t.bind(c,7184,23)),Promise.resolve().then(c.t.bind(c,69576,23)),Promise.resolve().then(c.t.bind(c,73041,23)),Promise.resolve().then(c.t.bind(c,51384,23))},27143:(a,b,c)=>{"use strict";c.d(b,{CY:()=>j,K_:()=>h,fv:()=>i,ll:()=>f,vs:()=>k});var d=c(9608);let e=null;function f(a,...b){return(function(){if(!e){if(!process.env.POSTGRES_URL)throw Error("POSTGRES_URL env var is not set");e=(0,d.lw)(process.env.POSTGRES_URL,{fullResults:!0})}return e})()(a,...b)}let g=!1;async function h(){g||(await f`CREATE TABLE IF NOT EXISTS challenges (
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
  `;if(!b.length)return null;let c=b[0],[{rows:d},{rows:e},{rows:g}]=await Promise.all([f`SELECT id, saved_at, is_final, codes, answers FROM saves WHERE link_id = ${a} ORDER BY saved_at DESC`,f`SELECT * FROM coding_challenges WHERE challenge_id = ${c.challenge_id} ORDER BY position`,f`SELECT * FROM interview_questions WHERE challenge_id = ${c.challenge_id} ORDER BY position`]);return{link:c,saves:d,codingChallenges:e,questions:g}}},30444:(a,b,c)=>{Promise.resolve().then(c.t.bind(c,54160,23)),Promise.resolve().then(c.t.bind(c,31603,23)),Promise.resolve().then(c.t.bind(c,68495,23)),Promise.resolve().then(c.t.bind(c,75170,23)),Promise.resolve().then(c.t.bind(c,77526,23)),Promise.resolve().then(c.t.bind(c,78922,23)),Promise.resolve().then(c.t.bind(c,29234,23)),Promise.resolve().then(c.t.bind(c,12263,23)),Promise.resolve().then(c.bind(c,82146))},43723:(a,b,c)=>{Promise.resolve().then(c.bind(c,85879))},45150:()=>{},66834:()=>{},82704:()=>{},85318:()=>{},85879:(a,b,c)=>{"use strict";c.d(b,{default:()=>w});var d=c(21124),e=c(38301),f=c(42378),g=c(3991),h=c.n(g),i=c(57461),j=c(75617),k=c(48009),l=c(56514),m=c(89676),n=c(48608),o=c(4485),p=c(31545),q=c(88065),r=c(89085),s=c(12778),t=c(34736),u=c(2765);let v=[{href:"/admin/interviews",label:"Interviews"},{href:"/admin/links",label:"Links"},{href:"/admin/submissions",label:"Submissions"}];function w({children:a,userEmail:b}){let[c,g]=(0,e.useState)(!0),w=(0,f.usePathname)(),x=(0,d.jsxs)(j.Q,{children:[(0,d.jsx)(k.u,{children:(0,d.jsx)(l.$n,{variant:"plain","aria-label":"Toggle navigation",onClick:()=>g(a=>!a),children:(0,d.jsx)(u.U4,{})})}),(0,d.jsx)(m.j,{children:(0,d.jsxs)(n.V,{children:[(0,d.jsx)("span",{style:{fontWeight:700,color:"#ee0000",fontSize:16},children:"Red Hat"}),(0,d.jsx)("span",{style:{marginLeft:8,color:"var(--pf-t--global--text--color--subtle)",fontSize:13},children:"Interview Platform"})]})}),(0,d.jsxs)("div",{style:{marginLeft:"auto",display:"flex",alignItems:"center",gap:12,padding:"0 16px"},children:[b&&(0,d.jsx)("span",{style:{fontSize:13,color:"var(--pf-t--global--text--color--subtle)"},children:b}),(0,d.jsx)(l.$n,{variant:"plain",onClick:()=>(0,i.signOut)({callbackUrl:"/auth/signin"}),style:{fontSize:13},children:"Sign out"})]})]}),y=(0,d.jsx)(o.Ey,{isSidebarOpen:c,children:(0,d.jsx)(p.m,{children:(0,d.jsx)(q.so,{"aria-label":"Global",children:(0,d.jsx)(r.c,{children:v.map(a=>(0,d.jsx)(s.j,{isActive:w.startsWith(a.href),children:(0,d.jsx)(h(),{href:a.href,style:{textDecoration:"none",color:"inherit"},children:a.label})},a.href))})})})});return(0,d.jsx)(t.Y,{masthead:x,sidebar:y,isManagedSidebar:!1,children:a})}},86945:(a,b,c)=>{"use strict";c.r(b),c.d(b,{default:()=>i});var d=c(75338),e=c(52963),f=c(82161),g=c(2549),h=c(11861);async function i({children:a}){let b=await (0,e.getServerSession)(g.N);return b||(0,f.redirect)("/auth/signin"),(0,d.jsx)(h.default,{userEmail:b.user?.email,children:a})}}};