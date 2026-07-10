# brief.md — BASL-Fotogalerij (foto.sintlutgart.be)

> Implementation brief for an AI coding agent.
> Author: Ruben. Working style: pragmatic, risk-calibrated, ship with acceptable risk.
> Explain what you're doing and why as you go, especially in code. Prefer readable, ownable scaffolding over black-box generation.

---

## 0. What this is

A self-hosted, privacy-first photo-sharing platform replacing Google Photos for the whole school: **18 classes (6 kleuter + 12 lager) + 1 school-wide album**. Teachers upload event photos/videos; parents view and download via a per-album share link with no account. Everything is wiped manually by an admin at the end of the school year. Photos and all metadata live on the school's Microsoft 365 (one SharePoint site). There is **no database** — SharePoint is both the file store and the metadata store.

**Name:** BASL-Fotogalerij
**Domain:** `foto.enderklas.be` — Ruben's own Cloudflare zone, one CNAME he controls himself, no school IT involvement. Parents never see the base domain (they click links or scan QR codes), so the enderklas branding on a school-wide tool is a non-issue.
**Email domain (staff):** `@broeders.be`
**License:** AGPL-3.0. Public GitHub repo — school IT will review the code; write it accordingly.
**Ethos:** free forever, no parent accounts, no third-party storage, data stays on the school tenant.

