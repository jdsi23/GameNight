# Game Night

A Jackbox-style party game site: create a room, share a 4-letter code, everyone joins from
their phone, host picks a game. No backend server — the site is static (hosted free on GitHub
Pages) and all game logic runs in the browser, coordinated through a Firebase Realtime Database
on the free Spark plan.

Games so far:

- **What's My Number?** — everyone gets a secret number only the group can see; guess your own
  in turn order before you run out of tries.
- **Is It Really That Bad?** — one random player gets a topic secretly spun Good or Evil; the
  group interrogates them for 5 minutes, then votes on which it was.
- **Who Wrote That?** — a paragraph gets vandalized one word at a time, first-come-first-served,
  until it's finished and read back.

## 1. Create the Firebase project (free Spark plan)

1. Go to the [Firebase console](https://console.firebase.google.com/) and click **Add project**.
   Give it any name (e.g. `gamenight`). You can decline Google Analytics — not needed.
2. In the left sidebar: **Build → Authentication → Get started**. On the Sign-in method tab,
   enable **Anonymous**.
3. In the left sidebar: **Build → Realtime Database → Create Database**. Pick any region close
   to you. Start in **locked mode** (we'll paste our own rules next).
4. Once created, open the **Rules** tab of the Realtime Database and replace the contents with
   everything in [`database.rules.json`](database.rules.json) from this repo, then click
   **Publish**.
5. Go to **Project settings** (gear icon) → scroll to **Your apps** → click the `</>` (Web) icon
   to register a new web app (nickname doesn't matter, skip Firebase Hosting). It'll show you a
   `firebaseConfig` object — keep this tab open, you'll need every value from it in the next step.

## 2. Configure your local copy

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in every value from the `firebaseConfig` object Firebase just showed
you:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_DATABASE_URL=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

`.env.local` is gitignored — it never gets committed.

Then:

```bash
npm install
npm run dev
```

Open the printed `localhost` URL in two different browser windows (or one normal + one private/
incognito window, so they get separate anonymous logins) to test with "two players."

> Note on the Firebase API key: it's normal and expected for this to end up visible in your
> public GitHub repo/build output — Firebase web API keys aren't secret, they just identify
> which project to talk to. The actual security boundary is `database.rules.json`, which is why
> we spent the effort getting those rules right. Still, we keep it out of git history and pull it
> from GitHub Actions secrets at build time (next section), mostly so it's easy to rotate/change
> later without hunting through commit history.

## 3. Push to GitHub

This repo needs to be **public** — GitHub Pages can't serve from a private repo on the free plan.

```bash
git init
git add .
git commit -m "Initial commit"
gh repo create GameNight --public --source=. --remote=origin --push
```

(No `gh` CLI? Create the repo manually on github.com, then `git remote add origin <url>` and
`git push -u origin main`.)

## 4. Add your Firebase config as repo secrets

The GitHub Actions build needs the same values as your `.env.local`, but as repo secrets (so
they're not sitting in plaintext in the workflow file or git history).

Settings → Secrets and variables → Actions → **New repository secret**, once for each of:

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_DATABASE_URL
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

Or with the `gh` CLI, from your `.env.local`:

```bash
gh secret set VITE_FIREBASE_API_KEY --body "the-value"
# ...repeat for each variable
```

## 5. Turn on GitHub Pages

Settings → Pages → under **Build and deployment**, set **Source** to **GitHub Actions**.

Then push to `main` (or re-run the workflow from the Actions tab) — the included
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) builds the site and deploys it.
Your live URL will be `https://<your-username>.github.io/<repo-name>/`, and also shows up in the
Actions run summary and in Settings → Pages once deployed.

## How it stays in sync without a backend

There's no server — every player's browser talks directly to the Realtime Database. The tricky
part (assigning random numbers, turn order, "first person to click wins the claim") is handled
two ways:

- **Compare-and-swap writes**: e.g. claiming host, claiming a segment in Who Wrote That — a
  plain write that only succeeds if the database rules confirm the old value was what you
  expected. If two people click at once, exactly one write wins.
- **Realtime Database transactions**: for anything computed from existing state (random number
  assignment, turn advancement, attempts remaining) — the client reads the current server value
  and computes the next value; if two clients race, the loser is automatically retried against
  the winner's result.

Every write path is also independently checked by [`database.rules.json`](database.rules.json)
— the client code is convenience, not the security boundary.

## Adding a new game

1. Add an entry + component to [`src/games/registry.js`](src/games/registry.js).
2. Create `src/games/<your-game>/YourGame.jsx` and (if it needs setup logic) a `state.js` next to
   it, following the pattern in `src/games/whats-my-number/`.
3. Your component receives `{ code, me, hostUid, playerList, connectedCount, game }` props and
   reads/writes `rooms/{code}/game` via helpers in `src/lib/`. Use `ReadyButton` and
   `PlayAgainScreen` from `src/components/` for the shared "I'm Ready" majority vote and the
   end-of-round screen.
