# TeepOEE – Protótipo: Validação de Sequência entre Operações

Este protótipo implementa a lógica do documento DDP-FACCHINI-SEQ002 para visualização e validação da sequência entre operações de uma mesma OP, com reportes parciais e controle de produção por máquina.

## Como usar

1. Abra `index.html` em um navegador (Chrome/Edge recomendado).
2. Selecione uma OP no seletor no topo da página.
3. Visualize a tabela "Operações da OP" com os dados consolidados.
4. Nos cards de máquinas, apontar produção e refugo:
   - Informe a quantidade de peças boas e clique em "Apontar Produção"
   - Informe a quantidade de refugos e clique em "Apontar Refugo"
5. Para fechar uma operação, clique em "Fechar OP" e confirme no popup.
6. Visualize eventos pendentes no painel lateral "App Supervisor" (simulação mobile).
7. Acesse o relatório de excessos na seção "Relatório de Excessos".

Dados de apontamentos, eventos e configurações são persistidos em `localStorage` do navegador.

## Funcionalidades Principais

### Apontamento de Produção

- **Cards por Máquina**: Cada operação é exibida em um card separado, simulando máquinas distintas.
- **Apontamento de Produção**: Informe a quantidade de peças boas produzidas e clique em "Apontar Produção".
- **Apontamento de Refugo**: Informe a quantidade de peças refugadas e clique em "Apontar Refugo".
  - O refugo reduz as peças boas finais (boas finais = boas produzidas - refugos).
- **Validação em Tempo Real**: O sistema valida as quantidades antes de salvar.

### Regras de Validação

- **Primeira Etapa**: A quantidade produzida (boas + refugos) não pode exceder a quantidade prevista da OP.
- **Demais Etapas**: A quantidade produzida não pode exceder as peças boas finais da etapa anterior.
- **Excesso de Produção**: Se o operador tentar produzir acima do permitido:
  - Um popup de confirmação é exibido
  - Se confirmar, a produção é gravada e um evento é gerado para o supervisor
  - Se cancelar, nada é salvo

### Fechamento de Operação

- Cada máquina possui um botão "Fechar OP" para finalizar o apontamento daquela etapa.
- Ao clicar, um popup exibe:
  - Quantidade Prevista
  - Quantidade Pendente
  - Quantidade Produzida
- Após confirmar o fechamento:
  - A operação fica bloqueada para novos apontamentos
  - Campos e botões são desabilitados
  - Uma mensagem informa que a operação está fechada

### Sistema de Eventos e Escalonamento

- **Eventos de Excesso**: Quando o operador confirma produção acima do permitido, um evento é gerado automaticamente.
- **Painel do Supervisor**: Simula um aplicativo mobile onde o supervisor visualiza eventos pendentes.
- **Justificativa**: O supervisor pode abrir um evento, selecionar um motivo e justificar o excesso.
- **Escalonamento por Email**:
  - Configure o tempo (em minutos) para disparo automático de email
  - Se um evento não for resolvido no tempo configurado, o sistema simula o envio de um email de alerta
  - Quando o supervisor resolve um evento que já teve email disparado, um segundo email de encerramento é simulado
- **Relatório de Excessos**: Tabela completa com todos os eventos, incluindo:
  - Data/hora da confirmação do operador
  - Data/hora da justificativa do supervisor
  - Tempo de resposta
  - Disparos de email (alerta e encerramento)

### Navegação

- **Aba Apontamento**: Tela principal com cards de máquinas, tabela de operações, painel do supervisor e relatório.
- **Aba DDP 360**: Documentação completa do processo e formulário de aprovação técnica.

## Estrutura de Arquivos

- `index.html`: Estrutura HTML, layout e containers
- `styles.css`: Estilos e tema visual (tema claro)
- `app.js`: Lógica de negócio, validações, renderização e gerenciamento de estado

## Dados Mock

O sistema utiliza dados de exemplo (OPs e operações) para demonstração:
- **VIGA001**: Viga de carroceria (Corte, Solda, Pintura)
- **VIGA002**: Viga de carroceria (Corte, Sobra, Acabamento)

## Persistência

Todos os dados são salvos no `localStorage` do navegador:
- Apontamentos de produção e refugo
- Eventos de excesso (pendentes e resolvidos)
- Operações fechadas
- Configurações (tempo de escalonamento por email)

Use o botão "Reset Teste" para limpar os dados da OP atual.

## Observações Importantes

⚠️ **Este é um sistema ilustrativo da lógica. Não é a versão oficial do sistema.**

O protótipo demonstra:
- Validação sequencial entre operações
- Controle de produção por máquina
- Sistema de eventos e notificações
- Escalonamento automático por email
- Auditoria e rastreabilidade

Para implantação oficial, será necessária integração com:
- ERP (para dados de OPs e operações)
- Sistema de autenticação
- TeepNotificação (para envio real de emails)
- Banco de dados (para persistência definitiva)
