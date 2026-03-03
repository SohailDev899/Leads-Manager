// ---------- CONFIGURATION ----------
const VALID_USERS = [
    { email: 'sohail@lead.co', password: 'alpha', name: 'Sohail', telegramId: '1935946442', color: '#FF6B6B' },
    { email: 'angad@lead.co', password: 'beta', name: 'Angad', telegramId: '6825198399', color: '#4ECDC4' },
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
            console.log('✅ Firebase ready');
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
            <div style="background:white; border-radius:12px; margin-bottom:24px; border:1px solid #eaeef2; overflow:hidden;">
                <div style="padding:12px 16px; background:#f8fafc; border-bottom:1px solid #eaeef2; font-weight:600; color:#1a2639; font-size:14px;">
                    📋 Live Activity Feed
                </div>
                <div style="padding:8px;">
                    ${recent.map(a => `
                        <div style="padding:8px 12px; border-bottom:1px solid #f0f4f9; font-size:13px; display:flex; align-items:center; gap:8px;">
                            <span style="width:8px; height:8px; background:${a.userColor}; border-radius:50%; display:inline-block;"></span>
                            <span style="color:${a.userColor}; font-weight:600;">${a.user}</span>
                            <span style="color:#4a5568;">${a.action}</span>
                            <span style="color:#718096;">${a.details}</span>
                            <span style="color:#a0aec0; margin-left:auto; font-size:11px;">${a.time}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
}

const activityTracker = new ActivityTracker();

// ---------- CLOUD STORAGE ----------
async function deleteLeadFromFirebase(leadId) {
    if (!firebaseReady || !db) return;
    try {
        await db.collection('leads').doc(leadId).delete();
        console.log('✅ Firebase delete successful for ID:', leadId);
        return true;
    } catch (error) {
        console.error('Firebase delete error:', error);
        return false;
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
        console.error('Firebase save error:', error);
    }
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

// ========== FIXED DELETE FUNCTION ==========
window.deleteLead = async function(id, name) {
    if (!id) {
        alert('Error: Lead ID not found');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete "${name}"?`)) {
        return;
    }
    
    const user = getSessionUser();
    if (!user) {
        alert('Please login again');
        window.location = 'index.html';
        return;
    }
    
    try {
        await deleteLeadFromFirebase(id);
        
        const localLeads = loadLeadsFromLocal();
        const newLocalLeads = localLeads.filter(lead => lead.id !== id);
        saveLeadsToLocal(newLocalLeads);
        
        activityTracker.addActivity(user, 'deleted', name);
        telegram.sendToAll(`🔴 ${user.name} deleted: ${name}`, user.email);
        
        alert('✅ Lead deleted successfully!');
        await refreshDashboard();
        
    } catch (error) {
        console.error('❌ Delete error:', error);
        alert('Error: ' + error.message);
    }
};

