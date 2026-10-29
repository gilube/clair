import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, BookOpen, Bookmark, CalendarDays, Check, ChevronDown, ChevronRight, Command, Download, Folder, HardDrive, Import, Layers3, Library, Loader2, Menu, MessageSquare, Pin, Plus, Search, Settings2, ShieldCheck, SlidersHorizontal, Sparkles, Star, Tag, Trash2, Upload, X } from 'lucide-react';
import { FILTRES_INITIAUX, PLATEFORMES } from './model';
import type { Bibliotheque, Collection, Conversation, Correspondance, Filtres, ModeRecherche, Plateforme, Resultat } from './model';
import { creer_demo } from './demo';
import { creer_passages, filtrer, indexer_lexical, plages_surlignage, rechercher } from './search';
import { exporter_markdown, fusionner_import, importer_collections, importer_conversations, telecharger } from './importer';
import { charger_bibliotheque, sauvegarder_bibliotheque, vider_vecteurs } from './storage';
import { useSemantic } from './useSemantic';
import { Contenu, Copier, DateCourte, OrigineMatch, PlateformeIcon, SourceLink, Surlignage, Vide } from './components';

const LIB_INITIALE: Bibliotheque = { conversations: [], origine: 'demo', collections: [] };
const modes: { id: ModeRecherche; nom: string; icone: typeof Search }[] = [{ id: 'lexicale', nom: 'Lexicale', icone: Search }, { id: 'semantique', nom: 'Sémantique', icone: Sparkles }, { id: 'hybride', nom: 'Hybride', icone: Layers3 }];
type Fenetre = 'import' | 'semantic' | 'collection' | 'settings' | 'sync' | null;

