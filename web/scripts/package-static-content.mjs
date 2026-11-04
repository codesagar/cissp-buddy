import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validateCourseRelease,
  validateCourseConnections,
} from '../lib/course/validate.ts';
import { releasePack } from '../lib/content/release-pack.ts';
import { validateRelease } from '../lib/content/validate.ts';
const webRoot = fileURLToPath(new URL('../', import.meta.url));
export async function packageStaticContent(outDir) {
  const source = path.join(webRoot, 'lib/data/course');
  const read = (name) =>
    JSON.parse(fs.readFileSync(path.join(source, name), 'utf8'));
  const manifest = read('manifest.json');
  const index = read('connections-index.json');
  const units = manifest.units.map(({ id }) => read(`units/${id}.json`));
  const connections = index.cases.map(({ id }) =>
    read(`connections/${id}.json`),
  );
  validateCourseRelease(manifest, units, true);
  validateCourseConnections(index, connections, units, true);
  validateRelease(releasePack);
  const target = path.resolve(webRoot, outDir, 'content/course');
  const release = path.join(target, manifest.releaseId);
  fs.mkdirSync(path.join(release, 'units'), { recursive: true });
  fs.mkdirSync(path.join(release, 'connections'), { recursive: true });
  fs.copyFileSync(
    path.join(source, 'manifest.json'),
    path.join(target, 'manifest.json'),
  );
  fs.copyFileSync(
    path.join(source, 'connections-index.json'),
    path.join(release, 'connections-index.json'),
  );
  for (const unit of units)
    fs.copyFileSync(
      path.join(source, 'units', `${unit.id}.json`),
      path.join(release, 'units', `${unit.id}.json`),
    );
  for (const connection of connections)
    fs.copyFileSync(
      path.join(source, 'connections', `${connection.id}.json`),
      path.join(release, 'connections', `${connection.id}.json`),
    );
  const pilot = path.resolve(webRoot, outDir, 'content/pilot');
  fs.mkdirSync(pilot, { recursive: true });
  fs.writeFileSync(
    path.join(pilot, `${releasePack.releaseId}.json`),
    JSON.stringify(releasePack),
  );
  fs.writeFileSync(path.resolve(webRoot, outDir, '.nojekyll'), '');
  console.log(
    `Packaged ${units.length} units, ${connections.length} connections and separate pilot (${manifest.releaseId}).`,
  );
}
