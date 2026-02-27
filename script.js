// ---------- DEBUG: PEHLE CHECK KARO ----------
console.log('🚀 Script loaded');
console.log('Current path:', window.location.pathname);
console.log('Session user:', localStorage.getItem('leadmanager_session'));

// ---------- CONFIGURATION ----------
// SIRF EK BAAR VALID_USERS DEFINE KARO
const VALID_USERS = [
    { email: 'sohail@lead.co', password: 'alpha', name: 'Sohail', telegramId: '1935946442' },
    { email: 'angad@lead.co', password: 'beta', name: 'Angad', telegramId: '7312373408' },
    { email: 'kishan@lead.co', password: 'gamma', name: 'Kishan', telegramId: '1757459881' }
];

// Telegram Bot Configuration - AB ENABLE KARO
const TELEGRAM_BOT_TOKEN = '8591307982:AAEc2CGvK1a2hk5aO9prS1HAhw3AhjxNpTc'; // Token enable kiya

const STORAGE_KEYS = {
    SESSION: 'leadmanager_session',
    LEADS: 'leadmanager_leads',
    NOTIFICATIONS: 'leadmanager_notifications'
};

const STATUS_OPTIONS = ['Interested', 'Not Interested', 'Follow Up', 'No Response'];

// Indian cities
const INDIAN_CITIES = [
    'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Ahmedabad',
    'Chennai', 'Kolkata', 'Pune', 'Jaipur', 'Lucknow',
    'Nagpur', 'Indore', 'Bhopal', 'Visakhapatnam', 'Patna',
    'Vadodara', 'Guwahati', 'Chandigarh', 'Other'
];

// ---------- TELEGRAM NOTIFICATION SYSTEM ----------
class TelegramNotifier {
    constructor() {
        this.botToken = TELEGRAM_BOT_TOKEN;
        this.isEnabled = this.botToken && this.botToken !== null;
        console.log('📱 Telegram enabled:', this.isEnabled);
    }

    async notifyAllUsers(message, excludeUser = null) {
        if (!this.isEnabled) {
            console.log('Telegram notifications disabled');
            return;
        }

        const usersToNotify = VALID_USERS.filter(u => u.email !== excludeUser && u.telegramId);
        console.log('Sending to users:', usersToNotify.map(u => u.name));
        
        for (const user of usersToNotify) {
            if (user.telegramId) {
                await this.sendMessage(user.telegramId, message);
            }
        }
    }

    async sendMessage(chatId, message) {
        try {
            const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
            
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: message,
                    parse_mode: 'HTML',
                    disable_notification: false
                })
            });
            
            if (response.ok) {
                console.log('✅ Telegram message sent to', chatId);
            } else {
                console.log('❌ Telegram failed:', await response.text());
            }
        } catch (error) {
            console.error('Telegram error:', error);
        }
    }
}

// Initialize Telegram notifier
const telegram = new TelegramNotifier();

// ---------- NOTIFICATION SYSTEM (In-app) ----------
class NotificationSystem {
    constructor() {
        this.container = null;
        this.init();
    }

    init() {
        if (!document.body) return;
        
        this.container = document.createElement('div');
        this.container.className = 'notification-container';
        document.body.appendChild(this.container);
    }

    show(type, title, message) {
        if (!this.container) {
            this.init();
            if (!this.container) return;
        }

        const notifEl = document.createElement('div');
        notifEl.className = `notification ${type}`;
        
        const icons = {
            success: '✅',
            warning: '⚠️',
            info: 'ℹ️',
            error: '❌'
        };

        notifEl.innerHTML = `
            <div class="notification-icon">${icons[type] || '📢'}</div>
            <div class="notification-content">
                <div class="notification-title">${title}</div>
                <div class="notification-message">${message}</div>
                <div class="notification-time">${new Date().toLocaleTimeString()}</div>
            </div>
            <button class="notification-close" onclick="this.parentElement.remove()">×</button>
        `;

        this.container.appendChild(notifEl);

        setTimeout(() => {
            if (notifEl.parentElement) {
                notifEl.remove();
            }
        }, 5000);
    }
}

const notifier = new NotificationSystem();

