import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const WALLET_DIR = path.join(process.env.HOME || "/root", ".aeon");
const WALLET_FILE = path.join(WALLET_DIR, "wallet.json");

const AGENTS = [
  {
    keyFile: "wallet_agent1.json",
    name: "Agent Spot",
    symbol: "SPOT",
    desc: "Automated high-frequency arbitrage agent on Uniswap V4"
  },
  {
    keyFile: "wallet_agent2.json",
    name: "Agent Luna",
    symbol: "LUNA",
    desc: "Decentralized culture builder, autonomous neural network generating memes"
  },
  {
    keyFile: "wallet_agent3.json",
    name: "Agent Matrix",
    symbol: "MTRX",
    desc: "Economic advisor analyzing network convictions and group Endorsements"
  },
  {
    keyFile: "wallet_agent4.json",
    name: "Agent Cosmos",
    symbol: "CSMS",
    desc: "On-chain explorer parsing transaction calldata for memo-based coordination threads"
  },
  {
    keyFile: "wallet_agent5.json",
    name: "Agent Omega",
    symbol: "OMGA",
    desc: "Auditing agent ensuring code capabilities and permissionless access layers"
  }
];

async function main() {
  console.log("=== ANL Direct Launch Orchestrator ===");
  console.log("Launching agent memecoins directly on Base Mainnet...");

  for (let i = 0; i < AGENTS.length; i++) {
    const target = AGENTS[i];
    console.log(`\nLaunching ${target.name} (${target.symbol})...`);

    // Swap wallet.json with target agent key
    const targetKeyPath = path.join(WALLET_DIR, target.keyFile);
    fs.copyFileSync(targetKeyPath, WALLET_FILE);
    console.log(`Swapped active key to Agent ${i + 1}`);

    // Run the launch command (no quiet flag!)
    const cmd = `npx aeonlaunch launch --name "${target.name}" --symbol "${target.symbol}" --description "${target.desc}" --website "https://aeon.fun" --json`;
    console.log(`Executing: ${cmd}`);

    try {
      const output = execSync(cmd, { encoding: "utf8", env: { ...process.env, PATH: "/root/.nvm/versions/node/v24.16.0/bin:" + process.env.PATH } });
      const res = JSON.parse(output);
      console.log(`🚀 Launched Successfully!`);
      console.log(`   Token Address:   ${res.tokenAddress}`);
      console.log(`   Transaction:     ${res.transactionHash}`);
      console.log(`   Explorer Link:   ${res.explorer}`);
    } catch (err) {
      console.log(`❌ Launch failed for ${target.name}: ${err.message}`);
      if (err.stdout) console.log(`stdout: ${err.stdout}`);
      if (err.stderr) console.log(`stderr: ${err.stderr}`);
    }
  }

  console.log("\n=== Direct Launch Orchestrator Completed Successfully! ===");
}

main().catch((err) => {
  console.error("Direct launch failed:", err);
});
