import { describe, expect, it } from 'vitest';
import { creer_demo } from './demo';
import { FILTRES_INITIAUX } from './model';
import { creer_passages, filtrer, fusionner, indexer_lexical, plages_surlignage, rechercher } from './search';

describe('recherche de passages', () => {
  const conversations = creer_demo(), passages = creer_passages(conversations), index = indexer_lexical(passages);
  it('retrouve une requête sans accents et garde les positions du texte original', () => {
    expect(index('semantique').length).toBeGreaterThan(0);
    expect(plages_surlignage('Une idée sémantique', 'idee semantique')).toEqual([[4, 8], [9, 19]]);
  });
  it('conserve tous les caractères et les références des passages longs', () => {
    const long = 'mémoire '.repeat(300);
    const corpus = [{ ...conversations[0], messages: [{ id: 'long', role: 'assistant' as const, contenu: long }] }];
    const morceaux = creer_passages(corpus);
    expect(morceaux.at(-1)?.fin).toBe(long.length);
    expect(morceaux.every(p => p.texte === long.slice(p.debut, p.fin))).toBe(true);
    expect(morceaux.every((p, i) => !i || p.debut <= morceaux[i - 1].fin)).toBe(true);
  });
  it('groupe les passages d’une conversation et applique les filtres simultanément', () => {
    const resultats = rechercher(conversations, { ...FILTRES_INITIAUX, plateformes: ['claude'], dossier: 'Projet Clair' }, 'recherche', 'lexicale', index('recherche'), []);
    expect(resultats).toHaveLength(1);
    expect(resultats[0].conversation.id).toBe('demo-0');
    expect(resultats[0].correspondances.length).toBeGreaterThan(1);
  });
  it('inclut toute la journée de fin en heure locale', () => {
    const jour = { ...conversations[0], modifie_le: new Date(2026, 9, 28, 23, 59, 59).toISOString() };
    expect(filtrer(jour, { ...FILTRES_INITIAUX, debut: '2026-10-28', fin: '2026-10-28' })).toBe(true);
    expect(filtrer(jour, { ...FILTRES_INITIAUX, fin: '2026-10-27' })).toBe(false);
  });
  it('fusionne les rangs sans confondre les échelles et distingue les sources', () => {
    const a = { passage: passages[0], score: 4000, type: 'lexicale' as const };
    const b = { passage: passages[1], score: 10, type: 'lexicale' as const };
    const fusion = fusionner([a, b], [{ ...b, score: .8, type: 'semantique' }]);
    expect(fusion[0].passage.id).toBe(b.passage.id);
    expect(fusion[0].type).toBe('les_deux');
    expect(fusion[0].score).toBeCloseTo(1 / 62 + 1 / 61);
    expect(fusion[1].type).toBe('lexicale');
  });
  it('ne renvoie pas de faux résultat pour un terme absent', () => { expect(index('xylophonissime')).toEqual([]); });
  it('ne surligne pas un possessif dans un mot sans rapport', () => {
    const texte = 'mes messages et mes discussions';
    const plages = plages_surlignage(texte, 'ranger mes discussions');
    expect(plages.map(([a, b]) => texte.slice(a, b))).toEqual(['discussions']);
  });
});