// ---------- LEAD OPERATIONS ----------
function addLeadWithNotification(leadData, user) {
    const leads = loadLeads();
    const newLead = {
        id: Date.now() + '-' + Math.random().toString(36).substr(2, 8),
        ...leadData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        updatedBy: user.email,
        updatedByName: user.name
    };
    
    leads.push(newLead);
    saveLeads(leads);
    
    // In-app notification
    notifier.show('success', 'New Lead Added', 
        `${leadData.name} from ${leadData.city} - Budget: ₹${leadData.budget || 0}`
    );
    
    // Telegram notification
    const message = `
🟢 <b>NEW LEAD ADDED</b>
━━━━━━━━━━━━━━━
👤 <b>Client:</b> ${leadData.name}
🏙️ <b>City:</b> ${leadData.city}
🏢 <b>Business:</b> ${leadData.business}
💰 <b>Budget:</b> ₹${leadData.budget || 0}
📄 <b>Pages:</b> ${leadData.pages || 1}
👨‍💻 <b>Added by:</b> ${user.name}
🕐 <b>Time:</b> ${new Date().toLocaleString('en-IN')}
    `;
    
    telegram.notifyAllUsers(message, user.email);
    
    return newLead;
}

function updateLeadWithNotification(leadId, updates, user) {
    const leads = loadLeads();
    const leadIndex = leads.findIndex(l => l.id === leadId);
    
    if (leadIndex !== -1) {
        const oldData = { ...leads[leadIndex] };
        
        leads[leadIndex] = {
            ...oldData,
            ...updates,
            updatedAt: new Date().toISOString(),
            updatedBy: user.email,
            updatedByName: user.name
        };
        saveLeads(leads);
        
        // In-app notification
        notifier.show('info', 'Lead Updated', `${oldData.name} - Updated`);
        
        // Telegram notification
        const changes = Object.keys(updates).map(k => `${k}: ${updates[k]}`).join(', ');
        const message = `
📝 <b>LEAD UPDATED</b>
━━━━━━━━━━━━━━━
👤 <b>Client:</b> ${oldData.name}
✏️ <b>Changes:</b> ${changes}
👨‍💻 <b>Updated by:</b> ${user.name}
🕐 <b>Time:</b> ${new Date().toLocaleString('en-IN')}
        `;
        
        telegram.notifyAllUsers(message, user.email);
        
        return leads[leadIndex];
    }
    return null;
}

function deleteLeadWithNotification(leadId, leadData, user) {
    const leads = loadLeads();
    const updatedLeads = leads.filter(lead => lead.id !== leadId);
    saveLeads(updatedLeads);
    
    // In-app notification
    notifier.show('warning', 'Lead Deleted', `${leadData.name} was removed`);
    
    // Telegram notification
    const message = `
🔴 <b>LEAD DELETED</b>
━━━━━━━━━━━━━━━
👤 <b>Client:</b> ${leadData.name}
👨‍💻 <b>Deleted by:</b> ${user.name}
🕐 <b>Time:</b> ${new Date().toLocaleString('en-IN')}
    `;
    
    telegram.notifyAllUsers(message, user.email);
}

// ---------- DATE GROUPING ----------
function groupLeadsByDate(leads) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const thisWeek = new Date(today);
    thisWeek.setDate(thisWeek.getDate() - 7);
    
    const groups = {
        today: [],
        yesterday: [],
        thisWeek: [],
        older: []
    };
    
    leads.forEach(lead => {
        const leadDate = new Date(lead.createdAt || lead.updatedAt || Date.now());
        leadDate.setHours(0, 0, 0, 0);
        
        if (leadDate.getTime() === today.getTime()) {
            groups.today.push(lead);
        } else if (leadDate.getTime() === yesterday.getTime()) {
            groups.yesterday.push(lead);
        } else if (leadDate > thisWeek) {
            groups.thisWeek.push(lead);
        } else {
            groups.older.push(lead);
        }
    });
    
    return groups;
}

