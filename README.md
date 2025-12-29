# 🤖 Bot de WhatsApp - Avisos e Tiragem de Falta

Bot automatizado para WhatsApp que gerencia avisos em grupo e realiza tiragem de falta diária.

## ✨ Funcionalidades

### 📢 Comando de Aviso (`!aviso`)
Marca todos os participantes do grupo com uma mensagem de aviso personalizada.

```
!aviso Reunião amanhã às 14h no auditório!
```

### 📊 Tiragem de Falta Automática
Todos os dias úteis (segunda a sexta), no horário configurado, o bot envia automaticamente:
1. Uma mensagem marcando todos os participantes
2. Uma enquete com as opções: Presente, Ausente, Atestado

### 🆔 Identificação do Grupo (`!grupoid`)
Mostra o ID do grupo atual para configuração.

### ❓ Ajuda (`!help`)
Lista todos os comandos disponíveis.

## 🚀 Instalação

### Pré-requisitos
- [Node.js](https://nodejs.org/) versão 18 ou superior
- NPM (vem junto com o Node.js)
- Google Chrome instalado (necessário para whatsapp-web.js)

### Passos

1. **Clone ou baixe o projeto**

2. **Instale as dependências**
   ```bash
   npm install
   ```

3. **Configure o ambiente**
   - Copie o arquivo `.env.example` para `.env`
   - Edite as configurações conforme necessário:
   
   ```env
   # Horário da tiragem de falta (formato 24h)
   TIRAGEM_HORA=08
   TIRAGEM_MINUTO=00
   
   # IDs dos grupos autorizados (deixe vazio para permitir todos)
   GRUPOS_AUTORIZADOS=
   
   # Prefixo dos comandos
   PREFIXO_COMANDO=!
   ```

4. **Inicie o bot**
   ```bash
   npm start
   ```

5. **Escaneie o QR Code**
   - Um QR Code aparecerá no terminal
   - Abra o WhatsApp no celular
   - Vá em **Configurações > Aparelhos conectados > Conectar aparelho**
   - Escaneie o QR Code

## 📖 Comandos Disponíveis

| Comando | Descrição |
|---------|-----------|
| `!aviso [mensagem]` | Envia aviso marcando todos |
| `!grupoid` | Mostra o ID do grupo |
| `!help` | Lista os comandos |
| `!teste` | Verifica se o bot está online |

## ⚙️ Configurações

### Horário da Tiragem de Falta
No arquivo `.env`, configure:
```env
TIRAGEM_HORA=08    # Hora (0-23)
TIRAGEM_MINUTO=00  # Minuto (0-59)
```

### Restringir Grupos
Para que o bot funcione apenas em grupos específicos:

1. No grupo desejado, envie `!grupoid`
2. Copie o ID mostrado
3. Cole no `.env`:
```env
GRUPOS_AUTORIZADOS=120363XXXXX@g.us,120363YYYYY@g.us
```

## 🏃 Modo Desenvolvimento

Para desenvolvimento com hot-reload:
```bash
npm run dev
```

## 📁 Estrutura do Projeto

```
whatsapp-bot/
├── src/
│   ├── index.js                 # Arquivo principal
│   ├── commands/
│   │   └── commandHandler.js    # Gerenciador de comandos
│   ├── schedulers/
│   │   └── tiragemFalta.js      # Agendador da tiragem
│   └── utils/
│       └── helpers.js           # Funções auxiliares
├── .env                         # Configurações (não commitar)
├── .env.example                 # Exemplo de configurações
├── .gitignore                   # Arquivos ignorados
├── package.json                 # Dependências
└── README.md                    # Este arquivo
```

## ⚠️ Observações Importantes

1. **Mantenha o bot rodando**: O bot precisa estar executando para funcionar
2. **Não desconecte o WhatsApp**: Se desconectar, será necessário escanear o QR novamente
3. **Sessão salva**: Após o primeiro escaneamento, a sessão é salva na pasta `.wwebjs_auth`
4. **Uso responsável**: Respeite os termos de serviço do WhatsApp

## 🛠️ Solução de Problemas

### O QR Code não aparece
- Verifique se o Chrome está instalado
- Delete a pasta `.wwebjs_auth` e tente novamente

### Bot não responde aos comandos
- Verifique se o bot está online (use `!teste`)
- Confirme se o prefixo está correto no `.env`
- Verifique se o grupo está autorizado

### Erro de conexão
- Verifique sua conexão com internet
- Reinicie o bot com `npm start`

## 📝 Licença

MIT License - Sinta-se livre para usar e modificar!

---

Desenvolvido com ❤️ para automatizar suas tarefas de grupo!
