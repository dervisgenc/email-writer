/**
 * Content of the demo mailbox. All people, companies and addresses are made up;
 * the addresses use the reserved `.example` domain.
 */
export const USER = {
  name: 'Alex Morgan',
  email: 'alex.morgan@lumenlabs.example',
  color: '#8764b8',
  signature: ['Alex Morgan', 'Product Lead · Lumen Labs'],
};

export const FOLDERS = {
  favorites: [
    { icon: 'inbox', name: 'Inbox', count: 3, current: true },
    { icon: 'send', name: 'Sent Items' },
    { icon: 'drafts', name: 'Drafts', count: 1 },
  ],
  account: [
    { icon: 'inbox', name: 'Inbox', count: 3 },
    { icon: 'drafts', name: 'Drafts', count: 1 },
    { icon: 'send', name: 'Sent Items' },
    { icon: 'archive', name: 'Archive' },
    { icon: 'trash', name: 'Deleted Items' },
    { icon: 'folder', name: 'Launch 2026' },
  ],
};

/** Message list; each conversation has a single open message in the reading pane. */
export const CONVERSATIONS = [
  {
    id: 'c-launch',
    group: 'Today',
    from: { name: 'Priya Shah', email: 'priya.shah@northpeak.example', color: '#038387' },
    subject: 'Q4 launch timeline',
    time: '10:24 AM',
    date: 'Tue 10/20/2026 10:24 AM',
    unread: true,
    body: [
      'Hi Alex,',
      'Thanks again for Friday’s update. Our retail partners asked whether we could move the public launch from November 5 to November 12, so their stores have one more week to set up the displays.',
      'Could you let me know if that works on your side? If it does, I’d also need the updated rollout costs by the end of the week so I can share them with our finance team.',
      'Best regards,<br>Priya',
      '<span class="muted">Priya Shah<br>Partner Manager · Northpeak Retail</span>',
    ],
  },
  {
    id: 'c-review',
    group: 'Today',
    from: { name: 'Daniel Weber', email: 'daniel.weber@lumenlabs.example', color: '#ca5010' },
    subject: 'Design review notes',
    time: '9:41 AM',
    date: 'Tue 10/20/2026 9:41 AM',
    unread: true,
    body: [
      'Hi Alex,',
      'Here are my notes from Tuesday’s review. The new onboarding flow tested well; most people finished it in under two minutes.',
      'Two open points: the pricing step still feels long, and we should add a skip option for returning users. I’ll bring proposals to Thursday’s call.',
      'Cheers,<br>Daniel',
    ],
  },
  {
    id: 'c-budget',
    group: 'Today',
    from: { name: 'Sofia Rossi', email: 'sofia.rossi@lumenlabs.example', color: '#c239b3' },
    subject: 'Budget approval for Q4 campaigns',
    time: '8:15 AM',
    date: 'Tue 10/20/2026 8:15 AM',
    unread: true,
    body: [
      'Hi Alex,',
      'Finance signed off on the revised numbers, so we can start booking the November campaigns this week.',
      'Please send me the final launch date as soon as it is confirmed; the media plan depends on it.',
      'Thanks,<br>Sofia',
    ],
  },
  {
    id: 'c-workshop',
    group: 'Yesterday',
    from: { name: 'Marcus Lee', email: 'marcus.lee@harborworks.example', color: '#4f6bed' },
    subject: 'Customer workshop in Berlin',
    time: 'Mon 4:32 PM',
    date: 'Mon 10/19/2026 4:32 PM',
    body: [
      'Hello Alex,',
      'Quick question about the agenda for the Berlin workshop: should we plan a hands-on session for the new reporting features, or keep it to a demo?',
      'Best,<br>Marcus',
    ],
  },
  {
    id: 'c-maintenance',
    group: 'Yesterday',
    from: { name: 'Lumen Labs IT', email: 'it@lumenlabs.example', color: '#498205' },
    subject: 'Scheduled maintenance this weekend',
    time: 'Mon 11:05 AM',
    date: 'Mon 10/19/2026 11:05 AM',
    body: [
      'Hello everyone,',
      'Some internal services will be unavailable on Saturday between 8:00 and 11:00 AM while we upgrade the network.',
      'Lumen Labs IT',
    ],
  },
  {
    id: 'c-onboarding',
    group: 'Last week',
    from: { name: 'Hannah Kim', email: 'hannah.kim@lumenlabs.example', color: '#d13438' },
    subject: 'RE: Onboarding guide draft',
    time: 'Fri 10/16',
    date: 'Fri 10/16/2026 3:18 PM',
    body: [
      'Hi Alex,',
      'I added your comments to the onboarding guide. The new version is in the shared folder.',
      'Hannah',
    ],
  },
  {
    id: 'c-pricing',
    group: 'Last week',
    from: { name: 'Tomás García', email: 'tomas.garcia@lumenlabs.example', color: '#0b6a0b' },
    subject: 'Pricing page feedback',
    time: 'Thu 10/15',
    date: 'Thu 10/15/2026 10:02 AM',
    body: [
      'Hi Alex,',
      'Customers keep asking whether the annual plan includes support. Could we make that clearer on the pricing page?',
      'Tomás',
    ],
  },
];
