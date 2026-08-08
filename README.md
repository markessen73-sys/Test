# Mickey's Boxing Gym

A cartoon 3D boxing gym inspired by Mickey Goldmill's gym from Rocky. One room, all equipment, arrow navigation.

## Play online

**https://markessen73-sys.github.io/Test/**

Hard-refresh after deploys (`Ctrl+Shift+R` / `Cmd+Shift+R`). Build stamp is shown top-right.

### Direct play links

| Station | Link |
|---------|------|
| Main gym | https://markessen73-sys.github.io/Test/ |
| Heavy bag | https://markessen73-sys.github.io/Test/?play=heavy-bag |
| Boxing ring | https://markessen73-sys.github.io/Test/?play=ring |
| Speedball | https://markessen73-sys.github.io/Test/?play=speedball |
| Bobo doll | https://markessen73-sys.github.io/Test/?play=bobo-doll |
| Character builder | https://markessen73-sys.github.io/Test/?builder=character |

Do **not** use the jsDelivr `…/index.html` link — CDN serves that file as plain text, so the browser shows source instead of the gym.

## The gym

Open the app and you're inside **Mickey's Gym** — brick walls, wooden floors, warm bulb lighting, faded **MICKEY'S GYM** sign.

All four stations are in the same room:

| Station | Description |
|---------|-------------|
| **Mickey's Ring** | Main boxing ring with sparring partner |
| **Speedball** | Wall-mounted speedball platform |
| **Heavy Bag** | Hanging heavy bag with chains |
| **Bobo Doll** | Weighted bobo doll in the corner |

## Navigation

- Side arrows on the screen
- Keyboard ← → keys
- Station dots at the bottom

The camera smoothly pans to each station. Click the active equipment to hit it.

## Run it locally

```bash
cd frontend && npm install && npm run dev
```

Open http://localhost:5173 — you land straight in the gym.

### Local direct links

| URL | Opens |
|-----|-------|
| `/?gym` | Main gym browse view |
| `/?gym=heavy-bag` | Main gym, focused on heavy bag |
| `/?play=heavy-bag` | Glove play at heavy bag |

Station ids: `ring`, `speedball`, `heavy-bag`, `bobo-doll`.

## Tech

React Three Fiber · Procedural cartoon gym · Camera rig station rotation

## License

MIT
