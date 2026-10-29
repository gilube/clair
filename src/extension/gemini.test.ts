import { afterEach, describe, expect, it, vi } from 'vitest';
import { Window } from 'happy-dom';
import { collecter_gemini } from './gemini';
import { importer_conversations } from '../importer';

function page(html: string, url = 'https://gemini.google.com/u/1/app/abc123') {
  const fenetre = new Window({ url });
  fenetre.document.body.innerHTML = html;
  vi.stubGlobal('document', fenetre.document);
  vi.stubGlobal('location', fenetre.location);
}
afterEach(() => vi.unstubAllGlobals());
describe('collecte Gemini du fil chargé', () => {
  it('conserve les rôles, l’ordre et les lignes, sans boutons ni raisonnement', () => {
    page(`<div data-test-id="conversation-title">Mon projet</div><div id="chat-history">
      <user-query><div class="query-text"><p>Explique ce code</p><button>Modifier</button></div></user-query>
      <model-response><message-content><div class="markdown-main-panel"><p>Voici :</p><pre>const a = 1;\nconst b = 2;</pre><button>Copier</button><model-thoughts>Interne</model-thoughts></div></message-content></model-response>
    </div><aside><user-query><div class="query-text">Hors du fil</div></user-query></aside>`);
    const resultat = collecter_gemini();
    expect(resultat.erreur).toBeUndefined();
    const [c] = importer_conversations(resultat.conversations);
    expect(c.id).toBe('gemini:abc123');
    expect(c.titre).toBe('Mon projet');
    expect(c.plateforme).toBe('gemini');
    expect(c.messages.map(m => m.role)).toEqual(['user', 'assistant']);
    expect(c.messages[1].contenu).toBe('Voici :\nconst a = 1;\nconst b = 2;');
    expect(c.url).toBe('https://gemini.google.com/u/1/app/abc123');
    expect(resultat.note).toContain('dates correspondent à la collecte');
  });
  it('refuse les pages sans fil enregistré et les réponses en cours', () => {
    page('', 'https://gemini.google.com/app');
    expect(collecter_gemini().erreur).toContain('conversation enregistrée');
    page('<div id="chat-history"><div aria-busy="true"></div></div>');
    expect(collecter_gemini().erreur).toContain('termine sa réponse');
  });
  it('signale une interface modifiée ou un mauvais domaine sans résultat inventé', () => {
    page('<div id="chat-history"><p>Bienvenue</p></div>');
    expect(collecter_gemini().erreur).toContain('Aucun message');
    page('', 'https://example.com/app/abc');
    expect(collecter_gemini().erreur).toContain('gemini.google.com');
  });
});
