// ---------- CONFIGURATION WITH YOUR TOKEN ----------
const VALID_USERS = [
    { email: 'sohail@lead.co', password: 'alpha', name: 'Sohail', telegramId: '1935946442' },
    { email: 'angad@lead.co', password: 'beta', name: 'Angad', telegramId: '6825198399' },
    { email: 'kishan@lead.co', password: 'gamma', name: 'Kishan', telegramId: '1757459881' }
];

const TELEGRAM_BOT_TOKEN = '8591307982:AAEc2CGvK1a2hk5aO9prS1HAhw3AhjxNpTc';

// TUMHARA TOKEN AUR GIST ID - YE USE HOGA
const GITHUB_TOKEN = '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';
const GIST_ID = 'f1ef52f86cbcc0bd6364a821187fc13b';

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

// ---------- CLOUD STORAGE (GITHUB GIST) ----------
class CloudStorage {
    constructor() {
        this.token = GITHUB_TOKEN;
        this.gistId = GIST_ID;
        this.cache = null;
        this.lastSync = 0;
        console.log('☁️ Cloud Storage Ready with Gist ID:', this.gistId);
    }

    async saveToCloud(leads) {
        try {
            // Pehle localStorage mein save karo
            localStorage.setItem(STORAGE_KEYS.LEADS, JSON.stringify(leads));
            
            // GitHub Gist mein save karo
            const response = await fetch(`https://api.github.com/gists/${this.gistId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    files: {
                        'leads.json': {
                            content: JSON.stringify(leads, null, 2)
                        }
                    }
                })
            });
            
            if (response.ok) {
                console.log('☁️ Cloud save successful at', new Date().toLocaleTimeString());
                this.lastSync = Date.now();
                
                // Broadcast to other tabs
                localStorage.setItem('leadmanager_sync', Date.now().toString());
            } else {
                const error = await response.text();
                console.log('❌ Cloud save failed:', error);
            }
        } catch (error) {
            console.log('Cloud save error:', error);
        }
    }

    async loadFromCloud() {
        try {
            // Pehle localStorage se try karo
            const local = localStorage.getItem(STORAGE_KEYS.LEADS);
            if (local) {
                this.cache = JSON.parse(local);
            }
            
            // GitHub se latest lo
            const response = await fetch(`https://api.github.com/gists/${this.gistId}`);
            const data = await response.json();
            
            if (data.files && data.files['leads.json']) {
                const cloudLeads = JSON.parse(data.files['leads.json'].content);
                console.log('☁️ Cloud loaded', cloudLeads.length, 'leads');
                
                // Cloud wale use karo (wo latest hain)
                this.cache = cloudLeads;
                localStorage.setItem(STORAGE_KEYS.LEADS, JSON.stringify(cloudLeads));
            }
            
            return this.cache || [];
        } catch (error) {
            console.log('Cloud load failed:', error);
            const local = localStorage.getItem(STORAGE_KEYS.LEADS);
            return local ? JSON.parse(local) : [];
        }
    }
}

const cloud = new CloudStorage();

// ---------- TELEGRAM NOTIFICATION (FAST) ----------
class TelegramNotifier {
    constructor() {
        this.queue = [];
        this.processing = false;
        this.userColors = {
            'sohail@lead.co': { name: 'Sohail', emoji: '👨‍💻', color: '#FF6B6B' },
            'angad@lead.co': { name: 'Angad', emoji: '👨‍🔧', color: '#4ECDC4' },
            'kishan@lead.co': { name: 'Kishan', emoji: '👨‍🎨', color: '#A890FE' }
        };
    }

    async sendMessage(chatId, text) {
        try {
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: text,
                    parse_mode: 'HTML'
                })
            });
        } catch (e) {
            console.log('Telegram error:', e);
        }
    }

    queueNotification(user, message) {
        this.queue.push({ user, message, time: Date.now() });
        this.processQueue();
    }

    async processQueue() {
        if (this.processing || this.queue.length === 0) return;
        this.processing = true;

        while (this.queue.length > 0) {
            const item = this.queue.shift();
            
            // Sabhi users ko bhejo (except sender)
            for (const u of VALID_USERS) {
                if (u.email !== item.user.email && u.telegramId) {
                    await this.sendMessage(u.telegramId, item.message);
                    await new Promise(r => setTimeout(r, 200)); // Rate limit
                }
            }
        }

        this.processing = false;
    }

    getAddMessage(user, lead) {
        const style = this.userColors[user.email] || { emoji: '👤', color: '#000' };
        const time = new Date().toLocaleTimeString();
        
        return `🟢 <b>NEW LEAD</b> | ${style.emoji} <span style="color:${style.color}">${user.name}</span>
━━━━━━━━━━━━━━
👤 ${lead.name}
📍 ${lead.city}
💰 ₹${lead.budget || 0}
📞 ${lead.phone}
🕐 ${time}`;
    }

    getUpdateMessage(user, lead, field, value) {
        const style = this.userColors[user.email] || { emoji: '👤', color: '#000' };
        const time = new Date().toLocaleTimeString();
        
        return `📝 <b>UPDATED</b> | ${style.emoji} <span style="color:${style.color}">${user.name}</span>
━━━━━━━━━━━━━━
👤 ${lead.name}
✏️ ${field}: ${value}
🕐 ${time}`;
    }
}

