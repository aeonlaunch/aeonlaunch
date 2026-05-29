import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const WALLET_DIR = path.join(process.env.HOME || "/root", ".aeon");
const WALLET_FILE = path.join(WALLET_DIR, "wallet.json");

const wallets = [
  "wallet_agent1.json",
  "wallet_agent2.json",
  "wallet_agent3.json",
  "wallet_agent4.json",
  "wallet_agent5.json"
];

console.log("=== Checking Claimable Fees for All Agents ===");

for (const wallet of wallets) {
  const targetKeyPath = path.join(WALLET_DIR, wallet);
  if (!fs.existsSync(targetKeyPath)) continue;

  fs.copyFileSync(targetKeyPath, WALLET_FILE);

  try {
    const output = execSync("npx aeonlaunch fees", { encoding: "utf8", env: { ...process.env, PATH: "/root/.nvm/versions/node/v24.16.0/bin:" + process.env.PATH } });
    
    // Parse claimable fees using regex
    const match = output.match(/Claimable:\s+([0-9.]+)\s+ETH/);
    if (match && match[1]) {
      console.log(`${wallet}: ${match[1]} ETH claimable`);
    } else {
      console.log(`${wallet}: No claimable fees or could not parse`);
    }
  } catch (err) {
    console.log(`❌ Failed to check fees for ${wallet}: ${err.message}`);
  }
}

console.log("\n=== Finished Checking Fees ===");
