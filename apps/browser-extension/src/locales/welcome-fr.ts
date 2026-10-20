import { PRODUCT_NAME } from '@writehand/contracts';

import type { WelcomeText } from './extension-text';

export const welcomeFr: WelcomeText = {
  title: `Bienvenue dans ${PRODUCT_NAME}`,
  subtitle: 'Prêt en quatre étapes courtes',
  stepsLabel: 'Étapes de configuration',
  steps: ['Bienvenue', 'Application', 'Connexion', 'Essai'],
  back: 'Retour',
  next: 'Continuer',
  intro: {
    title: 'Pourquoi une application d’assistance ?',
    lead: `${PRODUCT_NAME} fonctionne dans Outlook sur le web. Une petite application d’assistance sur votre ordinateur fait ce qu’une extension de navigateur ne peut pas faire seule.`,
    reasons: [
      'La connexion avec ChatGPT exige une adresse de retour sur votre ordinateur, qu’une extension ne peut pas fournir.',
      'Vos informations de connexion et vos clés API restent protégées sur votre ordinateur, pas dans le navigateur.',
      'Elle est open source : vous pouvez lire chaque ligne de son code.',
    ],
    source: 'Code source sur GitHub',
    doesTitle: 'Ce qu’elle fait',
    does: [
      'Envoie le texte que vous choisissez au fournisseur que vous choisissez, uniquement à votre demande.',
      'Conserve votre connexion à ChatGPT, OpenAI ou Claude.',
    ],
    doesNotTitle: 'Ce qu’elle ne fait jamais',
    doesNot: [
      'Envoyer des e-mails.',
      'Lire votre boîte aux lettres en arrière-plan.',
      'Envoyer quoi que ce soit à un serveur à nous : il n’y en a pas.',
    ],
  },
  install: {
    title: 'Installer l’application d’assistance',
    lead: 'Une seule commande l’installe pour votre compte utilisateur. Aucun droit d’administrateur n’est nécessaire.',
    system: 'Votre système',
    command: 'Commande d’installation',
    terminal: {
      darwin: 'Ouvrez Terminal (Applications → Utilitaires), collez la commande et appuyez sur Retour.',
      linux: 'Ouvrez un terminal (souvent Ctrl+Alt+T), collez la commande et appuyez sur Entrée.',
      windows:
        'Ouvrez PowerShell (clic droit sur Démarrer, puis Terminal), collez la commande et appuyez sur Entrée.',
    },
    waiting:
      'En attente de l’application d’assistance… Elle apparaît ici quelques secondes après la fin de la commande.',
    connected: (version) => `Application d’assistance connectée (version ${version}).`,
    whatTitle: 'Que fait la commande ?',
    what: [
      'Télécharge le programme adapté à votre système depuis la dernière version sur GitHub.',
      'Vérifie sa somme de contrôle SHA-256 et s’arrête si elle ne correspond pas.',
      'L’installe dans votre dossier utilisateur, sans droits d’administrateur.',
      'L’enregistre dans Firefox, Chrome, Edge et Brave pour que cette extension puisse la joindre.',
    ],
  },
  tryIt: {
    title: 'Essai',
    lead: 'Corrigez un e-mail inventé pour vérifier que tout fonctionne. Le texte ne va qu’au fournisseur choisi ; aucun e-mail n’est envoyé.',
    sampleLabel: 'E-mail d’exemple',
    sample:
      'Bonjour Sam,\n\nmerci pour ton message. Je peut envoyer le rapport jeudi, mais j’ai besoin d’abord des dernier chiffres de ton équipe. Tu pourrais les partager avant mercredi ?\n\nBonne journée,\nAlex',
    run: 'Corriger l’exemple',
    running: 'Correction…',
    success: 'Tout fonctionne. Ouvrez un brouillon dans Outlook ; la barre d’outils apparaît à côté.',
    resultLabel: 'Résultat',
    openOutlook: 'Ouvrir Outlook',
    personalOutlook: 'Outlook.com (personnel)',
    openSettings: 'Paramètres',
  },
};
