# TeepOEE – Protótipo: Validação de Sequência entre Operações

Este protótipo implementa a lógica do documento DDP-FACCHINI-SEQ002 para visualização e validação da sequência entre operações de uma mesma OP, com reportes parciais e parametrização por máquina.

## Como usar

1. Abra `index.html` em um navegador (Chrome/Edge).
2. Selecione uma OP no topo.
3. Observe as operações e previsões.
4. No painel de simulação, selecione a operação e informe a quantidade a reportar.
5. Veja o resultado (OK/Alerta/Trava) e o histórico.
6. Ajuste os parâmetros no painel lateral e clique em “Salvar parâmetros”.

Dados de parâmetros e reportes são persistidos em `localStorage` do navegador.

## Parâmetros

- Travar/alertar por sequência: Nenhum | Alerta | Trava
- Mostrar previsão da operação anterior (ERP): Sim | Não
- Fonte da quantidade prevista: ERP | Manual (com campo de quantidade)

## Regras

- Primeira operação: sem validação de sequência.
- Demais: a soma reportada não deve exceder a quantidade prevista da operação anterior (origem: ERP ou Manual), conforme parametrização:
  - Nenhum: permite; informa.
  - Alerta: permite; alerta ao exceder.
  - Trava: bloqueia ao exceder.

## Estrutura

- `index.html`: layout e containers
- `styles.css`: estilos
- `app.js`: mock de dados, estado, renderização e validação


