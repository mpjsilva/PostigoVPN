# PostigoVPN

Interface gráfica (Electron) para o **OpenVPN CLI** no Linux, no visual Liquid Glass do Dual Messenger.

*Postigo*: a portinha dentro do portão grande, por onde se passa sem abrir tudo.

- Importar e exportar **todas as conexões** (`.ovpn`, `.conf` ou pacote `.json`; senhas só se marcado).
- Conecta com `pkexec openvpn`; a interface de gerenciamento do OpenVPN faz o desconectar sem pedir senha de novo.
- Credenciais cifradas com chave própria (sem chaveiro do sistema).
- Bandeja do sistema, tema automático/claro/escuro.
- **Iniciar com o sistema** (abre na bandeja) e **atualização automática** pelas releases do GitHub.

## Instalar

Baixe em [Releases](https://github.com/mpjsilva/PostigoVPN/releases): `.AppImage`, `.deb` ou `.rpm`.
Requer `openvpn` e `polkit` (o `.deb` e o `.rpm` já os declaram como dependência).

### Veio do OpenVPN Connect (versões 1.0 e 1.1)?

Este projeto se chamava *OpenVPN Connect*. Instalando o `.deb` ou o `.rpm` do PostigoVPN, o pacote antigo
`openvpn-connect` é substituído automaticamente. No primeiro uso, o PostigoVPN traz sozinho suas conexões,
senhas salvas e preferências (a pasta antiga `~/.config/OpenVPN Connect` é mantida, pode apagar depois), e
o "iniciar com o sistema" passa para o atalho novo. Pacotes `.json` exportados pela versão antiga continuam importáveis.

## Desenvolver

```
npm install
npm start          # roda o app
npm test           # testes (inclui um OpenVPN falso)
npm run dist       # AppImage + deb em dist/, e o rpm num contêiner Fedora (scripts/rpm)
```

Atualização automática: `electron-updater` lê `latest-linux.yml` da última release; só atua no app empacotado.

Identidade da janela: um único identificador, `postigovpn`, vale para o nome do executável, do `.desktop`,
do ícone, o `StartupWMClass` e o `app_id`. Sem essa coerência o ambiente de desktop não associa a janela ao
atalho e mostra ícone genérico.

## Aviso

Projeto **independente e não oficial**. “OpenVPN” e o logotipo do OpenVPN são marcas da OpenVPN Inc. e
aparecem aqui só para indicar a compatibilidade com o OpenVPN; este projeto não tem relação com a
OpenVPN Inc. nem com o app oficial “OpenVPN Connect”.
