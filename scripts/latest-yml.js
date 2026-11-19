'use strict';
// Completa dist/latest-linux.yml com todos os pacotes da versão. O rpm é gerado num contêiner à parte e o
// electron-builder não o lista; sem a entrada do rpm, quem instalou o .rpm vê, ao atualizar,
// "Cannot read properties of undefined (reading 'info')". Falha se faltar AppImage, deb ou rpm.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const yaml = require('js-yaml');

const dist = path.join(__dirname, '..', 'dist');
const arq = path.join(dist, 'latest-linux.yml');
const y = yaml.load(fs.readFileSync(arq, 'utf8'));
const lista = y.files || (y.files = []);
const sha512 = (f) => crypto.createHash('sha512').update(fs.readFileSync(f)).digest('base64');

const pacotes = fs.readdirSync(dist).filter((n) => n.startsWith(`PostigoVPN-${y.version}.`) && /\.(AppImage|deb|rpm)$/.test(n));
for (const nome of pacotes) {
  const f = path.join(dist, nome);
  const atual = lista.find((x) => x.url === nome);
  if (atual) { // confere o que o electron-builder escreveu
    if (atual.sha512 !== sha512(f)) throw new Error(`sha512 de ${nome} não confere com o latest-linux.yml`);
  } else {
    lista.push({ url: nome, sha512: sha512(f), size: fs.statSync(f).size });
  }
}
for (const ext of ['AppImage', 'deb', 'rpm']) {
  if (!lista.some((x) => x.url.endsWith(`.${ext}`))) throw new Error(`latest-linux.yml sem o pacote .${ext}`);
}
fs.writeFileSync(arq, yaml.dump(y, { lineWidth: -1 }));
console.log('latest-linux.yml:', lista.map((x) => x.url).join(', '));
