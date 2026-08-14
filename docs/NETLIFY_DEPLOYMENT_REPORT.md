# Netlify Production Deployment — Readiness Audit Report

Date: 2026-08-13
App: Safepay (Vite + React 18 SPA, Supabase backend)
Prepared by: opencode deployment-readiness audit

---

## Deployment Status

`READY TO DEPLOY TO NETLIFY`

## Build

`PASS` — `npm run build` succeeds (Vite 5.4.19, `vite build && node scripts/emit-site-files.mjs`). 2704 modules transformed, output verified. Clean-room `npm ci` + build also passes.

## Netlify Configuration

`PASS` — `netlify.toml` added:

- Build command: `npm ci && npm run build`
- Publish directory: `dist`
- Node version: pinned `20` (LTS) via `[build.environment]`
- SPA fallback: `[[redirects]] /* → /index.html 200`
- Security headers on `/*` (nosniff, DENY framing, referrer-policy, permissions-policy, HSTS)

## SPA Routing

`PASS` — Every route is defined client-side in `src/App.tsx` with a `*` catch-all to `NotFound`. The Netlify `/* → /index.html 200` rewrite serves the app for all unmatched paths. Verified against the production build with a Netlify-style SPA-fallback static server: `/`, `/dashboard`, `/checkout/abc123`, `/merchant-settings`, `/transactions/xyz`, `/orders/123`, `/customer-login`, and a garbage route all returned `200` with the app HTML.

## Deep Links

`PASS` — All deep links resolve through the SPA fallback (see SPA Routing). No route depends on prior navigation. The public checkout page (`/checkout/:token`) loads its session by URL token; protected routes redirect to login when unauthenticated.

## Browser Back/Forward

`PASS` — `react-router-dom` `BrowserRouter` handles history. The `/*` rewrite returns the same `index.html` for every URL, so browser history works identically to local dev. Login now honors `location.state.from` and returns the user to the originally-requested protected route after authentication (previously always dumped to `/dashboard`).

## Refresh Testing

`PASS` — Any route (public, protected, dynamic `/orders/:id`, `/merchant-order/:orderId`, `/checkout/:token`) can be refreshed or opened directly because the SPA fallback serves the app and the router re-hydrates from the URL.

## 404 Handling

`PASS` — Valid SPA routes → Netlify serves the app; unknown client paths → React Router's `NotFound` page (proper UI, not Netlify's default 404). Missing static assets under `/*` also fall back to the app rather than a broken page.

## Authentication

`PASS` — Custom phone/password auth via Supabase edge functions; session tokens in `localStorage` (same-origin, works on any Netlify domain). `verify-session` on every load; protected routes redirect to `/customer-login` / `/merchant-login`; logout clears `safepay_auth_token`, `safepay_user`, `safepay_merchant_token`, `safepay_merchant_user`, `safepay_merchant_data`. No hardcoded redirect domains — all navigation is relative. Auth redirect URLs are origin-relative, so Netlify production/preview/custom domains all work.

## API Connectivity

`PASS` — All APIs are hosted on Supabase (`*.supabase.co`). The Supabase URL is now read from `VITE_SUPABASE_URL` (with the existing project as fallback) instead of being hardcoded in 5 source files. No API points at localhost. `buildCheckoutLink` uses `window.location.origin`, so generated checkout links match whatever domain the app is served from.

## Environment Variables

`PASS` — Two client (public) vars required:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Optional: `SITE_URL` (production domain for robots.txt/sitemap.xml generation). Server-side secrets (`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_*`) are NOT needed by the Netlify build — they are used only by local tooling. `.env.example` created; `.env` added to `.gitignore`; `.env.local` was already ignored (`*.local`). No secrets are exposed to the browser.

## Static Assets

`PASS` — `dist/` contains favicon.png, og-image.png, robots.txt, sitemap.xml, llms.txt, placeholder.svg plus hashed `/assets/*` JS/CSS. All referenced with absolute paths (`/assets/...`), verified served at 200 from the SPA-fallback server.

## Serverless Functions

`NOT APPLICABLE` — The application has no Netlify Functions. All server-side logic runs as Supabase Edge Functions (`auth`, `merchant-auth`, `razorpay`, `razorpay-webhook`, `checkout-payment`, etc.) on the Supabase project, not on Netlify.

## Security