// ---------- RENDER DASHBOARD ----------
function renderDashboard(user, activeTab = 'today', activeCity = 'all') {
    const leads = loadLeads();
    const userEmail = user ? user.email : '';
    const userName = user ? user.name : '';
    
    // Sort by date
    const sortedLeads = [...leads].sort((a, b) => {
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
    
    const groupedLeads = groupLeadsByDate(sortedLeads);
    
    // Filter by city
    if (activeCity !== 'all') {
        Object.keys(groupedLeads).forEach(key => {
            groupedLeads[key] = groupedLeads[key].filter(l => l.city === activeCity);
        });
    }
    
    // Get unique cities
    const cities = ['all', ...new Set(leads.map(l => l.city).filter(Boolean))];
    
    // Calculate totals
    const totalBudget = leads.reduce((sum, l) => sum + (parseInt(l.budget) || 0), 0);
    const todayCount = groupedLeads.today.length;
    
    // Render leads
    let leadsHtml = '';
    const tabOrder = ['today', 'yesterday', 'thisWeek', 'older'];
    
    tabOrder.forEach(tab => {
        if (activeTab === 'all' || activeTab === tab) {
            const groupLeads = groupedLeads[tab];
            if (groupLeads.length > 0) {
                leadsHtml += `
                    <tr class="date-separator">
                        <td colspan="8">
                            <span class="date-badge ${tab === 'today' ? 'today-badge' : ''}">${tab.toUpperCase()}</span>
                            ${groupLeads.length} lead${groupLeads.length > 1 ? 's' : ''}
                        </td>
                    </tr>
                `;
                
                groupLeads.forEach(lead => {
                    leadsHtml += renderLeadRow(lead, user);
                });
            }
        }
    });
    
    if (!leadsHtml) {
        leadsHtml = `<tr class="empty-row"><td colspan="8">No leads in this section</td></tr>`;
    }

    return `
        <div class="top-bar">
            <span class="logo">📋 leadflow · live</span>
            <div class="user-badge">
                <span class="user-email">${escapeHtml(userName)} (${escapeHtml(userEmail)})</span>
                <button class="logout-btn" id="logoutBtn">Log out</button>
            </div>
        </div>
        
        <div class="content">
            <!-- Telegram Status -->
            <div style="background: #f0f9ff; padding: 0.5rem 1rem; border-radius: 30px; margin-bottom: 1rem; display: inline-block;">
                ${telegram && telegram.isEnabled ? '✅ Telegram Notifications Active' : 'ℹ️ Telegram Optional - Add token to enable'}
            </div>

            <!-- Summary Cards -->
            <div class="summary-cards">
                <div class="summary-card leads">
                    <h3>Total Leads</h3>
                    <div class="number">${leads.length}</div>
                    <div class="label">${todayCount} new today</div>
                </div>
                <div class="summary-card budget">
                    <h3>Total Budget</h3>
                    <div class="number">${formatCurrency(totalBudget)}</div>
                    <div class="label">Avg: ${leads.length ? formatCurrency(totalBudget/leads.length) : '₹0'}</div>
                </div>
            </div>

            <!-- City Filters -->
            <div class="city-filters">
                ${cities.map(city => `
                    <button class="city-filter ${activeCity === city ? 'active' : ''}" 
                            onclick="window.location.hash='city=${city}'">
                        ${city === 'all' ? '🏢 All Cities' : `📍 ${city}`}
                    </button>
                `).join('')}
            </div>

            <!-- Add Lead Form -->
            <h2>Add New Lead</h2>
            <div class="lead-form" id="addLeadForm">
                <div class="form-group">
                    <label>Client Name *</label>
                    <input type="text" id="new-name" placeholder="Sohail" autocomplete="off">
                </div>
                <div class="form-group">
                    <label>Business *</label>
                    <input type="text" id="new-business" placeholder="Tech Solutions">
                </div>
                <div class="form-group">
                    <label>Phone *</label>
                    <input type="text" id="new-phone" placeholder="9876543210">
                </div>
                <div class="form-group">
                    <label>City *</label>
                    <select id="new-city" class="city-select">
                        ${INDIAN_CITIES.map(city => `<option value="${city}">${city}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Budget (₹)</label>
                    <input type="number" id="new-budget" placeholder="50000" min="0" step="1000">
                </div>
                <div class="form-group">
                    <label>Pages</label>
                    <input type="number" id="new-pages" value="1" min="1" max="100">
                </div>
                <div class="form-group">
                    <label>Requirements</label>
                    <input type="text" id="new-requirements" placeholder="E-commerce, Payment Gateway">
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

            <!-- Tabs -->
            <div class="lead-tabs">
                <button class="tab-btn ${activeTab === 'today' ? 'active' : ''}" 
                        onclick="window.location.hash='tab=today'">
                    Today <span class="count">${groupedLeads.today.length}</span>
                </button>
                <button class="tab-btn ${activeTab === 'yesterday' ? 'active' : ''}" 
                        onclick="window.location.hash='tab=yesterday'">
                    Yesterday <span class="count">${groupedLeads.yesterday.length}</span>
                </button>
                <button class="tab-btn ${activeTab === 'thisWeek' ? 'active' : ''}" 
                        onclick="window.location.hash='tab=thisWeek'">
                    This Week <span class="count">${groupedLeads.thisWeek.length}</span>
                </button>
                <button class="tab-btn ${activeTab === 'older' ? 'active' : ''}" 
                        onclick="window.location.hash='tab=older'">
                    Older <span class="count">${groupedLeads.older.length}</span>
                </button>
                <button class="tab-btn ${activeTab === 'all' ? 'active' : ''}" 
                        onclick="window.location.hash='tab=all'">
                    All <span class="count">${leads.length}</span>
                </button>
            </div>

            <!-- Leads Table -->
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Client & City</th>
                            <th>Business</th>
                            <th>Phone</th>
                            <th>Status</th>
                            <th>Budget & Pages</th>
                            <th>Requirements</th>
                            <th>Note</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="leadsTableBody">
                        ${leadsHtml}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function renderLeadRow(lead, user) {
    const statusOptions = STATUS_OPTIONS.map(opt => 
        `<option value="${opt}" ${lead.status === opt ? 'selected' : ''}>${opt}</option>`
    ).join('');

    return `<tr data-lead-id="${lead.id}">
        <td>
            <div><strong>${escapeHtml(lead.name || '')}</strong></div>
            <div class="city-badge">
                <span>📍</span> ${escapeHtml(lead.city || 'Not specified')}
            </div>
            <div style="font-size:0.7rem; color:#94a3b8;">
                Added: ${new Date(lead.createdAt).toLocaleDateString()}
            </div>
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
            <input type="text" class="requirements-text" value="${escapeHtml(lead.requirements || '')}" 
                   data-id="${lead.id}" data-field="requirements" placeholder="Requirements">
        </td>
        <td>
            <input type="text" class="note-input" value="${escapeHtml(lead.note || '')}" 
                   data-id="${lead.id}" placeholder="Note">
        </td>
        <td>
            <div class="action-cell">
                <a href="tel:${lead.phone}" class="call-btn" data-id="${lead.id}">📞</a>
                <button class="delete-btn" onclick="deleteLeadHandler('${lead.id}')">🗑️</button>
            </div>
        </td>
    </tr>`;
}

// ---------- GLOBAL HANDLERS ----------
window.deleteLeadHandler = function(leadId) {
    const user = getSessionUser();
    if (!user) return;
    
    const leads = loadLeads();
    const lead = leads.find(l => l.id === leadId);
    
    if (lead && confirm(`Delete ${lead.name}?`)) {
        deleteLeadWithNotification(leadId, lead, user);
        refreshDashboard();
    }
};

function refreshDashboard() {
    const user = getSessionUser();
    if (!user) return;
    
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const activeTab = params.get('tab') || 'today';
    const activeCity = params.get('city') || 'all';
    
    const container = document.getElementById('dashboard-container');
    if (container) {
        container.innerHTML = renderDashboard(user, activeTab, activeCity);
        attachDashboardEvents(user);
    }
}

// ---------- ATTACH DASHBOARD EVENTS ----------
function attachDashboardEvents(user) {
    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            clearSession();
            window.location.replace('index.html');
        });
    }

    // Add lead
    const addBtn = document.getElementById('addLeadBtn');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            const name = document.getElementById('new-name')?.value.trim();
            const business = document.getElementById('new-business')?.value.trim();
            const phone = document.getElementById('new-phone')?.value.trim();
            const city = document.getElementById('new-city')?.value;
            const budget = document.getElementById('new-budget')?.value;
            const pages = document.getElementById('new-pages')?.value || '1';
            const requirements = document.getElementById('new-requirements')?.value.trim();
            const status = document.getElementById('new-status')?.value;
            const note = document.getElementById('new-note')?.value.trim();

            if (!name || !business || !phone || !city) {
                alert('Please fill all required fields');
                return;
            }

            addLeadWithNotification({
                name, business, phone, city,
                budget: budget || '',
                pages: pages || '1',
                requirements: requirements || '',
                status: status || STATUS_OPTIONS[0],
                note: note || ''
            }, user);

            // Clear form
            document.getElementById('new-name').value = '';
            document.getElementById('new-business').value = '';
            document.getElementById('new-phone').value = '';
            document.getElementById('new-city').value = INDIAN_CITIES[0];
            document.getElementById('new-budget').value = '';
            document.getElementById('new-pages').value = '1';
            document.getElementById('new-requirements').value = '';
            document.getElementById('new-status').value = STATUS_OPTIONS[0];
            document.getElementById('new-note').value = '';

            refreshDashboard();
        });
    }

    // Auto-save for edits
    document.querySelectorAll('.status-select, .budget-input, .note-input, .requirements-text, input[data-field="pages"]').forEach(element => {
        let timeout;
        element.addEventListener('input', (e) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                const leadId = element.dataset.id;
                const field = element.classList.contains('status-select') ? 'status' : 
                             element.classList.contains('budget-input') ? 'budget' :
                             element.classList.contains('requirements-text') ? 'requirements' :
                             element.dataset.field === 'pages' ? 'pages' : 'note';
                
                const value = element.type === 'number' ? element.value : element.value;
                
                updateLeadWithNotification(leadId, { [field]: value }, user);
            }, 500);
        });
    });

    // Hash change
    window.addEventListener('hashchange', () => refreshDashboard());
}

