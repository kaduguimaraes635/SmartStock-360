# SmartStock 360

Sistema desenvolvido para o Projeto Integrador II com foco no controle de validade, lotes e movimentação de estoque em pequenos mercados.

O objetivo do projeto é facilitar o acompanhamento de produtos próximos do vencimento, reduzir perdas e tornar o controle de estoque mais organizado e eficiente.

## Funcionalidades

- Cadastro e edição de produtos
- Arquivamento e reativação de produtos
- Cadastro de lotes com quantidade e data de validade
- Consulta de produtos por validade
- Classificação automática de produtos vencidos, próximos do vencimento e dentro da validade
- Ajuste de estoque
- Registro de entradas e saídas
- Baixa automática utilizando a regra FEFO
- Histórico de movimentações
- Filtros de movimentação
- Exportação de histórico em CSV
- Importação de vendas por arquivo CSV
- Baixa automática de estoque a partir das vendas importadas
- Dashboard com resumo do estoque e alertas de validade

## Regra FEFO

O sistema utiliza a regra FEFO — First Expired, First Out.

Isso significa que, ao registrar uma saída, o sistema utiliza primeiro o lote com a data de validade mais próxima.

Caso a quantidade de um lote não seja suficiente, o sistema continua automaticamente no próximo lote disponível.

## Importação de vendas

O SmartStock 360 já possui uma funcionalidade de importação de vendas por arquivo CSV.

O arquivo utiliza o código de barras do produto e a quantidade vendida. Após a importação, o sistema identifica o produto e realiza a baixa automática no estoque seguindo a regra FEFO.

Essa funcionalidade foi desenvolvida como uma etapa inicial para uma futura integração com o sistema de vendas utilizado pelo mercado.

## Banco de dados

O projeto utiliza o Supabase como banco de dados.

As principais informações armazenadas são:

- Produtos
- Lotes
- Quantidades
- Datas de validade
- Entradas
- Saídas
- Ajustes de estoque
- Histórico de movimentações

## Tecnologias utilizadas

- HTML
- CSS
- JavaScript
- Supabase
- PostgreSQL
- Git
- GitHub

## Status do projeto

O sistema está em desenvolvimento e já possui os principais fluxos funcionais.

Atualmente, o SmartStock 360 permite cadastrar e gerenciar produtos e lotes, controlar validade, registrar movimentações de estoque e importar vendas por CSV.

## Próximas melhorias

Entre as melhorias previstas estão:

- integração direta com o sistema utilizado pelo mercado;
- automatização da importação das vendas;
- melhorias de interface e usabilidade;
- alertas automáticos de produtos próximos do vencimento;
- relatórios mais completos;
- melhorias para tornar o processo de conferência e movimentação de estoque mais rápido.


## Projeto

Projeto Integrador II — Engenharia de Software