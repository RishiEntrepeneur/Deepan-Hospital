# Putting Deepan Hospital online

So patients can reach it from anywhere, not just the machine it's built on.

---

## First, the important bit — what kind of host this needs

This app is **a live server with a database**, not a static website. It runs
Node all the time and saves everything to a file (`server/data/deepan.db`). So
it needs a host that:

- **runs Node continuously** (not "serverless" that sleeps), and
- **keeps a disk** between restarts (so the database is not wiped).

**This rules out the static-only hosts.** Cloudflare Pages, Netlify, Vercel,
GitHub Pages — these serve static files only. They cannot run this server or
keep its database, so the app will not work on them.

> **"Can I deploy on Cloudify?"** — If you mean **Cloudflare Pages**, no: it's
> static-only, same as above. There is no common app host called "Cloudify".
> Use one of the two below, which are made for exactly this.

---

## Option A — Render.com (easiest, managed)

Good if you want it working without running a server yourself. Costs a few
dollars a month for the always-on service plus a small persistent disk.

1. Put the project on **GitHub** (a private repo is fine).
2. On **render.com** → **New → Web Service** → connect the repo.
3. Settings:
   - **Build command:** `npm install && npm run build && cd server && npm install`
   - **Start command:** `cd server && npm start`
   - **Environment:** add `NODE_ENV=production`, `COOKIE_SECURE=true`, and
     `PORT=10000` (Render's port).
4. **Add a Disk** (Render → your service → Disks): mount path `/opt/render/project/src/server/data`, size 1 GB. **This is what keeps the database.** Without it, every deploy wipes patient records.
5. Deploy. Render gives you a URL like `https://deepan-hospital.onrender.com`.
6. First run: open a shell on Render and reset the admin password
   (`cd server && npm run reset-password -- --username admin`).

Render gives you HTTPS automatically, which you need — the app refuses insecure
cookies in production.

---

## Option B — a small VPS (cheapest, full control)

A plain Linux server. Around ₹350–600/month (Hetzner, DigitalOcean, or an Indian
provider). More steps, but yours entirely.

1. Create an Ubuntu server. SSH in.
2. Install Node 22+ (`curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs`).
3. Copy the project up (git clone, or scp the folder).
4. `npm install && npm run build && cd server && npm install`
5. `cp .env.example .env` and edit: `NODE_ENV=production`, `COOKIE_SECURE=true`.
6. Keep it running with **pm2**:
   ```bash
   sudo npm install -g pm2
   cd server && pm2 start src/index.js --name deepan
   pm2 save && pm2 startup      # so it restarts on reboot
   ```
7. Put **Caddy** in front for automatic HTTPS (point a domain at the server):
   ```
   yourdomain.com {
     reverse_proxy localhost:4000
   }
   ```
   Caddy fetches an HTTPS certificate on its own.

---

## Whichever you choose — the production checklist

- [ ] `NODE_ENV=production` and `COOKIE_SECURE=true` are set.
- [ ] The site is served over **HTTPS** (both options above do this).
- [ ] The **database disk persists** across restarts (Render disk / the VPS's own disk).
- [ ] **Admin and every staff password reset** from the development ones.
- [ ] A copy of `server/data/deepan.db` is taken **off the server** regularly.
- [ ] If using online payments, the Razorpay webhook points at the real HTTPS URL.

---

## The honest recommendation

For a real hospital, **Option B (a VPS) is the right long-term home** — it's
cheapest and it's yours. **Option A (Render) is the fastest to get live today**
and easy to move off later. Either is fine; a sleeping laptop is not.
