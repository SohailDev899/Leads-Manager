// ---------- CONFIGURATION ----------
const VALID_USERS = [
    { email: 'sohail@lead.co', password: 'alpha', name: 'Sohail', telegramId: '1935946442', color: '#FF6B6B' },
    { email: 'angad@lead.co', password: 'beta', name: 'Angad', telegramId: '7312373408', color: '#4ECDC4' },
    { email: 'kishan@lead.co', password: 'gamma', name: 'Kishan', telegramId: '1757459881', color: '#A890FE' }
];

const TELEGRAM_BOT_TOKEN = '8591307982:AAEc2CGvK1a2hk5aO9prS1HAhw3AhjxNpTc';
const STATUS_OPTIONS = ['Interested', 'Not Interested', 'Follow Up', 'No Response'];

// 🔥 APNA FIREBASE CONFIG YAHAN DALO
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
    'Vadodara', 'Guwahati', 'Chandigarh', 'Ajmer', 'Other'
];

// ---------- FIREBASE INITIALIZATION ----------
let db = null;
let firebaseReady = false;

function initFirebase() {
    return new Promise((resolve) => {
        if (window.firebase) {
            db = firebase.firestore();
            firebaseReady = true;
            console.log('✅ Firebase already ready');
            resolve();
            return;
        }

        const appScript = document.createElement('script');
        appScript.src = 'https://www.gstatic.com/firebasejs/8.10.0/firebase-app.js';
        appScript.onload = () => {
            const firestoreScript = document.createElement('script');
            firestoreScript.src = 'https://www.gstatic.com/firebasejs/8.10.0/firebase-firestore.js';
            firestoreScript.onload = () => {
                firebase.initializeApp(firebaseConfig);
                db = firebase.firestore();
                firebaseReady = true;
                console.log('🔥 Firebase ready!');
                resolve();
            };
            document.head.appendChild(firestoreScript);
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
            time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
        };
        
        this.activities.push(activity);
        this.saveActivities();
        return activity;
    }

    getActivityHTML() {
        const recent = [...this.activities].reverse().slice(0, 5);
        return `
            <div style="background:white; border-radius:16px; margin-bottom:24px; border:1px solid #eef2f6; overflow:hidden;">
                <div style="padding:16px 20px; background:#f8fafd; border-bottom:1px solid #eef2f6; font-weight:600; color:#0a2540;">
                    📋 Live Activity Feed
                </div>
                <div style="padding:12px;">
                    ${recent.map(a => `
                        <div style="padding:8px 0; border-bottom:1px solid #f0f4f9; font-size:13px; display:flex; align-items:center; gap:8px;">
                            <span style="width:8px; height:8px; background:${a.userColor}; border-radius:50%; display:inline-block;"></span>
                            <span style="color:${a.userColor}; font-weight:600;">${a.user}</span>
                            <span style="color:#5b6f87;">${a.action}</span>
                            <span style="color:#1e293b;">${a.details}</span>
                            <span style="color:#94a3b8; margin-left:auto; font-size:11px;">${a.time}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
}

const activityTracker = new ActivityTracker();

// ---------- CLOUD STORAGE ----------
async function saveLeadsToFirebase(leads) {
    if (!firebaseReady || !db) return;
    try {
        const batch = db.batch();
        leads.forEach(lead => {
            const ref = db.collection('leads').doc(lead.id);
            batch.set(ref, lead, { merge: true });
        });
        await batch.commit();
    } catch (error) {
        console.error('Firebase error:', error);
    }
}

async function loadLeadsFromFirebase() {
    if (!firebaseReady || !db) return null;
    try {
        const snapshot = await db.collection('leads').get();
        const leads = [];
        snapshot.forEach(doc => leads.push(doc.data()));
        return leads;
    } catch (error) {
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

// ---------- RENDER DASHBOARD (1000249774.png DESIGN) ----------
function renderDashboard(user, leads, activeTab = 'today', activeCity = 'all') {
    // Date grouping
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const thisWeek = new Date(today);
    thisWeek.setDate(thisWeek.getDate() - 7);
    
    const groups = { today: [], yesterday: [], thisWeek: [], older: [] };
    
    leads.forEach(lead => {
        const leadDate = new Date(lead.createdAt || lead.updatedAt || Date.now());
        leadDate.setHours(0, 0, 0, 0);
        
        if (leadDate.getTime() === today.getTime()) groups.today.push(lead);
        else if (leadDate.getTime() === yesterday.getTime()) groups.yesterday.push(lead);
        else if (leadDate > thisWeek) groups.thisWeek.push(lead);
        else groups.older.push(lead);
    });
    
    // Filter by city
    let filteredLeads = [];
    if (activeTab === 'all') {
        filteredLeads = activeCity === 'all' ? leads : leads.filter(l => l.city === activeCity);
    } else {
        filteredLeads = activeCity === 'all' ? groups[activeTab] : groups[activeTab].filter(l => l.city === activeCity);
    }
    
    // Cities for filter
    const cities = ['all', ...new Set(leads.map(l => l.city).filter(Boolean))];
    
    // Totals
    const totalBudget = leads.reduce((sum, l) => sum + (parseInt(l.budget) || 0), 0);
    const todayCount = groups.today.length;
    
    // Table rows
    let tableRows = '';
    
    // Date separator for today
    if (activeTab === 'all' || activeTab === 'today') {
        if (groups.today.length > 0) {
            tableRows += `
                <tr style="background:#f8fafd;">
                    <td colspan="7" style="padding:12px 20px; font-weight:600; color:#0a2540;">
                        <span style="background:#1a3e6f; color:white; padding:4px 12px; border-radius:30px; font-size:12px; margin-right:10px;">TODAY</span>
                        ${groups.today.length} lead${groups.today.length > 1 ? 's' : ''}
                    </td>
                </tr>
            `;
            groups.today.forEach(lead => {
                if (activeCity === 'all' || lead.city === activeCity) {
                    tableRows += renderLeadRow(lead);
                }
            });
        }
    }
    
    // Yesterday
    if (activeTab === 'all' || activeTab === 'yesterday') {
        if (groups.yesterday.length > 0) {
            tableRows += `
                <tr style="background:#f8fafd;">
                    <td colspan="7" style="padding:12px 20px; font-weight:600; color:#0a2540;">
                        <span style="background:#64748b; color:white; padding:4px 12px; border-radius:30px; font-size:12px; margin-right:10px;">YESTERDAY</span>
                        ${groups.yesterday.length} lead${groups.yesterday.length > 1 ? 's' : ''}
                    </td>
                </tr>
            `;
            groups.yesterday.forEach(lead => {
                if (activeCity === 'all' || lead.city === activeCity) {
                    tableRows += renderLeadRow(lead);
                }
            });
        }
    }
    
    // This Week
    if (activeTab === 'all' || activeTab === 'thisWeek') {
        if (groups.thisWeek.length > 0) {
            tableRows += `
                <tr style="background:#f8fafd;">
                    <td colspan="7" style="padding:12px 20px; font-weight:600; color:#0a2540;">
                        <span style="background:#64748b; color:white; padding:4px 12px; border-radius:30px; font-size:12px; margin-right:10px;">THIS WEEK</span>
                        ${groups.thisWeek.length} lead${groups.thisWeek.length > 1 ? 's' : ''}
                    </td>
                </tr>
            `;
            groups.thisWeek.forEach(lead => {
                if (activeCity === 'all' || lead.city === activeCity) {
                    tableRows += renderLeadRow(lead);
                }
            });
        }
    }
    
    // Older
    if (activeTab === 'all' || activeTab === 'older') {
        if (groups.older.length > 0) {
            tableRows += `
                <tr style="background:#f8fafd;">
                    <td colspan="7" style="padding:12px 20px; font-weight:600; color:#0a2540;">
                        <span style="background:#64748b; color:white; padding:4px 12px; border-radius:30px; font-size:12px; margin-right:10px;">OLDER</span>
                        ${groups.older.length} lead${groups.older.length > 1 ? 's' : ''}
                    </td>
                </tr>
            `;
            groups.older.forEach(lead => {
                if (activeCity === 'all' || lead.city === activeCity) {
                    tableRows += renderLeadRow(lead);
                }
            });
        }
    }
    
    if (!tableRows) {
        tableRows = '<tr><td colspan="7" style="padding:40px; text-align:center; color:#94a3b8;">No leads in this section</td></tr>';
    }
    
    // Main HTML
    return `
        <div class="app-container" style="max-width:1400px; margin:0 auto; background:white; border-radius:20px; box-shadow:0 10px 30px -10px rgba(0,0,0,0.08); overflow:hidden;">
            <!-- Top Bar -->
            <div style="display:flex; align-items:center; justify-content:space-between; padding:16px 32px; background:white; border-bottom:1px solid #e9edf2;">
                <span style="font-weight:600; font-size:1.2rem; color:#0a2540;">📋 leadflow · live</span>
                <div style="display:flex; align-items:center; gap:24px;">
                    <span style="color:#5b6f87; font-size:0.9rem;">
                        <span style="color:${user.color};">${user.name}</span> (${user.email})
                    </span>
                    <button id="logoutBtn" style="background:none; border:1px solid #d0d9e3; padding:6px 16px; border-radius:40px; font-size:0.85rem; color:#3e5a76; cursor:pointer;">Log out</button>
                </div>
            </div>
            
            <!-- Main Content -->
            <div style="padding:32px;">
                <!-- Status Cards -->
                <div style="display:flex; gap:20px; margin-bottom:24px; flex-wrap:wrap;">
                    <div style="background:linear-gradient(135deg, #667eea 0%, #764ba2 100%); color:white; padding:20px 24px; border-radius:16px; flex:1; min-width:200px;">
                        <div style="font-size:0.9rem; text-transform:uppercase; opacity:0.9; margin-bottom:8px;">Total Leads</div>
                        <div style="font-size:2.5rem; font-weight:700; line-height:1.2;">${leads.length}</div>
                        <div style="font-size:0.9rem; opacity:0.8; margin-top:4px;">${todayCount} new today</div>
                    </div>
                    <div style="background:linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color:white; padding:20px 24px; border-radius:16px; flex:1; min-width:200px;">
                        <div style="font-size:0.9rem; text-transform:uppercase; opacity:0.9; margin-bottom:8px;">Total Budget</div>
                        <div style="font-size:2.5rem; font-weight:700; line-height:1.2;">₹${totalBudget.toLocaleString()}</div>
                        <div style="font-size:0.9rem; opacity:0.8; margin-top:4px;">Avg: ₹${leads.length ? Math.round(totalBudget/leads.length).toLocaleString() : 0}</div>
                    </div>
                </div>
                
                <!-- Status Bar -->
                <div style="background:#f0f9ff; padding:12px 20px; border-radius:40px; margin-bottom:24px; display:inline-flex; gap:24px; align-items:center;">
                    <span style="display:flex; align-items:center; gap:6px;"><span style="color:#10b981;">✅</span> Firebase: Connected</span>
                    <span style="display:flex; align-items:center; gap:6px;"><span style="color:#10b981;">✅</span> Telegram: Active</span>
                </div>
                
                <!-- Activity Feed -->
                ${activityTracker.getActivityHTML()}
                
                <!-- City Filters -->
                <div style="display:flex; gap:10px; margin-bottom:24px; flex-wrap:wrap;">
                    ${cities.map(c => `
                        <button class="city-filter" style="padding:8px 20px; border:1px solid #d4dee9; border-radius:40px; background:${activeCity === c ? '#1a3e6f' : 'white'}; color:${activeCity === c ? 'white' : '#1e293b'}; font-size:0.9rem; cursor:pointer; transition:all 0.2s;" onclick="window.location.hash='city=${c}'">
                            ${c === 'all' ? '🏢 All Cities' : `📍 ${c}`}
                        </button>
                    `).join('')}
                </div>
                
                <!-- Add Lead Form (Professional Design) -->
                <h2 style="font-size:1.5rem; font-weight:600; margin-bottom:20px; color:#0a2540;">Add New Lead</h2>
                <div style="background:#f9fbfd; border-radius:16px; padding:24px 32px; margin-bottom:32px; border:1px solid #e9edf2;">
                    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:16px;">
                        <div>
                            <label style="font-size:0.75rem; text-transform:uppercase; color:#5b6f87; font-weight:500; display:block; margin-bottom:4px;">Client Name *</label>
                            <input id="new-name" placeholder="Sohail" style="width:100%; padding:10px 12px; border:1px solid #d4dee9; border-radius:12px; font-size:0.9rem;">
                        </div>
                        <div>
                            <label style="font-size:0.75rem; text-transform:uppercase; color:#5b6f87; font-weight:500; display:block; margin-bottom:4px;">Business *</label>
                            <input id="new-business" placeholder="Tech Solutions" style="width:100%; padding:10px 12px; border:1px solid #d4dee9; border-radius:12px;">
                        </div>
                        <div>
                            <label style="font-size:0.75rem; text-transform:uppercase; color:#5b6f87; font-weight:500; display:block; margin-bottom:4px;">Phone *</label>
                            <input id="new-phone" placeholder="9876543210" style="width:100%; padding:10px 12px; border:1px solid #d4dee9; border-radius:12px;">
                        </div>
                        <div>
                            <label style="font-size:0.75rem; text-transform:uppercase; color:#5b6f87; font-weight:500; display:block; margin-bottom:4px;">City *</label>
                            <select id="new-city" onchange="toggleCustomCity(this)" style="width:100%; padding:10px 12px; border:1px solid #d4dee9; border-radius:12px; background:white;">
                                ${INDIAN_CITIES.map(c => `<option>${c}</option>`).join('')}
                            </select>
                            <input id="new-city-custom" style="display:none; margin-top:8px; padding:10px 12px; border:1px solid #d4dee9; border-radius:12px;" placeholder="Enter city name">
                        </div>
                        <div>
                            <label style="font-size:0.75rem; text-transform:uppercase; color:#5b6f87; font-weight:500; display:block; margin-bottom:4px;">Budget (₹)</label>
                            <input id="new-budget" type="number" placeholder="50000" style="width:100%; padding:10px 12px; border:1px solid #d4dee9; border-radius:12px;">
                        </div>
                        <div>
                            <label style="font-size:0.75rem; text-transform:uppercase; color:#5b6f87; font-weight:500; display:block; margin-bottom:4px;">Pages</label>
                            <input id="new-pages" type="number" value="1" style="width:100%; padding:10px 12px; border:1px solid #d4dee9; border-radius:12px;">
                        </div>
                        <div>
                            <label style="font-size:0.75rem; text-transform:uppercase; color:#5b6f87; font-weight:500; display:block; margin-bottom:4px;">Requirements</label>
                            <input id="new-requirements" placeholder="E-commerce, Payment" style="width:100%; padding:10px 12px; border:1px solid #d4dee9; border-radius:12px;">
                        </div>
                        <div>
                            <label style="font-size:0.75rem; text-transform:uppercase; color:#5b6f87; font-weight:500; display:block; margin-bottom:4px;">Status</label>
                            <select id="new-status" style="width:100%; padding:10px 12px; border:1px solid #d4dee9; border-radius:12px; background:white;">
                                ${STATUS_OPTIONS.map(s => `<option>${s}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label style="font-size:0.75rem; text-transform:uppercase; color:#5b6f87; font-weight:500; display:block; margin-bottom:4px;">Note</label>
                            <input id="new-note" placeholder="Any notes" style="width:100%; padding:10px 12px; border:1px solid #d4dee9; border-radius:12px;">
                        </div>
                        <div style="display:flex; align-items:flex-end;">
                            <button id="addLeadBtn" style="background:#1a3e6f; color:white; border:none; padding:12px 28px; border-radius:40px; font-weight:500; font-size:0.95rem; cursor:pointer; white-space:nowrap;">+ Add Lead</button>
                        </div>
                    </div>
                </div>
                
                <!-- Tabs -->
                <div style="display:flex; gap:12px; margin-bottom:24px; border-bottom:2px solid #e9edf2; padding-bottom:12px; flex-wrap:wrap;">
                    ${['today', 'yesterday', 'thisWeek', 'older', 'all'].map(t => `
                        <button class="tab-btn" style="padding:8px 24px; background:none; border:none; font-size:0.95rem; font-weight:500; color:${activeTab === t ? '#1a3e6f' : '#64748b'}; cursor:pointer; position:relative; ${activeTab === t ? 'background:#e8edf5; border-radius:40px;' : ''}" onclick="window.location.hash='tab=${t}'">
                            ${t} <span style="background:${activeTab === t ? 'rgba(26,62,111,0.1)' : '#e2e8f0'}; padding:2px 10px; border-radius:30px; font-size:0.75rem; margin-left:6px;">${t === 'all' ? leads.length : groups[t].length}</span>
                        </button>
                    `).join('')}
                </div>
                
                <!-- Leads Table -->
                <div style="overflow-x:auto; border-radius:18px; border:1px solid #eef2f6; background:white;">
                    <table style="width:100%; border-collapse:collapse; min-width:1000px; font-size:0.9rem;">
                        <thead>
                            <tr style="background:#f8fafd;">
                                <th style="padding:16px 20px; text-align:left; font-weight:600; color:#2d425b;">Client & City</th>
                                <th style="padding:16px 20px; text-align:left; font-weight:600; color:#2d425b;">Business</th>
                                <th style="padding:16px 20px; text-align:left; font-weight:600; color:#2d425b;">Phone</th>
                                <th style="padding:16px 20px; text-align:left; font-weight:600; color:#2d425b;">Status</th>
                                <th style="padding:16px 20px; text-align:left; font-weight:600; color:#2d425b;">Budget</th>
                                <th style="padding:16px 20px; text-align:left; font-weight:600; color:#2d425b;">Added By</th>
                                <th style="padding:16px 20px; text-align:left; font-weight:600; color:#2d425b;">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

function renderLeadRow(lead) {
    const addedBy = VALID_USERS.find(u => u.email === lead.createdBy) || { name: 'Unknown', color: '#64748b' };
    
    return `
        <tr data-id="${lead.id}" style="border-bottom:1px solid #eef2f6;">
            <td style="padding:16px 20px;">
                <div><strong>${lead.name}</strong></div>
                <div style="display:inline-flex; align-items:center; gap:4px; background:#f0f9ff; color:#0369a1; padding:4px 12px; border-radius:30px; font-size:0.8rem; margin-top:4px;">
                    <span>📍</span> ${lead.city}
                </div>
                <div style="font-size:0.7rem; color:#94a3b8; margin-top:4px;">Added: ${new Date(lead.createdAt).toLocaleDateString()}</div>
            </td>
            <td style="padding:16px 20px;">${lead.business || ''}</td>
            <td style="padding:16px 20px;">${lead.phone || ''}</td>
            <td style="padding:16px 20px;">
                <select onchange="updateLeadField('${lead.id}', 'status', this.value)" style="padding:8px 12px; border-radius:30px; border:1px solid #cbd5e1; background:white; font-size:0.85rem;">
                    ${STATUS_OPTIONS.map(s => `<option ${lead.status === s ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
            </td>
            <td style="padding:16px 20px;">
                <span style="font-weight:600; color:#0f2c4f;">₹${lead.budget || 0}</span>
                <div style="font-size:0.8rem; color:#64748b;">Pages: ${lead.pages || 1}</div>
            </td>
            <td style="padding:16px 20px; color:${addedBy.color};">${addedBy.name}</td>
            <td style="padding:16px 20px;">
                <div style="display:flex; gap:8px;">
                    <a href="tel:${lead.phone}" style="display:inline-flex; align-items:center; gap:4px; background:#eef3fa; color:#1f3a68; padding:6px 14px; border-radius:40px; text-decoration:none; font-size:0.85rem; border:1px solid #cbd6e4;">📞 Call</a>
                    <button onclick="deleteLead('${lead.id}')" style="background:#fee8e8; color:#b91c1c; border:1px solid #f5c2c2; padding:6px 14px; border-radius:40px; cursor:pointer; font-size:0.85rem;">🗑️ Delete</button>
                </div>
            </td>
        </tr>
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
    if (!confirm('Delete this lead?')) return;
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
        alert('Name, Phone and City are required!');
        return;
    }
    
    const leads = await loadLeads();
    leads.push(data);
    await saveLeads(leads);
    
    activityTracker.addActivity(user, 'added', data.name);
    telegram.sendToAll(`🟢 ${user.name} added ${data.name}`, user.email);
    
    // Clear form
    document.getElementById('new-name').value = '';
    document.getElementById('new-business').value = '';
    document.getElementById('new-phone').value = '';
    document.getElementById('new-city').value = INDIAN_CITIES[0];
    document.getElementById('new-city-custom').style.display = 'none';
    document.getElementById('new-budget').value = '';
    document.getElementById('new-pages').value = '1';
    document.getElementById('new-requirements').value = '';
    document.getElementById('new-status').value = STATUS_OPTIONS[0];
    document.getElementById('new-note').value = '';
    
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
        params.get('tab') || 'today',
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
        const user = getSessionUser();
        if (!user) {
            window.location = 'index.html';
            return;
        }
        
        document.getElementById('dashboard-container').innerHTML = '<div style="text-align:center; padding:50px;">Loading Dashboard...</div>';
        
        await initFirebase();
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