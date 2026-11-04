/** Render fail-closed owner-only rules; production deployment is a separate explicit command. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateFirebaseConfiguration } from '../lib/learner/firebase-config.ts';
const web = fileURLToPath(new URL('../', import.meta.url));
const root = path.dirname(web.replace(/\/$/, ''));
const configPath = path.join(web, 'public/firebase-config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const uid = process.argv.find((argument) => argument.startsWith('--uid='))?.slice(6);
if (uid !== undefined) config.ownerUid = uid;
const validated = validateFirebaseConfiguration(config, 'localhost');
if (!validated || validated.emulators || !validated.ownerUid || validated.ownerUid === 'OWNER_UID_NOT_CONFIGURED')
  throw Error('A real project and your approved Firebase UID are required. No rules were deployed.');
const template = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
const assignment = "let approvedUid = 'OWNER_UID_NOT_CONFIGURED';";
if (template.split(assignment).length !== 2) throw Error('The reviewed rule template no longer has exactly one owner assignment.');
const rendered = template.replace(assignment, `let approvedUid = '${validated.ownerUid}';`);
const output = path.join(web, 'outputs/firebase-setup');
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, 'firestore.owner.rules'), rendered);
fs.writeFileSync(path.join(output, 'firebase.production.json'), JSON.stringify({ firestore: { rules: path.join(output, 'firestore.owner.rules'), indexes: path.join(root, 'firestore.indexes.json') } }, null, 2) + '\n');
if (uid !== undefined) fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
console.log('Rendered owner-only rules in web/outputs/firebase-setup/firestore.owner.rules.');
console.log('No cloud setting, billing plan, or security rule has been changed.');
