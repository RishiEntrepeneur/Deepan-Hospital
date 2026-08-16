# Running Deepan Hospital on another machine

Follow these once. After that it's a single command to start.

---

## 1. Install Node.js — version 22.5 or newer

The app uses Node's built-in database engine, which needs **Node 22.5+** (Node 24
LTS recommended). Download from **https://nodejs.org** (the "LTS" button).

Check it worked:

```bash
node --version
```

It must print `v22.5.0` or higher. Anything lower will not start.

---

## 2. Put the project on the machine

Unzip `deepan-hospital.zip` somewhere sensible, e.g. your home folder. Open a
terminal **in that folder** (the one containing `package.json` and a `server`
folder).

---

## 3. Install the dependencies — two folders

```bash
npm install
cd server
npm install
cd ..
```

(The first installs the website's build tools; the second installs the server's
one dependency.)

---

## 4. Create the server settings file

```bash
cd server
cp .env.example .env
cd ..
```

The defaults in `.env` are fine for running locally. You only edit it later to
switch on online payments or the Klinique connection.

---

## 5. Build the website

```bash
npm run build
```

This produces the `dist/` folder the server will serve.

---

## 6. Start it

```bash
cd server
npm start
```

Open **http://localhost:4000** in a browser. That's the whole app — the patient
site and the reception desk, on one address.

---

## 7. Sign in for the first time

A database with the full doctor roster is included, so doctors and departments
are already there. **Reset the admin password before you sign in** (the ones
from development are not secret):

```bash
cd server
npm run reset-password -- --username admin
```

It prints a new password once. Then on the website: **Sign in → I work at the
hospital**, username `admin`.

Reset a doctor's the same way, e.g. `npm run reset-password -- --username doctordeepan`.

---

## Everyday running

- **Start:** `cd server && npm start` → http://localhost:4000
- **Stop:** `Ctrl-C` in that terminal
- **After changing website code:** `npm run build` from the project root, then restart.
- **The database is `server/data/deepan.db`.** Everything — patients, bookings,
  payments — lives in that one file. **Copy it somewhere safe regularly.** If it
  is lost, everything is lost. Automatic backups also land in `server/backups/`.

---

## Making it reachable over the internet

Running it on your own machine only works on that machine's network. To let
patients reach it from anywhere, it has to live on a server that is always on —
see **DEPLOY.md**.

---

## If something is wrong

- **"node: command not found"** — Node is not installed (step 1).
- **Won't start, mentions SQLite / DatabaseSync** — Node is too old (step 1, need 22.5+).
- **Sign-in says "something went wrong"** — you may have tried too many times;
  wait a minute. If it persists, restart the server (that clears the limit).
- **Port 4000 in use** — something else is on that port; set `PORT=4001` in
  `server/.env` and use http://localhost:4001.
