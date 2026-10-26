create extension if not exists pgcrypto;

create table if not exists public.produtos (
  id uuid primary key default gen_random_uuid(),
  nome varchar(120) not null check (char_length(trim(nome)) >= 2),
  codigo_barras varchar(40) not null unique,
  categoria varchar(80) not null,
  criado_em timestamptz not null default now()
);

alter table public.produtos add column if not exists ativo boolean not null default true;

create table if not exists public.lotes (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references public.produtos(id) on delete cascade,
  numero_lote varchar(50) not null,
  validade date not null,
  quantidade integer not null check (quantidade >= 0),
  criado_em timestamptz not null default now(),
  unique (produto_id, numero_lote)
);

create table if not exists public.movimentacoes (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references public.produtos(id),
  lote_id uuid references public.lotes(id),
  tipo varchar(20) not null check (tipo in ('ENTRADA','SAIDA')),
  quantidade integer not null check (quantidade > 0),
  criado_em timestamptz not null default now()
);

alter table public.produtos disable row level security;
alter table public.lotes disable row level security;
alter table public.movimentacoes disable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.produtos to anon, authenticated;
grant select, insert, update, delete on public.lotes to anon, authenticated;
grant select, insert, update, delete on public.movimentacoes to anon, authenticated;

create or replace function public.registrar_saida_fefo(p_produto_id uuid, p_quantidade integer)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restante integer := p_quantidade;
  v_total integer;
  r record;
  v_baixa integer;
begin
  if p_produto_id is null then
    raise exception 'Produto não informado.';
  end if;
  if p_quantidade is null or p_quantidade <= 0 then
    raise exception 'A quantidade deve ser maior que zero.';
  end if;

  if not exists(select 1 from public.produtos where id = p_produto_id and ativo = true) then
    raise exception 'Produto inexistente ou arquivado.';
  end if;

  select coalesce(sum(quantidade),0) into v_total
  from public.lotes
  where produto_id = p_produto_id and quantidade > 0;

  if v_total < p_quantidade then
    raise exception 'Estoque insuficiente. Disponível: % unidade(s).', v_total;
  end if;

  for r in
    select id, quantidade
    from public.lotes
    where produto_id = p_produto_id and quantidade > 0
    order by validade asc, criado_em asc
    for update
  loop
    exit when v_restante <= 0;
    v_baixa := least(v_restante, r.quantidade);

    update public.lotes set quantidade = quantidade - v_baixa where id = r.id;
    insert into public.movimentacoes(produto_id,lote_id,tipo,quantidade)
    values (p_produto_id,r.id,'SAIDA',v_baixa);

    v_restante := v_restante - v_baixa;
  end loop;

  return format('Saída de %s unidade(s) registrada com sucesso usando FEFO.', p_quantidade);
end;
$$;

grant execute on function public.registrar_saida_fefo(uuid,integer) to anon, authenticated;

create or replace function public.ajustar_estoque_lote(p_lote_id uuid, p_nova_quantidade integer)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_atual integer;
  v_produto_id uuid;
  v_diferenca integer;
begin
  if p_lote_id is null then
    raise exception 'Lote não informado.';
  end if;
  if p_nova_quantidade is null or p_nova_quantidade < 0 then
    raise exception 'A nova quantidade deve ser maior ou igual a zero.';
  end if;

  select quantidade, produto_id into v_atual, v_produto_id
  from public.lotes
  where id = p_lote_id
  for update;

  if not found then
    raise exception 'Lote não encontrado.';
  end if;

  v_diferenca := p_nova_quantidade - v_atual;

  if v_diferenca = 0 then
    return 'Nenhuma alteração de estoque foi necessária.';
  end if;

  update public.lotes set quantidade = p_nova_quantidade where id = p_lote_id;

  if v_diferenca > 0 then
    insert into public.movimentacoes(produto_id,lote_id,tipo,quantidade)
    values (v_produto_id,p_lote_id,'ENTRADA',v_diferenca);
  else
    insert into public.movimentacoes(produto_id,lote_id,tipo,quantidade)
    values (v_produto_id,p_lote_id,'SAIDA',abs(v_diferenca));
  end if;

  return format('Estoque ajustado de %s para %s unidade(s).', v_atual, p_nova_quantidade);
end;
$$;

grant execute on function public.ajustar_estoque_lote(uuid,integer) to anon, authenticated;

create or replace function public.log_entrada_lote()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.quantidade > 0 then
    insert into public.movimentacoes(produto_id,lote_id,tipo,quantidade)
    values (new.produto_id,new.id,'ENTRADA',new.quantidade);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_log_entrada_lote on public.lotes;
create trigger trg_log_entrada_lote
after insert on public.lotes
for each row execute function public.log_entrada_lote();
