import {readFile,writeFile,readdir} from 'node:fs/promises';
const names=['@jscad/modeling','imagetracerjs','opentype.js','three','tailwindcss','string.prototype.codepointat','tiny-inflate'];
let text='THIRD-PARTY NOTICES — Molde Studio\n\nBundled libraries retain the following notices. Font license: fonts/LICENSE.txt\n';
for(const name of names){const root=new URL(`../node_modules/${name}/`,import.meta.url),pkg=JSON.parse(await readFile(new URL('package.json',root),'utf8')),files=(await readdir(root)).filter(f=>/^licen[cs]e|^copying/i.test(f));text+=`\n\n========== ${name} ${pkg.version} (${pkg.license}) ==========\n`;for(const file of files)text+=await readFile(new URL(file,root),'utf8');}
await writeFile(new URL('../public/THIRD-PARTY-NOTICES.txt',import.meta.url),text);
