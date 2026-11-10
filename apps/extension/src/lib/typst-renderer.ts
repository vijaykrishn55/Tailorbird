import { createTypstCompiler } from '@myriaddreamin/typst.ts';
import wasmUrl from '@myriaddreamin/typst-ts-web-compiler/wasm?url';
import interRegular from '@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf?url';
import interItalic from '@expo-google-fonts/inter/400Regular_Italic/Inter_400Regular_Italic.ttf?url';
import interBold from '@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf?url';
import { err, ok, type Result } from '@ra/schemas';
import type { CompileOutput, Renderer } from '@ra/latex';
import { firstError } from '@ra/latex';

/**
 * Register bundled fonts directly. The library's own `loadFonts` builds a function with `new Function`,
 * which extension pages forbid (no 'unsafe-eval'), so we add the raw font bytes ourselves.
 */
function bundledFonts(fonts: Uint8Array[]) {
  const fn = async (_: unknown, ctx: { builder: { add_raw_font(b: Uint8Array): Promise<void> | void } }) => {
    for (const f of fonts) await ctx.builder.add_raw_font(f);
  };
  return Object.assign(fn, { _kind: 'fontLoader', _preloadRemoteFontOptions: { assets: false } }) as never;
}

const fetchBytes = async (url: string) => new Uint8Array(await (await fetch(url)).arrayBuffer());

/** Typst compiled to WebAssembly. The engine and the Inter font are bundled in the extension: no network, no CDN. */
export function createTypstRenderer(): Renderer {
  const compiler = createTypstCompiler();
  let ready: Promise<void> | undefined;
  const init = () =>
    (ready ??= (async () => {
      const [r, i, b] = await Promise.all([
        fetchBytes(interRegular),
        fetchBytes(interItalic),
        fetchBytes(interBold),
      ]);
      await compiler.init({
        getModule: () => new URL(wasmUrl, self.location.href).href,
        beforeBuild: [bundledFonts([r, i, b])],
      });
    })());
  return {
    kind: 'typst',
    async compile(source: string): Promise<Result<CompileOutput>> {
      try {
        await init();
        compiler.addSource('/main.typ', source);
        const res = (await compiler.compile({
          mainFilePath: '/main.typ',
          format: 1,
          diagnostics: 'full',
        })) as unknown as { result?: Uint8Array; hasError?: boolean; diagnostics?: unknown };
        if (res.hasError || !res.result) {
          const d = res.diagnostics as { message?: string; range?: string }[] | undefined;
          const first = d?.[0];
          const line = first?.range ? Number(first.range.split(':')[0]) + 1 : undefined;
          return err(
            'compile',
            first?.message
              ? `${first.message}${line ? ` (line ${line})` : ''}`
              : firstError(String(res.diagnostics ?? '')).message,
          );
        }
        const pdf = new Uint8Array(res.result);
        const pages =
          (new TextDecoder('latin1').decode(pdf).match(/\/Type\s*\/Page(?!s)/g) ?? []).length || 1;
        return ok({ pdf, pages });
      } catch (e) {
        ready = undefined;
        return err(
          'compile',
          'The PDF engine failed to start.',
          e instanceof Error ? (e.stack ?? e.message).slice(0, 700) : String(e),
        );
      }
    },
  };
}
