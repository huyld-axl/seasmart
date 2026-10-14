const { execFileSync } = require('child_process')

function readSource(container, sql, { legacy = false } = {}) {
  if (!/^[a-zA-Z0-9_.-]+$/.test(container)) throw new Error('Invalid MySQL container name')
  const buffer = execFileSync('docker', ['exec', container, 'sh', '-c',
    'MYSQL_PWD="$MYSQL_PASSWORD" mysql --default-character-set="$2" -u"$MYSQL_USER" -N -B --raw -D "$MYSQL_DATABASE" -e "$1"',
    'read-source', sql, legacy ? 'latin1' : 'utf8mb4'],
  { maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })
  // Refuse malformed output rather than silently persisting replacement chars.
  return (legacy ? buffer.toString('utf8') : new TextDecoder('utf-8', { fatal: true }).decode(buffer)).trim()
}

module.exports = { readSource }
