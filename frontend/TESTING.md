# Testing the ghost boxer

## Quick test link (Heavy Bag play mode)

```
https://p-5173-pod-<your-pod>.agent.cvm.dev/?_ingress_token=<token>&play=heavy-bag
```

**Verify build:** top-right shows `build <git-sha>`. Hard-refresh (`Ctrl+Shift+R`) if stale.

**What to expect:** Punch-Out–style ghost boxer — semi-transparent body (bag visible through torso), solid red gloves, articulated from-behind guard stance. Reference: `Screenrecorder-2026-07-06-04-15-07-108.mp4` in repo root.

## Local dev

```bash
cd frontend
python3 scripts/extract-boxer-parts.py   # if parts missing
npm run build
npm run dev:fresh
```

Open: `http://localhost:5173/?play=heavy-bag`

## Stale server fix

Kill old Vite on 5173, run `npm run dev:fresh`, hard-refresh.
