// TeepMES - Separação de Materiais - Versão Limpa
// Implementação completa do DDP 354

// ===== STORAGE =====
const Storage = {
  get(key, fallback) {
    try { 
      return JSON.parse(localStorage.getItem(key)) ?? fallback; 
    } catch { 
      return fallback; 
    }
  },
  set(key, value) { 
    localStorage.setItem(key, JSON.stringify(value)); 
  },
  remove(key) { 
    localStorage.removeItem(key); 
  }
};

// ===== SESSION =====
const Session = {
  get operator() { 
    return Storage.get('operator', null); 
  },
  login(username) {
    const op = { 
      username, 
      name: username.toUpperCase(), 
      loggedAt: new Date().toISOString() 
    };
    Storage.set('operator', op);
    return op;
  },
  logout() { 
    Storage.remove('operator'); 
  }
};

// ===== MOCK DATA =====
function seedMockData() {
  const itemsCatalog = [
    { code: 'MAT-0001', description: 'Chapa Aço 3mm', unit: 'PC', location: 'DEP-01 / A-01', drawingUrl: null },
    { code: 'MAT-0002', description: 'Parafuso M8x30', unit: 'PC', location: 'DEP-01 / B-05', drawingUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf' },
    { code: 'MAT-0003', description: 'Porca M8', unit: 'PC', location: 'DEP-02 / C-10', drawingUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf' },
    { code: 'MAT-0004', description: 'Arruela M8', unit: 'PC', location: 'DEP-02 / C-11' },
    { code: 'MAT-0100', description: 'Parafuso M8x32 (Alt 1)', unit: 'PC', location: 'DEP-01 / B-06' },
    { code: 'MAT-0101', description: 'Parafuso M8x35 (Alt 2)', unit: 'PC', location: 'DEP-01 / B-07' },
    { code: 'MAT-0200', description: 'Chapa Aço 2.9mm (Alt)', unit: 'PC', location: 'DEP-01 / A-02' },
  ];

  const alternatives = {
    'MAT-0001': ['MAT-0200'],
    'MAT-0002': ['MAT-0100', 'MAT-0101'],
  };

  const orders = [
    {
      id: 'OP-1001', 
      productCode: 'PROD-AX12', 
      productDesc: 'Carroceria Modelo AX12', 
      operacao: 'CORTE', 
      status: 'ativa',
      createdDate: '2025-10-01',
      requiredItems: [
        { code: 'MAT-0001', quantity: 4 },
        { code: 'MAT-0002', quantity: 20 },
        { code: 'MAT-0003', quantity: 20 },
        { code: 'MAT-0004', quantity: 20 },
      ]
    },
    {
      id: 'OP-1002', 
      productCode: 'PROD-BX20', 
      productDesc: 'Carroceria Modelo BX20', 
      operacao: 'SOLDAGEM', 
      status: 'ativa',
      createdDate: '2025-10-02',
      requiredItems: [
        { code: 'MAT-0001', quantity: 2 },
        { code: 'MAT-0002', quantity: 10 },
        { code: 'MAT-0003', quantity: 10 },
      ]
    },
    {
      id: 'OP-1003', 
      productCode: 'PROD-CX15', 
      productDesc: 'Carroceria Modelo CX15', 
      operacao: 'CORTE', 
      status: 'ativa',
      createdDate: '2025-10-03',
      requiredItems: [
        { code: 'MAT-0001', quantity: 3 },
        { code: 'MAT-0002', quantity: 15 },
        { code: 'MAT-0004', quantity: 15 },
      ]
    },
    {
      id: 'OP-1004', 
      productCode: 'PROD-DX30', 
      productDesc: 'Carroceria Modelo DX30', 
      operacao: 'MONTAGEM', 
      status: 'ativa',
      createdDate: '2025-10-04',
      requiredItems: [
        { code: 'MAT-0002', quantity: 25 },
        { code: 'MAT-0003', quantity: 25 },
        { code: 'MAT-0004', quantity: 25 },
      ]
    },
    {
      id: 'OP-1005', 
      productCode: 'PROD-EX40', 
      productDesc: 'Carroceria Modelo EX40', 
      operacao: 'CORTE', 
      status: 'ativa',
      createdDate: '2025-09-28',
      requiredItems: [
        { code: 'MAT-0001', quantity: 5 },
        { code: 'MAT-0002', quantity: 30 },
      ]
    },
    {
      id: 'OP-1006', 
      productCode: 'PROD-FX50', 
      productDesc: 'Carroceria Modelo FX50', 
      operacao: 'SOLDAGEM', 
      status: 'ativa',
      createdDate: '2025-09-30',
      requiredItems: [
        { code: 'MAT-0003', quantity: 15 },
        { code: 'MAT-0004', quantity: 15 },
      ]
    },
  ];

  Storage.set('catalog', { itemsCatalog, alternatives });
  Storage.set('orders', orders);
  Storage.set('separations', []);
  Storage.set('history', []);
}

// ===== DATA ACCESS =====
function getOrders() { 
  return Storage.get('orders', []); 
}

function getCatalog() { 
  return Storage.get('catalog', { itemsCatalog: [], alternatives: {} }); 
}

function getSeparations() { 
  return Storage.get('separations', []); 
}

function saveSeparations(data) { 
  Storage.set('separations', data); 
}

function getHistory() { 
  return Storage.get('history', []); 
}

function saveHistory(h) { 
  Storage.set('history', h); 
}

// ===== UTILS =====
const fmtDateTime = (iso) => new Date(iso).toLocaleString();
const nowIso = () => new Date().toISOString();

// Quantidade que ainda falta para o item (global, para uso fora das views)
function remainingQtyOf(item) {
  const official = Number(item.attended || 0);
  const alt = Number(item.attendedAlt || 0);
  const total = Number(item.quantity || 0);
  return Math.max(0, total - official - alt);
}

// ===== DOM HELPERS =====
const el = (tag, attrs = {}, children = []) => {
  const e = document.createElement(tag);
  
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on') && typeof v === 'function') {
      e.addEventListener(k.substring(2), v);
    } else if (k === 'html') {
      e.innerHTML = v;
    } else {
      e.setAttribute(k, v);
    }
  });
  
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child == null) continue;
    e.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  
  return e;
};

// ===== BUSINESS LOGIC =====
function buildChecklistFromOrder(orderId) {
  const { itemsCatalog, alternatives } = getCatalog();
  const order = getOrders().find(o => o.id === orderId);
  if (!order) return null;
  
  return order.requiredItems.map(req => {
    const item = itemsCatalog.find(i => i.code === req.code);
    return {
      baseCode: req.code,
      currentCode: req.code,
      quantity: req.quantity,
      attended: req.quantity,           // inicia preenchido com o original para permitir salvar direto
      attendedAlt: 0,        // alternativa inicia 0
      unit: item?.unit ?? 'UN',
      location: item?.location ?? '-',
      description: item?.description ?? req.code,
      alternatives: alternatives[req.code] || [],
      confirmed: false,
      substitution: null,
      locked: false,
      marked: false  // Checkbox guia visual (inicia desmarcado)
    };
  });
}

function ensureSeparation(orderId) {
  const sep = getSeparations();
  
  // Se já existe separação ativa, usar ela
  let rec = sep.find(s => s.orderId === orderId && !s.finishedAt);
  if (rec) return rec;
  
  // Se existe separação parcial finalizada, reabrir
  const partials = sep.filter(s => s.orderId === orderId && s.finishedAt && s.finalizeMode === 'parcial');
  if (partials.length > 0) {
    partials.sort((a,b) => new Date(b.finishedAt) - new Date(a.finishedAt));
    rec = partials[0];
    rec.finishedAt = null;
    delete rec.finalizeMode;
    
    // Bloquear itens já confirmados
    rec.items.forEach(item => {
      if (item.confirmed) {
        item.locked = true;
        console.log('Item bloqueado ao reabrir separação parcial:', item.baseCode);
      }
    });
    
    saveSeparations(sep);
    return rec;
  }
  
  // Criar nova separação
  const order = getOrders().find(o => o.id === orderId);
  rec = {
    orderId,
    productCode: order?.productCode,
    productDesc: order?.productDesc,
    operacao: order?.operacao,
    operator: Session.operator?.username,
    startedAt: nowIso(),
    finishedAt: null,
    items: buildChecklistFromOrder(orderId),
    history: []
  };
  
  sep.push(rec);
  saveSeparations(sep);
  return rec;
}

function updateSeparation(orderId, updater) {
  const sep = getSeparations();
  const idx = sep.findIndex(s => s.orderId === orderId && !s.finishedAt);
  if (idx === -1) return;
  updater(sep[idx]);
  saveSeparations(sep);
}

function finalizeSeparation(orderId, mode) {
  updateSeparation(orderId, rec => {
    rec.finishedAt = nowIso();
    rec.finalizeMode = mode;
    // Congelar mínimos salvos para não permitir redução futura
    rec.items.forEach(item => {
      item.minAttended = item.attended || 0;
      item.minAttendedAlt = item.attendedAlt || 0;
    });
    
    // Garantir dados da OP
    if (!rec.productCode || !rec.productDesc) {
      const order = getOrders().find(o => o.id === orderId);
      if (order) {
        rec.productCode = order.productCode;
        rec.productDesc = order.productDesc;
        rec.operacao = order.operacao;
      }
    }
    
    // Bloquear itens conforme o modo e falta
    if (mode === 'total') {
      rec.items.forEach(item => item.locked = true);
    } else if (mode === 'parcial') {
      rec.items.forEach(item => {
        const faltaNow = remainingQtyOf(item);
        if (faltaNow === 0) {
          item.locked = true;
          console.log('Item bloqueado após finalização parcial:', item.baseCode);
        }
      });
    }
  });
}

function removeSeparation(orderId) {
  const all = getSeparations();
  const next = all.filter(s => s.orderId !== orderId);
  saveSeparations(next);
}

