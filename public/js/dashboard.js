// ============================================================
// Dashboard logic: check auth, load "my reports", submit new reports
// ============================================================

// --- Guard: confirm the user is actually logged in before showing anything ---
// This is a UX nicety, NOT the real security boundary - the real
// enforcement happens server-side via requireAuth on every API route.
// Even if this check were skipped entirely, the API would still refuse
// unauthenticated requests.
async function checkAuth() {
    try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
            window.location.href = '/login.html';
            return null;
        }
        const data = await res.json();
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

async function loadMyReports() {
    const res = await fetch('/api/incidents');
    const data = await res.json();
    const tbody = document.getElementById('reportsBody');
    tbody.innerHTML = '';

    if (!data.incidents || data.incidents.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5">No reports yet.</td></tr>';
        return;
    }

    data.incidents.forEach(inc => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${escapeHtml(inc.title)}</td>
            <td>${escapeHtml(inc.category)}</td>
            <td class="severity-${inc.severity}">${escapeHtml(inc.severity)}</td>
            <td class="status-${inc.status}">${escapeHtml(inc.status)}</td>
            <td>${new Date(inc.created_at).toLocaleString()}</td>
        `;
        tbody.appendChild(tr);
    });
}

document.getElementById('reportForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const messageEl = document.getElementById('formMessage');
    messageEl.textContent = '';

    const payload = {
        title: document.getElementById('title').value,
        category: document.getElementById('category').value,
        severity: document.getElementById('severity').value,
        description: document.getElementById('description').value,
        reporter_phone: document.getElementById('reporter_phone').value,
        reporter_national_id: document.getElementById('reporter_national_id').value,
        location: document.getElementById('location').value,
        reporter_gender: document.getElementById('reporter_gender').value,
        reporter_age: document.getElementById('reporter_age').value
    };

    try {
        const res = await fetch('/api/incidents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (!res.ok) {
            const errText = data.errors
                ? data.errors.map(er => er.msg).join(', ')
                : (data.error || 'Could not submit report.');
            messageEl.style.color = '#c0392b';
            messageEl.textContent = errText;
            return;
        }

        messageEl.style.color = '#27ae60';
        messageEl.textContent = 'Report submitted.';
        document.getElementById('reportForm').reset();
        loadMyReports();
    } catch (err) {
        messageEl.style.color = '#c0392b';
        messageEl.textContent = 'Could not reach the server.';
    }
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login.html';
});

// --- Init ---
(async () => {
    const user = await checkAuth();
    if (!user) return;
    document.getElementById('userLabel').textContent = `${user.full_name} (${user.role})`;
    loadMyReports();
})();