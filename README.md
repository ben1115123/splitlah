# SplitLah — a Splitwise-style expense splitter you host yourself

A home-screen web app (PWA) for splitting costs with friends. One group per trip or occasion, as many groups as you like, reusable forever. Friends need **no account and no app store**, just your link.

## What it does

- **Groups for every trip/occasion.** Each has its own people, main currency, and history. Archive a group when the trip's over; it stays readable.
- **Add expenses** with who paid (one person, or **several people**, e.g. Ben paid RM600 and Amy RM300 of the villa), date, category (auto-guessed from the description: "Grab to airport" → Transport), and notes.
- **Five split methods:** Equal · Exact amounts · Percentages · Shares (e.g. 2 for a double portion) · Adjustment (equal, plus extra for someone's drink).
- **Multi-currency.** Log in THB/JPY/SGD/etc.; it converts to the group's main currency at a rate you can type or fetch ("Get today's rate"). The rate is saved per group, so the next THB expense pre-fills it.
- **Balances + Settle up.** "Simplify" shows the fewest transfers that square everyone up; turn it off to see who owes whom directly. Tap **Record** to log a payment.
- **Insights:** total spend, per person/per day, paid vs share, spend by category, **CSV export** for Excel/Sheets.
- **Safe for a group of friends:** deletes are soft (restorable, with Undo); every item shows who added and who last edited it.
- **Works offline.** Add expenses on a plane or with no signal; they sync when back online.
- Light & dark mode.

## Accuracy

All money is stored as **integers in the smallest unit** (sen, cents, yen). No floating-point drift.
- Equal splits spread leftover cents so totals match exactly (RM100 ÷ 3 = 33.34 + 33.33 + 33.33).
- Percent/share splits use the largest-remainder method: every split always adds up to the exact total.
- Foreign-currency expenses are converted once, then shares are re-allocated in the main currency so they still sum exactly.
- Covered by unit tests, including 2,000 randomised groups checking that suggested settlements always bring everyone to exactly zero.

---

## One-time setup (~10 minutes, free)

You need: a Google account (for Firebase) and somewhere to host the files (Netlify or GitHub, both free).

### 1. Create the Firebase database

1. Go to **https://console.firebase.google.com** → **Create a project** → name it (e.g. `splitlah`) → you can switch off Google Analytics → Create.
2. Left menu **Build → Firestore Database → Create database**
   - Location: **asia-southeast1 (Singapore)**, the closest to KL
   - Start in **production mode** → Create.
3. Open the **Rules** tab, delete what's there, paste the whole contents of `firestore.rules` from this folder → **Publish**.
4. Left menu **Build → Authentication → Get started → Sign-in method → Anonymous → Enable → Save.**
   (Every phone signs in invisibly; the rules reject anything not from your app.)
5. **Project settings** (gear icon) → **General** → scroll to **Your apps** → click the **`</>`** (Web) icon → nickname `splitlah` → **Register app** (don't tick Hosting).
6. It shows a `firebaseConfig = { apiKey: ..., ... }` block. Open **`config.js`** in this folder and paste those six values in place of the `PASTE_…` placeholders. Save.

> The Firebase "apiKey" is not a secret: every Firebase web app ships it to the browser. Access is controlled by the rules you just published.

### 2. Put it online (pick one)

**Option A: Netlify (easiest, drag-and-drop)**
1. Sign up free at **https://app.netlify.com** → **Add new site → Deploy manually**.
2. Drag the whole `splitlah` folder onto the page. You get a URL like `https://something.netlify.app` (rename it in Site settings, e.g. `splitlah-ben.netlify.app`).

**Option B: GitHub Pages**
1. New public repo (e.g. `splitlah`) → **Add file → Upload files** → drop in everything inside this folder → Commit.
2. Repo **Settings → Pages** → Source: *Deploy from a branch*, Branch: `main` / root → Save.
3. Your app lives at `https://<your-username>.github.io/splitlah/` after a minute.

It must be **https** for install-to-home-screen and offline mode. Both options give you that.

### 3. Recommended hardening (2 minutes)

- In **Google Cloud Console → APIs & Services → Credentials**, open the "Browser key (auto created by Firebase)" → **Application restrictions: Websites** → add `https://your-site.netlify.app/*` (or your github.io URL). Now the key only works from your site.
- If you ever see a sign-in error, add your site's domain under **Authentication → Settings → Authorized domains**.

---

## Using it

1. Open your site → **New group** → name, icon, main currency, your name and your friends' names.
2. Tap **Copy link / Share…** and send it to the group chat.
3. Each friend opens the link → taps their name ("Who are you?") → done.
4. **Add to home screen from the group page:**
   - iPhone: Safari → **Share** → **Add to Home Screen**
   - Android: Chrome menu ⋮ → **Add to Home screen / Install app**

   Installing from the group page makes the icon open straight into that group. (On iPhone, home-screen apps keep separate storage from Safari, so the app asks "Who are you?" once more on first launch; that's a single tap.)
5. Next trip: **New group** again. Old groups stay in your list; archive them to tidy up.

### Tips
- The currency you last used in a group sticks, so on a Bangkok trip every new expense defaults to THB.
- In **Exact** / **%** splits, tap **Fill rest** to give the remainder to the last person.
- Anyone in a group can rename or add people under ⚙️ settings. People already in an expense can't be removed (that would break balances).
- The main currency locks once a group has expenses, so old balances never shift.

## Updating the app later

If you change any file, also bump `VERSION` at the top of `sw.js` (e.g. `splitlah-v1.0.1`) and re-upload. Phones pick up the new version on their next launch.

## Costs

Firebase's free Spark plan covers 50,000 reads and 20,000 writes per day plus 1 GB of storage. A friend group logging hundreds of expenses a trip uses a tiny fraction. No card required.

## Security model, in brief

- Each group's ID is 20 random characters (~119 bits). That ID **is** the invite: whoever has the link can view and edit that group, like a Google Docs "anyone with the link" share. Only send it to the group.
- Groups can't be listed or searched; you can only open one if you know its ID.
- Only signed-in app clients can read/write; the rules validate field types and sizes; hard deletes are blocked (the app soft-deletes).
- All user text is HTML-escaped on display; CSV export neutralises spreadsheet formula injection.

## Demo mode

If `config.js` still has the `PASTE_…` placeholders, the app runs in **demo mode**: fully working, but data stays in that one browser. Useful for a quick try before setting up Firebase.

## Files

| File | What it is |
|---|---|
| `index.html`, `styles.css` | App shell and design |
| `js/app.js` | Screens and interactions |
| `js/logic.js` | All money maths (splits, conversion, balances, debt simplification) |
| `js/store.js` | Firebase Firestore + demo-mode storage |
| `config.js` | **Your Firebase keys go here** |
| `firestore.rules` | Paste into Firebase → Firestore → Rules |
| `sw.js`, `manifest.webmanifest`, `icons/` | Home-screen install + offline support |
