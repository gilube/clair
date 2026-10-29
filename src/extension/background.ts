import { collecter_gemini } from './gemini';

chrome.action.onClicked.addListener(() => { void chrome.tabs.create({ url: chrome.runtime.getURL('index.html') }); });
chrome.commands.onCommand.addListener(commande => { if (commande === 'ouvrir-clair') void chrome.tabs.create({ url: chrome.runtime.getURL('index.html') }); });

// This function is serialized by Chrome and runs only when the user requests sync.
// Credentials stay inside the selected platform tab; only conversation data is returned.
async function collecter_dans_page(plateforme: 'chatgpt' | 'claude'): Promise<{ conversations?: unknown[]; erreur?: string; note?: string }> {
  try {
    const lire = async (url: string, headers: Record<string, string> = {}) => {
      const response = await fetch(url, { credentials: 'include', headers, signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`La plateforme a répondu ${response.status}. Vérifiez votre connexion dans son onglet.`);
      return response.json();
    };
    const conversations: unknown[] = []; let ignorees = 0;
    if (plateforme === 'chatgpt') {
      if (location.origin !== 'https://chatgpt.com') throw new Error('Ouvrez un onglet chatgpt.com connecté.');
      const session = await lire('/api/auth/session');
      if (typeof session.accessToken !== 'string') throw new Error('La session ChatGPT n’est pas disponible. Reconnectez-vous dans son onglet.');
      const headers = { Authorization: `Bearer ${session.accessToken}` };
      const liste = await lire('/backend-api/conversations?offset=0&limit=50&order=updated', headers);
      if (!Array.isArray(liste.items)) throw new Error('Le format de la liste ChatGPT a changé. Utilisez l’import JSON.');
      for (const item of liste.items.slice(0, 50)) {
        if (typeof item.id !== 'string') continue;
        try { conversations.push(await lire(`/backend-api/conversation/${encodeURIComponent(item.id)}`, headers)); }
        catch { ignorees++; }
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    } else {
      if (location.origin !== 'https://claude.ai') throw new Error('Ouvrez un onglet claude.ai connecté.');
      const organisations = await lire('/api/organizations');
      if (!Array.isArray(organisations) || !organisations[0]?.uuid) throw new Error('Aucune organisation Claude trouvée dans la session.');
      const org = encodeURIComponent(organisations[0].uuid);
      const liste = await lire(`/api/organizations/${org}/chat_conversations_v2?limit=50&offset=0&consistency=eventual`);
      const items = Array.isArray(liste) ? liste : Array.isArray(liste.conversations) ? liste.conversations : Array.isArray(liste.data) ? liste.data : null;
      if (!items) throw new Error('Le format de la liste Claude a changé. Utilisez l’import JSON.');
      for (const item of items.slice(0, 50)) {
        if (typeof item.uuid !== 'string') continue;
        try { conversations.push(await lire(`/api/organizations/${org}/chat_conversations/${encodeURIComponent(item.uuid)}?tree=True&rendering_mode=messages`)); }
        catch { ignorees++; }
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    }
    if (!conversations.length) throw new Error('Aucune conversation récupérée. Vérifiez votre session ou utilisez un export JSON.');
    return { conversations, note: ignorees ? `${ignorees} conversations n’ont pas pu être lues ; elles n’ont pas été supprimées de la bibliothèque.` : 'Collecte limitée aux 50 conversations les plus récentes.' };
  } catch (error) { return { erreur: error instanceof Error ? error.message : String(error) }; }
}

chrome.runtime.onMessage.addListener((message, sender, repondre) => {
  if (sender.id !== chrome.runtime.id || message?.type !== 'clair:sync') return;
  const plateforme = message.plateforme;
  if (plateforme !== 'chatgpt' && plateforme !== 'claude' && plateforme !== 'gemini') { repondre({ erreur: 'Plateforme non prise en charge.' }); return; }
  const executer = async () => {
    const origine = plateforme === 'chatgpt' ? 'https://chatgpt.com/*' : plateforme === 'claude' ? 'https://claude.ai/*' : 'https://gemini.google.com/*';
    const onglets = await chrome.tabs.query({ url: origine });
    const onglet = onglets.find(t => t.active) ?? onglets[0];
    if (!onglet?.id) throw new Error(`Ouvrez ${plateforme === 'chatgpt' ? 'ChatGPT' : plateforme === 'claude' ? 'Claude' : 'Gemini'} dans un onglet et connectez-vous, puis réessayez.`);
    if (plateforme === 'gemini') {
      const resultats = await chrome.scripting.executeScript({ target: { tabId: onglet.id }, world: 'ISOLATED', func: collecter_gemini });
      return resultats[0]?.result ?? { erreur: 'Gemini n’a pas renvoyé de résultat.' };
    }
    const resultats = await chrome.scripting.executeScript({ target: { tabId: onglet.id }, world: 'MAIN', func: collecter_dans_page, args: [plateforme] });
    return resultats[0]?.result ?? { erreur: 'La plateforme n’a pas renvoyé de résultat.' };
  };
  void executer().then(repondre).catch(error => repondre({ erreur: error instanceof Error ? error.message : String(error) }));
  return true;
});
