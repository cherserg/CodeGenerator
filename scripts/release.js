// scripts/release.js
const { execSync } = require('child_process')
const readline = require('readline')

// Тип релиза берётся из первого аргумента: patch, minor или major
const [, , releaseType] = process.argv
if (!['patch','minor','major'].includes(releaseType)) {
  console.error('Usage: node release.js <patch|minor|major>')
  process.exit(1)
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

rl.question(`Введите описание изменений для ${releaseType}-релиза: `, (msg) => {
  try {
    // 1) индексируем всё
    execSync('git add -A', { stdio: 'inherit' })
    // 2) bump версии и коммитим всё одним коммитом с вашим сообщением
    //    --force чтобы не ругался на "грязное" дерево
    execSync(
      `npm version ${releaseType} --force -m "chore(release): v%s — ${msg.replace(/"/g, '\\"')}"`,
      { stdio: 'inherit' }
    )
    // 3) билд
    execSync('npm run compile', { stdio: 'inherit' })
    // 4) пуш
    execSync('git push origin HEAD --follow-tags', { stdio: 'inherit' })
    console.log('\n✅ Релиз успешно создан и запушен!')
  } catch (e) {
    console.error('\n❌ Ошибка при релизе:', e.message)
    process.exit(1)
  } finally {
    rl.close()
  }
})
