# BUG-014: titles Missing created_at Column

**Sprint:** 5 | **Severity:** ⚠️ Medium | **Status:** ✅ Fixed

## Discovery
**How found:** Live test — `fetchTitlesForGame()` orders by `created_at`. Column missing, query returns undefined.

## Root Cause
Fourth instance of missing `created_at`. Pattern is systemic — initial schema didn't include it on titles table.

## Fix
`008_fix_sprint5_bugs.sql`: `ALTER TABLE titles ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();`
