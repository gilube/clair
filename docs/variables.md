# Vocabulaire du projet Clair

Les noms métier suivent le français en snake_case. Les champs des exports externes sont convertis à l’import. Les API React, Chrome et Transformers conservent leurs propres conventions.

- `conversation` : entrée persistée ; identifiant, titre, plateforme, dates ISO, messages, tags, dossier, favori et URL d’origine.
- `message` : rôle `user`, `assistant` ou `system`, identifiant stable et contenu textuel. Une conversation conserve l’ordre de ses messages.
- `plateforme` : origine `chatgpt`, `claude`, `gemini`, `deepseek`, `mistral` ou `autre`.
- `requete` : texte de recherche, sans unité ; une valeur vide affiche la bibliothèque.
- `mode_recherche` : `lexicale`, `semantique` ou `hybride`. Le mode sémantique nécessite le modèle effectivement chargé.
- `filtres` : plateformes sélectionnées, bornes de dates inclusives, dossier, tag et favoris. Les dates filtrent la date de dernière mise à jour de la conversation, en heure locale.
- `resultat` : conversation, passages correspondants, score, rang et origine de la correspondance.
- `score_lexical` : score BM25 calculé sur les passages ; le titre reçoit une pondération supplémentaire. Sert au classement, pas à une probabilité.
- `vecteur` : embedding normalisé d’un passage, produit localement par le modèle multilingue ; dimension fournie par le modèle.
- `score_semantique` : produit scalaire de deux embeddings normalisés, dans [-1,1], sans unité.
- `score_hybride` : fusion réciproque des rangs lexicaux et sémantiques, constante 60, poids égaux. Sert au classement, pas à un pourcentage de certitude.
- `passage` : fragment textuel d’un message, avec début et fin dans le texte ; unité de recherche et d’indexation sémantique.
- `progression_modele` : phase de téléchargement ou d’indexation et compteur de passages traités. Aucun modèle n’est téléchargé avant activation explicite.
- `origine_bibliotheque` : `demo` ou `personnelle`. Les exemples sont remplacés au premier import personnel, pour ne pas mélanger les deux bibliothèques.
- `collection` : nom et filtres enregistrés, persistés localement.

Ordre de calcul : import et validation → stockage IndexedDB → création des passages → index lexical ; activation facultative du modèle → embeddings → filtres → classement du mode choisi → regroupement par conversation → affichage du contexte. Les embeddings sont mis en cache par empreinte du texte et version du modèle.
