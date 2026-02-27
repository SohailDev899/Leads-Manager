// ---------- CONFIGURATION ----------
const VALID_USERS = [
    { email: 'sohail@lead.co', password: 'alpha', name: 'Sohail', telegramId: '1935946442', color: '#FF6B6B' },
    { email: 'angad@lead.co', password: 'beta', name: 'Angad', telegramId: '7312373408', color: '#4ECDC4' },
    { email: 'kishan@lead.co', password: 'gamma', name: 'Kishan', telegramId: '1757459881', color: '#A890FE' }
];

const TELEGRAM_BOT_TOKEN = '8591307982:AAEc2CGvK1a2hk5aO9prS1HAhw3AhjxNpTc';
const STATUS_OPTIONS = ['Interested', 'Not Interested', 'Follow Up', 'No Response'];

// 🔥 YAHAN APNA FIREBASE CONFIG DALO
const firebaseConfig = {
    apiKey: "AIzaSyA9P8EgF-M3E3Ejo_XVlI98dNXxrT2hWx8",
    authDomain: "lead-manager-e295e.firebaseapp.com",
    projectId: "lead-manager-e295e",
    storageBucket: "lead-manager-e295e.firebasestorage.app",
    messagingSenderId: "88157245260",
    appId: "1:88157245260:web:49d430af370c670b5fc9e9"
};

const INDIAN_CITIES = [
    'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Ahmedabad',
    'Chennai', 'Kolkata', 'Pune', 'Jaipur', 'Lucknow',
    'Nagpur', 'Indore', 'Bhopal', 'Visakhapatnam', 'Patna',
    'Vadodara', 'Guwahati', 'Chandigarh', 'Other'
];

// ---------- FIREBASE INITIALIZATION (FIXED VERSION) ----------
let db = null;
let firebaseReady = false;

function initFirebase() {
    return new Promise((resolve) => {
        // Pehle se loaded hai to skip
        if (window.firebase) {
            db = firebase.firestore();
            firebaseReady = true;
            console.log('✅ Firebase already ready');
            resolve();
            return;
        }

        // Firebase App script - version 8 (jo bina modules ke kaam karta hai)
        const appScript = document.createElement('script');
        appScript.src = 'https://www.gstatic.com/firebasejs/8.10.0/firebase-app.js';
        appScript.onload = () => {
            console.log('✅ Firebase app loaded');
            
            // Firebase Firestore script
            const firestoreScript = document.createElement('script');
            firestoreScript.src = 'https://www.gstatic.com/firebasejs/8.10.0/firebase-firestore.js';
            firestoreScript.onload = () => {
                console.log('✅ Firebase firestore loaded');
                
                // Initialize Firebase
                firebase.initializeApp(firebaseConfig);
                db = firebase.firestore();
                firebaseReady = true;
                
                console.log('🔥 Firebase ready!');
                
                // Test connection
                db.collection('leads').limit(1).get()
                    .then(() => console.log('✅ Firebase connected'))
                    .catch(err => console.log('⚠️ Firebase error:', err));
                
                resolve();
            };
            firestoreScript.onerror = (err) => {
                console.error('❌ Firestore load error:', err);
                resolve(); // Continue without Firebase
            };
            document.head.appendChild(firestoreScript);
        };
        appScript.onerror = (err) => {
            console.error('❌ Firebase app load error:', err);
            resolve(); // Continue without Firebase
        };
        document.head.appendChild(appScript);
    });
}

// ---------- ACTIVITY TRACKER ----------
class ActivityTracker {
    constructor() {
        this.activities = this.loadActivities();
    }

    loadActivities() {
        return JSON.parse(localStorage.getItem('activities') || '[]');
    }

    saveActivities() {
        if (this.activities.length > 50) {
            this.activities = this.activities.slice(-50);
        }
        localStorage.setItem('activities', JSON.stringify(this.activities));
    }

