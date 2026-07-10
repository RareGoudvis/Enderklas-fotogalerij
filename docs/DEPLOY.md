# DEPLOY.md — BASL-Fotogalerij live zetten (Cloudflare, R2-backend)

Handleiding om de beta live te zetten op je **eigen** Cloudflare-account (gratis plan, geen
school-IT). Aanvulling op `docs/R2-setup.md` §2 (click-by-click) en §7 (rollout) met wat pas bleek
tijdens het bouwen. Doe de stappen in volgorde.

---

## A. Wat je nu al kunt (laten) reviewen — vóór enige infra

Alles wat security-relevant is, staat in code. School-IT kan dit lezen zonder dat er data op staat:

| Zorg | Bestand |
|---|---|
| App-only opslag via adapter, geen S3-sleutels | `functions/api/storage/` |
| Parent-tokens (HMAC, 96-bit truncatie bewust) | `functions/api/tokens.ts` |
| Wachtwoord-hashing (PBKDF2/WebCrypto, geen bcrypt) | `functions/api/lib/crypto.ts` |
| Sessiecookie (HttpOnly/Secure/SameSite=Lax, 90 d) | `functions/api/lib/session.ts` |
| Rolresolutie vers per request | `functions/api/_middleware.ts`, `lib/auth.ts` |
| GDPR-caching (1 u-cap beeld/thumb, consent-delete) | `functions/api/img/…`, `functions/api/album.ts` |
| Billing-failsafe (cap + 507 + 60-min bypass) | `functions/api/albums/[id]/upload.ts` |
| EU-jurisdiction op de binding | `wrangler.toml` |
| EXIF/GPS-stripping (canvas re-encode) | `src/lib/compress.ts` |
| Geen secrets in repo | `.dev.vars.example`, `.gitignore` |

De code draait groen door `npm run typecheck` + `npm run build`.

---

## B. Cloudflare opzetten (eenmalig)

1. **R2-bucket** — jurisdiction EU (harde GDPR-garantie):
   ```bash
   npx wrangler r2 bucket create basl-fotogalerij --jurisdiction eu
   ```
   Bucket **privé** laten (nooit public access) — alles gaat via de Functions met tokencheck.

2. **Pages-project** — Workers & Pages → Create → Pages → connect de GitHub-repo.
   Build command `npm run build`, output dir `dist`. Elke push naar `main` deployt automatisch.

3. **R2-binding** — Pages → Settings → Functions → R2 bucket bindings → naam **`BUCKET`** →
   bucket `basl-fotogalerij`.
   *Let op:* het dashboard-bindingformulier heeft geen jurisdiction-veld; `wrangler.toml` declareert
   `jurisdiction = "eu"` en is leidend. Verifieer na de eerste deploy dat reads/writes werken (C1).

4. **Env-vars** — Settings → Environment variables → **Production**, alle als *Encrypted*:
   ```
   STORAGE_BACKEND       = r2
   AUTH_MODE             = password
   BOOTSTRAP_ADMIN_EMAIL = ruben@broeders.be
   STORAGE_HARD_CAP_GB   = 9.8
   SESSION_SECRET        = <openssl rand -hex 32>
   SHARE_SECRET          = <openssl rand -hex 32>
   ```
   Genereer beide secrets met `openssl rand -hex 32`, bewaar ze in een wachtwoordmanager. Zet ze
   **nooit** in de repo. `SHARE_SECRET` wijzigen = álle bestaande sharelinks dood.

5. **Custom domain** — Pages → Custom domains → `foto.enderklas.be` (eigen zone, self-service CNAME).

6. **Billing-alerts** — Notifications → usage alerts (dubbele gordel naast de 9,8 GB app-cap).

---

## B-bis. Bootstrap-admin seeden (KRITISCH — anders kun je niet inloggen)

Login vereist een `config/teachers.json`-entry met een PBKDF2-hash. Wachtwoorden zet je normaal ín
het beheerpaneel, maar dat bereik je enkel na login. Daarom eenmalig offline seeden:

```bash
# 1) Genereer de hash + bootstrap-teachers.json (vraagt het wachtwoord interactief)
npx tsx scripts/seed-admin.mts --user vhru --email ruben@broeders.be

# 2) Zet het in de PRODUCTIE-bucket. LET OP: geen --remote (dat is de default
#    voor `r2 object put`; enkel --local mikt op de simulator).
npx wrangler r2 object put "basl-fotogalerij/config/teachers.json" \
  --jurisdiction eu --file bootstrap-teachers.json \
  --content-type application/json

# 3) Verwijder bootstrap-teachers.json lokaal
rm bootstrap-teachers.json
```

`vhru` wordt admin omdat het e-mailadres gelijk is aan `BOOTSTRAP_ADMIN_EMAIL`. Na inloggen zet je de
rest van de leerkrachten + wachtwoorden via het paneel. Seeden is daarna nooit meer nodig (ook niet
na *"Alle wachtwoorden wissen"* — jouw hash blijft daar bewust behouden).

---

## C. Go-live checklist (na de eerste deploy, in deze volgorde)

1. **Infra:**
   - `GET https://foto.enderklas.be/api/health` → `{"ok":true,"backend":"r2",…}` (goedkope liveness,
     geen R2 — veilig voor bots/uptime-monitors).
   - Diepe R2-rooktest: log in als admin, ga dan naar `…/api/health?deep=1` → `{…"conditionalWriteOk":true}`.
     Bewijst binding + EU-bucket + conditionele-write-pad. (Een succesvolle login bewijst sowieso al dat
     R2-reads werken; een upload bewijst de writes.)
2. **Bucket privé:** een R2-object rechtstreeks (public/S3-URL) openen moet falen; enkel
   `/api/img/…?tok=` mag serveren.
3. **Auth:** login als bootstrap-admin; `GET /api/me` → `role:"admin"`. Fout wachtwoord 5× → 429.
4. **Kernflow (op een telefoon, ~380 px):** album aanmaken → link/QR → uploaden uit camera-roll
   (incl. 1–2 HEIC) → kwaliteit checken op telefoon **en** laptop → ouderlink openen (retentiebanner
   zichtbaar) → losse download + zip-download.
5. **Consent-pad:** leerkracht verwijdert 1 foto → binnen seconden uit de galerij; directe beeld-URL
   dood binnen 1 uur.
6. **Revoke:** link intrekken → oude link geeft "niet meer geldig".
7. **Cap** (optioneel): met tijdelijk lage `STORAGE_HARD_CAP_GB` een upload → 507 "Opslag vol";
   daarna terug op 9.8.
8. **Headers:** sessiecookie `Secure; HttpOnly; SameSite=Lax`; geen secrets in de client-bundle.
9. **Domein/DNS:** CNAME actief + HTTPS. Interim `*.pages.dev` in de eerste nieuwsbrief als de CNAME
   nog niet gepropageerd is.
10. **Budget:** R2 < 10 GB, Workers < 100k req/dag.

**Best practice beta:** start met één klas + één leerkracht + ~100 foto's, test het consent-pad en de
zip-download écht, en rol daarna pas breder uit.

---

## Jaarlijks onderhoud

- `src/config/classes.ts` — klaslijst bijwerken bij een nieuw schooljaar.
- `src/config/constants.ts` — `SCHOOLJAAR` + `WIPE_DEADLINE_LABEL` bijwerken.
- Beheerpaneel → **Opkuis** → `WISSEN` → jaarlijkse wipe (behoudt beheerders + leerkrachten).
- Beheerpaneel → **Leerkrachten** → *"Alle wachtwoorden wissen"* → nieuwe wachtwoorden uitdelen.
