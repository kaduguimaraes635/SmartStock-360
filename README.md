# SmartStock 360

Sistema web desenvolvido para o Projeto Integrador II com foco no controle de validade e estoque por lote em pequenos mercados.

## Funcionalidades

- Cadastro e edição de produtos
- Arquivamento e reativação de produtos sem perder o histórico
- Cadastro de lotes com quantidade e data de validade
- Classificação automática de lotes vencidos, críticos e próximos do vencimento
- Ajuste de estoque com registro da movimentação
- Saída manual utilizando FEFO
- Importação de vendas por CSV com validação de código de barras e estoque
- Histórico de entradas e saídas com filtros
- Exportação do histórico em CSV
- Dashboard com indicadores e alertas de validade
- Persistência dos dados no Supabase/PostgreSQL

## Tecnologias

- HTML
- CSS
- JavaScript
- Supabase
- PostgreSQL

## Configuração

1. Crie um projeto no Supabase.
2. Abra o SQL Editor e execute `supabase.sql`.
3. Copie `config.example.js` para `config.js`.
4. Preencha `config.js` com a URL e a chave pública do projeto Supabase.
5. Abra `index.html` no navegador.

Exemplo de configuração:

```js
window.SMARTSTOCK_CONFIG = {
  supabaseUrl: 'COLE_AQUI_A_URL',
  supabaseAnonKey: 'COLE_AQUI_A_CHAVE_PUBLICA'
};
```

O arquivo `config.js` está ignorado pelo Git para evitar publicar a configuração local do projeto.

## Importação de vendas

O CSV deve conter uma coluna de código de barras e outra de quantidade. Exemplo:

```csv
codigo_barras;quantidade
7891234567890;2
7899876543210;1
```

Também são reconhecidos os cabeçalhos `codigo`, `ean`, `qtd` e `qtde`.

Antes de processar o arquivo, o sistema mostra uma prévia e verifica se o produto existe e se há estoque suficiente. As vendas válidas são baixadas seguindo FEFO.

## Regra FEFO

FEFO significa First Expire, First Out. Quando uma saída é registrada, o sistema utiliza primeiro o lote com a data de validade mais próxima.

## Estrutura do banco

- `produtos`: catálogo dos produtos
- `lotes`: lotes, quantidades e validades
- `movimentacoes`: histórico de entradas e saídas

## Projeto acadêmico

O SmartStock 360 é um protótipo acadêmico em evolução. A proposta é reduzir o controle manual de validade e permitir, posteriormente, integração mais direta com dados de venda do sistema utilizado pelo estabelecimento.
