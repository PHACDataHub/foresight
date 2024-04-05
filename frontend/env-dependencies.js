import * as dotenv from "dotenv";
import pkg from "./package.json" assert { type: "json" };
import { execSync } from "child_process";
import { renameSync, unlinkSync } from "fs";

dotenv.config();

if (!pkg.envDependencies) {
  process.exit(0);
}

const env = Object.assign({}, process.env);

const deps = Object.entries(pkg.envDependencies);

if (!Array.isArray(deps) || !deps.every(([_, v]) => typeof v === "string")) {
  console.log("ERROR");
  throw new Error(`pkg.envDependencies should have a signature of String[]`);
}

const parsed = deps
  .map(([_k, v]) => {
    const version = v.replace(/\${([0-9a-zA-Z_]*)}/g, (_, varName) => {
      if (varName in env) {
        if (typeof varName === "string") {
          const v = env[varName];
          if (typeof v === "string") return v;
        }
      }
      return "";
    });
    if (
      version.startsWith("http://") ||
      version.startsWith("https://") ||
      version.startsWith("git://")
    ) {
      return version;
    }
    const key = _k.replace(/\${([0-9a-zA-Z_]*)}/g, (_, varName) => {
      if (varName in env) {
        if (typeof varName === "string") {
          const v = env[varName];
          if (typeof v === "string") return v;
        }
      }
      return "";
    });
    return `${key}@${version}`;
  })
  .join(" ");

try {
  execSync("npm install --no-save " + parsed, { stdio: [0, 1, 2] });
  process.exit(0);
} catch (err) {
  console.error(err);
  throw new Error("Could not install pkg.envDependencies.");
}
