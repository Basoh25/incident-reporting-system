// ============================================================
// Main application entry point.
// Sets up: MySQL-backed sessions, route mounting, static files.
// ============================================================
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const pool = require('./config/db');

const authRoutes = require('./routes/auth');
const incidentRoutes = require('./routes/incidents');
const adminRoutes = require('./routes/admin');

const app = express();

// ------------------------------------------------------------
// Parse incoming form/JSON data
// ------------------------------------------------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ------------------------------------------------------------
// Session store: sessions live in MySQL (the 'sessions' table),
// not in server memory. This means:
//   - sessions survive a server restart
//   - logout can be a REAL server-side revocation
//   - it demonstrates the "database security" skill directly
// ------------------------------------------------------------
const sessionStore = new MySQLStore({}, pool);

app.use(session({
    key: 'incident_system_sid',
    secret: process.env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,     // JS in the browser cannot read this cookie (mitigates XSS token theft)
        secure: false,      // set to true ONLY when served over HTTPS (not localhost)
        maxAge: 1000 * 60 * 60 * 2 // 2 hours
    }
}));

// ------------------------------------------------------------
// Static frontend files (login page, dashboard, css, js)
// ------------------------------------------------------------
app.use(express.static('public'));

// ------------------------------------------------------------
// Routes
// ------------------------------------------------------------
app.use('/api/auth', authRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/admin', adminRoutes);

// ------------------------------------------------------------
// Fallback 404 for unmatched API routes
// ------------------------------------------------------------
app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Not found' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running: http://localhost:${PORT}`);
});
