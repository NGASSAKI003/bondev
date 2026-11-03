import { useSyncExternalStore } from 'react'

export type Lang = 'fr' | 'en'
const KEY = 'bondev-lang'
let lang: Lang = (() => {
  try { const v = localStorage.getItem(KEY); if (v === 'fr' || v === 'en') return v } catch { /* ignore */ }
  return navigator.language?.startsWith('en') ? 'en' : 'fr'
})()
const subs = new Set<() => void>()

export const getLang = (): Lang => lang

// Dictionnaire français -> anglais. Pour ajouter une phrase : « texte français » : 'English text'.
const EN: Record<string, string> = {
  'Ensemble, on va plus loin': 'Together, we go further', 'Trouve. Partage. Avance.': 'Find. Share. Grow.',
  "Logo Bondev, deux personnes qui s'entraident": 'Bondev logo, two people helping each other',
  'Passer au thème clair': 'Switch to light theme', 'Passer au thème sombre': 'Switch to dark theme',
  'Clair': 'Light', 'Sombre': 'Dark',
  'Continuer avec GitHub': 'Continue with GitHub', 'Continuer avec Google': 'Continue with Google', 'Utiliser mon email': 'Use my email',
  'Accueil': 'Home', 'Entraide': 'Help', 'Ajouter': 'Add', 'Profil': 'Profile', 'Mon profil': 'My profile', 'États': 'States', 'Voir les états': 'See states',
  'Bonjour, Amadou': 'Hello, Amadou', 'Que veux-tu': 'What do you want to', 'construire ?': 'build?',
  'Décris ton besoin : ex. gérer le stock d’une boutique': 'Describe your need: e.g. manage a shop’s stock',
  '✦ Recherche intelligente : décris ton besoin avec tes mots': '✦ Smart search: describe your need in your own words',
  'Gestion de stock': 'Stock management', 'Fonctionne hors-ligne': 'Works offline', 'Faible connexion': 'Low connection',
  'Projets récents': 'Recent projects', 'Tout voir': 'See all', 'Étoiles montantes': 'Rising stars',
  'Gestion de stock pour petites boutiques': 'Stock management for small shops', 'Intégration Mobile Money MTN et Airtel': 'MTN and Airtel Mobile Money integration',
  'Formulaires qui marchent sans connexion': 'Forms that work without a connection',
  'Suivre les produits, les ventes et les alertes de stock.': 'Track products, sales and stock alerts.', 'Accepter facilement les paiements sur le web.': 'Easily accept payments on the web.',
  '3 projets trouvés': '3 projects found', 'Filtres': 'Filters', 'Contexte africain': 'African context', 'Technologie': 'Technology',
  'Voir le projet': 'View project', 'Pourquoi ce projet :': 'Why this project:', '✦ Bondev a compris :': '✦ Bondev understood:',
  'tu cherches une solution pour accepter des paiements Mobile Money (MTN, Airtel) sur le web.': 'you are looking for a way to accept Mobile Money payments (MTN, Airtel) on the web.',
  'Résultats choisis parmi les projets du catalogue.': 'Results chosen from the catalogue projects.',
  'Le paiement Mobile Money fait partie de ses fonctions.': 'Mobile Money payment is one of its features.', 'Il gère MTN et Airtel avec une licence libre.': 'It handles MTN and Airtel with an open licence.', 'Il marche aussi quand la connexion est faible.': 'It also works when the connection is weak.',
  'Rien ne convient ?': 'Nothing fits?', 'Demander de l’aide': 'Ask for help', 'Fermer': 'Close', 'Retour': 'Back', 'Choisir': 'Choose',
  'Lien GitHub': 'GitHub link', 'Titre du projet': 'Project title',
  'Technologies (séparées par des virgules)': 'Technologies (comma-separated)',
  'Tags (séparés par des virgules)': 'Tags (comma-separated)',
  'Utilisé par': 'Used by', 'Ça m’a servi ✓': 'This helped me ✓',
  'Questions ouvertes': 'Open questions', 'La communauté': 'The community', 'Poser ma question': 'Ask my question', 'Poser ma question gratuite': 'Ask my free question', '(1 restante cette semaine)': '(1 left this week)',
  'Erreur lors du paiement Mobile Money': 'Error during Mobile Money payment', 'Comment héberger mon API Node ?': 'How do I host my Node API?',
  'Je peux aider': 'I can help', 'Cette semaine': 'This week', 'Débutant bienvenu · +1 bonus mentor': 'Beginners welcome · +1 mentor bonus',
  'Voir la question': 'View question', 'Retour aux questions': 'Back to questions', '2 réponses': '2 answers', 'Triées par Utile ✓': 'Sorted by Useful ✓', 'Utile ✓': 'Useful ✓',
  'Répondre simplement': 'Reply simply', 'Réponse ouverte': 'Reply opened', 'Merci ! 1 point a été transféré à Koffi.': 'Thank you! 1 point was transferred to Koffi.',
  'Vérifie d’abord le format international du numéro, puis journalise le code reçu par l’API.': 'First check the international format of the number, then log the code returned by the API.',
  'Le mode test utilise parfois un numéro différent de celui de production.': 'Test mode sometimes uses a different number than production.',
  'Preuve : lien GitHub (issue, pull request), facultatif': 'Proof: GitHub link (issue, pull request), optional',
  'Aucune demande pour le moment.': 'No requests for now.', 'Tout est calme': 'All quiet', 'Reviens bientôt pour aider.': 'Come back soon to help.', 'Voir les demandes': 'See requests',
  'Où es-tu bloqué ?': 'Where are you stuck?', 'Explique simplement': 'Explain simply', 'Ta question': 'Your question',
  'Ex. Mon paiement Mobile Money affiche une erreur…': 'E.g. My Mobile Money payment shows an error…', 'Lien GitHub de ton projet (facultatif)': 'Your project’s GitHub link (optional)',
  'Les points offerts sont mis de côté et donnés à la personne qui t’aide quand tu valides sa réponse. Si personne ne t’aide en 7 jours, ils te sont rendus.': 'The points offered are set aside and given to the person who helps you when you validate their answer. If nobody helps within 7 days, they are returned to you.',
  'Question publiée': 'Question published', 'Question envoyée': 'Question sent', 'La communauté va bientôt te répondre.': 'The community will answer you soon.',
  'Pas de souci': 'No worries', 'Tu peux quand même demander de l’aide.': 'You can still ask for help.', 'Gagne des points en 2 minutes': 'Earn points in 2 minutes',
  'Répondre à une question débutant': 'Answer a beginner question', 'Partager un projet': 'Share a project', 'Compléter ton profil': 'Complete your profile', 'Un développeur peut t’aider.': 'A developer can help you.',
  'Que veux-tu ajouter ?': 'What do you want to add?', 'Poser une question': 'Ask a question', 'Demande un coup de main': 'Ask for a hand', 'Aide la communauté à avancer': 'Help the community move forward',
  'Développeur full-stack · Dakar': 'Full-stack developer · Dakar', 'Solde': 'Balance', 'Total gagné': 'Total earned', 'Niveau': 'Level', 'Encore 6 points pour le niveau 5': '6 more points to reach level 5',
  'Mes badges': 'My badges', 'Langue': 'Language', 'Premier coup de main': 'First helping hand', 'Bienveillant': 'Kind', 'Nouvelle voix': 'New voice', 'Première réponse': 'First answer',
  'd’aide données': 'of help given', 'projets partagés': 'projects shared', 'Spécialités': 'Specialties', 'Mes points': 'My points', 'Historique des points': 'Points history',
  'Aide donnée à Fatou': 'Help given to Fatou', 'Aujourd’hui': 'Today', '12 juin': '12 June', '8 juin': '8 June', 'Il y a 2 jours': '2 days ago', 'Il y a 5 jours': '5 days ago', 'Il y a 1 semaine': '1 week ago',
  'Niveau 1': 'Level 1', 'Niveau 2': 'Level 2', 'Niveau 3': 'Level 3', 'Niveau 4': 'Level 4', 'points disponibles': 'points available', '34 gagnés au total': '34 earned in total', 'Projet partagé': 'Project shared',
  'Hors-ligne': 'Offline', 'En ligne': 'Online', '· Tes demandes partiront dès que le réseau revient.': '· Your requests will be sent as soon as the network is back.',
  'Garder le menu ouvert': 'Keep menu open', 'Réduire le menu': 'Collapse menu', 'Navigation principale': 'Main navigation',

  // Connexion, session et profil réel
  'Chargement…': 'Loading…', 'Chargement de ta session…': 'Loading your session…',
  'Vérifie ta boîte mail': 'Check your inbox', 'Envoie un lien de connexion à ton adresse email.': 'Send a sign-in link to your email address.',
  'Ton adresse email': 'Your email address', 'Envoyer le lien': 'Send the link', 'Envoi…': 'Sending…',
  'Le lien peut prendre une minute. Pense à vérifier tes spams.': 'The link may take a minute. Remember to check your spam folder.',
  'Utiliser une autre adresse': 'Use another address', 'Se déconnecter': 'Sign out', 'Déconnexion…': 'Signing out…',
  'Profil indisponible': 'Profile unavailable', 'Réessayer': 'Try again', 'Points indisponibles': 'Points unavailable',
  'Chargement de l’historique…': 'Loading history…', 'Aucun mouvement pour le moment.': 'No movement yet.',
  'Niveau maximal atteint': 'Highest level reached', 'gagnés au total': 'earned in total', 'Bonjour,': 'Hello,',
  'La langue a changé sur cet appareil, mais n’a pas pu être enregistrée.': 'The language changed on this device, but could not be saved.',

  // Niveaux renvoyés par la base
  'Étincelle': 'Spark', 'Explorateur': 'Explorer', 'Bâtisseur': 'Builder', 'Maître': 'Master', 'Légende': 'Legend',

  // Raisons du registre de points
  'Bonus d’inscription': 'Sign-up bonus', 'Points mis de côté': 'Points set aside', 'Récompense reçue': 'Reward received',
  'Remboursement': 'Refund', 'Publication d’un projet': 'Project published', 'Projet jugé utile': 'Project found useful',
  'Question gratuite': 'Free question', 'Mouvement de points': 'Points movement',

  // Messages d'erreur traduits par l'API
  'Ta session a expiré. Reconnecte-toi.': 'Your session expired. Please sign in again.',
  'Impossible de contacter le serveur. Vérifie ta connexion et réessaie.': 'Cannot reach the server. Check your connection and try again.',
  'Trop de tentatives. Patiente un moment avant de réessayer.': 'Too many attempts. Wait a moment before trying again.',
  'Cette information est déjà utilisée.': 'This information is already in use.',
  'Tu n’as pas le droit de faire cette action.': 'You are not allowed to do this action.',
  'Cette adresse email n’est pas valide.': 'This email address is not valid.',
  'Ce lien de connexion n’est pas valide ou a expiré. Demande-en un nouveau.': 'This sign-in link is invalid or has expired. Request a new one.',
  'Ce mode de connexion n’est pas activé. Choisis une autre méthode.': 'This sign-in method is not enabled. Choose another one.',
  'La création de compte est désactivée pour le moment.': 'Account creation is disabled for now.',
  'Un compte existe déjà avec cette adresse email.': 'An account already exists with this email address.',
  'Confirme ton adresse email avant de te connecter.': 'Confirm your email address before signing in.',
  'Une erreur est survenue. Réessaie dans un instant.': 'Something went wrong. Try again in a moment.',
  'Ce pseudo est déjà pris. Essaie un autre.': 'This username is already taken. Try another one.',
  'Le pseudo doit contenir entre 3 et 30 caractères (lettres, chiffres, _ ou -).': 'The username must be 3 to 30 characters long (letters, digits, _ or -).',
  'Le nom affiché ne doit pas dépasser 80 caractères.': 'The display name must not exceed 80 characters.',
  'La bio ne doit pas dépasser 500 caractères.': 'The bio must not exceed 500 characters.',
  'Le lien doit commencer par https://.': 'The link must start with https://.',
  'Le lien GitHub doit pointer vers github.com.': 'The GitHub link must point to github.com.',
  'La langue choisie n’est pas valide.': 'The selected language is not valid.',
  'Aucune modification à enregistrer.': 'There is nothing to save.',
  'Ton profil est introuvable. Reconnecte-toi.': 'Your profile cannot be found. Please sign in again.',
  'Tes statistiques ne sont pas encore disponibles. Reconnecte-toi.': 'Your stats are not available yet. Please sign in again.',
  'Impossible de créer ton profil : ce pseudo est déjà utilisé. Réessaie dans un instant.': 'Could not create your profile: this username is already taken. Try again in a moment.',
  'Impossible de te déconnecter pour le moment. Vérifie ta connexion et réessaie.': 'Could not sign you out right now. Check your connection and try again.',

  // Catalogue et recherche
  'Catalogue': 'Catalogue', 'Projet': 'Project', 'Exemple': 'Example',
  'Licence': 'License', 'Dernière activité': 'Last activity',
  'Dernière mise à jour :': 'Last update:',
  'Le catalogue est affiché depuis cet appareil.': 'The catalogue is shown from this device.',
  'Le catalogue est indisponible': 'The catalogue is unavailable',
  'Aucun projet pour le moment': 'No projects yet',
  'Partage le premier projet avec la communauté.': 'Share the first project with the community.',
  'Réinitialiser': 'Reset', 'Réinitialiser les filtres': 'Reset filters', 'Aucune option': 'No option',
  'Aucun projet ne correspond à ces filtres': 'No projects match these filters',
  'Retire un filtre ou essaie une autre combinaison.': 'Remove a filter or try another combination.',
  'Rien ne correspond pour l’instant': 'Nothing matches yet',
  'Essaie des mots plus simples, ou demande de l’aide à un développeur.': 'Try simpler words, or ask a developer for help.',
  'Pas encore de description.': 'No description yet.',
  'Licence non précisée': 'No licence',
  'Projet introuvable': 'Project not found',
  'Il a peut-être été retiré du catalogue.': 'It may have been removed from the catalogue.',
  'Retour aux résultats': 'Back to results',
  'Voir le dépôt': 'View repository', 'Enregistrement…': 'Saving…', 'Déjà marqué ✓': 'Already marked ✓',
  'Connecte-toi pour dire que ce projet t’a servi.': 'Sign in to say that this project helped you.',
  'C’est ton projet : seul un autre développeur peut le marquer comme utile.': 'This is your project: another developer must mark it as useful.',
  'Merci ! Ton clic a déjà été compté.': 'Thanks! Your click has already been counted.',
  'Un dépôt public suffit': 'A public repository is enough',
  'Présente ton projet': 'Present your project',
  'Ex. Gestion de stock pour petites boutiques': 'E.g. Stock management for small shops',
  'Explique ce que fait le projet et à qui il sert.': 'Explain what the project does and who it helps.',
  'Les champs remplis depuis GitHub restent modifiables.': 'The fields filled from GitHub stay editable.',
  'Projet publié !': 'Project published!', 'Voir le catalogue': 'See the catalogue', 'Retour à l’accueil': 'Back home',
  'Dernière activité sur GitHub :': 'GitHub last activity:',
  'Ce dépôt est déjà dans le catalogue.': 'This repository is already in the catalogue.',
  'Tu as déjà marqué ce projet comme utile.': 'You have already marked this project as useful.',
  'Impossible de marquer ton propre projet comme utile.': 'You cannot mark your own project as useful.',
  'Ce projet a atteint son plafond de « Ça m’a servi » cette semaine. Réessaie la semaine prochaine.': 'This project has reached its “This helped me” limit this week. Try again next week.',
  'Lien GitHub invalide. Utilise le format https://github.com/pseudo/depot.': 'Invalid GitHub link. Use the format https://github.com/username/repository.',
  'Le titre doit contenir entre 5 et 200 caractères.': 'The title must be between 5 and 200 characters long.',
  'La description ne doit pas dépasser 5000 caractères.': 'The description must not exceed 5000 characters.',
  'Le nom de la licence est trop long.': 'The licence name is too long.',
  'Le projet a été publié, mais sa fiche n’est pas encore disponible. Recharge le catalogue.': 'The project was published, but its page is not available yet. Reload the catalogue.',
  'Ce projet n’existe plus dans le catalogue.': 'This project is no longer in the catalogue.',
  'Les informations envoyées ne sont pas valides. Vérifie le titre, le lien et les listes.': 'The information sent is invalid. Check the title, link and lists.',
  'Cette action n’est pas encore disponible. Vérifie que les migrations Supabase sont à jour.': 'This action is not available yet. Check that the Supabase migrations are up to date.',
  'Le catalogue n’est pas encore disponible. Vérifie que les migrations Supabase ont été exécutées.': 'The catalogue is not available yet. Check that the Supabase migrations have been run.',
  'Ce dépôt GitHub est introuvable. Vérifie le lien ou qu’il est public.': 'This GitHub repository cannot be found. Check the link or that it is public.',
  'GitHub limite temporairement les demandes. Patiente quelques minutes ou remplis les champs à la main.': 'GitHub is temporarily limiting requests. Wait a few minutes or fill in the fields manually.',
  'Impossible de contacter GitHub. Vérifie ta connexion ou remplis les champs à la main.': 'Cannot reach GitHub. Check your connection or fill in the fields manually.',
  'GitHub n’a pas pu répondre. Réessaie dans un instant ou remplis les champs à la main.': 'GitHub could not respond. Try again in a moment or fill in the fields manually.',
  'La réponse de GitHub est illisible. Remplis les champs à la main.': 'The GitHub response is unreadable. Fill in the fields manually.',
  'GitHub n’a pas renvoyé les informations du dépôt. Remplis les champs à la main.': 'GitHub did not return the repository information. Fill in the fields manually.',
  'Impossible de récupérer ce dépôt pour le moment. Remplis les champs à la main.': 'Cannot fetch this repository right now. Fill in the fields manually.',

  // Configuration Supabase
  "La connexion à Supabase n'est pas configurée. Crée un fichier .env.local à partir de .env.example, puis renseigne VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY avec les valeurs de ton projet Supabase.": 'The Supabase connection is not configured. Create a .env.local file from .env.example, then fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY with your Supabase project values.',
  'Configuration requise': 'Configuration required', 'Une erreur inattendue est survenue.': 'An unexpected error occurred.', 'Recharge la page': 'Reload the page',

  // Entraide : liste, fil, réponses et formulaire
  'Ouvertes': 'Open', 'Résolues': 'Solved', 'Mes questions': 'My questions',
  'Débutant bienvenu': 'Beginners welcome', 'Toutes les technologies': 'All technologies',
  'Les questions de la communauté': 'Community questions',
  'Coup de pouce': 'Quick help', 'Aide moyenne': 'Medium help', 'Gros coup de main': 'Big helping hand',
  'Résolue': 'Solved', 'Expirée': 'Expired', 'Retirée': 'Withdrawn',
  'Réponse validée d’abord': 'Validated answer first', 'Pas encore de réponse. Ton aide peut débloquer cette question.': 'No answers yet. Your help could unblock this question.',
  'Retirer ma question': 'Withdraw my question', 'Traitement…': 'Working…',
  'Modifier': 'Edit', 'Supprimer': 'Delete', 'Annuler': 'Cancel', 'Enregistrer': 'Save',
  'Ta réponse': 'Your answer', 'Envoyer ma réponse': 'Send my answer', 'Voir la preuve': 'View proof',
  'Voir le lien GitHub': 'View the GitHub link', 'Preuve : lien GitHub (facultatif)': 'Proof: GitHub link (optional)',
  'Ton brouillon est enregistré sur cet appareil.': 'Your draft is saved on this device.',
  'L’envoi est désactivé tant que tu es hors-ligne.': 'Sending is disabled while you are offline.',
  'C’est ta question : choisis la réponse qui t’a le plus aidé.': 'This is your question: choose the answer that helped you most.',
  'Connecte-toi pour répondre': 'Sign in to answer', 'Tu peux lire la conversation maintenant. Connecte-toi quand tu veux aider.': 'You can read the conversation now. Sign in when you want to help.',
  'Les questions sont indisponibles': 'The questions are unavailable', 'Cette question est indisponible': 'This question is unavailable',
  'Question introuvable': 'Question not found', 'Elle a peut-être été retirée ou supprimée.': 'It may have been withdrawn or deleted.',
  'Tu n’as pas encore posé de question': 'You have not asked a question yet', 'Aucune question résolue pour le moment': 'No solved questions yet',
  'Aucune question ouverte pour le moment': 'No open questions right now', 'Demande de l’aide : la communauté peut te débloquer.': 'Ask for help: the community can unblock you.',
  'Dès qu’une réponse est validée, elle apparaîtra ici.': 'As soon as an answer is validated, it will appear here.',
  'Sois le premier à demander, ou reviens bientôt aider quelqu’un.': 'Be the first to ask, or come back soon to help someone.',
  'Technologie non précisée': 'No technology specified', 'Titre de la question': 'Question title',
  'Ex. Mon paiement Mobile Money affiche une erreur': 'E.g. My Mobile Money payment returns an error',
  'Qu’as-tu essayé ? Quel message d’erreur vois-tu ?': 'What did you try? What error do you see?',
  'Sépare les technologies par des virgules.': 'Separate technologies with commas.',
  'Choisis ton palier d’aide': 'Choose your help level',
  'Une question reste ouverte 7 jours. Les points sont mis de côté et rendus si personne ne t’aide.': 'A question stays open for 7 days. Points are set aside and refunded if nobody helps.',
  'Lien GitHub (facultatif)': 'GitHub link (optional)',
  'Un débutant peut répondre et gagner un bonus mentor.': 'A beginner can answer and earn a mentor bonus.',
  'Ton solde après publication': 'Your balance after posting', 'Solde insuffisant': 'Not enough points',
  'Question gratuite disponible': 'Free question available', 'Ta question gratuite est encore disponible': 'Your free question is still available',
  'Choisir Coup de pouce (1 point)': 'Choose Quick help (1 point)',
  'Ta question gratuite est déjà utilisée cette semaine. Deux façons rapides de gagner des points :': 'Your free question is already used this week. Two quick ways to earn points:',
  'Vérification de ta question gratuite…': 'Checking whether your free question is available…',
  'Publier ma question': 'Publish my question', 'Poser ma question gratuite (1 restante cette semaine)': 'Ask my free question (1 left this week)',
  'Ton brouillon est enregistré sur cet appareil et effacé après publication.': 'Your draft is saved on this device and removed after publishing.',
  'Hors-ligne : les envois sont désactivés. Tes brouillons restent sur cet appareil.': 'Offline: sending is disabled. Your drafts stay on this device.',
  'Hors-ligne : la publication est désactivée. Ton brouillon reste sur cet appareil.': 'Offline: posting is disabled. Your draft stays on this device.',

  // Erreurs de l’Entraide
  'Solde insuffisant. Choisis un palier plus petit ou utilise ta question gratuite.': 'Not enough points. Choose a smaller level or use your free question.',
  'Tu as déjà 10 questions ouvertes. Attends qu’une se termine ou retire-en une.': 'You already have 10 open questions. Wait for one to end or withdraw one.',
  'Une réponse a déjà été validée pour cette question.': 'An answer has already been validated for this question.',
  'Seul l’auteur de la question peut valider une réponse.': 'Only the question author can validate an answer.',
  'Tu ne peux pas valider ta propre réponse.': 'You cannot validate your own answer.',
  'Cette réponse n’est plus disponible.': 'This answer is no longer available.',
  'Cette question n’est plus ouverte.': 'This question is no longer open.',
  'Impossible de retirer une question dont une réponse a déjà été validée.': 'You cannot withdraw a question whose answer has already been validated.',
  'Seul l’auteur peut retirer sa question.': 'Only the author can withdraw their question.',
  'Cette question n’existe plus.': 'This question no longer exists.', 'Cette réponse n’existe plus.': 'This answer no longer exists.',
  'Choisis un palier valide : 1, 3 ou 6 points.': 'Choose a valid level: 1, 3 or 6 points.',
  'Connecte-toi pour faire cette action.': 'Sign in to do this action.',
  'Le lien GitHub doit commencer par https://github.com/.': 'The GitHub link must start with https://github.com/.',
  'Le titre doit contenir entre 5 et 300 caractères.': 'The title must be between 5 and 300 characters long.',
  'Décris ton blocage en quelques mots.': 'Describe what is blocking you in a few words.',
  'La description ne doit pas dépasser 10 000 caractères.': 'The description must not exceed 10,000 characters.',
  'Choisis au moins une technologie.': 'Choose at least one technology.',
  'La question a été publiée, mais son fil n’est pas encore disponible. Recharge l’Entraide.': 'The question was published, but its thread is not available yet. Reload Help.',
  'Écris une réponse avant d’envoyer.': 'Write an answer before sending.',
  'La réponse ne doit pas dépasser 10 000 caractères.': 'The answer must not exceed 10,000 characters.',
  'La réponse a été envoyée, mais elle n’est pas encore visible. Recharge la question.': 'The answer was sent, but it is not visible yet. Reload the question.',
  'Tu ne peux modifier que tes propres réponses.': 'You can only edit your own answers.',
  'Cette réponse a déjà été validée : elle ne peut plus être modifiée.': 'This answer has already been validated: it can no longer be edited.',
  'Écris une réponse avant d’enregistrer.': 'Write an answer before saving.',
}

