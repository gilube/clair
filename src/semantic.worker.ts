/// <reference lib="webworker" />
import { env, pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers';
import { lire_vecteur, ecrire_vecteur } from './storage';
import type { Passage } from './model';

const MODELE = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';
env.allowLocalModels = false;
env.useBrowserCache = true;
env.useWasmCache = false;
env.backends.onnx.wasm!.numThreads = 1;
env.backends.onnx.wasm!.wasmPaths = `${self.location.origin}/onnx/`;
let extracteur: FeatureExtractionPipeline | undefined;
let index: { id: string; vecteur: number[] }[] = [];
let file = Promise.resolve();
async function encoder(texte: string) {
  const empreinte = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${MODELE}:q8:v1:${texte}`));
  const cle = [...new Uint8Array(empreinte)].map(v => v.toString(16).padStart(2, '0')).join('');
  const cache = await lire_vecteur(cle);
  if (cache) return cache;
  const tenseur = await extracteur!(texte, { pooling: 'mean', normalize: true });
  const vecteur = Array.from(tenseur.data, Number);
  await ecrire_vecteur(cle, vecteur);
  return vecteur;
}
self.onmessage = (event: MessageEvent<{ id: number; type: 'preparer' | 'chercher'; passages?: Passage[]; requete?: string }>) => {
  const demande = event.data;
  file = file.then(async () => {
    try {
      if (demande.type === 'preparer') {
        if (!extracteur) {
          self.postMessage({ id: demande.id, type: 'progression', phase: 'Téléchargement du modèle multilingue…' });
          extracteur = await pipeline('feature-extraction', MODELE, {
            device: 'wasm', dtype: 'q8',
            progress_callback: (progression) => {
              if (progression.status === 'progress') self.postMessage({ id: demande.id, type: 'progression', phase: 'Téléchargement du modèle…', pourcentage: Math.round(progression.progress) });
            },
          });
        }
        const passages = demande.passages ?? [], nouveau = [];
        for (let i = 0; i < passages.length; i++) {
          const passage = passages[i];
          nouveau.push({ id: passage.id, vecteur: await encoder(`${passage.titre}\n${passage.texte}`) });
          self.postMessage({ id: demande.id, type: 'progression', phase: `Indexation des passages · ${i + 1}/${passages.length}`, pourcentage: Math.round((i + 1) / passages.length * 100) });
        }
        index = nouveau;
        self.postMessage({ id: demande.id, type: 'pret', total: index.length });
      } else {
        if (!extracteur) throw new Error('Activez d’abord le modèle sémantique.');
        const vecteur = await encoder(demande.requete ?? '');
        const scores = index.map(item => ({ id: item.id, score: item.vecteur.reduce((somme, v, i) => somme + v * (vecteur[i] ?? 0), 0) })).filter(item => item.score >= .2).sort((a, b) => b.score - a.score);
        self.postMessage({ id: demande.id, type: 'resultats', scores });
      }
    } catch (error) {
      self.postMessage({ id: demande.id, type: 'erreur', message: error instanceof Error ? error.message : String(error) });
    }
  });
};
