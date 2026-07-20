-- Add per-project currency.
-- Existing rows default to 'USD'; users can change it per-project at any time.
-- Changing the currency only affects display — it never converts the budget amount.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD';
