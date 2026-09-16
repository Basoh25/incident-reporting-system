// ============================================================
// AUTH ROUTES: /api/auth/*
// ============================================================
const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// ------------------------------------------------------------
// POST /api/auth/register
// Public. Anyone can create a 'user' role account.
// Nobody can self-register as 'admin' - that's intentional.
// Admin accounts are only created via db/seed.js or by an
// existing admin (a feature you could add later, not required
// for this scope).
// ------------------------------------------------------------
router.post('/register',
    [
        body('full_name').trim().isLength({ min: 2 }).escape(),
        body('email').isEmail().normalizeEmail(),
        body('phone_number').optional({ checkFalsy: true }).trim().isLength({ max: 20 }).escape(),
        body('password').isLength({ min: 8 })
            .withMessage('Password must be at least 8 characters.')
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { full_name, email, password, phone_number } = req.body;

        try {
            const [existing] = await pool.query(
                'SELECT id FROM users WHERE email = ?',
                [email]
            );
            if (existing.length > 0) {
                return res.status(409).json({ error: 'An account with that email already exists.' });
            }

            // Hash BEFORE storing. Never store plaintext, ever.
            const password_hash = await bcrypt.hash(password, 10);

            await pool.query(
                `INSERT INTO users (full_name, email, phone_number, password_hash, role)
                 VALUES (?, ?, ?, ?, 'user')`,
                [full_name, email, phone_number || null, password_hash]
            );

            res.status(201).json({ message: 'Account created. You can now log in.' });
        } catch (err) {
            console.error('Register error:', err.message);
            res.status(500).json({ error: 'Something went wrong. Please try again.' });
        }
    }
);

// ------------------------------------------------------------
// POST /api/auth/login
// Compares submitted password against the stored bcrypt hash.
// On success, stores a MINIMAL user object in the session -
// never the password hash itself.
// ------------------------------------------------------------
router.post('/login',
    [
        body('email').isEmail().normalizeEmail(),
        body('password').notEmpty()
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password } = req.body;

        try {
            const [rows] = await pool.query(
                'SELECT id, full_name, email, password_hash, role, is_active FROM users WHERE email = ?',
                [email]
            );

            // Deliberately vague error message - don't reveal whether
            // the email exists or the password was wrong. That distinction
            // helps an attacker enumerate valid accounts.
            const genericError = { error: 'Invalid email or password.' };

            if (rows.length === 0) {
                return res.status(401).json(genericError);
            }

            const user = rows[0];

            if (!user.is_active) {
                return res.status(403).json({ error: 'This account has been disabled.' });
            }

            const passwordMatches = await bcrypt.compare(password, user.password_hash);
            if (!passwordMatches) {
                return res.status(401).json(genericError);
            }

            // Store only what's needed in the session - never the hash.
            req.session.user = {
                id: user.id,
                full_name: user.full_name,
                email: user.email,
                role: user.role
            };

            res.json({
                message: 'Logged in.',
                user: req.session.user
            });
        } catch (err) {
            console.error('Login error:', err);
            res.status(500).json({ error: 'Something went wrong. Please try again.' });
        }
    }
);

// ------------------------------------------------------------
// POST /api/auth/logout
// Destroys the session SERVER-SIDE (removes the row from the
// 'sessions' table). This is real revocation - the session ID
// becomes useless immediately, even if someone captured the
// cookie beforehand.
// ------------------------------------------------------------
router.post('/logout', requireAuth, (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Could not log out. Try again.' });
        }
        res.clearCookie('incident_system_sid');
        res.json({ message: 'Logged out.' });
    });
});

// ------------------------------------------------------------
// GET /api/auth/me
// Lets the frontend check "am I logged in, and as who" without
// exposing anything sensitive.
// ------------------------------------------------------------
router.get('/me', requireAuth, (req, res) => {
    res.json({ user: req.session.user });
});

module.exports = router;