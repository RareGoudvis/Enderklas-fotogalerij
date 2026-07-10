// Bootstrap-admin seeder (eenmalig, go-live).
//
// Waarom dit bestaat: inloggen vereist een config/teachers.json-entry met een
// PBKDF2-hash, maar wachtwoorden zet je ín het beheerpaneel — dat je enkel na
// login bereikt. Chicken-and-egg. Dit scriptje genereert de hash voor de
// hoofdbeheerder en schrijft bootstrap-teachers.json, dat je daarna met
// `wrangler r2 object put` naar de productiebucket zet.
//
// Hergebruikt bewust dezelfde hashPassword() als de server (geen duplicatie).
//
// Gebruik:
//   npx tsx scripts/seed-admin.mts --user vhru --email ruben@broeders.be
//     (vraagt het wachtwoord interactief; wordt niet gelogd/opgeslagen)
//   npx tsx scripts/seed-admin.mts --user vhru --email ruben@broeders.be --password '<pw>'
//     (wachtwoord als arg — handig in scripts, minder veilig in shell-history)

import { writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { hashPassword } from '../functions/api/lib/crypto.ts';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const user = (arg('user') ?? '').trim().toLowerCase();
const email = (arg('email') ?? '').trim();
let password = arg('password');

if (!/^[a-z]{2,12}$/.test(user)) {
  console.error('Fout: --user moet 2–12 kleine letters zijn (bv. vhru).');
  process.exit(1);
}
if (!email.includes('@')) {
  console.error('Fout: --email moet een geldig e-mailadres zijn.');
  process.exit(1);
}

if (!password) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  password = await rl.question(`Wachtwoord voor ${user} (${email}): `);
  rl.close();
}
if (!password || password.length < 6) {
  console.error('Fout: kies een wachtwoord van minstens 6 tekens.');
  process.exit(1);
}

const hash = await hashPassword(password);
const teachers = { [user]: { email, classes: [] as string[], pass: hash } };
const outfile = 'bootstrap-teachers.json';
writeFileSync(outfile, JSON.stringify(teachers, null, 2) + '\n', 'utf8');

console.log(`\n✓ ${outfile} geschreven (bevat enkel de hash, geen leesbaar wachtwoord).`);
console.log('\nZet het nu in de PRODUCTIE-bucket (geen --remote; dat is de default):');
console.log(
  `  npx wrangler r2 object put "basl-fotogalerij/config/teachers.json" \\\n` +
    `    --jurisdiction eu --file ${outfile} \\\n` +
    `    --content-type application/json\n`,
);
console.log('Daarna kun je inloggen en de rest van de leerkrachten via het paneel zetten.');
console.log('Verwijder bootstrap-teachers.json lokaal als je klaar bent.\n');
