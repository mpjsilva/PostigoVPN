'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), os = require('os'), path = require('path');
const A = require('../src/autostart');

const pasta = () => fs.mkdtempSync(path.join(os.tmpdir(), 'auto-'));

test('Exec usa o AppImage quando existe e inicia oculto', () => {
  assert.strictEqual(A.comandoExec({ env: { APPIMAGE: '/apps/OVPN 1.0.AppImage' }, execPath: '/x/electron' }), '"/apps/OVPN 1.0.AppImage" --oculto');
  assert.strictEqual(A.comandoExec({ env: {}, execPath: '/opt/OpenVPN Connect/openvpn-connect' }), '"/opt/OpenVPN Connect/openvpn-connect" --oculto');
});
test('citar escapa caracteres especiais do Exec', () => {
  assert.strictEqual(A.citar('/a/b"c$d`e\\f'), '"/a/b\\"c\\$d\\`e\\\\f"');
});
test('ativar cria o .desktop e desativar remove', () => {
  const o = { pasta: pasta(), env: { APPIMAGE: '/a/ovpn.AppImage' } };
  assert.ok(!A.estaAtivo(o));
  const f = A.ativar(o);
  assert.ok(A.estaAtivo(o));
  const t = fs.readFileSync(f, 'utf8');
  assert.match(t, /^\[Desktop Entry\]/); assert.match(t, /Exec="\/a\/ovpn\.AppImage" --oculto/);
  A.desativar(o); assert.ok(!A.estaAtivo(o));
  A.desativar(o); // idempotente
});
test('sincronizar corrige o caminho antigo e não cria se estava desligado', () => {
  const p = pasta();
  A.sincronizar({ pasta: p, env: { APPIMAGE: '/n.AppImage' } });
  assert.ok(!A.estaAtivo({ pasta: p }));
  A.ativar({ pasta: p, env: { APPIMAGE: '/velho.AppImage' } });
  A.sincronizar({ pasta: p, env: { APPIMAGE: '/novo.AppImage' } });
  assert.match(fs.readFileSync(path.join(p, A.NOME_ARQUIVO), 'utf8'), /\/novo\.AppImage/);
});
