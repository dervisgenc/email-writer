import { CONVERSATIONS, FOLDERS, USER } from './mailbox-content.js';

/** Thin-stroke icons on a 20×20 grid (the same icon style as the extension). */
const ICONS = {
  waffle: [
    'M4 4h2v2H4zM9 4h2v2H9zM14 4h2v2h-2zM4 9h2v2H4zM9 9h2v2H9zM14 9h2v2h-2zM4 14h2v2H4zM9 14h2v2H9zM14 14h2v2h-2z',
  ],
  search: ['M8.5 14a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11z', 'M12.5 12.5l4.5 4.5'],
  gear: [
    'M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
    'M10 2.5l1.6 1.9 2.4-.5.5 2.4 2 1.4-1.1 2.3 1.1 2.3-2 1.4-.5 2.4-2.4-.5L10 17.5l-1.6-1.9-2.4.5-.5-2.4-2-1.4 1.1-2.3-1.1-2.3 2-1.4.5-2.4 2.4.5z',
  ],
  bell: ['M5 13.5V9a5 5 0 0 1 10 0v4.5l1.5 1.5h-13z', 'M8.5 17h3'],
  help: [
    'M10 17.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15z',
    'M8 8a2 2 0 1 1 2.8 1.8c-.5.3-.8.7-.8 1.2v.5M10 14v.01',
  ],
  mail: ['M3.5 5.5h13a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z', 'M3 6.5l7 5 7-5'],
  calendar: [
    'M4.5 4.5h11a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1z',
    'M3.5 8h13M7 3v3M13 3v3',
  ],
  people: [
    'M7.5 9.5a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5z',
    'M2.5 16c.4-2.8 2.4-4.5 5-4.5s4.6 1.7 5 4.5',
    'M13.5 9a2.25 2.25 0 1 0 0-4.5M14.5 11.6c1.7.4 2.8 1.9 3 4.4',
  ],
  files: ['M5.5 2.5h6l4 4v10a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1z', 'M11.5 2.5v4h4'],
  todo: ['M10 17.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15z', 'M6.8 10.2l2.2 2.2 4.4-4.6'],
  compose: ['M12.6 4.4l3 3-8.1 8.1-3.8.8.8-3.8 8.1-8.1z', 'M11 6l3 3'],
  trash: ['M4 5.5h12M8 5.5V4h4v1.5', 'M5.5 5.5l.8 10.1a1 1 0 0 0 1 .9h5.4a1 1 0 0 0 1-.9l.8-10.1'],
  archive: ['M3.5 4.5h13v3h-13z', 'M4.5 7.5v8a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-8', 'M8 10.5h4'],
  move: [
    'M3.5 6.5v8a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-7a1 1 0 0 0-1-1H10L8.5 4.5h-4a1 1 0 0 0-1 1z',
    'M9 11h4.5M11.5 9l2 2-2 2',
  ],
  reply: ['M8 5L3.5 9.5 8 14', 'M3.5 9.5H11a5 5 0 0 1 5 5v1'],
  replyAll: ['M9.5 5L5 9.5 9.5 14', 'M5.5 5L1 9.5 5.5 14', 'M5 9.5h7.5a5 5 0 0 1 5 5v1'],
  forward: ['M12 5l4.5 4.5L12 14', 'M16.5 9.5H9a5 5 0 0 0-5 5v1'],
  more: ['M5 10h.01M10 10h.01M15 10h.01'],
  flag: ['M5 17V3.5M5 4h9.5l-2 3.5 2 3.5H5'],
  read: ['M3 8l7-4.5L17 8v7.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z', 'M3.5 8.5l6.5 4 6.5-4'],
  inbox: ['M3.5 11.5l2-7h9l2 7v4a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1z', 'M3.5 11.5h4a2.5 2.5 0 0 0 5 0h4'],
  send: ['M3.5 9.6L16.5 4l-5.6 13-2.2-5.2-5.2-2.2z', 'M8.7 11.8l3.3-3.3'],
  drafts: [
    'M5.5 2.5h6l4 4v10a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1z',
    'M7.5 13.5l4.5-4.5 1.5 1.5L9 15H7.5z',
  ],
  folder: ['M3.5 6.5v8a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-7a1 1 0 0 0-1-1H10L8.5 4.5h-4a1 1 0 0 0-1 1z'],
  chevronDown: ['M6 8l4 4 4-4'],
  filter: ['M3.5 5.5h13M6 10h8M8.5 14.5h3'],
  attach: ['M14.5 9l-5.3 5.3a3 3 0 0 1-4.2-4.2l6-6a2 2 0 0 1 2.8 2.8l-5.9 5.9a1 1 0 0 1-1.4-1.4L12 5.9'],
  dismiss: ['M5.5 5.5l9 9M14.5 5.5l-9 9'],
  popout: [
    'M11.5 4.5h4v4',
    'M15.5 4.5L9.5 10.5',
    'M13.5 11.5v3a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3',
  ],
};