**Mobile-first is a hard requirement, not a nice-to-have.** Teachers upload from their phones (that's where the photos are); parents open nieuwsbrief links on their phones. Design every screen for a ~380 px viewport first and let desktop be the enhancement: thumb-reachable touch targets (≥44 px), the upload flow must work smoothly from the mobile camera roll / file picker, wizards and modals render as bottom sheets on small screens, and the gallery grid + lightbox get swipe navigation. Test on a real phone every sprint.

**Branding:** accent `#00aad3` (school cyan), ink `#1a1a1a`, light/white UI matching sintlutgart.be. School emblem SVG available (circular mark, 3 paths, fill=currentColor, viewBox 0 0 292.89 292.89) — use it in the header. Typography: Poppins or similar geometric sans.

---

## 1. Stack

| Layer | Choice |
|-------|--------|
| Frontend + server | **One repo**: Vite + React 18 + TypeScript + Tailwind, with **Cloudflare Pages Functions** (`/functions` dir) as the API. No separate Worker. |
| Hosting | Cloudflare Pages (free) |
| Database | **None.** SharePoint JSON manifests (see §5) |
| File storage | Per backend: SharePoint (school tenant, EU) or R2 bucket created with **`jurisdiction: eu`** — hard guarantee data-at-rest stays in EU data centers (GDPR). |
| Auth (storage ops) | Graph **app-only** — client-credentials flow, `Sites.Selected` scoped to the one site |
| Auth (staff) | Per backend: SharePoint → Microsoft SSO (delegated, **identity only**); R2 → username/password (§3b). Same session cookie out the back, switched by `AUTH_MODE=sso|password`. |
| Auth (parents) | None — HMAC-signed share tokens (§7) |
| Wipe | **Manual** admin button, no cron (§10) |

---

## 2. Critical architecture decisions — READ FIRST

**Two Graph auth flows. Never conflate them.**

1. **App-only (client credentials + `Sites.Selected`)** — ALL file/manifest operations: folders, uploads, listings, share links, deletes, manifest reads/writes. One cached app token, reused until expiry (token requests hit Entra, not Graph — don't re-acquire per request).
2. **Delegated (auth-code)** — ONLY to identify a staff member at SSO login (read email from ID token → resolve role). Their token is never used for file operations. Staff keep their own MFA. *(SharePoint backend only — the R2 backend uses password auth instead, §3b.)*

**If you find yourself uploading with a teacher's delegated token, stop — that is the rejected model.** All storage actions run as the app against the one locked-down site.

**No database.** All metadata lives as JSON files on the storage backend itself, sharded to avoid write contention (§5). Do not introduce D1/KV/etc.

**Storage goes through an adapter — build this from day one.** School IT may approve the SharePoint setup or may not; the platform ships either way. All storage access happens through a single `StorageAdapter` interface with two implementations, switched by env var `STORAGE_BACKEND=sharepoint|r2`:

```ts
interface StorageAdapter {
  readJson(path: string): Promise<{ data: unknown; etag: string } | null>;
  writeJson(path: string, data: unknown, ifMatchEtag?: string): Promise<void>; // throws Conflict on etag mismatch
  createAlbumFolder(classId: string, albumId: string): Promise<{ folderId: string }>;
  createUploadTarget(albumId: string, file: { name: string; size: number; mime: string }): Promise<UploadTarget>;
  listAlbum(albumId: string): Promise<MediaItem[]>;          // includes thumbnail URLs
  getDownloadUrl(albumId: string, itemId: string): Promise<string>; // short-lived
  getAlbumDownloadLink(albumId: string): Promise<string | null>;    // null on R2 (client-zip instead, see R2 guide)
  deleteAlbumFolder(albumId: string): Promise<void>;
}
```

- **`sharepoint`** (primary): Graph app-only per the flows above. Full feature set incl. video.
- **`r2`** (fallback, zero IT involvement): Cloudflare R2 free tier + **client-side image compression**. **Photos only — video is excluded on this backend**, not worth the headache (no compression path, 10GB budget, codec issues). Full R2 upload/compression spec lives in `BASL-Fotogalerij_R2-setup.md` §3–4, which overrides this brief's §6 on that backend.

Feature flags derive from the backend: `supportsVideo = backend === 'sharepoint'`. The UploadZone rejects video files with a friendly Dutch message when on R2.

---

## 3. Roles & access

| Role | Auth | Capabilities |
|------|------|--------------|
| **Admin** | staff login (§3b); email == `BOOTSTRAP_ADMIN_EMAIL` env var **or** listed in `admins.json` | Everything: all classes + school album, manage admins, manage teacher↔class mappings, generate/revoke links, storage overview, year-end wipe |
| **Contributor** | staff login (§3b); listed for ≥1 class in `teachers.json` | Create albums + upload in assigned class(es). **Delete individual photos and whole albums within own class(es)** — required for GDPR/consent fixes (e.g. a photo of a child without a consent form must be removable by the teacher immediately, not routed through an admin). Deletion bumps the album `version` (instant cache bust of the listing). School album counts as a class. No cross-class visibility. |
| **Viewer** (parent) | none; valid HMAC share token | View one album, play videos, download single files, download whole album |

**Admin management is in-app**, not env vars: the panel has a "Beheerders" section (add/remove by email → writes `admins.json`). The bootstrap email is un-removable in the UI, so a bad edit can never orphan the platform. Any admin may add/remove other admins — acceptable at this scale, don't build role hierarchies.

### 3b. Staff auth — password mode (`AUTH_MODE=password`, default on R2)

- **Username = the school's existing 4-letter staff abbreviation** (e.g. `vhru`). Teachers already know theirs; no new namespace. The mapping username→email lives in `teachers.json` (§5).
- **Passwords are chosen by the bootstrap admin, and only by him.** No self-service, no reset-by-mail, no "choose your password" flow. The admin panel has a per-teacher password field; he types it, it's hashed, he distributes it (Teams/paper) like any Smartschool code.
- **Hashing: PBKDF2-SHA256 via WebCrypto** (`crypto.subtle.deriveBits`, ~100k iterations, per-user salt). **Not bcrypt** — bcrypt libraries blow the Workers CPU budget; PBKDF2 through WebCrypto is the canonical Workers pattern.
- **Brute-force brake:** 5 failed attempts per username → 15-minute lockout (tiny JSON alongside the manifests). Sufficient at 17 users behind Cloudflare.
- **Session:** same signed cookie as SSO mode, 90 days — a teacher types the password roughly once per device per schooljaar.
- **Yearly refresh:** admin-panel button *"Alle wachtwoorden wissen"* blanks every password hash **except the bootstrap admin's own** — teachers can't log in until he sets new ones for the new schooljaar. Admin passwords guard the wipe button; they are never exempt from being strong.

**Classes:** 18 + `school`, defined in `src/config/classes.ts` — the **real list is already in the repo** (Peuters, PK1A–C, K2, K3, L1A–L6B, school), grouped kleuter/lager/school via a `group` field so the UI sections the pills instead of showing 19 flat.

---

## 4. Routes

### Frontend
```
/                     Landing: 'Leerkracht' login (per AUTH_MODE) + parent album-link entry
/auth/callback        OAuth redirect handler
/beheer               Admin panel (albums per class · teachers · admins · storage · wipe)
/uploaden             Contributor view (own classes: create album, upload)
/album#tok=<token>    Public album gallery (token in URL HASH — see §7)
```

### Pages Functions (`/functions/api/…`)
```
POST /api/auth/login              Password mode: {username, password} → session cookie
POST /api/auth/callback           SSO mode: OAuth code → session cookie (signed, SESSION_SECRET)
GET  /api/me                      Identity, role, allowed classes
GET  /api/classes/:id/albums      List albums (contributor own-class / admin)
POST /api/classes/:id/albums      Create album (folder + share link + manifest entry)
DELETE /api/albums/:id            Delete album (admin, or contributor in own class)
DELETE /api/albums/:id/items/:itemId  Delete single photo (admin/contributor own class); bumps version
GET  /api/album?tok=…             Validate token → album meta + live photo listing (cached, §8)
POST /api/albums/:id/upload-session   Create Graph upload session → return uploadUrl
POST /api/albums/:id/register     Register completed upload (bump manifest lastUploadAt + version)
GET  /api/photos/:albumId/:itemId/download   Short-lived Graph download URL
GET  /api/admin/teachers|admins   CRUD on teachers.json / admins.json
POST /api/admin/wipe              Year-end wipe (admin, confirmation phrase required)
```

---

## 5. Data model — SharePoint JSON manifests

Site layout:
```
/config/admins.json          ["ruben@broeders.be", "it-collega@broeders.be"]
/config/teachers.json        keyed by username (4-letter abbrev), see below
/manifests/<class_id>.json   per-class album manifest (18 files: 17 classes + school)
/albums/<class_id>/<album_id>/   the actual photo folders
```

`config/teachers.json` (password mode):
```json
{
  "sadj": { "email": "sara.dejager@broeders.be", "classes": ["3a","school"], "pass": "<pbkdf2$iter$salt$hash>" },
  "vhru": { "email": "ruben@broeders.be",        "classes": [],              "pass": "<…>" }
}
```
(Admins are resolved via `admins.json` + bootstrap env as before; an admin entry here just provides their login credentials.)

Per-class manifest (`manifests/klas-3a.json`):
```json
{
  "albums": [
    {
      "id": "x7Kp2mQd",
      "name": "Schoolreis Hidrodoe",
      "classes": ["l3a","l3b"],
      "createdAt": "ISO8601",
      "createdBy": "x@broeders.be",
      "folderId": "<graph driveItem id>",
      "shareLinkUrl": "<SharePoint anonymous folder link, for download-all>",
      "lastUploadAt": "ISO8601",
      "version": 7,
      "tokenVersion": 1,
      "backend": "r2"
    }
  ]
}
```

**Multi-class albums (tags, not copies):** an album can be tagged with multiple classes (`classes: ["l3a","l3b","l4a","l4b"]` — think sportdag per graad) but lives in exactly **one home manifest**: the manifest of the creating teacher's active class (admins pick the home explicitly). Never duplicate an album entry across manifests — one write location per album, no sync drift. A teacher's album list is computed by reading **all** manifests (19 tiny cached JSONs) and filtering where `classes` intersects their assigned classes. Every tagged teacher gets upload **and** delete rights on the album (deletes included deliberately — the GDPR consent-fix path can't depend on which class's teacher spots the problem photo). At creation, a contributor may tag any subset of their own classes plus any other classes (tagging grants access, and graad-albums are the common case); the creator's class is always included.

**Why sharded (and the shared-album hot path):** uploads bump only the home manifest. But shared albums mean several teachers may upload to the **same** album simultaneously (sportdag afternoon), so per-file registration would hammer one manifest with read-modify-writes. Therefore: **registration is debounced client-side** (register once per ~10 completed files and at batch end — possible because manifests hold no per-photo data, only `lastUploadAt`/`version`), and the register endpoint **retries with jitter until success** (merge is trivial: max timestamp, increment version — always converges). The retry-once rule below applies to album create/delete, not registration. Same-class same-second conflicts are handled with SharePoint's ETag: read the ETag, write with `If-Match`, on 412 re-read and retry once. The admin panel reads all 18 small files for the overview.

**The `backend` field is intentionally "dead" in v1 — do not remove it.** Nothing reads it initially; every album gets the current `STORAGE_BACKEND` value at creation. It exists for the planned storage migration (§14): the migration script uses it as an idempotency marker (flip per album after a successful copy, so a crashed run resumes instead of restarting), and it enables mixed-backend routing if albums ever need to live on two stores mid-year. A field added in a schema from day one costs nothing; retrofitting it into live manifests during a maintenance window is exactly the kind of error-prone step the migration plan is designed to avoid.

**Export filenames are composed, not preserved.** Teachers' camera files carry no meaningful names, so originals aren't stored anywhere. Exported (and single-downloaded) files are named at serve time as `[schooljaar]-[album-slug]-[photoId].webp` (e.g. `2026-2027-sportdag-x7Kp2mQd.webp`) — self-describing even when a file is later dragged out of its album folder. Composed from the schooljaar constant + the album title from the manifest + the object's nanoid; no per-object metadata needed.

**No photo manifest.** Photo listings come live from Graph (`/children` on the album folder, `$expand=thumbnails`), then cached per §8. Never expose Graph item/folder IDs in ways a parent could exploit; the Function resolves everything server-side from the manifest.

---

## 6. Upload flow (SharePoint backend — R2 backend uses the simpler flow in the R2 guide §3)

Per file (all types, images + video, no count/size caps):
1. Browser → `POST /api/albums/:id/upload-session` (filename, size, mime).
2. Function (app-only) creates a Graph **upload session** on the album folder → returns the pre-authenticated `uploadUrl`.
3. Browser PUTs the file to `uploadUrl` in **10 MB chunks** (`Content-Range`), directly to SharePoint. App credentials never reach the browser.
4. On completion, browser → `POST /api/albums/:id/register`; Function updates the manifest: `lastUploadAt = now`, `version++` (ETag retry per §5).

- **Concurrency: 6** simultaneous files (configurable), rest queued. Per-file progress bar.
- Chunk failures: retry the failed range; a failed file shows a retry button and never kills the batch.
- Always use upload sessions (even <4 MB) for one code path.
- On any Graph 429/503: honor `Retry-After`, exponential backoff, no immediate retries.

---

**Billing failsafe (R2 backend):** `/api/storage-status` already computes bucket usage for the compression presets. Above `STORAGE_HARD_CAP_GB` (default 9.8), the upload endpoint **refuses** new files with a clear Dutch message ("Opslag vol — verwittig de beheerder"). This makes exceeding the R2 free tier impossible at the application level, independent of any Cloudflare billing settings. The admin Opslag tab shows a warning banner from 8.5 GB onward.

**Admin emergency bypass ("Noodupload"):** the cap applies to admins too, by default. The Opslag tab exposes a bypass toggle — admin-only, rendered only when the cap is reached — that arms bypass **for that admin's session, for 60 minutes**, after a confirm dialog stating the current usage and the real overage cost (±€0,015/GB/maand). It self-disarms on expiry or logout and is never persisted. Implementation: a short-lived `bypassUntil` claim added to the admin's session cookie; the upload endpoint honors it only for admin sessions. Design intent: the exception must be *explicit, temporary, and loud* — a standing "admins skip the check" flag would silently reintroduce the charge risk the cap exists to eliminate. Contributors have no bypass path under any circumstances.

## 7. Share tokens (no token storage)

Self-verifying, and **short by design** — parent links must look clean in a nieuwsbrief:
- Album IDs are **8-char nanoids** (not UUIDs).
- Token = `base64url(albumId + ":" + tokenVersion)` + `"."` + **first 16 base64url chars** of `HMAC-SHA256(albumId + ":" + tokenVersion, SHARE_SECRET)`. Truncation to ~96 bits is deliberate and safe for this threat model (unguessable against a rate-limited endpoint); do not "fix" it back to full length.
- Resulting link shape: `foto.enderklas.be/a/x7Kp2mQd#k9fQ3vLwXz2dPmR4` — short enough to survive mail clients and even manual typing from paper.
- **QR codes:** the share modal renders a QR of the full link **client-side** (`qrcode` npm package — no external service, no tracking) with a "Download QR (PNG)" button, so teachers drop it straight into printed/PDF nieuwsbrieven next to the retention line. This is the primary parent path from print.
- No third-party URL shorteners, ever — they inject tracking and break the no-tracking promise.

- Delivered in the **URL hash** (`/album#tok=…`) so it never reaches server logs or Referer headers; client sends it in an `Authorization` header to the API.
- Function verifies the HMAC, extracts albumId + tokenVersion, finds the album in the manifests, and checks `tokenVersion` matches. Unforgeable without the secret; no lookup table.
- Revocation ("link intrekken" in admin) = bump the album's `tokenVersion` → all previously shared links die instantly; admin copies the new link.
- Download-all = the album's `shareLinkUrl` (SharePoint anonymous link; Microsoft zips server-side). Single file = short-lived Graph download URL via the Function.
- **Retention banner (mandatory, parent-facing):** every album view shows a persistent, non-dismissable notice: *"📅 Dit album is beschikbaar tot 1 augustus. Download de foto's die je wil bewaren vóór die datum."* The date comes from a `WIPE_DEADLINE` constant (shown, not enforced — the wipe stays manual). The same line is appended to the copyable share text in the share modal, so it travels into nieuwsbrieven automatically. Rationale: data retention must be communicated where parents actually look, and it doubles as the GDPR storage-limitation story.
- Videos: `<video>` in the lightbox with a short-lived download URL as src; if the browser can't play the codec, show a download button.

---

## 8. Caching — "have your cake and eat it"

Dynamic, activity-based, version-busted:

- The cache key for an album listing includes `album.version`.
- If `now - lastUploadAt < 2 min` (album is **hot**): `Cache-Control: max-age=10` — parents see photos appear during an active upload.
- Else (album **settled**): `Cache-Control: max-age=86400` — 24 h edge cache, near-zero Graph reads.
- Any new upload **or deletion** bumps `version` → new cache key → instant invalidation, then re-settles to 24 h.
- **GDPR exception — image binaries cap at `max-age=3600` (1 h).** The 24 h scheme applies to the *listing* only. Rationale: a photo deleted for consent reasons must stop being served fast; the version-busted listing removes it from the gallery within seconds, and the 1 h cap bounds residual exposure via direct cached URLs. Thumbnails follow the same 1 h cap (a recognizable child in a thumb is the same problem).

Thumbnails: Graph `/thumbnails` URLs (free, works for video too) with `loading="lazy"` in the grid; lightbox loads the original.

---

## 9. Admin panel (`/beheer`)

**Album creation is a step-by-step wizard** (bottom sheet on mobile): step 1 title, step 2 class tags (picker grouped Kleuterklassen / Lagere school / Schoolbreed, creator's class pre-checked), step 3 confirm — and the success screen immediately shows the share link + QR + copy button, so the natural teacher flow is create → copy → paste in de nieuwsbrief with zero hunting.

Tabs:
1. **Albums** — per class (17 + school): list, create, delete, copy share link, revoke link (tokenVersion bump).
2. **Leerkrachten** — per class incl. school album: add/remove emails → `teachers.json`.
3. **Beheerders** — add/remove admin emails → `admins.json`; bootstrap email shown but not removable.
4. **Opslag** — per-class album/photo counts + total size.
5. **Export** — one *"Exporteer alles"* button for the yearly OneDrive archive before the wipe: sequential **per-class streaming zips** (`basl-export-<jaar>-<klas>.zip`, via client-zip, flat memory), each containing `albumnaam/[schooljaar]-[album-slug]-[photoId].webp`, skipping empty classes, with per-class progress and per-class retry. One giant 9.8 GB zip is deliberately avoided: a single connection hiccup would restart everything, per-class chunks are resumable. UI notes "best op een computer met stabiele verbinding".
6. **Opkuis** — the year-end wipe (§10).

---

## 10. Year-end wipe (manual)

Button in admin panel → modal requires typing **`WISSEN`** → `POST /api/admin/wipe`:
1. App-only Graph: delete every album folder under `/albums/` (recursive).
2. Reset all 18 manifests to `{"albums":[]}`.
3. **Keep** `admins.json` and `teachers.json` (carry over to next year).
4. Return a summary (folders deleted, bytes freed). Idempotent — safe to re-run.

No cron, no scheduled anything.

---

## 11. Env vars (Cloudflare Pages, encrypted)

```
GRAPH_TENANT_ID
GRAPH_CLIENT_ID
GRAPH_CLIENT_SECRET
SHAREPOINT_SITE_ID          # resolve once from the site URL IT provides
BOOTSTRAP_ADMIN_EMAIL       # ruben@broeders.be
AUTH_MODE                   # sso | password (default password on R2)
STORAGE_HARD_CAP_GB         # 9.8 — uploads refused above this (billing failsafe, R2 only)
SESSION_SECRET              # session cookie signing
SHARE_SECRET                # HMAC for share tokens
```
Never commit secrets; provide `.dev.vars.example`.

---

## 12. Repo layout

```
├─ wrangler.toml / pages config
├─ .dev.vars.example
├─ src/
│  ├─ config/classes.ts          # 17 classes + school (CONFIRM LABELS)
│  ├─ App.tsx                    # router + role guards
│  ├─ lib/api.ts                 # typed fetch client
│  ├─ pages/{Landing,AuthCallback,AdminPanel,ContributorView,AlbumView}.tsx
│  └─ components/{UploadZone,GalleryGrid,Lightbox}.tsx
└─ functions/api/
   ├─ _middleware.ts             # session parsing, role resolution
   ├─ auth/callback.ts
   ├─ graph.ts                   # app token cache, folders, sessions, share links, thumbnails, delete, 429 backoff
   ├─ manifests.ts               # sharded read/write with ETag retry
   ├─ tokens.ts                  # HMAC sign/verify (albumId + tokenVersion)
   └─ …route files matching §4
```

Strict TS, error boundaries, clean loading states, **Dutch UI copy throughout**. Code will be publicly reviewed by school IT — comment the security-relevant parts (token verification, scope of Graph access, why app-only vs delegated).

---

## 13. Build order

1. Pages project + Functions skeleton deploying; env plumbing.
2. `graph.ts`: app-only token + smoke test (list site root).
3. Staff auth per `AUTH_MODE` (`auth/login` password flow incl. lockout, or `auth/callback` SSO) + `/api/me` — prove identity→role resolution.
4. Manifests module with ETag retry; album create/list/delete end-to-end.
5. Upload sessions + `UploadZone` (riskiest piece — do it early).
6. `AlbumView`: token verify, cached listing, gallery, lightbox, downloads.
7. Admin panel (teachers, admins, storage, wipe).
8. Custom domain, branding polish, Dutch copy pass.

## 14. Migration path — holiday-week switch + summer merge

**Why this section exists:** v1 ships on R2 without school IT. If IT later approves the SharePoint setup, the switch happens in a **school holiday week with an announced 3-day downtime window** — not on a live system. This plan is deliberately shaped so the switch is *only* a storage swap; read it before making any design decision that would couple features to a backend.

**Phase 1 — the holiday switch (R2 → SharePoint, feature-frozen).**
The switch keeps compression on and video off, even though SharePoint could support originals and video. Rationale: it removes every variable except storage location. File sizes stay ~1 MB, so uploads keep using the **simple Graph upload** (`PUT …/content`, valid for small files) — no chunked upload sessions needed yet. The parent experience, share links, and upload UX are bit-for-bit identical before and after.

Sequence:
1. Day 1: set `STORAGE_BACKEND=sharepoint` env + Graph credentials, seed `/config` + empty checks, smoke-test `sharepoint.ts` against the real site.
2. Day 2: run the migration script — copy every object per album from R2 to the SharePoint folder, then flip that album's `backend` field to `"sharepoint"` and bump its `version` (cache bust). The per-album flip makes the script **idempotent and resumable**: if it dies halfway, re-running skips completed albums. Share tokens survive unchanged (HMAC over albumId — storage-agnostic by design).
3. Day 3: verification + buffer. Spot-check albums on mobile, test single + album downloads, confirm the old R2 bucket is empty, then decommission it.

**Phase 2 — the summer merge (features, against an empty store).**
Originals and video are developed on a dev branch during the year and merged **only after the yearly wipe**, so they never coexist with compressed/photo-only albums. This is where chunked Graph upload sessions (10 MB `Content-Range` chunks) actually get built, `supportsVideo` flips on, and the lightbox video branch activates. Decide at that point whether compression remains a teacher-facing option or originals become the only mode. September starts as the full version with zero migration debt.

**Design rule that follows from this plan:** any feature that would behave differently per backend must be gated on a capability flag derived from config (`supportsVideo`, `keepsOriginals`), never on `if (backend === …)` checks scattered through UI code — the switch week must be an env-var change, not a code hunt.

## 15. Confirm with Ruben before shipping

- [ ] Real 17 class labels for `config/classes.ts`
- [ ] SharePoint site URL once IT provisions it
- [ ] Cloudflare Pages project name (for the DNS CNAME)
