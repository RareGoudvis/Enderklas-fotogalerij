# CLAUDE.md — BASL-Fotogalerij

## Read first, in this order
1. `docs/brief.md` — the complete architecture & product spec. Authoritative.
2. `docs/R2-setup.md` — the R2-backend specifics (compression, auth, sprints). Overrides brief §6 on the R2 backend.

## Ground rules
- Build the **R2 backend only** (`STORAGE_BACKEND=r2`). SharePoint exists as a stubbed adapter + future path (brief §14); do not implement Graph code.
- Follow the **sprint order** in `docs/R2-setup.md` §6. Each sprint ends in a working, committable state.
- **Mobile-first, every screen** — ~380 px viewport is the primary target, desktop is the enhancement. Test flows as a phone user.
- Strict TypeScript. Dutch UI copy. AGPL-3.0. Code will be publicly reviewed by school IT — comment security-relevant parts.
- Explain what you're doing and why as you work. Ruben reads the code.
- `src/config/classes.ts` already contains the real class list — do not invent classes.
- Deliberate design choices you must NOT "fix": truncated 96-bit HMAC tokens, PBKDF2 instead of bcrypt, the dead `backend` manifest field, the 9.8 GB cap, 1 h binary cache cap, debounced manifest registration.

## Key invariants
- Multi-class albums: one **home manifest**, `classes[]` tag array; listings aggregate all manifests and filter by intersection. Any tagged teacher can upload AND delete (GDPR consent-fix path).
- Parents never authenticate. Staff = username (4-letter) + admin-set password.
- No database, no tracking, no third-party services (QR generated client-side).
