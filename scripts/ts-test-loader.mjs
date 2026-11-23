import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      (specifier.startsWith('./') || specifier.startsWith('../') || specifier.startsWith('@/')) &&
      !path.extname(specifier)
    ) {
      let baseDir = process.cwd();
      if (context.parentURL && context.parentURL.startsWith('file:')) {
        baseDir = path.dirname(fileURLToPath(context.parentURL));
      }
      const rawTarget = specifier.startsWith('@/')
        ? path.resolve(process.cwd(), 'src', specifier.slice(2))
        : path.resolve(baseDir, specifier);

      if (existsSync(`${rawTarget}.ts`)) {
        return nextResolve(pathToFileURL(`${rawTarget}.ts`).href, context);
      }
      if (existsSync(`${rawTarget}.tsx`)) {
        return nextResolve(pathToFileURL(`${rawTarget}.tsx`).href, context);
      }
    }
    return nextResolve(specifier, context);
  },
});
