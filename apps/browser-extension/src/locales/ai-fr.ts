import { PRODUCT_NAME } from '@writehand/contracts';
import type { AiText } from '@writehand/ui';

export const aiFr: AiText = {
  title: 'Connexion IA',
  description:
    'Rédigez vos e-mails avec votre forfait ChatGPT, votre propre clé API OpenAI ou Claude Code sur cet ordinateur.',
  chatgpt: 'Forfait ChatGPT',
  apiKey: 'Clé API OpenAI',
  claudeCode: 'Forfait Claude',
  methodHints: {
    chatgpt: 'Avec votre forfait Plus, Pro ou Business',
    'api-key': 'Paiement à l’usage',
    'claude-code': 'Avec Claude Code sur cet ordinateur',
  },
  methodLabel: 'Méthode de connexion',
  recommended: 'Recommandé',
  experimental: 'Expérimental',
  statusReady: 'Prêt',
  statusSetup: 'Installation requise',
  statusAction: 'Connexion requise',
  guide: {
    title: 'Guide de connexion',
    intro:
      'Configurez l’une des méthodes ci-dessous pour générer du texte. Chaque section indique ce qu’il vous faut et les étapes à suivre.',
    requirementsLabel: 'Il vous faut',
    stepsLabel: 'Étapes',
    notesLabel: 'Bon à savoir',
    current: 'Sélectionnée',
    methods: {
      chatgpt: {
        title: 'Forfait ChatGPT',
        summary: 'Génère du texte avec l’utilisation incluse dans votre forfait ChatGPT.',
        requirements: [
          'Un abonnement ChatGPT Plus ou Pro, ou un espace de travail Business, Enterprise ou Edu. Les comptes gratuits ne permettent pas l’utilisation du forfait.',
          `L’application d’assistance ${PRODUCT_NAME} sur cet ordinateur.`,
        ],
        steps: [
          'Choisissez « Forfait ChatGPT » comme méthode.',
          'Choisissez « Continue with ChatGPT ». Sur la page qui s’ouvre, choisissez votre compte et autorisez l’accès.',
          'Pour un espace de travail Business, Enterprise ou Edu, choisissez plutôt « Se connecter via Codex », puis l’espace de travail.',
          'Revenez sur cette page ; le compte indique « Connecté · Prêt à générer du texte ». Choisissez ensuite un modèle.',
        ],
        notes: [
          'L’utilisation est décomptée des limites de votre forfait ChatGPT. Vous pouvez la suivre dans ChatGPT → Paramètres → Usage.',
          'Si vous venez de changer de forfait, son activation peut prendre quelques minutes.',
          '« Continue with ChatGPT » prend actuellement en charge les forfaits Plus et Pro ; sur les comptes professionnels, une stratégie de l’organisation le bloque. « Se connecter via Codex » utilise à la place la connexion de l’application Codex d’OpenAI. Cette méthode est expérimentale : OpenAI ne la documente pas pour d’autres applications et peut la modifier.',
          'Avec « Se connecter via Codex », l’utilisation est décomptée des limites de votre forfait, que ChatGPT partage avec Codex et d’autres fonctions professionnelles. Dans les espaces de travail Business, des crédits permettent de continuer une fois la limite hebdomadaire atteinte ; les propriétaires de l’espace de travail les ajoutent dans les paramètres de facturation.',
          'Vous pouvez retirer l’accès à tout moment dans ChatGPT → Paramètres → Security and login → Sign in with ChatGPT.',
        ],
      },
      'api-key': {
        title: 'Clé API OpenAI',
        summary:
          'Génère du texte avec votre propre compte OpenAI Platform ; vous payez ce que vous utilisez.',
        requirements: [
          'Un compte OpenAI Platform et une clé API.',
          `L’application d’assistance ${PRODUCT_NAME} sur cet ordinateur.`,
        ],
        steps: [
          'Créez une clé API sur OpenAI Platform.',
          'Choisissez « Clé API OpenAI » comme méthode, collez la clé et choisissez « Connecter la clé ».',
          'Choisissez un modèle dans la liste.',
        ],
        notes: [
          'L’utilisation de l’API est distincte d’un abonnement ChatGPT et facturée par OpenAI.',
          'La clé est enregistrée uniquement dans l’application d’assistance de cet ordinateur et n’est jamais renvoyée au navigateur.',
        ],
        linkLabel: 'Créer une clé API',
      },
      'claude-code': {
        title: 'Forfait Claude',
        summary: 'Utilise Claude Code sur votre ordinateur avec votre propre compte Claude.',
        requirements: [
          'Un abonnement Claude Pro, Max, Team ou Enterprise.',
          'Claude Code installé sur cet ordinateur et connecté à votre compte Claude.',
          `L’application d’assistance ${PRODUCT_NAME}. Installée après Claude Code, elle le trouve automatiquement.`,
        ],
        steps: [
          'Installez Claude Code en suivant les instructions officielles d’Anthropic.',
          'Dans un terminal, exécutez `claude` et connectez-vous à votre compte Claude avec `/login`.',
          'Installez l’application d’assistance ; si elle était déjà installée, réinstallez-la après Claude Code.',
          'Choisissez « Forfait Claude » comme méthode. Votre compte et votre forfait s’affichent ici.',
        ],
        notes: [
          `${PRODUCT_NAME} ne voit ni n’enregistre votre mot de passe ou votre session Claude ; vous vous connectez et vous déconnectez via Claude Code.`,
          'L’utilisation est décomptée de la limite de votre forfait, partagée avec Claude Code.',
          'Avec les forfaits Pro et Max, le contenu peut servir à entraîner des modèles, sauf si vous l’avez désactivé dans vos paramètres de confidentialité Claude. Les forfaits Team et Enterprise relèvent des conditions commerciales.',
          'Si Claude Code est connecté avec une clé API, l’utilisation est facturée à ce compte API.',
          'Cette méthode dépend des règles d’Anthropic pour les applications tierces et est proposée à titre expérimental. Elle peut cesser de fonctionner si ces règles changent.',
        ],
        linkLabel: 'Guide d’installation de Claude Code',
      },
    },
    helper: {
      title: 'Qu’est-ce que l’application d’assistance ?',
      summary: 'Une petite application sur votre ordinateur, nécessaire à toutes les méthodes.',
      requirements: ['macOS, Linux ou Windows. Aucun autre logiciel n’est nécessaire.'],
      steps: [
        'Ouvrez l’assistant de configuration depuis Paramètres → Application d’assistance et exécutez la commande d’une ligne qu’il affiche.',
        'L’application d’assistance apparaît comme connectée en quelques secondes ; choisissez ensuite une méthode ici.',
      ],
      notes: [
        'Les informations de connexion et les clés API sont conservées dans un fichier protégé accessible à vous seul, pas dans le navigateur.',
        'L’application d’assistance ne s’exécute que lorsque vous demandez du texte ; elle ne lit ni n’envoie jamais d’e-mails en arrière-plan.',
      ],
    },
  },
  connect: 'Continue with ChatGPT',
  codexConnect: 'Se connecter via Codex',
  codexHint:
    'Pour les espaces de travail ChatGPT Business, Enterprise et Edu. Utilise la connexion de l’application Codex d’OpenAI ; Codex n’a pas besoin d’être installé. Expérimental.',
  codexSignIn: 'Connexion Codex',
  codexConnectionHelp:
    'Cette connexion utilise la connexion Codex. L’utilisation est décomptée des limites de votre forfait partagées avec Codex ; dans les espaces de travail Business, des crédits permettent de continuer une fois ces limites atteintes. Vous pouvez mettre fin à la session en supprimant le compte ici.',
  addAccount: 'Ajouter un autre compte ou espace de travail',
  reconnect: 'Se reconnecter',
  disconnect: 'Se déconnecter',
  account: 'Compte ChatGPT',
  activeAccount: 'Compte utilisé',
  useAccount: 'Utiliser ce compte',
  savedConnection: 'Compte connecté. Choisissez « Utiliser ce compte » pour générer avec lui.',
  renameAccount: 'Renommer',
  accountName: 'Nom de la connexion',
  accountNameHint:
    'Par exemple « Personnel » ou « Travail · Nom de l’entreprise ». Le nom reste sur cet appareil ; 80 caractères au maximum.',
  saveAccountName: 'Enregistrer le nom',
  removeAccount: 'Supprimer le compte',
  removeAccountTitle: 'Supprimer cette connexion ?',
  removeAccountBody:
    'L’enregistrement du compte et ses informations de connexion seront supprimés de cet appareil ; la révocation de la session OpenAI sera tentée si elle existe. Une connexion en cours sera annulée. Ajoutez à nouveau le compte pour l’utiliser plus tard. Votre compte ChatGPT ne sera pas supprimé.',
  confirmRemoveAccount: 'Supprimer',
  savedAccountHint:
    'Sélectionnez une connexion enregistrée pour la renommer ou la supprimer. Les boutons de connexion utilisent le compte et l’espace de travail de la connexion sélectionnée. Pour connecter un autre compte, utilisez le bouton d’ajout ci-dessous.',
  model: 'Modèle',
  refresh: 'Actualiser',
  checking: 'Vérification de la connexion…',
  signingIn: 'Terminez la connexion ChatGPT dans la fenêtre du navigateur.',
  cancel: 'Annuler',
  connected: 'Connecté · Prêt à générer du texte',
  disconnected: 'Déconnecté',
  registrationIncomplete:
    'La connexion du compte est incomplète ; ses informations n’ont pas encore été vérifiées. Réessayez « Continue with ChatGPT » avec le même compte et le même espace de travail que lors de la première tentative.',
  generationUnavailable:
    'Compte vérifié et autorisation du forfait accordée ; la génération de texte n’est pas encore prête. Choisissez « Actualiser » pour recharger la liste des modèles.',
  planDisabled:
    'Compte vérifié ; la génération n’est pas autorisée. L’utilisation du forfait nécessite un compte Plus ou Pro éligible et l’autorisation d’utiliser son forfait. Se connecter avec un compte gratuit ne donne pas accès à la génération.',
  planNote:
    'Les comptes Plus et Pro éligibles peuvent utiliser l’allocation de leur forfait avec « Continue with ChatGPT ». Pour les espaces de travail Business, Enterprise et Edu, utilisez « Se connecter via Codex ».',
  apiNote:
    'L’utilisation de l’API est facturée séparément par OpenAI. Elle est indépendante de votre abonnement ChatGPT ; cette méthode n’est jamais choisie automatiquement.',
  claudeNote: `Claude Code, installé sur cet ordinateur, s’exécute avec votre propre compte Claude ; l’utilisation est décomptée des limites de votre forfait Claude. ${PRODUCT_NAME} n’accède pas à vos identifiants Claude et ne les enregistre pas. Vous vous connectez et vous déconnectez via Claude Code.`,
  claudeAccount: 'Compte Claude Code',
  claudeNotInstalled:
    'Claude Code est introuvable sur cet ordinateur. Installez Claude Code, exécutez à nouveau la commande d’installation de l’application d’assistance, puis choisissez « Actualiser ».',
  claudeNotLoggedIn:
    'Claude Code n’est pas connecté. Exécutez claude dans un terminal, connectez-vous avec /login, puis choisissez « Actualiser ».',
  claudeApiBilling:
    'Claude Code est connecté avec une autre méthode qu’un abonnement Claude, par exemple une clé API ; l’utilisation est facturée à ce compte.',
  claudePrivacy:
    'Lorsque vous demandez une génération, votre texte, vos consignes et le contexte sélectionné sont envoyés à Anthropic via Claude Code. Claude Code s’exécute sans outils, n’a pas accès à vos fichiers et ne conserve aucune transcription de session. Les forfaits Pro et Max relèvent des conditions grand public d’Anthropic : sauf si vous avez désactivé l’entraînement des modèles dans vos paramètres de confidentialité Claude, le contenu peut servir à l’entraînement. Les forfaits Team et Enterprise relèvent des conditions commerciales.',
  apiKeyLabel: 'Clé API',
  saveKey: 'Connecter la clé',
  removeKey: 'Supprimer la clé',
  keySaved: 'Clé API enregistrée dans l’application d’assistance.',
  manageUsage: 'Gérer l’utilisation',
  connectionHelp:
    'Gérez cette connexion dans les paramètres ChatGPT, sous Security and login → Sign in with ChatGPT. Elle n’apparaît pas dans Plugins. Les comptes professionnels sont aussi soumis à la stratégie de l’organisation et à l’éligibilité du forfait.',
  welcome: 'Vous utilisez votre forfait ChatGPT',
  welcomeBody: `La génération éligible dans ${PRODUCT_NAME} utilise l’allocation de votre forfait ChatGPT ou les crédits disponibles. Gérez l’utilisation de cette application dans les paramètres ChatGPT.`,
  gotIt: 'Compris',
  privacy:
    'Lorsque vous demandez une génération, votre texte, vos consignes et le contexte sélectionné sont envoyés à OpenAI. L’extension ne les enregistre pas sur le disque. Elle n’a pas accès à l’historique de vos conversations ChatGPT.',
  usePlan: 'Forfait ChatGPT utilisé',
  useApi: 'API OpenAI utilisée',
  useClaude: 'Forfait Claude utilisé',
  openSettings: 'Paramètres IA',
  notReady: 'Connectez un compte IA pour générer du texte',
};
