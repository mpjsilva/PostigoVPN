'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), os = require('os'), path = require('path');
const { migrarDadosAntigos } = require('../src/migracao');
const { Store } = require('../src/store');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mig-'));
const OVPN = 'client\ndev tun\nremote vpn.exemplo.com 1194\nauth-user-pass\n';

test('traz conexões, credenciais e preferências do app antigo e abre no Store novo', () => {
  const antigo = tmp(), novo = path.join(tmp(), 'PostigoVPN');
  const velho = new Store(antigo); const p = velho.adicionar('Casa', OVPN); velho.salvarCredenciais(p.id, 'ana', 'segredo'); velho.setConfig({ tema: 'escuro' });
  fs.writeFileSync(path.join(antigo, 'Cache-do-chromium.tmp'), 'lixo'); // não deve ser copiado
  assert.strictEqual(migrarDadosAntigos(novo, ['/nao/existe', antigo]), antigo);
  assert.ok(!fs.existsSync(path.join(novo, 'Cache-do-chromium.tmp')));
  const s = new Store(novo);
  assert.strictEqual(s.listar()[0].nome, 'Casa'); assert.strictEqual(s.getConfig().tema, 'escuro');
  assert.deepStrictEqual(s.obterCredenciais(s.listar()[0].id), { usuario: 'ana', senha: 'segredo' });
  assert.ok(fs.existsSync(antigo)); // a pasta antiga fica
  assert.strictEqual(fs.statSync(path.join(novo, 'chave.key')).mode & 0o777, 0o600);
  assert.strictEqual(fs.statSync(path.join(novo, 'credenciais.bin')).mode & 0o777, 0o600);
  assert.strictEqual(fs.statSync(novo).mode & 0o777, 0o700);
});
test('não sobrescreve dados que já existem no destino', () => {
  const antigo = tmp(), novo = tmp();
  new Store(antigo).adicionar('Velha', OVPN); const n = new Store(novo); n.adicionar('Nova', OVPN);
  assert.strictEqual(migrarDadosAntigos(novo, [antigo]), null);
  assert.deepStrictEqual(new Store(novo).listar().map((x) => x.nome), ['Nova']);
});
test('sem pasta antiga, não faz nada', () => {
  assert.strictEqual(migrarDadosAntigos(path.join(tmp(), 'x'), ['/nao/existe']), null);
});