// ===== NAVIGATION =====
function navigate(route) {
  if (!route) route = location.hash || '#/separar';
  
  if (!Session.operator && route !== '#/login') {
    openLoginDialog(() => render(route));
    return;
  }
  
  render(route);
}

// ===== VIEWS =====
let separarFilter = 'todas';

function render(route) {
  const container = document.getElementById('view-container');
  container.innerHTML = '';
  syncOperatorHeader();

  if (route.startsWith('#/ddp354')) return container.appendChild(ViewDDP354());
  if (route.startsWith('#/finalizadas')) return container.appendChild(ViewFinalizadas());
  if (route.startsWith('#/relatorios')) return container.appendChild(ViewRelatorios());
  if (route.startsWith('#/checklist/')) {
    const orderId = route.split('/')[2];
    return container.appendChild(ViewChecklist(orderId));
  }
  if (route.startsWith('#/report/')) {
    const orderId = route.split('/')[2];
    return container.appendChild(ViewReport(orderId));
  }
  return container.appendChild(ViewSeparar());
}

function syncOperatorHeader() {
  const op = Session.operator;
  const opName = document.getElementById('op-name');
  const btnLogout = document.getElementById('btn-logout');
  const btnOpenLogin = document.getElementById('btn-open-login');
  
  if (op) {
    opName.textContent = `Operador: ${op.name}`;
    btnLogout.hidden = false;
    btnOpenLogin.style.display = 'none';
  } else {
    opName.textContent = 'Não autenticado';
    btnLogout.hidden = true;
    btnOpenLogin.style.display = '';
  }
}

// ===== LOGIN =====
function openLoginDialog(onSuccess) {
  const dlg = document.getElementById('dialog-login');
  const form = document.getElementById('login-form');
  const user = document.getElementById('login-user');
  const pass = document.getElementById('login-pass');
  const err = document.getElementById('login-error');
  
  user.value = '';
  pass.value = '';
  err.style.display = 'none';
  
  const submit = (ev) => {
    ev?.preventDefault();
    if (!user.value || !pass.value) return;
    
    const u = user.value.trim();
    const p = pass.value.trim();
    const isDemoValid = (u === 'operador' && p === '1234');
    
    if (!isDemoValid) { 
      err.style.display = ''; 
      return; 
    }
    
    err.style.display = 'none';
    Session.login(u);
    dlg.close();
    form.removeEventListener('submit', submit);
    syncOperatorHeader();
    if (typeof onSuccess === 'function') onSuccess();
  };
  
  form.addEventListener('submit', submit);
  dlg.showModal();
}

// ===== VIEW: SEPARAR MATERIAIS =====
function ViewSeparar() {
  const root = el('div', { class: 'grid' });

  const searchCard = el('div', { class: 'card' }, [
    el('div', { style: 'font-weight:700; margin-bottom:20px; font-size:18px; color:var(--text)' }, 'Separar Materiais'),
    
    // Filtros de Data
    el('div', { class: 'filter-section' }, [
      el('div', { class: 'filter-section-title' }, 'Filtros de Data'),
      el('div', { class: 'filter-row' }, [
        el('div', { class: 'filter-field' }, [
          el('label', {}, 'Data Início'),
          el('input', { type: 'date', id: 'inp-data-inicio' })
        ]),
        el('div', { class: 'filter-field' }, [
          el('label', {}, 'Data Fim'),
          el('input', { type: 'date', id: 'inp-data-fim' })
        ]),
        el('div', { class: 'filter-actions' }, [
          el('button', { 
          class: 'btn btn-ghost', 
          onclick: () => {
            const inpDataInicio = document.getElementById('inp-data-inicio');
            const inpDataFim = document.getElementById('inp-data-fim');
            if (inpDataInicio) inpDataInicio.value = '';
            if (inpDataFim) inpDataFim.value = '';
            onBuscar();
          }
          }, 'Limpar Datas'),
          el('button', { 
            class: 'btn btn-ghost', 
            onclick: () => {
              const hoje = new Date();
              const umaSemanaAtras = new Date();
              umaSemanaAtras.setDate(hoje.getDate() - 7);
              
              const inpDataInicio = document.getElementById('inp-data-inicio');
              const inpDataFim = document.getElementById('inp-data-fim');
              if (inpDataInicio) inpDataInicio.value = umaSemanaAtras.toISOString().split('T')[0];
              if (inpDataFim) inpDataFim.value = hoje.toISOString().split('T')[0];
              onBuscar();
            }
          }, 'Última Semana')
        ])
      ])
    ]),
    
    // Filtros de Busca
    el('div', { class: 'filter-section' }, [
      el('div', { class: 'filter-section-title' }, 'Filtros de Busca'),
      el('div', { class: 'filter-row' }, [
        el('div', { class: 'filter-field' }, [
          el('label', {}, 'Código da OP'),
          el('input', { id: 'inp-op', placeholder: 'ex.: OP-1001' })
        ]),
        el('div', { class: 'filter-field' }, [
          el('label', {}, 'Código do Produto'),
          el('input', { id: 'inp-prod', placeholder: 'ex.: PROD-AX12' })
        ]),
        el('div', { class: 'filter-field' }, [
          el('label', {}, 'Operação'),
          el('input', { id: 'inp-operacao', placeholder: 'ex.: CORTE, SOLDAGEM' })
        ]),
        el('div', { class: 'filter-actions' }, [
          el('button', { class: 'btn', onclick: onBuscar }, 'Buscar')
        ])
      ])
    ]),
    
    // Filtros de Status
    (() => {
      const statusContainer = el('div', { class: 'status-filters' });
      statusContainer.appendChild(el('div', { class: 'status-label' }, 'Status:'));
      
      const mk = (value, label) => {
        const active = separarFilter === value;
        return el('button', { 
          class: active ? 'btn' : 'btn btn-ghost',
          onclick: () => { separarFilter = value; onBuscar(); }
        }, label);
      };
      
      statusContainer.appendChild(mk('todas', 'Todas'));
      statusContainer.appendChild(mk('parcial', 'Parciais'));
      statusContainer.appendChild(mk('sem-separacao', 'Sem Separação'));
      
      return statusContainer;
    })(),
    
    el('div', { class: 'instruction-text' }, 'Use os filtros de data para buscar OPs por período. Use os filtros de busca para encontrar OPs específicas. Use os filtros de status para filtrar por tipo de separação.')
  ]);

  const list = el('div', { class: 'op-list', id: 'op-list' });

  function onBuscar() {
    const inpOp = document.getElementById('inp-op');
    const inpProd = document.getElementById('inp-prod');
    const inpOperacao = document.getElementById('inp-operacao');
    const inpDataInicio = document.getElementById('inp-data-inicio');
    const inpDataFim = document.getElementById('inp-data-fim');
    
    const vOp = inpOp ? inpOp.value.trim().toUpperCase() : '';
    const vProd = inpProd ? inpProd.value.trim().toUpperCase() : '';
    const vOperacao = inpOperacao ? inpOperacao.value.trim().toUpperCase() : '';
    const vDataInicio = inpDataInicio ? inpDataInicio.value : '';
    const vDataFim = inpDataFim ? inpDataFim.value : '';
    
    list.innerHTML = '';
    
    const history = getHistory().filter(r => r.finalizeMode === 'total');
    const finalizedIds = new Set(history.map(r => r.orderId));
    const partialIds = new Set(getSeparations().filter(s => s.finalizeMode === 'parcial' && s.finishedAt).map(s => s.orderId));
    
    // Função para verificar se a data está no período
    const inDateRange = (dateStr) => {
      if (!vDataInicio && !vDataFim) return true;
      if (!dateStr) return false;
      
      const date = new Date(dateStr);
      const startDate = vDataInicio ? new Date(vDataInicio) : null;
      const endDate = vDataFim ? new Date(vDataFim + 'T23:59:59') : null;
      
      if (startDate && date < startDate) return false;
      if (endDate && date > endDate) return false;
      return true;
    };
    
    let results = getOrders().filter(o => {
      // Filtros de texto
      const textMatch = (!vOp || o.id.toUpperCase().includes(vOp)) && 
                       (!vProd || o.productCode.toUpperCase().includes(vProd)) &&
                       (!vOperacao || (o.operacao || '').toUpperCase().includes(vOperacao));
      
      // Filtro de data (verificar se a OP foi criada no período)
      const dateMatch = inDateRange(o.createdDate);
      
      return textMatch && !finalizedIds.has(o.id) && dateMatch;
    });
    
    if (separarFilter === 'parcial') {
      results = results.filter(o => partialIds.has(o.id));
    } else if (separarFilter === 'sem-separacao') {
      const separations = getSeparations();
      results = results.filter(o => {
        const sep = separations.find(s => s.orderId === o.id);
        if (!sep) return true;
        return sep.items.every(item => ((Number(item.attended||0) + Number(item.attendedAlt||0)) === 0));
      });
    }
    
    if (!results.length) {
      list.appendChild(el('div', { class: 'op-item' }, [
        el('div', {}, 'Nenhuma OP encontrada.')
      ]));
      return;
    }
    
    for (const o of results) {
      list.appendChild(el('div', { class: 'op-item' }, [
        el('div', {}, [
          el('div', { style: 'font-weight:600' }, `${o.id} • ${o.productCode} • ${o.operacao || 'N/A'}`),
          el('div', { class: 'muted' }, o.productDesc),
          el('div', { class: 'muted', style: 'font-size:12px' }, `Criada em: ${new Date(o.createdDate).toLocaleDateString('pt-BR')}`),
          (() => {
            if (partialIds.has(o.id)) {
              return el('div', { class: 'status-chip status-pend' }, 'Separação Parcial');
            }
            const sep = getSeparations().find(s => s.orderId === o.id && !s.finishedAt);
            if (sep) {
              return el('div', { class: 'status-chip status-ok' }, 'Em Andamento');
            }
            return null;
          })()
        ]),
        el('div', {}, el('button', { class: 'btn', onclick: () => openChecklist(o.id) }, 'Separar'))
      ]));
    }
  }

  root.appendChild(searchCard);
  root.appendChild(list);
  onBuscar();
  return root;
}

