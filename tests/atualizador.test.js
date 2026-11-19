'use strict';
const test = require('node:test');
const assert = require('node:assert');
const EventEmitter = require('events');
const { criarAtualizador } = require('../src/atualizador');

function montar({ resposta = 0, ativo = true } = {}) {
  const au = new EventEmitter(); au.checks = 0; au.baixou = false; au.instalou = null;
  au.checkForUpdates = async () => { au.checks++; };
  au.downloadUpdate = async () => { au.baixou = true; au.emit('update-downloaded'); };
  au.quitAndInstall = (a, b) => { au.instalou = [a, b]; };
  const caixas = [];
  const dialog = { showMessageBox: async (...a) => { caixas.push(a[a.length - 1]); return { response: resposta }; } };
  let saiu = 0;
  const toasts = [];
  const at = criarAtualizador({ autoUpdater: au, dialog, notificar: (m) => toasts.push(m), janela: () => null, antesDeSair: () => { saiu++; }, aviso: () => 'A VPN será desconectada.', ativo: () => ativo });
  return { au, at, caixas, toasts, saiu: () => saiu };
}

test('versão nova: pergunta, baixa, avisa da VPN e reinstala reabrindo', async () => {
  const { au, caixas, saiu } = montar();
  au.emit('update-available', { version: '2.0.0' });
  await new Promise((r) => setTimeout(r, 20));
  assert.match(caixas[0].message, /PostigoVPN/); assert.match(caixas[0].detail, /VPN será desconectada/);
  assert.ok(au.baixou); assert.deepStrictEqual(au.instalou, [false, true]); assert.strictEqual(saiu(), 1);
});
test('"Depois" não baixa e não pergunta de novo a mesma versão', async () => {
  const { au, caixas } = montar({ resposta: 1 });
  au.emit('update-available', { version: '2.0.0' }); await new Promise((r) => setTimeout(r, 10));
  au.emit('update-available', { version: '2.0.0' }); await new Promise((r) => setTimeout(r, 10));
  assert.strictEqual(caixas.length, 1); assert.ok(!au.baixou);
});
test('com atualização automática desligada, iniciar() não verifica; verificar manual sim', async () => {
  const { au, at } = montar({ ativo: false });
  at.iniciar(); at.parar(); assert.strictEqual(au.checks, 0);
  await at.verificar({ pedido: true }); assert.strictEqual(au.checks, 1);
});
test('verificação manual sem novidade mostra "já está atualizado"', async () => {
  const { au, at, toasts } = montar();
  await at.verificar({ pedido: true }); au.emit('update-not-available'); await new Promise((r) => setTimeout(r, 10));
  assert.match(toasts[0], /mais recente/);
});
