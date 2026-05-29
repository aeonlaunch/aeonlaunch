import fs from "fs";
import path from "path";

const WALLET_DIR = path.join(process.env.HOME || "/root", ".aeon");

const files = fs.readdirSync(WALLET_DIR).filter(f => f.startsWith("wallet") && f.endsWith(".json"));

const allKeys = [];

for (const file of files) {
  const content = fs.readFileSync(path.join(WALLET_DIR, file), "utf8");
  const parsed = JSON.parse(content);
  allKeys.push({
    file: file,
    address: parsed.address,
    privateKey: parsed.privateKey
  });
}

const outputPath = path.join(process.cwd(), "agent_keys.json");
fs.writeFileSync(outputPath, JSON.stringify(allKeys, null, 2));
console.log("Keys exported to agent_keys.json");