// ===== VIEW: CHECKLIST =====
function ViewChecklist(orderId) {
  const order = getOrders().find(o => o.id === orderId);
  const separation = ensureSeparation(orderId);
  
  // Contexto global para alternativos
  window.currentOrderId = orderId;

  function renderHeader() {
    return el('div', { class: 'card' }, [
      el('div', { style: 'display:flex; justify-content:space-between; align-items:center; margin-bottom:16px' }, [
        el('div', {}, [
          el('div', { style: 'font-weight:700' }, `${order.id} • ${order.productCode} • ${order.operacao || 'N/A'}`),
          el('div', { class: 'muted' }, order.productDesc),
          el('div', { class: 'muted' }, `Início: ${fmtDateTime(separation.startedAt)} | Operador: ${Session.operator?.name}`),
        ]),
        el('div', {}, el('button', { class: 'btn btn-ghost', onclick: () => history.back() }, 'Voltar'))
      ]),
      el('p', { class: 'muted' }, 'Confirme cada item após a separação física. Se algum item não estiver disponível, escolha um alternativo.')
    ]);
  }

  function remainingQty(item) {
    const a = Number(item.attended || 0);
    const b = Number(item.attendedAlt || 0);
    return Math.max(0, Number(item.quantity) - a - b);
  }

  function renderTable() {
    const wrapper = el('div', { class: 'card' });
    // reset invalid state per render (não usado mais para o botão)
    let hasInvalid = false;
    const table = el('table', { class: 'table' });
    const thead = el('thead', {}, el('tr', {}, [
      el('th', { class: 'col-mark' }, '✓'),
      el('th', { class: 'col-code' }, 'CODIGO'),
      el('th', { class: 'col-dep' }, 'DEPOSITO'),
      el('th', { class: 'col-loc' }, 'Localização'),
      el('th', { class: 'col-qty' }, 'qtde ORIGINAL'),
      el('th', { class: 'col-qty' }, 'quantidade atendida'),
      el('th', { class: 'col-qty' }, 'FALTA'),
      el('th', { class: 'col-desc' }, 'Descrição'),
      el('th', { class: 'col-unit' }, 'Un'),
      el('th', { class: 'col-actions' }, 'Ações')
    ]));
    const legend = el('div', { class: 'muted', style: 'margin: 0 0 8px 0; font-size:12px' }, [
      el('span', { class: 'status-chip status-ok' }, 'Oficial'), ' ',
      el('span', { class: 'status-chip status-sub' }, 'Alternativo'), ' ',
      el('span', { class: 'status-chip status-pend' }, 'Falta')
    ]);
    wrapper.appendChild(legend);

    const tbody = el('tbody');
    
    for (const [idx, it] of separation.items.entries()) {
      const dep = (it.location || '').split('/')[0].trim();
      const tr = el('tr', { class: it.locked ? 'locked' : '' });
      
      // Checkbox guia visual (não afeta lógica de separação)
      const faltaCalc = remainingQty(it);
      const hasAttended = (Number(it.attended || 0) + Number(it.attendedAlt || 0)) > 0;
      const isComplete = faltaCalc === 0;
      
      // Auto-marcar ao reabrir baseado em quantidade
      // Se separação já foi salva: auto-marcar itens com atendimento
      // Se separação nova: só marca se usuário ticar manualmente
      let shouldBeMarked = false;
      if (separation.finishedAt) {
        // Ao reabrir separação salva: auto-marcar baseado em quantidade
        shouldBeMarked = hasAttended;
      } else {
        // Separação nova: usar estado salvo (se usuário ticou antes)
        shouldBeMarked = !!it.marked;
      }
      
      const chk = el('input', { type: 'checkbox' });
      chk.checked = shouldBeMarked;
      chk.disabled = !!it.locked;
      
      // Aplicar cores de fundo baseadas no checkbox e status do item
      const updateRowColor = () => {
        tr.classList.remove('item-marked-total', 'item-marked-parcial');
        if (chk.checked) {
          // Verificar se item está completo ou parcial
          const itemFalta = remainingQty(it);
          const itemComplete = itemFalta === 0;
          
          if (itemComplete) {
            tr.classList.add('item-marked-total'); // Verde para completo
          } else {
            tr.classList.add('item-marked-parcial'); // Amarelo para parcial
          }
        }
      };
      
      // Atualizar cor ao mudar checkbox
      chk.addEventListener('change', () => {
        if (it.locked) {
          chk.checked = shouldBeMarked;
          return;
        }
        updateSeparation(orderId, rec => {
          rec.items[idx].marked = chk.checked;
        });
        updateRowColor();
      });
      
      // Aplicar cor inicial
      updateRowColor();
      
      const btnAlt = document.createElement('button');
      btnAlt.className = it.locked ? 'btn btn-ghost small disabled' : 'btn btn-ghost small';
      btnAlt.disabled = it.locked;
      btnAlt.textContent = 'Alternativos';
      btnAlt.style.zIndex = '100';
      btnAlt.style.position = 'relative';
      btnAlt.style.pointerEvents = 'auto';
      btnAlt.style.cursor = 'pointer';
      
      btnAlt.addEventListener('click', (e) => {
        console.log('Botão Alternativos clicado para item:', idx);
        e.preventDefault();
        e.stopPropagation();
        if (it.locked) {
          console.log('Item está bloqueado, não pode escolher alternativo');
          return;
        }
        console.log('Chamando chooseAlternative...');
        chooseAlternative(idx);
      });

      // Botão Desenho (PDF)
      const btnDraw = document.createElement('button');
      btnDraw.className = 'btn btn-ghost small';
      btnDraw.textContent = 'Desenho';
      btnDraw.style.marginLeft = '6px';
      btnDraw.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const { itemsCatalog } = getCatalog();
        const item = itemsCatalog.find(i => i.code === it.currentCode);
        const url = item?.drawingUrl; // futuramente virá da integração ERP ↔ TEEP
        if (url) {
          try { window.open(url, '_blank'); } catch { /* noop */ }
        } else {
          openConfirm(
            'Desenho do Produto',
            'Arquivo.pdf será mostrado na versão do sistema quando a integração estiver associando o arquivo ao produto dessa lista.',
            () => {},
            'parcial' // tom neutro/amarelo para aviso
          );
        }
      });
      
      tr.appendChild(el('td', { style: 'text-align:center' }, chk));
      tr.appendChild(el('td', {}, it.currentCode));
      tr.appendChild(el('td', {}, dep));
      tr.appendChild(el('td', {}, it.location));
      tr.appendChild(el('td', { style: 'text-align:right' }, String(it.quantity)));

      // Campo atendido (editável apenas para oficial)
      const minOfficial = it.minAttended || 0;
      const inpAtt = el('input', { type: 'number', min: String(minOfficial), step: '1', value: String(it.attended || 0), style: 'width:80px; text-align:right' });
      const maxOfficial = it.quantity - (it.attendedAlt || 0); // teto considerando o que já foi atendido via ALT
      inpAtt.max = String(maxOfficial);
      inpAtt.disabled = it.locked; // antes de confirmar, não está locked
      const help = el('div', { class: 'help-error', style: 'display:none' }, '');
      const validate = () => {
        let v = Number.parseInt(inpAtt.value, 10);
        if (Number.isNaN(v)) v = minOfficial;
        if (v < minOfficial) v = minOfficial; // não reduzir abaixo do salvo anteriormente
        if (v > maxOfficial) v = maxOfficial; // não ultrapassar limite
        const invalid = (Number.parseInt(inpAtt.value, 10) !== v);
        updateSeparation(orderId, rec => {
          rec.items[idx].attended = v;
          // Não auto-marcar: checkbox é manual
        });
        inpAtt.value = String(v);
        if (invalid) {
          inpAtt.classList.add('input-error');
          help.textContent = `Valor ajustado ao limite (mín ${minOfficial} • máx ${maxOfficial}).`;
          help.style.display = '';
          hasInvalid = true;
        } else {
          inpAtt.classList.remove('input-error');
          help.style.display = 'none';
        }
        rerender();
      };
      inpAtt.addEventListener('change', validate);
      inpAtt.addEventListener('blur', validate);
      tr.appendChild(el('td', { style: 'text-align:right' }, inpAtt));
      tr.appendChild(el('td', { style: 'text-align:right' }, ''));// placeholder alinhamento (será removido abaixo)
      // substitui a célula anterior de FALTA com valor correto após inputs

      tr.cells && tr.cells.length>0; // noop
      // FALTA
      const faltaCell = el('td', { style: 'text-align:right' }, String(remainingQty(it)));
      tr.replaceChild(faltaCell, tr.lastChild);
      tr.appendChild(el('td', {}, [
        el('div', {}, it.description),
        (it.attended && it.attended > 0) ? el('div', { class: 'status-chip status-ok' }, `Oficial atendido: ${it.attended}`) : null,
        (it.attendedAlt && it.attendedAlt > 0) ? el('div', { class: 'status-chip status-sub' }, `Alt atendido${it.lastAltUsed ? ` (${it.lastAltUsed})` : ''}: ${it.attendedAlt}`) : null,
        (() => {
          const total = Number(it.quantity) || 0;
          const off = Math.min(total, Number(it.attended || 0));
          const alt = Math.min(Math.max(0, total - off), Number(it.attendedAlt || 0));
          const offPct = total > 0 ? Math.round((off / total) * 100) : 0;
          const altPct = total > 0 ? Math.round((alt / total) * 100) : 0;
          const bar = el('div', { class: 'progress' }, [
            el('div', { class: 'progress-bar-official', style: `width:${offPct}%;` }),
            el('div', { class: 'progress-bar-alt', style: `width:${altPct}%;` })
          ]);
          const label = el('div', { class: 'muted', style: 'font-size:12px' }, `Progresso: OF ${off} | ALT ${alt} (${offPct + altPct}%)`);
          return el('div', {}, [bar, label]);
        })(),
        remainingQty(it) > 0 ? el('div', { class: 'status-chip status-pend' }, `Falta: ${remainingQty(it)}`) : el('div', { class: 'status-chip status-ok' }, 'Completo')
      ]));
      tr.appendChild(el('td', {}, it.unit));
      tr.appendChild(el('td', { style: 'text-align:center' }, [btnAlt, btnDraw]));
      // mensagens de ajuda
      const fullRow = el('tr');
      fullRow.appendChild(el('td', { colspan: 10 }, help));
      tbody.appendChild(fullRow);
      tbody.appendChild(tr);
    }
    
    table.appendChild(thead);
    table.appendChild(tbody);
    wrapper.appendChild(table);
    // expõe estado invalid para o resumo
    window._hasInvalid = hasInvalid;
    return wrapper;
  }

  function renderSummary() {
    const confirmed = separation.items.filter(i => remainingQty(i) === 0).length;
    const pending = separation.items.length - confirmed;
    const substituted = separation.items.filter(i => i.substitution).length;
    const hasInvalid = (() => {
      // Validação consistente a cada render
      return separation.items.some(it => {
        const q = Number(it.quantity || 0);
        const ofc = Number(it.attended || 0);
        const alt = Number(it.attendedAlt || 0);
        const minOfc = Number(it.minAttended || 0);
        const minAlt = Number(it.minAttendedAlt || 0);
        const maxOfc = Math.max(0, q - alt);
        const maxAlt = Math.max(0, q - ofc);
        const ofcOk = ofc >= minOfc && ofc <= maxOfc;
        const altOk = alt >= minAlt && alt <= maxAlt;
        const somaOk = (ofc + alt) <= q;
        return !(ofcOk && altOk && somaOk);
      });
    })();
    
    return el('div', { class: 'card sticky' }, [
      el('h4', {}, 'Resumo da Separação'),
      el('div', { style: 'display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px' }, [
        el('div', { class: 'status-chip status-ok' }, `Confirmados: ${confirmed}`),
        el('div', { class: 'status-chip status-pend' }, `Pendentes: ${pending}`),
        el('div', { class: 'status-chip status-sub' }, `Substituídos: ${substituted}`)
      ]),
      el('div', { class: 'grid' }, [
        el('button', { 
          class: 'btn', 
          onclick: () => onSave()
        }, 'Salvar Separação')
      ])
    ]);
  }

  function onSave() {
    const pending = separation.items.filter(i => (Number(i.quantity || 0) - Number(i.attended || 0) - Number(i.attendedAlt || 0)) > 0).length;
    const mode = pending === 0 ? 'total' : 'parcial';
    
    if (mode === 'total') {
      openConfirm('Finalização Total', 'Todos os itens foram confirmados. Deseja finalizar a separação?', () => doFinalize(mode), 'total');
    } else {
      openConfirm('Finalização Parcial', `Ainda há ${pending} itens pendentes. Deseja salvar a separação parcial?`, () => doFinalize(mode), 'parcial');
    }
  }

  function doFinalize(mode) {
    finalizeSeparation(orderId, mode);
    const rec = getSeparations().find(s => s.orderId === orderId && s.finishedAt);
    const info = [
      `Operador: ${Session.operator?.name}`,
      `Início: ${fmtDateTime(rec.startedAt)}`,
      `Fim: ${fmtDateTime(rec.finishedAt)}`,
      `Modo: ${rec.finalizeMode === 'total' ? 'Total' : 'Parcial'}`
    ].join('\n');
    
    const nextAction = () => {
      if (mode === 'total') {
        // Finalização total: mover para histórico e remover da lista
        const h = getHistory();
        const existsIdx = h.findIndex(x => x.orderId === rec.orderId && x.finishedAt === rec.finishedAt);
        if (existsIdx >= 0) h[existsIdx] = { ...rec }; else h.push({ ...rec });
        saveHistory(h);
        console.log('Separação salva no histórico:', rec.orderId, 'Total histórico:', h.length);
        removeSeparation(orderId);
        // Voltar para a lista de separação
        location.hash = '#/separar';
      } else {
        // Finalização parcial: manter na lista de separações mas marcada como parcial
        // Voltar para a listagem de OPs para separação
        location.hash = '#/separar';
      }
    };
    
    openConfirm('Separação finalizada com sucesso', info, nextAction, mode);
  }

  function rerender() {
    const container = document.getElementById('view-container');
    container.innerHTML = '';
    container.appendChild(ViewChecklist(orderId));
  }

  // Layout: resumo no topo para ganhar espaço lateral
  const root = el('div', { class: 'grid' }, [
      renderHeader(),
    renderSummary(),
      renderTable()
  ]);

  return root;
}

