'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), os = require('os'), path = require('path');
const { Store } = require('../src/store');

const OVPN = 'client\ndev tun\nremote vpn.exemplo.com 1194\nauth-user-pass\n';
const novo = () => new Store(fs.mkdtempSync(path.join(os.tmpdir(), 'ovpn-')));

test('adiciona, renomeia, nome duplicado e remove', () => {
  const s = novo();
  const a = s.adicionar('Casa', OVPN), b = s.adicionar('Casa', OVPN);
  assert.strictEqual(b.nome, 'Casa (2)');
  assert.ok(a.exigeCredenciais);
  s.renomear(a.id, 'Sede');
  assert.strictEqual(s.obter(a.id).nome, 'Sede');
  s.remover(a.id);
  assert.strictEqual(s.listar().length, 1);
});
test('rejeita arquivo que não é perfil OpenVPN', () => {
  assert.throws(() => novo().adicionar('x', 'olá mundo'), /válido/);
});
test('credenciais cifradas em disco e recuperáveis', () => {
  const s = novo(), p = s.adicionar('A', OVPN);
  s.salvarCredenciais(p.id, 'ana', 'segredo123');
  assert.ok(!fs.readFileSync(s.arqCred).includes('segredo123'));
  assert.deepStrictEqual(new Store(s.dir).obterCredenciais(p.id), { usuario: 'ana', senha: 'segredo123' });
});
test('exportar não leva senha por padrão; importar recria as conexões', () => {
  const s = novo(), p = s.adicionar('Casa', OVPN);
  s.salvarCredenciais(p.id, 'ana', 'segredo123');
  const pacote = s.exportar();
  assert.ok(!JSON.stringify(pacote).includes('segredo123'));
  const d = novo(), r = d.importarPacote(pacote);
  assert.strictEqual(r.importadas.length, 1);
  assert.strictEqual(d.listar()[0].nome, 'Casa');
  assert.strictEqual(d.obterCredenciais(d.listar()[0].id), null);
});
test('exportar com credenciais as leva e importar as restaura', () => {
  const s = novo(), p = s.adicionar('Casa', OVPN);
  s.salvarCredenciais(p.id, 'ana', 'segredo123');
  const d = novo(); d.importarPacote(s.exportar({ incluirCredenciais: true }));
  assert.deepStrictEqual(d.obterCredenciais(d.listar()[0].id), { usuario: 'ana', senha: 'segredo123' });
});
test('pacote inválido e conexão ruim dentro do pacote', () => {
  assert.throws(() => novo().importarPacote({ x: 1 }), /inválido/);
  const r = novo().importarPacote({ formato: 'postigovpn/conexoes', conexoes: [{ nome: 'ruim', ovpn: 'lixo' }] });
  assert.strictEqual(r.ignoradas.length, 1);
});
test('importa pacote exportado pelo app antigo (formato openvpn-connect/conexoes)', () => {
  const r = novo().importarPacote({ formato: 'openvpn-connect/conexoes', versao: 1, conexoes: [{ nome: 'Casa', ovpn: OVPN }] });
  assert.strictEqual(r.importadas.length, 1);
  assert.strictEqual(novo().exportar().formato, 'postigovpn/conexoes');
});
