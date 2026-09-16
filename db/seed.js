// ============================================================
// Run once after creating the schema:  node db/seed.js
// Creates one admin account so you can log in immediately.
// The password is hashed HERE with bcrypt - never stored as plain text.
// ============================================================
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

async function seed() {
    const adminEmail = 'admin@example.com';
    const adminPassword = 'Admin@123'; // change after first login in a real deployment
    const hash = await bcrypt.hash(adminPassword, 10);

    try {
        const [existing] = await pool.query(
            'SELECT id FROM users WHERE email = ?',
            [adminEmail]
        );

        if (existing.length > 0) {
            console.log('Admin already exists, skipping.');
        } else {
            await pool.query(
                `INSERT INTO users (full_name, email, password_hash, role)
                 VALUES (?, ?, ?, ?)`,
                ['System Admin', adminEmail, hash, 'admin']
            );
            console.log('Admin created:');
            console.log('  email:    admin@example.com');
            console.log('  password: Admin@123');
            console.log('  (log in, then treat this like any real credential)');
        }
    } catch (err) {
        console.error('Seed failed:', err.message);
    } finally {
        await pool.end();
    }
}

seed();