// ===== ALTERNATIVOS =====
function chooseAlternative(itemIndex) {
  console.log('Escolhendo alternativo para item:', itemIndex);
  
  try {
    const { itemsCatalog, alternatives } = getCatalog();
    const currentOrderId = window.currentOrderId;
    
    if (!currentOrderId) {
      console.error('currentOrderId não definido');
      return;
    }
    
    const separation = getSeparations().find(s => s.orderId === currentOrderId && !s.finishedAt);
    if (!separation) {
      console.error('Separação não encontrada');
      return;
    }
    
    if (itemIndex >= separation.items.length) {
      console.error('Índice inválido');
      return;
    }
    
    const base = separation.items[itemIndex].baseCode;
    const allowed = alternatives[base] || [];
    const availableAlternatives = allowed.map(code => itemsCatalog.find(i => i.code === code)).filter(Boolean);
    
    if (availableAlternatives.length === 0) {
      alert('Nenhum alternativo disponível para este item');
      return;
    }
    
    openAlternativesDialog(availableAlternatives, (selected) => {
    if (!selected) return;
    openAltQuantityDialog(selected, currentOrderId, itemIndex);
  });
  
  } catch (error) {
    console.error('Erro em chooseAlternative:', error);
  }
}

function openAlternativesDialog(items, onSelect) {
  console.log('Abrindo diálogo de alternativos com', items.length, 'itens');
  
  try {
    const dlg = document.getElementById('dialog-alternativos');
    const list = document.getElementById('alt-list');
    const input = document.getElementById('alt-search-input');
    const btnClose = document.getElementById('alt-close');
    
    if (!dlg || !list) {
      console.error('Elementos do diálogo não encontrados');
      return;
    }
  
  function render(itemsToRender) {
    list.innerHTML = '';
    for (const it of itemsToRender) {
      const actions = el('div', {});
      // Botão Desenho
      const btnDraw = el('button', { class: 'btn btn-ghost', onclick: () => {
        const url = it.drawingUrl; // virá da integração ERP ↔ TEEP
        if (url) {
          try { window.open(url, '_blank'); } catch {}
        } else {
          openConfirm(
            'Desenho do Produto',
            'Arquivo.pdf será mostrado na versão do sistema quando a integração estiver associando o arquivo ao produto dessa lista.',
            () => {},
            'parcial'
          );
        }
      } }, 'Desenho');

      // Botão Selecionar
      const btnSelect = el('button', { class: 'btn', onclick: () => { dlg.close(); onSelect?.(it); } }, 'Selecionar');
      actions.appendChild(btnDraw);
      actions.appendChild(btnSelect);

      const row = el('div', { class: 'op-item' }, [
        el('div', {}, [
          el('div', { style: 'font-weight:600' }, `${it.code} • ${it.description}`),
          el('div', { class: 'muted' }, `${it.location} • ${it.unit}`),
        ]),
        actions
      ]);
      list.appendChild(row);
    }
  }
  
  input.value = '';
  
  if (!items || items.length === 0) {
    list.innerHTML = '<div class="card">Nenhum item alternativo disponível para este item.</div>';
  } else {
    render(items);
  }
  
  input.oninput = () => {
    const q = input.value.trim().toUpperCase();
    render(items.filter(i => i.code.toUpperCase().includes(q) || i.description.toUpperCase().includes(q)));
  };
  
  btnClose.onclick = () => { dlg.close(); onSelect?.(null); };
  
  try {
    dlg.showModal();
  } catch (error) {
    console.error('Erro ao abrir diálogo:', error);
  }
  
  } catch (error) {
    console.error('Erro em openAlternativesDialog:', error);
  }
}