// ---------- LOGIN FUNCTION ----------
function doLogin() {
    console.log('🔑 Login function called');
    
    const email = document.getElementById('login-email')?.value.trim();
    const pass = document.getElementById('login-password')?.value.trim();
    
    console.log('Email entered:', email);
    
    const user = VALID_USERS.find(u => u.email === email && u.password === pass);
    
    if (user) {
        console.log('✅ Login successful for:', user.name);
        
        // Save session
        localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify({
            email: user.email,
            name: user.name
        }));
        
        // Show notification
        if (notifier) {
            notifier.show('success', 'Welcome!', `Logged in as ${user.name}`);
        }
        
        // Redirect to dashboard
        window.location.href = 'dashboard.html';
    } else {
        console.log('❌ Login failed for:', email);
        const errorDiv = document.getElementById('login-error');
        if (errorDiv) {
            errorDiv.style.display = 'block';
            errorDiv.innerText = '❌ Invalid email or password';
        }
    }
}

// ---------- ATTACH LOGIN EVENTS ----------
function attachLoginEvents() {
    console.log('📝 Attaching login events');
    
    const loginBtn = document.getElementById('login-btn');
    const passInput = document.getElementById('login-password');
    const emailInput = document.getElementById('login-email');
    
    console.log('Login button found:', loginBtn ? '✅' : '❌');
    console.log('Password input found:', passInput ? '✅' : '❌');
    console.log('Email input found:', emailInput ? '✅' : '❌');
    
    if (loginBtn) {
        loginBtn.addEventListener('click', function(e) {
            e.preventDefault();
            doLogin();
        });
    }
    
    if (passInput) {
        passInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                doLogin();
            }
        });
    }
}

