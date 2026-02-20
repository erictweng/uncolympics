# BUG-015: Title Engine Uses Object.entries on Array (Title Names Become Indices)

**Sprint:** 5 | **Severity:** 🔴 Critical | **Status:** ✅ Fixed

## Discovery
**How found:** Code review during test writing. `title_definitions` in DB is a JSON array, but `titles.ts` iterates with `Object.entries()`. On an array, this yields `["0", {...}], ["1", {...}]` — the key (used as `titleName`) becomes "0", "1", "2" instead of "Sniper", "Emotional Support", etc.

## Impact
Every title saved to the DB would have `title_name = "0"`, `"1"`, `"2"` instead of the actual title name. The title reveal screen would show numbers instead of names. **Completely breaks the core feature.**

## Fix
Updated `src/lib/titles.ts`:
- Detect if `titleDefinitions` is array or object
- Iterate with `for...of` on array (or `Object.values()` on object)
- Read `titleName` from `def.name` field, not the iteration key
- Also handle both `def.isFunny` and `def.is_funny` (DB uses camelCase)

## Lessons
1. **Always verify the actual data shape from the DB.** The code assumed a keyed object, the DB stored an array.
2. **Code review caught this before it hit production.** Test-driven development wins again.
