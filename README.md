# OpenVPN Connect

Cliente gráfico (Electron) para perfis `.ovpn` no Linux, no visual Liquid Glass do Dual Messenger.

- Importar e exportar **todas as conexões** (`.ovpn`, `.conf` ou pacote `.json`; senhas só se marcado).
- Conecta com `pkexec openvpn`; a interface de gerenciamento do OpenVPN faz o desconectar sem pedir senha de novo.
- Credenciais cifradas com chave própria (sem chaveiro do sistema).
- Bandeja do sistema, tema automático/claro/escuro.
- **Iniciar com o sistema** (abre na bandeja) e **atualização automática** pelas releases do GitHub.

## Instalar

Baixe em [Releases](https://github.com/mpjsilva/openvpn-connect/releases): `.AppImage`, `.deb` ou `.rpm`.
Requer `openvpn` e `polkit` (o `.deb` e o `.rpm` já os declaram como dependência).

## Desenvolver

```
npm install
npm start          # roda o app
npm test           # testes (inclui um OpenVPN falso)
npm run dist       # AppImage + deb em dist/
npm run dist:rpm   # rpm, num contêiner Fedora (scripts/rpm)
```

Atualização automática: `electron-updater` lê `latest-linux.yml` da última release; só atua no app empacotado.
