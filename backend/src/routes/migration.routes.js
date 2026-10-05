const { runMigration019, runMigration020 } = require('../controllers/migration.controller')

async function migrationRoutes(fastify) {
  fastify.post('/run-019', runMigration019)
  fastify.post('/run-020', runMigration020)
}

module.exports = migrationRoutes
