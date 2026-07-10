import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

global.window = global;
vm.runInThisContext(fs.readFileSync(path.join(root, 'site/js/utils.js'), 'utf8'));
const utils = global.GreekUtils;

const forms = ['подарок (ед.)', 'подарок (мн.)'];

if (utils.formatRuForChoice('подарок (ед.)', forms) !== 'подарок') {
  throw new Error('Expected singular without marker');
}
if (utils.formatRuForChoice('подарок (мн.)', forms) !== 'подарки') {
  throw new Error('Expected pluralized подарки');
}
if (utils.formatRuForChoice('конверты (мн.)', ['конверт (ед.)', 'конверты (мн.)']) !== 'конверты') {
  throw new Error('Expected existing plural without marker');
}
if (utils.formatRuForChoice('друг (м.р., ед.)', ['друг (м.р., ед.)']) !== 'друг') {
  throw new Error('Expected case label stripped');
}

console.log('✓ ru choice label formatting');
