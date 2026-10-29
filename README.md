# Clair — Votre mémoire IA

Première implémentation indépendante inspirée des fonctions observées dans Threadback. Application React/TypeScript locale, avec une bibliothèque en pleine page et une variante extension Chrome Manifest V3.

## Démarrer

```sh
npm install
npm run dev
```

Ouvrir l’adresse locale affichée par Vite. Les binaires ONNX nécessaires au navigateur sont copiés depuis les dépendances installées par `prepare-runtime.mjs`. Aucun serveur de conversations ni clé API n’est requis.

## Fonctionnalités

- Bibliothèque à trois zones : navigation, résultats et lecteur de conversations. Sur petit écran, le lecteur s’ouvre séparément et peut être refermé.
- Recherche lexicale BM25 avec normalisation des accents, pondération du titre et extraits contextualisés.
- Recherche sémantique réelle, facultative, avec `Xenova/paraphrase-multilingual-MiniLM-L12-v2` via Transformers.js dans un worker WASM. Activation explicite : téléchargement initial du modèle, puis calcul et cache locaux. Le seuil de similarité est un paramètre de la première version, pas une mesure de confiance.
- Recherche hybride par fusion réciproque des rangs (constante 60).
- Plateformes multiples, périodes rapides et dates personnalisées inclusives, dossiers, tags, favoris et collections de recherches enregistrées.
- Import JSON Clair v1, Threadback jusqu’à v3, export ChatGPT `conversations.json` et export Claude. Les messages textuels sont importés ; les pièces jointes binaires ne le sont pas. ChatGPT conserve la branche active du fil.
- Export de bibliothèque en JSON, collections comprises ; export individuel en Markdown.
- Persistance IndexedDB et cache d’embeddings par empreinte du texte. Le premier import remplace les données de démonstration. Les imports suivants fusionnent les identifiants et conservent l’organisation utilisateur.

Le modèle est téléchargé depuis Hugging Face. Les contenus des conversations ne sont pas envoyés à une API d’inférence. Le stockage dépend du navigateur et de son origine : une autre adresse, un autre port ou l’extension possède une bibliothèque distincte. Exportez régulièrement une sauvegarde.

## Extension Chrome

```sh
npm run build:extension
```

Dans `chrome://extensions`, activer le mode développeur puis charger le dossier **dist-extension** comme extension non empaquetée. L’icône ouvre l’espace de travail. Raccourci proposé : `⌘⇧K` sur Mac, `Ctrl+Shift+K` ailleurs ; il peut être modifié dans les raccourcis d’extensions.

Les connecteurs ChatGPT et Claude sont expérimentaux : ils demandent un onglet connecté, ne démarrent qu’au clic sur Synchroniser et lisent au plus 50 conversations récentes. Ils ne parcourent pas encore tout l’historique et ne synchronisent pas automatiquement en arrière-plan. Claude utilise la première organisation retournée par la session. Les API privées peuvent évoluer. Leur fonctionnement avec des comptes réels n’est pas certifié par les tests de cette première version. Les erreurs de session et de format sont affichées, et les conversations déjà stockées ne sont pas effacées en cas d’échec. L’import JSON est le parcours principal vérifiable sans accès à un compte personnel.

L’extension demande l’accès aux domaines ChatGPT, Claude et Gemini pour cette collecte et à Hugging Face pour les fichiers du modèle. Elle utilise des scripts et des runtimes WASM inclus dans son propre paquet ; elle n’a pas de serveur distant de données utilisateur.

## Vérifier et construire

```sh
npm test
npm run build
npm run build:extension
```

Les tests couvrent le classement et la fusion, la recherche avec accents, les bornes de dates, les imports multi-formats, la branche active ChatGPT, la restauration des collections, la conservation des métadonnées et la séparation du cache vectoriel et de la bibliothèque.

La version navigateur produite dans `dist/` se sert avec `npm run preview`. Il faut une origine HTTP locale ou HTTPS ; une ouverture directe en `file://` ne permet pas les workers et le stockage de manière fiable.

## Organisation du code

- `src/App.tsx`, `src/components.tsx`, `src/style.css` : interface et parcours de lecture.
- `src/model.ts`, `docs/variables.md` : modèle canonique et vocabulaire métier.
- `src/search.ts` : passages, BM25, filtres, fusion et surlignage.
- `src/importer.ts`, `src/storage.ts` : validation, import/export et persistance.
- `src/semantic.worker.ts`, `src/useSemantic.ts` : inférence et protocole asynchrone.
- `src/extension/background.ts` : ouverture de l’espace et collecte déclenchée par l’utilisateur.

## Limites et suite

Cette version ne remplace pas encore tous les connecteurs de Threadback. Les prochaines étapes sont la validation des deux collecteurs, la pagination complète avec reprise et progression, les tests sur de gros historiques, puis les autres plateformes. La pertinence sémantique doit être évaluée sur des requêtes utilisateur représentatives. Les vecteurs sont parcourus linéairement dans cette version ; une bibliothèque très volumineuse nécessitera un index vectoriel adapté.

Le code tiers est fourni par les paquets npm et conserve ses licences respectives (React, Vite, Transformers.js, ONNX Runtime, idb, Lucide). Les poids du modèle sont distribués séparément par leur éditeur sur Hugging Face. Aucun code propriétaire de Threadback n’est intégré à l’application.

### Gemini

Dans l’extension Chrome, ouvrez un fil enregistré sur gemini.google.com, attendez la fin de la réponse, puis choisissez Synchroniser → Gemini. Seul le texte des messages chargés du fil ouvert est lu, sans appel à une API distante. Remontez le fil dans Gemini pour charger les anciens messages avant la collecte. Les dates indiquent la collecte, car la page ne fournit pas les dates historiques. Une collecte plus courte que la copie locale est refusée pour éviter de la tronquer. Ce connecteur dépend de la structure de la page et reste expérimental, sans validation sur compte réel. Rechargez l’extension après sa reconstruction pour activer la nouvelle permission Gemini.
