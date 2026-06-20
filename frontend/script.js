const API_URL = 'https://job-tracker-backend-0mwn.onrender.com';

// Protect this page - redirect to login if no token
const token = localStorage.getItem('token');
if (!token) {
    window.location.href = 'login.html';
}

// Theme Toggle
function toggleTheme() {
    const root = document.documentElement;
    const btn = document.querySelector('.theme-toggle');
    root.classList.toggle('light');

    if (root.classList.contains('light')) {
        btn.textContent = '🌙 Dark Mode';
    } else {
        btn.textContent = '☀️ Light Mode';
    }
}

// Filter
let currentFilter = 'All';
let jobs = [];

function filterJobs(status) {
    currentFilter = status;
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent === status) {
            btn.classList.add('active');
        }
    });
    renderJobs();
}

// Fetch all jobs from backend
async function fetchJobs() {
    try {
        const res = await fetch(`${API_URL}/jobs`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (res.status === 401) {
            // Token invalid/expired - send back to login
            localStorage.removeItem('token');
            window.location.href = 'login.html';
            return;
        }

        const data = await res.json();
        // Map backend _id to id so existing render/update/delete code works
        jobs = data.map(job => ({ ...job, id: job._id }));
        renderJobs();
        updateDashboard();
    } catch (err) {
        alert('Cannot connect to server. Is backend running?');
    }
}

// Add Job
async function addJob() {
    const company = document.getElementById('company').value.trim();
    const role = document.getElementById('role').value.trim();
    const date = document.getElementById('date-applied').value;
    const status = document.getElementById('status').value;
    const notes = document.getElementById('notes').value.trim();

    if (!company || !role || !date) {
        alert('Company, Role, and Date mandatory bro!');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/jobs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ company, role, date, status, notes })
        });

        if (!res.ok) {
            alert('Failed to add job.');
            return;
        }

        clearForm();
        fetchJobs();
    } catch (err) {
        alert('Cannot connect to server. Is backend running?');
    }
}

// Clear Form
function clearForm() {
    document.getElementById('company').value = '';
    document.getElementById('role').value = '';
    document.getElementById('date-applied').value = '';
    document.getElementById('status').value = 'Applied';
    document.getElementById('notes').value = '';
}

// Delete Job
async function deleteJob(id) {
    try {
        const res = await fetch(`${API_URL}/jobs/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!res.ok) {
            alert('Failed to delete job.');
            return;
        }

        fetchJobs();
    } catch (err) {
        alert('Cannot connect to server. Is backend running?');
    }
}

// Update Status
async function updateStatus(id, newStatus) {
    try {
        const res = await fetch(`${API_URL}/jobs/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status: newStatus })
        });

        if (!res.ok) {
            alert('Failed to update status.');
            return;
        }

        fetchJobs();
    } catch (err) {
        alert('Cannot connect to server. Is backend running?');
    }
}

// Render Jobs
function renderJobs() {
    const container = document.getElementById('jobs-container');
    if (!container) return;

    const filtered = currentFilter === 'All'
        ? jobs
        : jobs.filter(j => j.status === currentFilter);

    if (filtered.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding: 40px; color: var(--subtext);">
                ${currentFilter === 'All' 
                    ? 'No applications yet. Start applying bro! 💪' 
                    : `No ${currentFilter} applications yet!`}
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(job => `
        <div class="job-card">
            <div class="job-info">
                <h3>🏢 ${job.company}</h3>
                <p>💼 ${job.role} &nbsp;|&nbsp; 📅 ${job.date}</p>
                ${job.notes ? `<p>📝 ${job.notes}</p>` : ''}
            </div>
            <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                <span class="badge ${job.status}">${job.status}</span>
                <select onchange="updateStatus('${job.id}', this.value)" style="
                    background: var(--bg);
                    border: 1px solid var(--border);
                    color: var(--text);
                    border-radius: 6px;
                    padding: 4px 8px;
                    font-size: 0.78rem;
                    cursor: pointer;
                ">
                    <option ${job.status === 'Applied' ? 'selected' : ''}>Applied</option>
                    <option ${job.status === 'Interview' ? 'selected' : ''}>Interview</option>
                    <option ${job.status === 'Offer' ? 'selected' : ''}>Offer</option>
                    <option ${job.status === 'Rejected' ? 'selected' : ''}>Rejected</option>
                </select>
                <button class="delete-btn" onclick="deleteJob('${job.id}')">🗑️ Delete</button>
            </div>
        </div>
    `).join('');
}

// Dashboard Counts
function updateDashboard() {
    document.getElementById('total-count').textContent = jobs.length;
    document.getElementById('interview-count').textContent =
        jobs.filter(j => j.status === 'Interview').length;
    document.getElementById('offer-count').textContent =
        jobs.filter(j => j.status === 'Offer').length;
}

// Logout
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('name');
    window.location.href = 'login.html';
}

// Init
document.addEventListener('DOMContentLoaded', () => {
    fetchJobs();
});