import { PRODUCT_NAME } from '@writehand/contracts';

import type { WelcomeText } from './extension-text';

export const welcomeDe: WelcomeText = {
  title: `Willkommen bei ${PRODUCT_NAME}`,
  subtitle: 'In vier kurzen Schritten eingerichtet',
  stepsLabel: 'Einrichtungsschritte',
  steps: ['Willkommen', 'Hilfs-App', 'Verbindung', 'Ausprobieren'],
  back: 'Zurück',
  next: 'Weiter',
  intro: {
    title: 'Warum eine Hilfs-App?',
    lead: `${PRODUCT_NAME} arbeitet in Outlook im Web. Eine kleine Hilfs-App auf Ihrem Computer übernimmt, was eine Browsererweiterung allein nicht kann.`,
    reasons: [
      'Die Anmeldung mit ChatGPT braucht eine Rücksprungadresse auf Ihrem Computer, die eine Erweiterung nicht bereitstellen kann.',
      'Ihre Anmeldedaten und API-Schlüssel bleiben geschützt auf Ihrem Computer, nicht im Browser.',
      'Sie ist Open Source: Sie können jede Zeile ihres Codes lesen.',
    ],
    source: 'Quellcode auf GitHub',
    doesTitle: 'Was sie tut',
    does: [
      'Sendet den von Ihnen gewählten Text an den von Ihnen gewählten Anbieter – nur auf Ihre Anforderung.',
      'Hält Ihre Verbindung zu ChatGPT, OpenAI oder Claude.',
    ],
    doesNotTitle: 'Was sie nie tut',
    doesNot: [
      'E-Mails senden.',
      'Ihr Postfach im Hintergrund lesen.',
      'Daten an einen Server von uns senden – es gibt keinen.',
    ],
  },
  install: {
    title: 'Hilfs-App installieren',
    lead: 'Ein Befehl installiert sie für Ihr Benutzerkonto. Administratorrechte sind nicht nötig.',
    system: 'Ihr System',
    command: 'Installationsbefehl',
    terminal: {
      darwin:
        'Öffnen Sie das Terminal (Programme → Dienstprogramme), fügen Sie den Befehl ein und drücken Sie den Zeilenschalter.',
      linux:
        'Öffnen Sie ein Terminal (oft mit Strg+Alt+T), fügen Sie den Befehl ein und drücken Sie die Eingabetaste.',
      windows:
        'Öffnen Sie PowerShell (Rechtsklick auf Start, dann Terminal), fügen Sie den Befehl ein und drücken Sie die Eingabetaste.',
    },
    waiting: 'Warten auf die Hilfs-App… Sie erscheint hier wenige Sekunden nach Abschluss des Befehls.',
    connected: (version) => `Hilfs-App verbunden (Version ${version}).`,
    whatTitle: 'Was macht der Befehl?',
    what: [
      'Lädt das passende Programm aus der neuesten Version auf GitHub herunter.',
      'Prüft die SHA-256-Prüfsumme und bricht ab, wenn sie nicht stimmt.',
      'Installiert es ohne Administratorrechte in Ihrem Benutzerordner.',
      'Registriert es in Firefox, Chrome, Edge und Brave, damit diese Erweiterung es erreicht.',
    ],
  },
  tryIt: {
    title: 'Ausprobieren',
    lead: 'Überarbeiten Sie eine erfundene E-Mail, um zu prüfen, ob alles funktioniert. Der Text geht nur an den gewählten Anbieter; es wird keine E-Mail gesendet.',
    sampleLabel: 'Beispiel-E-Mail',
    sample:
      'Hallo Sam,\n\ndanke für deine Nachricht. Den Bericht kann ich am donnerstag schicken, aber ich brauche vorher die aktuelle Zahlen von deinem Team. Kannst du sie bis Mitwoch teilen.\n\nViele Grüße\nAlex',
    run: 'Beispiel überarbeiten',
    running: 'Wird überarbeitet…',
    success: 'Alles funktioniert. Öffnen Sie in Outlook einen Entwurf; die Symbolleiste erscheint daneben.',
    resultLabel: 'Ergebnis',
    openOutlook: 'Outlook öffnen',
    personalOutlook: 'Outlook.com (privat)',
    openSettings: 'Einstellungen',
  },
};
