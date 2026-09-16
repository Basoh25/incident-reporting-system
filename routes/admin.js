// ============================================================
// ADMIN ROUTES: /api/admin/*
// Every route here requires requireRole('admin') - a regular
// 'user' hitting any of these gets a 403, even if they know the
// exact URL. This is the cross-user visibility boundary: only
// here can anyone see incidents that aren't their own.
// ============================================================
const express = require('express');
const { body, validationResult } = require('express-validator');
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Apply admin-only access control to EVERY route in this file.
router.use(requireAuth, requireRole('admin'));

// ------------------------------------------------------------
// GET /api/admin/incidents
// Full list of ALL incidents across ALL users, with reporter
// and assigned-admin names joined in. Supports optional
// ?status= and ?severity= filters for the dashboard UI.
// ------------------------------------------------------------
router.get('/incidents', async (req, res) => {
    const { status, severity } = req.query;
    let sql = `
        SELECT i.id, i.title, i.category, i.severity, i.status,
               i.created_at, i.updated_at,
               reporter.full_name AS reporter_name,
               admin.full_name AS assigned_admin_name
        FROM incidents i
        JOIN users reporter ON reporter.id = i.reporter_id
        LEFT JOIN users admin ON admin.id = i.assigned_admin_id
        WHERE 1=1
    `;
    const params = [];

    if (status) {
        sql += ' AND i.status = ?';
        params.push(status);
    }
    if (severity) {
        sql += ' AND i.severity = ?';
        params.push(severity);
    }
    sql += ' ORDER BY i.created_at DESC';

    try {
        const [rows] = await pool.query(sql, params);
        res.json({ incidents: rows });
    } catch (err) {
        console.error('Admin list incidents error:', err);
        res.status(500).json({ error: 'Could not load incidents.' });
    }
});

// ------------------------------------------------------------
// GET /api/admin/incidents/:id
// Full detail view for one incident, including reporter contact
// info and full audit log - things a regular user's own view
// intentionally leaves out.
// ------------------------------------------------------------
router.get('/incidents/:id', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT i.*, reporter.full_name AS reporter_name, reporter.email AS reporter_email,
                    reporter.phone_number AS reporter_phone,
                    admin.full_name AS assigned_admin_name
             FROM incidents i
             JOIN users reporter ON reporter.id = i.reporter_id
             LEFT JOIN users admin ON admin.id = i.assigned_admin_id
             WHERE i.id = ?`,
            [req.params.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Incident not found.' });
        }

        const [logs] = await pool.query(
            `SELECT l.*, u.full_name AS actor_name
             FROM incident_logs l
             JOIN users u ON u.id = l.actor_id
             WHERE l.incident_id = ?
             ORDER BY l.created_at ASC`,
            [req.params.id]
        );

        res.json({ incident: rows[0], logs });
    } catch (err) {
        console.error('Admin view incident error:', err);
        res.status(500).json({ error: 'Could not load incident.' });
    }
});

// ------------------------------------------------------------
// PATCH /api/admin/incidents/:id/status
// Change an incident's status and log it. This is also where
// "assign to me" happens - if the incident has no admin
// assigned yet, taking any action auto-assigns the acting admin.
// ------------------------------------------------------------
router.patch('/incidents/:id/status',
    [
        body('status').isIn(['new', 'under_review', 'investigating', 'resolved', 'closed']),
        body('note').optional().trim().escape()
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const incidentId = req.params.id;
        const { status, note } = req.body;
        const adminId = req.session.user.id;

        const connection = await pool.getConnection();
        try {
            const [existingRows] = await connection.query(
                'SELECT id, assigned_admin_id FROM incidents WHERE id = ?',
                [incidentId]
            );
            if (existingRows.length === 0) {
                connection.release();
                return res.status(404).json({ error: 'Incident not found.' });
            }

            await connection.beginTransaction();

            const assignedAdminId = existingRows[0].assigned_admin_id || adminId;

            await connection.query(
                `UPDATE incidents SET status = ?, assigned_admin_id = ? WHERE id = ?`,
                [status, assignedAdminId, incidentId]
            );

            await connection.query(
                `INSERT INTO incident_logs (incident_id, actor_id, action, note)
                 VALUES (?, ?, 'status_changed', ?)`,
                [incidentId, adminId, note || `Status changed to ${status}.`]
            );

            await connection.commit();
            res.json({ message: 'Status updated.' });
        } catch (err) {
            await connection.rollback();
            console.error('Update status error:', err);
            res.status(500).json({ error: 'Could not update status.' });
        } finally {
            connection.release();
        }
    }
);

// ------------------------------------------------------------
// GET /api/admin/reports/summary
// Basic security reporting - counts by status and by severity.
// This is the "Security reports" feature from the brief, kept
// intentionally simple: aggregate counts, no exports/PDFs, so
// it's achievable in the time you have.
// ------------------------------------------------------------
router.get('/reports/summary', async (req, res) => {
    try {
        const [byStatus] = await pool.query(
            `SELECT status, COUNT(*) AS count FROM incidents GROUP BY status`
        );
        const [bySeverity] = await pool.query(
            `SELECT severity, COUNT(*) AS count FROM incidents GROUP BY severity`
        );
        const [byCategory] = await pool.query(
            `SELECT category, COUNT(*) AS count FROM incidents GROUP BY category`
        );
        const [totalRow] = await pool.query(
            `SELECT COUNT(*) AS total FROM incidents`
        );

        res.json({
            total: totalRow[0].total,
            byStatus,
            bySeverity,
            byCategory
        });
    } catch (err) {
        console.error('Reports summary error:', err);
        res.status(500).json({ error: 'Could not load report summary.' });
    }
});

module.exports = router;