// ---------- HARDCODED USERS (only 3) ----------
const VALID_USERS = [
    { email: 'sohail@lead.co', password: 'alpha' },
    { email: 'angad@lead.co', password: 'beta' },
    { email: 'kishan@lead.co', password: 'gamma' }
];

// ---------- STORAGE KEYS ----------
const STORAGE_KEYS = {
    SESSION: 'leadmanager_session',
    LEADS: 'leadmanager_leads'
};

// ---------- STATUS DROPDOWN OPTIONS ----------
const STATUS_OPTIONS = ['Interested', 'Not Interested', 'Follow Up', 'No Response'];

// ---------- HELPERS ----------
function getSessionUser() {
    const raw = localStorage.getItem(STORAGE_KEYS.SESSION);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
}

function setSession(user) {
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(user));
}

function clearSession() {
    localStorage.removeItem(STORAGE_KEYS.SESSION);
}

// Load leads from localStorage
function loadLeads() {
    const stored = localStorage.getItem(STORAGE_KEYS.LEADS);
    if (stored) {
        try { return JSON.parse(stored); } catch { return []; }
    } else {
        localStorage.setItem(STORAGE_KEYS.LEADS, JSON.stringify([]));
        return [];
    }
}

function saveLeads(leads) {
    localStorage.setItem(STORAGE_KEYS.LEADS, JSON.stringify(leads));
}

// Format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount || 0);
}

// Calculate total budget
function calculateTotalBudget(leads) {
    return leads.reduce((total, lead) => total + (parseInt(lead.budget) || 0), 0);
}

// ---------- ESCAPE HTML ----------
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ---------- DELETE LEAD FUNCTION ----------
window.deleteLead = function(leadId, user) {
    if (confirm('Are you sure you want to delete this lead? This cannot be undone.')) {
        const leads = loadLeads();
        const updatedLeads = leads.filter(lead => lead.id !== leadId);
        saveLeads(updatedLeads);
        
        // Refresh dashboard
        document.getElementById('dashboard-container').innerHTML = renderDashboard(user);
        attachDashboardEvents(user);
    }
};

