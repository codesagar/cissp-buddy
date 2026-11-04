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