const icon = (name) =>
  `<svg class="icon" viewBox="0 0 20 20" aria-hidden="true">${ICONS[name].map((d) => `<path d="${d}"/>`).join('')}</svg>`;

const initials = (name) =>
  name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

const avatar = (person, large = false) =>
  `<span class="avatar${large ? ' avatar--large' : ''}" style="background:${person.color}" role="img" aria-label="">${initials(person.name)}</span>`;

const plain = (html) => html.replace(/<br>/g, ' ').replace(/<[^>]+>/g, '');

const state = { selected: CONVERSATIONS[0].id, view: 'message', draft: 0 };
const app = document.getElementById('app');
const provider = document.querySelector('.fui-FluentProvider');

function topbar() {
  return `<header class="topbar">
    <div class="topbar__start">
      <button class="topbar__icon" aria-label="App launcher">${icon('waffle')}</button>
      <span class="topbar__title">Mail</span>
    </div>
    <div role="search" class="search">${icon('search')}<span>Search</span></div>
    <div class="topbar__end">
      <button class="topbar__icon" aria-label="Notifications">${icon('bell')}</button>
      <button class="topbar__icon" aria-label="Settings">${icon('gear')}</button>
      <button class="topbar__icon" aria-label="Help">${icon('help')}</button>
      <div id="owa-me-control-container">
        <button aria-label="Account manager for ${USER.name}">${avatar(USER)}</button>
      </div>
    </div>
  </header>`;
}

function ribbon() {
  const btn = (name, label, action = '') =>
    `<button class="ribbon__btn"${action && ` data-action="${action}"`}>${icon(name)}<span>${label}</span></button>`;
  return `<div class="ribbon" role="toolbar" aria-label="Commands">
    <button class="ribbon__new" data-action="new-mail">${icon('compose')}<span>New mail</span></button>
    <span class="ribbon__sep"></span>
    ${btn('trash', 'Delete')}${btn('archive', 'Archive')}${btn('move', 'Move to')}
    <span class="ribbon__sep"></span>
    ${btn('reply', 'Reply', 'reply')}${btn('replyAll', 'Reply all', 'reply')}${btn('forward', 'Forward')}
    <span class="ribbon__sep"></span>
    ${btn('read', 'Read / Unread')}${btn('flag', 'Flag')}
  </div>`;
}

function rail() {
  const item = (name, label, current = false) =>
    `<button class="rail__item" aria-label="${label}"${current ? ' aria-current="page"' : ''}>${icon(name)}</button>`;
  return `<nav class="rail" aria-label="Apps">
    ${item('mail', 'Mail', true)}${item('calendar', 'Calendar')}${item('people', 'People')}${item('files', 'Files')}${item('todo', 'To Do')}
  </nav>`;
}

function folders() {
  const folder = (entry) =>
    `<div class="folder"${entry.current ? ' aria-current="true"' : ''}>${icon(entry.icon)}<span>${entry.name}</span>${
      entry.count ? `<span class="folder__count">${entry.count}</span>` : ''
    }</div>`;
  return `<nav class="folders" aria-label="Folders">
    <div class="folders__group">${icon('chevronDown')}Favorites</div>
    ${FOLDERS.favorites.map(folder).join('')}
    <div class="folders__group">${icon('chevronDown')}${USER.name}</div>
    ${FOLDERS.account.map(folder).join('')}
  </nav>`;
}