    addActivity(user, action, details) {
        const activity = {
            id: Date.now() + '-' + Math.random().toString(36).substr(2, 4),
            user: user.name,
            userEmail: user.email,
            userColor: user.color || '#667eea',
            action: action,
            details: details,
            timestamp: new Date().toISOString(),
            time: new Date().toLocaleTimeString()
        };
        
        this.activities.push(activity);
        this.saveActivities();
        this.updateActivityPanel();
        return activity;
    }

    updateActivityPanel() {
        const panel = document.getElementById('activity-panel');
        if (!panel) return;
        
        const recent = [...this.activities].reverse().slice(0, 10);
        panel.innerHTML = recent.map(a => `
            <div style="padding:8px; border-bottom:1px solid #e2e8f0; font-size:12px;">
                <span style="color:${a.userColor}; font-weight:bold;">${a.user}</span>
                <span style="color:#718096;"> ${a.action}</span>
                <span style="color:#a0aec0;"> ${a.details}</span>
                <div style="color:#a0aec0; font-size:10px; margin-top:2px;">${a.time}</div>
            </div>
        `).join('');
    }

    getActivityHTML() {
        const recent = [...this.activities].reverse().slice(0, 10);
        return `
            <div style="background:white; border-radius:8px; margin-bottom:20px; border:1px solid #e2e8f0;">
                <div style="padding:10px; background:#f7fafc; border-bottom:1px solid #e2e8f0; font-weight:600;">
                    📋 Live Activity Feed
                </div>
                <div id="activity-panel" style="max-height:200px; overflow-y:auto;">
                    ${recent.map(a => `
                        <div style="padding:8px; border-bottom:1px solid #e2e8f0; font-size:12px;">
                            <span style="color:${a.userColor}; font-weight:bold;">${a.user}</span>
                            <span style="color:#718096;"> ${a.action}</span>
                            <span style="color:#a0aec0;"> ${a.details}</span>
                            <div style="color:#a0aec0; font-size:10px; margin-top:2px;">${a.time}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
}

const activityTracker = new ActivityTracker();

// ---------- CLOUD STORAGE (WITH FALLBACK) ----------
async function saveLeadsToFirebase(leads) {
    if (!firebaseReady || !db) {
        console.log('📦 Using localStorage only');
        return;
    }
    
    try {
        const batch = db.batch();
        leads.forEach(lead => {
            const ref = db.collection('leads').doc(lead.id);
            batch.set(ref, lead, { merge: true });
        });
        await batch.commit();
        console.log('✅ Firebase save successful');
    } catch (error) {
        console.error('❌ Firebase save error:', error);
    }
}

async function loadLeadsFromFirebase() {
    if (!firebaseReady || !db) {
        console.log('📦 Loading from localStorage');
        return null;
    }
    
    try {
        const snapshot = await db.collection('leads').get();
        const leads = [];
        snapshot.forEach(doc => leads.push(doc.data()));
        console.log('✅ Firebase loaded:', leads.length, 'leads');
        return leads;
    } catch (error) {
        console.error('❌ Firebase load error:', error);
        return null;
    }
}

function loadLeadsFromLocal() {
    const stored = localStorage.getItem('leads');
    return stored ? JSON.parse(stored) : [];
}

function saveLeadsToLocal(leads) {
    localStorage.setItem('leads', JSON.stringify(leads));
}

async function loadLeads() {
    const fbLeads = await loadLeadsFromFirebase();
    if (fbLeads) {
        saveLeadsToLocal(fbLeads);
        return fbLeads;
    }
    return loadLeadsFromLocal();
}

async function saveLeads(leads) {
    saveLeadsToLocal(leads);
    await saveLeadsToFirebase(leads);
    localStorage.setItem('leadmanager_sync', Date.now().toString());
}

// ---------- TELEGRAM ----------
class TelegramNotifier {
    async sendToAll(message, excludeUser) {
        const users = {
            'sohail@lead.co': '1935946442',
            'angad@lead.co': '7312373408', 
            'kishan@lead.co': '1757459881'
        };
        
        for (const [email, id] of Object.entries(users)) {
            if (email !== excludeUser && id) {
                try {
                    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            chat_id: id, 
                            text: message,
                            parse_mode: 'HTML'
                        })
                    });
                } catch (e) {}
            }
        }
    }
}

