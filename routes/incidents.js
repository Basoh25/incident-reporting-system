// ============================================================
// INCIDENT ROUTES: /api/incidents/*
// All routes here require a logged-in user (any role).
// Access control rule: a regular 'user' can only ever see or
// touch their OWN incidents. This is enforced server-side by
// filtering every query on reporter_id = the logged-in user's id
// — never by trusting an id the client sends.
// ============================================================
const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// ------------------------------------------------------------
// POST /api/incidents
// Create a new incident report. reporter_id is taken from the
// SESSION, never from the request body — a user cannot report
// an incident "as" someone else by editing the payload.
// ------------------------------------------------------------
router.post('/',
    requireAuth,
    [
        body('title').trim().isLength({ min: 5, max: 150 }).escape(),
        body('description').trim().isLength({ min: 10 }).escape(),
        body('category').isIn(['phishing', 'malware', 'unauthorized_access', 'data_leak', 'policy_violation', 'other']),
        body('severity').isIn(['low', 'medium', 'high', 'critical']),
        body('location').optional({ checkFalsy: true }).trim().isLength({ max: 150 }).escape(),
        body('reporter_gender').optional({ checkFalsy: true }).isIn(['male', 'female', 'other', 'prefer_not_to_say']),
        body('reporter_age').optional({ checkFalsy: true }).isInt({ min: 1, max: 120 }),
        body('reporter_phone').trim().notEmpty().withMessage('Phone number is required.')
            .isLength({ max: 20 }).escape(),
        body('reporter_national_id').trim().notEmpty().withMessage('National ID / passport number is required.')
            .isLength({ max: 30 }).escape()
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { title, description, category, severity, location, reporter_gender, reporter_age, reporter_phone, reporter_national_id } = req.body;
        const reporter_id = req.session.user.id; // from session, not client input

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const [result] = await connection.query(
                `INSERT INTO incidents (reporter_id, title, description, location, reporter_gender, reporter_age, reporter_phone, reporter_national_id, category, severity)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [reporter_id, title, description, location || null, reporter_gender || null, reporter_age || null, reporter_phone, reporter_national_id, category, severity]
            );

            const incidentId = result.insertId;

            // Audit trail entry - every incident starts with a 'created' log
            await connection.query(
                `INSERT INTO incident_logs (incident_id, actor_id, action, note)
                 VALUES (?, ?, 'created', 'Incident reported.')`,
                [incidentId, reporter_id]
            );

            await connection.commit();

            res.status(201).json({
                message: 'Incident reported successfully.',
                incidentId
            });
        } catch (err) {
            await connection.rollback();
            console.error('Create incident error:', err.message);
            res.status(500).json({ error: 'Could not submit report. Please try again.' });
        } finally {
            connection.release();
        }
    }
);

// ------------------------------------------------------------
// GET /api/incidents
// Lists incidents belonging to the LOGGED-IN user only.
// An admin hitting this same route also only sees their own
// reports (if they file any) - the full cross-user view lives
// under /api/admin, protected by requireRole('admin').
// ------------------------------------------------------------
router.get('/', requireAuth, async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT id, title, category, severity, status, created_at, updated_at
             FROM incidents
             WHERE reporter_id = ?
             ORDER BY created_at DESC`,
            [req.session.user.id]
        );
        res.json({ incidents: rows });
    } catch (err) {
        console.error('List incidents error:', err.message);
        res.status(500).json({ error: 'Could not load incidents.' });
    }
});

// ------------------------------------------------------------
// GET /api/incidents/:id
// View a single incident - but ONLY if it belongs to the
// logged-in user (or the user is an admin). This is the classic
// "insecure direct object reference" (IDOR) trap: without the
// reporter_id / role check below, any logged-in user could view
// ANY incident just by guessing/incrementing the id in the URL.
// ------------------------------------------------------------
router.get('/:id', requireAuth, async (req, res) => {
    const incidentId = req.params.id;

    try {
        const [rows] = await pool.query(
            `SELECT i.*, u.full_name AS reporter_name
             FROM incidents i
             JOIN users u ON u.id = i.reporter_id
             WHERE i.id = ?`,
            [incidentId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Incident not found.' });
        }

        const incident = rows[0];
        const isOwner = incident.reporter_id === req.session.user.id;
        const isAdmin = req.session.user.role === 'admin';

        // The core access control check for this route.
        if (!isOwner && !isAdmin) {
            return res.status(403).json({ error: 'You do not have permission to view this incident.' });
        }

        // Pull the audit trail alongside it
        const [logs] = await pool.query(
            `SELECT l.*, u.full_name AS actor_name
             FROM incident_logs l
             JOIN users u ON u.id = l.actor_id
             WHERE l.incident_id = ?
             ORDER BY l.created_at ASC`,
            [incidentId]
        );

        res.json({ incident, logs });
    } catch (err) {
        console.error('View incident error:', err.message);
        res.status(500).json({ error: 'Could not load incident.' });
    }
});

module.exports = router;