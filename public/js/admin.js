// ============================================================
// Admin dashboard logic: load summary, load/filter all incidents,
// view detail + audit trail, update status.
// ============================================================

let currentIncidentId = null;

async function checkAuth() {
    try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
            window.location.href = '/login.html';
            return null;
        }
        const data = await res.json();
        if (data.user.role !== 'admin') {
            // A regular user landing here gets bounced - the API would
            // block them anyway (403 on every /api/admin/* route), but
            // this avoids showing them a broken-looking page.
            window.location.href = '/dashboard.html';
            return null;
        }
        return data.user;
    } catch (err) {
        window.location.href = '/login.html';
        return null;
    }
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

async function loadSummary() {
    const res = await fetch('/api/admin/reports/summary');
    const data = await res.json();
    const container = document.getElementById('summaryCards');
    container.innerHTML = `<div class="summary-card"><div class="count">${data.total}</div><div class="label">Total</div></div>`;

    data.byStatus.forEach(row => {
        container.innerHTML += `<div class="summary-card"><div class="count">${row.count}</div><div class="label">${row.status.replace('_',' ')}</div></div>`;
    });
}

async function loadIncidents() {
    const status = document.getElementById('statusFilter').value;
    const severity = document.getElementById('severityFilter').value;
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (severity) params.append('severity', severity);

    const res = await fetch('/api/admin/incidents?' + params.toString());
    const data = await res.json();
    const tbody = document.getElementById('reportsBody');
    tbody.innerHTML = '';

    if (!data.incidents || data.incidents.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8">No incidents found.</td></tr>';
        return;
    }

    data.incidents.forEach(inc => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${escapeHtml(inc.title)}</td>
            <td>${escapeHtml(inc.reporter_name)}</td>
            <td>${escapeHtml(inc.category)}</td>
            <td class="severity-${inc.severity}">${escapeHtml(inc.severity)}</td>
            <td class="status-${inc.status}">${escapeHtml(inc.status)}</td>
            <td>${inc.assigned_admin_name ? escapeHtml(inc.assigned_admin_name) : '-'}</td>
            <td>${new Date(inc.created_at).toLocaleDateString()}</td>
            <td><button class="viewBtn" data-id="${inc.id}">View</button></td>
        `;
        tbody.appendChild(tr);
    });

    document.querySelectorAll('.viewBtn').forEach(btn => {
        btn.addEventListener('click', () => viewIncident(btn.dataset.id));
    });
}

async function viewIncident(id) {
    const res = await fetch(`/api/admin/incidents/${id}`);
    if (!res.ok) {
        alert('Could not load incident.');
        return;
    }
    const data = await res.json();
    currentIncidentId = id;

    const inc = data.incident;
    document.getElementById('detailContent').innerHTML = `
        <p><strong>Title:</strong> ${escapeHtml(inc.title)}</p>
        <p><strong>Reporter:</strong> ${escapeHtml(inc.reporter_name)} (${escapeHtml(inc.reporter_email)})</p>
        <p><strong>Contact Phone (this report):</strong> ${escapeHtml(inc.reporter_phone)}</p>
        <p><strong>National ID / Passport:</strong> ${escapeHtml(inc.reporter_national_id)}</p>
        <p><strong>Category:</strong> ${escapeHtml(inc.category)}</p>
        <p><strong>Severity:</strong> ${escapeHtml(inc.severity)}</p>
        <p><strong>Location:</strong> ${inc.location ? escapeHtml(inc.location) : 'Not provided'}</p>
        <p><strong>Reporter Gender:</strong> ${inc.reporter_gender ? escapeHtml(inc.reporter_gender) : 'Not provided'}</p>
        <p><strong>Reporter Age:</strong> ${inc.reporter_age ? escapeHtml(String(inc.reporter_age)) : 'Not provided'}</p>
        <p><strong>Description:</strong> ${escapeHtml(inc.description)}</p>
        <p><strong>Current Status:</strong> ${escapeHtml(inc.status)}</p>
    `;
    document.getElementById('newStatus').value = inc.status;

    const logsList = document.getElementById('logsList');
    logsList.innerHTML = '';
    data.logs.forEach(log => {
        const li = document.createElement('li');
        li.textContent = `[${new Date(log.created_at).toLocaleString()}] ${log.actor_name}: ${log.action}${log.note ? ' - ' + log.note : ''}`;
        logsList.appendChild(li);
    });

    document.getElementById('detailPanel').classList.remove('hidden');
    document.getElementById('detailPanel').scrollIntoView({ behavior: 'smooth' });
}

document.getElementById('statusForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = document.getElementById('newStatus').value;
    const note = document.getElementById('statusNote').value;

    const res = await fetch(`/api/admin/incidents/${currentIncidentId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, note })
    });

    if (!res.ok) {
        alert('Could not update status.');
        return;
    }

    document.getElementById('statusNote').value = '';
    await viewIncident(currentIncidentId); // refresh detail + log
    await loadIncidents();
    await loadSummary();
});

document.getElementById('closeDetailBtn').addEventListener('click', () => {
    document.getElementById('detailPanel').classList.add('hidden');
    currentIncidentId = null;
});

document.getElementById('statusFilter').addEventListener('change', loadIncidents);
document.getElementById('severityFilter').addEventListener('change', loadIncidents);

document.getElementById('logoutBtn').addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login.html';
});

// --- Init ---
(async () => {
    const user = await checkAuth();
    if (!user) return;
    document.getElementById('userLabel').textContent = `${user.full_name} (${user.role})`;
    loadSummary();
    loadIncidents();
})();