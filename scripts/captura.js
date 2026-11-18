'use strict';
// Uso: xvfb-run -a electron --no-sandbox scripts/captura.js <pasta-saida>
const { app, BrowserWindow } = require('electron');
const fs = require('fs'), os = require('os'), path = require('path');
const saida = process.argv[process.argv.length - 1];
const dados = fs.mkdtempSync(path.join(os.tmpdir(), 'ovpn-captura-'));
app.setPath('userData', dados);
const { Store } = require('../src/store');
const s = new Store(dados);
const base = 'client\ndev tun\nremote vpn.exemplo.com 1194\n';
s.adicionar('Escritório – São Paulo', base + 'auth-user-pass\n');
const b = s.adicionar('Casa', base);
s.adicionar('Filial Recife', base + 'auth-user-pass\n');
require('../src/main');
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
app.whenReady().then(async () => {
  await espera(2500);
  const w = BrowserWindow.getAllWindows()[0];
  const tira = async (nome) => { fs.writeFileSync(path.join(saida, nome), (await w.webContents.capturePage()).toPNG()); };
  const js = (c) => w.webContents.executeJavaScript(c);
  await js(`document.querySelector('[data-tema="claro"]').click()`); await espera(500); await tira('claro.png');
  await js(`document.querySelector('[data-tema="escuro"]').click()`); await espera(500); await tira('escuro.png');
  await js(`document.querySelectorAll('#lista li')[1].click(); document.getElementById('log').textContent='12:00:01  Initialization Sequence Completed'`); await espera(400); await tira('escuro-casa.png');
  await js(`document.getElementById('b-prefs').click()`); await espera(700); await tira('prefs.png');
  app.exit(0);
});
