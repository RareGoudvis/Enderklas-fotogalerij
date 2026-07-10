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

Rooktest: `GET http://127.0.0.1:8788/api/health` moet een JSON teruggeven met
`"backend":"r2"` en een `etag` — dat bewijst de R2-round-trip en het conditionele-write-pad.

> **Let op (lokale dev):** `wrangler pages dev` gebruikt de **preview**-bucket
> (`preview_bucket_name` uit `wrangler.toml`). Seed configbestanden dus daarheen, bv.:
> ```bash
> npx wrangler r2 object put "basl-fotogalerij-preview/config/teachers.json" \
>   --local --persist-to .wrangler/state --file teachers.json
> ```

