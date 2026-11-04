/** Local QA loader: renders production React components, including hooks, in Node. */
import { registerHooks } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
import ts from 'typescript';
const root = fileURLToPath(new URL('../', import.meta.url));
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('@/') || specifier.startsWith('.')) {
      const base = specifier.startsWith('@/')
        ? resolve(root, specifier.slice(2))
        : resolve(dirname(fileURLToPath(context.parentURL)), specifier);
      for (const candidate of [
        base,
        base + '.tsx',
        base + '.ts',
        base + '.mjs',
      ])
        if (existsSync(candidate) && /\.(tsx|ts|mjs)$/.test(candidate))
          return { url: pathToFileURL(candidate).href, shortCircuit: true };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    // Match Vite's named JSON exports while rendering real components in Node.
    if (url.endsWith('.json')) {
      const data = JSON.parse(readFileSync(fileURLToPath(url), 'utf8'));
      const names = Object.keys(data).filter((key) => {
        const scanner = ts.createScanner(
          ts.ScriptTarget.Latest,
          false,
          ts.LanguageVariant.Standard,
          key,
        );
        return (
          scanner.scan() === ts.SyntaxKind.Identifier &&
          scanner.scan() === ts.SyntaxKind.EndOfFileToken
        );
      });
      return {
        format: 'module',
        source: `const data = ${JSON.stringify(data)}; export default data;\n${names.map((key) => `export const ${key} = data[${JSON.stringify(key)}];`).join('\n')}`,
        shortCircuit: true,
      };
    }
    if (/\.(tsx|ts)$/.test(url))
      return {
        format: 'module',
        source: ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), {
          compilerOptions: {
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.ESNext,
            jsx: ts.JsxEmit.ReactJSX,
            verbatimModuleSyntax: true,
          },
        }).outputText,
        shortCircuit: true,
      };
    return next(url, context);
  },
});