export default function App() {
  const [bibliotheque, setBibliotheque] = useState<Bibliotheque>(LIB_INITIALE);
  const [charge, setCharge] = useState(false), [erreur_stockage, setErreurStockage] = useState('');
  const [requete, setRequete] = useState(''), requete_differee = useDeferredValue(requete);
  const [filtres, setFiltres] = useState<Filtres>({ ...FILTRES_INITIAUX });
  const [mode, setMode] = useState<ModeRecherche>('lexicale'), [mode_demande, setModeDemande] = useState<ModeRecherche>('hybride');
  const [tri, setTri] = useState('pertinence'), [selection, setSelection] = useState('demo-0');
  const [lecteur, setLecteur] = useState(false), [navigation, setNavigation] = useState(false);
  const [navigation_reduite, setNavigationReduite] = useState(false);
  const [page, setPage] = useState<'bibliotheque' | 'about'>('about');
  const [fenetre, setFenetre] = useState<Fenetre>(null), [notification, setNotification] = useState('');
  const [import_erreur, setImportErreur] = useState(''), [import_occupé, setImportOccupe] = useState(false);
  const [collection_nom, setCollectionNom] = useState(''), [collection_active, setCollectionActive] = useState('');
  const [periode, setPeriode] = useState('toutes'), [correspondances_semantiques, setSemantiques] = useState<Correspondance[]>([]), [recherche_en_cours, setRechercheEnCours] = useState(false);
  const [passage_actif, setPassageActif] = useState(0), [tag_nouveau, setTagNouveau] = useState('');
  const [sync_etat, setSyncEtat] = useState(''), [sync_occupe, setSyncOccupe] = useState(false);
  const recherche_ref = useRef<HTMLInputElement>(null), fichier_ref = useRef<HTMLInputElement>(null), lecture_ref = useRef<HTMLDivElement>(null);
  const sauvegarde_file = useRef(Promise.resolve());
  const lecture_stockage_ok = useRef(false);
  const { conversations, collections, origine } = bibliotheque;
  const signature_corpus = JSON.stringify(conversations.map(c => [c.id, c.titre, c.messages]));
  const passages = useMemo(() => creer_passages(conversations), [signature_corpus]);
  const semantique = useSemantic(passages);
  const conversations_filtrees = useMemo(() => conversations.filter(c => filtrer(c, filtres)), [conversations, filtres]);
  const index_lexical = useMemo(() => { const ids = new Set(conversations_filtrees.map(c => c.id)); return indexer_lexical(passages.filter(p => ids.has(p.conversation_id))); }, [passages, conversations_filtrees]);
  const correspondances_lexicales = useMemo(() => index_lexical(requete_differee), [index_lexical, requete_differee]);
  const resultats = useMemo(() => {
    // Semantic and hybrid modes never pretend a lexical fallback is a completed semantic search.
    if (requete_differee.trim() && mode !== 'lexicale' && (semantique.etat !== 'pret' || recherche_en_cours)) return [];
    const liste = rechercher(conversations, filtres, requete_differee, mode, correspondances_lexicales, correspondances_semantiques);
    return liste.sort((a, b) => tri === 'ancien' ? Date.parse(a.conversation.modifie_le) - Date.parse(b.conversation.modifie_le) : tri === 'recent' || !requete_differee.trim() ? Date.parse(b.conversation.modifie_le) - Date.parse(a.conversation.modifie_le) : b.score - a.score);
  }, [conversations, filtres, requete_differee, mode, correspondances_lexicales, correspondances_semantiques, tri, semantique.etat, recherche_en_cours]);
  const selectionne = resultats.find(r => r.conversation.id === selection) ?? resultats[0];
  const conversation = selectionne?.conversation;
  const dossiers = [...new Set(conversations.map(c => c.dossier).filter(Boolean))].sort();
  const tags = [...new Set(conversations.flatMap(c => c.tags))].sort();
  const nombre_messages = conversations.reduce((somme, c) => somme + c.messages.length, 0);
  const filtres_actifs = filtres.plateformes.length + Number(!!filtres.debut || !!filtres.fin) + Number(!!filtres.dossier) + Number(!!filtres.tag) + Number(filtres.favoris);
  const passages_selectionnes = selectionne?.correspondances ?? [];

  useEffect(() => {
    charger_bibliotheque().then(value => { lecture_stockage_ok.current = true; setBibliotheque(value ?? { conversations: creer_demo(), collections: [], origine: 'demo' }); }).catch(() => { setBibliotheque({ conversations: creer_demo(), collections: [], origine: 'demo' }); setErreurStockage('Le stockage local est indisponible. Exportez vos modifications avant de fermer la page.'); }).finally(() => setCharge(true));
  }, []);
  useEffect(() => {
    if (!charge || !lecture_stockage_ok.current) return;
    sauvegarde_file.current = sauvegarde_file.current.then(() => sauvegarder_bibliotheque(bibliotheque)).then(() => setErreurStockage('')).catch(() => setErreurStockage('La sauvegarde locale a échoué. Exportez votre bibliothèque pour conserver vos modifications.'));
  }, [bibliotheque, charge]);
  useEffect(() => { if (!notification) return; const timer = setTimeout(() => setNotification(''), 4500); return () => clearTimeout(timer); }, [notification]);
  useEffect(() => {
    const raccourci = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); recherche_ref.current?.focus(); recherche_ref.current?.select(); }
      if (event.key === 'Escape') { if (fenetre) setFenetre(null); else setLecteur(false); setNavigation(false); }
    };
    window.addEventListener('keydown', raccourci); return () => window.removeEventListener('keydown', raccourci);
  }, [fenetre]);
  useEffect(() => {
    if (!fenetre && !lecteur) return;
    const precedent = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const selecteur = 'button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href],summary';
    const frame = requestAnimationFrame(() => (dialog?.querySelector<HTMLElement>('input:not([type="file"]),.button.primary:not(:disabled)') ?? dialog?.querySelector<HTMLElement>(selecteur))?.focus());
    const retenir = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !dialog) return;
      const elements = [...dialog.querySelectorAll<HTMLElement>(selecteur)].filter(e => e.getClientRects().length);
      const premier = elements[0], dernier = elements.at(-1);
      if (event.shiftKey && document.activeElement === premier) { event.preventDefault(); dernier?.focus(); }
      else if (!event.shiftKey && document.activeElement === dernier) { event.preventDefault(); premier?.focus(); }
    };
    document.addEventListener('keydown', retenir);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('keydown', retenir); precedent?.focus(); };
  }, [fenetre, lecteur]);
  useEffect(() => {
    let annule = false; setSemantiques([]);
    if (!requete_differee.trim() || mode === 'lexicale' || semantique.etat !== 'pret') { setRechercheEnCours(false); return; }
    setRechercheEnCours(true);
    const timer = setTimeout(() => { semantique.chercher(requete_differee).then(value => { if (!annule) setSemantiques(value); }).catch(error => { if (!annule) { setNotification(error.message); setMode('lexicale'); } }).finally(() => { if (!annule) setRechercheEnCours(false); }); }, 300);
    return () => { annule = true; clearTimeout(timer); };
  }, [requete_differee, mode, semantique.etat, passages]);
  useEffect(() => { setPassageActif(0); lecture_ref.current?.scrollTo({ top: 0 }); }, [conversation?.id, requete_differee]);
  useEffect(() => {
    const passage = passages_selectionnes[passage_actif];
    if (!passage) return;
    const message = lecture_ref.current?.querySelector(`[data-message-id="${CSS.escape(passage.passage.message_id)}"]`);
    const element = passage.passage.debut === 0 ? message : message?.querySelector('[data-passage-cible="true"]') ?? message;
    element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [passage_actif, conversation?.id, requete_differee]);

  const modifier = (id: string, modifications: Partial<Conversation>) => setBibliotheque(b => ({ ...b, conversations: b.conversations.map(c => c.id === id ? { ...c, ...modifications } : c) }));
  const reset = () => { setFiltres({ ...FILTRES_INITIAUX }); setRequete(''); setPeriode('toutes'); setCollectionActive(''); };
  const ouvrir = (resultat: Resultat) => { setSelection(resultat.conversation.id); setLecteur(true); };
  const choisir_mode = (nouveau: ModeRecherche) => {
    if (nouveau === 'lexicale' || semantique.etat === 'pret') setMode(nouveau);
    else { setModeDemande(nouveau); setFenetre('semantic'); }
  };
  const appliquer_periode = (valeur: string) => {
    setPeriode(valeur); setCollectionActive('');
    if (valeur === 'personnalisee') return;
    const maintenant = new Date(), debut = new Date();
    if (valeur === 'semaine') debut.setDate(debut.getDate() - 6);
    if (valeur === 'mois') debut.setDate(debut.getDate() - 29);
    if (valeur === 'annee') debut.setMonth(0, 1);
    const iso_locale = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    setFiltres(f => ({ ...f, debut: valeur === 'toutes' ? '' : iso_locale(debut), fin: valeur === 'toutes' ? '' : iso_locale(maintenant) }));
  };
  const importer = async (fichier?: File) => {
    if (!fichier) return; setImportErreur(''); setImportOccupe(true);
    try {
      if (fichier.size > 100 * 1024 * 1024) throw new Error('Cet export dépasse 100 Mo. Importez un fichier plus petit.');
      const donnees = JSON.parse(await fichier.text());
      const nouvelles = importer_conversations(donnees), nouvelles_collections = importer_collections(donnees);
      setBibliotheque(b => ({ ...b, origine: 'personnelle', conversations: fusionner_import(b.origine === 'demo' ? [] : b.conversations, nouvelles), collections: [...new Map([...b.collections, ...nouvelles_collections].map(c => [c.id, c])).values()] }));
      reset(); setSelection(nouvelles[0].id); setFenetre(null); setMode('lexicale'); setNotification(`${nouvelles.length} conversation${nouvelles.length > 1 ? 's' : ''} importée${nouvelles.length > 1 ? 's' : ''}.`);
    } catch (error) { setImportErreur(error instanceof SyntaxError ? 'Ce fichier n’est pas un JSON valide.' : error instanceof Error ? error.message : String(error)); }
    finally { setImportOccupe(false); if (fichier_ref.current) fichier_ref.current.value = ''; }
  };
  const synchroniser = async (plateforme: 'chatgpt' | 'claude' | 'gemini') => {
    setSyncOccupe(true); setSyncEtat('Connexion à l’onglet ouvert…');
    try {
      if (!globalThis.chrome?.runtime?.id) throw new Error('La synchronisation nécessite la version extension Chrome. Utilisez l’import JSON dans la version navigateur.');
      const reponse = await chrome.runtime.sendMessage({ type: 'clair:sync', plateforme }) as { conversations?: unknown[]; erreur?: string; note?: string };
      if (reponse.erreur) throw new Error(reponse.erreur);
      const nouvelles = importer_conversations(reponse.conversations);
      if (plateforme === 'gemini' && nouvelles.some(c => (bibliotheque.conversations.find(a => a.id === c.id)?.messages.length ?? 0) > c.messages.length)) throw new Error('Ce fil Gemini contient moins de messages chargés que votre copie locale. Remontez le fil pour tout charger, puis réessayez. La copie locale a été conservée.');
      setBibliotheque(b => ({ ...b, origine: 'personnelle', conversations: fusionner_import(b.origine === 'demo' ? [] : b.conversations, nouvelles) }));
      setMode('lexicale'); reset(); setSyncEtat(`${nouvelles.length} conversation${nouvelles.length > 1 ? 's' : ''} synchronisée${nouvelles.length > 1 ? 's' : ''}. ${reponse.note ?? ''}`);
    } catch (error) { setSyncEtat(error instanceof Error ? error.message : String(error)); }
    finally { setSyncOccupe(false); }
  };

  if (!charge) return <div className="loading-screen"><img src="./clair.svg" width="48" alt="Clair"/><Loader2 className="spin"/><p>Ouverture de votre bibliothèque…</p></div>;

  return <div className={`app ${navigation_reduite ? 'sidebar-collapsed' : ''}`}>
    {navigation && <button className="nav-scrim" aria-label="Fermer la navigation" onClick={() => setNavigation(false)} />}
    <aside className={`sidebar ${navigation ? 'is-open' : ''}`} inert={!!fenetre || lecteur} onClickCapture={e => { if ((e.target as HTMLElement).closest('button') && !(e.target as HTMLElement).closest('[data-about]')) setPage('bibliotheque'); }}>
      <button className="brand" onClick={reset} aria-label="Clair, toutes les conversations"><img src="./clair.svg" alt=""/><span>clair<span className="brand-dot">.</span></span><span className="local-label">LOCAL</span></button>
      <button className="sidebar-toggle" aria-label={navigation_reduite ? 'Déplier la navigation' : 'Replier la navigation'} title={navigation_reduite ? 'Déplier la navigation' : 'Replier la navigation'} onClick={() => setNavigationReduite(v => !v)}>{navigation_reduite ? <ChevronRight size={15}/> : <ArrowLeft size={15}/>}</button>
      <div className="workspace-label">VOTRE ESPACE</div>
      <nav aria-label="Bibliothèque">
        <button className={`nav-item ${page === 'bibliotheque' && !filtres.favoris && !filtres.dossier && !collection_active ? 'active' : ''}`} onClick={() => { reset(); setNavigation(false); }}><Library size={17}/><span>Toutes les conversations</span><span className="nav-count">{conversations.length}</span></button>
        <button className={`nav-item ${filtres.favoris ? 'active' : ''}`} onClick={() => { setFiltres({ ...FILTRES_INITIAUX, favoris: true }); setCollectionActive(''); setNavigation(false); }}><Star size={17}/><span>Favoris</span><span className="nav-count">{conversations.filter(c => c.favori).length}</span></button>
      </nav>
      <div className="section-label">PLATEFORMES<span>{Object.keys(PLATEFORMES).filter(p => conversations.some(c => c.plateforme === p)).length}</span></div>
      <div className="platform-nav">{(Object.keys(PLATEFORMES) as Plateforme[]).filter(p => conversations.some(c => c.plateforme === p)).map(p => <button key={p} className={`platform-item ${filtres.plateformes.includes(p) ? 'selected' : ''}`} onClick={() => { setFiltres(f => ({ ...f, plateformes: f.plateformes.includes(p) ? f.plateformes.filter(v => v !== p) : [...f.plateformes, p] })); setCollectionActive(''); }}><PlateformeIcon plateforme={p} petit/><span>{PLATEFORMES[p].nom}</span><span>{conversations.filter(c => c.plateforme === p).length}</span>{filtres.plateformes.includes(p) && <Check size={12}/>}</button>)}</div>
      <div className="section-label">DOSSIERS<button className="tiny-button" aria-label="Créer un dossier" onClick={() => { const nom = window.prompt('Nom du nouveau dossier'); if (nom?.trim() && conversation) modifier(conversation.id, { dossier: nom.trim() }); }}><Plus size={14}/></button></div>
      <div className="folder-nav">{dossiers.map(d => <button className={`nav-item ${filtres.dossier === d ? 'active' : ''}`} key={d} onClick={() => { setFiltres(f => ({ ...f, dossier: f.dossier === d ? '' : d })); setCollectionActive(''); }}><Folder size={15}/><span>{d}</span><span className="nav-count">{conversations.filter(c => c.dossier === d).length}</span></button>)}</div>
      <div className="section-label">COLLECTIONS<button className="tiny-button" aria-label="Enregistrer la recherche" onClick={() => setFenetre('collection')}><Plus size={14}/></button></div>
      <div className="collections-nav">{collections.length ? collections.map(c => <div className="collection-row" key={c.id}><button className={`nav-item ${collection_active === c.id ? 'active' : ''}`} onClick={() => { setRequete(c.requete); setFiltres(c.filtres); setPeriode(c.filtres.debut || c.filtres.fin ? 'personnalisee' : 'toutes'); setCollectionActive(c.id); choisir_mode(c.mode); }}><Bookmark size={15}/><span>{c.nom}</span></button><button className="tiny-button delete-collection" aria-label={`Supprimer ${c.nom}`} onClick={() => setBibliotheque(b => ({ ...b, collections: b.collections.filter(v => v.id !== c.id) }))}><X size={12}/></button></div>) : <button className="collection-empty" onClick={() => setFenetre('collection')}><Plus size={13}/>Enregistrer une recherche</button>}</div>
      <div className="sidebar-bottom"><button className={`nav-item ${page === 'about' ? 'active' : ''}`} data-about onClick={() => { setPage('about'); setNavigation(false); }}><BookOpen size={17}/><span>About</span></button><button className="nav-item" onClick={() => setFenetre('settings')}><Settings2 size={17}/><span>Préférences & données</span></button></div>
    </aside>

    <div className="workspace" inert={!!fenetre}>
      <header className="topbar" inert={lecteur}><div className="breadcrumbs"><button className="icon-button mobile-menu" aria-label="Ouvrir la navigation" onClick={() => setNavigation(true)}><Menu size={18}/></button><span>Mon espace</span><ChevronRight size={13}/><strong>{page === 'about' ? 'About' : 'Bibliothèque'}</strong></div><div className="topbar-actions">{origine === 'demo' && <span className="demo-badge"><span/>Démonstration</span>}<button className="button secondary compact" onClick={() => { setSyncEtat(''); setFenetre('sync'); }}><ArrowDown size={14}/>Synchroniser</button><button className="button primary compact" onClick={() => { setImportErreur(''); setFenetre('import'); }}><Plus size={15}/>Importer</button></div></header>
      {erreur_stockage && <div className="storage-error" role="alert">{erreur_stockage}</div>}
      {page === 'about' ? <main className="about-page"><h1>Bienvenue dans Clair</h1><p className="about-intro">Clair est une bibliothèque locale pour importer, rechercher et organiser des conversations avec des assistants IA.</p><button className="button primary about-start" onClick={() => setPage('bibliotheque')}>Ouvrir la bibliothèque<ArrowRight size={15}/></button><section><h2>Pour commencer</h2><p>Importez un fichier JSON ou explorez les exemples, puis recherchez et ouvrez une conversation. Utilisez les filtres et les favoris pour organiser vos échanges.</p></section><section><h2>Importer et synchroniser</h2><p>Importez les fichiers JSON de ChatGPT, Claude, Threadback ou Clair. Les messages textuels sont importés, pas les pièces jointes binaires. Pour ChatGPT, la branche active de la conversation est conservée.</p><p>Dans l’extension Chrome, la synchronisation expérimentale lit jusqu’à 50 conversations récentes depuis un onglet ChatGPT ou Claude connecté. Gemini permet d’importer le fil ouvert et ses messages chargés. La collecte est déclenchée manuellement et ne parcourt pas tout l’historique.</p></section><section><h2>Rechercher et organiser</h2><p>La recherche lexicale retrouve les mots présents dans les conversations. La recherche sémantique rapproche les passages par leur sens ; le mode hybride combine les deux. Filtrez par plateforme, date, dossier, tag ou favori et enregistrez vos recherches en collections.</p><p>La recherche sémantique nécessite l’activation et le téléchargement initial d’un modèle multilingue d’environ 130 Mo depuis Hugging Face. Le calcul et l’index restent locaux ; le texte des conversations n’est pas envoyé à une API d’inférence.</p></section><section><h2>Données et sauvegarde</h2><p>Les conversations et les collections sont stockées dans le navigateur sur cet appareil. La version navigateur et l’extension ont des bibliothèques distinctes. Un premier import remplace les exemples ; les imports suivants fusionnent les conversations et conservent leur organisation.</p><p>Exportez la bibliothèque en JSON depuis « Préférences & données » pour la sauvegarder, ou une conversation en Markdown depuis le lecteur. Les données locales peuvent être perdues si les données du navigateur sont effacées.</p></section></main> : <>
      <section className="search-area" inert={lecteur}>
        <div className="heading-row"><div><h1>Conversations IA</h1><p>Rechercher dans vos conversations importées.</p></div></div>
        <div className="search-box"><Search size={21}/><input ref={recherche_ref} value={requete} onChange={e => { setRequete(e.target.value); setCollectionActive(''); }} placeholder="Rechercher dans les conversations" aria-label="Rechercher dans les conversations"/>{requete && <button className="icon-button" aria-label="Effacer la recherche" onClick={() => setRequete('')}><X size={16}/></button>}<kbd><Command size={11}/>K</kbd><button className="search-submit" aria-label="Lancer la recherche" onClick={() => recherche_ref.current?.blur()}><ArrowRight size={17}/></button></div>
        <div className="search-toolbar"><div className="mode-switch" role="group" aria-label="Mode de recherche">{modes.map(m => <button key={m.id} className={mode === m.id ? 'selected' : ''} aria-pressed={mode === m.id} onClick={() => choisir_mode(m.id)}><m.icone size={14}/>{m.nom}{m.id === 'hybride' && <span className="mode-new">IA</span>}</button>)}</div><span className="toolbar-separator"/><div className="select-with-icon"><CalendarDays size={14}/><select aria-label="Période de dernière activité" value={periode} onChange={e => appliquer_periode(e.target.value)}><option value="toutes">Toutes les dates</option><option value="semaine">7 derniers jours</option><option value="mois">30 derniers jours</option><option value="annee">Cette année</option><option value="personnalisee">Période personnalisée</option></select><ChevronDown size={12}/></div><div className="select-with-icon tag-select"><Tag size={14}/><select aria-label="Filtrer par tag" value={filtres.tag} onChange={e => setFiltres(f => ({ ...f, tag: e.target.value }))}><option value="">Tous les tags</option>{tags.map(t => <option key={t}>{t}</option>)}</select><ChevronDown size={12}/></div><div className="toolbar-spacer"/>{filtres_actifs > 0 && <button className="clear-filters" onClick={() => { setFiltres({ ...FILTRES_INITIAUX }); setPeriode('toutes'); setCollectionActive(''); }}><X size={12}/>{filtres_actifs} filtre{filtres_actifs > 1 ? 's' : ''}</button>}<button className="icon-button save-search" aria-label="Enregistrer cette recherche en collection" title="Enregistrer la recherche" onClick={() => setFenetre('collection')}><Bookmark size={16}/></button></div>
        {periode === 'personnalisee' && <div className="custom-dates"><span>Dernière activité</span><label>Du <input type="date" value={filtres.debut} max={filtres.fin || undefined} onChange={e => setFiltres(f => ({ ...f, debut: e.target.value }))}/></label><label>au <input type="date" value={filtres.fin} min={filtres.debut || undefined} onChange={e => setFiltres(f => ({ ...f, fin: e.target.value }))}/></label></div>}
        {filtres.plateformes.length > 0 && <div className="active-chips">{filtres.plateformes.map(p => <button key={p} onClick={() => setFiltres(f => ({ ...f, plateformes: f.plateformes.filter(v => v !== p) }))}><PlateformeIcon plateforme={p} petit/>{PLATEFORMES[p].nom}<X size={11}/></button>)}</div>}
      </section>

      <div className="content-layout">
        <main className="results-pane" aria-label="Résultats de recherche" inert={lecteur}>
          <div className="results-heading"><div><h2>{filtres.favoris ? 'Vos favoris' : filtres.dossier || 'Vos conversations'}</h2><span className="result-count">{resultats.length}</span>{recherche_en_cours && <Loader2 className="spin" size={14}/>}</div><div className="results-heading-actions"><select aria-label="Trier les résultats" value={tri} onChange={e => setTri(e.target.value)}><option value="pertinence">{requete.trim() ? 'Pertinence' : 'Plus récentes'}</option><option value="recent">Plus récentes</option><option value="ancien">Plus anciennes</option></select></div></div>
          {origine === 'demo' && <div className="demo-note"><Sparkles size={14}/><span>Explorez les exemples, ou <button onClick={() => setFenetre('import')}>importez vos conversations</button>.</span></div>}
          {mode !== 'lexicale' && semantique.etat !== 'pret' && requete.trim() ? <div className="empty-state"><Sparkles size={28}/><h2>Activez la recherche par le sens</h2><p>Le modèle doit être réindexé après une modification de la bibliothèque.</p><button className="button primary" onClick={() => { setModeDemande(mode); setFenetre('semantic'); }}>Préparer le modèle</button></div> : recherche_en_cours ? <div className="empty-state"><Loader2 className="spin" size={24}/><p>Recherche des passages les plus proches…</p></div> : !resultats.length ? <Vide onReset={reset}/> : <div className="result-list">{resultats.map((r, i) => <ResultCard key={r.conversation.id} resultat={r} actif={conversation?.id === r.conversation.id && lecteur} requete={requete_differee} rang={i + 1} ouvrir={() => ouvrir(r)} favori={() => modifier(r.conversation.id, { favori: !r.conversation.favori })}/>)}</div>}

        </main>

        {lecteur && <div className="reader-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setLecteur(false); }}><aside className="reader-pane" role="dialog" aria-modal="true" aria-label="Lecture de la conversation">
          <div className="reader-top"><div><span className="reader-indicator"/>ESPACE DE LECTURE</div><div><button className="icon-button" aria-label="Fermer la conversation" onClick={() => setLecteur(false)}><X size={18}/></button></div></div>
          {conversation ? <><div className="reader-title"><div className="reader-source"><PlateformeIcon plateforme={conversation.plateforme} petit/><span>{PLATEFORMES[conversation.plateforme].nom}</span><span>·</span><DateCourte date={conversation.modifie_le}/><button className={`icon-button reader-star ${conversation.favori ? 'is-favorite' : ''}`} aria-label={conversation.favori ? 'Retirer des favoris' : 'Ajouter aux favoris'} onClick={() => modifier(conversation.id, { favori: !conversation.favori })}><Star size={16} fill={conversation.favori ? 'currentColor' : 'none'}/></button></div><h2>{conversation.titre}</h2><div className="reader-meta"><span><MessageSquare size={12}/>{conversation.messages.length} messages</span><span><Folder size={12}/>{conversation.dossier || 'Sans dossier'}</span></div><div className="reader-tags">{conversation.tags.map(t => <button key={t} title={`Filtrer par ${t}`} onClick={() => setFiltres(f => ({ ...f, tag: t }))}>{t}</button>)}</div><div className="reader-tools"><SourceLink conversation={conversation}/><button className="text-button" onClick={() => telecharger(`clair-${conversation.id.replace(/[^\w-]/g, '-')}.md`, exporter_markdown(conversation), 'text/markdown')}><Download size={13}/>Exporter</button></div></div>
          {!!passages_selectionnes.length && <div className="match-navigation"><span><Search size={13}/>{passages_selectionnes.length} passage{passages_selectionnes.length > 1 ? 's' : ''} pertinent{passages_selectionnes.length > 1 ? 's' : ''}</span><div><span>{passage_actif + 1}/{passages_selectionnes.length}</span><button className="tiny-button" aria-label="Passage précédent" disabled={!passage_actif} onClick={() => setPassageActif(v => v - 1)}><ArrowLeft size={13}/></button><button className="tiny-button" aria-label="Passage suivant" disabled={passage_actif >= passages_selectionnes.length - 1} onClick={() => setPassageActif(v => v + 1)}><ArrowRight size={13}/></button></div></div>}
          <div className="reader-messages" ref={lecture_ref}>{conversation.messages.map((m, i) => {
            const match = passages_selectionnes.some(p => p.passage.message_id === m.id);
            return <article key={m.id} data-message-id={m.id} className={`message ${m.role} ${match ? 'matched' : ''}`}><div className="message-heading"><span className={`message-avatar ${m.role === 'user' ? 'human' : ''}`}>{m.role === 'user' ? 'V' : <Sparkles size={12}/>}</span><strong>{m.role === 'user' ? 'Vous' : m.role === 'system' ? 'Système' : PLATEFORMES[conversation.plateforme].nom}</strong><span className="message-number">{String(i + 1).padStart(2, '0')}</span>{match && <span className="passage-badge">Passage pertinent</span>}<Copier contenu={m.contenu}/></div><Contenu texte={m.contenu} requete={requete_differee} cible={passages_selectionnes[passage_actif]?.passage.message_id === m.id ? passages_selectionnes[passage_actif].passage.debut : undefined}/></article>;
          })}<div className="reader-organization"><label>Classer dans un dossier<select value={conversation.dossier} onChange={e => { if (e.target.value === '__nouveau__') { const nom = window.prompt('Nom du dossier'); if (nom?.trim()) modifier(conversation.id, { dossier: nom.trim() }); } else modifier(conversation.id, { dossier: e.target.value }); }}><option value="">Sans dossier</option>{dossiers.map(d => <option key={d}>{d}</option>)}<option value="__nouveau__">+ Nouveau dossier</option></select></label><form onSubmit={e => { e.preventDefault(); const tag = tag_nouveau.trim(); if (tag && !conversation.tags.includes(tag)) modifier(conversation.id, { tags: [...conversation.tags, tag] }); setTagNouveau(''); }}><label>Ajouter un tag<div className="tag-input"><input value={tag_nouveau} onChange={e => setTagNouveau(e.target.value)} placeholder="Ex. : À relire" aria-label="Nouveau tag"/><button className="tiny-button" aria-label="Ajouter le tag"><Plus size={14}/></button></div></label></form><div className="editable-tags">{conversation.tags.map(t => <button key={t} onClick={() => modifier(conversation.id, { tags: conversation.tags.filter(v => v !== t) })} title={`Retirer le tag ${t}`}>{t}<X size={10}/></button>)}</div></div><div className="end-conversation"><span/>Fin de la conversation<span/></div></div></> : <div className="empty-reader"><BookOpen size={28}/><p>Sélectionnez une conversation pour retrouver son contexte.</p></div>}
        </aside></div>}
      </div></>}
    </div>

    {notification && <div className="toast" role="status"><Check size={16}/>{notification}<button className="tiny-button" aria-label="Fermer la notification" onClick={() => setNotification('')}><X size={14}/></button></div>}
    {fenetre && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget && !import_occupé && !sync_occupe) setFenetre(null); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="modal-close icon-button" aria-label="Fermer la fenêtre" onClick={() => setFenetre(null)}><X size={19}/></button>
      {fenetre === 'import' && <><div className="modal-symbol"><Import size={25}/></div><h2 id="modal-title">Votre historique, au même endroit.</h2><p>Importez un export JSON de ChatGPT, Claude, Threadback ou Clair. Les fichiers sont lus et conservés sur cet appareil.</p><button className="dropzone" disabled={import_occupé} onClick={() => fichier_ref.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void importer(e.dataTransfer.files[0]); }}><Upload size={28}/><strong>{import_occupé ? 'Lecture du fichier…' : 'Déposez votre fichier JSON ici'}</strong><span>ou cliquez pour le choisir · jusqu’à 100 Mo</span></button><input ref={fichier_ref} className="visually-hidden" type="file" accept=".json,application/json" onChange={e => void importer(e.target.files?.[0])}/>{import_erreur && <p className="inline-error" role="alert">{import_erreur}</p>}<div className="modal-note"><ShieldCheck size={17}/><span>{origine === 'demo' ? 'Votre premier import remplacera les exemples de démonstration.' : 'Les conversations existantes seront mises à jour sans perdre vos favoris et vos tags.'}</span></div><details className="import-help"><summary>Où trouver mon export ?</summary><p>ChatGPT : Paramètres → Contrôles des données → Exporter les données, puis choisissez conversations.json dans l’archive. Claude : Paramètres → Confidentialité → Exporter les données. Pour Threadback, utilisez l’export JSON de la bibliothèque.</p></details></>}
      {fenetre === 'semantic' && <><div className="modal-symbol"><Sparkles size={25}/></div><h2 id="modal-title">Retrouvez l’idée, même sans les mots.</h2><p>Un modèle multilingue s’exécute sur votre appareil pour rapprocher votre question du sens des conversations.</p><div className="feature-lines"><div><Download size={17}/><span>Un téléchargement initial d’environ 130 Mo</span></div><div><HardDrive size={17}/><span>Modèle et index mis en cache localement</span></div><div><ShieldCheck size={17}/><span>Aucun texte de conversation envoyé au modèle distant</span></div></div>{semantique.etat === 'chargement' && <div className="model-progress" role="status"><div><Loader2 className="spin" size={16}/><span>{semantique.progression.phase}</span></div><progress max="100" value={semantique.progression.pourcentage}/></div>}{semantique.erreur && <p className="inline-error" role="alert">{semantique.erreur}</p>}<button className="button primary full-width" disabled={semantique.etat === 'chargement'} onClick={async () => { if (await semantique.activer()) { setMode(mode_demande); setFenetre(null); setNotification('La recherche sémantique locale est prête.'); } }}>{semantique.etat === 'chargement' ? 'Préparation en cours…' : 'Activer la recherche par le sens'}<Sparkles size={15}/></button><small>Le téléchargement requiert une connexion à Hugging Face. Les recherches suivantes utilisent les fichiers mis en cache.</small></>}
      {fenetre === 'collection' && <><div className="modal-symbol"><Bookmark size={25}/></div><h2 id="modal-title">Gardez cette piste sous la main.</h2><p>Enregistrez votre requête et vos filtres dans une collection, pour les retrouver en un clic.</p><form onSubmit={e => { e.preventDefault(); if (!collection_nom.trim()) return; const c: Collection = { id: crypto.randomUUID(), nom: collection_nom.trim(), requete, filtres: { ...filtres }, mode }; setBibliotheque(b => ({ ...b, collections: [...b.collections, c] })); setCollectionActive(c.id); setCollectionNom(''); setFenetre(null); setNotification('Collection enregistrée.'); }}><label className="form-label">Nom de la collection<input autoFocus value={collection_nom} onChange={e => setCollectionNom(e.target.value)} placeholder="Ex. : Mes idées pour le projet" required maxLength={80}/></label><div className="collection-summary"><Search size={14}/>{requete || 'Toutes les conversations'}<span>{filtres_actifs} filtre{filtres_actifs > 1 ? 's' : ''}</span></div><button className="button primary full-width" type="submit">Enregistrer la collection<Bookmark size={15}/></button></form></>}
      {fenetre === 'settings' && <><div className="modal-symbol"><Settings2 size={25}/></div><h2 id="modal-title">Votre bibliothèque, vos données.</h2><p>{conversations.length} conversations et {nombre_messages} messages enregistrés dans ce navigateur. Pensez à exporter une sauvegarde avant d’effacer vos données de navigation.</p><div className="settings-actions"><button className="settings-row" onClick={() => telecharger(`clair-bibliotheque-${new Date().toISOString().slice(0,10)}.json`, JSON.stringify({ format: 'clair', version: 1, conversations, collections }, null, 2))}><Download size={19}/><div><strong>Exporter la bibliothèque</strong><span>Une sauvegarde JSON réimportable</span></div><ChevronRight size={17}/></button><button className="settings-row" onClick={() => { void vider_vecteurs().then(() => { setNotification('Cache des embeddings supprimé.'); setFenetre(null); window.location.reload(); }).catch(() => setNotification('Impossible de vider le cache.')); }}><HardDrive size={19}/><div><strong>Vider le cache des vecteurs</strong><span>Les conversations sont conservées</span></div><ChevronRight size={17}/></button><button className="settings-row" onClick={() => { if (window.confirm('Remplacer cette bibliothèque par les exemples ? Exportez vos données personnelles auparavant.')) { setBibliotheque({ conversations: creer_demo(), collections: [], origine: 'demo' }); reset(); setMode('lexicale'); setFenetre(null); } }}><Sparkles size={19}/><div><strong>Revenir à la démonstration</strong><span>Remplacer la bibliothèque actuelle</span></div><ChevronRight size={17}/></button><button className="settings-row danger" onClick={() => { if (window.confirm('Supprimer toutes les conversations, collections et vecteurs de Clair sur cet appareil ?')) { setBibliotheque({ conversations: [], collections: [], origine: 'personnelle' }); void vider_vecteurs().catch(() => setNotification('Le cache des vecteurs n’a pas pu être effacé.')); reset(); setMode('lexicale'); setFenetre(null); } }}><Trash2 size={19}/><div><strong>Effacer la bibliothèque</strong><span>Cette suppression ne touche pas les plateformes IA</span></div></button></div><div className="modal-note"><ShieldCheck size={17}/><span>Clair n’a pas de serveur de conversations. La version navigateur et l’extension possèdent chacune leur stockage local.</span></div></>}
      {fenetre === 'sync' && <><div className="modal-symbol"><ArrowDown size={25}/></div><h2 id="modal-title">Connectez vos conversations.</h2><p>Dans la version extension, ouvrez un onglet connecté à votre compte, puis lancez la collecte. ChatGPT et Claude : jusqu’à 50 conversations récentes. Gemini : uniquement le fil ouvert et ses messages déjà chargés ; remontez le fil pour charger les plus anciens.</p><div className="sync-platforms">{(['chatgpt', 'claude', 'gemini'] as const).map(p => <button className="settings-row" disabled={sync_occupe} key={p} onClick={() => void synchroniser(p)}><PlateformeIcon plateforme={p}/><div><strong>{PLATEFORMES[p].nom}</strong><span>{p === 'gemini' ? 'Importer le fil ouvert · messages chargés uniquement' : 'Lire les conversations de l’onglet connecté'}</span></div>{sync_occupe ? <Loader2 size={17} className="spin"/> : <ArrowRight size={17}/>}</button>)}</div>{sync_etat && <div className="sync-status" role="status">{sync_etat}</div>}<div className="modal-note"><ShieldCheck size={17}/><span>La collecte dépend des API ou de la page des plateformes et doit encore être validée avec des comptes réels. La version navigateur fonctionne avec l’import JSON.</span></div><button className="text-button" onClick={() => setFenetre('import')}><Import size={14}/>Importer un export JSON</button></>}
    </section></div>}
  </div>;
}

