import { execSync } from "child_process";
import path from "path";
import fs from "fs";

const WALLET_DIR = path.join(process.env.HOME || "/root", ".aeon");
const WALLET_FILE = path.join(WALLET_DIR, "wallet.json");

console.log("Launching a single test token...");

const cmd = `npx aeonlaunch launch --name "Test Token" --symbol "TEST" --description "A test token to verify the pipeline" --website "https://aeon.fun" --json`;
console.log(`Executing: ${cmd}`);

try {
  const output = execSync(cmd, { encoding: "utf8", env: { ...process.env, PATH: "/root/.nvm/versions/node/v24.16.0/bin:" + process.env.PATH } });
  const res = JSON.parse(output);
  console.log(`🚀 Launched Successfully!`);
  console.log(`   Token Address:   ${res.tokenAddress}`);
  console.log(`   Transaction:     ${res.transactionHash}`);
  console.log(`   Explorer Link:   ${res.explorer}`);
} catch (err) {
  console.log(`❌ Launch failed: ${err.message}`);
  if (err.stdout) console.log(`stdout: ${err.stdout}`);
  if (err.stderr) console.log(`stderr: ${err.stderr}`);
}
