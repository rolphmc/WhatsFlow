/**
 * Sessions Management JavaScript
 * Handles CRUD operations for WhatsApp Web sessions
 */

// Função para inicializar tooltips
function initTooltips() {
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl, {
            trigger: 'hover'
        });
    });
}

document.addEventListener('DOMContentLoaded', function() {
    // Inicializar tooltips do Bootstrap na carga inicial
    initTooltips();
    // Function to load API endpoints for all active sessions
    function loadApiEndpoints() {
        const apiEndpointsTableBody = document.getElementById('api-endpoints-table-body');
        
        if (!apiEndpointsTableBody) {
            console.warn('API endpoints table body not found');
            return;
        }
        
        apiCall('/api/sessions')
            .then(sessions => {
                if (sessions.length === 0) {
                    apiEndpointsTableBody.innerHTML = `
                        <tr>
                            <td colspan="5" class="text-center">
                                Nenhuma sessão ativa encontrada. Crie uma sessão primeiro para visualizar os endpoints de API disponíveis.
                            </td>
                        </tr>
                    `;
                    return;
                }
                
                let tableContent = '';
                
                sessions.forEach(session => {
                    // Calculate the port based on session ID (same logic as in whatsapp_bridge.js)
                    const port = 3000 + parseInt(session.id);
                    
                    // Generate the URLs for each API endpoint (using HTTPS for n8n compatibility)
                    const useHttps = true; // Set to true for n8n compatibility
                    const protocol = useHttps ? 'https' : 'http';
                    const sendTextUrl = `${protocol}://${window.location.hostname}:${port}/api/send-text`;
                    const seenUrl = `${protocol}://${window.location.hostname}:${port}/api/seen`;
                    const typingUrl = `${protocol}://${window.location.hostname}:${port}/api/typing`;
                    const webhookUrl = `${protocol}://${window.location.hostname}:${port}/api/waha-webhook`;
                    
                    // Add table row with copy buttons
                    tableContent += `
                        <tr>
                            <td>${session.name} (ID: ${session.id})</td>
                            <td>
                                <div class="input-group">
                                    <input type="text" class="form-control form-control-sm" value="${sendTextUrl}" readonly>
                                    <button class="btn btn-sm btn-outline-primary copy-btn" data-url="${sendTextUrl}">
                                        <i class="fas fa-copy"></i>
                                    </button>
                                </div>
                            </td>
                            <td>
                                <div class="input-group">
                                    <input type="text" class="form-control form-control-sm" value="${seenUrl}" readonly>
                                    <button class="btn btn-sm btn-outline-primary copy-btn" data-url="${seenUrl}">
                                        <i class="fas fa-copy"></i>
                                    </button>
                                </div>
                            </td>
                            <td>
                                <div class="input-group">
                                    <input type="text" class="form-control form-control-sm" value="${typingUrl}" readonly>
                                    <button class="btn btn-sm btn-outline-primary copy-btn" data-url="${typingUrl}">
                                        <i class="fas fa-copy"></i>
                                    </button>
                                </div>
                            </td>
                            <td>
                                <div class="input-group">
                                    <input type="text" class="form-control form-control-sm" value="${webhookUrl}" readonly>
                                    <button class="btn btn-sm btn-outline-primary copy-btn" data-url="${webhookUrl}">
                                        <i class="fas fa-copy"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `;
                });
                
                apiEndpointsTableBody.innerHTML = tableContent;
                
                // Add event listeners to copy buttons
                document.querySelectorAll('.copy-btn').forEach(btn => {
                    btn.addEventListener('click', function() {
                        const url = this.dataset.url;
                        navigator.clipboard.writeText(url)
                            .then(() => {
                                // Change button style temporarily to indicate success
                                const originalHTML = this.innerHTML;
                                this.innerHTML = '<i class="fas fa-check"></i>';
                                this.classList.remove('btn-outline-primary');
                                this.classList.add('btn-success');
                                
                                setTimeout(() => {
                                    this.innerHTML = originalHTML;
                                    this.classList.remove('btn-success');
                                    this.classList.add('btn-outline-primary');
                                }, 1500);
                                
                                showToast('URL copiada para a área de transferência');
                            })
                            .catch(err => {
                                console.error('Error copying URL:', err);
                                showToast('Falha ao copiar URL', 'danger');
                            });
                    });
                });
            })
            .catch(error => {
                console.error('Error loading sessions for API endpoints:', error);
                apiEndpointsTableBody.innerHTML = `
                    <tr>
                        <td colspan="5" class="text-center text-danger">
                            Erro ao carregar endpoints de API: ${error.message || 'Erro desconhecido'}
                        </td>
                    </tr>
                `;
            });
    }
    // Elements
    const sessionsTableBody = document.getElementById('sessions-table-body');
    const createSessionBtn = document.getElementById('create-session-btn');
    const createSessionForm = document.getElementById('create-session-form');
    const sessionNameInput = document.getElementById('session-name');
    const sessionDescriptionInput = document.getElementById('session-description');
    const qrCodeModal = new bootstrap.Modal(document.getElementById('qrCodeModal'));
    const qrCodeContainer = document.getElementById('qr-code-container');
    const editSessionModal = new bootstrap.Modal(document.getElementById('editSessionModal'));
    const editSessionForm = document.getElementById('edit-session-form');
    const editSessionIdInput = document.getElementById('edit-session-id');
    const editSessionNameInput = document.getElementById('edit-session-name');
    const editSessionDescriptionInput = document.getElementById('edit-session-description');
    const updateSessionBtn = document.getElementById('update-session-btn');
    const deleteSessionModal = new bootstrap.Modal(document.getElementById('deleteSessionModal'));
    const deleteSessionNameSpan = document.getElementById('delete-session-name');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    
    let selectedSessionId = null;
    let qrCheckInterval = null;
    
    // Load all sessions when page loads
    loadSessions();
    
    // Load API endpoints
    loadApiEndpoints();
    
    // Set up polling for status updates
    setInterval(loadSessions, 10000);
    
    // Create session event
    createSessionBtn.addEventListener('click', createSession);
    
    // Update session event
    updateSessionBtn.addEventListener('click', updateSession);
    
    // Confirm delete event
    confirmDeleteBtn.addEventListener('click', deleteSession);
    
    // Function to load all sessions
    function loadSessions() {
        apiCall('/api/sessions')
            .then(sessions => {
                renderSessionsTable(sessions);
            })
            .catch(error => {
                console.error('Error loading sessions:', error);
                sessionsTableBody.innerHTML = `
                    <tr>
                        <td colspan="6" class="text-center text-danger">
                            Error loading sessions: ${error.message || 'Unknown error'}
                        </td>
                    </tr>
                `;
            });
    }
    
    // Function to render sessions table
    function renderSessionsTable(sessions) {
        if (sessions.length === 0) {
            sessionsTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center">
                        Nenhuma sessão encontrada. Crie sua primeira sessão do WhatsApp para começar.
                    </td>
                </tr>
            `;
            return;
        }
        
        let tableContent = '';
        sessions.forEach(session => {
            tableContent += `
                <tr>
                    <td>${session.id}</td>
                    <td>${session.name}</td>
                    <td>${truncateText(session.description || 'N/A', 30)}</td>
                    <td>
                        <div class="d-flex align-items-center">
                            <span class="status-indicator ${session.status} me-2"></span>
                            ${getStatusBadge(session.status)}
                        </div>
                    </td>
                    <td>${formatDate(session.created_at)}</td>
                    <td class="action-buttons">
                        <div class="d-flex flex-wrap gap-1">
                            ${session.status === 'qr_code_ready' ? 
                                `<button class="btn btn-sm btn-info show-qr-btn" data-session-id="${session.id}" data-bs-toggle="tooltip" title="Ver QR Code">
                                    <i class="fas fa-qrcode"></i><span class="d-none d-md-inline"> QR Code</span>
                                </button>` : ''}
                            ${session.status === 'disconnected' ? 
                                `<button class="btn btn-sm btn-success restart-session-btn" data-session-id="${session.id}" data-bs-toggle="tooltip" title="Iniciar sessão">
                                    <i class="fas fa-play"></i><span class="d-none d-md-inline"> Iniciar</span>
                                </button>` : ''}
                            ${session.status === 'connected' ? 
                                `<button class="btn btn-sm btn-warning restart-session-btn" data-session-id="${session.id}" data-bs-toggle="tooltip" title="Reiniciar sessão">
                                    <i class="fas fa-sync"></i><span class="d-none d-md-inline"> Reiniciar</span>
                                </button>` : ''}
                            <button class="btn btn-sm btn-primary edit-session-btn" data-session-id="${session.id}" 
                                data-session-name="${session.name}" 
                                data-session-description="${session.description || ''}"
                                data-bs-toggle="tooltip" title="Editar sessão">
                                <i class="fas fa-edit"></i><span class="d-none d-md-inline"> Editar</span>
                            </button>
                            <button class="btn btn-sm btn-danger delete-session-btn" data-session-id="${session.id}" 
                                data-session-name="${session.name}"
                                data-bs-toggle="tooltip" title="Excluir sessão">
                                <i class="fas fa-trash"></i><span class="d-none d-md-inline"> Excluir</span>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
        
        sessionsTableBody.innerHTML = tableContent;
        
        // Add event listeners to buttons
        document.querySelectorAll('.show-qr-btn').forEach(btn => {
            btn.addEventListener('click', showQRCode);
        });
        
        document.querySelectorAll('.restart-session-btn').forEach(btn => {
            btn.addEventListener('click', restartSession);
        });
        
        document.querySelectorAll('.edit-session-btn').forEach(btn => {
            btn.addEventListener('click', openEditSessionModal);
        });
        
        document.querySelectorAll('.delete-session-btn').forEach(btn => {
            btn.addEventListener('click', openDeleteSessionModal);
        });
        
        // Inicializar tooltips após renderizar a tabela
        initTooltips();
    }
    
    // Function to create a new session
    function createSession() {
        const name = sessionNameInput.value.trim();
        const description = sessionDescriptionInput.value.trim();
        
        if (!name) {
            showToast('Nome da sessão é obrigatório', 'danger');
            return;
        }
        
        const sessionData = {
            name,
            description
        };
        
        apiCall('/api/sessions', 'POST', sessionData)
            .then(response => {
                showToast('Sessão criada com sucesso');
                
                // Check for QR code
                selectedSessionId = response.id;
                checkForQRCode();
                
                // Close modal and reset form
                const modal = bootstrap.Modal.getInstance(document.getElementById('createSessionModal'));
                modal.hide();
                createSessionForm.reset();
                
                // Reload sessions
                loadSessions();
            })
            .catch(error => {
                console.error('Error creating session:', error);
                showToast(`Erro ao criar sessão: ${error.message}`, 'danger');
            });
    }
    
    // Function to update a session
    function updateSession() {
        const sessionId = editSessionIdInput.value;
        const name = editSessionNameInput.value.trim();
        const description = editSessionDescriptionInput.value.trim();
        
        if (!name) {
            showToast('Nome da sessão é obrigatório', 'danger');
            return;
        }
        
        const sessionData = {
            name,
            description
        };
        
        apiCall(`/api/sessions/${sessionId}`, 'PUT', sessionData)
            .then(response => {
                showToast('Sessão atualizada com sucesso');
                
                // Close modal
                editSessionModal.hide();
                
                // Reload sessions
                loadSessions();
            })
            .catch(error => {
                console.error('Error updating session:', error);
                showToast(`Erro ao atualizar sessão: ${error.message}`, 'danger');
            });
    }
    
    // Function to delete a session
    function deleteSession() {
        if (!selectedSessionId) return;
        
        apiCall(`/api/sessions/${selectedSessionId}`, 'DELETE')
            .then(response => {
                showToast('Sessão excluída com sucesso');
                
                // Close modal
                deleteSessionModal.hide();
                
                // Reload sessions
                loadSessions();
            })
            .catch(error => {
                console.error('Error deleting session:', error);
                showToast(`Erro ao excluir sessão: ${error.message}`, 'danger');
            });
    }
    
    // Function to restart a session
    function restartSession(event) {
        const sessionId = event.currentTarget.dataset.sessionId;
        
        apiCall(`/api/sessions/${sessionId}/restart`, 'POST')
            .then(response => {
                showToast('Sessão reiniciada com sucesso');
                loadSessions();
                
                // Check for QR code
                selectedSessionId = sessionId;
                checkForQRCode();
            })
            .catch(error => {
                console.error('Error restarting session:', error);
                showToast(`Erro ao reiniciar sessão: ${error.message}`, 'danger');
            });
    }
    
    // Function to show QR code modal
    function showQRCode(event) {
        const sessionId = event.currentTarget.dataset.sessionId;
        selectedSessionId = sessionId;
        
        qrCodeContainer.innerHTML = `
            <div class="spinner-border" role="status">
                <span class="visually-hidden">Carregando...</span>
            </div>
            <p>Carregando QR code...</p>
        `;
        
        qrCodeModal.show();
        
        apiCall(`/api/sessions/${sessionId}`)
            .then(session => {
                if (session.qr_code) {
                    displayQRCode(session.qr_code);
                } else {
                    qrCodeContainer.innerHTML = `
                        <div class="alert alert-warning">
                            Nenhum QR code disponível para esta sessão.
                        </div>
                    `;
                }
            })
            .catch(error => {
                console.error('Error fetching QR code:', error);
                qrCodeContainer.innerHTML = `
                    <div class="alert alert-danger">
                        Erro ao carregar QR code: ${error.message || 'Erro desconhecido'}
                    </div>
                `;
            });
    }
    
    // Function to display QR code
    function displayQRCode(qrCodeData) {
        qrCodeContainer.innerHTML = `
            <img src="${qrCodeData}" alt="WhatsApp QR Code" class="img-fluid">
            <p class="mt-2">Escaneie com seu aplicativo WhatsApp no celular</p>
        `;
    }
    
    // Function to open edit session modal
    function openEditSessionModal(event) {
        const btn = event.currentTarget;
        const sessionId = btn.dataset.sessionId;
        const sessionName = btn.dataset.sessionName;
        const sessionDescription = btn.dataset.sessionDescription;
        
        editSessionIdInput.value = sessionId;
        editSessionNameInput.value = sessionName;
        editSessionDescriptionInput.value = sessionDescription;
        
        editSessionModal.show();
    }
    
    // Function to open delete session modal
    function openDeleteSessionModal(event) {
        const btn = event.currentTarget;
        const sessionId = btn.dataset.sessionId;
        const sessionName = btn.dataset.sessionName;
        
        selectedSessionId = sessionId;
        deleteSessionNameSpan.textContent = sessionName;
        
        deleteSessionModal.show();
    }
    
    // Variáveis para o progress bar do QR code
    let qrExpiryInterval;
    let qrExpiryTime = 60; // em segundos
    
    // Function to check for QR code
    function checkForQRCode() {
        if (qrCheckInterval) {
            clearInterval(qrCheckInterval);
        }
        
        // Check immediately
        checkSessionStatus();
        
        // Then check every 2 seconds
        qrCheckInterval = setInterval(() => {
            checkSessionStatus();
        }, 2000);
        
        // Stop checking after 2 minutes
        setTimeout(() => {
            if (qrCheckInterval) {
                clearInterval(qrCheckInterval);
                qrCheckInterval = null;
            }
        }, 120000);
    }
    
    // Function to reset QR code expiry progress bar
    function resetQRExpiryProgress() {
        // Limpar intervalo anterior, se existir
        if (qrExpiryInterval) {
            clearInterval(qrExpiryInterval);
        }
        
        // Resetar tempo de expiração
        qrExpiryTime = 60;
        const progressBar = document.getElementById('qr-expiry-progress');
        if (progressBar) {
            progressBar.style.width = '100%';
        }
        
        // Iniciar contagem regressiva
        qrExpiryInterval = setInterval(() => {
            qrExpiryTime--;
            const percentage = (qrExpiryTime / 60) * 100;
            
            if (progressBar) {
                progressBar.style.width = `${percentage}%`;
                
                // Mudar cor conforme aproxima do fim
                if (percentage > 60) {
                    progressBar.className = 'progress-bar bg-info';
                } else if (percentage > 30) {
                    progressBar.className = 'progress-bar bg-warning';
                } else {
                    progressBar.className = 'progress-bar bg-danger';
                }
            }
            
            // Quando expirar
            if (qrExpiryTime <= 0) {
                clearInterval(qrExpiryInterval);
                document.getElementById('connection-status-text').textContent = 'Código QR expirado. Atualizando...';
                
                // Tentar obter um novo QR code
                checkSessionStatus();
            }
        }, 1000);
    }
    
    // Function to update connection status in modal
    function updateConnectionStatus(status) {
        const statusText = document.getElementById('connection-status-text');
        const statusAlert = document.getElementById('qr-connection-status');
        
        if (!statusText || !statusAlert) return;
        
        switch(status) {
            case 'qr_code_ready':
                statusText.textContent = 'Aguardando escaneamento do código QR...';
                statusAlert.className = 'alert alert-info mb-3';
                break;
            case 'connecting':
                statusText.textContent = 'Conectando ao WhatsApp...';
                statusAlert.className = 'alert alert-warning mb-3';
                break;
            case 'authenticated':
                statusText.textContent = 'Autenticado! Inicializando sessão...';
                statusAlert.className = 'alert alert-success mb-3';
                break;
            case 'connected':
                statusText.textContent = 'Conectado com sucesso!';
                statusAlert.className = 'alert alert-success mb-3';
                break;
            case 'disconnected':
                statusText.textContent = 'Desconectado. Tentando reconectar...';
                statusAlert.className = 'alert alert-danger mb-3';
                break;
            default:
                statusText.textContent = 'Aguardando conexão...';
                statusAlert.className = 'alert alert-secondary mb-3';
        }
    }
    
    // Function to check session status for QR code
    function checkSessionStatus() {
        if (!selectedSessionId) return;
        
        apiCall(`/api/sessions/${selectedSessionId}`)
            .then(session => {
                // If session is in QR code ready state, show the QR code modal
                if (session.status === 'qr_code_ready' && session.qr_code) {
                    qrCodeContainer.innerHTML = `
                        <img src="${session.qr_code}" alt="WhatsApp QR Code" class="img-fluid">
                        <p class="mt-2">Escaneie com seu aplicativo WhatsApp no celular</p>
                    `;
                    updateConnectionStatus('qr_code_ready');
                    resetQRExpiryProgress();
                    qrCodeModal.show();
                }
                
                // Update connection status based on session status
                if (session.status === 'connecting') {
                    updateConnectionStatus('connecting');
                }
                
                if (session.status === 'authenticated') {
                    updateConnectionStatus('authenticated');
                    // Manter o modal aberto, mas mostrar que estamos progredindo
                }
                
                // If session is connected, stop checking and show success message
                if (session.status === 'connected') {
                    updateConnectionStatus('connected');
                    
                    if (qrCheckInterval) {
                        clearInterval(qrCheckInterval);
                        qrCheckInterval = null;
                    }
                    
                    if (qrExpiryInterval) {
                        clearInterval(qrExpiryInterval);
                        qrExpiryInterval = null;
                    }
                    
                    // Manter o modal aberto por 2 segundos para mostrar mensagem de sucesso
                    setTimeout(() => {
                        qrCodeModal.hide();
                        showToast('Sessão do WhatsApp conectada com sucesso', 'success');
                        loadSessions();
                    }, 2000);
                }
                
                // If session is disconnected
                if (session.status === 'disconnected') {
                    updateConnectionStatus('disconnected');
                }
            })
            .catch(error => {
                console.error('Error checking session status:', error);
                // Não esconder o modal em caso de erro, apenas mostrar o status
                document.getElementById('connection-status-text').textContent = 
                    `Erro ao verificar status: ${error.message || 'Erro desconhecido'}`;
                document.getElementById('qr-connection-status').className = 'alert alert-danger mb-3';
            });
    }
});
