import ts from "typescript";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const outdir = resolve(root, "dist");
const backend = (process.env.MOTOMOTO_BACKEND_ORIGIN || "http://localhost:3000").replace(/\/$/, "");
await mkdir(outdir, { recursive: true });
for (const name of ["sidepanel", "background", "content"]) {
  const source = await readFile(resolve(root, `src/${name}.ts`), "utf8");
  const result = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None, strict: true }, fileName: `${name}.ts`, reportDiagnostics: true });
  const errors = result.diagnostics?.filter((item) => item.category === ts.DiagnosticCategory.Error) ?? [];
  if (errors.length) throw new Error(ts.formatDiagnostics(errors, { getCanonicalFileName:f=>f, getCurrentDirectory:()=>root, getNewLine:()=>"\n" }));
  await writeFile(resolve(outdir, `${name}.js`), result.outputText.replaceAll("__MOTOMOTO_BACKEND__", JSON.stringify(backend)));
}
await cp(resolve(root,"src/sidepanel.css"), resolve(outdir,"sidepanel.css"));
await cp(resolve(root,"public/motomoto-logo.png"), resolve(outdir,"motomoto-logo.png"));
await writeFile(resolve(outdir,"sidepanel.html"), `<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MotoMoto.ai</title><link rel="stylesheet" href="sidepanel.css"></head><body><div id="root"></div><script src="sidepanel.js"></script></body></html>`);
const host = `${new URL(backend).origin}/*`;
await writeFile(resolve(outdir,"manifest.json"), JSON.stringify({ manifest_version:3, name:"MotoMoto.ai", description:"Evidence-led Singapore used-motorcycle listing analysis.", version:"2.0.0", permissions:["activeTab","scripting","storage","sidePanel"], host_permissions:["https://www.carousell.sg/*","https://carousell.sg/*","https://carousell.app.link/*","https://www.sgbikemart.com.sg/*","https://sgbikemart.com.sg/*",host], background:{service_worker:"background.js"}, side_panel:{default_path:"sidepanel.html"}, action:{default_title:"Open MotoMoto.ai"}, content_scripts:[{matches:["https://www.carousell.sg/*","https://carousell.sg/*","https://www.sgbikemart.com.sg/*","https://sgbikemart.com.sg/*"],js:["content.js"],run_at:"document_idle"}] },null,2));
console.log(`Built extension for backend ${backend}`);
