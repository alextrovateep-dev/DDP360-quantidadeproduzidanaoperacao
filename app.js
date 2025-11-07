(function () {
    const STORAGE_KEYS = {
        SETTINGS: 'teepoee.settings',
        REPORTS: 'teepoee.reports',
        EVENTS: 'teepoee.events'
    };

    const DEFAULT_SETTINGS = {
        seqMode: 'block', // none | alert | block (padrão: bloquear excedente do pendente)
        showPrev: 'yes', // yes | no
        sourcePrev: 'erp', // erp | manual
        manualPrevQty: null,
        machineStatus: 'stopped', // stopped | running
        emailEscalationMinutes: 5
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

    const EVENT_REASONS = [
        'Reprocesso autorizado',
        'Ajuste de retrabalho',
        'Refugo recuperado',
        'Produção extra por demanda'
    ];

    const AppState = {
        selectedOpId: MOCK_OPS[0].id,
        // reports: { [opId]: { [operationCode]: { good: number, scrap: number } } }
        reports: loadReports(),
        settings: loadSettings(),
        events: loadEvents()
    };

    function loadSettings() {
        try {
            const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
            return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
        } catch (e) {
            return { ...DEFAULT_SETTINGS };
        }
    }

    function createOverproductionEvent({
        op,
        operation,
        machineId,
        cap,
        requestedGood,
        excess,
        remaining,
        producedGood,
        scrapTotal
    }) {
        if (!op || !operation) return;
        const now = new Date().toISOString();
        const event = {
            id: `evt-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
            status: 'pending',
            opId: op.id,
            opTitle: op.title,
            operationCode: operation.code,
            operationName: operation.name,
            machineId,
            operatorName: 'Operador Simulado',
            plannedOpQty: operation.erpPlannedQty || 0,
            previousLimit: cap,
            producedGood,
            scrapTotal,
            requestedGood,
            excess,
            remaining,
            timestampOperator: now,
            timestampSupervisor: null,
            supervisorReason: null,
            responseMs: null,
            escalationNotified: false,
            escalationNoticeTimestamp: null,
            escalationResolvedNotified: false,
            escalationResolvedTimestamp: null
        };

        const events = {
            pending: [event, ...(AppState.events?.pending || [])],
            resolved: [...(AppState.events?.resolved || [])]
        };
        saveEvents(events);
    }

    function resolveEvent(eventId, reason) {
        const pending = [...(AppState.events?.pending || [])];
        const resolved = [...(AppState.events?.resolved || [])];
        const idx = pending.findIndex(evt => evt.id === eventId);
        if (idx === -1) return;
        const event = pending[idx];
        const resolvedAt = new Date().toISOString();
        const responseMs = event.timestampOperator ? (new Date(resolvedAt).getTime() - new Date(event.timestampOperator).getTime()) : null;
        const updated = {
            ...event,
            status: 'resolved',
            supervisorReason: reason,
            timestampSupervisor: resolvedAt,
            responseMs
        };
        let notifyResolution = false;
        if (updated.escalationNotified && !updated.escalationResolvedNotified) {
            updated.escalationResolvedNotified = true;
            updated.escalationResolvedTimestamp = resolvedAt;
            notifyResolution = true;
        }
        pending.splice(idx, 1);
        resolved.unshift(updated);
        saveEvents({ pending, resolved });
        if (notifyResolution) {
            showEscalationResolvedAlert(updated);
        }
    }

    const dateFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });
    const timeFormatter = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    function formatDateTime(iso) {
        if (!iso) return '—';
        try { return dateFormatter.format(new Date(iso)); } catch (e) { return '—'; }
    }

    function formatTime(iso) {
        if (!iso) return '—';
        try { return timeFormatter.format(new Date(iso)); } catch (e) { return '—'; }
    }

    function formatDuration(ms) {
        if (ms == null) return '—';
        const abs = Math.max(ms, 0);
        const totalMinutes = Math.floor(abs / 60000);
        const seconds = Math.floor((abs % 60000) / 1000);
        const parts = [];
        if (totalMinutes > 0) parts.push(`${totalMinutes}m`);
        parts.push(`${seconds.toString().padStart(2, '0')}s`);
        return parts.join(' ');
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

    function loadEvents() {
        try {
            const raw = localStorage.getItem(STORAGE_KEYS.EVENTS);
            if (!raw) return { pending: [], resolved: [] };
            const parsed = JSON.parse(raw);
            return {
                pending: Array.isArray(parsed.pending) ? parsed.pending : [],
                resolved: Array.isArray(parsed.resolved) ? parsed.resolved : []
            };
        } catch (e) {
            return { pending: [], resolved: [] };
        }
    }

    function saveEvents(events) {
        AppState.events = {
            pending: events.pending || [],
            resolved: events.resolved || []
        };
        localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(AppState.events));
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
        if (operIndex === 0) {
            // Primeira etapa: processado = apenas boas produzidas (refugo não aumenta processado)
            cap = op.operations[operIndex].erpPlannedQty || 0;
            const processedNow = current.good || 0; // apenas boas, refugo não conta
            const remaining = Math.max(cap - processedNow, 0);
            if (requestedGood <= remaining) return { status: 'ok', message: `OK: produção ${requestedGood} ≤ pendente ${remaining}.`, cap, remaining, processed: processedNow };
            if (skipConfirm) return { status: 'confirmed', message: `Aprovado ciente: produção ${requestedGood} > pendente ${remaining}.`, excess: requestedGood - remaining, remaining, cap, processed: processedNow };
            return { status: 'needs_confirm', message: `Produção ${requestedGood} > pendente ${remaining}.`, excess: requestedGood - remaining, remaining, cap, processed: processedNow };
        } else {
            // Demais etapas: limite é igual às peças boas finais da etapa anterior (boas - refugos)
            const prevOper = op.operations[operIndex - 1];
            cap = getFinalGoods(op.id, prevOper.code);
            const processedNow = current.good || 0; // apenas boas, refugo não conta
            const remaining = Math.max(cap - processedNow, 0);
            if (requestedGood <= remaining) return { status: 'ok', message: `OK: produção ${requestedGood} ≤ pendente ${remaining}.`, cap, remaining, processed: processedNow };
            if (skipConfirm) return { status: 'confirmed', message: `Aprovado ciente: produção ${requestedGood} > pendente ${remaining}.`, excess: requestedGood - remaining, remaining, cap, processed: processedNow };
            return { status: 'needs_confirm', message: `Produção ${requestedGood} > pendente ${remaining}.`, excess: requestedGood - remaining, remaining, cap, processed: processedNow };
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
            saveEvents({ pending: [], resolved: [] });
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
        renderEscalationConfig();
        renderMachinesGrid();
        renderSupervisorPanel();
        renderEventReport();
        wireNavigation();
        wireDdp360Form();
        checkEscalationTimers();
    }

    window.TeepOEEApp = {
        init() {
            render();
            startEscalationTicker();
        }
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
                </form>
            `;

            // attach handlers: manual commit with buttons
            const form = card.querySelector('form.machine-form');
            form.onsubmit = (e) => { e.preventDefault(); };
            const goodInput = form.querySelector('input[name="good"]');
            const scrapInput = form.querySelector('input[name="scrap"]');
            const btnGood = form.querySelector('button[data-action="commit-good"]');
            const btnScrap = form.querySelector('button[data-action="commit-scrap"]');
            const codeAttr = Number(form.getAttribute('data-oper'));
            // pré-visualização removida: contas só ao clicar em "Apontar"

            btnGood.onclick = () => {
                const g = Number(goodInput.value) || 0;
                if (g <= 0) return;
                const result = validateSequence({ op, operationCode: codeAttr, nextGood: g, nextScrap: 0 });
                const meta = {
                    machineId,
                    cap
                };
                if (result.status === 'needs_confirm') {
                    showConfirmPopup(result, op.id, codeAttr, g, 0, form, { current: null }, () => {
                        render();
                    }, meta);
                } else if (result.status === 'ok' || result.status === 'confirmed') {
                    addReport(op.id, codeAttr, g, 0);
                    form.reset();
                    render();
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

    function renderSupervisorPanel() {
        const list = document.getElementById('eventPendingList');
        if (!list) return;
        const pending = AppState.events?.pending || [];
        list.innerHTML = '';
        if (pending.length === 0) {
            const empty = document.createElement('li');
            empty.className = 'empty-events';
            empty.textContent = 'Nenhum evento pendente. Produção dentro dos limites.';
            list.appendChild(empty);
            return;
        }
        pending.forEach(event => {
            const li = document.createElement('li');
            li.className = 'event-card';
            li.innerHTML = `
                <div class="event-title">${event.operationCode} - ${event.operationName}</div>
                <div class="event-meta">
                    <span>${event.machineId || 'Máquina'}</span>
                    <span>${formatTime(event.timestampOperator)}</span>
                </div>
                <div class="event-meta">
                    <span>OP ${event.opId}</span>
                    <span class="excess">+${event.excess}</span>
                </div>
            `;
            li.onclick = () => openEventResolutionModal(event.id);
            list.appendChild(li);
        });
    }

    function openEventResolutionModal(eventId) {
        const event = (AppState.events?.pending || []).find(evt => evt.id === eventId);
        if (!event) return;
        const overlay = document.getElementById('popupOverlay');
        const msg = document.getElementById('popupMessage');
        if (!overlay || !msg) return;
        overlay.hidden = false;
        overlay.onclick = null;
        const options = EVENT_REASONS.map(reason => `<option value="${reason}">${reason}</option>`).join('');
        const limitText = event.previousLimit ?? '—';
        const producedText = event.producedGood ?? '—';
        msg.innerHTML = `
            <div class="resolve-modal">
                <h3>Justificar excesso</h3>
                <p class="resolve-resume">
                    <strong>${event.operationCode} • ${event.operationName}</strong><br>
                    Máquina: ${event.machineId || '—'}<br>
                    OP: ${event.opId}<br>
                    Produção confirmada: <strong>${producedText}</strong><br>
                    Limite permitido: <strong>${limitText}</strong><br>
                    Excesso: <strong>+${event.excess}</strong>
                </p>
                <label for="resolve-reason">Motivo da autorização</label>
                <select id="resolve-reason">
                    <option value="" disabled selected>Selecione uma justificativa...</option>
                    ${options}
                </select>
                <div class="resolve-actions">
                    <button id="resolve-cancel" class="btn secondary">Cancelar</button>
                    <button id="resolve-confirm" class="btn primary">Confirmar justificativa</button>
                </div>
            </div>
        `;
        const cancelBtn = document.getElementById('resolve-cancel');
        const confirmBtn = document.getElementById('resolve-confirm');
        const reasonSelect = document.getElementById('resolve-reason');
        reasonSelect.onchange = () => {
            reasonSelect.classList.remove('invalid');
        };
        cancelBtn.onclick = () => {
            overlay.hidden = true;
        };
        confirmBtn.onclick = () => {
            const reason = reasonSelect.value;
            if (!reason) {
                reasonSelect.classList.add('invalid');
                return;
            }
            resolveEvent(eventId, reason);
            overlay.hidden = true;
        };
    }

    function renderEventReport() {
        const container = document.getElementById('eventReportContainer');
        if (!container) return;
        const allEvents = [
            ...(AppState.events?.pending || []),
            ...(AppState.events?.resolved || [])
        ];
        if (allEvents.length === 0) {
            container.innerHTML = '<div class="empty-events" style="color: var(--muted); background: #fff; border-color: var(--border);">Nenhum evento registrado até o momento.</div>';
            return;
        }
        const rows = allEvents
            .sort((a, b) => new Date(b.timestampOperator).getTime() - new Date(a.timestampOperator).getTime())
            .map(event => `
                <tr>
                    <td>${formatDateTime(event.timestampOperator)}</td>
                    <td>${formatDateTime(event.timestampSupervisor)}</td>
                    <td>${formatDateTime(event.escalationNoticeTimestamp)}</td>
                    <td>${formatDateTime(event.escalationResolvedTimestamp)}</td>
                    <td>${event.opId}</td>
                    <td>${event.operationCode} - ${event.operationName}</td>
                    <td>${event.machineId || '—'}</td>
                    <td>${event.plannedOpQty ?? '—'}</td>
                    <td>${event.previousLimit ?? '—'}</td>
                    <td>${event.producedGood ?? '—'}</td>
                    <td>${event.excess ?? '—'}</td>
                    <td><span class="status-chip ${event.status}">${event.status === 'resolved' ? 'Resolvido' : 'Pendente'}</span></td>
                    <td>${event.supervisorReason || '—'}</td>
                    <td>${formatDuration(event.responseMs)}</td>
                </tr>
            `).join('');
        container.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Operador confirmou</th>
                        <th>Supervisor justificou</th>
                        <th>Email disparado</th>
                        <th>Email encerramento</th>
                        <th>OP</th>
                        <th>Etapa</th>
                        <th>Máquina</th>
                        <th>Prev. OP</th>
                        <th>Limite anterior</th>
                        <th>Produzido</th>
                        <th>Excesso</th>
                        <th>Status</th>
                        <th>Justificativa</th>
                        <th>Tempo resposta</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;
    }

    let escalationIntervalId = null;

    function startEscalationTicker() {
        if (escalationIntervalId != null) return;
        escalationIntervalId = setInterval(checkEscalationTimers, 15000);
        checkEscalationTimers();
    }

    function checkEscalationTimers() {
        const minutes = AppState.settings?.emailEscalationMinutes;
        if (!minutes || minutes <= 0) return;
        const thresholdMs = minutes * 60000;
        const now = Date.now();
        const pending = AppState.events?.pending || [];
        const resolved = AppState.events?.resolved || [];
        let updated = false;
        pending.forEach(event => {
            if (!event.timestampOperator || event.escalationNotified) return;
            const elapsed = now - new Date(event.timestampOperator).getTime();
            if (elapsed >= thresholdMs) {
                event.escalationNotified = true;
                event.escalationNoticeTimestamp = new Date().toISOString();
                showEscalationAlert(event);
                updated = true;
            }
        });
        if (updated) {
            saveEvents({ pending, resolved });
        }
    }

    function showEscalationAlert(event) {
        const overlay = document.getElementById('popupOverlay');
        const msg = document.getElementById('popupMessage');
        if (!overlay || !msg) {
            alert('Tempo limite atingido. Email será disparado ao supervisor.');
            return;
        }
        if (overlay.hidden === false) {
            setTimeout(() => showEscalationAlert(event), 1000);
            return;
        }
        msg.innerHTML = `
            <div class="resolve-modal">
                <h3>Escalonamento por Email</h3>
                <p class="resolve-resume">
                    O evento da operação <strong>${event.operationCode} • ${event.operationName}</strong> (OP ${event.opId})
                    excedeu o tempo configurado de resposta.<br><br>
                    Um email será enviado para a conta cadastrada no TeepNotificação informando o excesso.
                </p>
                <div class="resolve-actions">
                    <button id="escalation-ok" class="btn primary">Entendi</button>
                </div>
            </div>
        `;
        overlay.hidden = false;
        overlay.onclick = null;
        const okBtn = document.getElementById('escalation-ok');
        okBtn.onclick = () => {
            overlay.hidden = true;
        };
    }

    function showEscalationResolvedAlert(event) {
        const overlay = document.getElementById('popupOverlay');
        const msg = document.getElementById('popupMessage');
        if (!overlay || !msg) {
            alert('Evento justificado. Email de encerramento será enviado ao supervisor.');
            return;
        }
        if (overlay.hidden === false) {
            setTimeout(() => showEscalationResolvedAlert(event), 1000);
            return;
        }
        msg.innerHTML = `
            <div class="resolve-modal">
                <h3>Email de Encerramento</h3>
                <p class="resolve-resume">
                    O evento da operação <strong>${event.operationCode} • ${event.operationName}</strong> (OP ${event.opId}) foi justificado pelo supervisor.<br><br>
                    Um email de confirmação será enviado para a conta cadastrada, informando que o excesso foi tratado.
                </p>
                <div class="resolve-actions">
                    <button id="escalation-close-ok" class="btn primary">Ok</button>
                </div>
            </div>
        `;
        overlay.hidden = false;
        overlay.onclick = null;
        const okBtn = document.getElementById('escalation-close-ok');
        okBtn.onclick = () => {
            overlay.hidden = true;
        };
    }

    function renderEscalationConfig() {
        const input = document.getElementById('emailEscalationInput');
        const applyBtn = document.getElementById('emailEscalationApply');
        if (!input || !applyBtn) return;
        const current = AppState.settings?.emailEscalationMinutes ?? DEFAULT_SETTINGS.emailEscalationMinutes;
        input.value = current;
        applyBtn.onclick = () => {
            const minutes = Number(input.value);
            if (!Number.isFinite(minutes) || minutes <= 0) {
                showPopup('Informe um tempo válido (mínimo 1 minuto) para o disparo do email.');
                return;
            }
            saveSettings({ ...AppState.settings, emailEscalationMinutes: Math.round(minutes) });
            showPopup(`Tempo de disparo atualizado para ${Math.round(minutes)} minuto(s).`);
        };
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

    function showConfirmPopup(result, opId, operationCode, good, scrap, form, commitTimerRef, onClose, meta = {}) {
        const overlay = document.getElementById('popupOverlay');
        const msg = document.getElementById('popupMessage');
        if (!overlay || !msg) {
            if (confirm(`Produção ${good + scrap} > pendente ${result.remaining}. Excesso: ${result.excess}. Confirma?`)) {
                const r = validateSequence({ op: getSelectedOP(), operationCode, nextGood: good, nextScrap: scrap, skipConfirm: true });
                addReport(opId, operationCode, good, scrap);
                const op = getSelectedOP();
                const operation = op.operations.find(o => o.code === operationCode) || { code: operationCode, name: `Operação ${operationCode}`, erpPlannedQty: 0 };
                const reported = getReported(opId, operationCode);
                createOverproductionEvent({
                    op,
                    operation,
                    machineId: meta.machineId || 'Máquina',
                    cap: meta.cap ?? result.cap ?? operation.erpPlannedQty ?? 0,
                    requestedGood: good,
                    excess: result.excess,
                    remaining: result.remaining,
                    producedGood: reported.good,
                    scrapTotal: reported.scrap
                });
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
            addReport(opId, operationCode, good, scrap);
            const op = getSelectedOP();
            const operation = op.operations.find(o => o.code === operationCode) || { code: operationCode, name: `Operação ${operationCode}`, erpPlannedQty: 0 };
            const reported = getReported(opId, operationCode);
            createOverproductionEvent({
                op,
                operation,
                machineId: meta.machineId || 'Máquina',
                cap: meta.cap ?? result.cap ?? operation.erpPlannedQty ?? 0,
                requestedGood: good,
                excess: result.excess,
                remaining: result.remaining,
                producedGood: reported.good,
                scrapTotal: reported.scrap
            });
            form.reset();
            closePopup();
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


