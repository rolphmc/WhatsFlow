/**
 * Webhooks Management JavaScript
 * Handles CRUD operations for n8n webhooks
 */

document.addEventListener('DOMContentLoaded', function() {
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
    
    let selectedWebhookId = null;
    
    // Load all webhooks and sessions when page loads
    loadWebhooks();
    loadSessions();
    
    // API endpoints have been moved to sessions page
    
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
        const headersInput = document.getElementById('webhook-headers').value.trim();
        
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
        
        // Validate and parse headers JSON if provided
        let headers = {};
        if (headersInput) {
            try {
                headers = JSON.parse(headersInput);
            } catch (error) {
                showToast('Invalid JSON format for headers', 'danger');
                return;
            }
        }
        
        const webhookData = {
            name,
            session_id: parseInt(sessionId),
            url,
            events,
            headers,
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
        const headersInput = document.getElementById('edit-webhook-headers').value.trim();
        
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
        
        // Validate and parse headers JSON if provided
        let headers = {};
        if (headersInput) {
            try {
                headers = JSON.parse(headersInput);
            } catch (error) {
                showToast('Invalid JSON format for headers', 'danger');
                return;
            }
        }
        
        const webhookData = {
            name,
            session_id: parseInt(sessionId),
            url,
            events,
            headers,
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
                
                // Set the headers
                if (webhook.headers && Object.keys(webhook.headers).length > 0) {
                    document.getElementById('edit-webhook-headers').value = JSON.stringify(webhook.headers, null, 2);
                } else {
                    document.getElementById('edit-webhook-headers').value = '';
                }
                
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
    
    // Function to load API endpoints for all active sessions
    function loadApiEndpoints() {
        const apiEndpointsTableBody = document.getElementById('api-endpoints-table-body');
        
        apiCall('/api/sessions')
            .then(sessions => {
                if (sessions.length === 0) {
                    apiEndpointsTableBody.innerHTML = `
                        <tr>
                            <td colspan="5" class="text-center">
                                No active sessions found. Create a session first to view available API endpoints.
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
                                
                                showToast('URL copied to clipboard');
                            })
                            .catch(err => {
                                console.error('Error copying URL:', err);
                                showToast('Failed to copy URL', 'danger');
                            });
                    });
                });
            })
            .catch(error => {
                console.error('Error loading sessions for API endpoints:', error);
                apiEndpointsTableBody.innerHTML = `
                    <tr>
                        <td colspan="5" class="text-center text-danger">
                            Error loading API endpoints: ${error.message || 'Unknown error'}
                        </td>
                    </tr>
                `;
            });
    }
});
