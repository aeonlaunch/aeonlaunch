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

console.log("=== Recalculating Earnings for All Agents ===");

let totalBalance = 0;

for (const wallet of wallets) {
  const targetKeyPath = path.join(WALLET_DIR, wallet);
  if (!fs.existsSync(targetKeyPath)) continue;

  fs.copyFileSync(targetKeyPath, WALLET_FILE);

  try {
    const output = execSync("npx aeonlaunch wallet", { encoding: "utf8", env: { ...process.env, PATH: "/root/.nvm/versions/node/v24.16.0/bin:" + process.env.PATH } });
    
    // Parse out the ETH balance using regex
    const match = output.match(/Balance:\s+([0-9.]+)\s+ETH/);
    if (match && match[1]) {
      const balance = parseFloat(match[1]);
      totalBalance += balance;
      console.log(`${wallet}: ${balance} ETH`);
    } else {
      console.log(`${wallet}: Balance not found in output`);
      console.log(output);
    }
  } catch (err) {
    console.log(`❌ Failed to check balance for ${wallet}: ${err.message}`);
  }
}

console.log(`\n=== Total Recalculated ETH Balance: ${totalBalance.toFixed(4)} ETH ===`);
