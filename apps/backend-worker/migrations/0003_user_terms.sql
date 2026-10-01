-- The terms of service / privacy policy version a user agreed to on registration, and when.
-- NULL for users registered before the terms existed.
ALTER TABLE users ADD COLUMN terms_version TEXT;
ALTER TABLE users ADD COLUMN terms_agreed_at TEXT;
