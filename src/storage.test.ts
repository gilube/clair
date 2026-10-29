import 'fake-indexeddb/auto';
import { expect, it } from 'vitest';
import { charger_bibliotheque, ecrire_vecteur, lire_vecteur, sauvegarder_bibliotheque, vider_vecteurs } from './storage';
import { creer_demo } from './demo';

it('persiste les conversations et efface les vecteurs sans effacer la bibliothèque', async () => {
  const bibliotheque = { conversations: creer_demo(), collections: [], origine: 'personnelle' as const };
  await sauvegarder_bibliotheque(bibliotheque); await ecrire_vecteur('test', [.1, .5]);
  expect(await charger_bibliotheque()).toEqual(bibliotheque); expect(await lire_vecteur('test')).toEqual([.1, .5]);
  await vider_vecteurs(); expect(await lire_vecteur('test')).toBeUndefined(); expect((await charger_bibliotheque())?.conversations).toHaveLength(12);
});
