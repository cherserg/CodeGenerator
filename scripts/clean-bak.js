#!/usr/bin/env node

/**
 * clean-bak.js
 * Удаляет все файлы с расширением .bak_<anything>
 */

const globModule = require('glob');
const fs = require('fs').promises;
const path = require('path');

function getGlobSync() {
  // new API (v10+): globModule.globSync
  if (typeof globModule.globSync === 'function') return globModule.globSync;
  // старый API (v7): globModule.sync
  if (typeof globModule.sync === 'function') return globModule.sync;
  // fallback: сам модуль — функция (v7), но без sync — маловероятно
  if (typeof globModule === 'function') {
    // у старого API есть .sync как свойство функции
    if (typeof globModule.sync === 'function') return globModule.sync;
  }
  throw new Error('Не удалось найти sync-API у пакета "glob". Обнови/переустанови пакет.');
}

async function cleanBakFiles() {
  try {
    const globSync = getGlobSync();
    const pattern = '**/*.bak.*';

    // Ищем файлы (без директорий)
    const files = globSync(pattern, { nodir: true });

    if (!files || files.length === 0) {
      console.log('Файлы .bak.* не найдены.');
      return;
    }

    for (const file of files) {
      // path.resolve — на случай относительных путей
      await fs.unlink(path.resolve(file));
      console.log(`Удалён: ${file}`);
    }

    console.log(`Всего удалено ${files.length} файлов.`);
  } catch (err) {
    console.error('Ошибка при очистке .bak файлов:', err);
    process.exit(1);
  }
}

cleanBakFiles();
