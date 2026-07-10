# BASL-Fotogalerij

Privacyvriendelijk fotodeelplatform voor de school — R2-versie (v1).

- **Bouwinstructies:** `CLAUDE.md` → `docs/brief.md` + `docs/R2-setup.md`
- **Stack:** Vite + React + TS + Tailwind · Cloudflare Pages (Functions) · R2 (EU jurisdiction)
- **Licentie:** AGPL-3.0

Klassenlijst: `src/config/classes.ts` (18 klassen + schoolbreed, per schooljaar bij te werken).

## Ontwikkelen lokaal

```bash
npm install
cp .dev.vars.example .dev.vars   # lokale env-vars (niet committen)

npm run typecheck                # strikte TS-check
npm run build                    # bouwt de frontend naar dist/
npx wrangler pages dev           # frontend + Functions + lokale R2-simulator
```

Rooktest: `GET http://127.0.0.1:8788/api/health` geeft goedkope liveness
(`{"ok":true,"backend":"r2"}`, geen R2-operatie). De volledige R2-round-trip
(`etag` + `conditionalWriteOk`) draai je met `?deep=1` terwijl je als admin
aangemeld bent — bewust afgeschermd zodat anonieme/bot-hits geen storage-operaties kosten.

> **Let op (lokale dev):** `wrangler pages dev` gebruikt de **preview**-bucket
> (`preview_bucket_name` uit `wrangler.toml`). Seed configbestanden dus daarheen, bv.:
> ```bash
> npx wrangler r2 object put "basl-fotogalerij-preview/config/teachers.json" \
>   --local --persist-to .wrangler/state --file teachers.json
> ```

## Productie-opzetten

Volledige stap-voor-stap in `docs/R2-setup.md` §2. Kort:

1. **R2-bucket** `basl-fotogalerij` aanmaken met **jurisdiction EU** (GDPR).
2. **Pages-project** aan de GitHub-repo koppelen — build `npm run build`, output `dist`.
3. **R2-binding** `BUCKET` → de bucket toevoegen (Settings → Functions).
4. **Env-vars** (encrypted) zetten: zie `.dev.vars.example` + `SESSION_SECRET`/`SHARE_SECRET`
   (`openssl rand -hex 32`).
5. **Custom domain** `foto.enderklas.be` koppelen (eigen Cloudflare-zone, self-service CNAME).
6. Eerst je **eigen adminwachtwoord** zetten in het beheerpaneel, daarna de leerkrachten.

## Functionaliteit (v1, alle sprints)

Leerkracht-login (wachtwoord, PBKDF2 + lockout) · multi-class albums met gedeelde manifests ·
korte HMAC-sharelinks + client-side QR · browsercompressie (WebP, HEIC-fallback) + upload met
opslag-cap · ouderweergave met retentiebanner, lightbox, losse + zip-download · beheerpaneel
(albums, leerkrachten, beheerders, opslag, export, jaarlijkse wipe).

