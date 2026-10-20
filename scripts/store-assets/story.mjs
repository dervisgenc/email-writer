// Shared story of the screenshots and the promo video: what the user types and what the
// fake helper returns. The texts are the kind an AI could produce but are written in
// advance; the images are captured without connecting to a real account or an AI.
import { REFINEMENT_INSTRUCTIONS } from '../../packages/contracts/src/actions.ts';

export const LAUNCH_THREAD = 'c-launch';

export const REPLY = {
  instruction: 'Nov 12 works for us. Costs by Friday. Suggest a quick call on Thursday.',
  text: [
    'Hi Priya,',
    '',
    'Thanks for checking with us. Moving the public launch to November 12 works on our side, and the extra week should help the stores get the displays ready.',
    '',
    'I’ll send you the updated rollout costs by Friday so you can share them with your finance team. Would a quick call on Thursday suit you to go over the remaining details? Any time after 2 pm works for me.',
    '',
    'Best regards,',
    'Alex',
  ].join('\n'),
};

export const REVISE = {
  to: [{ name: 'Launch team' }],
  subject: 'Launch date update',
  draft:
    'hi all, so the launch is moving to nov 12 bc northpeak needs more time for the stores. pls update ur timelines and send me any risks asap, i need them before thursdays call. thx',
  text: [
    'Hi all,',
    '',
    'The public launch is moving to November 12, as Northpeak needs more time to prepare their stores.',
    '',
    'Please update your timelines and send me any risks you see before Thursday’s call.',
    '',
    'Thanks,',
  ].join('\n'),
};

export const TRANSLATE = {
  language: 'de',
  languageName: 'German',
  text: [
    'Hallo zusammen,',
    '',
    'der öffentliche Launch wird auf den 12. November verschoben, da Northpeak mehr Zeit braucht, um die Filialen vorzubereiten.',
    '',
    'Bitte aktualisiert eure Zeitpläne und schickt mir alle Risiken, die ihr seht, vor dem Termin am Donnerstag.',
    '',
    'Danke,',
  ].join('\n'),
};

export const COSTS = {
  to: [{ name: 'Priya Shah' }],
  subject: 'Rollout costs for the November 12 launch',
  instruction:
    'Send Priya the updated rollout costs: displays 18,400 USD, staff training 6,200, shipping 3,900, contingency 2,500.',
  text: [
    'Hi Priya,',
    '',
    'As promised, here are the updated rollout costs for the November 12 launch: in-store displays come to 18,400 USD, staff training to 6,200 USD, shipping and logistics to 3,900 USD, and we have set aside 2,500 USD as contingency. The total is 31,000 USD.',
    '',
    'Let me know if your finance team needs a more detailed breakdown.',
    '',
    'Best regards,',
    'Alex',
  ].join('\n'),
  table: [
    'Hi Priya,',
    '',
    'As promised, here are the updated rollout costs for the November 12 launch:',
    '',
    '| Item | Cost (USD) |',
    '| --- | ---: |',
    '| In-store displays | 18,400 |',
    '| Staff training | 6,200 |',
    '| Shipping and logistics | 3,900 |',
    '| Contingency | 2,500 |',
    '| **Total** | **31,000** |',
    '',
    'Let me know if your finance team needs a more detailed breakdown.',
    '',
    'Best regards,',
    'Alex',
  ].join('\n'),
  chart: [
    'Hi Priya,',
    '',
    'As promised, here are the updated rollout costs for the November 12 launch:',
    '',
    '| Item | Cost (USD) |',
    '| --- | ---: |',
    '| In-store displays | 18,400 |',
    '| Staff training | 6,200 |',
    '| Shipping and logistics | 3,900 |',
    '| Contingency | 2,500 |',
    '| **Total** | **31,000** |',
    '',
    '```chart',
    '{"title":"Rollout costs","unit":"USD","data":[{"label":"Displays","value":18400},{"label":"Training","value":6200},{"label":"Shipping","value":3900},{"label":"Contingency","value":2500}]}',
    '```',
    '',
    'Let me know if your finance team needs a more detailed breakdown.',
    '',
    'Best regards,',
    'Alex',
  ].join('\n'),
};

/** Rules of the fake helper; `harness.mjs` matches requests against them. */
export const RESPONSES = [
  { operation: 'reply', text: REPLY.text },
  { operation: 'revise', text: REVISE.text },
  { operation: 'translate', language: TRANSLATE.language, text: TRANSLATE.text },
  { operation: 'compose', text: COSTS.text },
  { operation: 'compose', refinement: REFINEMENT_INSTRUCTIONS.table, text: COSTS.table },
  { operation: 'compose', refinement: REFINEMENT_INSTRUCTIONS.chart, text: COSTS.chart },
];
