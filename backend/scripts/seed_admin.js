const readline = require('readline')
const { Writable } = require('stream')
const bcrypt = require('bcrypt')
const db = require('../src/config/db')

let hidden = false
const output = new Writable({ write(chunk, _encoding, callback) { if (!hidden) process.stdout.write(chunk); callback() } })
const prompt = readline.createInterface({ input: process.stdin, output, terminal: process.stdin.isTTY })
async function ask(label, secret = false) {
  hidden = secret
  if (secret) process.stdout.write(label)
  const value = await new Promise((resolve) => prompt.question(secret ? '' : label, resolve))
  hidden = false
  if (secret) process.stdout.write('\n')
  return value
}

async function seed() {
  const email = (await ask('Admin email: ')).trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Invalid email')
  const password = await ask('Password (minimum 12 characters): ', true)
  const confirmation = await ask('Confirm password: ', true)
  if (password.length < 12 || password !== confirmation) throw new Error('Password too short or confirmation does not match')
  const hash = await bcrypt.hash(password, 12)
  const [[admin]] = await db.query('SELECT id FROM "role" WHERE code = \'admin\'')
  if (!admin) throw new Error('Chưa có vai trò Quản trị viên: chạy npm run migrate trước')
  await db.query('INSERT INTO "user" (email, password_hash, role_id, verification_status) VALUES (?, ?, ?, \'verified\')', [email, hash, admin.id])
  console.log('Admin account created')
}
seed().catch((error) => {
  console.error(error.code ? `Admin creation failed (${error.code})` : error.message)
  process.exitCode = 1
}).finally(() => { prompt.close(); db.end() })
