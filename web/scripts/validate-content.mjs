import { releasePack } from '../lib/content/release-pack.ts';
import { validateRelease } from '../lib/content/validate.ts';
console.log(JSON.stringify(validateRelease(releasePack),null,2));
