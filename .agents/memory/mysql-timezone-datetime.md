---
name: MySQL timezone & DATETIME format
description: MySQL server local timezone is 4h behind UTC; NOW() returns wrong time; DATETIME columns reject ISO 8601
---

## Rule
Never use MySQL `NOW()` for date comparisons or timestamp values. MySQL's server timezone is UTC-4 relative to real UTC (i.e. `NOW()` = real time minus 4 hours). Always use `UTC_TIMESTAMP()` for filtering, and pass JS-generated timestamps as `?` parameters.

## DATETIME column format
MySQL `DATETIME` columns do NOT accept ISO 8601 format (`2026-06-15T07:37:01.552Z`). They require `YYYY-MM-DD HH:MM:SS`. Convert with:
```js
function toMysqlDatetime(iso) {
  return iso.replace('T', ' ').replace(/\.\d+Z?$/, '').replace('Z', '');
}
```

## Why
Discovered when feed posts were always clustered at "4h ago": `DATE_SUB(NOW(), INTERVAL X MINUTE)` placed posts at MySQL-time, not real UTC. Also caused `createPost()` to silently fall back to the file store with "Incorrect datetime value: '2026-06-15T07:37:01.552Z'" errors.

## How to apply
- All WHERE clauses with date comparisons: use `UTC_TIMESTAMP()` (not `NOW()`)
- All INSERT/UPDATE statements with timestamp values: calculate in JS and pass as `?` parameter
- `DATE_SUB`, `DATE_ADD`, `INTERVAL` used as computed values: use `UTC_TIMESTAMP()` base
