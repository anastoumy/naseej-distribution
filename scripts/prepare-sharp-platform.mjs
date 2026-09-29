import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const [platform, arch = 'x64'] = process.argv.slice(2)

if (!platform) {
  console.error('Usage: node scripts/prepare-sharp-platform.mjs <platform> [arch]')
  console.error('Example: node scripts/prepare-sharp-platform.mjs win32 x64')
  process.exit(1)
}

const sharpPkg = JSON.parse(readFileSync('node_modules/sharp/package.json', 'utf8'))
const packageName = `@img/sharp-${platform}-${arch}`
const version = sharpPkg.optionalDependencies?.[packageName]

if (!version) {
  console.error(`No sharp optional dependency found for ${packageName}`)
  process.exit(1)
}

console.log(`Installing ${packageName}@${version} for cross-platform packaging...`)
execSync(`npm install --no-save --force ${packageName}@${version}`, { stdio: 'inherit' })