const txt = new WeakMap<Node, { fr: string; en: string }>()
const ATTRS = ['placeholder', 'aria-label', 'alt', 'title']
const attrs = new WeakMap<Element, Record<string, { fr: string; en: string }>>()
const tr = (fr: string) => { const k = fr.trim(); return lang === 'en' && EN[k] ? fr.replace(k, EN[k]) : fr }
let obs: MutationObserver | null = null

function apply() {
  obs?.disconnect()
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const v = n.nodeValue || ''; const r = txt.get(n)
    const fr = r && v === r.en ? r.fr : v; const en = tr(fr)
    if (en !== v) n.nodeValue = en
    txt.set(n, { fr, en })
  }
  document.body.querySelectorAll('[placeholder],[aria-label],[alt],[title]').forEach(el => {
    const m = attrs.get(el) ?? {}; attrs.set(el, m)
    for (const a of ATTRS) {
      const v = el.getAttribute(a); if (v === null) continue
      const r = m[a]; const fr = r && v === r.en ? r.fr : v; const en = tr(fr)
      if (en !== v) el.setAttribute(a, en)
      m[a] = { fr, en }
    }
  })
  obs?.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS })
}

export function startTranslator() {
  document.documentElement.lang = lang
  obs = new MutationObserver(apply)
  apply()
}
export function setLang(l: Lang) {
  lang = l
  try { localStorage.setItem(KEY, l) } catch { /* ignore */ }
  document.documentElement.lang = l
  subs.forEach(f => f()); apply()
}
export const useLang = () => useSyncExternalStore(f => { subs.add(f); return () => { subs.delete(f) } }, () => lang)

export function LangToggle({ onChange }: { onChange?: (l: Lang) => void } = {}) {
  const l = useLang()
  return (
    <div className="lang-toggle" role="group" aria-label="Langue">
      {(['fr', 'en'] as const).map(x => <button key={x} aria-pressed={l === x} onClick={() => { setLang(x); onChange?.(x) }}>{x.toUpperCase()}</button>)}
    </div>
  )
}
