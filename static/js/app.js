/**
 * Main Application JavaScript
 * Handles common functionality across the WhatsApp Web Integration app
 */

document.addEventListener('DOMContentLoaded', function() {
    // Set up tooltips
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
    
    // Handle toast notifications
    window.showToast = function(message, type = 'success') {
        // Create toast container if it doesn't exist
        let toastContainer = document.querySelector('.toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
            document.body.appendChild(toastContainer);
        }
        
        // Create toast element
        const toastId = 'toast-' + Date.now();
        const toastHtml = `
            <div id="${toastId}" class="toast" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="toast-header bg-${type} text-white">
                    <strong class="me-auto">${type === 'success' ? 'Success' : 'Error'}</strong>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
                <div class="toast-body">
                    ${message}
                </div>
            </div>
        `;
        
        toastContainer.insertAdjacentHTML('beforeend', toastHtml);
        
        // Initialize and show the toast
        const toastElement = document.getElementById(toastId);
        const toast = new bootstrap.Toast(toastElement, { delay: 5000 });
        toast.show();
        
        // Remove the toast from DOM after it's hidden
        toastElement.addEventListener('hidden.bs.toast', function() {
            toastElement.remove();
        });
    };
    
    // Format date utility
    window.formatDate = function(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    };
    
    // Helper for API calls
    window.apiCall = async function(url, method = 'GET', data = null) {
        try {
            const options = {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                }
            };
            
            if (data && (method === 'POST' || method === 'PUT')) {
                options.body = JSON.stringify(data);
            }
            
            const response = await fetch(url, options);
            const responseData = await response.json();
            
            if (!response.ok) {
                throw new Error(responseData.error || 'API call failed');
            }
            
            return responseData;
        } catch (error) {
            console.error('API error:', error);
            showToast(error.message, 'danger');
            throw error;
        }
    };
    
    // Status indicator helper
    window.getStatusBadge = function(status) {
        let badgeClass = 'bg-secondary';
        let statusText = status;
        
        switch (status) {
            case 'connected':
                badgeClass = 'bg-success';
                break;
            case 'disconnected':
                badgeClass = 'bg-danger';
                break;
            case 'connecting':
                badgeClass = 'bg-warning';
                break;
            case 'qr_code_ready':
                badgeClass = 'bg-info';
                statusText = 'QR Ready';
                break;
        }
        
        return `<span class="badge ${badgeClass}">${statusText}</span>`;
    };
    
    // Parse JSON safely
    window.safeJSONParse = function(jsonString, defaultValue = {}) {
        try {
            if (!jsonString) return defaultValue;
            return JSON.parse(jsonString);
        } catch (e) {
            console.error('JSON parse error:', e);
            return defaultValue;
        }
    };
    
    // Truncate long text with ellipsis
    window.truncateText = function(text, maxLength = 50) {
        if (!text) return '';
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    };
});
