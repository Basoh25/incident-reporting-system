document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const messageEl = document.getElementById('message');
    messageEl.textContent = '';

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();

        if (!res.ok) {
            messageEl.textContent = data.error || 'Login failed.';
            return;
        }

        // Redirect based on role - admins see the dashboard,
        // regular users see the report form.
        if (data.user.role === 'admin') {
            window.location.href = '/admin-dashboard.html';
        } else {
            window.location.href = '/dashboard.html';
        }
    } catch (err) {
        messageEl.textContent = 'Could not reach the server.';
    }
});
