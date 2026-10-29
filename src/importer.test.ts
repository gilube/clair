import { describe, expect, it } from 'vitest';
import { creer_demo } from './demo';
import { FILTRES_INITIAUX } from './model';
import { fusionner_import, importer_collections, importer_conversations, lire_chatgpt } from './importer';

describe('imports et restaurations', () => {
  it('restaure un export Clair, ses messages et ses collections', () => {
    const conversations = creer_demo();
    const collections = [{ id: 'c1', nom: 'Projet', requete: 'recherche', mode: 'hybride', filtres: { ...FILTRES_INITIAUX, plateformes: ['claude'] } }];
    const donnees = JSON.parse(JSON.stringify({ format: 'clair', version: 1, conversations, collections }));
    expect(importer_conversations(donnees)).toEqual(conversations);
    expect(importer_collections(donnees)).toEqual(collections);
  });
  it('importe le format Threadback sans casser les clés composées', () => {
    const resultats = importer_conversations({ version: 3, items: [{ conversation: { id: 'chatgpt:abc', platform: 'chatgpt', title: 'Exemple', createdAt: 1700000000000, updatedAt: 1700000000000 }, messages: [{ id: 'chatgpt:abc:0', role: 'user', content: 'Bonjour' }] }] });
    expect(resultats[0].id).toBe('chatgpt:abc'); expect(resultats[0].messages[0].contenu).toBe('Bonjour');
  });
  it('suit la branche active ChatGPT et ignore les messages masqués', () => {
    const message = (id: string, contenu: string, cache = false) => ({ id, author: { role: 'assistant' }, content: { parts: [contenu] }, metadata: { is_visually_hidden_from_conversation: cache } });
    const c = lire_chatgpt({ id: 'abc', current_node: 'active', mapping: { racine: { parent: null, children: ['masque'], message: message('r', 'Début') }, masque: { parent: 'racine', children: ['active', 'autre'], message: message('m', 'Interne', true) }, active: { parent: 'masque', children: [], message: message('a', 'Branche choisie') }, autre: { parent: 'masque', children: [], message: message('b', 'Branche alternative') } } });
    expect(c.messages.map(m => m.contenu)).toEqual(['Début', 'Branche choisie']);
  });
  it('conserve les métadonnées utilisateur pendant une mise à jour', () => {
    const ancienne = { ...creer_demo()[0], favori: true, tags: ['À relire'], dossier: 'Personnel' };
    const nouvelle = { ...ancienne, favori: false, tags: ['Importé'], dossier: '', titre: 'Mis à jour' };
    const [c] = fusionner_import([ancienne], [nouvelle]);
    expect(c.favori).toBe(true); expect(c.tags).toEqual(['À relire', 'Importé']); expect(c.dossier).toBe('Personnel'); expect(c.titre).toBe('Mis à jour');
  });
  it('importe Claude et refuse les fichiers non exploitables', () => {
    const [c] = importer_conversations([{ uuid: 'abc', name: 'Mon fil', chat_messages: [{ uuid: 'm1', sender: 'human', text: 'Ma question' }] }]);
    expect(c.plateforme).toBe('claude'); expect(c.messages[0].role).toBe('user');
    expect(() => importer_conversations({ format: 'clair', version: 25, conversations: [] })).toThrow('version');
    expect(() => importer_conversations({ bonjour: 'monde' })).toThrow('Aucune conversation');
  });
});
