-- Migration 148: Add is_featured to series table
ALTER TABLE series ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;
