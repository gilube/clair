import { Fragment } from 'react';
import { ArrowUpRight, Check, ChevronRight, Copy, MessageSquare, Search, Sparkles } from 'lucide-react';
import { useState } from 'react';
import type { Conversation, Plateforme } from './model';
import { PLATEFORMES } from './model';
import { plages_surlignage } from './search';

export function PlateformeIcon({ plateforme, petit = false }: { plateforme: Plateforme; petit?: boolean }) {
  const p = PLATEFORMES[plateforme];
  return <span className={`platform-icon ${petit ? 'small' : ''}`} style={{ color: p.couleur, background: `${p.couleur}12` }} aria-label={p.nom}>{p.lettre}</span>;
}
export function Surlignage({ texte, requete }: { texte: string; requete: string }) {
  const plages = plages_surlignage(texte, requete); let fin = 0;
  return <>{plages.map(([debut, borne]) => { const morceau = <Fragment key={debut}>{texte.slice(fin, debut)}<mark>{texte.slice(debut, borne)}</mark></Fragment>; fin = borne; return morceau; })}{texte.slice(fin)}</>;
}
export function Contenu({ texte, requete = '', cible }: { texte: string; requete?: string; cible?: number }) {
  let code = false, position = 0;
  return <div className="message-content">{texte.split('\n').map((ligne, i) => {
    const debut = position; position += ligne.length + 1;
    const selectionne = cible !== undefined && cible >= debut && cible < position;
    const attributs = { 'data-passage-cible': selectionne ? 'true' : undefined };
    if (ligne.startsWith('```')) { code = !code; return null; }
    if (code) return <pre key={i} {...attributs}>{ligne || ' '}</pre>;
    if (!ligne.trim()) return <div key={i} className="paragraph-space" {...attributs} />;
    const titre = ligne.match(/^#{1,6}\s+(.+)/);
    if (titre) return <h4 key={i} {...attributs}><Surlignage texte={titre[1]} requete={requete} /></h4>;
    const puce = ligne.match(/^([-*]|\d+[.)])\s+(.+)/);
    if (puce) return <div className="message-list" key={i} {...attributs}><span>{puce[1]}</span><div><Surlignage texte={puce[2]} requete={requete} /></div></div>;
    return <p key={i} {...attributs}><Surlignage texte={ligne} requete={requete} /></p>;
  })}</div>;
}
export function DateCourte({ date }: { date: string }) {
  return <time dateTime={date}>{new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(new Date(date))}</time>;
}
export function Copier({ contenu }: { contenu: string }) {
  const [copie, setCopie] = useState(false), [erreur, setErreur] = useState(false);
  return <button className="icon-button" aria-label={erreur ? 'Copie impossible, sélectionnez le texte' : copie ? 'Copié' : 'Copier le message'} title={erreur ? 'Copie impossible : sélectionnez le texte' : 'Copier'} onClick={async () => {
    try { await navigator.clipboard.writeText(contenu); setCopie(true); setTimeout(() => setCopie(false), 2000); } catch { setErreur(true); }
  }}>{copie ? <Check size={15} /> : <Copy size={15} />}</button>;
}
export function SourceLink({ conversation }: { conversation: Conversation }) {
  return conversation.url && /^https?:\/\//.test(conversation.url) ? <a className="source-link" href={conversation.url} target="_blank" rel="noreferrer">Ouvrir sur {PLATEFORMES[conversation.plateforme].nom}<ArrowUpRight size={13} /></a> : null;
}
export function OrigineMatch({ type }: { type: string }) {
  return <span className={`match-type ${type === 'semantique' ? 'semantic' : ''}`}>{type === 'lexicale' ? <Search size={11} /> : <Sparkles size={11} />}{type === 'lexicale' ? 'Mots-clés' : type === 'semantique' ? 'Par le sens' : 'Mots-clés + sens'}</span>;
}
export function Vide({ onReset }: { onReset: () => void }) {
  return <div className="empty-state"><div className="empty-icon"><MessageSquare size={28} /></div><h2>Aucune conversation ici</h2><p>Essayez d’autres mots ou élargissez les filtres pour retrouver votre fil.</p><button className="button secondary" onClick={onReset}>Réinitialiser la recherche<ChevronRight size={15} /></button></div>;
}
