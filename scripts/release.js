// scripts/release.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Тип релиза patch, minor или major
const [, , releaseType] = process.argv;
if (!['patch', 'minor', 'major'].includes(releaseType)) {
  console.error('Usage: node scripts/release.js <patch|minor|major>');
  process.exit(1);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question(`Введите описание изменений для ${releaseType}-релиза:\n`, (msg) => {
  try {
    // 1) bump версии в package.json без git-коммита и тэга
    execSync(`npm version ${releaseType} --no-git-tag-version`, { stdio: 'inherit' });

    // 2) читаем новую версию
    const pkg = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf-8')
    );
    const newVer = pkg.version;

    // 3) индексируем все изменения
    execSync('git add -A', { stdio: 'inherit' });

    // 4) единый коммит с subject=vX.Y.Z и body=ваш msg
    //    первый -m — заголовок, второй -m — тело (на новой строке)
    execSync(
      `git commit -m "v.${newVer}" -m "${msg.replace(/"/g, '\\"')}"`,
      { stdio: 'inherit' }
    );

    // 5) создаём соответствующий тэг
    execSync(`git tag v${newVer}`, { stdio: 'inherit' });

    // 6) билд
    execSync('npm run compile', { stdio: 'inherit' });

    // 7) пушим коммит и тэг
    execSync('git push origin HEAD --follow-tags', { stdio: 'inherit' });

    console.log('\n✅ Релиз успешно создан и запушен!');
  } catch (e) {
    console.error('\n❌ Ошибка при релизе:', e.message);
    process.exit(1);
  } finally {
    rl.close();
  }
});
