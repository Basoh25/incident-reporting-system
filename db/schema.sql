-- ============================================================
-- Cybersecurity Incident Reporting System - Database Schema
-- ============================================================

CREATE DATABASE IF NOT EXISTS incident_reporting_system;
USE incident_reporting_system;

-- ------------------------------------------------------------
-- USERS
-- Passwords are NEVER stored in plaintext. We store a bcrypt
-- hash only. 'role' drives access control (see middleware).
-- ------------------------------------------------------------
CREATE TABLE users (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    full_name       VARCHAR(100)  NOT NULL,
    email           VARCHAR(150)  NOT NULL UNIQUE,
    phone_number    VARCHAR(20)   NULL,
    password_hash   VARCHAR(255)  NOT NULL,
    role            ENUM('user', 'admin') NOT NULL DEFAULT 'user',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- INCIDENTS
-- The core report table. reporter_id links to whoever filed it.
-- assigned_admin_id is nullable until an admin picks it up.
-- ------------------------------------------------------------
CREATE TABLE incidents (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    reporter_id         INT NOT NULL,
    title               VARCHAR(150) NOT NULL,
    description         TEXT NOT NULL,
    location            VARCHAR(150) NULL,
    reporter_gender     ENUM('male', 'female', 'other', 'prefer_not_to_say') NULL,
    reporter_age        INT NULL,
    reporter_phone      VARCHAR(20) NULL,
    reporter_national_id VARCHAR(30) NULL,
    category            ENUM('phishing', 'malware', 'unauthorized_access',
                              'data_leak', 'policy_violation', 'other')
                              NOT NULL DEFAULT 'other',
    severity            ENUM('low', 'medium', 'high', 'critical') NOT NULL DEFAULT 'low',
    status              ENUM('new', 'under_review', 'investigating',
                              'resolved', 'closed') NOT NULL DEFAULT 'new',
    assigned_admin_id   INT DEFAULT NULL,
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                              ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_incident_reporter
        FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_incident_admin
        FOREIGN KEY (assigned_admin_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- INCIDENT LOGS (audit trail)
-- Every meaningful action on an incident gets a row here.
-- This is what makes "tracking" demonstrable and gives you an
-- immutable-ish history to show in a viva.
-- ------------------------------------------------------------
CREATE TABLE incident_logs (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    incident_id   INT NOT NULL,
    actor_id      INT NOT NULL,
    action        VARCHAR(100) NOT NULL,   -- e.g. 'created', 'status_changed', 'assigned', 'comment_added'
    note          TEXT,
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_log_incident
        FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE,
    CONSTRAINT fk_log_actor
        FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- SESSIONS (used by express-mysql-session)
-- Lets us prove real session revocation on logout, and gives
-- you a genuine "database security" talking point.
-- ------------------------------------------------------------
CREATE TABLE sessions (
    session_id  VARCHAR(128) COLLATE utf8mb4_bin NOT NULL PRIMARY KEY,
    expires     INT(11) UNSIGNED NOT NULL,
    data        MEDIUMTEXT COLLATE utf8mb4_bin
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Seed a default admin so you have something to log in with.
-- Password below is 'Admin@123' - CHANGE before any real demo.
-- Hash generated with bcrypt, 10 rounds.
-- ------------------------------------------------------------
-- (Generated separately - see db/seed.js, run with `node db/seed.js`)