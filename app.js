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

    function addReport(opId, operationCode, deltaGood, deltaScrap) {
        const next = { ...AppState.reports };
        next[opId] = next[opId] || {};
        const current = next[opId][operationCode] || { good: 0, scrap: 0 };
        next[opId][operationCode] = {
            good: (current.good || 0) + deltaGood,
            scrap: (current.scrap || 0) + deltaScrap
        };
        saveReports(next);
    }

    function getPrevOperation(op, operationCode) {
        const idx = op.operations.findIndex(x => x.code === operationCode);
        if (idx <= 0) return null;
        return op.operations[idx - 1];
    }

    function resolvePrevPlannedQty(op, operationCode) {
        const prev = getPrevOperation(op, operationCode);
        if (!prev) return null;
        if (AppState.settings.sourcePrev === 'manual' && AppState.settings.manualPrevQty != null) {
            return Number(AppState.settings.manualPrevQty) || 0;
        }
        return prev.erpPlannedQty || 0;
    }

    function validateSequence({ op, operationCode, nextGood, nextScrap }) {
        const operIndex = op.operations.findIndex(x => x.code === operationCode);
        const current = getReported(op.id, operationCode);
        const nextTotals = { good: current.good + nextGood, scrap: current.scrap + nextScrap };

        let cap;
        let capLabel;
        if (operIndex === 0) {
            // Primeira etapa: bom + refugo <= previsto da OP (ERP da própria operação)
            cap = op.operations[operIndex].erpPlannedQty || 0;
            capLabel = `Previsto OP (operação ${operationCode}): ${cap}`;
            const totalProduced = nextTotals.good + nextTotals.scrap;
            if (totalProduced <= cap) return { status: 'ok', message: `OK: bom+refugo ${totalProduced} ≤ ${capLabel}.` };
            const pendente = Math.max(cap - (current.good + current.scrap), 0);
            return { status: 'error', message: `Não é permitido produzir acima do previsto da OP. Tentado: ${nextGood + nextScrap}; Pendente: ${pendente}.` };
        } else {
            // Demais etapas: limite é igual às peças boas da etapa anterior já reportadas
            const prevOper = op.operations[operIndex - 1];
            const prevReported = getReported(op.id, prevOper.code);
            cap = prevReported.good || 0;
            capLabel = `Boas da operação anterior (${prevOper.code}): ${cap}`;
            const totalProcessed = nextTotals.good + nextTotals.scrap;
            if (totalProcessed <= cap) return { status: 'ok', message: `OK: processado ${totalProcessed} ≤ ${capLabel}.` };
            const pendente = Math.max(cap - (current.good + current.scrap), 0);
            return { status: 'error', message: `Não é permitido produzir acima do liberado de peças boas da etapa anterior. Tentado: ${nextGood + nextScrap}; Liberado: ${pendente}.` };
        }
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
        const showPrev = AppState.settings.showPrev === 'yes';

        const table = document.createElement('table');
        table.className = 'table';
        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr>
                <th>Código</th>
                <th>Descrição</th>
                <th>Prevista (ERP)</th>
                ${showPrev ? '<th>Prevista operação anterior</th>' : ''}
                <th>Boas reportadas</th>
                <th>Refugadas reportadas</th>
                <th>Limite atual</th>
                <th>Resultado</th>
            </tr>
        `;
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        op.operations.forEach((oper) => {
            const tr = document.createElement('tr');
            const prevPlanned = resolvePrevPlannedQty(op, oper.code);
            const reported = getReported(op.id, oper.code);
            const operIndex = op.operations.findIndex(x => x.code === oper.code);
            let currentCap;
            if (operIndex === 0) {
                currentCap = oper.erpPlannedQty;
            } else {
                const prev = op.operations[operIndex - 1];
                currentCap = getReported(op.id, prev.code).good;
            }
            const validation = validateSequence({ op, operationCode: oper.code, nextGood: 0, nextScrap: 0 });
            const statusClass = validation.status === 'ok' ? 'chip-ok' : validation.status === 'warn' ? 'chip-warn' : 'chip-error';

            tr.innerHTML = `
                <td>${oper.code}</td>
                <td>${oper.name}</td>
                <td>${oper.erpPlannedQty}</td>
                ${showPrev ? `<td>${prevPlanned != null ? prevPlanned : '-'}</td>` : ''}
                <td>${reported.good}</td>
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

    function renderSimulationForm() {
        const op = getSelectedOP();
        const opSelect = document.getElementById('operationSelect');
        opSelect.innerHTML = '';
        op.operations.forEach(oper => {
            const opt = document.createElement('option');
            opt.value = String(oper.code);
            opt.textContent = `${oper.code} - ${oper.name}`;
            opSelect.appendChild(opt);
        });

        const form = document.getElementById('reportForm');
        form.onsubmit = (e) => {
            e.preventDefault();
            const code = Number(opSelect.value);
            const good = Number(document.getElementById('goodQtyInput').value) || 0;
            const scrap = Number(document.getElementById('scrapQtyInput').value) || 0;
            if (good < 0 || scrap < 0) return;
            if (good === 0 && scrap === 0) return;

            const result = validateSequence({ op, operationCode: code, nextGood: good, nextScrap: scrap });
            const resultArea = document.getElementById('resultArea');
            resultArea.className = 'result-area';
            if (result.status === 'ok') resultArea.classList.add('result-ok');
            if (result.status === 'warn') resultArea.classList.add('result-warn');
            if (result.status === 'error') resultArea.classList.add('result-error');
            resultArea.textContent = result.message;

            if (result.status === 'error') {
                showPopup(result.message);
            }

            // sem log

            if (result.status !== 'error') {
                addReport(op.id, code, good, scrap);
                document.getElementById('goodQtyInput').value = '';
                document.getElementById('scrapQtyInput').value = '';
            }
        };
    }

    function renderSettings() {
        // Painel removido da UI; proteger caso não exista
        const seqModeEl = document.getElementById('seqMode');
        if (!seqModeEl) return;
        const { seqMode, showPrev, sourcePrev, manualPrevQty } = AppState.settings;
        const showPrevEl = document.getElementById('showPrev');
        const sourcePrevEl = document.getElementById('sourcePrev');
        const manualPrevQtyEl = document.getElementById('manualPrevQty');
        const manualPrevRow = document.getElementById('manualPrevRow');

        seqModeEl.value = seqMode;
        showPrevEl.value = showPrev;
        sourcePrevEl.value = sourcePrev;
        if (manualPrevQtyEl) manualPrevQtyEl.value = manualPrevQty != null ? manualPrevQty : '';
        if (manualPrevRow) manualPrevRow.hidden = sourcePrev !== 'manual';

        function handleSourceToggle() {
            const isManual = sourcePrevEl && sourcePrevEl.value === 'manual';
            if (manualPrevRow) manualPrevRow.hidden = !isManual;
        }
        if (sourcePrevEl) sourcePrevEl.onchange = handleSourceToggle;
        handleSourceToggle();

        const saveBtn = document.getElementById('saveSettings');
        if (saveBtn) saveBtn.onclick = () => {
            const newSettings = {
                seqMode: seqModeEl.value,
                showPrev: showPrevEl.value,
                sourcePrev: sourcePrevEl.value,
                manualPrevQty: manualPrevQtyEl && manualPrevQtyEl.value === '' ? null : Number(manualPrevQtyEl?.value || 0)
            };
            saveSettings(newSettings);
        };
    }

    function render() {
        renderOPSelector();
        renderOperationsTable();
        renderSimulationForm();
        renderSettings();
        renderStatusBar();
        renderKpis();
        renderMachinesGrid();
        wireNavigation();
        wireDdp360Form();
    }

    window.TeepOEEApp = {
        init: render
    };

    function renderStatusBar() {
        const bar = document.getElementById('statusBar');
        if (!bar) return;
        const select = document.getElementById('statusToggle');
        const label = document.getElementById('statusLabel');
        select.value = AppState.settings.machineStatus;
        label.textContent = AppState.settings.machineStatus === 'running' ? 'Em execução' : 'Parado';
        bar.classList.toggle('running', AppState.settings.machineStatus === 'running');
        select.onchange = () => {
            saveSettings({ ...AppState.settings, machineStatus: select.value });
        };
    }

    function renderKpis() {
        const op = getSelectedOP();
        if (!op) return;
        // Guard: KPIs removidos do HTML
        if (!document.getElementById('kpiTotalValue')) return;
        const plannedTotal = Math.max(...op.operations.map(o => o.erpPlannedQty || 0));
        // Realizado na ordem: somatório de boas em TODAS as operações (protótipo)
        let realized = 0;
        let scrapSum = 0;
        op.operations.forEach(oper => {
            const rep = getReported(op.id, oper.code);
            realized += rep.good;
            scrapSum += rep.scrap;
        });
        // opcionalmente poderíamos limitar realized ao plannedTotal
        realized = Math.min(realized, plannedTotal);
        const pending = Math.max(plannedTotal - realized, 0);

        document.getElementById('kpiTotalValue').textContent = String(plannedTotal);
        document.getElementById('kpiDoneValue').textContent = String(realized);
        document.getElementById('kpiScrapValue').textContent = String(scrapSum);
        document.getElementById('kpiPendingValue').textContent = String(pending);
    }

    function renderOperationCards() {
        const container = document.getElementById('operationCards');
        if (!container) return;
        const op = getSelectedOP();
        container.innerHTML = '';
        op.operations.forEach((oper, idx) => {
            const card = document.createElement('div');
            card.className = 'op-card';
            const reported = getReported(op.id, oper.code);

            let cap, capText;
            if (idx === 0) {
                cap = oper.erpPlannedQty || 0;
                capText = `Limite: Previsto OP = ${cap}`;
            } else {
                const prev = op.operations[idx - 1];
                const prevGood = getReported(op.id, prev.code).good;
                cap = prevGood;
                capText = `Limite: Boas da operação ${prev.code} = ${cap}`;
            }
            const processed = reported.good + reported.scrap;
            const pending = Math.max(cap - processed, 0);

            card.innerHTML = `
                <div class="op-card-title">
                    <span>${oper.code} - ${oper.name}</span>
                </div>
                <div class="op-metrics">
                    <div class="metric"><div class="label">Boas</div><div class="value">${reported.good}</div></div>
                    <div class="metric"><div class="label">Refugadas</div><div class="value">${reported.scrap}</div></div>
                    <div class="metric"><div class="label">Pendente</div><div class="value">${pending}</div></div>
                </div>
                <div class="op-cap">${capText}</div>
            `;
            container.appendChild(card);
        });
    }

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
                cap = getReported(op.id, prev.code).good;
            }
            const processed = reported.good + reported.scrap;
            const pending = Math.max(cap - processed, 0);

            const machineId = `M${idx + 1}`;

            card.innerHTML = `
                <div class="machine-header">
                    <span>${machineId} • ${oper.code} - ${oper.name}</span>
                </div>
                <div class="op-metrics">
                    <div class="metric"><div class="label">Atd Prevista</div><div class="value" data-planned>${plannedTotal}</div></div>
                    <div class="metric"><div class="label">Boas</div><div class="value" data-good>${reported.good}</div></div>
                    <div class="metric"><div class="label">Refugadas</div><div class="value" data-scrap>${reported.scrap}</div></div>
                    <div class="metric"><div class="label">Pendente</div><div class="value" data-pending>${pending}</div></div>
                </div>
                <form class="machine-form" data-oper="${oper.code}">
                    <div class="form-row"><label>Quantidade BOA</label><input type="number" name="good" min="0" step="1" placeholder="pcs boas"></div>
                    <div class="form-row"><label>Quantidade REFUGADA</label><input type="number" name="scrap" min="0" step="1" placeholder="pcs refugadas"></div>
                    <div class="inline-warn" data-warn></div>
                </form>
            `;

            // attach handlers immediately
            const form = card.querySelector('form.machine-form');
            form.onsubmit = (e) => { e.preventDefault(); };

            // pre-validation on input
            const goodInput = form.querySelector('input[name="good"]');
            const scrapInput = form.querySelector('input[name="scrap"]');
            const warnBox = form.querySelector('[data-warn]');
            const codeAttr = Number(form.getAttribute('data-oper'));
            let commitTimer = null;
            const updateValidity = (sourceField) => {
                let g = Number(goodInput.value) || 0;
                let s = Number(scrapInput.value) || 0;
                // preview calculations
                const goodPreview = card.querySelector('[data-good]');
                const scrapPreview = card.querySelector('[data-scrap]');
                const pendPreview = card.querySelector('[data-pending]');
                const processedNow = (reported.good || 0) + (reported.scrap || 0);
                const remainingBase = Math.max(cap - processedNow, 0);

                // Enforce hard limit: boas+refugo digitados não podem ultrapassar o restante permitido
                const totalTyped = g + s;
                if (totalTyped > remainingBase) {
                    const allowedForField = Math.max(remainingBase - (sourceField === 'good' ? s : g), 0);
                    if (sourceField === 'good') { g = allowedForField; goodInput.value = String(g); }
                    else if (sourceField === 'scrap') { s = allowedForField; scrapInput.value = String(s); }
                    const msg = idx === 0
                        ? `Não é permitido produzir acima do previsto da OP (limite ${remainingBase}).`
                        : `Não é permitido produzir acima do liberado de peças boas da etapa anterior (limite ${remainingBase}).`;
                    warnBox.textContent = msg;
                    warnBox.classList.add('show');
                    showPopup(msg);
                }

                const newGood = (reported.good || 0) + g;
                const newScrap = (reported.scrap || 0) + s;
                const newProcessed = newGood + newScrap;
                const newPending = Math.max(cap - newProcessed, 0);
                if (goodPreview) goodPreview.textContent = String(newGood);
                if (scrapPreview) scrapPreview.textContent = String(newScrap);
                if (pendPreview) pendPreview.textContent = String(newPending);

                if (g === 0 && s === 0) { warnBox.classList.remove('show'); warnBox.textContent = ''; pendPreview && (pendPreview.style.color = ''); if (commitTimer) { clearTimeout(commitTimer); commitTimer = null; } return; }
                const result = validateSequence({ op, operationCode: codeAttr, nextGood: g, nextScrap: s });
                const invalid = result.status === 'error';
                if (invalid) { warnBox.textContent = result.message; warnBox.classList.add('show'); if (pendPreview) pendPreview.style.color = '#c0392b'; }
                else {
                    warnBox.classList.remove('show'); warnBox.textContent = ''; if (pendPreview) pendPreview.style.color = '';
                    // debounce commit on each digit
                    if (commitTimer) clearTimeout(commitTimer);
                    commitTimer = setTimeout(() => {
                        const gNow = Number(goodInput.value) || 0;
                        const sNow = Number(scrapInput.value) || 0;
                        if (gNow === 0 && sNow === 0) return;
                        const rNow = validateSequence({ op, operationCode: codeAttr, nextGood: gNow, nextScrap: sNow });
                        if (rNow.status !== 'error') {
                            addReport(op.id, codeAttr, gNow, sNow);
                            form.reset();
                        }
                    }, 500);
                }
            };
            goodInput.addEventListener('input', () => updateValidity('good'));
            scrapInput.addEventListener('input', () => updateValidity('scrap'));
            goodInput.addEventListener('change', () => updateValidity('good'));
            scrapInput.addEventListener('change', () => updateValidity('scrap'));
            goodInput.addEventListener('keyup', () => updateValidity('good'));
            scrapInput.addEventListener('keyup', () => updateValidity('scrap'));
            form.addEventListener('input', () => updateValidity());
            // commit only via debounce in updateValidity (no Enter/blur to avoid duplicidade)
            // initialize once
            updateValidity();

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


