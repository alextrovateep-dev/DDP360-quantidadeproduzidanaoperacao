(function () {
    const STORAGE_KEYS = {
        SETTINGS: 'teepoee.settings',
        REPORTS: 'teepoee.reports'
    };

    const DEFAULT_SETTINGS = {
        seqMode: 'block', // none | alert | block (padrão: bloquear excedente do pendente)
        showPrev: 'yes', // yes | no
        sourcePrev: 'erp', // erp | manual
        manualPrevQty: null,
        machineStatus: 'stopped' // stopped | running
    };

    // Mock ERP data and OPs
    const MOCK_OPS = [
        {
            id: 'VIGA001',
            title: 'VIGA001 – Viga de carroceria',
            operations: [
                { code: 10, name: 'Corte', erpPlannedQty: 10, stdTimeMinPerPc: 1.5 },
                { code: 20, name: 'Solda', erpPlannedQty: 10, stdTimeMinPerPc: 2.0 },
                { code: 30, name: 'Pintura', erpPlannedQty: 10, stdTimeMinPerPc: 3.0 }
            ]
        },
        {
            id: 'VIGA002',
            title: 'VIGA002 – Viga de carroceria',
            operations: [
                { code: 10, name: 'Corte', erpPlannedQty: 20, stdTimeMinPerPc: 1.0 },
                { code: 20, name: 'Sobra', erpPlannedQty: 20, stdTimeMinPerPc: 2.2 },
                { code: 30, name: 'Acabamento', erpPlannedQty: 20, stdTimeMinPerPc: 1.3 }
            ]
        }
    ];

    const AppState = {
        selectedOpId: MOCK_OPS[0].id,
        // reports: { [opId]: { [operationCode]: { good: number, scrap: number } } }
        reports: loadReports(),
        settings: loadSettings()
    };

    function loadSettings() {
        try {
            const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
            return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
        } catch (e) {
            return { ...DEFAULT_SETTINGS };
        }
    }

    function saveSettings(settings) {
        AppState.settings = { ...settings };
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(AppState.settings));
        render();
    }

    function loadReports() {
        try {
            const raw = localStorage.getItem(STORAGE_KEYS.REPORTS);
            return raw ? JSON.parse(raw) : {};
        } catch (e) {
            return {};
        }
    }

    function saveReports(reports) {
        AppState.reports = { ...reports };
        localStorage.setItem(STORAGE_KEYS.REPORTS, JSON.stringify(AppState.reports));
        render();
    }

    function getSelectedOP() {
        return MOCK_OPS.find(o => o.id === AppState.selectedOpId);
    }

    function getReported(opId, operationCode) {
        const entry = (AppState.reports[opId] && AppState.reports[opId][operationCode]) || { good: 0, scrap: 0 };
        return { good: entry.good || 0, scrap: entry.scrap || 0 };
    }

    function getFinalGoods(opId, operationCode) {
        const rep = getReported(opId, operationCode);
        return Math.max((rep.good || 0) - (rep.scrap || 0), 0);
    }

    function addReport(opId, operationCode, deltaGood, deltaScrap) {
        const next = { ...AppState.reports };
        next[opId] = next[opId] || {};
        const current = next[opId][operationCode] || { good: 0, scrap: 0 };
        
        if (deltaScrap > 0) {
            // Refugo: converte boas existentes em refugo (não reduz good, apenas aumenta scrap)
            // good representa o total produzido; scrap representa refugos
            // boas finais = good - scrap
            const availableForScrap = (current.good || 0) - (current.scrap || 0); // boas finais disponíveis
            const convertedScrap = Math.min(deltaScrap, availableForScrap);
            const newScrap = (current.scrap || 0) + convertedScrap;
            next[opId][operationCode] = { good: current.good || 0, scrap: newScrap };
        } else if (deltaGood > 0) {
            // Produção: adiciona boas (good representa total produzido)
            const newGood = (current.good || 0) + deltaGood;
            next[opId][operationCode] = { good: newGood, scrap: current.scrap || 0 };
        }
        saveReports(next);
    }

    // getPrevOperation/resolvePrevPlannedQty removidos (não utilizados no layout atual)

    function validateSequence({ op, operationCode, nextGood, nextScrap, skipConfirm }) {
        const operIndex = op.operations.findIndex(x => x.code === operationCode);
        const current = getReported(op.id, operationCode);
        const requestedGood = nextGood; // apenas boas novas contam para pendente

        let cap;
        let capLabel;
        if (operIndex === 0) {
            // Primeira etapa: processado = apenas boas produzidas (refugo não aumenta processado)
            cap = op.operations[operIndex].erpPlannedQty || 0;
            capLabel = `Previsto OP (operação ${operationCode}): ${cap}`;
            const processedNow = current.good || 0; // apenas boas, refugo não conta
            const remaining = Math.max(cap - processedNow, 0);
            if (requestedGood <= remaining) return { status: 'ok', message: `OK: produção ${requestedGood} ≤ pendente ${remaining}.` };
            if (skipConfirm) return { status: 'confirmed', message: `Aprovado ciente: produção ${requestedGood} > pendente ${remaining}.`, excess: requestedGood - remaining, remaining };
            return { status: 'needs_confirm', message: `Produção ${requestedGood} > pendente ${remaining}.`, excess: requestedGood - remaining, remaining };
        } else {
            // Demais etapas: limite é igual às peças boas finais da etapa anterior (boas - refugos)
            const prevOper = op.operations[operIndex - 1];
            cap = getFinalGoods(op.id, prevOper.code);
            capLabel = `Boas finais da operação anterior (${prevOper.code}): ${cap}`;
            const processedNow = current.good || 0; // apenas boas, refugo não conta
            const remaining = Math.max(cap - processedNow, 0);
            if (requestedGood <= remaining) return { status: 'ok', message: `OK: produção ${requestedGood} ≤ pendente ${remaining}.` };
            if (skipConfirm) return { status: 'confirmed', message: `Aprovado ciente: produção ${requestedGood} > pendente ${remaining}.`, excess: requestedGood - remaining, remaining };
            return { status: 'needs_confirm', message: `Produção ${requestedGood} > pendente ${remaining}.`, excess: requestedGood - remaining, remaining };
        }
    }

    function recordApprovalEvent(opId, operationCode, excess, details) {
        const events = JSON.parse(localStorage.getItem('teepoee.approval_events') || '[]');
        events.push({
            timestamp: new Date().toISOString(),
            opId,
            operationCode,
            excess,
            details,
            user: 'operador' // pode vir de autenticação futura
        });
        localStorage.setItem('teepoee.approval_events', JSON.stringify(events));
    }

    function renderOPSelector() {
        const opSelect = document.getElementById('opSelect');
        opSelect.innerHTML = '';
        MOCK_OPS.forEach(op => {
            const opt = document.createElement('option');
            opt.value = op.id;
            opt.textContent = op.title;
            opSelect.appendChild(opt);
        });
        opSelect.value = AppState.selectedOpId;
        opSelect.onchange = () => {
            AppState.selectedOpId = opSelect.value;
            render();
        };

        const reloadBtn = document.getElementById('reloadData');
        reloadBtn.onclick = () => render();

        const resetBtn = document.getElementById('resetSim');
        resetBtn.onclick = () => {
            const next = { ...AppState.reports };
            delete next[AppState.selectedOpId];
            saveReports(next);
        };
    }

    function renderOperationsTable() {
        const container = document.getElementById('operationsTableContainer');
        const op = getSelectedOP();

        const table = document.createElement('table');
        table.className = 'table';
        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr>
                <th>Código</th>
                <th>Descrição</th>
                <th>Prevista (ERP)</th>
                <th>Boas Finais</th>
                <th>Refugadas reportadas</th>
                <th>Limite atual</th>
                <th>Resultado</th>
            </tr>
        `;
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        op.operations.forEach((oper) => {
            const tr = document.createElement('tr');
            const reported = getReported(op.id, oper.code);
            const finalGoods = getFinalGoods(op.id, oper.code);
            const operIndex = op.operations.findIndex(x => x.code === oper.code);
            let currentCap;
            if (operIndex === 0) {
                currentCap = oper.erpPlannedQty;
            } else {
                const prev = op.operations[operIndex - 1];
                currentCap = getFinalGoods(op.id, prev.code);
            }
            const validation = validateSequence({ op, operationCode: oper.code, nextGood: 0, nextScrap: 0 });
            const statusClass = validation.status === 'ok' ? 'chip-ok' : validation.status === 'warn' ? 'chip-warn' : 'chip-error';

            tr.innerHTML = `
                <td>${oper.code}</td>
                <td>${oper.name}</td>
                <td>${oper.erpPlannedQty}</td>
                <td>${finalGoods}</td>
                <td>${reported.scrap}</td>
                <td>${currentCap}</td>
                <td><span class="chip ${statusClass}">${validation.status.toUpperCase()}</span></td>
            `;
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        container.innerHTML = '';
        container.appendChild(table);
    }

    // renderSimulationForm removido (tela central desativada)

    // renderSettings removido (parametrização fora da tela)

    function render() {
        renderOPSelector();
        renderOperationsTable();
        renderMachinesGrid();
        wireNavigation();
        wireDdp360Form();
    }

    window.TeepOEEApp = {
        init: render
    };

    // renderStatusBar/renderKpis removidos (seções não exibidas)

    // renderOperationCards removido (cards duplicados descontinuados)

    function renderMachinesGrid() {
        const container = document.getElementById('machinesGrid');
        if (!container) return;
        const op = getSelectedOP();
        container.innerHTML = '';
        const plannedTotal = Math.max(...op.operations.map(o => o.erpPlannedQty || 0));
        op.operations.slice(0, 3).forEach((oper, idx) => {
            const card = document.createElement('div');
            card.className = 'machine-card';
            const reported = getReported(op.id, oper.code);

            let cap;
            if (idx === 0) {
                cap = oper.erpPlannedQty || 0;
            } else {
                const prev = op.operations[idx - 1];
                cap = getFinalGoods(op.id, prev.code);
            }
            // processado = apenas boas produzidas (refugo não aumenta processado, pois já estava incluído)
            const processed = reported.good || 0;
            const finalGoods = Math.max(reported.good - reported.scrap, 0);
            const pending = Math.max(cap - processed, 0);

            const machineId = `M${idx + 1}`;

            card.innerHTML = `
                <div class="machine-header">
                    <span>${machineId} • ${oper.code} - ${oper.name}</span>
                </div>
                <div class="op-metrics">
                    <div class="metric"><div class="label">Atd Prevista</div><div class="value" data-planned>${plannedTotal}</div></div>
                    <div class="metric"><div class="label">Boas Finais</div><div class="value" data-good>${finalGoods}</div></div>
                    <div class="metric"><div class="label">Refugadas</div><div class="value" data-scrap>${reported.scrap}</div></div>
                    <div class="metric"><div class="label">Pendente</div><div class="value" data-pending>${pending}</div></div>
                </div>
                <form class="machine-form" data-oper="${oper.code}">
                    <div class="form-row"><label>Quantidade BOA</label><input type="number" inputmode="numeric" name="good" min="0" step="1" placeholder="pcs boas"></div>
                    <div class="form-row" style="display:flex; gap:8px; justify-content:flex-start;">
                        <button type="button" class="btn primary" data-action="commit-good">Apontar Produção</button>
                    </div>
                    <div class="form-row"><label>Quantidade REFUGADA</label><input type="number" inputmode="numeric" name="scrap" min="0" step="1" placeholder="pcs refugadas"></div>
                    <div class="form-row" style="display:flex; gap:8px; justify-content:flex-start;">
                        <button type="button" class="btn btn-warning" data-action="commit-scrap">Apontar Refugo</button>
                    </div>
                    <div class="inline-warn" data-warn></div>
                </form>
            `;

            // attach handlers: manual commit with buttons
            const form = card.querySelector('form.machine-form');
            form.onsubmit = (e) => { e.preventDefault(); };
            const goodInput = form.querySelector('input[name="good"]');
            const scrapInput = form.querySelector('input[name="scrap"]');
            const btnGood = form.querySelector('button[data-action="commit-good"]');
            const btnScrap = form.querySelector('button[data-action="commit-scrap"]');
            const warnBox = form.querySelector('[data-warn]');
            const codeAttr = Number(form.getAttribute('data-oper'));
            // pré-visualização removida: contas só ao clicar em "Apontar"

            btnGood.onclick = () => {
                const g = Number(goodInput.value) || 0;
                if (g <= 0) return;
                const result = validateSequence({ op, operationCode: codeAttr, nextGood: g, nextScrap: 0 });
                if (result.status === 'needs_confirm') {
                    showConfirmPopup(result, op.id, codeAttr, g, 0, form, { current: null }, () => {
                        render(); // atualizar cards após confirmação
                    });
                } else if (result.status === 'ok' || result.status === 'confirmed') {
                    addReport(op.id, codeAttr, g, 0);
                    form.reset();
                    render(); // atualizar cards após apontamento
                }
            };

            btnScrap.onclick = () => {
                const s = Number(scrapInput.value) || 0;
                if (s <= 0) return;
                // boas finais disponíveis = good - scrap (boas que ainda não foram refugadas)
                const available = Math.max((reported.good || 0) - (reported.scrap || 0), 0);
                if (s > available) {
                    showPopup(`Refugo (${s}) maior que boas finais disponíveis (${available}).`);
                    return;
                }
                addReport(op.id, codeAttr, 0, s);
                form.reset();
                render(); // atualizar cards após apontamento
            };
            // sem preview: os valores do card são atualizados após o apontamento

            container.appendChild(card);
        });
    }

    function showPopup(message) {
        const overlay = document.getElementById('popupOverlay');
        const msg = document.getElementById('popupMessage');
        if (!overlay || !msg) return alert(message);
        msg.textContent = message;
        overlay.hidden = false;
        const hide = () => { overlay.hidden = true; overlay.removeEventListener('click', hide); };
        overlay.addEventListener('click', hide);
        setTimeout(hide, 2500);
    }

    function showConfirmPopup(result, opId, operationCode, good, scrap, form, commitTimerRef, onClose) {
        const overlay = document.getElementById('popupOverlay');
        const msg = document.getElementById('popupMessage');
        if (!overlay || !msg) {
            if (confirm(`Produção ${good + scrap} > pendente ${result.remaining}. Excesso: ${result.excess}. Confirma?`)) {
                const r = validateSequence({ op: getSelectedOP(), operationCode, nextGood: good, nextScrap: scrap, skipConfirm: true });
                recordApprovalEvent(opId, operationCode, result.excess, r);
                addReport(opId, operationCode, good, scrap);
                form.reset();
            }
            if (onClose) onClose();
            return;
        }
        // Cancelar qualquer timer pendente
        if (commitTimerRef && commitTimerRef.current) {
            clearTimeout(commitTimerRef.current);
            commitTimerRef.current = null;
        }
        const oper = getSelectedOP().operations.find(o => o.code === operationCode);
        msg.innerHTML = `
            <div style="text-align: left; margin-bottom: 12px;">
                <strong>Produção acima do pendente</strong><br>
                Você está produzindo <strong>${good + scrap} unidades</strong> (boas: ${good}, refugadas: ${scrap})<br>
                Pendente disponível: <strong>${result.remaining}</strong><br>
                Excesso: <strong>${result.excess} unidades</strong><br>
                <br>
                Confirma que deseja gravar esta produção?
            </div>
            <div style="display: flex; gap: 8px; justify-content: center;">
                <button id="confirm-yes" style="background: #22a06b; color: white; border: 0; padding: 8px 16px; border-radius: 6px; cursor: pointer;">Sim, confirmar</button>
                <button id="confirm-no" style="background: #c0392b; color: white; border: 0; padding: 8px 16px; border-radius: 6px; cursor: pointer;">Cancelar</button>
            </div>
        `;
        overlay.hidden = false;
        overlay.onclick = null;
        const yesBtn = document.getElementById('confirm-yes');
        const noBtn = document.getElementById('confirm-no');
        const closePopup = () => {
            overlay.hidden = true;
            if (onClose) onClose();
        };
        yesBtn.onclick = () => {
            const r = validateSequence({ op: getSelectedOP(), operationCode, nextGood: good, nextScrap: scrap, skipConfirm: true });
            recordApprovalEvent(opId, operationCode, result.excess, r);
            addReport(opId, operationCode, good, scrap);
            form.reset();
            closePopup();
            render(); // atualizar cards após confirmação
        };
        noBtn.onclick = () => {
            // Cancelar timer se ainda existir
            if (commitTimerRef && commitTimerRef.current) {
                clearTimeout(commitTimerRef.current);
                commitTimerRef.current = null;
            }
            // Limpar campos do formulário SEM salvar
            form.reset();
            closePopup();
        };
    }

    function wireNavigation() {
        const btnA = document.getElementById('navApontamento');
        const btnD = document.getElementById('navDDP');
        if (!btnA || !btnD) return;
        const pageA = document.getElementById('pageApontamento');
        const pageD = document.getElementById('pageDDP360');
        const activate = (target) => {
            const isA = target === 'A';
            pageA.hidden = !isA;
            pageD.hidden = isA;
            btnA.classList.toggle('active', isA);
            btnD.classList.toggle('active', !isA);
        };
        btnA.onclick = () => activate('A');
        btnD.onclick = () => activate('D');
        activate('A');
    }

    function wireDdp360Form() {
        const form = document.getElementById('ddp-approval-form');
        if (!form) return;
        const cpfInput = document.getElementById('ddp-cpf');
        if (cpfInput && !cpfInput._maskBound) {
            cpfInput.addEventListener('input', () => {
                let v = cpfInput.value.replace(/\D/g, '');
                if (v.length > 11) v = v.slice(0, 11);
                v = v.replace(/(\d{3})(\d)/, '$1.$2');
                v = v.replace(/(\d{3})(\d)/, '$1.$2');
                v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
                cpfInput.value = v;
            });
            cpfInput._maskBound = true;
        }

        form.onsubmit = (e) => {
            e.preventDefault();
            const btn = document.getElementById('ddp-approval-submit');
            const ok = sendDdpApproval();
            if (btn) btn.disabled = true;
            ok.finally(() => { if (btn) btn.disabled = false; });
        };
    }

    function sendDdpApproval() {
        const successBox = document.getElementById('ddp-success');
        const errorBox = document.getElementById('ddp-error');
        if (successBox) successBox.style.display = 'none';
        if (errorBox) errorBox.style.display = 'none';

        const empresa = document.getElementById('ddp-empresa')?.value?.trim();
        const nome = document.getElementById('ddp-aprovador')?.value?.trim();
        const cpf = document.getElementById('ddp-cpf')?.value?.trim() || '';
        const cargo = document.getElementById('ddp-cargo')?.value?.trim() || 'Não informado';
        const email = document.getElementById('ddp-email')?.value?.trim();
        const obs = document.getElementById('ddp-observacoes')?.value?.trim() || 'Nenhuma observação';

        if (!empresa || !nome || !email) {
            if (errorBox) { errorBox.textContent = 'Por favor, preencha empresa, aprovador e e-mail.'; errorBox.style.display = 'block'; }
            return Promise.resolve();
        }

        const data = new FormData();
        const payload = {
            _subject: 'Aprovação DDP Facchini',
            Tipo: 'Aprovação DDP Facchini',
            Empresa: empresa,
            Aprovador: nome,
            CPF: cpf,
            Cargo: cargo,
            Email: email,
            Observações: obs,
            Data: new Date().toLocaleString('pt-BR'),
            Sistema: 'Protótipo Facchini',
        };
        Object.keys(payload).forEach(k => data.append(k, payload[k]));

        return fetch('https://formspree.io/f/mblybqqb', {
            method: 'POST',
            headers: { 'Accept': 'application/json' },
            body: data,
            mode: 'cors'
        }).then(async (resp) => {
            if (resp.ok) {
                try { await resp.json(); } catch (e) {}
                if (successBox) successBox.style.display = 'block';
                document.getElementById('ddp-approval-form').reset();
            } else {
                // fallback
                sendViaHiddenForm(payload);
                if (successBox) successBox.style.display = 'block';
            }
        }).catch(() => {
            sendViaHiddenForm(payload);
            if (successBox) successBox.style.display = 'block';
        });
    }

    function sendViaHiddenForm(emailData) {
        let iframe = document.getElementById('ddp-hidden-submit');
        if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.id = 'ddp-hidden-submit';
            iframe.name = 'ddp-hidden-submit';
            iframe.style.display = 'none';
            document.body.appendChild(iframe);
        }
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = 'https://formspree.io/f/mblybqqb';
        form.target = 'ddp-hidden-submit';
        form.style.display = 'none';
        Object.keys(emailData).forEach(key => {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = key;
            input.value = emailData[key];
            form.appendChild(input);
        });
        document.body.appendChild(form);
        form.submit();
        setTimeout(() => { if (form.parentNode) document.body.removeChild(form); }, 1500);
    }
})();


