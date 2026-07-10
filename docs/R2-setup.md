# BASL-Fotogalerij — R2 Setup Guide (zero-IT fallback)

> Complete setup guide for the **Cloudflare R2 + client-side compression** version.
> Companion to `brief.md` — everything in the brief applies (roles, tokens, manifests, caching, admin panel, Dutch UI) unless overridden here.
> This version requires **no school IT involvement whatsoever**. Mobile-first throughout (brief has the hard requirement): teachers upload from phones, parents view on phones. Photos only — **no video** (rejected at the dropzone with a friendly message).

---

## 1. What differs from the SharePoint version

| Aspect | SharePoint | R2 (this guide) |
|---|---|---|
| Storage | School tenant | Cloudflare R2 free tier (10 GB) |
| IT needed | One-time setup | **None** |
| Originals | Kept | Compressed client-side (adaptive, §3) |
| Video | Yes | **No** |
| Thumbnails | Graph `/thumbnails` | Generated client-side at upload |
| Download-all | Microsoft server-side zip | Streaming client-side zip (`client-zip`) |
| Staff login | Microsoft SSO | **Username + password** (§2b) — no Azure, no mail provider, nothing external |

### 2b. Staff auth on this backend: username + password

School tenants commonly block user consent for unverified apps, which kills no-IT SSO — so this version uses plain password auth, fully specced in brief §3b. The essentials:

- **Username = the school's 4-letter staff abbreviation** (`vhru`), mapped to email in `teachers.json`.
- **The admin chooses every password himself** in the panel (no self-service, no reset mails) and hands them out like Smartschool codes.
- **PBKDF2-SHA256 via WebCrypto** (~100k iterations, per-user salt) — *not* bcrypt (Workers CPU budget).
- 5 fails/username → 15-min lockout. 90-day session cookie: one login per device per schooljaar.
- Panel button *"Alle wachtwoorden wissen"* blanks everyone **except the bootstrap admin** at the start of each schooljaar.

Parents are untouched — album links never require login. If the SharePoint version ever lands, flip `AUTH_MODE=sso` and passwords simply stop being needed.

---

## 2. Cloudflare setup (click-by-click, ±15 min)

1. **Account** — dash.cloudflare.com, free plan. No credit card needed for anything below.
2. **R2 bucket** — R2 → Create bucket → name `basl-fotogalerij`, and set **jurisdiction: EU** (dashboard toggle, or `wrangler r2 bucket create basl-fotogalerij --jurisdiction eu`). This is a *hard guarantee* that data at rest never leaves EU data centers — stronger than a location hint, and the correct GDPR posture for photos of minors. The binding in step 4 must declare the same jurisdiction (`jurisdiction = "eu"` in wrangler.toml). Leave the bucket **private** — never enable public access; everything is served through Functions with token checks.
3. **Pages project** — Workers & Pages → Create → Pages → connect the GitHub repo. Build command `npm run build`, output `dist`. Every push to `main` deploys.
4. **R2 binding** — Pages project → Settings → Functions → R2 bucket bindings → add binding `BUCKET` → `basl-fotogalerij`. This is why we need no S3 keys and no pre-signed URLs: Functions read/write the bucket directly.
5. **Environment variables** (Settings → Environment variables, all *encrypted*, production):
   ```
   STORAGE_BACKEND        = r2
   AUTH_MODE              = password
   BOOTSTRAP_ADMIN_EMAIL  = ruben@broeders.be
   SESSION_SECRET         = <openssl rand -hex 32>
   SHARE_SECRET           = <openssl rand -hex 32>
   STORAGE_HARD_CAP_GB    = 9.8
   ```
6. **Custom domain** — Pages project → Custom domains → `foto.enderklas.be`. The zone is on your own Cloudflare account, so the CNAME is self-service — no school IT. (Parents only ever click/scan links, so the domain branding is invisible to them.)

**Free-tier budget check:** R2 10 GB storage + 1M class-A + 10M class-B ops/month; Workers 100k requests/day. With the 24 h version-busted cache from `brief.md` §8, parent traffic barely touches Functions. Nothing here approaches a limit.

---

## 3. Adaptive compression (the core of this version)

All compression happens **in the browser before upload**. The server never touches image bytes except to store them.

### Presets

```ts
// src/config/compression.ts
export const PRESETS = {
  hoog:    { maxDim: 2560, quality: 0.85 },  // ~1.0 MB — default, indistinguishable on screens & 10×15 prints
  normaal: { maxDim: 2048, quality: 0.80 },  // ~600 KB
  zuinig:  { maxDim: 1600, quality: 0.75 },  // ~350 KB — WhatsApp-tier, still perfectly fine
} as const;

export const THRESHOLDS_GB = { normaal: 6, zuinig: 8.5 }; // auto-degrade points
```

### Selection flow

