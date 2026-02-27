// ---------- CONFIGURATION ----------
const VALID_USERS = [
    { email: 'sohail@lead.co', password: 'alpha', name: 'Sohail', telegramId: '1935946442' },
    { email: 'angad@lead.co', password: 'beta', name: 'Angad', telegramId: '7312373408' },
    { email: 'kishan@lead.co', password: 'gamma', name: 'Kishan', telegramId: '1757459881' }
];

const TELEGRAM_BOT_TOKEN = '8591307982:AAEc2CGvK1a2hk5aO9prS1HAhw3AhjxNpTc';

const STORAGE_KEYS = {
    SESSION: 'leadmanager_session',
    LEADS: 'leadmanager_leads'
};

const STATUS_OPTIONS = ['Interested', 'Not Interested', 'Follow Up', 'No Response'];

const INDIAN_CITIES = [
    'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Ahmedabad',
    'Chennai', 'Kolkata', 'Pune', 'Jaipur', 'Lucknow',
    'Nagpur', 'Indore', 'Bhopal', 'Visakhapatnam', 'Patna',
    'Vadodara', 'Guwahati', 'Chandigarh', 'Other'
];

// ---------- TELEGRAM NOTIFICATION ----------
class TelegramNotifier {
    constructor() {
        this.botToken = TELEGRAM_BOT_TOKEN;
        this.userColors = {
            'sohail@lead.co': { name: 'Sohail', emoji: '👨‍💻', color: '#FF6B6B' },
            'angad@lead.co': { name: 'Angad', emoji: '👨‍🔧', color: '#4ECDC4' },
            'kishan@lead.co': { name: 'Kishan', emoji: '👨‍🎨', color: '#A890FE' }
        };
    }

    async sendToAll(message, excludeUser = null) {
        const usersToNotify = VALID_USERS.filter(u => u.email !== excludeUser);
        
        for (const user of usersToNotify) {
            if (user.telegramId) {
                try {
                    await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chat_id: user.telegramId,
                            text: message,
                            parse_mode: 'HTML'
                        })
                    });
                } catch (e) {
                    console.log('Telegram error:', e);
                }
            }
        }
    }

    getAddMessage(user, lead) {
        const style = this.userColors[user.email] || { emoji: '👤', color: '#000' };
        return `
🟢 <b>NEW LEAD ADDED</b> | ${style.emoji} <span style="color:${style.color}">${user.name}</span>
━━━━━━━━━━━━━━━━
👤 Client: ${lead.name}
🏙️ City: ${lead.city}
💰 Budget: ₹${lead.budget || 0}
📄 Pages: ${lead.pages || 1}
📊 Status: ${lead.status}
🕐 ${new Date().toLocaleString()}
        `;
    }

    getUpdateMessage(user, lead, changes) {
        const style = this.userColors[user.email] || { emoji: '👤', color: '#000' };
        return `
📝 <b>LEAD UPDATED</b> | ${style.emoji} <span style="color:${style.color}">${user.name}</span>
━━━━━━━━━━━━━━━━
👤 Client: ${lead.name}
✏️ Changes: ${changes}
🕐 ${new Date().toLocaleString()}
        `;
    }
}

const telegram = new TelegramNotifier();

// ---------- LOCAL STORAGE FUNCTIONS ----------
function loadLeads() {
    const stored = localStorage.getItem(STORAGE_KEYS.LEADS);
    return stored ? JSON.parse(stored) : [];
}

function saveLeads(leads) {
    localStorage.setItem(STORAGE_KEYS.LEADS, JSON.stringify(leads));
}

function getSessionUser() {
    const session = localStorage.getItem(STORAGE_KEYS.SESSION);
    return session ? JSON.parse(session) : null;
}

// ---------- CUSTOM CITY ----------
window.toggleCustomCity = function(select) {
    const customInput = document.getElementById('new-city-custom');
    if (select.value === 'Other') {
        customInput.style.display = 'block';
        customInput.required = true;
    } else {
        customInput.style.display = 'none';
        customInput.required = false;
        customInput.value = '';
    }
};

function getCityValue() {
    const select = document.getElementById('new-city');
    if (select.value === 'Other') {
        const custom = document.getElementById('new-city-custom').value.trim();
        return custom || 'Other';
    }
    return select.value;
}

// ---------- DATE GROUPING ----------
function groupLeadsByDate(leads) {
    const today = new Date(); today.setHours(0,0,0,0);
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);
    
    const groups = { today: [], yesterday: [], thisWeek: [], older: [] };
    
    leads.forEach(lead => {
        const d = new Date(lead.createdAt || lead.updatedAt || Date.now());
        d.setHours(0,0,0,0);
        
        if (d.getTime() === today.getTime()) groups.today.push(lead);
        else if (d.getTime() === yesterday.getTime()) groups.yesterday.push(lead);
        else if (d > weekAgo) groups.thisWeek.push(lead);
        else groups.older.push(lead);
    });
    
    return groups;
}

