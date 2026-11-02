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

  // Configuration Supabase
  "La connexion à Supabase n'est pas configurée. Crée un fichier .env.local à partir de .env.example, puis renseigne VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY avec les valeurs de ton projet Supabase.": 'The Supabase connection is not configured. Create a .env.local file from .env.example, then fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY with your Supabase project values.',
  'Configuration requise': 'Configuration required', 'Une erreur inattendue est survenue.': 'An unexpected error occurred.', 'Recharge la page': 'Reload the page',
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
