'use strict';
// Captura o estado "sem conexões" (xvfb-run -a electron --no-sandbox scripts/captura-vazio.js <pasta>)
const { app, BrowserWindow } = require('electron');
const fs = require('fs'), os = require('os'), path = require('path');
const dados = fs.mkdtempSync(path.join(os.tmpdir(), 'ovpn-vazio-')); app.setPath('userData', dados);
require('../src/main');
app.whenReady().then(async () => {
  await new Promise((r) => setTimeout(r, 2500));
  const w = BrowserWindow.getAllWindows()[0];
  fs.writeFileSync(path.join(process.argv[process.argv.length - 1], 'vazio-escuro.png'), (await w.webContents.capturePage()).toPNG());
  app.exit(0);
});