1. Dropzone start → `GET /api/storage-status` → `{ usedBytes, preset }`. The Function computes the preset from usage (admin can pin a preset in `/config/settings.json` to override auto).
2. All files in this batch compress with that preset. Above `STORAGE_HARD_CAP_GB` the endpoint refuses uploads entirely — the billing failsafe. One exception: admins can arm a 60-minute "Noodupload" bypass from the Opslag tab (confirm dialog shows usage + real overage cost; self-disarms; session-scoped; spec in brief §6). Contributors never bypass. The active preset is shown subtly in the UI ("kwaliteit: hoog").
3. Yearly wipe resets usage → every September starts at *hoog* again.

### Pipeline (per file, in a small worker-pool of 3 to keep the UI responsive)

```
File → createImageBitmap()            // EXIF orientation handled natively
     → OffscreenCanvas scale to maxDim (longest side; never upscale)
     → convertToBlob('image/webp', quality)          → main image
     → second pass at 400px, q0.72                   → thumbnail (~25 KB)
     → POST both to /api/albums/:id/upload (multipart)
```

- **HEIC (iPhone):** `createImageBitmap` fails on HEIC outside Safari. Catch the decode error → lazy-load `heic2any` (only then, it's ~300 KB) → convert to a blob → re-enter the pipeline. Safari decodes HEIC natively so the fallback rarely fires there.
- **Skip rule:** if the source file is already smaller than the preset's expected output (rare screenshots etc.), upload as-is minus the thumbnail step.
- **Video rejection:** any `video/*` mime → toast *"Video's worden in deze versie nog niet ondersteund — enkel foto's."* File skipped, batch continues.

### Upload endpoint

Compressed files are ~1 MB, far under the Workers 100 MB body limit — so no chunking, no upload sessions, no pre-signed URLs. Plain multipart POST; the Function streams `main` and `thumb` into R2:

```
/albums/{classId}/{albumId}/{uuid}.webp
/albums/{classId}/{albumId}/thumbs/{uuid}.webp
```

then bumps the album's **home** manifest — **debounced**: the client registers once per ~10 completed files and at batch end, and the endpoint retries with jitter until the ETag write lands (brief §5, shared-album hot path). Client concurrency stays at 6; compression pool at 3 feeds it.

---

## 4. Serving, manifests, tokens, download-all

- **Serving:** `GET /api/img/:albumId/:file?tok=…` → verify HMAC token → `BUCKET.get()` → stream. Cache per brief §8: the *listing* runs hot/settled (10 s / 24 h, version-busted), but **image and thumbnail binaries cap at `max-age=3600`** — the GDPR clause: a consent-violating photo deleted by a teacher vanishes from the gallery in seconds (version bump) and from any direct cached URL within 1 h.
- **Manifests:** identical sharded JSON design as brief §5, stored at `manifests/<class_id>.json` in R2. Concurrency: R2 `put()` supports conditional writes (`onlyIf: { etagMatches }`) — same read-ETag → conditional-write → retry-once pattern. Agent: verify the exact `onlyIf` syntax against current R2 binding docs before implementing.
- **Tokens:** unchanged (HMAC of `albumId:tokenVersion`, URL hash, revoke = bump `tokenVersion`).
- **Download-all:** no server-side zip on R2. Use **`client-zip`** (streams a zip Response without holding files in memory) + a service-worker/StreamSaver pattern: fetch each image sequentially through the token route, pipe into the zip stream. A 650-photo album at *hoog* ≈ 650 MB — streaming keeps memory flat; show a progress bar and a "dit kan even duren op mobiel" hint. Albums ≤ 50 photos may use plain JSZip for simplicity if the agent prefers one path — but streaming is the required approach above that.
- **Wipe:** `POST /api/admin/wipe` lists and deletes all objects under `albums/` (R2 `list` + batched `delete`, loop over cursors), resets manifests. Keep `config/admins.json` + `config/teachers.json`.

---

## 5. Repo structure

```
├─ wrangler.toml                      # pages config + R2 binding for local dev
├─ .dev.vars.example
├─ package.json                       # vite, react, tailwind, client-zip, heic2any (lazy)
├─ src/
│  ├─ config/classes.ts               # 17 klassen + school
│  ├─ config/compression.ts           # presets + thresholds (§3)
│  ├─ App.tsx
│  ├─ lib/{api.ts, compress.ts}       # compress.ts = §3 pipeline + worker pool
│  ├─ pages/{Landing,AuthCallback,AdminPanel,ContributorView,AlbumView}.tsx
│  └─ components/{UploadZone,GalleryGrid,Lightbox,DownloadAll}.tsx
└─ functions/api/
   ├─ _middleware.ts                  # session, role resolution
   ├─ auth/[[route]].ts               # password login (PBKDF2, lockout); SSO behind AUTH_MODE for later
   ├─ storage/r2.ts                   # StorageAdapter impl (brief §2)
   ├─ storage/sharepoint.ts           # stub now; filled if IT says yes
   ├─ manifests.ts  ├─ tokens.ts
   ├─ img/[albumId]/[file].ts         # token-gated serving + cache headers
   ├─ storage-status.ts               # usage → preset
   └─ albums/… admin/…                # routes per brief §4 (upload replaces upload-session)
```

Local dev: `npx wrangler pages dev -- npm run dev` with a local R2 simulator binding. AGPL-3.0, public repo, Dutch UI copy, strict TS.

---

## 6. Agent build prompts (sprints)

Feed these sequentially; each ends with a working, committable state. Prepend to every prompt: *"Context: brief.md + BASL-Fotogalerij_R2-setup.md. Explain what you build and why. Strict TypeScript, Dutch UI copy."*

**Sprint 1 — Skeleton.** "Scaffold the repo per §5: Vite+React+TS+Tailwind with Cloudflare Pages Functions, R2 binding `BUCKET`, env plumbing with `.dev.vars.example`, the `StorageAdapter` interface from brief §2 with an `r2.ts` implementation covering `readJson`/`writeJson` (conditional writes) and a health route that round-trips a JSON file to R2. Deployable to Pages."

**Sprint 2 — Auth & roles.** "Implement password auth per brief §3b: `POST /api/auth/login` with 4-letter usernames from `config/teachers.json`, PBKDF2-SHA256 via WebCrypto with per-user salt, 5-fails/15-min lockout, 90-day signed session cookie. `/api/me` resolving admin (bootstrap env + `config/admins.json`) and contributor classes. Leave an `AUTH_MODE=sso` seam for later; don't implement it. Route guards on the frontend."

**Sprint 3 — Albums & manifests.** "Sharded per-class manifests with ETag retry-once, album create/list/delete (8-char nanoid IDs) with **multi-class tagging** per brief §5 (home manifest + `classes[]`, class-picker grouped kleuter/lager in the create modal, listings aggregate-and-filter), short HMAC share tokens per brief §7 (truncated to 16 chars — intentional), share modal with copy + revoke + client-side QR code (`qrcode` package) incl. PNG download. Album creation is the 3-step wizard from brief §9 (title → grouped class tags → confirm-with-link+QR), rendered as a bottom sheet on mobile. **Deletes are also a contributor right within own classes** (albums and single photos, `DELETE /api/albums/:id/items/:itemId`), always version-bumping — the GDPR consent-fix path. Confirm dialogs on both. Admin panel Albums tab + contributor view, per brief §9."

**Sprint 4 — Compression & upload.** "Implement `lib/compress.ts` per §3: preset fetch from `/api/storage-status`, worker pool of 3, WebP main + 400px thumb, HEIC lazy fallback, skip rule, video rejection toast. Mobile camera-roll picking must be first-class. `UploadZone` with 6-concurrent queue, per-file progress, per-file retry, batch survives individual failures. Multipart upload endpoint streaming to R2 and bumping the manifest."

**Sprint 5 — Gallery & downloads.** "Every album view renders the permanent retention banner (brief §7: beschikbaar tot 1 augustus, download vóór die datum, from `WIPE_DEADLINE`), and the share modal appends the same line to the copyable share text. Token-gated `/api/img/...` serving with the hot/settled cache strategy (brief §8) and version-busted keys. `AlbumView`: lazy thumb grid, lightbox (keyboard nav), single download, and `DownloadAll` using client-zip streaming with progress."

**Sprint 6 — Admin rest + polish.** "Export tab: 'Exporteer alles' → sequential per-class streaming zips per brief §9 (client-zip, album folders with composed `[schooljaar]-[album-slug]-[photoId].webp` filenames per brief §5, skip empty, per-class progress/retry, desktop-aanbevolen hint). Opslag tab includes the cap warning banner (≥8.5 GB) and the admin-only Noodupload bypass toggle per brief §6 (60-min session claim, confirm with cost, self-disarming). Teachers tab now includes credential management: per-teacher username (4-letter) + admin-typed password field (hash on save), and the *'Alle wachtwoorden wissen'* button that blanks all hashes except the bootstrap admin. Beheerders/Opslag tabs (usage per class from R2 list), pinned-preset override, the WISSEN wipe with cursor-looped deletes, empty states, error boundaries, school branding (#00aad3, emblem, Poppins), Dutch copy pass, README with §2 setup steps."

---

## 7. Rollout checklist

- [ ] R2 bucket (WEUR) + Pages project + binding + secrets (§2)
- [ ] Configure Cloudflare billing notifications (Notifications → usage alerts) on the new account
- [ ] Set your own admin password first; then usernames + passwords for the pilot teacher(s) and distribute via Teams/paper
- [ ] Real class labels in `classes.ts`
- [ ] Pilot: one album, one teacher, ~100 photos incl. a few HEIC — check quality at *hoog* on phone + laptop
- [ ] Test the consent-fix path: teacher deletes one photo → verify it's gone from the gallery immediately and the direct URL dies within the hour
- [ ] Test download-all on a phone (streaming zip)
- [ ] Interim domain `*.pages.dev` in the first nieuwsbrief if the CNAME isn't live yet
- [ ] If IT later approves SharePoint: implement `storage/sharepoint.ts`, flip `STORAGE_BACKEND`, video unlocks — nothing else changes
