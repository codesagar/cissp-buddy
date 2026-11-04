/** Ordinary file server for release verification. Missing files always return 404. */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};
export function normalizeBase(value = '/') {
  if (!value.startsWith('/') || value.includes('..') || /[?#\\]/.test(value))
    throw new Error(
      'Base must be an absolute URL path such as / or /repository/.',
    );
  return value.endsWith('/') ? value : `${value}/`;
}
export async function startStaticServer(
  directory,
  { base = '/', port = 0 } = {},
) {
  const root = path.resolve(directory);
  base = normalizeBase(base);
  const server = createServer(async (request, response) => {
    try {
      if (!['GET', 'HEAD'].includes(request.method)) {
        response.writeHead(405).end('Method not allowed');
        return;
      }
      const pathname = decodeURIComponent(
        new URL(request.url, 'http://localhost').pathname,
      );
      if (!pathname.startsWith(base) || pathname.includes('\\')) {
        response.writeHead(404).end('Not found');
        return;
      }
      let file = path.resolve(root, pathname.slice(base.length));
      if (file !== root && !file.startsWith(root + path.sep)) {
        response.writeHead(404).end('Not found');
        return;
      }
      let info = await stat(file);
      if (info.isDirectory()) {
        if (!pathname.endsWith('/')) {
          response.writeHead(301, { Location: `${pathname}/` }).end();
          return;
        }
        file = path.join(file, 'index.html');
        info = await stat(file);
      }
      if (!info.isFile()) throw new Error('Not a file');
      const bytes = await readFile(file);
      response.writeHead(200, {
        'Content-Type':
          mimeTypes[path.extname(file)] || 'application/octet-stream',
        'Content-Length': bytes.length,
        'Cache-Control': 'no-store',
      });
      response.end(request.method === 'HEAD' ? undefined : bytes);
    } catch (error) {
      response
        .writeHead(error instanceof URIError ? 400 : 404)
        .end('Not found');
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  return {
    server,
    origin,
    baseUrl: `${origin}${base}`,
    close: () =>
      new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const option = (name, fallback) =>
    process.argv
      .find((argument) => argument.startsWith(`--${name}=`))
      ?.slice(name.length + 3) ?? fallback;
  const instance = await startStaticServer(option('root', 'dist'), {
    base: option('base', '/'),
    port: Number(option('port', '4173')),
  });
  console.log(`Static preview: ${instance.baseUrl}`);
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.once(signal, async () => {
      await instance.close();
      process.exit(0);
    });
}
