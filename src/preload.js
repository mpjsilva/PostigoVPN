'use strict';
const { contextBridge, ipcRenderer } = require('electron');
const inv = (c, ...a) => ipcRenderer.invoke(c, ...a);
const ouvir = (c) => (fn) => { const h = (_e, d) => fn(d); ipcRenderer.on(c, h); return () => ipcRenderer.removeListener(c, h); };

contextBridge.exposeInMainWorld('api', {
  estadoInicial: () => inv('estado-inicial'),
  importarArquivos: () => inv('importar-arquivos'),
  exportarConexoes: (incluirCredenciais) => inv('exportar-conexoes', incluirCredenciais),
  renomear: (id, nome) => inv('renomear', id, nome),
  remover: (id) => inv('remover', id),
  conectar: (dados) => inv('conectar', dados),
  desconectar: () => inv('desconectar'),
  esquecerCredenciais: (id) => inv('esquecer-credenciais', id),
  prefs: () => inv('prefs'),
  setIniciarComSistema: (v) => inv('set-iniciar-com-sistema', v),
  buscarAtualizacao: () => inv('buscar-atualizacao'),
  setConfig: (c) => inv('set-config', c),
  aoEstado: ouvir('estado'), aoLog: ouvir('log'), aoBytes: ouvir('bytes'), aoPerfis: ouvir('perfis'),
});
