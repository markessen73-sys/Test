# Testing the ghost boxer

## Quick test link (Heavy Bag play mode)

Append `?play=heavy-bag` to your dev URL to jump straight to the ghost boxer:

```
https://p-5173-pod-<your-pod>.agent.cvm.dev/?_ingress_token=<token>&play=heavy-bag
```

**Verify build:** top-right of play screen shows `build <git-sha>` (e.g. `build 0c8f6ad`). If the SHA doesn't match the latest commit, hard-refresh (`Ctrl+Shift+R`) or restart the dev server.

## Local dev (port 5173)

```bash
cd frontend
npm run build          # refresh production bundle too
npm run dev:fresh      # clears Vite cache, serves latest on :5173
```

Then open: `http://localhost:5173/?play=heavy-bag`

## Why you might see an old version

- A **stale Vite process** on port 5173 keeps serving cached modules from an earlier iteration.
- Fix: kill old node on 5173, run `npm run dev:fresh`, hard-refresh the browser.

## Backend (port 8000)

Serves `frontend/dist` — run `npm run build` in `frontend/` before testing on :8000.
