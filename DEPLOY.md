# Putting Deepan Hospital online

So patients can reach it from anywhere, not just the machine it's built on.

---

## The short answer: what to buy

Two things, and nothing else.

**1. A VPS — a plain Linux computer you rent.** Not "web hosting", not
"WordPress hosting", not a website builder. Those run PHP and cannot run this
app at all. The words to look for are **VPS**, **Droplet**, **Instance** or
**Compute** — anything that gives you SSH and root.

> **The one to pick if you don't want to think about it:** a **DigitalOcean
> Droplet** in the **Bangalore** region, the smallest size with **1 GB of RAM**,
> running **Ubuntu**. Roughly ₹500–700 a month. AWS Lightsail (Mumbai) and
> Akamai/Linode (Mumbai) are equally fine.

**2. A domain name** — around ₹1,000 a year for a `.in`. Buy it from anywhere
reputable; it does not have to be the same company as the server.

**That is the whole shopping list.** You do not need: a database plan (this app
keeps its data in a file), an SSL certificate (Let's Encrypt is free and
automatic), a control panel, a "site builder", or any add-on the checkout page
offers you.

### Two rules about buying it

- **Wait until the hospital has said yes.** There is nothing to run yet, and a
  server sitting idle still bills every month.
- **Buy it in the hospital's name, on the hospital's card** — the server will
  hold patient records, and those should never sit in a personal account. If
  you are arranging it for them, have them pay, or pass the cost through at
  exactly what it cost.

### If somebody is buying this for you

Show them this: *"I need a small Ubuntu VPS with 1 GB of RAM in an Indian
region, with SSH access. Not shared hosting or WordPress hosting."* Any hosting
company will understand that sentence.

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

## Second — *where* it runs matters, not just what

This is a hospital's patient data, and the patients are in Tiruchirappalli.
Two things follow.

**Host it in an Indian region.** The Digital Personal Data Protection Act 2023
governs this data, and keeping it inside India is the simplest position to be
in — it avoids the whole question of cross-border transfer, which is the kind of
thing that is easy to arrange now and awkward to explain later. It is also
faster: a server in Mumbai or Bangalore is tens of milliseconds from Trichy,
where one in Frankfurt or Oregon is hundreds.

Providers with an Indian region include **AWS (Mumbai)**, **DigitalOcean
(Bangalore)**, **Azure (Central India)** and **Akamai/Linode (Mumbai)**.
**Hetzner has none** — it is the cheapest VPS most people recommend and it is
the wrong answer here. Check current regions before you commit; they change.

Managed platforms are the weaker option for exactly this reason. At the time of
writing **Render has no Indian region**, so choosing it means the hospital's
patient records live in Singapore or the United States. That may be an
acceptable trade to get live quickly — but it is a decision the hospital should
make knowingly, not one that happens because a dropdown had no better option.

**Put it in the hospital's own account, not yours.** The domain, the server and
the backups should be registered to Deepan Hospital and paid for by them. Bill
it through at cost if you are arranging it. A supplier holding a hospital's
patient data in a personal account is a problem for both sides the day the
relationship changes — and it is trivial to get right at the start and painful
to unpick later.

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
      The server refuses to start in production while a setup account (`admin`,
      `test`, `demo`) is still on the password printed when it was created, and
      warns about every other account nobody has changed. Reset with
      `npm run reset-password -- --username <name>`, then sign in once and set
      your own — only that last step clears it.
- [ ] **Registration numbers entered for every consultant.** `npm run reg-numbers`
      lists who is missing one and writes a form to hand to whoever holds the
      records; `npm run reg-numbers -- --import <file>` loads it back. It
      refuses a mobile number or a piece of the qualification, which are the
      two things that actually get typed into that column by mistake.
- [ ] A copy of `server/data/deepan.db` is taken **off the server** regularly,
      with `server/scripts/backup-offsite.sh` on a nightly cron — see the header
      of that file for the one-time rclone setup.
      The app already writes its own backups every 6 hours to `BACKUP_DIR`
      (`/var/lib/deepan-hospital/backups` on a deployed server)
      (`BACKUP_EVERY_HOURS`, `BACKUP_KEEP`), but those sit on the same disk as
      the database — which is no protection at all against the disk being the
      thing that fails. Copy them somewhere else on a schedule, e.g. nightly:
      ```
      0 2 * * *  rclone copy /var/lib/deepan-hospital/backups remote:deepan-backups
      ```
      **Then restore one, once, onto a spare machine.** A backup nobody has
      ever restored is a belief, not a backup.
- [ ] If using online payments, the Razorpay webhook points at the real HTTPS URL.

---

## The honest recommendation

For a real hospital, **Option B — a VPS in an Indian region — is the right
home.** It is the cheapest, the data stays in the country, it is the fastest for
patients in Trichy, and it belongs to the hospital. This app is small: 1 vCPU
and 1–2 GB of RAM is ample, and SQLite means there is no separate database
server to run or pay for.

**Option A (Render) is the fastest way to be live today** and is easy to move
off later — but read the region note above before choosing it, because it puts
patient records outside India.

Either is fine. A sleeping laptop is not.
