---
name: verify
description: Build, launch and drive the Qayd invoice front-end to verify changes end-to-end (auth-guarded SPA with no backend — stub the API at the network layer).
---

# Verifying the Qayd invoice front-end

## Build / typecheck

```bash
npx tsc --noEmit    # KNOWN pre-existing failure: src/utils/Button.tsx imports react-icons/go (not installed). Ignore it.
npx vite build      # clean production build (skips tsc)
```

## Launch

```bash
npx vite --port 5199 --strictPort   # dev server, background
```

## Auth gotcha (critical)

Every route sits behind `PrivateRoute`; login needs a backend at `localhost:5500` which is normally absent.
Bypass in Playwright (playwright-core + installed Chrome, no browser download):

```js
const browser = await chromium.launch({ channel: "chrome", headless: true });
await ctx.route("**/api/v1/**", r => r.fulfill({ contentType: "application/json",
  body: JSON.stringify({ data: { _id: "u1", name: "Demo", email: "d@q.com", role: "admin", permissions: [] } }) }));
await ctx.addInitScript(() => localStorage.setItem("qayd_token", "demo-token"));
```

`npm i playwright-core` in the scratchpad (not the repo).

## Driving gotchas

- The app data lives in IndexedDB `invoiceDemoDB` (seeded on boot). Assert persistence by reading the `meta` object store.
- Overlays: modal shells use `z-[60]` (page modals) and `z-[90]` (PDF settings). **Scope locators to the modal** — `has-text("Go")` also matches the sidebar "Goal" item behind the overlay and Playwright will retry forever.
- Prefer `:text-is(...)` over `has-text` — the sidebar contains ~40 nav labels that substring-match everything.
- Flows worth driving: `/sales/customers` (list → detail tabs → Edit form → statement icon → Go → statement preview → sliders icon → PDF & Print Settings modal). Toggle a setting and assert the left preview changed (e.g. count `img[alt="logo"]`).
- The app renders dark-themed; document previews are always white.