// ---------- UPDATE LEAD ----------
window.updateLead = async function(id, field, value) {
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

// ---------- ADD LEAD ----------
async function addLead() {
    const user = getSessionUser();
    
    const data = {
        id: Date.now() + '-' + Math.random().toString(36).substr(2, 8),
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

// ========== FIXED RENDER DASHBOARD WITH WORKING TABS ==========
function renderDashboard(user, leads, activeTab = 'today', activeCity = 'all') {
    // Date grouping
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    
    const groups = { today: [], yesterday: [], thisWeek: [], older: [] };
    
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    leads.forEach(lead => {
        const leadDate = new Date(lead.createdAt).toDateString();
        const leadDateTime = new Date(lead.createdAt).getTime();
        
        if (leadDate === today) groups.today.push(lead);
        else if (leadDate === yesterday) groups.yesterday.push(lead);
        else if (leadDateTime > weekAgo.getTime()) groups.thisWeek.push(lead);
        else groups.older.push(lead);
    });
    
    // Filter by city and tab
    let filteredLeads = [];
    if (activeTab === 'all') {
        filteredLeads = activeCity === 'all' ? leads : leads.filter(l => l.city === activeCity);
    } else {
        const groupLeads = groups[activeTab] || [];
        filteredLeads = activeCity === 'all' ? groupLeads : groupLeads.filter(l => l.city === activeCity);
    }
    
    // Totals
    const totalBudget = leads.reduce((sum, l) => sum + (parseInt(l.budget) || 0), 0);
    const avgBudget = leads.length ? Math.round(totalBudget/leads.length) : 0;
    const todayCount = groups.today.length;
    
    // Cities for filter
    const cities = ['All Cities', ...new Set(leads.map(l => l.city).filter(Boolean))];
    
    return `
        <div style="max-width:1200px; margin:0 auto; background:white; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            <!-- Top Bar -->
            <div style="display:flex; justify-content:space-between; align-items:center; padding:16px 24px; border-bottom:1px solid #eaeef2;">
                <div style="font-size:20px; font-weight:600; color:#1a2639;">📋 leadflow · live</div>
                <div style="display:flex; align-items:center; gap:20px;">
                    <span style="color:#4a5568;"><span style="color:${user.color};">${user.name}</span> (${user.email})</span>
                    <button id="logoutBtn" style="background:none; border:1px solid #d0d9e3; padding:6px 16px; border-radius:20px; color:#4a5568; cursor:pointer;">Log out</button>
                </div>
            </div>
            
            <!-- Main Content -->
            <div style="padding:24px;">
                <!-- Telegram Status -->
                <div style="background:#e6f7e6; color:#2e7d32; padding:8px 16px; border-radius:20px; display:inline-block; margin-bottom:24px; font-size:14px;">
                    📱 Telegram Notifications Active
                </div>
                
                <!-- Activity Feed -->
                ${activityTracker.getActivityHTML()}
                
                <!-- Stats Cards -->
                <div style="display:flex; gap:20px; margin-bottom:32px;">
                    <div style="flex:1; background:linear-gradient(135deg, #667eea 0%, #764ba2 100%); color:white; padding:20px; border-radius:12px;">
                        <div style="font-size:14px; opacity:0.9; margin-bottom:8px;">TOTAL LEADS</div>
                        <div style="font-size:36px; font-weight:700;">${leads.length}</div>
                        <div style="font-size:14px; opacity:0.8; margin-top:4px;">${todayCount} new today</div>
                    </div>
                    <div style="flex:1; background:linear-gradient(135deg, #f6ad55 0%, #dd6b20 100%); color:white; padding:20px; border-radius:12px;">
                        <div style="font-size:14px; opacity:0.9; margin-bottom:8px;">TOTAL BUDGET</div>
                        <div style="font-size:36px; font-weight:700;">₹${totalBudget.toLocaleString()}</div>
                        <div style="font-size:14px; opacity:0.8; margin-top:4px;">Avg: ₹${avgBudget.toLocaleString()}</div>
                    </div>
                </div>
                
                <!-- City Filters -->
                <div style="display:flex; gap:12px; margin-bottom:24px; flex-wrap:wrap;">
                    ${cities.map(city => {
                        const cityValue = city === 'All Cities' ? 'all' : city;
                        return `
                            <button class="city-filter" data-city="${cityValue}" style="padding:8px 20px; border:1px solid #d0d9e3; border-radius:20px; background:${(city === 'All Cities' && activeCity === 'all') || city === activeCity ? '#1a3e6f' : 'white'}; color:${(city === 'All Cities' && activeCity === 'all') || city === activeCity ? 'white' : '#1a2639'}; cursor:pointer;">
                                ${city === 'All Cities' ? '🏢 All Cities' : `📍 ${city}`}
                            </button>
                        `;
                    }).join('')}
                </div>
                
                <!-- Add Lead Form -->
                <div style="margin-bottom:32px;">
                    <h2 style="font-size:20px; font-weight:600; margin-bottom:16px; color:#1a2639;">Add New Lead</h2>
                    
                    <div style="display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:16px; margin-bottom:16px;">
                        <div><label style="font-size:12px; color:#718096;">CLIENT NAME *</label><input id="new-name" placeholder="Sohail" style="width:100%; padding:10px; border:1px solid #d0d9e3; border-radius:8px;"></div>
                        <div><label style="font-size:12px; color:#718096;">BUSINESS *</label><input id="new-business" placeholder="Tech Solutions" style="width:100%; padding:10px; border:1px solid #d0d9e3; border-radius:8px;"></div>
                        <div><label style="font-size:12px; color:#718096;">PHONE *</label><input id="new-phone" placeholder="9876543210" style="width:100%; padding:10px; border:1px solid #d0d9e3; border-radius:8px;"></div>
                        <div>
                            <label style="font-size:12px; color:#718096;">CITY *</label>
                            <select id="new-city" onchange="toggleCustomCity(this)" style="width:100%; padding:10px; border:1px solid #d0d9e3; border-radius:8px;">
                                ${INDIAN_CITIES.map(c => `<option>${c}</option>`).join('')}
                            </select>
                            <input id="new-city-custom" style="display:none; margin-top:8px; padding:10px; border:1px solid #d0d9e3; border-radius:8px;" placeholder="Enter city">
                        </div>
                    </div>
                    
                    <div style="display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:16px; margin-bottom:16px;">
                        <div><label style="font-size:12px; color:#718096;">BUDGET (₹)</label><input id="new-budget" type="number" placeholder="50000" style="width:100%; padding:10px; border:1px solid #d0d9e3; border-radius:8px;"></div>
                        <div><label style="font-size:12px; color:#718096;">PAGES</label><input id="new-pages" type="number" value="1" style="width:100%; padding:10px; border:1px solid #d0d9e3; border-radius:8px;"></div>
                        <div><label style="font-size:12px; color:#718096;">REQUIREMENTS</label><input id="new-requirements" placeholder="E-commerce" style="width:100%; padding:10px; border:1px solid #d0d9e3; border-radius:8px;"></div>
                        <div><label style="font-size:12px; color:#718096;">STATUS</label><select id="new-status" style="width:100%; padding:10px; border:1px solid #d0d9e3; border-radius:8px;">${STATUS_OPTIONS.map(s => `<option>${s}</option>`).join('')}</select></div>
                    </div>
                    
                    <div style="display:grid; grid-template-columns:3fr 1fr; gap:16px;">
                        <div><label style="font-size:12px; color:#718096;">NOTE</label><input id="new-note" placeholder="Any notes" style="width:100%; padding:10px; border:1px solid #d0d9e3; border-radius:8px;"></div>
                        <div style="display:flex; align-items:flex-end;"><button id="addLeadBtn" style="width:100%; background:#1a3e6f; color:white; border:none; padding:10px; border-radius:8px; cursor:pointer;">+ Add Lead</button></div>
                    </div>
                </div>
                
                <!-- Tabs with data attributes -->
                <div style="display:flex; gap:16px; margin-bottom:24px; border-bottom:1px solid #eaeef2; padding-bottom:8px; flex-wrap:wrap;">
                    <button class="tab-btn" data-tab="today" style="padding:8px 0; background:none; border:none; font-size:14px; color:${activeTab === 'today' ? '#1a3e6f' : '#718096'}; font-weight:${activeTab === 'today' ? '600' : '400'}; border-bottom:${activeTab === 'today' ? '2px solid #1a3e6f' : 'none'}; cursor:pointer;">Today (${groups.today.length})</button>
                    <button class="tab-btn" data-tab="yesterday" style="padding:8px 0; background:none; border:none; font-size:14px; color:${activeTab === 'yesterday' ? '#1a3e6f' : '#718096'}; font-weight:${activeTab === 'yesterday' ? '600' : '400'}; border-bottom:${activeTab === 'yesterday' ? '2px solid #1a3e6f' : 'none'}; cursor:pointer;">Yesterday (${groups.yesterday.length})</button>
                    <button class="tab-btn" data-tab="thisWeek" style="padding:8px 0; background:none; border:none; font-size:14px; color:${activeTab === 'thisWeek' ? '#1a3e6f' : '#718096'}; font-weight:${activeTab === 'thisWeek' ? '600' : '400'}; border-bottom:${activeTab === 'thisWeek' ? '2px solid #1a3e6f' : 'none'}; cursor:pointer;">This Week (${groups.thisWeek.length})</button>
                    <button class="tab-btn" data-tab="older" style="padding:8px 0; background:none; border:none; font-size:14px; color:${activeTab === 'older' ? '#1a3e6f' : '#718096'}; font-weight:${activeTab === 'older' ? '600' : '400'}; border-bottom:${activeTab === 'older' ? '2px solid #1a3e6f' : 'none'}; cursor:pointer;">Older (${groups.older.length})</button>
                    <button class="tab-btn" data-tab="all" style="padding:8px 0; background:none; border:none; font-size:14px; color:${activeTab === 'all' ? '#1a3e6f' : '#718096'}; font-weight:${activeTab === 'all' ? '600' : '400'}; border-bottom:${activeTab === 'all' ? '2px solid #1a3e6f' : 'none'}; cursor:pointer;">All (${leads.length})</button>
                </div>
                
                <!-- Table -->
                <div style="overflow-x:auto; border:1px solid #eaeef2; border-radius:8px;">
                    <table style="width:100%; border-collapse:collapse;">
                        <thead><tr style="background:#f8fafc;">
                            <th style="padding:12px; text-align:left;">Client & City</th>
                            <th style="padding:12px; text-align:left;">Business</th>
                            <th style="padding:12px; text-align:left;">Phone</th>
                            <th style="padding:12px; text-align:left;">Status</th>
                            <th style="padding:12px; text-align:left;">Budget</th>
                            <th style="padding:12px; text-align:left;">Requirements</th>
                            <th style="padding:12px; text-align:left;">Added By</th>
                            <th style="padding:12px; text-align:left;">Actions</th>
                        </tr></thead>
                        <tbody>
                            ${filteredLeads.length === 0 ? 
                                `<tr><td colspan="8" style="padding:40px; text-align:center; color:#718096;">No leads in this section</td></tr>` :
                                filteredLeads.map(lead => {
                                    const addedBy = VALID_USERS.find(u => u.email === lead.createdBy) || { name: 'Unknown', color: '#718096' };
                                    return `
                                    <tr data-id="${lead.id}" style="border-bottom:1px solid #eaeef2;">
                                        <td style="padding:12px;">
                                            <div>${lead.name}</div>
                                            <span style="background:#f0f9ff; color:#0369a1; padding:2px 8px; border-radius:12px; font-size:11px;">📍 ${lead.city}</span>
                                            <div style="font-size:10px; color:#a0aec0;">${new Date(lead.createdAt).toLocaleDateString()}</div>
                                        </td>
                                        <td style="padding:12px;">${lead.business || ''}</td>
                                        <td style="padding:12px;">${lead.phone || ''}</td>
                                        <td style="padding:12px;">
                                            <select onchange="updateLead('${lead.id}', 'status', this.value)" style="padding:4px 8px; border-radius:12px;">
                                                ${STATUS_OPTIONS.map(s => `<option ${lead.status === s ? 'selected' : ''}>${s}</option>`).join('')}
                                            </select>
                                        </td>
                                        <td style="padding:12px;">₹${lead.budget || 0}<br><small>Pages: ${lead.pages || 1}</small></td>
                                        <td style="padding:12px;">${lead.requirements || ''}</td>
                                        <td style="padding:12px; color:${addedBy.color};">${addedBy.name}</td>
                                        <td style="padding:12px;">
                                            <a href="tel:${lead.phone}" style="background:#eef3fa; color:#1f3a68; padding:4px 8px; border-radius:12px; text-decoration:none; margin-right:4px;">📞</a>
                                            <button onclick="deleteLead('${lead.id}', '${lead.name.replace(/'/g, "\\'")}')" style="background:#fee8e8; color:#b91c1c; border:1px solid #f5c2c2; padding:4px 8px; border-radius:12px; cursor:pointer;">🗑️</button>
                                        </td>
                                    </tr>
                                `}).join('')
                            }
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

// ========== FIXED EVENT HANDLERS ==========
function attachEvents() {
    // Tab clicks
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const tab = this.getAttribute('data-tab');
            if (tab) {
                window.location.hash = `tab=${tab}`;
                refreshDashboard();
            }
        });
    });
    
    // City filter clicks
    document.querySelectorAll('.city-filter').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const city = this.getAttribute('data-city');
            if (city) {
                window.location.hash = `city=${city}`;
                refreshDashboard();
            }
        });
    });
    
    // Logout
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        localStorage.removeItem('session');
        window.location = 'index.html';
    });
    
    // Add lead
    document.getElementById('addLeadBtn')?.addEventListener('click', addLead);
}

// ---------- REFRESH ----------
async function refreshDashboard() {
    const user = getSessionUser();
    if (!user) return;
    
    const leads = await loadLeads();
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    const activeTab = params.get('tab') || 'today';
    const activeCity = params.get('city') || 'all';
    
    document.getElementById('dashboard-container').innerHTML = renderDashboard(
        user, leads, activeTab, activeCity
    );
    
    attachEvents(); // Re-attach events after render
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
        
        document.getElementById('dashboard-container').innerHTML = '<div style="text-align:center; padding:50px;">Loading...</div>';
        
        await initFirebase();
        await refreshDashboard();
    } else {
        document.getElementById('login-btn')?.addEventListener('click', doLogin);
        document.getElementById('login-password')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') doLogin();
        });
    }
}

// Hash change bhi listen karo
window.addEventListener('hashchange', () => {
    if (window.location.pathname.includes('dashboard.html')) {
        refreshDashboard();
    }
});

// Tab sync
window.addEventListener('storage', (e) => {
    if (e.key === 'leadmanager_sync' && window.location.pathname.includes('dashboard.html')) {
        refreshDashboard();
    }
});

// Start
document.addEventListener('DOMContentLoaded', init);
