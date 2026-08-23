# Mickey's Boxing Gym

<<<<<<< HEAD
A cartoon 3D boxing gym inspired by Mickey Goldmill's gym from Rocky. One room, all equipment, arrow navigation.

## The gym

Open the app and you're inside **Mickey's Gym** — brick walls, wooden floors, warm bulb lighting, faded **MICKEY'S GYM** sign.

All four stations are in the same room:

| Station | Description |
|---------|-------------|
| 🥊 **Mickey's Ring** | Main boxing ring with sparring partner |
| 🏐 **Speedball** | Wall-mounted speedball platform |
| 🎯 **Heavy Bag** | Hanging heavy bag with chains |
| 🤡 **Bobo Doll** | Weighted bobo doll in the corner |

## Navigation

- **◀ ▶ arrows** on the sides of the screen
- **Keyboard** ← → keys
- **Emoji dots** at the bottom

The camera smoothly pans to each station. Click the active equipment to hit it.

## Run it

```bash
cd frontend && npm install && npm run dev
```

Open http://localhost:5173 — you land straight in the gym.

## Play online (phone / no install)

GitHub Pages is not enabled on this repo yet. Use this direct link instead (same idea as the old `raw.githack.com` preview):

**Main gym:** https://cdn.jsdelivr.net/gh/markessen73-sys/Test@gh-pages/index.html

### Direct play links

| Station | Link |
|---------|------|
| Main gym | https://cdn.jsdelivr.net/gh/markessen73-sys/Test@gh-pages/index.html |
| Heavy bag | https://cdn.jsdelivr.net/gh/markessen73-sys/Test@gh-pages/index.html?play=heavy-bag |
| Boxing ring | https://cdn.jsdelivr.net/gh/markessen73-sys/Test@gh-pages/index.html?play=ring |
| Speedball | https://cdn.jsdelivr.net/gh/markessen73-sys/Test@gh-pages/index.html?play=speedball |
| Bobo doll | https://cdn.jsdelivr.net/gh/markessen73-sys/Test@gh-pages/index.html?play=bobo-doll |
| Character builder | https://cdn.jsdelivr.net/gh/markessen73-sys/Test@gh-pages/index.html?builder=character |

### Local dev direct links

| URL | Opens |
|-----|-------|
| `/?gym` | Main gym browse view |
| `/?gym=heavy-bag` | Main gym, focused on heavy bag |
| `/?play=heavy-bag` | Glove play at heavy bag |

Station ids: `ring`, `speedball`, `heavy-bag`, `bobo-doll`.

For production build served by backend:

```bash
cd frontend && npm run build
cd ../backend && uvicorn main:app --host 0.0.0.0 --port 8000
```

Open http://localhost:8000

## Tech

React Three Fiber · Procedural cartoon gym · Camera rig station rotation

## Roadmap

- [ ] Punch physics (Cannon.js bag swing)
- [ ] Sound effects
- [ ] Photo caricature faces on equipment (later)
- [ ] GLTF cartoon models
- [ ] Monetization layer (credits for custom faces)

## License

MIT
=======
Play online (after GitHub Pages is enabled):

**https://markessen73-sys.github.io/Test/**

## Enable GitHub Pages (one-time)

1. Open [Repository Settings → Pages](https://github.com/markessen73-sys/Test/settings/pages)
2. Under **Build and deployment → Source**, choose **GitHub Actions**
3. Go to [Actions](https://github.com/markessen73-sys/Test/actions/workflows/deploy-github-pages.yml) and run **Deploy GitHub Pages** (or push to `gh-pages` again)

The site should be live within 1–2 minutes at the URL above.

## Direct play links

- Gym: `/?gym` or `/`
- Heavy bag: `/?play=heavy-bag`
- Ring: `/?play=ring`
- Speedball: `/?play=speedball`
- Bobo doll: `/?play=bobo-doll`
>>>>>>> origin/main
