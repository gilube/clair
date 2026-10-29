export type Plateforme = 'chatgpt' | 'claude' | 'gemini' | 'deepseek' | 'mistral' | 'autre';
export type ModeRecherche = 'lexicale' | 'semantique' | 'hybride';
export interface Message { id: string; role: 'user' | 'assistant' | 'system'; contenu: string }
export interface Conversation {
  id: string; titre: string; plateforme: Plateforme; cree_le: string; modifie_le: string;
  messages: Message[]; tags: string[]; dossier: string; favori: boolean; url?: string;
}
export interface Filtres { plateformes: Plateforme[]; debut: string; fin: string; dossier: string; tag: string; favoris: boolean }
export interface Collection { id: string; nom: string; requete: string; filtres: Filtres; mode: ModeRecherche }
export interface Bibliotheque { conversations: Conversation[]; origine: 'demo' | 'personnelle'; collections: Collection[] }
export interface Passage { id: string; conversation_id: string; message_id: string; texte: string; titre: string; debut: number; fin: number }
export interface Correspondance { passage: Passage; score: number; type: ModeRecherche | 'les_deux' }
export interface Resultat { conversation: Conversation; correspondances: Correspondance[]; score: number; type: Correspondance['type'] }
export const FILTRES_INITIAUX: Filtres = { plateformes: [], debut: '', fin: '', dossier: '', tag: '', favoris: false };
export const PLATEFORMES: Record<Plateforme, { nom: string; couleur: string; lettre: string }> = {
  chatgpt: { nom: 'ChatGPT', couleur: '#16856a', lettre: 'G' },
  claude: { nom: 'Claude', couleur: '#bc7454', lettre: 'C' },
  gemini: { nom: 'Gemini', couleur: '#5977cf', lettre: '✦' },
  deepseek: { nom: 'DeepSeek', couleur: '#5066cd', lettre: 'D' },
  mistral: { nom: 'Mistral', couleur: '#cf853b', lettre: 'M' },
  autre: { nom: 'Autre', couleur: '#76818e', lettre: 'A' },
};
