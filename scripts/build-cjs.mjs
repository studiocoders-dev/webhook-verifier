import { readFileSync, writeFileSync } from "node:fs";
import ts from "typescript";

const moduleIds = [
  "./types.js",
  "./crypto/timing-safe.js",
  "./crypto/hmac.js",
  "./providers/meta.js",
  "./providers/stripe.js",
  "./providers/generic.js",
  "./adapters/request.js",
  "./index.js",
];

const entries = moduleIds.map((id) => {
  const fileUrl = new URL(`../dist/${id.slice(2)}`, import.meta.url);
  const esmSource = readFileSync(fileUrl, "utf8").replace(
    /^\/\/# sourceMappingURL=.*$/gm,
    ""
  );
  const cjs = ts.transpileModule(esmSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;

  return `${JSON.stringify(id)}: function (exports, require, module) {\n${cjs}\n}`;
});

const bundle = `"use strict";
const __modules = {
${entries.join(",\n")}
};
const __cache = {};
function posixNormalize(p) {
  const parts = [];
  for (const seg of p.split("/")) {
    if (!seg || seg === ".") continue;
    if (seg === "..") parts.pop();
    else parts.push(seg);
  }
  return parts.join("/");
}
function __requireFrom(baseDir) {
  return function localRequire(specifier) {
    const resolved = "./" + posixNormalize(baseDir + "/" + specifier);
    return __load(resolved);
  };
}
function __load(id) {
  if (__cache[id]) return __cache[id].exports;
  const factory = __modules[id];
  if (!factory) throw new Error("Cannot find bundled module: " + id);
  const mod = { exports: {} };
  __cache[id] = mod;
  const dir = id.slice(0, id.lastIndexOf("/"));
  factory(mod.exports, __requireFrom(dir), mod);
  return mod.exports;
}
module.exports = __load("./index.js");
`;

writeFileSync(new URL("../dist/index.cjs", import.meta.url), bundle, "utf8");
writeFileSync(
  new URL("../dist/index.d.cts", import.meta.url),
  'export * from "./index.js";\n',
  "utf8"
);
console.log(
  "Dual ESM/CJS build complete: dist/index.js, dist/index.cjs, dist/index.d.ts, dist/index.d.cts"
);
