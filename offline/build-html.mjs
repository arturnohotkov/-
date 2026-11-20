import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {shell} from '../core/shell.mjs';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const moduleURL = code => 'data:text/javascript;base64,' + Buffer.from(code).toString('base64');
const questions = moduleURL(await read('core/questionnaire.mjs'));
const model = moduleURL((await read('core/model.mjs')).replace("'./questionnaire.mjs'", () => JSON.stringify(questions)));
const api = moduleURL((await read('core/api.mjs')).replace("'./model.mjs'", () => JSON.stringify(model)));
const transport = moduleURL((await read('offline/browser.mjs')).replace("'../core/api.mjs'", () => JSON.stringify(api)));
const mark = 'data:image/svg+xml;base64,' + Buffer.from(await read('public/mark.svg')).toString('base64');
const ui = (await read('public/vector.js'))
  .replace(/'\.\/transport\.mjs[^']*'/, () => JSON.stringify(transport))
  .replaceAll('/mark.svg', mark);
const css = await read('public/vector.css');
const html = shell
  .replace('/mark.svg', mark)
  .replace(/<link rel="stylesheet"[^>]+>/, () => '<style>' + css + '</style>')
  .replace(/<script type="module" src="[^"]+"><\/script>/, () => '<script type="module">' + ui.replace(/<\/script/gi, '<\\/script') + '</script>');

const dest = process.argv[2] ? resolve(process.argv[2]) : fileURLToPath(new URL('public/vektor.html', root));
await mkdir(dirname(dest), {recursive: true});
await writeFile(dest, html);
