// Produces a genuinely single-file game: no server, module loader, external
// scripts, separate stylesheet, asset folder or network request is required.
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdirSync, cpSync } from 'node:fs';
const config=ts.readConfigFile('tsconfig.json',ts.sys.readFile);
const parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,'.');
const diagnostics=ts.getPreEmitDiagnostics(ts.createProgram(parsed.fileNames,parsed.options));
if(diagnostics.length){console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCanonicalFileName:f=>f,getCurrentDirectory:()=>process.cwd(),getNewLine:()=> '\n'}));process.exit(1);}
mkdirSync('dist',{recursive:true});cpSync('public','dist',{recursive:true});
const embedded=Object.fromEntries(['characters.png','room.png','hallway.png','kitchen.png'].map(name=>[name,'data:image/png;base64,'+readFileSync('public/assets/'+name).toString('base64')]));
let combined='window.__mortiAssets='+JSON.stringify(embedded)+';\n';
for(const name of ['rules','main']){
 let output=ts.transpileModule(readFileSync(`src/${name}.ts`,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 if(name==='main')output=output.replace(/import Phaser from ['"]phaser['"];?/, 'const Phaser = window.Phaser;').replace(/import ['"]\.\/style.css['"];?/,'').replace(/import \{[^}]+\} from ['"]\.\/rules['"];?/, '');
 combined+=output.replace(/export /g,'')+'\n';
}
const css=readFileSync('src/style.css','utf8').replace(/@import\s+url\([^)]*\)\s*;/g,'');
const runtime=readFileSync('public/vendor/phaser.min.js','utf8');
const escapeScript=script=>script.replace(/<\/script/gi,'<\\/script');
const bootGuard=`window.addEventListener('error',function(event){var panel=document.getElementById('boot-error');if(panel){panel.textContent='The game could not start: '+event.message;panel.hidden=false;}});`;
let html=readFileSync('src/page.html','utf8')
 .replace('</head>',`<style>${css}</style></head>`)
 .replace('<div id="loading">','<div id="boot-error" role="alert" hidden></div><div id="loading">')
 .replace('<script type="module" src="/src/main.ts"></script>',()=>`<script>${bootGuard}</script><script>${escapeScript(runtime)}</script><script>${escapeScript('(()=>{\n'+combined+'\n})();')}</script>`);
writeFileSync('dist/index.html',html);
writeFileSync('index.html',html);
console.log('TypeScript checks passed. Self-contained index.html written in project root and dist/.');
