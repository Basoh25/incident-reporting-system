-- ============================================================
-- MIGRATION 001
-- Adds: phone_number (users), location, reporter_gender,
--       reporter_age (incidents).
-- Run this ONCE against your existing database - it does not
-- recreate any tables, only adds columns to what already exists.
-- ============================================================
USE incident_reporting_system;

ALTER TABLE users
    ADD COLUMN phone_number VARCHAR(20) NULL AFTER email;

ALTER TABLE incidents
    ADD COLUMN location VARCHAR(150) NULL AFTER description,
    ADD COLUMN reporter_gender ENUM('male', 'female', 'other', 'prefer_not_to_say') NULL AFTER location,
    ADD COLUMN reporter_age INT NULL AFTER reporter_gender;
