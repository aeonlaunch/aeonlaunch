import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { ethers } from "ethers";

const RPC_URL = "https://mainnet.base.org";
const WALLET_DIR = path.join(process.env.HOME || "/root", ".aeon");
const WALLET_FILE = path.join(WALLET_DIR, "wallet.json");

// Define Agent configurations
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
  console.log("=== ANL Auto-Launch Orchestrator ===");
  console.log(`Connecting to Base RPC: ${RPC_URL}...`);
  const provider = new ethers.JsonRpcProvider(RPC_URL);

  // 1. Load all agent wallets
  const wallets = AGENTS.map((agent, idx) => {
    const filePath = path.join(WALLET_DIR, agent.keyFile);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Wallet file not found for agent ${idx + 1}: ${filePath}`);
    }
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const wallet = new ethers.Wallet(data.privateKey, provider);
    return { ...agent, wallet, address: data.address };
  });

  const agent1 = wallets[0];
  console.log(`\nMonitoring Agent 1 address for deposit: ${agent1.address}`);
  console.log("Waiting for deposit on Base Mainnet...");

  // 2. Poll Agent 1 balance until deposit detected
  let detected = false;
  let initialBalance = await provider.getBalance(agent1.address);
  console.log(`Current Balance: ${ethers.formatEther(initialBalance)} ETH`);

  while (!detected) {
    await new Promise((r) => setTimeout(r, 8000));
    try {
      const balance = await provider.getBalance(agent1.address);
      if (balance > initialBalance && balance >= ethers.parseEther("0.001")) {
        console.log(`\n🎉 Deposit Detected! New Balance: ${ethers.formatEther(balance)} ETH`);
        detected = true;
        break;
      }
      process.stdout.write(".");
    } catch (e) {
      console.log(`\nError polling balance: ${e.message}`);
    }
  }

  // 3. Split and distribute funds to wallets 2-5
  const balance = await provider.getBalance(agent1.address);
  console.log("\nDistributing funds to Agent wallets 2-5...");

  // Estimate gas cost for 4 transfers (21,000 gas each)
  const feeData = await provider.getFeeData();
  const gasPrice = feeData.gasPrice || ethers.parseUnits("0.05", "gwei");
  const transferGas = 21000n;
  const totalGasRequired = transferGas * gasPrice * 4n * 2n; // 2x safety margin

  if (balance < totalGasRequired) {
    console.log("Error: Deposit is too small to cover transfer gas fees!");
    return;
  }

  // Split remainder by 5
  const distributeTotal = balance - totalGasRequired;
  const splitAmount = distributeTotal / 5n;

  console.log(`Total deposit: ${ethers.formatEther(balance)} ETH`);
  console.log(`Gas reserved:  ${ethers.formatEther(totalGasRequired)} ETH`);
  console.log(`Splitting:     ${ethers.formatEther(splitAmount)} ETH per Agent wallet (5-way split)`);

  for (let i = 1; i < wallets.length; i++) {
    const target = wallets[i];
    console.log(`Sending ${ethers.formatEther(splitAmount)} ETH to ${target.name} (${target.address})...`);
    
    const tx = await agent1.wallet.sendTransaction({
      to: target.address,
      value: splitAmount,
      gasLimit: transferGas
    });
    
    console.log(`Transaction sent: ${tx.hash}. Waiting for confirmation...`);
    await tx.wait(1);
    console.log("Confirmed!");
  }

  console.log("\nAll funds successfully split and distributed!");
  
  // 4. Sequentially deploy each Agent memecoin
  console.log("\n=== Initiating memecoin launches on Base Mainnet ===");

  // Ensure wallet folder exists
  if (!fs.existsSync(WALLET_DIR)) {
    fs.mkdirSync(WALLET_DIR, { recursive: true });
  }

  for (let i = 0; i < wallets.length; i++) {
    const target = wallets[i];
    console.log(`\nLaunching ${target.name} (${target.symbol})...`);

    // Swap wallet.json with target agent key
    const targetKeyPath = path.join(WALLET_DIR, target.keyFile);
    fs.copyFileSync(targetKeyPath, WALLET_FILE);
    console.log(`Swapped active key to Agent ${i + 1} (${target.address})`);

    // Run the launch command
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

  console.log("\n=== Auto-Launch Orchestrator Completed Successfully! ===");
}

main().catch((err) => {
  console.error("Orchestrator failed:", err);
});
