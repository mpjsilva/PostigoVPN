'use strict';
// Uso: xvfb-run -a electron --no-sandbox scripts/medir.js  (imprime retângulos principais)
const { app, BrowserWindow } = require('electron');
const fs = require('fs'), os = require('os'), path = require('path');
const dados = fs.mkdtempSync(path.join(os.tmpdir(), 'ovpn-medir-')); app.setPath('userData', dados);
const { Store } = require('../src/store'); const s = new Store(dados);
s.adicionar('Escritório', 'client\nremote x 1194\nauth-user-pass\n'); s.adicionar('Casa', 'client\nremote x 1194\n');
require('../src/main');
app.whenReady().then(async () => {
  await new Promise((r) => setTimeout(r, 2500));
  const w = BrowserWindow.getAllWindows()[0];
  const tamanhos = process.argv.slice(2).filter((a) => /^\d+x\d+$/.test(a));
  for (const t of (tamanhos.length ? tamanhos : ['960x640'])) {
    const [L, A] = t.split('x').map(Number); w.setContentSize(L, A); await new Promise((r) => setTimeout(r, 500));
    const r = await w.webContents.executeJavaScript(`(()=>{const q=(s)=>{const e=document.querySelector(s);if(!e)return null;const b=e.getBoundingClientRect();return [Math.round(b.left),Math.round(b.top),Math.round(b.right),Math.round(b.bottom)]};
      return {viewport:[innerWidth,innerHeight],app:q('#app'),lateral:q('#lateral'),principal:q('#principal'),cartao:q('#detalhe .cartao'),stats:q('.grade-stats'),registro:q('.registro'),rodape:q('#rodape'),scrollH:document.getElementById('principal').scrollHeight,clientH:document.getElementById('principal').clientHeight}})()`);
    console.log(t, JSON.stringify(r));
  }
  app.exit(0);
});