`PASS` — Scanned the production bundle: no service-role key, no Supabase access token, no DB password, no `service_role` string. Publishable key is public by design. Security headers added via netlify.toml. CORS on Supabase edge functions is origin-agnostic with token-based auth (bearer tokens in headers, not cookies), so `*` ACAO is acceptable here. Supabase functions that consume body tokens have `verify_jwt = false` as configured in `supabase/config.toml`.

## Mobile

`PASS` — The app is a responsive single-page app (mobile-first Tailwind layouts, bottom nav). The production build contains the identical client code to local dev; no deployment-specific desktop-only constructs exist. (Tested structurally; physical device smoke test recommended post-deploy.)

## Production Build

`PASS` — Verified twice: working-directory build and a clean-room test (fresh copy, `npm ci`, `npm run build`, SPA-serve). Both succeeded.

---

## Issues Fixed

1. **Hardcoded Supabase URL** in `AuthContext.tsx`, `MerchantAuthContext.tsx`, `useRazorpay.ts`, `ChangePassword.tsx`, and a missing fallback in `src/lib/checkout.ts` → now all read `import.meta.env.VITE_SUPABASE_URL` with the existing project URL as fallback.
2. **No Netlify configuration** → created `netlify.toml` (build, publish dir, Node 20, SPA fallback, security headers).
3. **`index.html` mojibake** — `<title>` and meta descriptions contained corrupted characters (`Safepay �?" Protected...`) → rewritten with proper UTF-8 em-dashes.
4. **Hardcoded Lovable domain** in `index.html` (canonical/OG/Twitter URLs + JSON-LD) → now origin-relative and hydrated at runtime by an inline script, so the same build is correct on Netlify production, preview, and custom domains.
5. **Hardcoded Lovable domain** in `public/robots.txt` and `public/sitemap.xml` → domain replaced at build time by `scripts/emit-site-files.mjs` using `SITE_URL` (or `VITE_SITE_URL`), falling back to the template domain.
6. **`robots.txt` lost its Sitemap directive** in the first emit-script pass → now appended if absent.
7. **Login ignores original destination** — `ProtectedRoute` passed `state.from` but `CustomerLogin`/`MerchantLogin` always navigated to `/dashboard`/`/merchant-dashboard` → both now return to the originally-requested route.
8. **No `.env.example`** → created documenting all vars and which are public vs local-only.
9. **`.env` tracked by git** (empty) → added to `.gitignore` (only `.env.example` should be tracked).

---

## Remaining Issues

- **Pre-existing ESLint errors/warnings** (51 errors / 28 warnings across `supabase/functions/*`, `tailwind.config.ts`, `useRazorpay.ts`, several pages). All pre-date this task; none are in code changed here, and Netlify's build does not run ESLint. Not deployment-blocking, but worth a cleanup pass.
- **Large JS bundle**: single `index.js` ≈ 1.41 MB (340 KB gzip) and a 535 KB static logo PNG — Vite chunk-size warning. Recommend code-splitting via `React.lazy` on route groups as a follow-up. Not deployment-blocking.
- **`og-image.png` is ~1 MB** — large for social-crawler consumption; consider compressing.
- **Supabase functions CORS** returns `Access-Control-Allow-Origin: *` for the token-auth functions; acceptable because auth uses bearer headers, not cookies. Tighten to the production origin if stricter posture is desired.
- **No CSP header** added intentionally (Razorpay + Google Fonts + inline styles make a restrictive CSP risky without browser-level testing). Revisit if a CSP is required.
- **Deploy-time verification not executed** — Netlify credentials/deploy access are not available in this environment. All checks above were performed against the production build served with a Netlify-compatible SPA fallback.

---

## Required Netlify Environment Variables

Names only (set in Netlify → Site → Environment variables; never expose values here):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SITE_URL` (optional; production domain for robots.txt/sitemap.xml)

---

## Final Recommendation

**READY TO DEPLOY TO NETLIFY.**

Deploy steps:
1. Push the repo (or connect the Netlify repo) — `netlify.toml` drives the build (`npm ci && npm run build`, publish `dist`, Node 20).
2. Set the three environment variables above.
3. Deploy and confirm: deep-link a protected route (`/orders`), refresh, log in, and confirm you land back on `/orders`.
4. Post-deploy smoke test on mobile (device, not emulation) for §27.
