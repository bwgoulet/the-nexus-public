import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync('../supabase/migrations/202608280001_add_director_reassignment.sql', 'utf8');

test('moves an unassigned director to the destination in one RPC transaction', () => {
  assert.match(migration, /update public\.teams\s+set director_user_id = requested_director_user_id/);
});

test('clears every old assignment when moving an assigned director', () => {
  assert.match(migration, /where director_user_id = requested_director_user_id\s+or/);
});

test('requires an explicit request before replacing a destination director', () => {
  assert.match(migration, /and not replace_destination_director then/);
  assert.match(migration, /id = requested_destination_team_id and replace_destination_director/);
});

test('rejects callers who are not moderators', () => {
  assert.match(migration, /id = auth\.uid\(\) and role = 'mod'/);
  assert.match(migration, /errcode = '42501'/);
});

test('prevents duplicate concurrent assignments with locking and a partial unique index', () => {
  assert.match(migration, /order by id\s+for update/);
  assert.match(migration, /create unique index if not exists teams_one_assignment_per_director/);
  assert.match(migration, /where director_user_id is not null/);
});
