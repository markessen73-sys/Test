# Testing the ghost boxer

## Quick test link (Heavy Bag play mode)

```
https://p-5173-pod-<your-pod>.agent.cvm.dev/?_ingress_token=<token>&play=heavy-bag
```

**Verify build:** top-right shows `build <git-sha>`. Hard-refresh (`Ctrl+Shift+R`) if stale.

**What to expect:** Layered sprite boxer from artwork (not procedural shapes). Put fingers on glove hit areas (invisible overlays) to move arms.

## Local dev

```bash
cd frontend
python3 scripts/slice-boxer-parts.py   # if parts missing
npm run build
npm run dev:fresh
```

Open: `http://localhost:5173/?play=heavy-bag`

## Stale server fix

Kill old Vite on 5173, run `npm run dev:fresh`, hard-refresh.
