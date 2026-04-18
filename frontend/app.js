const API_URL = '';
let currentUser = null;
let currentProduct = null;
let allProducts = []; // Cache for filtering

// Routing logic
let isLoginMode = false; // Always force Registration first

const authTitle = document.getElementById('auth-title');
const authSubmitBtn = document.getElementById('auth-submit-btn');
const authSwitchAction = document.getElementById('auth-switch-action');
const authSwitchText = document.getElementById('auth-switch-text');
const authForm = document.getElementById('auth-form');

// Toggle between Login & Register (strictly enforcing Registration first naturally in design)
authSwitchAction.addEventListener('click', () => {
    isLoginMode = !isLoginMode;
    if(isLoginMode) {
        authTitle.textContent = "Welcome Back";
        authSubmitBtn.textContent = "Login";
        authSwitchText.innerHTML = "Need an account? <span id='auth-switch-action'>Register here</span>";
    } else {
        authTitle.textContent = "Create Account";
        authSubmitBtn.textContent = "Register";
        authSwitchText.innerHTML = "Already have an account? <span id='auth-switch-action'>Login here</span>";
    }
    // Re-bind listener because innerHTML wipes the element
    document.getElementById('auth-switch-action').addEventListener('click', authSwitchAction.onclick);
    document.getElementById('auth-error').textContent = "";
});

// Authentication Submit
authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const endpoint = isLoginMode ? '/login' : '/register';
    
    try {
        const res = await fetch(`${API_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        
        if (res.ok) {
            // Success! Load Dashboard
            currentUser = isLoginMode ? data.user : { id: data.userId, username, role: 'user' };
            // If they just registered, log them right in
            document.getElementById('current-user-display').textContent = `👤 ${currentUser.username}`;
            if(currentUser.role === 'admin' || username === 'admin') {
                document.getElementById('admin-add-btn').style.display = 'block';
            }
            showView('main-layout');
            loadProducts();
        } else {
            document.getElementById('auth-error').textContent = data.error || data.message;
        }
    } catch(e) {
        document.getElementById('auth-error').textContent = "Server connection failed.";
    }
});

// Logout
document.getElementById('logout-btn').addEventListener('click', () => {
    currentUser = null;
    showView('auth-view');
    authForm.reset();
});

// --- View Router ---
function showView(viewId) {
    document.getElementById('auth-view').classList.add('hidden');
    document.getElementById('main-layout').classList.add('hidden');
    document.getElementById(viewId).classList.remove('hidden');
}

function showDashboard() {
    document.getElementById('detail-view').classList.add('hidden');
    document.getElementById('dashboard-view').classList.remove('hidden');
    loadProducts();
}

function showDetail(productStr) {
    const p = JSON.parse(decodeURIComponent(productStr));
    currentProduct = p;
    document.getElementById('dashboard-view').classList.add('hidden');
    document.getElementById('detail-view').classList.remove('hidden');
    
    document.getElementById('detail-title').textContent = p.name;
    document.getElementById('detail-desc').textContent = p.description;
    
    const badge = document.getElementById('detail-status');
    badge.textContent = p.status;
    badge.className = `status-badge status-${p.status}`;
    
    document.getElementById('avg-rating-huge').textContent = parseFloat(p.avg_rating).toFixed(1);
    
    loadFeedback(p.id);
}

// --- Data Fetching ---
async function loadProducts() {
    const container = document.getElementById('product-grid');
    try {
        const res = await fetch(`${API_URL}/products`);
        allProducts = await res.json();
        renderProducts(allProducts);
    } catch(e) {
        container.innerHTML = "<p>Failed to load products.</p>";
    }
}

function renderProducts(products) {
    const container = document.getElementById('product-grid');
    if (products.length === 0) {
        container.innerHTML = "<p style='color: var(--text-secondary); width: 100%;'>No products found in this category.</p>";
        return;
    }
    
    container.innerHTML = products.map(p => {
        const pStr = encodeURIComponent(JSON.stringify(p));
        return `
        <div class="product-card glass-panel" onclick="showDetail('${pStr}')">
            <div class="card-head">
                <h3>${p.name}</h3>
                <span class="status-badge status-${p.status}">${p.status}</span>
            </div>
            <p class="card-desc">${p.description}</p>
            <div class="card-meta">
                <span>${p.category}</span>
                <span>${p.total_reviews} Reviews • ${parseFloat(p.avg_rating).toFixed(1)} ★</span>
            </div>
        </div>
        `;
    }).join('');
}

// Category Filter Chips Logic
document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', (e) => {
        // Toggle Active Styling
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        e.target.classList.add('active');
        
        // Filter Data
        const category = e.target.textContent.trim();
        if (category === 'All') {
            renderProducts(allProducts);
        } else {
            const filtered = allProducts.filter(p => p.category === category);
            renderProducts(filtered);
        }
    });
});

async function loadFeedback(productId) {
    const list = document.getElementById('feedback-list');
    try {
        const res = await fetch(`${API_URL}/feedback?product_id=${productId}`);
        const feedback = await res.json();
        
        document.getElementById('feedback-count').textContent = `(${feedback.length})`;
        
        if(feedback.length === 0) {
            list.innerHTML = "<p>No feedback yet.</p>";
            return;
        }
        
        list.innerHTML = feedback.map(f => `
            <div class="feedback-item">
                <div class="fb-head">
                    <span class="fb-user">${f.username}</span>
                    <span class="fb-stars">${'★'.repeat(f.rating)}${'☆'.repeat(5 - f.rating)}</span>
                </div>
                <p class="fb-text">${f.feedback_text}</p>
                <div class="fb-actions">
                    <button onclick="upvote(${f.id})">👍 Helpful (${f.helpful_votes})</button>
                </div>
            </div>
        `).join('');
    } catch(e) {
        list.innerHTML = "<p>Error loading feedback.</p>";
    }
}

async function upvote(feedbackId) {
    try {
        await fetch(`${API_URL}/feedback/${feedbackId}/upvote`, { method: 'POST' });
        loadFeedback(currentProduct.id); // reload list
    } catch(e) {
        console.error("Failed to upvote");
    }
}

// --- Modals ---
function openFeedbackModal() { document.getElementById('feedback-modal').classList.remove('hidden'); }
function openAdminModal() { document.getElementById('admin-modal').classList.remove('hidden'); }
function closeModals() { 
    document.getElementById('feedback-modal').classList.add('hidden'); 
    document.getElementById('admin-modal').classList.add('hidden'); 
}

// Form Submissions
document.getElementById('feedback-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const rate = document.querySelector('input[name="rate"]:checked');
    const text = document.getElementById('feedback-text').value;
    
    if(!rate) return alert("Select a rating");
    
    const payload = {
        user_id: currentUser.id,
        product_id: currentProduct.id,
        feedback_text: text,
        rating: parseInt(rate.value)
    };
    
    await fetch(`${API_URL}/feedback`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
    });
    
    e.target.reset();
    closeModals();
    loadProducts(); // to update dashboard meta stats
    loadFeedback(currentProduct.id);
});

document.getElementById('admin-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
        name: document.getElementById('prod-name').value,
        category: document.getElementById('prod-cat').value,
        status: document.getElementById('prod-status').value,
        description: document.getElementById('prod-desc').value
    };
    
    await fetch(`${API_URL}/products`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
    });
    
    e.target.reset();
    closeModals();
    loadProducts();
});