function ResultCard({ resultat: r, actif, requete, ouvrir, favori }: { resultat: Resultat; actif: boolean; requete: string; rang: number; ouvrir: () => void; favori: () => void }) {
  const [developpe, setDeveloppe] = useState(false);
  const c = r.conversation;
  const exemples = r.correspondances.length ? r.correspondances : [{ passage: { texte: c.messages.find(m => m.role === 'assistant')?.contenu ?? c.messages[0]?.contenu ?? '', message_id: c.messages[0]?.id ?? '', debut: 0, fin: 0, titre: c.titre, id: '', conversation_id: c.id }, score: 0, type: 'lexicale' as const }];
  const visibles = developpe ? exemples.slice(0, 5) : exemples.slice(0, 1);
  return <article className={`result-card ${actif ? 'selected' : ''}`}>
    <div className="result-source"><PlateformeIcon plateforme={c.plateforme} petit/><span>{PLATEFORMES[c.plateforme].nom}</span><span className="source-dot">·</span><DateCourte date={c.modifie_le}/><button className={`icon-button favorite-button ${c.favori ? 'is-favorite' : ''}`} aria-label={c.favori ? `Retirer ${c.titre} des favoris` : `Ajouter ${c.titre} aux favoris`} onClick={favori}><Star size={15} fill={c.favori ? 'currentColor' : 'none'}/></button></div>
    <button className="result-open" onClick={ouvrir}><h3><span><Surlignage texte={c.titre} requete={requete}/></span><ArrowRight size={16}/></h3>{visibles.map((item, index) => {
      let texte = item.passage.texte.replace(/^#{1,6}\s+/gm, '').replace(/\*\*/g, '');
      const match = plages_surlignage(texte, requete)[0];
      const debut = match ? Math.max(0, match[0] - 80) : 0;
      const limite = developpe ? 650 : 310;
      const extrait = (debut ? '…' : '') + texte.slice(debut, debut + limite).trim() + (texte.length > debut + limite ? '…' : '');
      return <div className="result-excerpt" key={`${item.passage.id}-${index}`}><span className="excerpt-line"/><p><Surlignage texte={extrait} requete={requete}/></p></div>;
    })}</button>
    <div className="result-bottom"><div className="result-tags">{c.tags.slice(0, 2).map(t => <span key={t}>{t}</span>)}</div>{requete.trim() ? <OrigineMatch type={r.type}/> : <span className="result-messages"><MessageSquare size={11}/>{c.messages.length} messages</span>}</div>
    {!!r.correspondances.length && <div className="result-matches"><button onClick={() => setDeveloppe(!developpe)}>{developpe ? 'Réduire les extraits' : `${r.correspondances.length} passage${r.correspondances.length > 1 ? 's' : ''} pertinent${r.correspondances.length > 1 ? 's' : ''}`}<ChevronDown size={12} style={{ transform: developpe ? 'rotate(180deg)' : undefined }}/></button><button onClick={ouvrir}>Lire la conversation<ArrowRight size={12}/></button></div>}
  </article>;
}
