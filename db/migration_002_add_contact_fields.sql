-- ============================================================
-- MIGRATION 002
-- Adds reporter_phone and reporter_national_id directly onto
-- each incident report (captured at time of reporting, not
-- just once on the user's profile). Required at the application
-- layer (see routes/incidents.js validation) - added as NULL-able
-- here so the migration doesn't fail against existing rows.
-- ============================================================
USE incident_reporting_system;

ALTER TABLE incidents
    ADD COLUMN reporter_phone VARCHAR(20) NULL AFTER reporter_age,
    ADD COLUMN reporter_national_id VARCHAR(30) NULL AFTER reporter_phone;
