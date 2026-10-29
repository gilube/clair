import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const out = resolve(import.meta.dirname, '../dist-extension');
await mkdir(out, { recursive: true });
const manifeste = {
  manifest_version: 3, name: 'Clair — Votre mémoire IA', version: '0.1.0',
  description: 'Retrouvez vos conversations IA avec une recherche locale et une lecture en pleine page.',
  action: { default_title: 'Ouvrir Clair' },
  background: { service_worker: 'background.js', type: 'module' },
  permissions: ['scripting', 'unlimitedStorage'],
  host_permissions: ['https://chatgpt.com/*', 'https://claude.ai/*', 'https://gemini.google.com/*', 'https://huggingface.co/*', 'https://*.huggingface.co/*', 'https://*.hf.co/*'],
  commands: { 'ouvrir-clair': { suggested_key: { default: 'Ctrl+Shift+K', mac: 'Command+Shift+K' }, description: 'Ouvrir la bibliothèque Clair' } },
  content_security_policy: { extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'" },
};
await writeFile(resolve(out, 'manifest.json'), JSON.stringify(manifeste, null, 2));
const html = await readFile(resolve(out, 'index.html'), 'utf8');
if (!html.includes('app.js')) throw new Error('Entrée de l’extension introuvable.');
console.log(`Extension Chrome prête : ${out}`);
