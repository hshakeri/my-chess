import { describe, it, expect, vi, afterEach } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const constructed: Array<Record<string, unknown>> = [];
vi.mock('maia3-js/web', () => ({
  Maia3: class {
    constructor(opts: Record<string, unknown>) {
      constructed.push(opts);
    }
    async load(): Promise<void> {}
  },
}));

const root = process.cwd();

describe('Engine assets: one copy of the ONNX runtime, loaded from the site itself', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('ships no public/wasm folder (24 of its 26 files were never requested, and the other two duplicated the build)', () => {
    expect(existsSync(path.join(root, 'public', 'wasm'))).toBe(false);
  });

  it('the runtime build Vite bundles names exactly one wasm file, and the package provides it', () => {
    const pkgDir = path.join(root, 'node_modules', 'onnxruntime-web');
    const pkg = JSON.parse(readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
    // The browser entry for a plain `import 'onnxruntime-web'`, which maia3-js uses
    const entry: string = pkg.exports['.'].import.default;
    expect(entry).toBe('./dist/ort.bundle.min.mjs');
    const bundle = readFileSync(path.join(pkgDir, entry), 'utf8');
    const wasmFiles = new Set([...bundle.matchAll(/new URL\("([^"]+\.wasm)",import\.meta\.url\)/g)].map((m) => m[1]));
    expect([...wasmFiles]).toEqual(['ort-wasm-simd-threaded.jsep.wasm']);
    expect(existsSync(path.join(pkgDir, 'dist', 'ort-wasm-simd-threaded.jsep.wasm'))).toBe(true);
  });

  it('loads the model from the base path and leaves the wasm location to the runtime', async () => {
    vi.stubEnv('BASE_URL', '/some-other-base/');
    const { MaiaEngine, defaultModelUrl } = await import('@/engine/human/maiaEngine');
    expect(defaultModelUrl()).toBe('/some-other-base/models/maia3_5m.onnx');

    await expect(new MaiaEngine().init()).resolves.toBe(true);
    const opts = constructed[constructed.length - 1];
    expect(opts.url).toBe('/some-other-base/models/maia3_5m.onnx');
    expect(opts.wasmPaths).toBeUndefined();
  });
});
