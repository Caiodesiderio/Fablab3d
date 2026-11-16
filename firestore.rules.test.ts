import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const rulesContent = fs.readFileSync('firestore.rules', 'utf8');

test('firestore.rules includes default-deny catch-all and rules_version 2', () => {
  assert.match(rulesContent, /rules_version\s*=\s*'2';/);
  assert.match(rulesContent, /match \/\{document=\*\*\} \{\s*allow read, write: if false;\s*\}/);
});

test('firestore.rules covers all collections in firebase-blueprint.json', () => {
  const blueprint = JSON.parse(fs.readFileSync('firebase-blueprint.json', 'utf8'));
  const paths = Object.keys(blueprint.firestore);
  assert.ok(paths.includes('/print_logs/{logId}'));
  assert.ok(paths.includes('/people/{personId}'));
  assert.ok(paths.includes('/admins/{uid}'));
  assert.match(rulesContent, /match \/print_logs\/\{logId\}/);
  assert.match(rulesContent, /match \/people\/\{personId\}/);
  assert.match(rulesContent, /match \/admins\/\{uid\}/);
});

test('firestore.rules enforces email_verified, strict schema keys, and request.time', () => {
  assert.match(rulesContent, /request\.auth\.token\.email_verified == true/);
  assert.match(rulesContent, /data\.keys\(\)\.hasAll\(/);
  assert.match(rulesContent, /data\.keys\(\)\.hasOnly\(/);
  assert.match(rulesContent, /incoming\(\)\.createdAt == request\.time/);
  assert.match(rulesContent, /isValidId\(/);
  assert.match(rulesContent, /Creality LD-006/);
});
