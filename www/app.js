const cfg=window.SMARTSTOCK_CONFIG||{};
const configured=cfg.supabaseUrl&&!cfg.supabaseUrl.includes('COLE_AQUI')&&cfg.supabaseAnonKey&&!cfg.supabaseAnonKey.includes('COLE_AQUI');
const sb=configured?window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey):null;
let produtos=[];
let lotes=[];
let movimentos=[];
let csvPreview=[];
const $=id=>document.getElementById(id);
function showAlert(message,type='success'){
  const el=$('alertBox');
  el.textContent=message;
  el.className=`mensagem ${type}`;
  window.scrollTo({top:0,behavior:'smooth'});
  clearTimeout(showAlert.timer);
  showAlert.timer=setTimeout(()=>el.classList.add('oculto'),5000);
}
function escapeHtml(value){
  return String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}
function fmtDate(dateStr){
  if(!dateStr)return '-';
  const [y,m,d]=dateStr.split('-');
  return `${d}/${m}/${y}`;
}
function fmtDateTime(value){
  if(!value)return '-';
  return new Date(value).toLocaleString('pt-BR');
}
function diasParaValidade(validade){
  const hoje=new Date();
  hoje.setHours(0,0,0,0);
  const data=new Date(validade+'T00:00:00');
  return Math.ceil((data-hoje)/86400000);
}
function statusLote(loteOuValidade,quantidade){
  const validade=typeof loteOuValidade==='string'?loteOuValidade:loteOuValidade.validade;
  const qtd=typeof loteOuValidade==='string'?quantidade:loteOuValidade.quantidade;
  if(Number(qtd)===0)return{key:'zerado',label:'Sem estoque',dias:null};
  const dias=diasParaValidade(validade);
  if(dias<0)return{key:'vencido',label:'Vencido',dias};
  if(dias<=7)return{key:'critico',label:dias===0?'Vence hoje':`${dias} dia${dias===1?'':'s'}`,dias};
  if(dias<=30)return{key:'proximo',label:`${dias} dias`,dias};
  return{key:'ok',label:'Normal',dias};
}
function badge(lote){
  const status=statusLote(lote);
  return `<span class="situacao ${status.key}">${status.label}</span>`;
}
function emptyRow(cols,text='Nenhum registro encontrado'){
  return `<tr><td class="vazio" colspan="${cols}">${text}</td></tr>`;
}
function estoqueProduto(produtoId){
  return lotes.filter(x=>x.produto_id===produtoId&&x.quantidade>0).reduce((s,x)=>s+Number(x.quantidade),0);
}
function lotesAtivosProduto(produtoId){
  return lotes.filter(x=>x.produto_id===produtoId&&x.quantidade>0).sort((a,b)=>a.validade.localeCompare(b.validade));
}
async function ensureConfigured(){
  if(configured)return true;
  showAlert('Configure a URL e a chave do Supabase no arquivo config.js.','error');
  return false;
}
async function loadAll(){
  if(!await ensureConfigured())return;
  const [p,l,m]=await Promise.all([
    sb.from('produtos').select('*').order('nome'),
    sb.from('lotes').select('*, produtos(nome,codigo_barras,ativo)').order('validade',{ascending:true}),
    sb.from('movimentacoes').select('*, produtos(nome,codigo_barras), lotes(numero_lote)').order('criado_em',{ascending:false}).limit(500)
  ]);
  const error=p.error||l.error||m.error;
  if(error){
    showAlert('Erro ao consultar o banco: '+error.message,'error');
    return;
  }
  produtos=p.data||[];
  lotes=l.data||[];
  movimentos=m.data||[];
  renderTudo();
}
function renderTudo(){
  const ativos=produtos.filter(p=>p.ativo!==false);
  const lotesComEstoque=lotes.filter(x=>x.quantidade>0);
  $('mProdutos').textContent=ativos.length;
  $('mUnidades').textContent=lotesComEstoque.reduce((s,x)=>s+Number(x.quantidade),0);
  $('mVencidos').textContent=lotesComEstoque.filter(x=>statusLote(x).key==='vencido').length;
  $('mProximos').textContent=lotesComEstoque.filter(x=>['critico','proximo'].includes(statusLote(x).key)).length;
  const prioritarios=lotesComEstoque.slice(0,12);
  $('dashboardRows').innerHTML=prioritarios.length?prioritarios.map(x=>`<tr><td>${escapeHtml(x.produtos?.nome||'-')}</td><td>${escapeHtml(x.numero_lote)}</td><td>${fmtDate(x.validade)}</td><td>${x.quantidade}</td><td>${badge(x)}</td></tr>`).join(''):emptyRow(5);
  renderAlertasResumo();
  renderProdutos();
  const options='<option value="">Selecione...</option>'+ativos.map(p=>`<option value="${p.id}">${escapeHtml(p.nome)} - ${escapeHtml(p.codigo_barras)}</option>`).join('');
  $('loteProduto').innerHTML=options;
  $('saidaProduto').innerHTML=options;
  renderLotes();
  renderMovimentacoesRecentes();
  renderHistorico();
  if(csvPreview.length)validarCsvPreview();
  atualizarInfoSaida();
}
function renderAlertasResumo(){
  const vencidos=lotes.filter(x=>x.quantidade>0&&statusLote(x).key==='vencido');
  const criticos=lotes.filter(x=>x.quantidade>0&&statusLote(x).key==='critico');
  const proximos=lotes.filter(x=>x.quantidade>0&&statusLote(x).key==='proximo');
  const itens=[];
  if(vencidos.length)itens.push(`<div class="alerta-item vermelho"><b>${vencidos.length} lote${vencidos.length>1?'s':''} vencido${vencidos.length>1?'s':''}</b><br>Retire ou revise esses itens antes de novas saídas.</div>`);
  if(criticos.length)itens.push(`<div class="alerta-item"><b>${criticos.length} lote${criticos.length>1?'s':''} vence${criticos.length===1?'':'m'} em até 7 dias</b><br>Priorize a venda e a conferência desses produtos.</div>`);
  if(proximos.length)itens.push(`<div class="alerta-item"><b>${proximos.length} lote${proximos.length>1?'s':''} vence${proximos.length===1?'':'m'} em até 30 dias</b><br>Acompanhe para evitar perdas.</div>`);
  if(!itens.length)itens.push('<div class="alerta-item verde"><b>Nenhuma validade crítica no momento.</b><br>Os lotes com estoque estão dentro do período normal.</div>');
  $('alertasResumo').innerHTML=itens.join('');
}
function renderProdutos(){
  const busca=$('buscaProduto').value.trim().toLowerCase();
  const filtro=$('filtroProdutoStatus').value;
  const lista=produtos.filter(p=>{
    const ativo=p.ativo!==false;
    const statusOk=filtro==='todos'||(filtro==='ativos'&&ativo)||(filtro==='arquivados'&&!ativo);
    const texto=`${p.nome} ${p.codigo_barras} ${p.categoria}`.toLowerCase();
    return statusOk&&(!busca||texto.includes(busca));
  });
  $('produtosRows').innerHTML=lista.length?lista.map(p=>{
    const ativo=p.ativo!==false;
    return `<tr><td>${escapeHtml(p.nome)}</td><td>${escapeHtml(p.codigo_barras)}</td><td>${escapeHtml(p.categoria)}</td><td><span class="situacao ${ativo?'ativo':'arquivado'}">${ativo?'Ativo':'Arquivado'}</span></td><td><div class="acoes-tabela"><button class="botao botao-secundario botao-pequeno" data-produto-editar="${p.id}">Editar</button><button class="botao ${ativo?'botao-perigo':'botao-secundario'} botao-pequeno" data-produto-status="${p.id}" data-ativo="${ativo?'0':'1'}">${ativo?'Arquivar':'Reativar'}</button></div></td></tr>`;
  }).join(''):emptyRow(5);
}
function renderLotes(){
  const filtro=$('filtroStatus').value;
  const busca=$('buscaLote').value.trim().toLowerCase();
  const lista=lotes.filter(x=>{
    const status=statusLote(x).key;
    let statusOk=filtro==='todos'||status===filtro;
    if(filtro==='proximo')statusOk=['critico','proximo'].includes(status);
    const texto=`${x.produtos?.nome||''} ${x.numero_lote}`.toLowerCase();
    return statusOk&&(!busca||texto.includes(busca));
  });
  $('lotesRows').innerHTML=lista.length?lista.map(x=>`<tr><td>${escapeHtml(x.produtos?.nome||'-')}</td><td>${escapeHtml(x.numero_lote)}</td><td>${fmtDate(x.validade)}</td><td>${x.quantidade}</td><td>${badge(x)}</td><td><div class="acoes-tabela"><button class="botao botao-secundario botao-pequeno" data-lote-editar="${x.id}">Editar</button><button class="botao botao-secundario botao-pequeno" data-lote-ajustar="${x.id}">Ajustar</button></div></td></tr>`).join(''):emptyRow(6);
}
function renderMovimentacoesRecentes(){
  const lista=movimentos.slice(0,30);
  $('movRows').innerHTML=lista.length?lista.map(x=>movRow(x)).join(''):emptyRow(5);
}
function movRow(x){
  return `<tr><td>${fmtDateTime(x.criado_em)}</td><td>${escapeHtml(x.produtos?.nome||'-')}</td><td>${escapeHtml(x.lotes?.numero_lote||'-')}</td><td>${escapeHtml(x.tipo)}</td><td>${x.quantidade}</td></tr>`;
}
function historicoFiltrado(){
  const busca=$('historicoBusca').value.trim().toLowerCase();
  const tipo=$('historicoTipo').value;
  const inicio=$('historicoInicio').value;
  const fim=$('historicoFim').value;
  return movimentos.filter(x=>{
    const texto=`${x.produtos?.nome||''} ${x.lotes?.numero_lote||''} ${x.tipo}`.toLowerCase();
    const data=x.criado_em?x.criado_em.slice(0,10):'';
    return (!busca||texto.includes(busca))&&(tipo==='todos'||x.tipo===tipo)&&(!inicio||data>=inicio)&&(!fim||data<=fim);
  });
}
function renderHistorico(){
  const lista=historicoFiltrado();
  $('historicoRows').innerHTML=lista.length?lista.map(x=>movRow(x)).join(''):emptyRow(5);
}
function editarProduto(id){
  const p=produtos.find(x=>x.id===id);
  if(!p)return;
  $('produtoId').value=p.id;
  $('produtoNome').value=p.nome;
  $('produtoCodigo').value=p.codigo_barras;
  $('produtoCategoria').value=p.categoria;
  $('produtoFormTitulo').textContent='Editar produto';
  $('produtoSalvarBtn').textContent='Salvar alterações';
  $('produtoCancelarBtn').classList.remove('oculto');
  $('produtoNome').focus();
}
function cancelarEdicaoProduto(){
  $('produtoForm').reset();
  $('produtoId').value='';
  $('produtoFormTitulo').textContent='Cadastrar produto';
  $('produtoSalvarBtn').textContent='Salvar produto';
  $('produtoCancelarBtn').classList.add('oculto');
}
function abrirModal(id){$(id).classList.remove('oculto')}
function fecharModal(id){$(id).classList.add('oculto')}
function abrirEdicaoLote(id){
  const l=lotes.find(x=>x.id===id);
  if(!l)return;
  $('editarLoteId').value=l.id;
  $('editarLoteNumero').value=l.numero_lote;
  $('editarLoteValidade').value=l.validade;
  $('modalLoteSubtitulo').textContent=`${l.produtos?.nome||''} • estoque atual: ${l.quantidade}`;
  abrirModal('modalLote');
}
function abrirAjusteLote(id){
  const l=lotes.find(x=>x.id===id);
  if(!l)return;
  $('ajusteLoteId').value=l.id;
  $('ajusteQuantidade').value=l.quantidade;
  $('modalAjusteSubtitulo').textContent=`${l.produtos?.nome||''} • lote ${l.numero_lote} • atual: ${l.quantidade}`;
  abrirModal('modalAjuste');
}
function atualizarInfoSaida(){
  const id=$('saidaProduto').value;
  if(!id){$('saidaEstoqueInfo').textContent='Selecione um produto para consultar o estoque.';return}
  const lista=lotesAtivosProduto(id);
  const total=lista.reduce((s,x)=>s+Number(x.quantidade),0);
  if(!lista.length){$('saidaEstoqueInfo').textContent='Produto sem estoque disponível.';return}
  const primeiro=lista[0];
  $('saidaEstoqueInfo').textContent=`Estoque disponível: ${total} unidade(s). Primeiro lote FEFO: ${primeiro.numero_lote}, validade ${fmtDate(primeiro.validade)}.`;
}
$('produtoForm').addEventListener('submit',async e=>{
  e.preventDefault();
  if(!await ensureConfigured())return;
  const id=$('produtoId').value;
  const nome=$('produtoNome').value.trim();
  const codigo=$('produtoCodigo').value.trim();
  const categoria=$('produtoCategoria').value.trim();
  if(nome.length<2||codigo.length<4||categoria.length<2){showAlert('Preencha nome, código de barras e categoria corretamente.','error');return}
  const query=id?sb.from('produtos').update({nome,codigo_barras:codigo,categoria}).eq('id',id):sb.from('produtos').insert({nome,codigo_barras:codigo,categoria});
  const{error}=await query;
  if(error){showAlert(error.code==='23505'?'Já existe um produto com esse código de barras.':'Erro ao salvar produto: '+error.message,'error');return}
  cancelarEdicaoProduto();
  showAlert(id?'Produto atualizado com sucesso.':'Produto cadastrado com sucesso.');
  await loadAll();
});
$('produtoCancelarBtn').addEventListener('click',cancelarEdicaoProduto);
$('produtosRows').addEventListener('click',async e=>{
  const editar=e.target.closest('[data-produto-editar]');
  if(editar){editarProduto(editar.dataset.produtoEditar);return}
  const status=e.target.closest('[data-produto-status]');
  if(status){
    const id=status.dataset.produtoStatus;
    const ativo=status.dataset.ativo==='1';
    const p=produtos.find(x=>x.id===id);
    if(!p)return;
    const acao=ativo?'reativar':'arquivar';
    if(!confirm(`Deseja ${acao} o produto "${p.nome}"?`))return;
    const{error}=await sb.from('produtos').update({ativo}).eq('id',id);
    if(error){showAlert('Erro ao alterar o status do produto: '+error.message,'error');return}
    showAlert(`Produto ${ativo?'reativado':'arquivado'} com sucesso.`);
    await loadAll();
  }
});
$('loteForm').addEventListener('submit',async e=>{
  e.preventDefault();
  if(!await ensureConfigured())return;
  const produto_id=$('loteProduto').value;
  const numero_lote=$('loteNumero').value.trim();
  const validade=$('loteValidade').value;
  const quantidade=Number($('loteQuantidade').value);
  if(!produto_id||!numero_lote||!validade||!Number.isInteger(quantidade)||quantidade<=0){showAlert('Preencha todos os campos do lote corretamente.','error');return}
  const{error}=await sb.from('lotes').insert({produto_id,numero_lote,validade,quantidade});
  if(error){showAlert(error.code==='23505'?'Esse lote já foi cadastrado para esse produto.':'Erro ao cadastrar lote: '+error.message,'error');return}
  e.target.reset();
  showAlert('Lote cadastrado com sucesso.');
  await loadAll();
});
$('lotesRows').addEventListener('click',e=>{
  const editar=e.target.closest('[data-lote-editar]');
  if(editar){abrirEdicaoLote(editar.dataset.loteEditar);return}
  const ajustar=e.target.closest('[data-lote-ajustar]');
  if(ajustar)abrirAjusteLote(ajustar.dataset.loteAjustar);
});
$('editarLoteForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const id=$('editarLoteId').value;
  const numero_lote=$('editarLoteNumero').value.trim();
  const validade=$('editarLoteValidade').value;
  if(!id||!numero_lote||!validade)return;
  const{error}=await sb.from('lotes').update({numero_lote,validade}).eq('id',id);
  if(error){showAlert('Erro ao editar lote: '+error.message,'error');return}
  fecharModal('modalLote');
  showAlert('Lote atualizado com sucesso.');
  await loadAll();
});
$('ajusteForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const loteId=$('ajusteLoteId').value;
  const novaQuantidade=Number($('ajusteQuantidade').value);
  if(!loteId||!Number.isInteger(novaQuantidade)||novaQuantidade<0){showAlert('Informe uma quantidade válida.','error');return}
  const{data,error}=await sb.rpc('ajustar_estoque_lote',{p_lote_id:loteId,p_nova_quantidade:novaQuantidade});
  if(error){showAlert('Não foi possível ajustar o estoque: '+error.message,'error');return}
  fecharModal('modalAjuste');
  showAlert(data||'Estoque ajustado com sucesso.');
  await loadAll();
});
$('saidaForm').addEventListener('submit',async e=>{
  e.preventDefault();
  if(!await ensureConfigured())return;
  const produto_id=$('saidaProduto').value;
  const quantidade=Number($('saidaQuantidade').value);
  if(!produto_id||!Number.isInteger(quantidade)||quantidade<=0){showAlert('Selecione um produto e informe uma quantidade válida.','error');return}
  const{data,error}=await sb.rpc('registrar_saida_fefo',{p_produto_id:produto_id,p_quantidade:quantidade});
  if(error){showAlert('Não foi possível registrar a saída: '+error.message,'error');return}
  e.target.reset();
  showAlert(data||'Saída registrada com sucesso.');
  await loadAll();
});
$('saidaProduto').addEventListener('change',atualizarInfoSaida);
function parseCsvLine(line,delimiter){
  const out=[];
  let atual='';
  let aspas=false;
  for(let i=0;i<line.length;i++){
    const c=line[i];
    if(c==='"'){
      if(aspas&&line[i+1]==='"'){atual+='"';i++}else aspas=!aspas;
    }else if(c===delimiter&&!aspas){out.push(atual.trim());atual=''}else atual+=c;
  }
  out.push(atual.trim());
  return out.map(v=>v.replace(/^"|"$/g,''));
}
function normalizarCabecalho(value){
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,'_');
}
function lerCsv(texto){
  const linhas=texto.replace(/^\uFEFF/,'').split(/\r?\n/).filter(x=>x.trim());
  if(linhas.length<2)throw new Error('O arquivo precisa ter cabeçalho e pelo menos uma venda.');
  const delimiter=(linhas[0].match(/;/g)||[]).length>(linhas[0].match(/,/g)||[]).length?';':',';
  const headers=parseCsvLine(linhas[0],delimiter).map(normalizarCabecalho);
  const idxCodigo=['codigo_barras','codigo','ean','cod_barras'].map(x=>headers.indexOf(x)).find(x=>x>=0);
  const idxQtd=['quantidade','qtd','qtde'].map(x=>headers.indexOf(x)).find(x=>x>=0);
  if(idxCodigo===undefined||idxQtd===undefined)throw new Error('Não encontrei as colunas de código de barras e quantidade.');
  return linhas.slice(1).map((linha,i)=>{
    const cols=parseCsvLine(linha,delimiter);
    return{linha:i+2,codigo:String(cols[idxCodigo]||'').trim(),quantidade:Number(String(cols[idxQtd]||'').replace(',','.'))};
  }).filter(x=>x.codigo||x.quantidade);
}
function validarCsvPreview(){
  csvPreview=csvPreview.map(item=>{
    const p=produtos.find(x=>String(x.codigo_barras).trim()===item.codigo);
    const estoque=p?estoqueProduto(p.id):0;
    let status='Pronto';
    let tipo='ok';
    if(!item.codigo){status='Código vazio';tipo='erro'}
    else if(!Number.isInteger(item.quantidade)||item.quantidade<=0){status='Quantidade inválida';tipo='erro'}
    else if(!p){status='Produto não encontrado';tipo='erro'}
    else if(p.ativo===false){status='Produto arquivado';tipo='erro'}
    else if(estoque<item.quantidade){status=`Estoque insuficiente (${estoque})`;tipo='erro'}
    return{...item,produto:p||null,estoque,status,tipo};
  });
  renderCsvPreview();
}
function renderCsvPreview(){
  const validos=csvPreview.filter(x=>x.tipo==='ok');
  const erros=csvPreview.length-validos.length;
  $('csvResumo').textContent=csvPreview.length?`${csvPreview.length} linha(s): ${validos.length} pronta(s) e ${erros} com problema(s).`:'Nenhum arquivo selecionado.';
  $('processarCsvBtn').disabled=!validos.length;
  $('csvRows').innerHTML=csvPreview.length?csvPreview.map(x=>`<tr><td>${x.linha}</td><td>${escapeHtml(x.codigo)}</td><td>${escapeHtml(x.produto?.nome||'-')}</td><td>${Number.isFinite(x.quantidade)?x.quantidade:'-'}</td><td>${x.produto?x.estoque:'-'}</td><td class="csv-${x.tipo==='ok'?'ok':'erro'}">${escapeHtml(x.status)}</td></tr>`).join(''):emptyRow(6,'Selecione um arquivo CSV para visualizar a prévia.');
}
$('csvArquivo').addEventListener('change',async e=>{
  const arquivo=e.target.files?.[0];
  if(!arquivo){csvPreview=[];renderCsvPreview();return}
  try{
    const texto=await arquivo.text();
    csvPreview=lerCsv(texto);
    validarCsvPreview();
  }catch(err){csvPreview=[];renderCsvPreview();showAlert(err.message,'error')}
});
$('processarCsvBtn').addEventListener('click',async()=>{
  const validos=csvPreview.filter(x=>x.tipo==='ok');
  if(!validos.length)return;
  if(!confirm(`Processar ${validos.length} venda(s) válida(s)?`))return;
  $('processarCsvBtn').disabled=true;
  let sucesso=0;
  const falhas=[];
  for(const item of validos){
    const{error}=await sb.rpc('registrar_saida_fefo',{p_produto_id:item.produto.id,p_quantidade:item.quantidade});
    if(error)falhas.push(`linha ${item.linha}: ${error.message}`);else sucesso++;
  }
  await loadAll();
  csvPreview=[];
  $('csvArquivo').value='';
  renderCsvPreview();
  if(falhas.length)showAlert(`${sucesso} venda(s) processada(s). ${falhas.length} falharam. ${falhas[0]}`,'warning');
  else showAlert(`${sucesso} venda(s) importada(s) e baixada(s) do estoque com sucesso.`);
});
$('baixarModeloCsv').addEventListener('click',()=>{
  baixarArquivo('modelo_vendas.csv','codigo_barras;quantidade\n7891234567890;2\n','text/csv;charset=utf-8');
});
function csvEscape(v){
  const s=String(v??'');
  return /[;"\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;
}
function baixarArquivo(nome,conteudo,tipo){
  const blob=new Blob(['\uFEFF'+conteudo],{type:tipo});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download=nome;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}
$('exportarHistoricoBtn').addEventListener('click',()=>{
  const lista=historicoFiltrado();
  if(!lista.length){showAlert('Não há movimentações para exportar.','warning');return}
  const linhas=['data;produto;codigo_barras;lote;tipo;quantidade',...lista.map(x=>[fmtDateTime(x.criado_em),x.produtos?.nome||'',x.produtos?.codigo_barras||'',x.lotes?.numero_lote||'',x.tipo,x.quantidade].map(csvEscape).join(';'))];
  baixarArquivo(`historico_smartstock_${new Date().toISOString().slice(0,10)}.csv`,linhas.join('\n'),'text/csv;charset=utf-8');
});
$('filtroStatus').addEventListener('change',renderLotes);
$('buscaLote').addEventListener('input',renderLotes);
$('filtroProdutoStatus').addEventListener('change',renderProdutos);
$('buscaProduto').addEventListener('input',renderProdutos);
$('historicoBusca').addEventListener('input',renderHistorico);
$('historicoTipo').addEventListener('change',renderHistorico);
$('historicoInicio').addEventListener('change',renderHistorico);
$('historicoFim').addEventListener('change',renderHistorico);
$('refreshBtn').addEventListener('click',loadAll);
document.querySelectorAll('[data-fechar-modal]').forEach(btn=>btn.addEventListener('click',()=>fecharModal(btn.dataset.fecharModal)));
document.querySelectorAll('.modal').forEach(modal=>modal.addEventListener('click',e=>{if(e.target===modal)fecharModal(modal.id)}));
document.querySelectorAll('.menu-btn').forEach(btn=>btn.addEventListener('click',()=>{
  document.querySelectorAll('.menu-btn').forEach(b=>b.classList.remove('ativo'));
  btn.classList.add('ativo');
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('ativo'));
  $('view-'+btn.dataset.view).classList.add('ativo');
  const titles={dashboard:['Início','Visão geral do estoque e das validades'],produtos:['Produtos','Cadastro e manutenção do catálogo'],lotes:['Lotes e validades','Controle das datas de validade e do estoque'],saida:['Registrar saída','Baixa manual de produtos pelo método FEFO'],importar:['Importar vendas','Baixa automática a partir de arquivo CSV'],historico:['Histórico','Consulta e exportação das movimentações']};
  $('pageTitle').textContent=titles[btn.dataset.view][0];
  $('pageSubtitle').textContent=titles[btn.dataset.view][1];
}));
renderCsvPreview();
loadAll();
