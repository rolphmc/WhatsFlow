/**
 * Sessions Management JavaScript
 * Handles CRUD operations for WhatsApp Web sessions
 */

document.addEventListener('DOMContentLoaded', function() {
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
                        No sessions found. Create your first WhatsApp session to get started.
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
                        ${session.status === 'qr_code_ready' ? 
                            `<button class="btn btn-sm btn-info show-qr-btn" data-session-id="${session.id}">
                                <i class="fas fa-qrcode"></i> QR Code
                            </button>` : ''}
                        ${session.status === 'disconnected' ? 
                            `<button class="btn btn-sm btn-success restart-session-btn" data-session-id="${session.id}">
                                <i class="fas fa-play"></i> Start
                            </button>` : ''}
                        ${session.status === 'connected' ? 
                            `<button class="btn btn-sm btn-warning restart-session-btn" data-session-id="${session.id}">
                                <i class="fas fa-sync"></i> Restart
                            </button>` : ''}
                        <button class="btn btn-sm btn-primary edit-session-btn" data-session-id="${session.id}" data-session-name="${session.name}" data-session-description="${session.description || ''}">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn btn-sm btn-danger delete-session-btn" data-session-id="${session.id}" data-session-name="${session.name}">
                            <i class="fas fa-trash"></i> Delete
                        </button>
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
    }
    
    // Function to create a new session
    function createSession() {
        const name = sessionNameInput.value.trim();
        const description = sessionDescriptionInput.value.trim();
        
        if (!name) {
            showToast('Session name is required', 'danger');
            return;
        }
        
        const sessionData = {
            name,
            description
        };
        
        apiCall('/api/sessions', 'POST', sessionData)
            .then(response => {
                showToast('Session created successfully');
                
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
                showToast(`Error creating session: ${error.message}`, 'danger');
            });
    }
    
    // Function to update a session
    function updateSession() {
        const sessionId = editSessionIdInput.value;
        const name = editSessionNameInput.value.trim();
        const description = editSessionDescriptionInput.value.trim();
        
        if (!name) {
            showToast('Session name is required', 'danger');
            return;
        }
        
        const sessionData = {
            name,
            description
        };
        
        apiCall(`/api/sessions/${sessionId}`, 'PUT', sessionData)
            .then(response => {
                showToast('Session updated successfully');
                
                // Close modal
                editSessionModal.hide();
                
                // Reload sessions
                loadSessions();
            })
            .catch(error => {
                console.error('Error updating session:', error);
                showToast(`Error updating session: ${error.message}`, 'danger');
            });
    }
    
    // Function to delete a session
    function deleteSession() {
        if (!selectedSessionId) return;
        
        apiCall(`/api/sessions/${selectedSessionId}`, 'DELETE')
            .then(response => {
                showToast('Session deleted successfully');
                
                // Close modal
                deleteSessionModal.hide();
                
                // Reload sessions
                loadSessions();
            })
            .catch(error => {
                console.error('Error deleting session:', error);
                showToast(`Error deleting session: ${error.message}`, 'danger');
            });
    }
    
    // Function to restart a session
    function restartSession(event) {
        const sessionId = event.currentTarget.dataset.sessionId;
        
        apiCall(`/api/sessions/${sessionId}/restart`, 'POST')
            .then(response => {
                showToast('Session restarted successfully');
                loadSessions();
                
                // Check for QR code
                selectedSessionId = sessionId;
                checkForQRCode();
            })
            .catch(error => {
                console.error('Error restarting session:', error);
                showToast(`Error restarting session: ${error.message}`, 'danger');
            });
    }
    
    // Function to show QR code modal
    function showQRCode(event) {
        const sessionId = event.currentTarget.dataset.sessionId;
        selectedSessionId = sessionId;
        
        qrCodeContainer.innerHTML = `
            <div class="spinner-border" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <p>Loading QR code...</p>
        `;
        
        qrCodeModal.show();
        
        apiCall(`/api/sessions/${sessionId}`)
            .then(session => {
                if (session.qr_code) {
                    displayQRCode(session.qr_code);
                } else {
                    qrCodeContainer.innerHTML = `
                        <div class="alert alert-warning">
                            No QR code available for this session.
                        </div>
                    `;
                }
            })
            .catch(error => {
                console.error('Error fetching QR code:', error);
                qrCodeContainer.innerHTML = `
                    <div class="alert alert-danger">
                        Error loading QR code: ${error.message || 'Unknown error'}
                    </div>
                `;
            });
    }
    
    // Function to display QR code
    function displayQRCode(qrCodeData) {
        qrCodeContainer.innerHTML = `
            <img src="${qrCodeData}" alt="WhatsApp QR Code" class="img-fluid">
            <p class="mt-2">Scan with your WhatsApp mobile app</p>
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
    
    // Function to check session status for QR code
    function checkSessionStatus() {
        if (!selectedSessionId) return;
        
        apiCall(`/api/sessions/${selectedSessionId}`)
            .then(session => {
                // If session is in QR code ready state, show the QR code modal
                if (session.status === 'qr_code_ready' && session.qr_code) {
                    qrCodeContainer.innerHTML = `
                        <img src="${session.qr_code}" alt="WhatsApp QR Code" class="img-fluid">
                        <p class="mt-2">Scan with your WhatsApp mobile app</p>
                    `;
                    qrCodeModal.show();
                    
                    // Stop checking once we've shown the QR code
                    if (qrCheckInterval) {
                        clearInterval(qrCheckInterval);
                        qrCheckInterval = null;
                    }
                }
                
                // If session is connected, stop checking and show success message
                if (session.status === 'connected') {
                    if (qrCheckInterval) {
                        clearInterval(qrCheckInterval);
                        qrCheckInterval = null;
                    }
                    
                    qrCodeModal.hide();
                    showToast('WhatsApp session connected successfully', 'success');
                    loadSessions();
                }
            })
            .catch(error => {
                console.error('Error checking session status:', error);
            });
    }
});