function messageList() {
  let lastGroup = null;
  const rows = CONVERSATIONS.map((conversation, index) => {
    const header =
      conversation.group === lastGroup
        ? ''
        : `<div class="list__group" role="presentation">${conversation.group}</div>`;
    lastGroup = conversation.group;
    const selected = conversation.id === state.selected;
    return `${header}<div data-index="${index}">
      <div class="row" id="row-${index + 1}" role="option" data-focusable-row="true" tabindex="${selected ? 0 : -1}"
        data-convid="AAQk${conversation.id}" aria-selected="${selected}" data-unread="${Boolean(conversation.unread)}"
        aria-label="${conversation.from.name} ${conversation.subject}" data-conversation="${conversation.id}">
        <span class="row__avatar">${avatar(conversation.from)}</span>
        <span class="row__sender">${conversation.from.name}</span>
        <span class="row__time">${conversation.time}</span>
        <span class="row__subject">${conversation.subject}</span>
        <span class="row__preview">${plain(conversation.body[1])}</span>
      </div>
    </div>`;
  }).join('');
  return `<div id="MailList" class="pane" tabindex="-1">
    <div class="list__header">
      <span class="list__tab" aria-selected="true">Focused</span>
      <span class="list__tab">Other</span>
      <span class="list__filter">${icon('filter')}</span>
    </div>
    <div role="region" style="overflow:auto">
      <div role="listbox" tabindex="-1" aria-label="Message list">
        <div data-testid="virtuoso-item-list">${rows}</div>
      </div>
    </div>
  </div>`;
}

const selectedConversation = () => CONVERSATIONS.find((entry) => entry.id === state.selected);

/** Selected message view: same structure as tests/fixtures/outlook/selected-message-reading-pane.html. */
function messageView(conversation, index) {
  const item = `Itm${index}${conversation.id.replace(/\W/g, '')}`;
  return `<div id="ItemReadingPaneContainer" class="reading">
    <div class="allowTextSelection">
      <span class="reading__subject" role="heading" aria-level="3" id="CONV_${conversation.id}_SUBJECT"
        title="${conversation.subject}">${conversation.subject}</span>
    </div>
    <div class="reading__scroll" data-app-section="ItemContainer" tabindex="-1" data-is-scrollable="true">
      <div class="message">
        <span id="MSG_${item}_SUBJECT" aria-labelledby="CONV_${conversation.id}_SUBJECT" role="heading" aria-level="3"></span>
        <div class="message__head">
          ${avatar(conversation.from, true)}
          <div>
            <span role="heading" aria-level="3" id="MSG_${item}_FROM">
              <span aria-label="From: ${conversation.from.name}" data-lpc-hover-target-id="lpc-${item}" tabindex="0"
                role="button" aria-haspopup="dialog"><span class="message__from">${conversation.from.name}
                <span>&lt;${conversation.from.email}&gt;</span></span></span>
            </span>
            <div data-testid="RecipientWell">
              <div id="MSG_${item}_TO" role="heading" aria-level="3" class="message__to">
                <div role="presentation" aria-label="To: ${USER.name}">To: ${USER.name}</div>
              </div>
            </div>
          </div>
          <div>
            <div class="message__actions" role="toolbar">
              <button class="icon-btn" role="menuitem" aria-label="Reply" data-action="reply">${icon('reply')}</button>
              <button class="icon-btn" role="menuitem" aria-label="Reply all" data-action="reply">${icon('replyAll')}</button>
              <button class="icon-btn" role="menuitem" aria-label="Forward">${icon('forward')}</button>
              <button class="icon-btn" aria-label="More actions">${icon('more')}</button>
            </div>
            <div class="message__date" data-testid="SentReceivedSavedTime" role="heading" aria-level="3"
              id="MSG_${item}_DATETIME">${conversation.date}</div>
          </div>
        </div>
        <div data-test-id="mailMessageBodyContainer">
          <div class="allowTextSelection">
            <div class="message__body" tabindex="0" aria-label="Message body" role="document" id="UniqueMessageBody_${index}">
              <div class="rps_demo">${conversation.body.map((line) => `<p>${line}</p>`).join('')}</div>
            </div>
          </div>
        </div>
        <div class="message__quick" role="toolbar" aria-label="Quick actions">
          <button class="pill-btn" role="menuitem" aria-label="Reply" data-action="reply">${icon('reply')}Reply</button>
          <button class="pill-btn" role="menuitem" aria-label="Reply all" data-action="reply">${icon('replyAll')}Reply all</button>
          <button class="pill-btn" role="menuitem" aria-label="Forward">${icon('forward')}Forward</button>
        </div>
      </div>
    </div>
  </div>`;
}

/**
 * Reply or new message draft: same structure as selected-message-reply-compose.html.
 * As in Outlook, a reply has the quote below the signature (#appendonsend → hr → #divRplyFwdMsg).
 */
