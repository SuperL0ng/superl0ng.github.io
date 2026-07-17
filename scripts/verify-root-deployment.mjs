#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const failures=[];
const check=(condition,message)=>{if(!condition)failures.push(message)};
const read=(name)=>readFileSync(join(root,name),"utf8");

const required=[
  "index.html","CNAME","manifest.json","library-backup.js","view-fixes.js","doubleheader-game-binding.js",
  "favicon.ico","ssb-favicon-v3-64.png","ssb-favicon-v3-128.png",
  "ssb-touch-v3-180.png","favicon-silver-v2-192.png","favicon-silver-v2-512.png",
  "ssb-share-v3.png","simon-sports-betting-nameplate.png",
  "ssb_emblem_webapp_box_transparent_768.png"
];
required.forEach(name=>check(existsSync(join(root,name)),`Missing required root asset: ${name}`));

const cname=read("CNAME").trim();
const index=read("index.html");
const viewFixes=read("view-fixes.js");
const navigation=read("navigation-links-v24.js");

check(cname==="simonsportsbetting.com","Root CNAME must be simonsportsbetting.com");
check(index.includes('content="https://simonsportsbetting.com/"'),"Missing final .com social URL");
check(index.includes('https://simonsportsbetting.com/ssb-share-v3.png'),"Missing final .com share image");
check(index.includes('/manifest.json'),"Missing local silver manifest reference");
check(index.includes('id="silverRootHost"'),"Root silver identity override is missing");
check(!index.includes("simonsports.bet"),"Root index still references the staging .bet domain");
check(!index.includes("<base"),"Root index contains a base element");
check(!index.includes("document.write"),"Root index contains document.write");
check(!index.includes("raw.githubusercontent.com/SuperL0ng/parlay-tracker"),"Root index still loads the app repo at runtime");
check(!index.includes("superl0ng.github.io/parlay-tracker"),"Root index still references app-repo asset hosting");
check(!index.includes("ssb-gold"),"Root index contains gold identity assets");
check(!index.includes("manifest-gold"),"Root index contains the gold manifest");
check(viewFixes.includes("./simon-sports-betting-nameplate.png"),"Root view fixes do not restore the local nameplate");
check(viewFixes.includes("./ssb_emblem_webapp_box_transparent_768.png"),"Root view fixes do not use the local compact emblem");
check(navigation.includes("data-library-backup"),"Root whole-library backup loader is missing");

const manifest=JSON.parse(read("manifest.json"));
check(manifest.start_url==="/","Silver manifest start_url must be /");
check(manifest.scope==="/","Silver manifest scope must be /");
check(manifest.theme_color==="#d7dde6","Silver manifest theme color is wrong");
for(const icon of manifest.icons||[]){
  const rel=String(icon.src||"").replace(/^\.\//,"").replace(/^\//,"");
  check(existsSync(join(root,rel)),`Missing silver manifest icon: ${rel}`);
}

for(const match of index.matchAll(/(?:src|href)=["']\.\/([^?#"']+)/g)){
  check(existsSync(join(root,match[1])),`Missing root-local referenced file: ${match[1]}`);
}

if(failures.length){
  console.error("Root deployment contract failed:");
  failures.forEach(item=>console.error(`- ${item}`));
  process.exit(1);
}
console.log("Silver root deployment contract verified.");
