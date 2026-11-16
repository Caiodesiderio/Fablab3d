# Security Specification: Lab 3D Filament Control

## 1. Data Invariants
1. **Authenticated & Verified Writes**: No unauthenticated or unverified (`email_verified == false`) client may read, list, create, update, or delete records in `print_logs`, `people`, or `admins`.
2. **Strict Schema Enforcement**: Every `print_logs` and `people` document must match exact required and allowed key sets (`hasAll` + `hasOnly`) with explicit string length bounds, numeric ranges (`0 < grams <= 50000`, `0 < durationHours <= 500`), and enum validation (`machine`, `material`, `visibility`).
3. **Temporal Integrity**: `createdAt` must strictly equal `request.time` on creation and remain immutable on update.
4. **Identity Integrity**: `createdByUid` must strictly equal `request.auth.uid` on creation and remain immutable on update.
5. **Path Hardening**: All document IDs (`logId`, `personId`, `uid`) must match `^[a-zA-Z0-9_\-]+$` and be at most 128 characters.
6. **Privilege Escalation Prevention**: Non-admin clients cannot write to `/admins/{uid}` or modify records owned by other users.

## 2. The "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated Write**: `POST /print_logs/log1` with `auth == null`.
2. **Unverified Email Spoof**: `POST /print_logs/log1` with `auth.token.email == 'cd.chaves2005@gmail.com'` and `auth.token.email_verified == false`.
3. **Identity Spoofing**: `POST /print_logs/log1` with `createdByUid: 'other-user-uid'` != `request.auth.uid`.
4. **Shadow / Ghost Field Injection**: `POST /print_logs/log1` including extra field `isAdmin: true` or `approved: true`.
5. **Client Timestamp Tampering**: `POST /print_logs/log1` with `createdAt: '2020-01-01T00:00:00Z'` instead of server timestamp (`request.time`).
6. **Invalid Machine Enum**: `POST /print_logs/log1` with `machine: 'Unknown Printer 9000'`.
7. **Invalid Material Enum**: `POST /print_logs/log1` with `material: 'Unobtanium'`.
8. **Negative or Zero Grams / Hours**: `POST /print_logs/log1` with `grams: -50` or `grams: 0` or `durationHours: 0` or `durationHours: 999`.
9. **Resource Exhaustion (1MB String)**: `POST /print_logs/log1` with `project` > 120 chars or `personId` > 128 chars.
10. **Path ID Poisoning**: `POST /print_logs/invalid$id/slash` with illegal characters in document ID.
11. **Non-Owner Update / Delete**: User B attempts `UPDATE` or `DELETE` on `/print_logs/log_owned_by_A`.
12. **Self-Assigned Admin Escalation**: Non-admin user attempts `CREATE` on `/admins/<own_uid>` with `{ role: 'admin' }`.
