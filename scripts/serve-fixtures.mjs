// Serves the synthetic Outlook and Gmail sample pages on the loopback interface only.
// The extension's test build accepts http://127.0.0.1/mail/* (Outlook) and
// http://127.0.0.1/gmail/* (Gmail) as supported origins; the regular package's manifest
// includes neither.
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve } from 'node:path';

const port = Number(process.env.FIXTURE_PORT ?? 4517);
const fixtures = resolve(import.meta.dirname, '../tests/fixtures');
// Each site's page sits under the local path its content script runs on in test builds.
const pages = {
  '/mail/inbox': { file: 'outlook/conversation-inline-reply.html', title: 'Outlook sample page' },
  '/gmail/mail/u/0/': { file: 'gmail/conversation-inline-reply.html', title: 'Gmail sample page' },
  '/gmail/mail/u/0/list': { file: 'gmail/reply-from-list.html', title: 'Gmail sample page' },
};

const server = createServer(async (request, response) => {
  const path = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
  const page = pages[path];
  if (page === undefined) {
    response.writeHead(404).end('not found');
    return;
  }
  const body = await readFile(resolve(fixtures, page.file), 'utf8');
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  response.end(
    `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${page.title}</title></head><body>${body}</body></html>`,
  );
});

server.listen(port, '127.0.0.1', () => {
  console.log(`fixture server: http://127.0.0.1:${port}/mail/inbox`);
});