// ---------- RENDER FUNCTIONS ----------
function renderDashboard(user, activeTab = 'today', activeCity = 'all') {
    const leads = loadLeads();
    const groups = groupLeadsByDate(leads);
    const cities = ['all', ...new Set(leads.map(l => l.city).filter(Boolean))];
    const totalBudget = leads.reduce((s, l) => s + (parseInt(l.budget) || 0), 0);
    
    let rows = '';
    const tabs = ['today', 'yesterday', 'thisWeek', 'older'];
    
    tabs.forEach(tab => {
        if (activeTab === 'all' || activeTab === tab) {
            const groupLeads = groups[tab].filter(l => activeCity === 'all' || l.city === activeCity);
            if (groupLeads.length) {
                rows += `<tr class="date-separator"><td colspan="8"><span class="date-badge ${tab === 'today' ? 'today-badge' : ''}">${tab}</span> ${groupLeads.length} leads</td></tr>`;
                groupLeads.forEach(l => { rows += renderLeadRow(l, user); });
            }
        }
    });
    
    if (!rows) rows = '<tr class="empty-row"><td colspan="8">No leads</td></tr>';
    
    return `
        <div class="top-bar">
            <span class="logo">📋 Lead Manager</span>
            <div class="user-badge">
                <span class="user-email">${user.name} (${user.email})</span>
                <button class="logout-btn" id="logoutBtn">Logout</button>
            </div>
        </div>
        <div class="content">
            <div style="background:#f0f9ff; padding:10px; border-radius:8px; margin-bottom:20px; display:inline-block;">
                📱 Telegram Notifications Active
            </div>
            
            <div class="summary-cards">
                <div class="summary-card leads"><h3>Total</h3><div class="number">${leads.length}</div><div class="label">${groups.today.length} today</div></div>
                <div class="summary-card budget"><h3>Budget</h3><div class="number">₹${totalBudget.toLocaleString()}</div><div class="label">Avg: ₹${leads.length ? Math.round(totalBudget/leads.length).toLocaleString() : 0}</div></div>
            </div>
            
            <div class="city-filters">
                ${cities.map(c => `<button class="city-filter ${activeCity === c ? 'active' : ''}" onclick="window.location.hash='city=${c}'">${c === 'all' ? '🏢 All' : `📍 ${c}`}</button>`).join('')}
            </div>
            
            <h2>Add Lead</h2>
            <div class="lead-form">
                <div class="form-group"><label>Name *</label><input id="new-name" placeholder="Client name"></div>
                <div class="form-group"><label>Business *</label><input id="new-business" placeholder="Business"></div>
                <div class="form-group"><label>Phone *</label><input id="new-phone" placeholder="Phone"></div>
                <div class="form-group">
                    <label>City *</label>
                    <select id="new-city" onchange="toggleCustomCity(this)">${INDIAN_CITIES.map(c => `<option value="${c}">${c}</option>`).join('')}</select>
                    <input id="new-city-custom" style="display:none; margin-top:8px;" placeholder="Enter city">
                </div>
                <div class="form-group"><label>Budget</label><input id="new-budget" type="number" placeholder="Amount"></div>
                <div class="form-group"><label>Pages</label><input id="new-pages" type="number" value="1" min="1"></div>
                <div class="form-group"><label>Requirements</label><input id="new-requirements" placeholder="Requirements"></div>
                <div class="form-group"><label>Status</label><select id="new-status">${STATUS_OPTIONS.map(s => `<option value="${s}">${s}</option>`).join('')}</select></div>
                <div class="form-group"><label>Note</label><input id="new-note" placeholder="Note"></div>
                <button class="btn-primary" id="addLeadBtn">+ Add</button>
            </div>
            
            <div class="lead-tabs">
                ${['today', 'yesterday', 'thisWeek', 'older', 'all'].map(t => `<button class="tab-btn ${activeTab === t ? 'active' : ''}" onclick="window.location.hash='tab=${t}'">${t} <span class="count">${t === 'all' ? leads.length : groups[t].length}</span></button>`).join('')}
            </div>
            
            <div class="table-wrapper">
                <table><thead><tr><th>Client & City</th><th>Business</th><th>Phone</th><th>Status</th><th>Budget & Pages</th><th>Requirements</th><th>Note</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table>
            </div>
        </div>
    `;
}