function composeView({ to, subject, body = '', quote = null }) {
  const draft = `Draft${state.draft}`;
  const lines = body === '' ? ['<br>'] : body.split('\n').map((line) => line || '<br>');
  const quoteHtml =
    quote === null
      ? ''
      : `<div id="appendonsend"></div><hr>
        <div id="divRplyFwdMsg" class="compose__quote">
          <div><b>From:</b> ${quote.from.name} &lt;${quote.from.email}&gt;<br><b>Sent:</b> ${quote.date}<br>
          <b>To:</b> ${USER.name}<br><b>Subject:</b> ${quote.subject}</div>
        </div>
        <div class="compose__quote">${quote.body.map((line) => `<p>${line}</p>`).join('')}</div>`;
  return `<div id="docking_InitVisiblePart_${state.draft}" class="owaMailComposeEditorScrollContainer compose">
    <div class="compose__bar">
      <div data-testid="ComposeSendButton"><button class="compose__send" aria-label="Send">${icon('send')}Send</button></div>
      <button class="ribbon__btn" aria-label="Attach file">${icon('attach')}</button>
      <span style="flex:1"></span>
      <button class="ribbon__btn" aria-label="Pop out">${icon('popout')}</button>
      <button class="ribbon__btn" aria-label="Discard" data-action="discard">${icon('trash')}</button>
    </div>
    <div class="compose__field" id="MSG_${draft}_TO" role="group">
      <span class="compose__label">To</span>
      <div aria-label="To" tabindex="0" contenteditable="true">${to
        .map(
          (person) =>
            `<span class="chip" contenteditable="false" aria-label="${person.name}">${person.name}</span>`,
        )
        .join(' ')}</div>
    </div>
    <div class="compose__field">
      <input class="compose__subject" placeholder="Add a subject" aria-label="Subject" id="MSG_${draft}_SUBJECT" value="${subject}" />
    </div>
    <div id="docking_DockingTriggerPart_${state.draft}" class="compose__editor-wrap">
      <div id="editorParent_${state.draft}">
        <div class="compose__editor" tabindex="0" dir="ltr" role="textbox" aria-multiline="true" aria-label="Message body"
          contenteditable="true" data-ms-editor="true" data-scrollable="true" data-demo="editor">
          ${lines.map((line) => `<div class="elementToProof">${line}</div>`).join('')}
          <div id="Signature" class="elementToProof"><div><br></div>${USER.signature.map((line) => `<div>${line}</div>`).join('')}</div>
          ${quoteHtml}
        </div>
      </div>
    </div>
  </div>`;
}

function render() {
  const conversation = selectedConversation();
  const index = CONVERSATIONS.indexOf(conversation);
  const pane =
    state.view === 'message'
      ? messageView(conversation, index)
      : state.view === 'reply'
        ? composeView({
            to: [conversation.from],
            subject: `RE: ${conversation.subject}`,
            quote: conversation,
          })
        : composeView(state.compose);
  if (!app.querySelector('.main')) {
    app.innerHTML = `${topbar()}${ribbon()}<div class="main">${rail()}${folders()}${messageList()}
      <div id="ReadingPaneContainerId" class="pane"><div class="pane__content"></div>
      <div role="alert" id="notificationBarText"></div></div></div>`;
  }
  for (const row of app.querySelectorAll('[role="option"]')) {
    const selected = row.dataset.conversation === state.selected;
    row.setAttribute('aria-selected', String(selected));
    row.tabIndex = selected ? 0 : -1;
  }
  app.querySelector('.pane__content').outerHTML =
    `<div class="pane__content" style="height:100%">${pane}</div>`;
}

/** Small API used by the image scripts and by clicks. It changes the DOM the way real Outlook does. */
const demo = {
  select(id) {
    state.selected = id;
    state.view = 'message';
    const conversation = selectedConversation();
    conversation.unread = false;
    app.querySelector(`[data-conversation="${id}"]`)?.setAttribute('data-unread', 'false');
    render();
  },
  reply() {
    state.draft += 1;
    state.view = 'reply';
    render();
  },
  compose({ to = [], subject = '', body = '' } = {}) {
    state.draft += 1;
    state.view = 'compose';
    state.compose = { to, subject, body };
    render();
  },
  discard() {
    state.view = 'message';
    render();
  },
  setTheme(theme) {
    provider.dataset.theme = theme;
  },
  setFolders(visible) {
    app.dataset.folders = visible ? 'expanded' : 'collapsed';
  },
};

app.addEventListener('click', (event) => {
  const row = event.target.closest('[role="option"][data-conversation]');
  if (row) {
    demo.select(row.dataset.conversation);
    return;
  }
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'reply') demo.reply();
  if (action === 'discard') demo.discard();
  if (action === 'new-mail') demo.compose();
});

const params = new URLSearchParams(location.search);
demo.setTheme(params.get('theme') ?? 'light');
demo.setFolders(params.get('folders') !== 'collapsed');
render();
window.demo = demo;
