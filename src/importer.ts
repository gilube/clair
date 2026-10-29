import type { Collection, Conversation, Message, Plateforme } from './model';

type Objet = Record<string, unknown>;
const objet = (value: unknown): Objet => value && typeof value === 'object' && !Array.isArray(value) ? value as Objet : {};
const liste = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const texte = (value: unknown, secours = '') => typeof value === 'string' ? value : secours;
const plateformes = new Set(['chatgpt', 'claude', 'gemini', 'deepseek', 'mistral', 'autre']);
function date(value: unknown, secours: string): string {
  const valeur = typeof value === 'number' ? new Date(value < 1e12 ? value * 1000 : value) : new Date(texte(value));
  return Number.isFinite(valeur.getTime()) ? valeur.toISOString() : secours;
}
function normaliser_messages(messages: unknown[], prefixe: string): Message[] {
  return messages.map((entree, index) => {
    const m = objet(entree);
    const role = m.role ?? (m.sender === 'human' ? 'user' : m.sender === 'assistant' ? 'assistant' : 'user');
    const contenu = typeof m.contenu === 'string' ? m.contenu : typeof m.content === 'string' ? m.content : typeof m.text === 'string' ? m.text : liste(m.content).map(v => texte(objet(v).text)).filter(Boolean).join('\n');
    return { id: texte(m.id ?? m.uuid, `${prefixe}-${index}`), role: role === 'assistant' || role === 'system' ? role : 'user', contenu } as Message;
  }).filter(m => m.contenu.trim());
}
export function lire_chatgpt(entree: unknown): Conversation {
  const c = objet(entree), mapping = objet(c.mapping);
  const nodes = Object.entries(mapping);
  const feuilles = nodes.filter(([, n]) => !liste(objet(n).children).length).sort((a, b) => Number(objet(objet(b[1]).message).create_time ?? 0) - Number(objet(objet(a[1]).message).create_time ?? 0));
  let courant = texte(c.current_node, feuilles[0]?.[0] ?? '');
  const vus = new Set<string>(), chaine: unknown[] = [];
  while (courant && !vus.has(courant) && mapping[courant]) {
    vus.add(courant); const n = objet(mapping[courant]); chaine.push(n.message); courant = texte(n.parent);
  }
  const messages: Message[] = chaine.reverse().flatMap((value, index) => {
    const m = objet(value), role = objet(m.author).role, meta = objet(m.metadata), content = objet(m.content);
    if (!['user', 'assistant', 'system'].includes(String(role)) || meta.is_visually_hidden_from_conversation === true || meta.is_thinking_preamble_message === true || ['thoughts', 'reasoning_recap'].includes(String(content.content_type)) || (m.recipient && m.recipient !== 'all')) return [];
    const contenu = liste(content.parts).filter(p => typeof p === 'string').join('\n') || texte(content.text);
    return contenu.trim() ? [{ id: texte(m.id, `message-${index}`), role: role as Message['role'], contenu }] : [];
  });
  const maintenant = new Date().toISOString(), id = texte(c.id ?? c.conversation_id, crypto.randomUUID());
  return { id: `chatgpt:${id}`, titre: texte(c.title, 'Conversation ChatGPT'), plateforme: 'chatgpt', cree_le: date(c.create_time, maintenant), modifie_le: date(c.update_time, maintenant), messages, tags: [], dossier: '', favori: false, url: `https://chatgpt.com/c/${encodeURIComponent(id)}` };
}
export function importer_conversations(donnees: unknown): Conversation[] {
  const racine = objet(donnees);
  if (racine.format === 'clair' && racine.version !== 1) throw new Error('Cette version de sauvegarde Clair n’est pas encore prise en charge.');
  if (racine.format !== 'clair' && typeof racine.version === 'number' && racine.version > 3 && Array.isArray(racine.items)) throw new Error('Cette version d’export Threadback n’est pas prise en charge.');
  const entrees = Array.isArray(donnees) ? donnees : liste(racine.conversations ?? racine.items);
  if (!entrees.length) throw new Error('Aucune conversation trouvée. Choisissez un export Clair, Threadback, ChatGPT ou Claude au format JSON.');
  const resultat: Conversation[] = [], maintenant = new Date().toISOString();
  for (const valeur of entrees) {
    const item = objet(valeur);
    if (item.mapping) { const c = lire_chatgpt(item); if (c.messages.length) resultat.push(c); continue; }
    const c = Object.keys(objet(item.conversation)).length ? objet(item.conversation) : item;
    const claude = Array.isArray(c.chat_messages);
    const p = texte(c.plateforme ?? c.platform, claude ? 'claude' : 'autre');
    const plateforme = (plateformes.has(p) ? p : 'autre') as Plateforme;
    const id_original = texte(c.id ?? c.uuid, crypto.randomUUID());
    const id = id_original.startsWith(`${plateforme}:`) || id_original.startsWith('demo-') ? id_original : `${plateforme}:${id_original}`;
    const messages = normaliser_messages(liste(item.messages ?? c.messages ?? c.chat_messages), id);
    if (!messages.length) continue;
    resultat.push({ id, titre: texte(c.titre ?? c.title ?? c.name, 'Sans titre'), plateforme,
      cree_le: date(c.cree_le ?? c.createdAt ?? c.created_at, maintenant), modifie_le: date(c.modifie_le ?? c.updatedAt ?? c.updated_at, maintenant),
      messages, tags: liste(c.tags).filter((v): v is string => typeof v === 'string'), dossier: texte(c.dossier ?? c.folderId), favori: c.favori === true,
      url: typeof c.url === 'string' && /^https?:\/\//.test(c.url) ? c.url : undefined });
  }
  if (!resultat.length) throw new Error('Cet export ne contient aucun message textuel exploitable. Les pièces jointes seules ne sont pas importées.');
  return [...new Map(resultat.map(c => [c.id, c])).values()];
}
export function fusionner_import(existantes: Conversation[], nouvelles: Conversation[]) {
  const resultat = new Map(existantes.map(c => [c.id, c]));
  nouvelles.forEach(c => {
    const ancienne = resultat.get(c.id);
    resultat.set(c.id, ancienne ? { ...c, favori: ancienne.favori, tags: [...new Set([...ancienne.tags, ...c.tags])], dossier: ancienne.dossier || c.dossier } : c);
  });
  return [...resultat.values()];
}
export function importer_collections(donnees: unknown): Collection[] {
  const r = objet(donnees);
  if (r.format !== 'clair') return [];
  return liste(r.collections).flatMap(value => {
    const c = objet(value), f = objet(c.filtres);
    if (typeof c.nom !== 'string' || !c.nom.trim()) return [];
    return [{ id: texte(c.id, crypto.randomUUID()), nom: c.nom, requete: texte(c.requete),
      mode: c.mode === 'semantique' || c.mode === 'hybride' ? c.mode : 'lexicale',
      filtres: { plateformes: liste(f.plateformes).filter((p): p is Plateforme => typeof p === 'string' && plateformes.has(p)), debut: /^\d{4}-\d{2}-\d{2}$/.test(texte(f.debut)) ? texte(f.debut) : '', fin: /^\d{4}-\d{2}-\d{2}$/.test(texte(f.fin)) ? texte(f.fin) : '', dossier: texte(f.dossier), tag: texte(f.tag), favoris: f.favoris === true } }];
  });
}
export function telecharger(nom: string, contenu: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([contenu], { type }));
  const lien = document.createElement('a'); lien.href = url; lien.download = nom; lien.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function exporter_markdown(c: Conversation) {
  return `# ${c.titre}\n\nPlateforme : ${c.plateforme}\nDernière activité : ${c.modifie_le}\n\n${c.messages.map(m => `## ${m.role === 'user' ? 'Vous' : m.role === 'assistant' ? 'Assistant' : 'Système'}\n\n${m.contenu}`).join('\n\n---\n\n')}`;
}
