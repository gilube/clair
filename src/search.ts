import type { Conversation, Correspondance, Filtres, ModeRecherche, Passage, Resultat } from './model';

export function normaliser(texte: string) { return texte.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase(); }
const MOTS_COURANTS = new Set('le la les un une des du de d et en a au aux mon ma mes ton ta tes son sa ses ce cette ces je tu il elle nous vous ils elles dans pour sur que qui est sont avec sans comment quel quelle quels quelles se ne pas the a an of and in my your to for with how'.split(' '));
export function termes(texte: string): string[] {
  const tous = [...new Set(normaliser(texte).match(/[\p{L}\p{N}]+/gu) ?? [])];
  const significatifs = tous.filter(mot => !MOTS_COURANTS.has(mot));
  return significatifs.length ? significatifs : tous;
}
export function creer_passages(conversations: Conversation[]): Passage[] {
  return conversations.flatMap(conversation => conversation.messages.flatMap(message => {
    const morceaux: Passage[] = [];
    for (let debut = 0; debut < message.contenu.length;) {
      let fin = Math.min(debut + 600, message.contenu.length);
      if (fin < message.contenu.length) {
        const espace = message.contenu.lastIndexOf(' ', fin);
        if (espace > debut + 350) fin = espace;
      }
      morceaux.push({ id: `${conversation.id}/${message.id}/${debut}`, conversation_id: conversation.id, message_id: message.id, texte: message.contenu.slice(debut, fin), titre: conversation.titre, debut, fin });
      if (fin === message.contenu.length) break;
      debut = Math.max(debut + 1, fin - 100);
    }
    return morceaux;
  }));
}
export function filtrer(conversation: Conversation, filtres: Filtres) {
  const date = new Date(conversation.modifie_le);
  const debut = filtres.debut ? new Date(`${filtres.debut}T00:00:00`) : null;
  const fin = filtres.fin ? new Date(`${filtres.fin}T23:59:59.999`) : null;
  return (!filtres.plateformes.length || filtres.plateformes.includes(conversation.plateforme))
    && (!debut || date >= debut) && (!fin || date <= fin)
    && (!filtres.dossier || conversation.dossier === filtres.dossier)
    && (!filtres.tag || conversation.tags.includes(filtres.tag))
    && (!filtres.favoris || conversation.favori);
}
export function indexer_lexical(passages: Passage[]) {
  const documents = passages.map(passage => {
    const tokens = normaliser(passage.texte).match(/[\p{L}\p{N}]+/gu) ?? [];
    const titre = normaliser(passage.titre).match(/[\p{L}\p{N}]+/gu) ?? [];
    const frequences = new Map<string, number>();
    tokens.forEach(mot => frequences.set(mot, (frequences.get(mot) ?? 0) + 1));
    titre.forEach(mot => frequences.set(mot, (frequences.get(mot) ?? 0) + 3));
    return { passage, frequences, longueur: tokens.length + titre.length * 3 };
  });
  const presence = new Map<string, number>();
  documents.forEach(doc => doc.frequences.forEach((_, mot) => presence.set(mot, (presence.get(mot) ?? 0) + 1)));
  const moyenne = documents.reduce((somme, doc) => somme + doc.longueur, 0) / (documents.length || 1) || 1;
  return (requete: string): Correspondance[] => {
    const mots = termes(requete);
    if (!mots.length) return [];
    const candidats = documents.map(doc => {
      let score = 0, nombre = 0;
      for (const mot of mots) {
        const frequence = doc.frequences.get(mot) ?? 0;
        if (!frequence) continue;
        nombre++;
        const idf = Math.log(1 + (documents.length - (presence.get(mot) ?? 0) + .5) / ((presence.get(mot) ?? 0) + .5));
        score += idf * frequence * 2.2 / (frequence + 1.2 * (.25 + .75 * doc.longueur / moyenne));
      }
      return { passage: doc.passage, score, nombre, type: 'lexicale' as const };
    }).filter(doc => doc.score > 0);
    const minimum = mots.length <= 3 ? mots.length : Math.ceil(mots.length * .75);
    const stricts = candidats.filter(doc => doc.nombre >= minimum);
    return (stricts.length ? stricts : candidats).sort((a, b) => b.score - a.score);
  };
}
export function fusionner(lexicaux: Correspondance[], semantiques: Correspondance[]): Correspondance[] {
  const scores = new Map<string, Correspondance>();
  [lexicaux, semantiques].forEach(liste => liste.forEach((item, rang) => {
    const precedent = scores.get(item.passage.id);
    scores.set(item.passage.id, { passage: item.passage, score: (precedent?.score ?? 0) + 1 / (60 + rang + 1), type: precedent ? 'les_deux' : item.type });
  }));
  return [...scores.values()].sort((a, b) => b.score - a.score);
}
export function rechercher(conversations: Conversation[], filtres: Filtres, requete: string, mode: ModeRecherche, lexicaux: Correspondance[], semantiques: Correspondance[]): Resultat[] {
  const admissibles = conversations.filter(c => filtrer(c, filtres));
  if (!requete.trim()) return admissibles.map(conversation => ({ conversation, correspondances: [], score: 0, type: 'lexicale' }));
  const ids = new Set(admissibles.map(c => c.id));
  const l = lexicaux.filter(c => ids.has(c.passage.conversation_id));
  const s = semantiques.filter(c => ids.has(c.passage.conversation_id));
  const correspondances = mode === 'lexicale' ? l : mode === 'semantique' ? s : fusionner(l, s);
  const groupes = new Map<string, Resultat>();
  const par_id = new Map(admissibles.map(c => [c.id, c]));
  for (const item of correspondances) {
    const id = item.passage.conversation_id, groupe = groupes.get(id);
    if (!groupe) groupes.set(id, { conversation: par_id.get(id)!, correspondances: [item], score: item.score, type: item.type });
    else {
      groupe.correspondances.push(item);
      if (groupe.type !== item.type) groupe.type = 'les_deux';
    }
  }
  return [...groupes.values()].sort((a, b) => b.score - a.score);
}
export function plages_surlignage(texte: string, requete: string): [number, number][] {
  const mots = termes(requete); if (!mots.length) return [];
  let simple = '', position = 0;
  const debut: number[] = [], fin: number[] = [];
  for (const lettre of texte) {
    const normalisee = normaliser(lettre);
    for (let i = 0; i < normalisee.length; i++) { debut.push(position); fin.push(position + lettre.length); }
    simple += normalisee; position += lettre.length;
  }
  const plages: [number, number][] = [];
  for (const mot of mots) {
    let index = simple.indexOf(mot);
    while (index !== -1 && plages.length < 200) { plages.push([debut[index], fin[index + mot.length - 1]]); index = simple.indexOf(mot, index + mot.length); }
  }
  plages.sort((a, b) => a[0] - b[0]);
  return plages.reduce<[number, number][]>((fusion, plage) => {
    const derniere = fusion.at(-1);
    if (derniere && plage[0] <= derniere[1]) derniere[1] = Math.max(derniere[1], plage[1]); else fusion.push([...plage]);
    return fusion;
  }, []);
}