// ===== ALT QUANTITY DIALOG =====
function openAltQuantityDialog(altItem, orderId, itemIndex) {
  try {
    const dlg = document.getElementById('dialog-alt-qty');
    const title = document.getElementById('altq-title');
    const info = document.getElementById('altq-info');
    const input = document.getElementById('altq-input');
    const help = document.getElementById('altq-help');
    const btnClose = document.getElementById('altq-close');
    const btnCancel = document.getElementById('altq-cancel');
    const btnApply = document.getElementById('altq-apply');

    const rec = getSeparations().find(s => s.orderId === orderId && !s.finishedAt);
    if (!rec) return;
    const it = rec.items[itemIndex];
    const minAlt = it.minAttendedAlt || 0;
    const minOfficial = it.minAttended || 0; // oficial mínimo já salvo (0 antes de finalizar)
    // Máximo de ALT pode substituir o oficial até o mínimo permitido
    const maxAlt = Math.max(0, it.quantity - minOfficial);
    const currentAlt = it.attendedAlt || 0;

    title.textContent = `Definir quantidade alternativa — ${altItem.code}`;
    info.textContent = `Mínimo (já salvo): ${minAlt} • Atual: ${currentAlt} • Máximo: ${maxAlt} (pode substituir oficial até o mínimo ${minOfficial})`;
    input.min = String(minAlt);
    input.max = String(maxAlt);
    input.value = String(Math.max(currentAlt, minAlt));
    help.style.display = 'none';

    const validate = () => {
      let v = Number.parseInt(input.value, 10);
      if (Number.isNaN(v)) v = Math.max(currentAlt, minAlt);
      let invalid = false;
      if (v < minAlt) { v = minAlt; invalid = true; }
      if (v > maxAlt) { v = maxAlt; invalid = true; }
      input.value = String(v);
      help.style.display = invalid ? '' : 'none';
      if (invalid) help.textContent = `Valor ajustado ao limite (mín ${minAlt} • máx ${maxAlt}).`;
      return v;
    };

    const apply = (ev) => {
      ev?.preventDefault();
      const v = validate();
      updateSeparation(orderId, r => {
        const recItem = r.items[itemIndex];
        // Ajustar oficial para manter soma <= original e respeitar mínimo oficial
        const q = Number(recItem.quantity || 0);
        const newAlt = v;
        const capOfficial = q - newAlt;
        const currentOfficial = Number(recItem.attended || 0);
        const newOfficial = Math.max(minOfficial, Math.min(currentOfficial, capOfficial));
        recItem.attended = newOfficial;
        recItem.attendedAlt = newAlt;
        recItem.lastAltUsed = altItem.code;
        recItem.substitution = {
          from: recItem.baseCode,
          to: altItem.code,
          operator: Session.operator?.username,
          at: nowIso(),
          qty: newAlt
        };
        recItem.confirmed = remainingQtyOf(recItem) === 0;
        // Não auto-marcar: checkbox é manual
        r.history.push({ type: 'substitution', ...recItem.substitution });
      });
      dlg.close();
      const route = location.hash; if (route.startsWith('#/checklist/')) render(route);
    };

    const close = (ev) => { ev?.preventDefault(); dlg.close(); };

    input.onchange = validate;
    input.onblur = validate;
    btnApply.onclick = apply;
    btnCancel.onclick = close;
    btnClose.onclick = close;

    dlg.showModal();
  } catch (e) {
    console.error('Erro em openAltQuantityDialog:', e);
  }
}

// ===== DIALOGS =====
function openConfirm(title, message, onOk, type = 'default') {
  const dlg = document.getElementById('dialog-confirm');
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-message').textContent = message;
  const btnOk = document.getElementById('confirm-ok');
  const btnCancel = document.getElementById('confirm-cancel');
  
  // Remover classes anteriores
  dlg.classList.remove('dialog-confirm-total', 'dialog-confirm-parcial');
  
  // Aplicar classe baseada no tipo
  if (type === 'total') {
    dlg.classList.add('dialog-confirm-total');
  } else if (type === 'parcial') {
    dlg.classList.add('dialog-confirm-parcial');
  }
  
  const cleanup = () => {
    btnOk.removeEventListener('click', handleOk);
    btnCancel.removeEventListener('click', handleCancel);
    // Remover classes ao fechar
    dlg.classList.remove('dialog-confirm-total', 'dialog-confirm-parcial');
  };
  
  const handleOk = () => { dlg.close(); cleanup(); onOk?.(); };
  const handleCancel = () => { dlg.close(); cleanup(); };
  
  btnOk.addEventListener('click', handleOk);
  btnCancel.addEventListener('click', handleCancel);
  dlg.showModal();
}

// ===== NAVIGATION HELPERS =====
function openChecklist(orderId) {
  location.hash = `#/checklist/${orderId}`;
}

// ===== VIEWS SIMPLIFICADAS =====

function ViewFinalizadas() {
  const root = el('div', { class: 'grid' });
  
  const filtersCard = el('div', { class: 'card' }, [
    el('div', { style: 'font-weight:700; margin-bottom:16px' }, 'Separações Finalizadas'),
    el('p', { class: 'muted', style: 'margin-bottom:16px' }, 'Consulte separações que foram finalizadas (Total). Filtre por período e OP/Produto e gere relatórios detalhados.'),
    
    el('div', { class: 'search-row' }, [
      el('label', {}, [ el('span', {}, 'Período inicial'), el('input', { type: 'date', id: 'fini' }) ]),
      el('label', {}, [ el('span', {}, 'Período final'), el('input', { type: 'date', id: 'ffin' }) ]),
      el('label', {}, [ el('span', {}, 'OP ou Produto'), el('input', { id: 'ftext', placeholder: 'ex.: OP-1001 ou PROD-AX12' }) ]),
      el('div', {}, el('button', { class: 'btn', onclick: () => renderList() }, 'Filtrar'))
    ])
  ]);

  const list = el('div', { class: 'grid' });

  function renderList() {
    list.innerHTML = '';
    const h = getHistory();
    console.log('Histórico carregado:', h.length, 'separações');
    
    const finiEl = document.getElementById('fini');
    const ffinEl = document.getElementById('ffin');
    const ftextEl = document.getElementById('ftext');
    
    const d0 = finiEl ? finiEl.value : '';
    const d1 = ffinEl ? ffinEl.value : '';
    const txt = (ftextEl ? ftextEl.value : '').trim().toUpperCase();
    
    const inRange = (iso) => {
      if (!d0 && !d1) return true;
      const t = new Date(iso).setHours(0,0,0,0);
      const t0 = d0 ? new Date(d0).setHours(0,0,0,0) : -Infinity;
      const t1 = d1 ? new Date(d1).setHours(23,59,59,999) : Infinity;
      return t >= t0 && t <= t1;
    };
    
    const totalRows = h.filter(r => r.finalizeMode === 'total');
    const dateFiltered = totalRows.filter(r => inRange(r.finishedAt));
    const rows = dateFiltered.filter(r => !txt || r.orderId.toUpperCase().includes(txt) || r.productCode?.toUpperCase().includes(txt));
    
    console.log('Separations filtradas:', rows.length, 'de', totalRows.length, 'totais');

    if (!rows.length) {
      list.appendChild(el('div', { class: 'card' }, 'Nenhuma separação finalizada encontrada.'));
      return;
    }
    
    for (const r of rows) {
      const order = getOrders().find(o => o.id === r.orderId) || { productCode: r.productCode, productDesc: r.productDesc };
      list.appendChild(el('div', { class: 'op-item' }, [
        el('div', {}, [
          el('div', { style: 'font-weight:600' }, `${r.orderId} • ${order.productCode} • ${order.operacao || 'N/A'}`),
          el('div', { class: 'muted' }, order.productDesc),
          el('div', { class: 'muted' }, `Finalizada: ${fmtDateTime(r.finishedAt)} | Operador: ${r.operator}`),
          el('div', { class: 'status-chip status-ok' }, 'Finalizada')
        ]),
        el('div', {}, el('button', { class: 'btn', onclick: () => openReport(r) }, 'Relatório'))
      ]));
    }
  }

  root.appendChild(filtersCard);
  root.appendChild(el('div', { class: 'card' }, [
    el('div', { style: 'font-weight:700; margin-bottom:8px' }, 'Resultados'),
    list
  ]));

  renderList(); // inicial: exibir tudo
  return root;
}

function openReport(separation) {
  // Navegar para a página de relatório
  location.hash = `#/report/${separation.orderId}`;
}

