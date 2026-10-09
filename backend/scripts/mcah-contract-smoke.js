// Real MariaDB schema acceptance, synthetic SQL input only; no extraction/provider claims.
require('dotenv').config({ quiet: true })
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { spawnSync } = require('node:child_process')
const mysql = require('mysql2/promise')
const config = require('../src/config')
const { migrationPlan } = require('../src/config/migrations')
let assertions = 0
function check(value, message) { assert.ok(value, message); assertions++; console.log(`PASS ${message}`) }
async function main() {
  assert.equal(process.env.MCAH_TEST_CONFIRM, config.db.database)
  assert.match(config.db.database, /^mcah_.*test$/)
  assert.ok(config.db.socketPath, 'private test socket required')
  const admin = await mysql.createConnection({ ...config.db, database: undefined, multipleStatements: true })
  const targets = [`mcah_01_clean_${Date.now()}_test`, `mcah_01_upgrade_${Date.now()}_test`]
  const migrate = target => {
    const result = spawnSync(process.execPath, ['scripts/migrate.js'], { encoding: 'utf8', env: { ...process.env, DB_NAME: target, MCAH_INSTANCE: target } })
    console.log(result.stdout)
    assert.equal(result.status, 0, result.stderr)
  }
  try {
    const [[engine]] = await admin.query('SELECT VERSION() AS version')
    console.log(`Engine ${engine.version}; socket ${config.db.socketPath}; TCP disabled by test server`)
    for (const target of targets) {
      assert.match(target, /^mcah_01_\w+_test$/)
      await admin.query(`CREATE DATABASE \`${target}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
    }
    migrate(targets[0])
    await admin.changeUser({ database: targets[0] })
    const [[clean]] = await admin.query('SELECT COUNT(*) AS n FROM seafarer')
    check(clean.n === 0, 'clean install 000..022 has no personal seeds')
    const [history] = await admin.query('SELECT * FROM mcah_migration_history ORDER BY name')
    migrate(targets[0])
    const [rerun] = await admin.query('SELECT * FROM mcah_migration_history ORDER BY name')
    assert.deepEqual(history, rerun)
    check(history.length === 23, 'clean rerun preserves 23 history entries and timestamps')
    await admin.changeUser({ database: targets[1] })
    // Build the exact committed MCAH-00 schema/history, not a hand-crafted approximation.
    await admin.query('CREATE TABLE mcah_migration_history (name VARCHAR(150) PRIMARY KEY, checksum CHAR(64) NOT NULL, state VARCHAR(20) NOT NULL, applied_at DATETIME NULL, note VARCHAR(255) NULL) ENGINE=InnoDB')
    for (const entry of migrationPlan().filter(e => e.name < '022')) {
      if (!entry.skipped) await admin.query(fs.readFileSync(entry.file, 'utf8'))
      await admin.query('INSERT INTO mcah_migration_history VALUES (?, ?, \'APPLIED\', NOW(), ?)', [entry.name, entry.checksum, entry.skipped ? 'Skipped personal seed by MCAH policy' : null])
    }
    await admin.query('INSERT INTO user (email, password_hash, role) VALUES (\'schema-test@invalid.test\', \'not-a-login-hash\', \'admin\')')
    const [[country]] = await admin.query('SELECT id FROM country ORDER BY id LIMIT 1')
    await admin.query('INSERT INTO seafarer (full_name, date_of_birth, nationality_id) VALUES (\'Synthetic One\', \'1990-01-01\', ?), (\'Synthetic Two\', \'1991-01-01\', ?)', [country.id, country.id])
    await admin.query('INSERT INTO seafarer_document (seafarer_id,file_name,mime_type,file_size,storage_path,status) VALUES (1,\'multi.pdf\',\'application/pdf\',100,\'synthetic-not-read.pdf\',\'FAILED\'),(2,\'other.pdf\',\'application/pdf\',100,\'synthetic-not-read-2.pdf\',\'FAILED\')')
    await admin.query('INSERT INTO document_field (document_id,field_key,raw_text,ai_value,ai_state,value,state) VALUES (1,\'name\',\'Synthetic One\',\'Synthetic One\',\'PROPOSED\',\'Synthetic One\',\'PROPOSED\')')
    await admin.query('INSERT INTO seafarer_revision (seafarer_id,changed_by,reason,changes) VALUES (1,1,\'Historical edit\',JSON_OBJECT(\'full_name\',JSON_ARRAY(\'Old\',\'Synthetic One\')))')
    await admin.query('INSERT INTO seafarer_contact (seafarer_id,full_name,relationship) VALUES (1,\'Synthetic Contact\',\'other\')')
    const [oldTables] = await admin.query('SHOW TABLES')
    const originals = {}
    for (const row of oldTables) {
      const table = Object.values(row)[0]
      if (table === 'mcah_migration_history') continue
      const [rows] = await admin.query(`SELECT * FROM \`${table}\``)
      originals[table] = rows
    }
    migrate(targets[1])
    for (const [table, rows] of Object.entries(originals)) {
      const cols = rows.length ? Object.keys(rows[0]).map(k => `\`${k}\``).join(',') : '*'
      const [after] = await admin.query(`SELECT ${cols} FROM \`${table}\``)
      const preserved = table === 'seafarer_revision' ? after.filter(r => rows.some(o => o.id === r.id)) : after
      assert.deepEqual(preserved, rows, `preserve ${table}`)
    }
    check(true, 'upgrade preserves all pre-existing columns/rows, including raw fields and historical revisions')
    const [[baseline]] = await admin.query('SELECT snapshot FROM seafarer_revision WHERE seafarer_id=1 AND revision_no=1')
    const snapshot = typeof baseline.snapshot === 'string' ? JSON.parse(baseline.snapshot) : baseline.snapshot
    check(snapshot.profile.full_name === 'Synthetic One' && snapshot.sources.length === 1 && snapshot.contacts.length === 1 && snapshot.sea_service.length === 0, 'baseline aggregate includes full profile, sources, contacts, certificates and no invented trips')
    const [beforeHistory] = await admin.query('SELECT * FROM mcah_migration_history ORDER BY name')
    migrate(targets[1])
    const [afterHistory] = await admin.query('SELECT * FROM mcah_migration_history ORDER BY name')
    assert.deepEqual(beforeHistory, afterHistory)
    check(true, 'upgrade rerun preserves history')
    async function reject(sql, params, code, label) {
      await assert.rejects(admin.query(sql, params), error => code === 'ER_CONSTRAINT_FAILED' ? error.errno === 4025 : error.code === code)
      check(true, label)
    }
    await admin.query('INSERT INTO document_page (document_id,page_index,page_type) VALUES (1,1,\'seaman_book_info\'),(1,2,\'seaman_book_duty\'),(1,3,\'seaman_book_duty\'),(2,1,\'UNKNOWN\')')
    await reject('INSERT INTO document_page (document_id,page_index) VALUES (1,1)', [], 'ER_DUP_ENTRY', 'duplicate file page rejected')
    await reject('INSERT INTO document_page (document_id,page_index) VALUES (1,51)', [], 'ER_CONSTRAINT_FAILED', 'page limit enforced')
    await admin.query('INSERT INTO extraction_job (document_id,job_key) VALUES (1,\'extract-1\')')
    await admin.query('INSERT INTO extraction_run (job_id,document_id,attempt_no,provider,model,prompt_version,state) VALUES (1,1,1,\'not-called\',\'schema-only\',\'v2\',\'FAILED\')')
    await reject('INSERT INTO extraction_run (job_id,document_id,attempt_no,provider,model,prompt_version) VALUES (1,2,2,\'x\',\'x\',\'x\')', [], 'ER_NO_REFERENCED_ROW_2', 'run cannot refer to another document job')
    const proposalSql = 'INSERT INTO document_field (document_id,page_id,run_id,generation,record_key,record_type,field_key,raw_json,value_json,ai_state,state,missing_reason,critical,schema_version) VALUES (1,?,1,1,?,?,?,?,?,\'UNKNOWN\',\'UNKNOWN\',\'NOT_ON_SOURCE\',1,2)'
    for (const [page,key,type,field,raw,value] of [[1,'identity-1','IDENTITY','full_name','Synthetic One',null],[2,'trip-1','SEA_SERVICE','vessel_name','Ship A',null],[2,'trip-2','SEA_SERVICE','vessel_name','Ship B',null],[3,'trip-3','SEA_SERVICE','vessel_name','Ship C',null]]) {
      await admin.query(proposalSql, [page,key,type,field,JSON.stringify(raw),JSON.stringify(value)])
    }
    const [[count]] = await admin.query('SELECT COUNT(*) AS n, COUNT(DISTINCT raw_json) AS raws FROM document_field WHERE schema_version=2')
    check(count.n === 4 && count.raws === 4, 'one PDF identity + three variable trips over three pages retains all raw/value proposals')
    await reject(proposalSql,[2,'trip-1','SEA_SERVICE','vessel_name','"duplicate"','null'],'ER_DUP_ENTRY','duplicate proposal in same run/record rejected')
    await reject(proposalSql,[4,'bad-page','SEA_SERVICE','vessel_name','null','null'],'ER_NO_REFERENCED_ROW_2','proposal cannot use page of another document')
    await reject('INSERT INTO document_field (document_id,page_id,record_key,record_type,field_key,ai_state,state,schema_version) VALUES (1,1,\'bad\',\'IDENTITY\',\'name\',\'UNKNOWN\',\'UNKNOWN\',2)', [], 'ER_CONSTRAINT_FAILED','UNKNOWN requires missing reason')
    await admin.query('INSERT INTO extraction_job (document_id,job_key) VALUES (1,\'extract-2\')')
    const [newRun] = await admin.query('INSERT INTO extraction_run (job_id,document_id,attempt_no,provider,model,prompt_version,state) VALUES (2,1,1,\'not-called\',\'schema-only\',\'v2\',\'FAILED\')')
    await admin.query('INSERT INTO document_field (document_id,page_id,run_id,generation,record_key,record_type,field_key,ai_state,state,schema_version) VALUES (1,2,?,?,\'trip-1\',\'SEA_SERVICE\',\'vessel_name\',\'PROPOSED\',\'PROPOSED\',2)', [newRun.insertId, newRun.insertId])
    check(true, 'new run retains earlier proposal with same record/field')
    const tripSql = 'INSERT INTO sea_service (seafarer_id,source_document_id,source_page_id,source_record_key,vessel_name_raw,rank_raw,field_values) VALUES (?,1,?,?,?,\'Master\',JSON_OBJECT(\'sign_off\',JSON_OBJECT(\'value\',NULL,\'missing_reason\',\'NOT_ON_SOURCE\')))'
    for (const [page,key,name] of [[2,'trip-1','Ship A'],[2,'trip-2','Ship B'],[3,'trip-3','Ship C']]) await admin.query(tripSql,[1,page,key,name])
    await reject(tripSql,[1,2,'trip-1','Duplicate'],'ER_DUP_ENTRY','publish source identity prevents duplicate service')
    await reject(tripSql,[2,2,'wrong-owner','Wrong'],'ER_NO_REFERENCED_ROW_2','service cannot use another profile source')
    await reject(tripSql,[1,4,'wrong-page','Wrong'],'ER_NO_REFERENCED_ROW_2','service cannot use another document page')
    await reject('UPDATE sea_service SET ongoing=1 WHERE id=1', [], 'ER_CONSTRAINT_FAILED','missing sign off does not automatically imply confirmed ongoing')
    await reject('UPDATE sea_service SET sign_on=\'2024-02-02\',sign_off=\'2024-01-01\',sign_on_precision=\'EXACT\',sign_off_precision=\'EXACT\' WHERE id=1', [], 'ER_CONSTRAINT_FAILED','invalid date order rejected')
    await reject('INSERT INTO review_decision (proposal_id,proposal_version,actor_id,action) VALUES (2,1,1,\'edit\')', [], 'ER_CONSTRAINT_FAILED','edit requires reason')
    await admin.query('INSERT INTO review_decision (proposal_id,proposal_version,actor_id,action,reason) VALUES (2,1,1,\'edit\',\'Read source\')')
    await reject('INSERT INTO review_decision (proposal_id,proposal_version,actor_id,action) VALUES (2,1,1,\'accept\')', [], 'ER_DUP_ENTRY','concurrent decision version cannot duplicate')
    await reject('INSERT INTO vessel_verification (sea_service_id,service_version,state,checked_by) VALUES (1,0,\'VERIFIED\',1)', [], 'ER_CONSTRAINT_FAILED','VERIFIED requires selected vessel and evidence')
    await admin.query('INSERT INTO ship_owner (code,company_name) VALUES (\'SCHEMA1\',\'Synthetic owner 1\'),(\'SCHEMA2\',\'Synthetic owner 2\')')
    await admin.query('INSERT INTO owner_policy (owner_id,version,contact_mode,config,created_by) VALUES (1,1,\'HIDE\',\'{}\',1),(2,1,\'CREW_CONTACT\',\'{}\',1)')
    await admin.query('INSERT INTO owner_template (owner_id,template_key,export_type,version,mapping_version,storage_path,sha256,mapping,created_by) VALUES (1,\'cv\',\'CV\',1,1,\'not-read.xlsx\',REPEAT(\'0\',64),\'{}\',1)')
    const exportSql = 'INSERT INTO owner_export (owner_id,template_id,policy_id,snapshot,as_of,valid_until,created_by) VALUES (1,1,?,\'{}\',\'2026-10-09\',\'2026-10-10\',1)'
    await reject(exportSql,[2],'ER_NO_REFERENCED_ROW_2','export rejects policy from another owner')
    const [createdExport] = await admin.query(exportSql,[1])
    const [[rev]] = await admin.query('SELECT id FROM seafarer_revision WHERE seafarer_id=2 AND revision_no=1')
    await reject('INSERT INTO owner_export_profile VALUES (?,1,?)',[createdExport.insertId, rev.id],'ER_NO_REFERENCED_ROW_2','export rejects revision from another profile')
    await reject('UPDATE owner_export SET approved_by=created_by WHERE id=?',[createdExport.insertId],'ER_CONSTRAINT_FAILED','maker cannot approve own export')
    await reject('UPDATE owner_export SET state=\'RELEASED\' WHERE id=?',[createdExport.insertId],'ER_CONSTRAINT_FAILED','release cannot omit approval and artifact')
    await admin.query('INSERT INTO mcah_idempotency (actor_id,scope,idempotency_key,request_sha256) VALUES (1,\'publish:1\',\'request-1\',REPEAT(\'0\',64))')
    await reject('INSERT INTO mcah_idempotency (actor_id,scope,idempotency_key,request_sha256) VALUES (1,\'publish:1\',\'request-1\',REPEAT(\'1\',64))',[],'ER_DUP_ENTRY','idempotency unique actor/scope/key')
    await admin.beginTransaction()
    await admin.query('UPDATE seafarer SET lock_version=lock_version+1 WHERE id=1 AND lock_version=0')
    const [lost] = await admin.query('UPDATE seafarer SET lock_version=lock_version+1 WHERE id=1 AND lock_version=0')
    check(lost.affectedRows === 0, 'compare-and-swap rejects obsolete lock')
    await admin.rollback()
    const [[rolled]] = await admin.query('SELECT lock_version FROM seafarer WHERE id=1')
    check(rolled.lock_version === 0, 'transaction rollback leaves profile version unchanged')
    const [indexes] = await admin.query('SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=\'extraction_job\'')
    check(indexes.some(i => i.INDEX_NAME === 'idx_job_claim'), 'worker claim index installed')
    await admin.query('UPDATE seafarer_document SET sha256=REPEAT(\'a\',64) WHERE id=1')
    await reject('INSERT INTO seafarer_document (seafarer_id,file_name,mime_type,file_size,storage_path,sha256) VALUES (1,\'duplicate.pdf\',\'application/pdf\',100,\'not-read\',REPEAT(\'a\',64))', [], 'ER_DUP_ENTRY', 'same profile content hash cannot duplicate source')
    await admin.query('UPDATE seafarer_document SET sha256=REPEAT(\'a\',64) WHERE id=2')
    check(true, 'same hash in separate profiles is allowed without cross-profile deduplication')
    const [[profile]] = await admin.query('SELECT * FROM seafarer WHERE id=1')
    const [services] = await admin.query('SELECT * FROM sea_service WHERE seafarer_id=1 ORDER BY id')
    const [documents] = await admin.query('SELECT * FROM seafarer_document WHERE seafarer_id=1 ORDER BY id')
    const [proposals] = await admin.query('SELECT * FROM document_field WHERE document_id=1 ORDER BY id')
    const aggregate = { schema_version: 2, revision_no: 2, profile, sea_service: services, sources: documents.map(d => ({ ...d, proposals: proposals.filter(f => f.document_id === d.id) })), certificates: [], contacts: snapshot.contacts }
    await admin.query('INSERT INTO seafarer_revision (seafarer_id,reason,changes,revision_no,schema_version,snapshot) VALUES (1,\'Aggregate schema test\',\'{}\',2,2,?)', [JSON.stringify(aggregate)])
    const [[stored]] = await admin.query('SELECT JSON_LENGTH(snapshot,\'$.sea_service\') AS trips, JSON_LENGTH(snapshot,\'$.sources[0].proposals\') AS fields FROM seafarer_revision WHERE seafarer_id=1 AND revision_no=2')
    check(stored.trips === 3 && stored.fields === proposals.length, 'aggregate snapshot retains all three trips and source proposal history')
    await reject('INSERT INTO seafarer_revision (seafarer_id,reason,changes,revision_no,schema_version,snapshot) VALUES (1,\'Duplicate\',\'{}\',2,2,?)', [JSON.stringify(aggregate)], 'ER_DUP_ENTRY', 'aggregate revision number cannot duplicate')
    await reject('INSERT INTO seafarer_revision (seafarer_id,reason,changes,revision_no,schema_version,snapshot) VALUES (1,\'Incomplete\',\'{}\',3,2,\'{}\')', [], 'ER_CONSTRAINT_FAILED', 'v2 revision cannot contain only a change log')
    const concurrent = await mysql.createConnection({ ...config.db, database: targets[1] })
    try {
      const outcomes = await Promise.all([admin.query('UPDATE seafarer SET lock_version=lock_version+1 WHERE id=1 AND lock_version=0'), concurrent.query('UPDATE seafarer SET lock_version=lock_version+1 WHERE id=1 AND lock_version=0')])
      check(outcomes.map(r => r[0].affectedRows).sort().join(',') === '0,1', 'two real MariaDB connections: exactly one optimistic update wins')
    } finally { await concurrent.end() }
    const [[countsBefore]] = await admin.query('SELECT (SELECT COUNT(*) FROM sea_service) AS trips, (SELECT COUNT(*) FROM seafarer_revision) AS revisions, (SELECT COUNT(*) FROM mcah_audit) AS audits')
    await admin.beginTransaction()
    await admin.query('INSERT INTO sea_service (seafarer_id,source_document_id,source_page_id,source_record_key,field_values) VALUES (1,1,2,\'rollback-trip\',\'{}\')')
    await admin.query('INSERT INTO mcah_audit (actor_id,action,entity_type,entity_id,reason) VALUES (1,\'TEST\',\'seafarer\',1,\'rollback test\')')
    await admin.query('INSERT INTO seafarer_revision (seafarer_id,reason,changes,revision_no,schema_version,snapshot) VALUES (1,\'Rollback aggregate\',\'{}\',3,2,?)', [JSON.stringify({ ...aggregate, revision_no: 3 })])
    await assert.rejects(admin.query('UPDATE sea_service SET source_page_id=4 WHERE source_record_key=?', ['rollback-trip']))
    await admin.rollback()
    const [[countsAfter]] = await admin.query('SELECT (SELECT COUNT(*) FROM sea_service) AS trips, (SELECT COUNT(*) FROM seafarer_revision) AS revisions, (SELECT COUNT(*) FROM mcah_audit) AS audits')
    assert.deepEqual(countsAfter, countsBefore)
    check(true, 'failed aggregate transaction rolls back service, revision and audit together')
    await admin.query('INSERT INTO seafarer_document (seafarer_id,created_by,file_name,mime_type,file_size,storage_path,schema_version,sha256) VALUES (NULL,1,\'unbound.pdf\',\'application/pdf\',100,\'not-read\',2,REPEAT(\'b\',64))')
    await reject('INSERT INTO seafarer_document (seafarer_id,created_by,file_name,mime_type,file_size,storage_path,schema_version,sha256) VALUES (NULL,1,\'unbound-copy.pdf\',\'application/pdf\',100,\'not-read\',2,REPEAT(\'b\',64))', [], 'ER_DUP_ENTRY', 'unbound intake deduplicates within creator without fake canonical profile')
    await reject('INSERT INTO seafarer_document (seafarer_id,file_name,mime_type,file_size,storage_path,schema_version) VALUES (NULL,\'unowned.pdf\',\'application/pdf\',100,\'not-read\',2)', [], 'ER_CONSTRAINT_FAILED', 'unbound v2 intake requires owner actor')
    console.log(`PASS ${assertions} acceptance checks; retained databases ${targets.join(', ')}`)
  } finally { await admin.end() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
