import { PRODUCT_NAME } from '@email-writer/contracts';
import type { AiText } from '@email-writer/ui';

export const aiDe: AiText = {
  title: 'KI-Verbindung',
  description:
    'Schreiben Sie E-Mails mit Ihrem ChatGPT-Plan, Ihrem eigenen OpenAI-API-Schlüssel oder Claude Code auf diesem Computer.',
  chatgpt: 'ChatGPT-Plan',
  apiKey: 'OpenAI-API-Schlüssel',
  claudeCode: 'Claude-Plan',
  methodHints: {
    chatgpt: 'Mit Ihrem Plus- oder Pro-Plan',
    'api-key': 'Bezahlung nach Nutzung',
    'claude-code': 'Mit Claude Code auf diesem Computer',
  },
  methodLabel: 'Verbindungsmethode',
  statusReady: 'Bereit',
  statusSetup: 'Einrichtung nötig',
  statusAction: 'Verbindung nötig',
  guide: {
    title: 'Verbindungsanleitung',
    intro:
      'Richten Sie eine der folgenden Methoden ein, um Text zu erstellen. Jeder Abschnitt nennt, was Sie brauchen und welche Schritte nötig sind.',
    requirementsLabel: 'Sie brauchen',
    stepsLabel: 'Schritte',
    notesLabel: 'Gut zu wissen',
    current: 'Ausgewählt',
    methods: {
      chatgpt: {
        title: 'ChatGPT-Plan',
        summary: 'Erstellt Text mit der Nutzung, die in Ihrem ChatGPT-Plus- oder -Pro-Plan enthalten ist.',
        requirements: [
          'Ein ChatGPT-Plus- oder -Pro-Abo. Kostenlose Konten unterstützen keine Plannutzung.',
          `Die ${PRODUCT_NAME}-Hilfs-App auf diesem Computer.`,
        ],
        steps: [
          'Wählen Sie „ChatGPT-Plan“ als Methode.',
          'Wählen Sie „Continue with ChatGPT“. Wählen Sie auf der geöffneten Seite Ihr Konto und erlauben Sie den Zugriff.',
          'Kehren Sie zu dieser Seite zurück; beim Konto steht „Verbunden · Bereit zur Texterstellung“. Wählen Sie dann ein Modell.',
        ],
        notes: [
          'Die Nutzung wird auf die Limits Ihres ChatGPT-Plans angerechnet. Sie können sie unter ChatGPT → Einstellungen → Usage verfolgen.',
          'Wenn Sie Ihren Plan gerade erst hochgestuft haben, kann die Aktivierung einige Minuten dauern.',
          'OpenAI unterstützt derzeit nur Plus- und Pro-Pläne. Bei Arbeitskonten (Business, Enterprise) kann eine Organisationsrichtlinie die Verbindung blockieren.',
          'Sie können den Zugriff jederzeit unter ChatGPT → Einstellungen → Security and login → Sign in with ChatGPT entfernen.',
        ],
      },
      'api-key': {
        title: 'OpenAI-API-Schlüssel',
        summary: 'Erstellt Text mit Ihrem eigenen OpenAI-Platform-Konto; Sie zahlen, was Sie nutzen.',
        requirements: [
          'Ein OpenAI-Platform-Konto und ein API-Schlüssel.',
          `Die ${PRODUCT_NAME}-Hilfs-App auf diesem Computer.`,
        ],
        steps: [
          'Erstellen Sie auf OpenAI Platform einen API-Schlüssel.',
          'Wählen Sie „OpenAI-API-Schlüssel“ als Methode, fügen Sie den Schlüssel ein und wählen Sie „Schlüssel verbinden“.',
          'Wählen Sie ein Modell aus der Liste.',
        ],
        notes: [
          'Die API-Nutzung ist unabhängig von einem ChatGPT-Abo und wird von OpenAI abgerechnet.',
          'Der Schlüssel wird nur in der Hilfs-App auf diesem Computer gespeichert und nie an den Browser zurückgegeben.',
        ],
        linkLabel: 'API-Schlüssel erstellen',
      },
      'claude-code': {
        title: 'Claude-Plan',
        summary: 'Verwendet Claude Code auf Ihrem Computer mit Ihrem eigenen Claude-Konto.',
        requirements: [
          'Ein Claude-Pro-, -Max-, -Team- oder -Enterprise-Abo.',
          'Claude Code auf diesem Computer installiert und mit Ihrem Claude-Konto angemeldet.',
          `Die ${PRODUCT_NAME}-Hilfs-App. Nach Claude Code installiert, findet sie Claude Code automatisch.`,
        ],
        steps: [
          'Installieren Sie Claude Code nach der offiziellen Anleitung von Anthropic.',
          'Führen Sie in einem Terminal `claude` aus und melden Sie sich mit `/login` bei Ihrem Claude-Konto an.',
          'Installieren Sie die Hilfs-App; wenn sie schon installiert war, installieren Sie sie nach Claude Code erneut.',
          'Wählen Sie „Claude-Plan“ als Methode. Ihr Konto und Ihr Plan erscheinen hier.',
        ],
        notes: [
          `${PRODUCT_NAME} sieht und speichert weder Ihr Claude-Passwort noch Ihre Sitzung; Sie melden sich über Claude Code an und ab.`,
          'Die Nutzung wird auf das Limit Ihres Plans angerechnet, das Sie mit Claude Code teilen.',
          'Bei Pro- und Max-Plänen können Inhalte zum Training von Modellen verwendet werden, sofern Sie dies nicht in Ihren Claude-Datenschutzeinstellungen ausgeschaltet haben. Team- und Enterprise-Pläne unterliegen den geschäftlichen Bedingungen.',
          'Ist Claude Code mit einem API-Schlüssel angemeldet, wird die Nutzung diesem API-Konto berechnet.',
          'Diese Methode hängt von Anthropics Regeln für Drittanbieter-Apps ab und wird als experimentell angeboten. Sie kann aufhören zu funktionieren, wenn sich diese Regeln ändern.',
        ],
        linkLabel: 'Einrichtungsanleitung für Claude Code',
      },
    },
    helper: {
      title: 'Was ist die Hilfs-App?',
      summary: 'Eine kleine App auf Ihrem Computer, die jede Methode benötigt.',
      requirements: ['macOS, Linux oder Windows.', 'Node.js 22 oder neuer.'],
      steps: [
        'Installieren Sie die Hilfs-App und starten Sie den Browser neu.',
        'Der Hinweis „Die lokale KI-Verbindung ist nicht verfügbar“ auf dieser Seite verschwindet und die Methoden erscheinen.',
      ],
      notes: [
        'Anmeldedaten und API-Schlüssel liegen in einer geschützten Datei, auf die nur Sie zugreifen können, nicht im Browser.',
        'Die Hilfs-App läuft nur, wenn Sie Text anfordern; sie liest oder sendet nie im Hintergrund E-Mails.',
      ],
    },
  },
  connect: 'Continue with ChatGPT',
  addAccount: 'Anderes Konto oder anderen Arbeitsbereich hinzufügen',
  reconnect: 'Neu verbinden',
  disconnect: 'Trennen',
  account: 'ChatGPT-Konto',
  activeAccount: 'Verwendetes Konto',
  useAccount: 'Dieses Konto verwenden',
  savedConnection: 'Konto verbunden. Wählen Sie „Dieses Konto verwenden“, um damit Text zu erstellen.',
  renameAccount: 'Umbenennen',
  accountName: 'Name der Verbindung',
  accountNameHint:
    'Zum Beispiel „Privat“ oder „Arbeit · Firmenname“. Der Name gilt nur auf diesem Gerät; bis zu 80 Zeichen.',
  saveAccountName: 'Namen speichern',
  removeAccount: 'Konto entfernen',
  removeAccountTitle: 'Diese Verbindung entfernen?',
  removeAccountBody:
    'Der Kontoeintrag und die Anmeldedaten werden von diesem Gerät entfernt; falls vorhanden, wird versucht, die OpenAI-Sitzung zu widerrufen. Eine laufende Anmeldung wird abgebrochen. Fügen Sie das Konto erneut hinzu, um es später zu verwenden. Ihr ChatGPT-Konto wird nicht gelöscht.',
  confirmRemoveAccount: 'Entfernen',
  savedAccountHint:
    'Wählen Sie eine gespeicherte Verbindung, um sie umzubenennen oder zu entfernen. Die Anmeldeschaltflächen verwenden Konto und Arbeitsbereich der ausgewählten Verbindung. Für ein weiteres Konto verwenden Sie die Schaltfläche zum Hinzufügen unten.',
  model: 'Modell',
  refresh: 'Aktualisieren',
  checking: 'Verbindung wird geprüft…',
  signingIn: 'Schließen Sie die ChatGPT-Anmeldung im Browserfenster ab.',
  cancel: 'Abbrechen',
  connected: 'Verbunden · Bereit zur Texterstellung',
  disconnected: 'Abgemeldet',
  registrationIncomplete:
    'Die Kontoverbindung ist unvollständig; die Kontodaten wurden noch nicht bestätigt. Versuchen Sie „Continue with ChatGPT“ erneut mit demselben Konto und Arbeitsbereich wie beim ersten Versuch.',
  generationUnavailable:
    'Konto bestätigt und Planberechtigung erteilt; die Texterstellung ist noch nicht bereit. Wählen Sie „Aktualisieren“, um die Modellliste neu zu laden.',
  planDisabled:
    'Konto bestätigt; die Texterstellung ist nicht berechtigt. Die Plannutzung erfordert ein berechtigtes Plus- oder Pro-Konto und die Erlaubnis, dessen Plan zu verwenden. Die Anmeldung mit einem kostenlosen Konto gewährt keinen Zugang zur Texterstellung.',
  planNote:
    'Berechtigte Plus- und Pro-Konten können ihr Plankontingent nutzen. Die Verfügbarkeit hängt von Ihrem Konto, Ihrem Arbeitsbereich und Ihrem OpenAI-Zugang ab.',
  apiNote:
    'Die API-Nutzung wird von OpenAI separat abgerechnet. Sie ist unabhängig von Ihrem ChatGPT-Abo; diese Methode wird nie automatisch gewählt.',
  claudeNote: `Das auf diesem Computer installierte Claude Code läuft mit Ihrem eigenen Claude-Konto; die Nutzung wird auf die Limits Ihres Claude-Plans angerechnet. ${PRODUCT_NAME} greift nicht auf Ihre Claude-Anmeldedaten zu und speichert sie nicht. Sie melden sich über Claude Code an und ab.`,
  claudeAccount: 'Claude Code-Konto',
  claudeNotInstalled:
    'Claude Code wurde auf diesem Computer nicht gefunden. Installieren Sie Claude Code, führen Sie pnpm ai:install erneut aus und wählen Sie dann „Aktualisieren“.',
  claudeNotLoggedIn:
    'Claude Code ist nicht angemeldet. Führen Sie claude in einem Terminal aus, melden Sie sich mit /login an und wählen Sie dann „Aktualisieren“.',
  claudeApiBilling:
    'Claude Code ist mit einer anderen Methode als einem Claude-Abo angemeldet, etwa einem API-Schlüssel; die Nutzung wird diesem Konto berechnet.',
  claudePrivacy:
    'Wenn Sie Text anfordern, werden Ihr Text, Ihre Anweisungen und der ausgewählte Kontext über Claude Code an Anthropic gesendet. Claude Code läuft ohne Werkzeuge, hat keinen Zugriff auf Ihre Dateien und speichert kein Sitzungsprotokoll. Pro- und Max-Pläne unterliegen den Verbraucherbedingungen von Anthropic: Sofern Sie das Modelltraining nicht in Ihren Claude-Datenschutzeinstellungen ausgeschaltet haben, können Inhalte zum Training verwendet werden. Team- und Enterprise-Pläne unterliegen den geschäftlichen Bedingungen.',
  apiKeyLabel: 'API-Schlüssel',
  saveKey: 'Schlüssel verbinden',
  removeKey: 'Schlüssel entfernen',
  keySaved: 'API-Schlüssel in der lokalen Verbindung gespeichert.',
  manageUsage: 'Nutzung verwalten',
  connectionHelp:
    'Verwalten Sie diese Verbindung in den ChatGPT-Einstellungen unter Security and login → Sign in with ChatGPT. Sie erscheint nicht unter Plugins. Für Arbeitskonten gelten zusätzlich Organisationsrichtlinie und Planberechtigung.',
  welcome: 'Sie verwenden Ihren ChatGPT-Plan',
  welcomeBody: `Die berechtigte Texterstellung in ${PRODUCT_NAME} nutzt das Kontingent Ihres ChatGPT-Plans oder verfügbare Guthaben. Die Nutzung dieser App verwalten Sie in den ChatGPT-Einstellungen.`,
  gotIt: 'Verstanden',
  privacy:
    'Wenn Sie Text anfordern, werden Ihr Text, Ihre Anweisungen und der ausgewählte Kontext an OpenAI gesendet. Die Erweiterung speichert sie nicht auf der Festplatte. Sie hat keinen Zugriff auf Ihren ChatGPT-Chatverlauf.',
  setup: 'Lokale Verbindung einrichten',
  setupBody: `Die KI-Verbindung benötigt die lokale ${PRODUCT_NAME}-App (macOS, Linux oder Windows; Node.js 22+). Folgen Sie docs/AI_BAGLANTISI.md im Projekt. Kontoanmeldedaten liegen statt im Browserspeicher in einer geschützten Datei auf Ihrem Gerät. Für den Claude-Plan muss außerdem Claude Code installiert und angemeldet sein.`,
  extensionId: 'Erweiterungs-ID für die Installation:',
  usePlan: 'ChatGPT-Plan wird verwendet',
  useApi: 'OpenAI-API wird verwendet',
  useClaude: 'Claude-Plan wird verwendet',
  openSettings: 'KI-Einstellungen',
  notReady: 'Verbinden Sie ein KI-Konto, um Text zu erstellen',
};
