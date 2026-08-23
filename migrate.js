import { config } from '../src/config.js'
import { migrate } from '../src/db.js'

migrate()
console.info(`  Schema applied to ${config.databaseFile}`)
