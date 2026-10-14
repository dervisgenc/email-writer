// Sentetik Outlook örnek sayfalarını yalnızca yerel ağ arayüzünde sunar.
// Eklentinin test derlemesi http://127.0.0.1/* adresini desteklenen origin kabul eder;
// normal paketin manifestinde bu adres bulunmaz.
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve } from 'node:path';

const port = Number(process.env.FIXTURE_PORT ?? 4517);
const fixtures = resolve(import.meta.dirname, '../tests/fixtures/outlook');
const pages = {
  '/mail/inbox': 'conversation-inline-reply.html',
};

const server = createServer(async (request, response) => {
  const path = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
  const file = pages[path];
  if (file === undefined) {
    response.writeHead(404).end('not found');
    return;
  }
  const body = await readFile(resolve(fixtures, file), 'utf8');
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  response.end(
    `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Outlook örnek sayfası</title></head><body>${body}</body></html>`,
  );
});

server.listen(port, '127.0.0.1', () => {
  console.log(`fixture server: http://127.0.0.1:${port}/mail/inbox`);
});
