import { PRODUCT_NAME } from '@email-writer/contracts';

import type { WelcomeText } from './extension-text';

export const welcomeEn: WelcomeText = {
  title: `Welcome to ${PRODUCT_NAME}`,
  subtitle: 'Ready in four short steps',
  stepsLabel: 'Setup steps',
  steps: ['Welcome', 'Helper app', 'Connection', 'Try it'],
  back: 'Back',
  next: 'Continue',
  intro: {
    title: 'Why a helper app?',
    lead: `${PRODUCT_NAME} works inside Outlook on the web. A small helper app on your computer does what a browser extension cannot do on its own.`,
    reasons: [
      'Signing in with ChatGPT needs a return address on your computer, which an extension cannot provide.',
      'Your sign-in details and API keys stay protected on your computer, not in the browser.',
      'It is open source: you can read every line of its code.',
    ],
    source: 'Source code on GitHub',
    doesTitle: 'What it does',
    does: [
      'Sends the text you choose to the provider you choose, only when you ask.',
      'Keeps your connection to ChatGPT, OpenAI or Claude.',
    ],
    doesNotTitle: 'What it never does',
    doesNot: [
      'Send email.',
      'Read your mailbox in the background.',
      'Send anything to a server of ours; there is none.',
    ],
  },
  install: {
    title: 'Install the helper app',
    lead: 'One command installs it for your user account. No administrator rights are needed.',
    system: 'Your system',
    command: 'Install command',
    terminal: {
      darwin: 'Open Terminal (Applications → Utilities), paste the command and press Return.',
      linux: 'Open a terminal (often Ctrl+Alt+T), paste the command and press Enter.',
      windows: 'Open PowerShell (right-click Start and choose Terminal), paste the command and press Enter.',
    },
    waiting: 'Waiting for the helper app… It appears here a few seconds after the command finishes.',
    connected: (version) => `Helper app connected (version ${version}).`,
    whatTitle: 'What does the command do?',
    what: [
      'Downloads the program for your system from the latest release on GitHub.',
      'Checks its SHA-256 checksum and stops if it does not match.',
      'Installs it in your user folder, without administrator rights.',
      'Registers it with Firefox, Chrome, Edge and Brave so this extension can reach it.',
    ],
  },
  tryIt: {
    title: 'Try it',
    lead: 'Revise a made-up email to check that everything works. The text goes only to the provider you chose; nothing is sent as email.',
    sampleLabel: 'Sample email',
    sample:
      'Hi Sam,\n\nthanks for you’re message. I can send the report on thursday, but i need the latest numbers from you team first. Could you share them until wendesday?\n\nBest,\nAlex',
    run: 'Revise the sample',
    running: 'Revising…',
    success: 'Everything works. Open a draft in Outlook; the toolbar appears next to it.',
    resultLabel: 'Result',
    openOutlook: 'Open Outlook',
    personalOutlook: 'Outlook.com (personal)',
    openSettings: 'Settings',
  },
};