const telegram = new TelegramNotifier();

// ---------- STORAGE FUNCTIONS ----------
async function loadLeads() {
    return await cloud.loadFromCloud();
}

async function saveLeads(leads) {
    await cloud.saveToCloud(leads);
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
async function renderDashboard(user, activeTab = 'today', activeCity = 'all') {
    const leads = await loadLeads();
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
            <div style="background:#f0f9ff; padding:10px; border-radius:8px; margin-bottom:20px; display:flex; gap:20px; flex-wrap:wrap;">
                <span>📱 Telegram Active</span>
                <span>☁️ Cloud Sync Active (Gist: ${GIST_ID.substring(0,8)}...)</span>
                <span>🔄 Last Sync: ${new Date(cloud.lastSync).toLocaleTimeString() || 'Just now'}</span>
            </div>
            
            <div class="summary-cards">
                <div class="summary-card leads"><h3>Total</h3><div class="number">${leads.length}</div><div class="label">${groups.today.length} today</div></div>
                <div class="summary-card budget"><h3>Budget</h3><div class="number">₹${totalBudget.toLocaleString()}</div><div class="label">Avg: ₹${leads.length ? Math.round(totalBudget/leads.length).toLocaleString() : 0}</div></div>
            </div>
            
            <div class="city-filters">
                ${cities.map(c => `<button class="city-filter ${activeCity === c ? 'active' : ''}" onclick="window.location.hash='city=${c}'">${c === 'all' ? '🏢 All' : `📍 ${c}`}</button>`).join('')}
            </div>
            
            <h2>Add New Lead</h2>
            <div class="lead-form">
                <div class="form-group"><label>Name *</label><input id="new-name" placeholder="Client name"></div>
                <div class="form-group"><label>Business *</label><input id="new-business" placeholder="Business"></div>
                <div class="form-group"><label>Phone *</label><input id="new-phone" placeholder="Phone"></div>
                <div class="form-group">
                    <label>City *</label>
                    <select id="new-city" onchange="toggleCustomCity(this)">${INDIAN_CITIES.map(c => `<option value="${c}">${c}</option>`).join('')}</select>
                    <input id="new-city-custom" style="display:none; margin-top:8px;" placeholder="Enter city name">
                </div>
                <div class="form-group"><label>Budget (₹)</label><input id="new-budget" type="number" placeholder="Amount"></div>
                <div class="form-group"><label>Pages</label><input id="new-pages" type="number" value="1" min="1"></div>
                <div class="form-group"><label>Requirements</label><input id="new-requirements" placeholder="E-commerce, etc"></div>
                <div class="form-group"><label>Status</label><select id="new-status">${STATUS_OPTIONS.map(s => `<option value="${s}">${s}</option>`).join('')}</select></div>
                <div class="form-group"><label>Note</label><input id="new-note" placeholder="Any notes"></div>
                <button class="btn-primary" id="addLeadBtn">+ Add Lead</button>
            </div>
            
            <div class="lead-tabs">
                ${['today', 'yesterday', 'thisWeek', 'older', 'all'].map(t => `<button class="tab-btn ${activeTab === t ? 'active' : ''}" onclick="window.location.hash='tab=${t}'">${t} <span class="count">${t === 'all' ? leads.length : groups[t].length}</span></button>`).join('')}
            </div>
            
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
                    <tbody id="table-body">
                        ${rows}
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

    return `<tr data-id="${lead.id}">
        <td>
            <div><strong>${lead.name}</strong></div>
            <div class="city-badge">📍 ${lead.city}</div>
            <div style="font-size:11px; color:#718096;">${new Date(lead.createdAt).toLocaleDateString()}</div>
        </td>
        <td>${lead.business || ''}</td>
        <td>${lead.phone || ''}</td>
        <td>
            <select class="status-select" data-id="${lead.id}" data-field="status">
                ${statusOptions}
            </select>
        </td>
        <td>
            <div><span class="currency">₹</span><input class="budget-input" value="${lead.budget || ''}" data-id="${lead.id}" data-field="budget" style="width:80px;"></div>
            <div class="pages-badge">📄 <input value="${lead.pages || 1}" data-id="${lead.id}" data-field="pages" style="width:40px; background:transparent; border:none;"></div>
        </td>
        <td><input class="requirements-text" value="${lead.requirements || ''}" data-id="${lead.id}" data-field="requirements" placeholder="Requirements"></td>
        <td><input class="note-input" value="${lead.note || ''}" data-id="${lead.id}" data-field="note" placeholder="Note"></td>
        <td class="action-cell">
            <a href="tel:${lead.phone}" class="call-btn">📞</a>
            <button class="delete-btn" onclick="deleteLead('${lead.id}')">🗑️</button>
        </td>
    </tr>`;
}

// ---------- LEAD OPERATIONS ----------
async function addLead(data, user) {
    const leads = await loadLeads();
    const newLead = { 
        id: Date.now() + '-' + Math.random().toString(36).substr(2, 6), 
        ...data, 
        createdAt: new Date().toISOString(), 
        updatedAt: new Date().toISOString(), 
        createdBy: user.email 
    };
    leads.push(newLead);
    await saveLeads(leads);
    
    telegram.queueNotification(user, telegram.getAddMessage(user, newLead));
    refreshDashboard();
}

async function updateLead(id, field, value, user) {
    const leads = await loadLeads();
    const lead = leads.find(l => l.id === id);
    if (lead) {
        lead[field] = value;
        lead.updatedAt = new Date().toISOString();
        await saveLeads(leads);
        telegram.queueNotification(user, telegram.getUpdateMessage(user, lead, field, value));
    }
}

window.deleteLead = async function(id) {
    if (!confirm('Delete this lead?')) return;
    const user = getSessionUser();
    const leads = await loadLeads();
    const lead = leads.find(l => l.id === id);
    const filtered = leads.filter(l => l.id !== id);
    await saveLeads(filtered);
    
    if (lead) {
        telegram.queueNotification(user, `🔴 <b>DELETED</b>\n👤 ${lead.name}\n📍 ${lead.city}`);
    }
    refreshDashboard();
};

async function refreshDashboard() {
    const user = getSessionUser();
    if (!user) return;
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    const html = await renderDashboard(user, params.get('tab') || 'today', params.get('city') || 'all');
    document.getElementById('dashboard-container').innerHTML = html;
    attachEvents(user);
}

// ---------- EVENT ATTACHMENT ----------
function attachEvents(user) {
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        localStorage.removeItem(STORAGE_KEYS.SESSION);
        window.location = 'index.html';
    });
    
    document.getElementById('addLeadBtn')?.addEventListener('click', async () => {
        const data = {
            name: document.getElementById('new-name')?.value.trim(),
            business: document.getElementById('new-business')?.value.trim(),
            phone: document.getElementById('new-phone')?.value.trim(),
            city: getCityValue(),
            budget: document.getElementById('new-budget')?.value,
            pages: document.getElementById('new-pages')?.value || '1',
            requirements: document.getElementById('new-requirements')?.value.trim(),
            status: document.getElementById('new-status')?.value,
            note: document.getElementById('new-note')?.value.trim()
        };
        
        if (!data.name || !data.business || !data.phone || !data.city) {
            alert('Please fill Name, Business, Phone, and City');
            return;
        }
        
        await addLead(data, user);
        
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
        document.getElementById('new-city-custom').style.display = 'none';
        document.getElementById('new-city-custom').value = '';
    });
    
    // Auto-save with debounce
    let timeouts = {};
    document.querySelectorAll('[data-id]').forEach(el => {
        el.addEventListener('input', (e) => {
            const id = el.dataset.id;
            if (timeouts[id]) clearTimeout(timeouts[id]);
            
            timeouts[id] = setTimeout(async () => {
                const field = el.dataset.field || 'note';
                await updateLead(id, field, el.value, user);
            }, 1000);
        });
    });
    
    window.addEventListener('hashchange', refreshDashboard);
}

