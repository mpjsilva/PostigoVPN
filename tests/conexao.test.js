'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { Conexao } = require('../src/openvpn');

const novo = () => new Conexao({ dirs: [path.join(__dirname, 'falso')] });
const esperar = (c, pred, ms = 8000) => new Promise((ok, erro) => {
  const t = setTimeout(() => erro(new Error('tempo esgotado')), ms);
  c.on('estado', (e) => { if (pred(e)) { clearTimeout(t); ok(e); } });
});

test('conecta, lê estado/bytes e desconecta pela interface de gerenciamento', async () => {
  const c = novo(), bytes = [];
  c.on('bytes', (b) => bytes.push(b));
  const conectado = esperar(c, (e) => e.estado === 'conectado');
  await c.conectar({ perfilId: 'p1', caminhoOvpn: __filename, credenciais: { usuario: 'ana', senha: 'x' } });
  const e = await conectado;
  assert.strictEqual(e.ipLocal, '10.8.0.2'); assert.strictEqual(e.ipRemoto, '203.0.113.7');
  await new Promise((r) => setTimeout(r, 300));
  assert.deepStrictEqual(bytes[0], { entrada: 2048, saida: 1024 });
  const fim = esperar(c, (x) => x.estado === 'desconectado');
  c.desconectar();
  assert.strictEqual((await fim).estado, 'desconectado');
  assert.strictEqual(c.filho, null);
});

test('credenciais erradas terminam em erro com mensagem clara', async () => {
  const c = novo();
  const fim = esperar(c, (e) => e.estado === 'erro');
  await c.conectar({ perfilId: 'p2', caminhoOvpn: __filename, credenciais: { usuario: 'errado', senha: 'x' } });
  assert.match((await fim).mensagem, /incorretos/);
});

test('sem openvpn instalado, falha com instrução', async () => {
  const c = new Conexao({ dirs: ['/nao/existe'] });
  await assert.rejects(c.conectar({ perfilId: 'p3', caminhoOvpn: __filename }), /não encontrado/);
});

test('não apaga nem deixa arquivos temporários de credenciais', async () => {
  const c = novo();
  const fim = esperar(c, (e) => e.estado === 'conectado');
  await c.conectar({ perfilId: 'p4', caminhoOvpn: __filename, credenciais: { usuario: 'ana', senha: 'seg' } });
  await fim; const tmp = c.tmp;
  const fs = require('fs'); assert.ok(fs.existsSync(path.join(tmp, 'auth')));
  const fim2 = esperar(c, (e) => e.estado === 'desconectado'); c.desconectar(); await fim2;
  assert.ok(!fs.existsSync(tmp));
});
