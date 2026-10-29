import { useEffect, useRef, useState } from 'react';
import type { Correspondance, Passage } from './model';

interface Reponse { id: number; type: string; phase?: string; pourcentage?: number; message?: string; scores?: { id: string; score: number }[] }
export function useSemantic(passages: Passage[]) {
  const worker = useRef<Worker | null>(null), sequence = useRef(0), generation = useRef(0);
  const attente = useRef(new Map<number, { resolve: (value: Reponse) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>());
  const [etat, setEtat] = useState<'inactif' | 'chargement' | 'pret' | 'erreur'>('inactif');
  const [progression, setProgression] = useState({ phase: '', pourcentage: 0 });
  const [erreur, setErreur] = useState('');
  const creer = () => {
    if (worker.current) return worker.current;
    const w = new Worker(new URL('./semantic.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (event: MessageEvent<Reponse>) => {
      const r = event.data;
      if (r.type === 'progression') { setProgression({ phase: r.phase ?? '', pourcentage: r.pourcentage ?? 0 }); return; }
      const promesse = attente.current.get(r.id);
      if (!promesse) return;
      clearTimeout(promesse.timer); attente.current.delete(r.id);
      if (r.type === 'erreur') promesse.reject(new Error(r.message)); else promesse.resolve(r);
    };
    w.onerror = () => {
      attente.current.forEach(p => { clearTimeout(p.timer); p.reject(new Error('Le moteur sémantique n’a pas pu démarrer. Rechargez la page pour réessayer.')); });
      attente.current.clear(); w.terminate(); worker.current = null; setEtat('erreur'); setErreur('Le moteur sémantique n’a pas pu démarrer. Rechargez la page pour réessayer.');
    };
    worker.current = w; return w;
  };
  const envoyer = (type: 'preparer' | 'chercher', donnees: object) => new Promise<Reponse>((resolve, reject) => {
    const id = ++sequence.current;
    const timer = setTimeout(() => { attente.current.delete(id); reject(new Error('Le moteur a mis trop de temps à répondre. Réessayez ou réduisez la bibliothèque.')); }, 900000);
    attente.current.set(id, { resolve, reject, timer });
    try { creer().postMessage({ id, type, ...donnees }); } catch (error) { clearTimeout(timer); attente.current.delete(id); reject(error); }
  });
  const activer = async () => {
    setEtat('chargement'); setErreur('');
    const courante = generation.current;
    try { await envoyer('preparer', { passages }); if (courante === generation.current) { setEtat('pret'); return true; } }
    catch (error) { if (courante === generation.current) { setEtat('erreur'); setErreur(error instanceof Error ? error.message : String(error)); } }
    return false;
  };
  // Every corpus change invalidates readiness; previous vectors must never rank a new library.
  useEffect(() => { generation.current++; setEtat('inactif'); }, [passages]);
  useEffect(() => () => { worker.current?.terminate(); attente.current.forEach(p => { clearTimeout(p.timer); p.reject(new Error('Moteur fermé.')); }); attente.current.clear(); }, []);
  const chercher = async (requete: string): Promise<Correspondance[]> => {
    const resultat = await envoyer('chercher', { requete });
    const par_id = new Map(passages.map(p => [p.id, p]));
    return (resultat.scores ?? []).flatMap(item => { const passage = par_id.get(item.id); return passage ? [{ passage, score: item.score, type: 'semantique' as const }] : []; });
  };
  return { etat, progression, erreur, activer, chercher };
}
