'use strict';
const test = require('node:test');
const assert = require('node:assert');
const p = require('../src/parse');

test('parseState reconhece CONNECTED e extrai IPs', () => {
  const s = p.parseState('>STATE:1700000000,CONNECTED,SUCCESS,10.8.0.2,1.2.3.4,1194,,');
  assert.strictEqual(s.estado, 'conectado');
  assert.strictEqual(s.ipLocal, '10.8.0.2');
  assert.strictEqual(s.ipRemoto, '1.2.3.4');
});
test('parseState mapeia estados intermediários e ignora lixo', () => {
  assert.strictEqual(p.parseState('>STATE:1,AUTH,,,,').estado, 'autenticando');
  assert.strictEqual(p.parseState('>STATE:1,RECONNECTING,ping-restart,,,').estado, 'reconectando');
  assert.strictEqual(p.parseState('qualquer coisa'), null);
});
test('parseBytes e parseLog', () => {
  assert.deepStrictEqual(p.parseBytes('>BYTECOUNT:10,20'), { entrada: 10, saida: 20 });
  assert.strictEqual(p.parseLog('>LOG:1,I,Initialization Sequence Completed').texto, 'Initialization Sequence Completed');
  assert.strictEqual(p.parseLog('x'), null);
});
test('falha de autenticação', () => {
  assert.ok(p.falhaDeAutenticacao(">PASSWORD:Verification Failed: 'Auth'"));
  assert.ok(!p.falhaDeAutenticacao('>STATE:1,AUTH,,,,'));
});
test('precisaCredenciais só quando auth-user-pass está sem arquivo', () => {
  assert.ok(p.precisaCredenciais('client\nauth-user-pass\nremote x 1194'));
  assert.ok(!p.precisaCredenciais('client\nauth-user-pass /etc/senha.txt'));
  assert.ok(!p.precisaCredenciais('client\n# auth-user-pass'));
});
test('formatarBytes e nomeDoArquivo', () => {
  assert.strictEqual(p.formatarBytes(512), '512 B');
  assert.strictEqual(p.formatarBytes(1536), '1.5 KB');
  assert.strictEqual(p.nomeDoArquivo('/a/b/Casa Sede.ovpn'), 'Casa Sede');
});
test('motivoDeSaida', () => {
  assert.match(p.motivoDeSaida(126), /cancelada/);
  assert.strictEqual(p.motivoDeSaida(0), null);
});