// ---------- UTILITY FUNCTIONS ----------
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return String(unsafe)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount || 0);
}

function loadLeads() {
    const stored = localStorage.getItem(STORAGE_KEYS.LEADS);
    if (stored) {
        try { 
            return JSON.parse(stored); 
        } catch { 
            return []; 
        }
    }
    return [];
}

function saveLeads(leads) {
    localStorage.setItem(STORAGE_KEYS.LEADS, JSON.stringify(leads));
}

function getSessionUser() {
    const raw = localStorage.getItem(STORAGE_KEYS.SESSION);
    if (!raw) return null;
    try { 
        return JSON.parse(raw); 
    } catch { 
        return null; 
    }
}

function setSession(user) {
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(user));
}

function clearSession() {
    localStorage.removeItem(STORAGE_KEYS.SESSION);
}

// ---------- MAIN INITIALIZATION ----------
function init() {
    console.log('🔧 Initializing app...');
    
    const path = window.location.pathname.split('/').pop() || 'index.html';
    console.log('📁 Current file:', path);
    
    const user = getSessionUser();
    console.log('Session user:', user ? user.email : 'none');

    // Login page
    if (path === 'index.html') {
        console.log('📝 On login page');
        
        if (user) {
            console.log('➡️ Already logged in, redirecting to dashboard');
            window.location.replace('dashboard.html');
            return;
        }
        
        attachLoginEvents();
    }
    
    // Dashboard page
    else if (path === 'dashboard.html') {
        console.log('📊 On dashboard page');
        
        if (!user) {
            console.log('🚫 No session, redirecting to login');
            window.location.replace('index.html');
            return;
        }
        
        console.log('✅ Session valid, rendering dashboard for:', user.name);
        
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const activeTab = params.get('tab') || 'today';
        const activeCity = params.get('city') || 'all';
        
        const container = document.getElementById('dashboard-container');
        
        if (container) {
            container.innerHTML = renderDashboard(user, activeTab, activeCity);
            attachDashboardEvents(user);
            console.log('✅ Dashboard rendered');
        } else {
            console.error('❌ dashboard-container not found!');
        }
    }
}

// Start app
console.log('🏁 Starting app...');
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