function renderLeadRow(lead, user) {
    return `<tr data-id="${lead.id}">
        <td><strong>${lead.name}</strong><div class="city-badge">📍 ${lead.city}</div><div style="font-size:11px; color:#718096;">${new Date(lead.createdAt).toLocaleDateString()}</div></td>
        <td>${lead.business}</td>
        <td>${lead.phone}</td>
        <td><select class="status-select" data-id="${lead.id}" data-field="status">${STATUS_OPTIONS.map(s => `<option ${lead.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></td>
        <td><span class="currency">₹</span><input class="budget-input" value="${lead.budget || ''}" data-id="${lead.id}" data-field="budget"><div class="pages-badge">📄 <input value="${lead.pages || 1}" data-id="${lead.id}" data-field="pages" style="width:40px;"></div></td>
        <td><input class="requirements-text" value="${lead.requirements || ''}" data-id="${lead.id}" data-field="requirements"></td>
        <td><input class="note-input" value="${lead.note || ''}" data-id="${lead.id}" data-field="note"></td>
        <td class="action-cell"><a href="tel:${lead.phone}" class="call-btn">📞</a><button class="delete-btn" onclick="deleteLead('${lead.id}')">🗑️</button></td>
    </tr>`;
}

// ---------- LEAD OPERATIONS ----------
function addLead(data, user) {
    const leads = loadLeads();
    const newLead = { id: Date.now() + '-' + Math.random(), ...data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), createdBy: user.email };
    leads.push(newLead);
    saveLeads(leads);
    
    telegram.sendToAll(telegram.getAddMessage(user, newLead), user.email);
    refreshDashboard();
}

function updateLead(id, field, value, user) {
    const leads = loadLeads();
    const lead = leads.find(l => l.id === id);
    if (lead) {
        lead[field] = value;
        lead.updatedAt = new Date().toISOString();
        saveLeads(leads);
        telegram.sendToAll(telegram.getUpdateMessage(user, lead, `${field} changed`), user.email);
    }
}

window.deleteLead = function(id) {
    if (!confirm('Delete?')) return;
    const user = getSessionUser();
    const leads = loadLeads();
    const lead = leads.find(l => l.id === id);
    const filtered = leads.filter(l => l.id !== id);
    saveLeads(filtered);
    telegram.sendToAll(`🔴 LEAD DELETED\nClient: ${lead?.name}\nBy: ${user?.name}`, user?.email);
    refreshDashboard();
};

function refreshDashboard() {
    const user = getSessionUser();
    if (!user) return;
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    document.getElementById('dashboard-container').innerHTML = renderDashboard(user, params.get('tab') || 'today', params.get('city') || 'all');
    attachEvents(user);
}

// ---------- EVENT ATTACHMENT ----------
function attachEvents(user) {
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        localStorage.removeItem(STORAGE_KEYS.SESSION);
        window.location = 'index.html';
    });
    
    document.getElementById('addLeadBtn')?.addEventListener('click', () => {
        const data = {
            name: document.getElementById('new-name')?.value,
            business: document.getElementById('new-business')?.value,
            phone: document.getElementById('new-phone')?.value,
            city: getCityValue(),
            budget: document.getElementById('new-budget')?.value,
            pages: document.getElementById('new-pages')?.value,
            requirements: document.getElementById('new-requirements')?.value,
            status: document.getElementById('new-status')?.value,
            note: document.getElementById('new-note')?.value
        };
        if (!data.name || !data.business || !data.phone || !data.city) return alert('Fill required fields');
        addLead(data, user);
        
        // Clear form
        ['name','business','phone','budget','requirements','note'].forEach(f => document.getElementById(`new-${f}`).value = '');
        document.getElementById('new-city').value = INDIAN_CITIES[0];
        document.getElementById('new-pages').value = '1';
        document.getElementById('new-status').value = STATUS_OPTIONS[0];
        document.getElementById('new-city-custom').style.display = 'none';
    });
    
    document.querySelectorAll('[data-id]').forEach(el => {
        let timeout;
        el.addEventListener('input', (e) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                updateLead(el.dataset.id, el.dataset.field || 'note', el.value, user);
            }, 500);
        });
    });
    
    window.addEventListener('hashchange', refreshDashboard);
}

// ---------- LOGIN ----------
function doLogin() {
    const email = document.getElementById('login-email')?.value;
    const pass = document.getElementById('login-password')?.value;
    const user = VALID_USERS.find(u => u.email === email && u.password === pass);
    
    if (user) {
        localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify({ email: user.email, name: user.name }));
        window.location = 'dashboard.html';
    } else {
        document.getElementById('login-error').style.display = 'block';
    }
}

// ---------- INIT ----------
function init() {
    const path = window.location.pathname.split('/').pop();
    const user = getSessionUser();
    
    if (path === 'dashboard.html') {
        if (!user) return window.location = 'index.html';
        const hash = window.location.hash.slice(1);
        const params = new URLSearchParams(hash);
        document.getElementById('dashboard-container').innerHTML = renderDashboard(user, params.get('tab') || 'today', params.get('city') || 'all');
        attachEvents(user);
    } else {
        if (user) window.location = 'dashboard.html';
        document.getElementById('login-btn')?.addEventListener('click', doLogin);
        document.getElementById('login-password')?.addEventListener('keypress', e => e.key === 'Enter' && doLogin());
    }
}

document.addEventListener('DOMContentLoaded', init);
window.addEventListener('storage', (e) => e.key === STORAGE_KEYS.LEADS && refreshDashboard());
