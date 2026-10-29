import { mkdir, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const racine = resolve(import.meta.dirname, '..');
await mkdir(resolve(racine, 'public/onnx'), { recursive: true });
for (const nom of ['ort-wasm-simd-threaded.jsep.mjs', 'ort-wasm-simd-threaded.jsep.wasm', 'ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm', 'ort-wasm-simd-threaded.asyncify.mjs', 'ort-wasm-simd-threaded.asyncify.wasm']) {
  await copyFile(resolve(racine, 'node_modules/onnxruntime-web/dist', nom), resolve(racine, 'public/onnx', nom));
}
