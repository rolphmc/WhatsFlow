/**
 * Webhooks Management JavaScript
 * Handles CRUD operations for n8n webhooks
 */

document.addEventListener('DOMContentLoaded', function() {
    // Inicializar tooltips do Bootstrap
    var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
    var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl)
    })
    // Elements
    const webhooksTableBody = document.getElementById('webhooks-table-body');
    const webhookSessionSelect = document.getElementById('webhook-session');
    const editWebhookSessionSelect = document.getElementById('edit-webhook-session');
    const createWebhookBtn = document.getElementById('create-webhook-btn');
    const createWebhookForm = document.getElementById('create-webhook-form');
    const updateWebhookBtn = document.getElementById('update-webhook-btn');
    const editWebhookForm = document.getElementById('edit-webhook-form');
    const editWebhookIdInput = document.getElementById('edit-webhook-id');
    const confirmDeleteWebhookBtn = document.getElementById('confirm-delete-webhook-btn');
    const deleteWebhookNameSpan = document.getElementById('delete-webhook-name');
    const apiEndpointsContainer = document.getElementById('api-endpoints-container');
    const createApiEndpointsContainer = document.getElementById('create-api-endpoints-container');
    
    let selectedWebhookId = null;
    
    // Load all webhooks and sessions when page loads
    loadWebhooks();
    loadSessions();
    
    // Event listener to update API endpoints when session is selected
    webhookSessionSelect.addEventListener('change', function() {
        const sessionId = this.value;
        displayApiEndpoints(sessionId, 'create-api-endpoints-container');
    });
    
    // Event listener to update API endpoints when session is selected in edit mode
    editWebhookSessionSelect.addEventListener('change', function() {
        const sessionId = this.value;
        displayApiEndpoints(sessionId, 'api-endpoints-container');
    });
    
    // API endpoints display functions
    function displayApiEndpoints(sessionId, containerId) {
        if (!sessionId) {
            document.getElementById(containerId).innerHTML = `
                <div class="alert alert-warning">
                    Selecione uma sessão do WhatsApp para visualizar os endpoints de API disponíveis.
                </div>
            `;
            return;
        }
        
        apiCall(`/api/sessions/${sessionId}`)
            .then(session => {
                const hostname = window.location.hostname;
                const protocol = window.location.protocol;
                const baseUrl = `${protocol}//${hostname}`;
                
                let html = `
                    <div class="table-responsive">
                        <table class="table table-sm table-bordered">
                            <thead>
                                <tr>
                                    <th style="width: 30%">Função</th>
                                    <th>URL do Endpoint</th>
                                </tr>
                            </thead>
                            <tbody>
                                <!-- Endpoints básicos -->
                                <tr class="table-primary">
                                    <td colspan="2"><strong>Ações básicas</strong></td>
                                </tr>
                                <tr>
                                    <td>Enviar texto</td>
                                    <td><code>${baseUrl}/api/sessions/${sessionId}/send-text</code></td>
                                </tr>
                                <tr>
                                    <td>Marcar como visto</td>
                                    <td><code>${baseUrl}/api/sessions/${sessionId}/seen</code></td>
                                </tr>
                                <tr>
                                    <td>Iniciar digitação</td>
                                    <td><code>${baseUrl}/api/sessions/${sessionId}/typing</code></td>
                                </tr>
                                <tr>
                                    <td>Endpoint para receber webhooks</td>
                                    <td><code>${baseUrl}/api/sessions/${sessionId}/webhook</code></td>
                                </tr>
                                
                                <!-- Gerenciamento de mensagens -->
                                <tr class="table-primary">
                                    <td colspan="2"><strong>Gerenciamento de mensagens</strong></td>
                                </tr>
                                <tr>
                                    <td>Buscar mensagens do chat</td>
                                    <td><code>${baseUrl}/api/sessions/${sessionId}/messages</code></td>
                                </tr>
                                <tr>
                                    <td>Apagar mensagem</td>
                                    <td><code>${baseUrl}/api/sessions/${sessionId}/delete-message</code></td>
                                </tr>
                                <tr>
                                    <td>Reagir a mensagem</td>
                                    <td><code>${baseUrl}/api/sessions/${sessionId}/react</code></td>
                                </tr>
                                
                                <!-- Mídia e mensagens avançadas -->
                                <tr class="table-primary">
                                    <td colspan="2"><strong>Mídia e mensagens avançadas</strong></td>
                                </tr>
                                <tr>
                                    <td>Enviar imagem</td>
                                    <td><code>${baseUrl}/api/sessions/${sessionId}/send-image</code></td>
                                </tr>
                                <tr>
                                    <td>Enviar arquivo</td>
                                    <td><code>${baseUrl}/api/sessions/${sessionId}/send-file</code></td>
                                </tr>
                                <tr>
                                    <td>Enviar áudio</td>
                                    <td><code>${baseUrl}/api/sessions/${sessionId}/send-voice</code></td>
                                </tr>
                                <tr>
                                    <td>Enviar localização</td>
                                    <td><code>${baseUrl}/api/sessions/${sessionId}/send-location</code></td>
                                </tr>
                                <tr>
                                    <td>Criar enquete</td>
                                    <td><code>${baseUrl}/api/sessions/${sessionId}/create-poll</code></td>
                                </tr>
                                
                                <!-- Gerenciamento de grupos -->
                                <tr class="table-primary">
                                    <td colspan="2"><strong>Gerenciamento de grupos</strong></td>
                                </tr>
                                <tr>
                                    <td>Criar grupo</td>
                                    <td><code>${baseUrl}/api/sessions/${sessionId}/create-group</code></td>
                                </tr>
                                <tr>
                                    <td>Adicionar participante</td>
                                    <td><code>${baseUrl}/api/sessions/${sessionId}/add-participant</code></td>
                                </tr>
                                <tr>
                                    <td>Remover participante</td>
                                    <td><code>${baseUrl}/api/sessions/${sessionId}/remove-participant</code></td>
                                </tr>
                                <tr>
                                    <td>Promover a admin</td>
                                    <td><code>${baseUrl}/api/sessions/${sessionId}/promote-participant</code></td>
                                </tr>
                                <tr>
                                    <td>Remover de admin</td>
                                    <td><code>${baseUrl}/api/sessions/${sessionId}/demote-participant</code></td>
                                </tr>
                                <tr>
                                    <td>Alterar descrição do grupo</td>
                                    <td><code>${baseUrl}/api/sessions/${sessionId}/set-group-description</code></td>
                                </tr>
                                <tr>
                                    <td>Alterar assunto do grupo</td>
                                    <td><code>${baseUrl}/api/sessions/${sessionId}/set-group-subject</code></td>
                                </tr>
                                <tr>
                                    <td>Listar dados do grupo</td>
                                    <td><code>${baseUrl}/api/sessions/${sessionId}/get-group-info</code></td>
                                </tr>
                                
                                <!-- Contatos e Chats -->
                                <tr class="table-primary">
                                    <td colspan="2"><strong>Contatos e Chats</strong></td>
                                </tr>
                                <tr>
                                    <td>Listar contatos</td>
                                    <td><code>${baseUrl}/api/sessions/${sessionId}/contacts</code></td>
                                </tr>
                                <tr>
                                    <td>Listar chats</td>
                                    <td><code>${baseUrl}/api/sessions/${sessionId}/chats</code></td>
                                </tr>
                                <tr>
                                    <td>Obter foto de perfil</td>
                                    <td><code>${baseUrl}/api/sessions/${sessionId}/profile-pic</code></td>
                                </tr>
                                <tr>
                                    <td>Verificar número na WA</td>
                                    <td><code>${baseUrl}/api/sessions/${sessionId}/check-number</code></td>
                                </tr>
                                <tr>
                                    <td>Bloquear contato</td>
                                    <td><code>${baseUrl}/api/sessions/${sessionId}/block-contact</code></td>
                                </tr>
                                <tr>
                                    <td>Desbloquear contato</td>
                                    <td><code>${baseUrl}/api/sessions/${sessionId}/unblock-contact</code></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                `;
                
                document.getElementById(containerId).innerHTML = html;
            })
            .catch(error => {
                document.getElementById(containerId).innerHTML = `
                    <div class="alert alert-danger">
                        Erro ao carregar endpoints de API: ${error.message || 'Erro desconhecido'}
                    </div>
                `;
            });
    }
    
    // Create webhook event
    createWebhookBtn.addEventListener('click', createWebhook);
    
    // Update webhook event
    updateWebhookBtn.addEventListener('click', updateWebhook);
    
    // Confirm delete event
    confirmDeleteWebhookBtn.addEventListener('click', deleteWebhook);
    
    // Function to load all webhooks
    function loadWebhooks() {
        apiCall('/api/webhooks')
            .then(webhooks => {
                renderWebhooksTable(webhooks);
            })
            .catch(error => {
                console.error('Error loading webhooks:', error);
                webhooksTableBody.innerHTML = `
                    <tr>
                        <td colspan="7" class="text-center text-danger">
                            Error loading webhooks: ${error.message || 'Unknown error'}
                        </td>
                    </tr>
                `;
            });
    }
    
    // Function to load all sessions for select dropdowns
    function loadSessions() {
        apiCall('/api/sessions')
            .then(sessions => {
                populateSessionDropdowns(sessions);
            })
            .catch(error => {
                console.error('Error loading sessions:', error);
                showToast(`Error loading sessions: ${error.message}`, 'danger');
            });
    }
    
    // Function to populate session dropdown selects
    function populateSessionDropdowns(sessions) {
        const options = sessions.map(session => 
            `<option value="${session.id}">${session.name} (${session.status})</option>`
        ).join('');
        
        webhookSessionSelect.innerHTML = '<option value="">Select a session</option>' + options;
        editWebhookSessionSelect.innerHTML = '<option value="">Select a session</option>' + options;
    }
    
    // Function to render webhooks table
    function renderWebhooksTable(webhooks) {
        if (webhooks.length === 0) {
            webhooksTableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center">
                        No webhooks found. Create your first webhook to start receiving WhatsApp events.
                    </td>
                </tr>
            `;
            return;
        }
        
        // Fetch sessions to get names
        apiCall('/api/sessions')
            .then(sessions => {
                const sessionMap = {};
                sessions.forEach(session => {
                    sessionMap[session.id] = session.name;
                });
                
                let tableContent = '';
                webhooks.forEach(webhook => {
                    const sessionName = sessionMap[webhook.session_id] || `Session ${webhook.session_id}`;
                    const eventBadges = webhook.events.map(event => 
                        `<span class="badge bg-secondary event-badge">${event}</span>`
                    ).join(' ');
                    
                    tableContent += `
                        <tr>
                            <td>${webhook.id}</td>
                            <td>${webhook.name}</td>
                            <td>${sessionName}</td>
                            <td>${truncateText(webhook.url, 30)}</td>
                            <td>${eventBadges}</td>
                            <td>
                                <div class="form-check form-switch">
                                    <input class="form-check-input webhook-active-toggle" type="checkbox" 
                                        ${webhook.is_active ? 'checked' : ''} 
                                        data-webhook-id="${webhook.id}">
                                </div>
                            </td>
                            <td class="action-buttons">
                                <button class="btn btn-sm btn-primary edit-webhook-btn" data-webhook-id="${webhook.id}">
                                    <i class="fas fa-edit"></i> Edit
                                </button>
                                <button class="btn btn-sm btn-danger delete-webhook-btn" data-webhook-id="${webhook.id}" data-webhook-name="${webhook.name}">
                                    <i class="fas fa-trash"></i> Delete
                                </button>
                            </td>
                        </tr>
                    `;
                });
                
                webhooksTableBody.innerHTML = tableContent;
                
                // Add event listeners to buttons
                document.querySelectorAll('.edit-webhook-btn').forEach(btn => {
                    btn.addEventListener('click', openEditWebhookModal);
                });
                
                document.querySelectorAll('.delete-webhook-btn').forEach(btn => {
                    btn.addEventListener('click', openDeleteWebhookModal);
                });
                
                document.querySelectorAll('.webhook-active-toggle').forEach(toggle => {
                    toggle.addEventListener('change', toggleWebhookActive);
                });
            })
            .catch(error => {
                console.error('Error fetching sessions for webhook table:', error);
                webhooksTableBody.innerHTML = `
                    <tr>
                        <td colspan="7" class="text-center text-danger">
                            Error loading webhook data: ${error.message || 'Unknown error'}
                        </td>
                    </tr>
                `;
            });
    }
    
    // Function to create a new webhook
    function createWebhook() {
        const name = document.getElementById('webhook-name').value.trim();
        const sessionId = webhookSessionSelect.value;
        const url = document.getElementById('webhook-url').value.trim();
        const isActive = document.getElementById('webhook-active').checked;
        
        // Collect selected events
        const events = [];
        document.querySelectorAll('input[id^="event-"]:checked').forEach(checkbox => {
            events.push(checkbox.value);
        });
        
        // Validate required fields
        if (!name || !sessionId || !url) {
            showToast('Name, Session, and URL are required', 'danger');
            return;
        }
        
        const webhookData = {
            name,
            session_id: parseInt(sessionId),
            url,
            events,
            headers: {}, // Usando objeto vazio para headers
            is_active: isActive
        };
        
        apiCall('/api/webhooks', 'POST', webhookData)
            .then(response => {
                showToast('Webhook created successfully');
                
                // Close modal and reset form
                const modal = bootstrap.Modal.getInstance(document.getElementById('createWebhookModal'));
                modal.hide();
                createWebhookForm.reset();
                
                // Reload webhooks
                loadWebhooks();
            })
            .catch(error => {
                console.error('Error creating webhook:', error);
                showToast(`Error creating webhook: ${error.message}`, 'danger');
            });
    }
    
    // Function to update a webhook
    function updateWebhook() {
        const webhookId = editWebhookIdInput.value;
        const name = document.getElementById('edit-webhook-name').value.trim();
        const sessionId = editWebhookSessionSelect.value;
        const url = document.getElementById('edit-webhook-url').value.trim();
        const isActive = document.getElementById('edit-webhook-active').checked;
        
        // Collect selected events
        const events = [];
        document.querySelectorAll('input[id^="edit-event-"]:checked').forEach(checkbox => {
            events.push(checkbox.value);
        });
        
        // Validate required fields
        if (!name || !sessionId || !url) {
            showToast('Name, Session, and URL are required', 'danger');
            return;
        }
                
        const webhookData = {
            name,
            session_id: parseInt(sessionId),
            url,
            events,
            headers: {}, // Usando objeto vazio para headers
            is_active: isActive
        };
        
        apiCall(`/api/webhooks/${webhookId}`, 'PUT', webhookData)
            .then(response => {
                showToast('Webhook updated successfully');
                
                // Close modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('editWebhookModal'));
                modal.hide();
                
                // Reload webhooks
                loadWebhooks();
            })
            .catch(error => {
                console.error('Error updating webhook:', error);
                showToast(`Error updating webhook: ${error.message}`, 'danger');
            });
    }
    
    // Function to delete a webhook
    function deleteWebhook() {
        if (!selectedWebhookId) return;
        
        apiCall(`/api/webhooks/${selectedWebhookId}`, 'DELETE')
            .then(response => {
                showToast('Webhook deleted successfully');
                
                // Close modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('deleteWebhookModal'));
                modal.hide();
                
                // Reload webhooks
                loadWebhooks();
            })
            .catch(error => {
                console.error('Error deleting webhook:', error);
                showToast(`Error deleting webhook: ${error.message}`, 'danger');
            });
    }
    
    // Function to toggle webhook active status
    function toggleWebhookActive(event) {
        const webhookId = event.target.dataset.webhookId;
        const isActive = event.target.checked;
        
        apiCall(`/api/webhooks/${webhookId}`, 'PUT', { is_active: isActive })
            .then(response => {
                showToast(`Webhook ${isActive ? 'activated' : 'deactivated'} successfully`);
            })
            .catch(error => {
                console.error('Error updating webhook status:', error);
                showToast(`Error updating webhook status: ${error.message}`, 'danger');
                
                // Revert the toggle if there was an error
                event.target.checked = !isActive;
            });
    }
    
    // Function to open edit webhook modal
    function openEditWebhookModal(event) {
        const webhookId = event.currentTarget.dataset.webhookId;
        
        apiCall(`/api/webhooks/${webhookId}`)
            .then(webhook => {
                // Populate the form
                editWebhookIdInput.value = webhook.id;
                document.getElementById('edit-webhook-name').value = webhook.name;
                document.getElementById('edit-webhook-url').value = webhook.url;
                document.getElementById('edit-webhook-active').checked = webhook.is_active;
                
                // Set the session
                editWebhookSessionSelect.value = webhook.session_id;
                
                // Set the events
                document.querySelectorAll('input[id^="edit-event-"]').forEach(checkbox => {
                    checkbox.checked = webhook.events.includes(checkbox.value);
                });
                
                // Exibir endpoints API para a sessão selecionada
                displayApiEndpoints(webhook.session_id, 'api-endpoints-container');
                
                // Show the modal
                const modal = new bootstrap.Modal(document.getElementById('editWebhookModal'));
                modal.show();
            })
            .catch(error => {
                console.error('Error fetching webhook details:', error);
                showToast(`Error fetching webhook details: ${error.message}`, 'danger');
            });
    }
    
    // Function to open delete webhook modal
    function openDeleteWebhookModal(event) {
        const btn = event.currentTarget;
        const webhookId = btn.dataset.webhookId;
        const webhookName = btn.dataset.webhookName;
        
        selectedWebhookId = webhookId;
        deleteWebhookNameSpan.textContent = webhookName;
        
        const modal = new bootstrap.Modal(document.getElementById('deleteWebhookModal'));
        modal.show();
    }
    

});
