import { openDB } from 'idb';
import type { Bibliotheque } from './model';

const db = openDB('clair-bibliotheque', 1, {
  upgrade(base) { base.createObjectStore('bibliotheque'); base.createObjectStore('embeddings'); },
});
export async function charger_bibliotheque(): Promise<Bibliotheque | undefined> { return (await db).get('bibliotheque', 'principale'); }
export async function sauvegarder_bibliotheque(value: Bibliotheque) { await (await db).put('bibliotheque', value, 'principale'); }
export async function lire_vecteur(cle: string): Promise<number[] | undefined> { return (await db).get('embeddings', cle); }
export async function ecrire_vecteur(cle: string, vecteur: number[]) { await (await db).put('embeddings', vecteur, cle); }
export async function vider_vecteurs() { await (await db).clear('embeddings'); }