function ViewReport(orderId) {
  const root = el('div', { class: 'grid' });
  
  // Buscar a separação no histórico
  const separation = getHistory().find(s => s.orderId === orderId);
  if (!separation) {
    return el('div', { class: 'card' }, [
      el('h3', {}, 'Relatório não encontrado'),
      el('p', { class: 'muted' }, 'A separação solicitada não foi encontrada no histórico.'),
      el('button', { class: 'btn', onclick: () => history.back() }, 'Voltar')
    ]);
  }
  
  const { itemsCatalog } = getCatalog();
  const confirmedItems = separation.items.filter(it => it.confirmed);
  const pendingItems = separation.items.filter(it => !it.confirmed);
  
  // Header do relatório
  const headerCard = el('div', { class: 'card' }, [
    el('div', { style: 'display:flex; justify-content:space-between; align-items:center; margin-bottom:16px' }, [
      el('div', {}, [
        el('h2', { style: 'margin:0; color:var(--brand)' }, 'Relatório de Separação'),
        el('div', { style: 'font-size:18px; font-weight:600; margin-top:8px' }, `${separation.orderId} • ${separation.productCode}`),
        el('div', { class: 'muted' }, separation.productDesc)
      ]),
      el('button', { class: 'btn btn-ghost', onclick: () => history.back() }, 'Voltar')
    ]),
    el('div', { style: 'display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:16px; margin-top:16px' }, [
      el('div', {}, [
        el('div', { style: 'font-weight:600; color:var(--muted)' }, 'Operação'),
        el('div', {}, separation.operacao || 'N/A')
      ]),
      el('div', {}, [
        el('div', { style: 'font-weight:600; color:var(--muted)' }, 'Operador'),
        el('div', {}, separation.operator)
      ]),
      el('div', {}, [
        el('div', { style: 'font-weight:600; color:var(--muted)' }, 'Início'),
        el('div', {}, fmtDateTime(separation.startedAt))
      ]),
      el('div', {}, [
        el('div', { style: 'font-weight:600; color:var(--muted)' }, 'Finalização'),
        el('div', {}, fmtDateTime(separation.finishedAt))
      ])
    ])
  ]);
  
  // Resumo da separação
  const summaryCard = el('div', { class: 'card' }, [
    el('h3', { style: 'margin:0 0 16px 0' }, 'Resumo da Separação'),
    el('div', { style: 'display:flex; gap:16px; flex-wrap:wrap' }, [
      el('div', { class: 'status-chip status-ok' }, `Confirmados: ${confirmedItems.length}`),
      el('div', { class: 'status-chip status-pend' }, `Pendentes: ${pendingItems.length}`),
      el('div', { class: 'status-chip status-sub' }, `Substituídos: ${separation.items.filter(it => it.substitution).length}`),
      el('div', { class: 'status-chip', style: 'background:var(--brand); color:white' }, `Total: ${separation.items.length}`)
    ])
  ]);
  
  // Tabela de itens separados
  const itemsCard = el('div', { class: 'card' }, [
    el('h3', { style: 'margin:0 0 16px 0' }, `Itens Separados (${confirmedItems.length}/${separation.items.length})`),
    (() => {
      if (confirmedItems.length === 0) {
        return el('p', { class: 'muted' }, 'Nenhum item foi separado.');
      }
      
      const table = el('table', { class: 'table' });
      const thead = el('thead', {}, el('tr', {}, [
        el('th', {}, '#'),
        el('th', {}, 'Código'),
        el('th', {}, 'Descrição'),
        el('th', {}, 'Quantidade'),
        el('th', {}, 'Unidade'),
        el('th', {}, 'Tipo'),
        el('th', {}, 'Confirmado por'),
        el('th', {}, 'Data/Hora')
      ]));
      
      const tbody = el('tbody');
      confirmedItems.forEach((it, idx) => {
        const curr = itemsCatalog.find(i => i.code === it.currentCode) || { description: it.description };
        const tr = el('tr');
        tr.appendChild(el('td', {}, String(idx + 1)));
        tr.appendChild(el('td', {}, it.currentCode));
        tr.appendChild(el('td', {}, curr.description));
        tr.appendChild(el('td', { style: 'text-align:right' }, String(it.quantity)));
        tr.appendChild(el('td', {}, it.unit));
        tr.appendChild(el('td', {}, it.substitution ? 
          el('span', { class: 'status-chip status-sub' }, `ALT de ${it.baseCode}`) : 
          el('span', { class: 'status-chip status-ok' }, 'OFICIAL')
        ));
        tr.appendChild(el('td', {}, it.confirmedBy || '-'));
        tr.appendChild(el('td', {}, it.confirmedAt ? fmtDateTime(it.confirmedAt) : '-'));
        tbody.appendChild(tr);
      });
      
      table.appendChild(thead);
      table.appendChild(tbody);
      return table;
    })()
  ]);
  
  // Itens pendentes (se houver)
  let pendingCard = null;
  if (pendingItems.length > 0) {
    pendingCard = el('div', { class: 'card' }, [
      el('h3', { style: 'margin:0 0 16px 0' }, `Itens Pendentes (${pendingItems.length})`),
      (() => {
        const table = el('table', { class: 'table' });
        const thead = el('thead', {}, el('tr', {}, [
          el('th', {}, '#'),
          el('th', {}, 'Código'),
          el('th', {}, 'Descrição'),
          el('th', {}, 'Quantidade'),
          el('th', {}, 'Unidade'),
          el('th', {}, 'Tipo')
        ]));
        
        const tbody = el('tbody');
        pendingItems.forEach((it, idx) => {
          const curr = itemsCatalog.find(i => i.code === it.currentCode) || { description: it.description };
          const tr = el('tr');
          tr.appendChild(el('td', {}, String(idx + 1)));
          tr.appendChild(el('td', {}, it.currentCode));
          tr.appendChild(el('td', {}, curr.description));
          tr.appendChild(el('td', { style: 'text-align:right' }, String(it.quantity)));
          tr.appendChild(el('td', {}, it.unit));
          tr.appendChild(el('td', {}, it.substitution ? 
            el('span', { class: 'status-chip status-sub' }, `ALT de ${it.baseCode}`) : 
            el('span', { class: 'status-chip status-ok' }, 'OFICIAL')
          ));
          tbody.appendChild(tr);
        });
        
        table.appendChild(thead);
        table.appendChild(tbody);
        return table;
      })()
    ]);
  }
  
  root.appendChild(headerCard);
  root.appendChild(summaryCard);
  root.appendChild(itemsCard);
  if (pendingCard) root.appendChild(pendingCard);
  
  return root;
}

function openLongReport(message) {
  const dlg = document.getElementById('dialog-confirm');
  document.getElementById('confirm-title').textContent = 'Relatório Detalhado';
  const msgEl = document.getElementById('confirm-message');
  msgEl.textContent = '';
  msgEl.className = 'report';
  msgEl.textContent = message;
  const btnOk = document.getElementById('confirm-ok');
  const btnCancel = document.getElementById('confirm-cancel');
  const closeAll = () => { btnOk.onclick = null; btnCancel.onclick = null; dlg.close(); };
  btnOk.textContent = 'Fechar';
  btnOk.onclick = () => closeAll();
  btnCancel.onclick = () => closeAll();
  dlg.showModal();
}