const telegram = new TelegramNotifier();

// ---------- SESSION ----------
function getSessionUser() {
    const session = localStorage.getItem('session');
    return session ? JSON.parse(session) : null;
}

// ---------- CUSTOM CITY ----------
window.toggleCustomCity = function(select) {
    const customInput = document.getElementById('new-city-custom');
    customInput.style.display = select.value === 'Other' ? 'block' : 'none';
};

function getCityValue() {
    const select = document.getElementById('new-city');
    if (select.value === 'Other') {
        return document.getElementById('new-city-custom').value || 'Other';
    }
    return select.value;
}

// ---------- RENDER DASHBOARD ----------
function renderDashboard(user, leads, activeTab = 'all', activeCity = 'all') {
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    
    const groups = { today: [], yesterday: [], older: [] };
    
    leads.forEach(lead => {
        const leadDate = new Date(lead.createdAt).toDateString();
        if (leadDate === today) groups.today.push(lead);
        else if (leadDate === yesterday) groups.yesterday.push(lead);
        else groups.older.push(lead);
    });
    
    let filteredLeads = [];
    if (activeTab === 'all') {
        filteredLeads = activeCity === 'all' ? leads : leads.filter(l => l.city === activeCity);
    } else {
        filteredLeads = activeCity === 'all' ? groups[activeTab] : groups[activeTab].filter(l => l.city === activeCity);
    }
    
    const cities = ['all', ...new Set(leads.map(l => l.city).filter(Boolean))];
    const totalBudget = leads.reduce((sum, l) => sum + (parseInt(l.budget) || 0), 0);
    
    return `
        <div class="top-bar">
            <span class="logo">📋 Lead Manager</span>
            <div class="user-badge">
                <span style="color:${user.color};">${user.name} (${user.email})</span>
                <button class="logout-btn" id="logoutBtn">Logout</button>
            </div>
        </div>
        
        <div class="content">
            <!-- Status Bar -->
            <div style="margin-bottom: 20px; padding: 15px; background: #f0f9ff; border-radius: 8px; display: flex; gap: 20px; flex-wrap: wrap;">
                <span>🔥 Firebase: ${firebaseReady ? '✅ Connected' : '⏳ Loading...'}</span>
                <span>📱 Telegram: ✅ Active</span>
                <span>📊 Total Leads: ${leads.length}</span>
                <span>💰 Budget: ₹${totalBudget.toLocaleString()}</span>
            </div>
            
            <!-- Activity Feed -->
            ${activityTracker.getActivityHTML()}
            
            <!-- City Filters -->
            <div style="margin-bottom: 20px; display: flex; gap: 10px; flex-wrap: wrap;">
                ${cities.map(c => `
                    <button class="city-filter" style="padding:5px 15px; border:1px solid #ccc; border-radius:20px; background:${activeCity === c ? '#667eea' : 'white'}; color:${activeCity === c ? 'white' : 'black'}; cursor:pointer;" onclick="window.location.hash='city=${c}'">
                        ${c === 'all' ? '🏢 All' : `📍 ${c}`}
                    </button>
                `).join('')}
            </div>
            
            <!-- Add Lead Form -->
            <h3 style="margin-bottom:15px;">Add New Lead</h3>
            <div class="lead-form" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(150px,1fr)); gap:10px; background:#f7fafc; padding:20px; border-radius:8px; margin-bottom:30px;">
                <input id="new-name" placeholder="Name *" style="padding:8px;">
                <input id="new-business" placeholder="Business" style="padding:8px;">
                <input id="new-phone" placeholder="Phone *" style="padding:8px;">
                <select id="new-city" onchange="toggleCustomCity(this)" style="padding:8px;">
                    ${INDIAN_CITIES.map(c => `<option>${c}</option>`).join('')}
                </select>
                <input id="new-city-custom" style="display:none; padding:8px;" placeholder="Other city">
                <input id="new-budget" type="number" placeholder="Budget" style="padding:8px;">
                <input id="new-pages" type="number" value="1" style="padding:8px;">
                <input id="new-requirements" placeholder="Requirements" style="padding:8px;">
                <select id="new-status" style="padding:8px;">
                    ${STATUS_OPTIONS.map(s => `<option>${s}</option>`).join('')}
                </select>
                <input id="new-note" placeholder="Note" style="padding:8px;">
                <button class="btn-primary" id="addLeadBtn" style="padding:8px 16px; background:#48bb78; color:white; border:none; border-radius:4px; cursor:pointer;">+ Add</button>
            </div>
            
            <!-- Tabs -->
            <div style="display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap;">
                ${['all', 'today', 'yesterday', 'older'].map(t => `
                    <button class="tab-btn" style="padding:8px 16px; border:1px solid #ccc; border-radius:6px; background:${activeTab === t ? '#667eea' : 'white'}; color:${activeTab === t ? 'white' : 'black'}; cursor:pointer;" onclick="window.location.hash='tab=${t}'">
                        ${t} (${t === 'all' ? leads.length : groups[t].length})
                    </button>
                `).join('')}
            </div>
            
            <!-- Leads Table -->
            <div class="table-wrapper" style="overflow-x:auto;">
                <table style="width:100%; border-collapse:collapse;">
                    <thead>
                        <tr style="background:#f7fafc;">
                            <th style="padding:12px; text-align:left;">Client & City</th>
                            <th style="padding:12px; text-align:left;">Business</th>
                            <th style="padding:12px; text-align:left;">Phone</th>
                            <th style="padding:12px; text-align:left;">Status</th>
                            <th style="padding:12px; text-align:left;">Budget</th>
                            <th style="padding:12px; text-align:left;">Added By</th>
                            <th style="padding:12px; text-align:left;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredLeads.map(lead => {
                            const addedBy = VALID_USERS.find(u => u.email === lead.createdBy) || { name: 'Unknown', color: '#718096' };
                            return `
                            <tr data-id="${lead.id}" style="border-bottom:1px solid #e2e8f0;">
                                <td style="padding:12px;">
                                    <strong>${lead.name}</strong>
                                    <div style="font-size:12px; color:#718096;">📍 ${lead.city}</div>
                                </td>
                                <td style="padding:12px;">${lead.business || ''}</td>
                                <td style="padding:12px;">${lead.phone || ''}</td>
                                <td style="padding:12px;">
                                    <select onchange="updateLeadField('${lead.id}', 'status', this.value)" style="padding:4px; border-radius:4px;">
                                        ${STATUS_OPTIONS.map(s => `<option ${lead.status === s ? 'selected' : ''}>${s}</option>`).join('')}
                                    </select>
                                </td>
                                <td style="padding:12px;">
                                    <input value="${lead.budget || ''}" onchange="updateLeadField('${lead.id}', 'budget', this.value)" style="width:80px; padding:4px;">
                                </td>
                                <td style="padding:12px; color:${addedBy.color};">${addedBy.name}</td>
                                <td style="padding:12px;">
                                    <a href="tel:${lead.phone}" style="padding:4px 8px; background:#e6fffa; color:#234e52; text-decoration:none; border-radius:4px; margin-right:5px;">📞</a>
                                    <button onclick="deleteLead('${lead.id}')" style="padding:4px 8px; background:#fed7d7; color:#c53030; border:none; border-radius:4px; cursor:pointer;">🗑️</button>
                                </td>
                            </tr>
                        `}).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// ---------- LEAD OPERATIONS ----------
window.updateLeadField = async function(id, field, value) {
    const user = getSessionUser();
    const leads = await loadLeads();
    const lead = leads.find(l => l.id === id);
    if (lead) {
        lead[field] = value;
        lead.updatedAt = new Date().toISOString();
        await saveLeads(leads);
        
        activityTracker.addActivity(user, 'updated', `${field} of ${lead.name}`);
        telegram.sendToAll(`📝 ${user.name} updated ${lead.name}`, user.email);
        refreshDashboard();
    }
};

window.deleteLead = async function(id) {
    if (!confirm('Delete?')) return;
    const user = getSessionUser();
    const leads = await loadLeads();
    const lead = leads.find(l => l.id === id);
    const filtered = leads.filter(l => l.id !== id);
    await saveLeads(filtered);
    
    activityTracker.addActivity(user, 'deleted', lead?.name);
    telegram.sendToAll(`🔴 ${user.name} deleted ${lead?.name}`, user.email);
    refreshDashboard();
};

async function addLead() {
    const user = getSessionUser();
    
    const data = {
        id: Date.now() + '-' + Math.random().toString(36).substr(2, 6),
        name: document.getElementById('new-name').value,
        business: document.getElementById('new-business').value,
        phone: document.getElementById('new-phone').value,
        city: getCityValue(),
        budget: document.getElementById('new-budget').value,
        pages: document.getElementById('new-pages').value || '1',
        requirements: document.getElementById('new-requirements').value,
        status: document.getElementById('new-status').value,
        note: document.getElementById('new-note').value,
        createdAt: new Date().toISOString(),
        createdBy: user.email
    };
    
    if (!data.name || !data.phone || !data.city) {
        alert('Name, Phone and City required!');
        return;
    }
    
    const leads = await loadLeads();
    leads.push(data);
    await saveLeads(leads);
    
    activityTracker.addActivity(user, 'added', data.name);
    telegram.sendToAll(`🟢 ${user.name} added ${data.name}`, user.email);
    
    // Clear form
    document.getElementById('new-name').value = '';
    document.getElementById('new-phone').value = '';
    document.getElementById('new-city-custom').style.display = 'none';
    
    refreshDashboard();
}

async function refreshDashboard() {
    const user = getSessionUser();
    if (!user) return;
    
    const leads = await loadLeads();
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    
    document.getElementById('dashboard-container').innerHTML = renderDashboard(
        user, leads,
        params.get('tab') || 'all',
        params.get('city') || 'all'
    );
    
    document.getElementById('addLeadBtn')?.addEventListener('click', addLead);
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        localStorage.removeItem('session');
        window.location = 'index.html';
    });
}

// ---------- LOGIN ----------
function doLogin() {
    const email = document.getElementById('login-email')?.value;
    const pass = document.getElementById('login-password')?.value;
    const user = VALID_USERS.find(u => u.email === email && u.password === pass);
    
    if (user) {
        localStorage.setItem('session', JSON.stringify(user));
        activityTracker.addActivity(user, 'logged in', '');
        window.location = 'dashboard.html';
    } else {
        document.getElementById('login-error').style.display = 'block';
    }
}

// ---------- INIT ----------
async function init() {
    const path = window.location.pathname.split('/').pop() || 'index.html';
    
    if (path === 'dashboard.html') {
        // Check login
        const user = getSessionUser();
        if (!user) {
            window.location = 'index.html';
            return;
        }
        
        // Show loading
        document.getElementById('dashboard-container').innerHTML = '<div style="text-align:center; padding:50px;">Loading Dashboard...</div>';
        
        // Initialize Firebase
        await initFirebase();
        
        // Load and render
        await refreshDashboard();
    } else {
        document.getElementById('login-btn')?.addEventListener('click', doLogin);
        document.getElementById('login-password')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') doLogin();
        });
    }
}

// Tab sync
window.addEventListener('storage', (e) => {
    if (e.key === 'leadmanager_sync' && window.location.pathname.includes('dashboard.html')) {
        refreshDashboard();
    }
});

// Start
document.addEventListener('DOMContentLoaded', init);