// ---------- DASHBOARD RENDER ----------
function renderDashboard(user) {
    const leads = loadLeads();
    const userEmail = user ? user.email : '';
    const totalBudget = calculateTotalBudget(leads);
    const interestedLeads = leads.filter(l => l.status === 'Interested').length;

    const leadsRows = leads.map(lead => {
        const statusOptions = STATUS_OPTIONS.map(opt => 
            `<option value="${opt}" ${lead.status === opt ? 'selected' : ''}>${opt}</option>`
        ).join('');

        return `<tr data-lead-id="${lead.id}">
            <td>
                <div><strong>${escapeHtml(lead.name || '')}</strong></div>
                <div class="requirements-text" title="Requirements">${escapeHtml(lead.requirements || '')}</div>
            </td>
            <td>${escapeHtml(lead.business || '')}</td>
            <td>${escapeHtml(lead.phone || '')}</td>
            <td>
                <select class="status-select" data-field="status" data-id="${lead.id}">
                    ${statusOptions}
                </select>
            </td>
            <td>
                <div style="display: flex; align-items: center; gap: 4px;">
                    <span class="currency">₹</span>
                    <input type="number" class="budget-input" value="${lead.budget || ''}" 
                           data-id="${lead.id}" data-field="budget" placeholder="Amount" min="0" step="1000">
                </div>
                <div class="pages-badge">
                    <span>📄</span>
                    <input type="number" style="width: 50px; border: none; background: transparent; font-weight: 500;" 
                           value="${lead.pages || 1}" data-id="${lead.id}" data-field="pages" min="1" max="100">
                </div>
            </td>
            <td>
                <input type="text" class="note-input" value="${escapeHtml(lead.note || '')}" 
                       data-id="${lead.id}" placeholder="Note">
            </td>
            <td>
                <div class="action-cell">
                    <a href="tel:${lead.phone}" class="call-btn" data-id="${lead.id}">📞</a>
                    <button class="delete-btn" onclick="deleteLead('${lead.id}', ${JSON.stringify(user).replace(/"/g, '&quot;')})">🗑️</button>
                </div>
            </td>
        </tr>`;
    }).join('');

    const emptyRows = leads.length === 0 ? `<tr class="empty-row"><td colspan="7">No leads yet. Add your first lead above.</td></tr>` : '';

    return `
        <div class="top-bar">
            <span class="logo">📋 leadflow · internal</span>
            <div class="user-badge">
                <span class="user-email">${escapeHtml(userEmail)}</span>
                <button class="logout-btn" id="logoutBtn">Log out</button>
            </div>
        </div>
        <div class="content">
            <!-- Summary Cards -->
            <div class="summary-cards">
                <div class="summary-card leads">
                    <h3>Total Leads</h3>
                    <div class="number">${leads.length}</div>
                    <div class="label">${interestedLeads} Interested</div>
                </div>
                <div class="summary-card budget">
                    <h3>Total Budget</h3>
                    <div class="number">${formatCurrency(totalBudget)}</div>
                    <div class="label">Average: ${leads.length ? formatCurrency(totalBudget/leads.length) : '₹0'}</div>
                </div>
            </div>

            <h2>Add New Lead</h2>
            <div class="lead-form" id="addLeadForm">
                <div class="form-group">
                    <label>Client Name *</label>
                    <input type="text" id="new-name" placeholder="e.g. Sohail" autocomplete="off">
                </div>
                <div class="form-group">
                    <label>Business *</label>
                    <input type="text" id="new-business" placeholder="Company name">
                </div>
                <div class="form-group">
                    <label>Phone *</label>
                    <input type="text" id="new-phone" placeholder="9876543210">
                </div>
                <div class="form-group">
                    <label>Budget (₹)</label>
                    <input type="number" id="new-budget" placeholder="e.g. 50000" min="0" step="1000">
                </div>
                <div class="form-group">
                    <label>Pages</label>
                    <input type="number" id="new-pages" value="1" min="1" max="100">
                </div>
                <div class="form-group">
                    <label>Requirements</label>
                    <input type="text" id="new-requirements" placeholder="e.g. E-commerce, Login, Admin">
                </div>
                <div class="form-group">
                    <label>Status</label>
                    <select id="new-status">
                        ${STATUS_OPTIONS.map(s => `<option value="${s}">${s}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Note</label>
                    <input type="text" id="new-note" placeholder="Any notes">
                </div>
                <button class="btn-primary" id="addLeadBtn">+ Add Lead</button>
            </div>

            <h2>All Leads</h2>
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Client & Requirements</th>
                            <th>Business</th>
                            <th>Phone</th>
                            <th>Status</th>
                            <th>Budget & Pages</th>
                            <th>Note</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="leadsTableBody">
                        ${leadsRows}
                        ${emptyRows}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// ---------- ATTACH DASHBOARD EVENTS ----------
function attachDashboardEvents(user) {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            clearSession();
            window.location.replace('index.html');
        });
    }

    // Add new lead
    const addBtn = document.getElementById('addLeadBtn');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            const name = document.getElementById('new-name')?.value.trim();
            const business = document.getElementById('new-business')?.value.trim();
            const phone = document.getElementById('new-phone')?.value.trim();
            const budget = document.getElementById('new-budget')?.value;
            const pages = document.getElementById('new-pages')?.value || '1';
            const requirements = document.getElementById('new-requirements')?.value.trim();
            const status = document.getElementById('new-status')?.value;
            const note = document.getElementById('new-note')?.value.trim();

            if (!name || !business || !phone) {
                alert('Please fill in Name, Business, and Phone (required fields)');
                return;
            }

            const leads = loadLeads();
            const newLead = {
                id: Date.now() + '-' + Math.random().toString(36).substr(2, 8),
                name,
                business,
                phone,
                budget: budget || '',
                pages: pages || '1',
                requirements: requirements || '',
                status: status || STATUS_OPTIONS[0],
                note: note || ''
            };
            
            leads.push(newLead);
            saveLeads(leads);
            
            // Clear form
            document.getElementById('new-name').value = '';
            document.getElementById('new-business').value = '';
            document.getElementById('new-phone').value = '';
            document.getElementById('new-budget').value = '';
            document.getElementById('new-pages').value = '1';
            document.getElementById('new-requirements').value = '';
            document.getElementById('new-status').value = STATUS_OPTIONS[0];
            document.getElementById('new-note').value = '';
            
            // Refresh dashboard
            document.getElementById('dashboard-container').innerHTML = renderDashboard(user);
            attachDashboardEvents(user);
        });
    }

    // Auto-save for all inputs
    const autoSaveFields = ['status-select', 'budget-input', 'note-input'];
    
    document.querySelectorAll('.status-select, .budget-input, .note-input, input[data-field="pages"]').forEach(element => {
        let timeout;
        
        const saveHandler = (e) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                const leadId = element.dataset.id;
                const field = element.classList.contains('status-select') ? 'status' : 
                             element.classList.contains('budget-input') ? 'budget' :
                             element.dataset.field === 'pages' ? 'pages' : 'note';
                
                let value = element.type === 'number' ? element.value : element.value;
                
                const leads = loadLeads();
                const lead = leads.find(l => l.id === leadId);
                if (lead) {
                    lead[field] = value;
                    saveLeads(leads);
                    
                    // Update total budget if budget field changed
                    if (field === 'budget') {
                        const totalBudget = calculateTotalBudget(leads);
                        // Update summary card (you can enhance this)
                    }
                }
            }, 500);
        };

        element.addEventListener('input', saveHandler);
        element.addEventListener('change', saveHandler);
    });
}

// ---------- ATTACH LOGIN EVENTS ----------
function attachLoginEvents() {
    const btn = document.getElementById('login-btn');
    const emailInp = document.getElementById('login-email');
    const passInp = document.getElementById('login-password');
    const errorDiv = document.getElementById('login-error');

    if (!btn || !emailInp || !passInp) return;

    const doLogin = () => {
        const email = emailInp.value.trim();
        const pass = passInp.value.trim();
        const user = VALID_USERS.find(u => u.email === email && u.password === pass);
        if (user) {
            setSession({ email: user.email });
            window.location.replace('dashboard.html');
        } else {
            if (errorDiv) {
                errorDiv.style.display = 'block';
                errorDiv.innerText = '❌ Invalid email or password';
            }
        }
    };

    btn.addEventListener('click', doLogin);
    passInp.addEventListener('keypress', (e) => { if (e.key === 'Enter') doLogin(); });
}

// ---------- PAGE INITIALIZATION ----------
function init() {
    const path = window.location.pathname.split('/').pop() || 'index.html';
    const user = getSessionUser();

    if (path === 'dashboard.html') {
        if (!user) {
            window.location.replace('index.html');
            return;
        }
        const container = document.getElementById('dashboard-container');
        if (container) {
            container.innerHTML = renderDashboard(user);
            attachDashboardEvents(user);
        }
    } else if (path === 'index.html' || path === '') {
        if (user) {
            window.location.replace('dashboard.html');
            return;
        }
        attachLoginEvents();
    }
}

document.addEventListener('DOMContentLoaded', init);