function ViewRelatorios() {
  console.log('ViewRelatorios chamada');
  const root = el('div', { class: 'grid' });
  
  // Filtros
  const filtersCard = el('div', { class: 'card' }, [
    el('div', { style: 'font-weight:700; margin-bottom:16px' }, 'Relatórios de Separação'),
    el('p', { class: 'muted', style: 'margin-bottom:16px' }, 'Selecione separações por OP, operação e produto. Escolha uma ou mais separações para gerar relatório consolidado.'),
    
    el('div', { class: 'search-row', style: 'margin-bottom:16px' }, [
      el('label', {}, [
        el('span', {}, 'Tipo de Separação'),
        el('select', { id: 'rtype', onchange: () => renderReports() }, [
          el('option', { value: 'all' }, 'Todas'),
          el('option', { value: 'total' }, 'Finalizadas'),
          el('option', { value: 'parcial' }, 'Parciais'),
        ])
      ]),
      el('label', {}, [ el('span', {}, 'Data início'), el('input', { type: 'date', id: 'rdate0' }) ]),
      el('label', {}, [ el('span', {}, 'Data fim'), el('input', { type: 'date', id: 'rdate1' }) ]),
      el('div', {}, el('button', { class: 'btn', onclick: () => renderReports() }, 'Filtrar'))
    ]),
    
    el('div', { class: 'search-row', style: 'margin-bottom:16px' }, [
      el('label', {}, [ el('span', {}, 'Código da OP'), el('input', { id: 'rop', placeholder: 'ex.: OP-1001' }) ]),
      el('label', {}, [ el('span', {}, 'Código do Produto'), el('input', { id: 'rprod', placeholder: 'ex.: PROD-AX12' }) ]),
      el('label', {}, [ el('span', {}, 'Operação'), el('input', { id: 'roperacao', placeholder: 'ex.: CORTE, SOLDAGEM' }) ]),
      el('div', {}, el('button', { class: 'btn btn-ghost', onclick: () => clearFilters() }, 'Limpar'))
    ])
  ]);

  // Ações
  const actionsCard = el('div', { class: 'card' }, [
    el('div', { style: 'display:flex; gap:12px; align-items:center; flex-wrap:wrap' }, [
      el('button', { class: 'btn', onclick: () => exportSelected('pdf') }, 'Exportar PDF'),
      el('button', { class: 'btn btn-ghost', onclick: () => exportSelected('csv') }, 'Exportar CSV'),
      el('button', { class: 'btn btn-ghost', onclick: () => selectAll() }, 'Selecionar Todas'),
      el('button', { class: 'btn btn-ghost', onclick: () => selectNone() }, 'Limpar Seleção'),
      el('span', { id: 'rcount', class: 'muted' }, '')
    ])
  ]);

  // Lista de separações
  const listCard = el('div', { class: 'card' });
  
  function renderReports() {
    console.log('renderReports chamada');
    
    const rtypeEl = document.getElementById('rtype');
    const rdate0El = document.getElementById('rdate0');
    const rdate1El = document.getElementById('rdate1');
    const ropEl = document.getElementById('rop');
    const rprodEl = document.getElementById('rprod');
    const roperacaoEl = document.getElementById('roperacao');
    
    if (!rtypeEl || !rdate0El || !rdate1El || !ropEl || !rprodEl || !roperacaoEl) {
      console.error('Elementos de filtro não encontrados');
      return;
    }
    
    const type = rtypeEl.value;
    const d0 = rdate0El.value;
    const d1 = rdate1El.value;
    const opFilter = (ropEl.value || '').trim().toUpperCase();
    const prodFilter = (rprodEl.value || '').trim().toUpperCase();
    const operacaoFilter = (roperacaoEl.value || '').trim().toUpperCase();

    const inRange = (iso) => {
      if (!d0 && !d1) return true;
      const t = new Date(iso).setHours(0,0,0,0);
      const t0 = d0 ? new Date(d0).setHours(0,0,0,0) : -Infinity;
      const t1 = d1 ? new Date(d1).setHours(23,59,59,999) : Infinity;
      return t >= t0 && t <= t1;
    };

    let records = [];
    if (type === 'total') {
      records = getHistory().filter(r => r.finalizeMode === 'total');
    } else if (type === 'parcial') {
      records = getSeparations().filter(r => r.finalizeMode === 'parcial' && r.finishedAt);
    } else {
      // Todos: histórico + separações parciais
      records = [
        ...getHistory().filter(r => r.finalizeMode === 'total'),
        ...getSeparations().filter(r => r.finalizeMode === 'parcial' && r.finishedAt)
      ];
    }

    const rows = records.filter(r => {
      const order = getOrders().find(o => o.id === r.orderId) || { productCode: r.productCode, productDesc: r.productDesc };
      
      // Filtros específicos
      const opMatch = !opFilter || r.orderId.toUpperCase().includes(opFilter);
      const prodMatch = !prodFilter || (order.productCode || '').toUpperCase().includes(prodFilter);
      const operacaoMatch = !operacaoFilter || (order.operacao || '').toUpperCase().includes(operacaoFilter);
      const dateMatch = inRange(r.finishedAt);
      
      return opMatch && prodMatch && operacaoMatch && dateMatch;
    });

    listCard.innerHTML = '';
    const table = el('table', { class: 'table', id: 'rtable' });
    const thead = el('thead', {}, el('tr', {}, [
      (() => { 
        const th = el('th', {}, ''); 
        const selAll = el('input', { type: 'checkbox', id: 'rselall' }); 
        selAll.addEventListener('change', (e) => {
          document.querySelectorAll('#rtable tbody input[type="checkbox"]').forEach(chk => chk.checked = e.target.checked);
        }); 
        th.appendChild(selAll); 
        return th; 
      })(),
      el('th', {}, 'OP'),
      el('th', {}, 'Produto'),
      el('th', {}, 'Descrição'),
      el('th', {}, 'Operação'),
      el('th', {}, 'Tipo'),
      el('th', {}, 'Data/Hora'),
      el('th', {}, 'Operador'),
      el('th', {}, 'Progresso')
    ]));
    const tbody = el('tbody');
    
    if (!rows.length) {
      tbody.appendChild(el('tr', {}, el('td', { colspan: 9 }, 'Nenhum registro encontrado.')));
    } else {
      for (const rec of rows) {
        const order = getOrders().find(o => o.id === rec.orderId) || { productCode: rec.productCode, productDesc: rec.productDesc };
        const confirmed = rec.items.filter(i => i.confirmed).length;
        const total = rec.items.length;
        const progress = `${confirmed}/${total}`;
        
        const tr = el('tr');
        const chk = el('input', { type: 'checkbox', 'data-id': rec.orderId });
        tr.appendChild(el('td', {}, chk));
        tr.appendChild(el('td', {}, rec.orderId));
        tr.appendChild(el('td', {}, order.productCode));
        tr.appendChild(el('td', {}, order.productDesc));
        tr.appendChild(el('td', {}, order.operacao || 'N/A'));
        tr.appendChild(el('td', {}, 
          rec.finalizeMode === 'total' ? 
            el('span', { class: 'status-chip status-ok' }, 'Finalizada') :
            el('span', { class: 'status-chip status-pend' }, 'Parcial')
        ));
        tr.appendChild(el('td', {}, fmtDateTime(rec.finishedAt)));
        tr.appendChild(el('td', {}, rec.operator));
        tr.appendChild(el('td', {}, progress));
        tbody.appendChild(tr);
      }
    }
    table.appendChild(thead);
    table.appendChild(tbody);
    listCard.appendChild(table);
    document.getElementById('rcount').textContent = `Registros: ${rows.length}`;
  }

  function selectAll() {
    document.querySelectorAll('#rtable tbody input[type="checkbox"]').forEach(chk => chk.checked = true);
    document.getElementById('rselall').checked = true;
  }

  function selectNone() {
    document.querySelectorAll('#rtable tbody input[type="checkbox"]').forEach(chk => chk.checked = false);
    document.getElementById('rselall').checked = false;
  }

  function clearFilters() {
    document.getElementById('rtype').value = 'all';
    document.getElementById('rdate0').value = '';
    document.getElementById('rdate1').value = '';
    document.getElementById('rop').value = '';
    document.getElementById('rprod').value = '';
    document.getElementById('roperacao').value = '';
    renderReports();
  }

  function exportSelected(format) {
    const selectedIds = Array.from(document.querySelectorAll('#rtable tbody input[type="checkbox"]:checked')).map(chk => chk.dataset.id);
    if (selectedIds.length === 0) {
      alert('Selecione ao menos uma separação para exportar.');
      return;
    }

    const type = document.getElementById('rtype').value;
    let recordsToExport = [];
    if (type === 'total') {
      recordsToExport = getHistory().filter(r => r.finalizeMode === 'total' && selectedIds.includes(r.orderId));
    } else if (type === 'parcial') {
      recordsToExport = getSeparations().filter(r => r.finalizeMode === 'parcial' && r.finishedAt && selectedIds.includes(r.orderId));
    } else {
      recordsToExport = [
        ...getHistory().filter(r => r.finalizeMode === 'total' && selectedIds.includes(r.orderId)),
        ...getSeparations().filter(r => r.finalizeMode === 'parcial' && r.finishedAt && selectedIds.includes(r.orderId))
      ];
    }

    console.log(`Exportando ${recordsToExport.length} separações selecionadas para ${format.toUpperCase()}`);
    
    if (format === 'pdf') {
      exportToPDF(recordsToExport);
    } else if (format === 'csv') {
      exportToCSV(recordsToExport);
    }
  }

  function exportToPDF(records) {
    // Simulação de exportação PDF - em produção seria integrado com biblioteca como jsPDF
    const content = generateReportContent(records);
    const newWindow = window.open('', '_blank');
    newWindow.document.write(`
      <html>
        <head>
          <title>Relatório de Separações</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .section { margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .page-break { page-break-before: always; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Relatório de Separações</h1>
            <p>Gerado em: ${new Date().toLocaleString('pt-BR')}</p>
          </div>
          ${content}
        </body>
      </html>
    `);
    newWindow.document.close();
    newWindow.print();
  }

  function exportToCSV(records) {
    const csvContent = generateCSVContent(records);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio_separacoes_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function generateReportContent(records) {
    const { itemsCatalog } = getCatalog();
    let content = '';
    
    records.forEach((rec, idx) => {
      if (idx > 0) content += '<div class="page-break"></div>';
      
      const confirmedItems = rec.items.filter(it => it.confirmed);
      const pendingItems = rec.items.filter(it => !it.confirmed);
      
      content += `
        <div class="section">
          <h2>OP: ${rec.orderId} - ${rec.productCode}</h2>
          <p><strong>Operação:</strong> ${rec.operacao || 'N/A'}</p>
          <p><strong>Operador:</strong> ${rec.operator}</p>
          <p><strong>Início:</strong> ${fmtDateTime(rec.startedAt)}</p>
          <p><strong>Finalização:</strong> ${fmtDateTime(rec.finishedAt)}</p>
          <p><strong>Tipo:</strong> ${rec.finalizeMode === 'total' ? 'Finalizada' : 'Parcial'}</p>
        </div>
        
        <div class="section">
          <h3>Itens Separados (${confirmedItems.length}/${rec.items.length})</h3>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Código</th>
                <th>Descrição</th>
                <th>Quantidade</th>
                <th>Unidade</th>
                <th>Tipo</th>
                <th>Confirmado por</th>
                <th>Data/Hora</th>
              </tr>
            </thead>
            <tbody>
              ${confirmedItems.map((it, idx) => {
                const curr = itemsCatalog.find(i => i.code === it.currentCode) || { description: it.description };
                return `
                  <tr>
                    <td>${idx + 1}</td>
                    <td>${it.currentCode}</td>
                    <td>${curr.description}</td>
                    <td>${it.quantity}</td>
                    <td>${it.unit}</td>
                    <td>${it.substitution ? `ALT de ${it.baseCode}` : 'OFICIAL'}</td>
                    <td>${it.confirmedBy || '-'}</td>
                    <td>${it.confirmedAt ? fmtDateTime(it.confirmedAt) : '-'}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
      
      if (pendingItems.length > 0) {
        content += `
          <div class="section">
            <h3>Itens Pendentes (${pendingItems.length})</h3>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Código</th>
                  <th>Descrição</th>
                  <th>Quantidade</th>
                  <th>Unidade</th>
                  <th>Tipo</th>
                </tr>
              </thead>
              <tbody>
                ${pendingItems.map((it, idx) => {
                  const curr = itemsCatalog.find(i => i.code === it.currentCode) || { description: it.description };
                  return `
                    <tr>
                      <td>${idx + 1}</td>
                      <td>${it.currentCode}</td>
                      <td>${curr.description}</td>
                      <td>${it.quantity}</td>
                      <td>${it.unit}</td>
                      <td>${it.substitution ? `ALT de ${it.baseCode}` : 'OFICIAL'}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `;
      }
    });
    
    return content;
  }

  function generateCSVContent(records) {
    const { itemsCatalog } = getCatalog();
    let csv = 'OP,Produto,Operação,Operador,Início,Finalização,Tipo,Item,Código,Descrição,Quantidade,Unidade,Tipo Item,Status,Confirmado por,Data/Hora\n';
    
    records.forEach(rec => {
      const baseInfo = `"${rec.orderId}","${rec.productCode}","${rec.operacao || 'N/A'}","${rec.operator}","${fmtDateTime(rec.startedAt)}","${fmtDateTime(rec.finishedAt)}","${rec.finalizeMode === 'total' ? 'Finalizada' : 'Parcial'}"`;
      
      rec.items.forEach((it, idx) => {
        const curr = itemsCatalog.find(i => i.code === it.currentCode) || { description: it.description };
        const status = it.confirmed ? 'SEPARADO' : 'PENDENTE';
        const itemType = it.substitution ? `ALT de ${it.baseCode}` : 'OFICIAL';
        const confirmedBy = it.confirmedBy || '';
        const confirmedAt = it.confirmedAt ? fmtDateTime(it.confirmedAt) : '';
        
        csv += `${baseInfo},"${idx + 1}","${it.currentCode}","${curr.description}","${it.quantity}","${it.unit}","${itemType}","${status}","${confirmedBy}","${confirmedAt}"\n`;
      });
    });
    
    return csv;
  }

  root.appendChild(filtersCard);
  root.appendChild(actionsCard);
  root.appendChild(listCard);
  renderReports(); // Carregamento inicial
  console.log('ViewRelatorios finalizada, retornando root');
  return root;
}

function ViewDDP354() {
  return el('div', { class: 'card' }, [
    el('div', { style: 'font-weight:700; margin-bottom:16px' }, 'DDP 354 — Separação e Validação de Materiais'),
    el('p', { class: 'muted' }, 'Guia operacional detalhado do processo no chão de fábrica, cobrindo filtros, checklist, alternativos, finalização parcial/total, bloqueios e rastreabilidade.'),
    
    el('div', { class: 'grid' }, [
      // Fluxo operacional
      el('div', {}, [
        el('h4', {}, '1. Fluxo Operacional (passo a passo)'),
        el('ol', {}, [
          el('li', {}, 'Operador faz login no TeepMES (autoria registrada).'),
          el('li', {}, 'Na aba “Separar Materiais”, aplica filtros (data/OP/produto/operação) e seleciona a OP desejada.'),
          el('li', {}, 'O sistema cria/retoma a separação e abre o checklist de itens (BOM).'),
          el('li', {}, 'Quantidade atendida oficial inicia preenchida com a quantidade prevista; a confirmação é derivada da falta (0 = confirmado).'),
          el('li', {}, 'Se faltar item oficial, o operador pode lançar quantidade por alternativo quando houver cadastro de alternativas.'),
          el('li', {}, 'Ao salvar: se todos itens sem falta → Finalização Total; caso contrário → Parcial.'),
          el('li', {}, 'Finalização Total envia registro ao histórico e remove a separação ativa; Parcial mantém o progresso para retomada.'),
        ])
      ]),

      // Filtros de busca
      el('div', {}, [
        el('h4', {}, '2. Filtros da tela “Separar Materiais”'),
        el('ul', {}, [
          el('li', {}, 'Período (Data Início/Fim): filtra OPs pela data de criação.'),
          el('li', {}, 'Código da OP, Código do Produto e Operação (ex.: CORTE, SOLDAGEM, MONTAGEM).'),
          el('li', {}, 'Status: “Todas”, “Parciais” (já houve salvamento parcial) e “Sem Separação”.'),
        ])
      ]),
      
      // Checklist e comportamento dos campos
      el('div', {}, [
        el('h4', {}, '3. Checklist de Itens (tabela)'),
        el('ul', {}, [
          el('li', {}, 'Colunas: Código, Depósito, Localização, Qtde original, Quantidade atendida (oficial), Falta, Descrição, Unidade, Ações.'),
          el('li', {}, 'A confirmação é automática: quando Falta = 0 o item fica confirmado. O checkbox fica desabilitado (somente leitura).'),
          el('li', {}, 'Quantidade atendida oficial pode ser ajustada respeitando limites: 0 ≤ oficial ≤ (qtde - alternativo).'),
          el('li', {}, 'Barra de progresso mostra distribuição OFICIAL vs ALTERNATIVO no item.'),
          el('li', {}, 'Botões: “Alternativos” (quando houver) e “Desenho” (PDF do item).'),
        ])
      ]),
      
      // Alternativos
      el('div', {}, [
        el('h4', {}, '4. Alternativos (quando aplicável)'),
        el('ul', {}, [
          el('li', {}, 'A lista de alternativos é definida no cadastro e aberta via botão “Alternativos”.'),
          el('li', {}, 'Ao escolher um alternativo, o operador informa a quantidade alternativa a ser atendida.'),
          el('li', {}, 'A soma OFICIAL + ALTERNATIVO nunca pode ultrapassar a quantidade original.'),
          el('li', {}, 'O sistema registra substituição: item padrão, item alternativo, quantidade, operador e data/hora (rastreabilidade).'),
        ])
      ]),
      
      // Finalização e retomada
      el('div', {}, [
        el('h4', {}, '5. Salvar/Finalizar (Total x Parcial)'),
        el('ul', {}, [
          el('li', {}, 'Finalização Total: todos os itens sem falta. Bloqueia a separação e envia para Histórico.'),
          el('li', {}, 'Finalização Parcial: existem itens com falta. Mantém a separação disponível para retomada, com itens já confirmados respeitando mínimos salvos.'),
          el('li', {}, 'Retomada Parcial: itens já confirmados ficam bloqueados para reduzir além do mínimo registrado anteriormente.'),
        ])
      ]),
      
      // Regras de bloqueio e validação
      el('div', {}, [
        el('h4', {}, '6. Regras de Bloqueio e Validações'),
        el('ul', {}, [
          el('li', {}, 'Limites de edição: o valor oficial não pode cair abaixo do mínimo já salvo em finalizações anteriores (integridade).'),
          el('li', {}, 'Quantidade alternativa respeita teto: até (qtde original − mínimo oficial).'),
          el('li', {}, 'Botão “Salvar Separação” fica desabilitado se houver valores fora dos limites (o sistema corrige e informa).'),
        ])
      ]),
      
      // Rastreabilidade e Relatórios
      el('div', {}, [
        el('h4', {}, '7. Rastreabilidade e Relatórios'),
        el('ul', {}, [
          el('li', {}, 'Cada alteração registra operador e data/hora (confirmações e substituições).'),
          el('li', {}, '“Separações Finalizadas” exibe histórico (apenas Total) com filtros e geração de relatórios.'),
          el('li', {}, 'A aba “Relatórios” permite combinar Totais e Parciais, selecionar múltiplas OPs e exportar PDF/CSV.'),
        ])
      ]),
      
      // Integração ERP (resumo)
      el('div', {}, [
        el('h4', {}, '8. Integração com ERP (resumo)'),
        el('ul', {}, [
          el('li', {}, 'Entrada: OPs, BOM, itens, localizações e mapa de alternativos.'),
          el('li', {}, 'Saída: eventos de separação (total/parcial), substituições e autoria.'),
          el('li', {}, 'Sincronismo e política de atualização definidos em configuração entre Facchini, ERP e Teep.'),
        ])
      ]),
    ])
  ]);
}

// ===== INITIALIZATION =====
document.getElementById('btn-open-login').addEventListener('click', () => openLoginDialog());
document.getElementById('btn-logout').addEventListener('click', () => { 
  Session.logout(); 
  syncOperatorHeader();
});
document.getElementById('btn-reset-demo').addEventListener('click', () => resetDemo());

function resetDemo() {
  openConfirm('Resetar Demonstração', 
    'Esta ação irá limpar todos os dados da demonstração e voltar ao estado inicial. Deseja continuar?', 
    () => {
      // Limpar todos os dados do localStorage
      localStorage.clear();
      
      // Fazer logout
      Session.logout();
      
      // Recarregar a página para aplicar o reset
      location.reload();
    }
  );
}

window.addEventListener('hashchange', () => navigate(location.hash));
window.addEventListener('load', () => { 
  seedMockData();
  syncOperatorHeader();
  navigate(location.hash); 
});

// Menu navigation
document.querySelectorAll('.menu-item').forEach(btn => {
  btn.addEventListener('click', () => {
    const route = btn.getAttribute('data-route');
    if (route) location.hash = route;
  });
});

// DDP Approval Form
document.getElementById('btn-ddp-approval').addEventListener('click', () => {
  const dialog = document.getElementById('dialog-ddp-approval');
  const form = document.getElementById('ddp-approval-form');
  const errorDiv = document.getElementById('ddp-approval-error');
  const successDiv = document.getElementById('ddp-approval-success');
  const submitBtn = document.getElementById('ddp-approval-submit');
  const submitText = document.getElementById('submit-text');
  const submitLoading = document.getElementById('submit-loading');
  
  // Reset form
  form.reset();
  errorDiv.style.display = 'none';
  successDiv.style.display = 'none';
  submitBtn.disabled = false;
  submitText.style.display = 'inline';
  submitLoading.style.display = 'none';
  
  // Formulário simplificado - não precisa preencher campos hidden
  
  dialog.showModal();
});

// Close dialog buttons
document.getElementById('ddp-approval-close').addEventListener('click', () => {
  document.getElementById('dialog-ddp-approval').close();
});

document.getElementById('ddp-approval-cancel').addEventListener('click', () => {
  document.getElementById('dialog-ddp-approval').close();
});

// Form submission
document.getElementById('ddp-approval-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const form = e.target;
  const errorDiv = document.getElementById('ddp-approval-error');
  const successDiv = document.getElementById('ddp-approval-success');
  const submitBtn = document.getElementById('ddp-approval-submit');
  const submitText = document.getElementById('submit-text');
  const submitLoading = document.getElementById('submit-loading');
  
  // Show loading state
  submitBtn.disabled = true;
  submitText.style.display = 'none';
  submitLoading.style.display = 'inline';
  errorDiv.style.display = 'none';
  successDiv.style.display = 'none';
  
  try {
    const formData = new FormData(form);
    
    // Organizar dados para melhor formatação no email
    const nome = formData.get('nome');
    const sobrenome = formData.get('sobrenome');
    const setor = formData.get('setor');
    const cargo = formData.get('cargo');
    const telefone = formData.get('telefone');
    const email = formData.get('email');
    
    // Criar uma mensagem simples combinando todos os dados
    const mensagemCompleta = `
DDP 354 - Separacao e Validacao de Materiais
APROVACAO TECNICA CONCEDIDA

APROVADOR: ${nome} ${sobrenome}
CARGO: ${cargo}
SETOR: ${setor}
TELEFONE: ${telefone}
EMAIL: ${email}

PROXIMO PASSO: GERAR ORCAMENTO - Departamento Comercial
    `.trim();
    
    // IMPORTANTE: Não sobrescrever o campo email, usar 'message' para o conteúdo
    formData.set('message', mensagemCompleta);
    
    // Configurar reply-to
    formData.append('_replyto', email);
    
    // Debug: mostrar dados que serão enviados
    console.log('Dados do formulário:', [...formData.entries()]);
    console.log('URL do formulário:', form.action);
    
    const response = await fetch(form.action, {
      method: 'POST',
      body: formData,
      headers: {
        'Accept': 'application/json'
      }
    });
    
    console.log('Status da resposta:', response.status);
    console.log('Headers da resposta:', [...response.headers.entries()]);
    
    if (response.ok) {
      const responseText = await response.text();
      console.log('Resposta do servidor:', responseText);
      successDiv.style.display = 'block';
      form.reset();
      
      // Close dialog after 2 seconds
      setTimeout(() => {
        document.getElementById('dialog-ddp-approval').close();
      }, 2000);
    } else {
      const errorText = await response.text();
      console.error('Erro detalhado:', response.status, errorText);
      throw new Error(`Erro no envio: ${response.status} - ${errorText}`);
    }
  } catch (error) {
    console.error('Erro ao enviar formulário:', error);
    errorDiv.style.display = 'block';
  } finally {
    // Reset button state
    submitBtn.disabled = false;
    submitText.style.display = 'inline';
    submitLoading.style.display = 'none';
  }
});
