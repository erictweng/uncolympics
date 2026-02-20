# BUG-016: titles Missing DELETE Policy

**Sprint:** 5 | **Severity:** ⚠️ Medium | **Status:** ✅ Fixed

## Discovery
**How found:** Test cleanup — referee couldn't delete titles. Same pattern as BUG-005, 010.

## Fix
`008_fix_sprint5_bugs.sql`: Added referee-only DELETE policy on titles.

## Lessons
Fifth missing DELETE policy. This is now the #1 recurring bug category.
