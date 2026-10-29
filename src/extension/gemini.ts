/** Serialized by chrome.scripting: keep this function independent of module scope. */
export function collecter_gemini() {
  try {
    if (location.origin !== 'https://gemini.google.com') throw new Error('Ouvrez un onglet gemini.google.com connecté.');
    const chemin = location.pathname.match(/^\/(?:u\/\d+\/)?app\/([a-zA-Z0-9_-]+)\/?$/);
    if (!chemin) throw new Error('Ouvrez une conversation enregistrée dans Gemini, puis réessayez.');
    const racine = document.querySelector('#chat-history, [data-test-id="chat-history-container"]');
    if (!racine) throw new Error('Le fil Gemini est introuvable. Attendez son chargement, puis réessayez.');
    if (racine.querySelector('[aria-busy="true"], .loading-indicator')) throw new Error('Attendez que Gemini termine sa réponse avant de synchroniser.');
    const messages: { id: string; role: 'user' | 'assistant'; contenu: string }[] = [];
    for (const bloc of racine.querySelectorAll('user-query, model-response')) {
      const role = bloc.tagName.toLowerCase() === 'user-query' ? 'user' : 'assistant';
      const contenu_element = role === 'user'
        ? bloc.querySelector('.query-text, user-query-content')
        : bloc.querySelector('message-content .markdown-main-panel, message-content .markdown, message-content, .model-response-text');
      if (!contenu_element) continue;
      const copie = contenu_element.cloneNode(true) as HTMLElement;
      copie.querySelectorAll('button, script, style, svg, .cdk-visually-hidden, [aria-hidden="true"], message-actions, model-thoughts, .thoughts-container').forEach(e => e.remove());
      // Detached innerText is inconsistent; introduce line breaks before textContent.
      copie.querySelectorAll('br').forEach(e => e.replaceWith('\n'));
      copie.querySelectorAll('p, div, li, pre, h1, h2, h3, tr').forEach(e => e.append('\n'));
      const contenu = (copie.textContent ?? '').replace(/\n[ \t]+/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
      if (contenu) messages.push({ id: `gemini:${chemin[1]}:${messages.length}`, role, contenu });
    }
    if (!messages.length) throw new Error('Aucun message Gemini lisible. Chargez le fil ou vérifiez si son interface a changé.');
    const maintenant = new Date().toISOString();
    const titre = document.querySelector('[data-test-id="conversation-title"]')?.textContent?.trim() || messages.find(m => m.role === 'user')?.contenu.slice(0, 100) || 'Conversation Gemini';
    return {
      conversations: [{ id: `gemini:${chemin[1]}`, plateforme: 'gemini', titre, messages, cree_le: maintenant, modifie_le: maintenant, url: `${location.origin}${location.pathname}` }],
      note: 'Gemini : seul le fil ouvert et ses messages chargés ont été importés. Remontez le fil pour charger les anciens messages. Les dates correspondent à la collecte.',
    };
  } catch (error) { return { erreur: error instanceof Error ? error.message : String(error) }; }
}