// ---------- LOGIN ----------
function doLogin() {
    const email = document.getElementById('login-email')?.value.trim();
    const pass = document.getElementById('login-password')?.value.trim();
    const user = VALID_USERS.find(u => u.email === email && u.password === pass);
    
    if (user) {
        localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify({ email: user.email, name: user.name }));
        window.location = 'dashboard.html';
    } else {
        const errorDiv = document.getElementById('login-error');
        if (errorDiv) {
            errorDiv.style.display = 'block';
            errorDiv.innerText = '❌ Invalid email or password';
        }
    }
}

// ---------- INIT ----------
async function init() {
    const path = window.location.pathname.split('/').pop() || 'index.html';
    const user = getSessionUser();
    
    if (path === 'dashboard.html') {
        if (!user) {
            window.location = 'index.html';
            return;
        }
        
        // Cloud se data load karo
        console.log('☁️ Loading from cloud...');
        await cloud.loadFromCloud();
        
        const hash = window.location.hash.slice(1);
        const params = new URLSearchParams(hash);
        const html = await renderDashboard(user, params.get('tab') || 'today', params.get('city') || 'all');
        document.getElementById('dashboard-container').innerHTML = html;
        attachEvents(user);
    } else {
        if (user) {
            window.location = 'dashboard.html';
            return;
        }
        
        document.getElementById('login-btn')?.addEventListener('click', doLogin);
        document.getElementById('login-password')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') doLogin();
        });
    }
}

// Sync between tabs
window.addEventListener('storage', (e) => {
    if (e.key === 'leadmanager_sync' || e.key === STORAGE_KEYS.LEADS) {
        refreshDashboard();
    }
});

document.addEventListener('DOMContentLoaded', init);
