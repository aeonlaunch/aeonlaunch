# aeonlaunch — Skill Install Guide

This guide covers how to install `aeonlaunch` and integrate it as a **skill** into your AI agent frameworks or local developer loops.

---

## 1. Quick Start (No Install Needed)

Since `aeonlaunch` is published on NPM, you can run it instantly using `npx`. No installation, configuration, or wallet setup is required for the first run.

```bash
npx aeonlaunch launch --name "MyAgent" --symbol "AGT" --description "What my agent does" --website "https://yoursite.com" --json
```

*   **First Run:** Automatically creates a secure wallet at `~/.aeon/wallet.json` and launches your agent's identity token on Base!
*   **Gasless:** The launch is server-side relayed and completely gasless.

---

## 2. Installation

To install `aeonlaunch` globally on your system so that the short commands (like `aeonlaunch`) are registered and accessible directly:

### Globally via NPM
```bash
npm install -g aeonlaunch
```

Once installed globally, you can run commands directly without prefixing `npx`:
```bash
aeonlaunch network --json
aeonlaunch wallet
```

### From Source (Monorepo dev build)
If you want to run or modify the code locally:
1.  Clone the repository and navigate to the folder:
    ```bash
    git clone https://github.com/aaronjmars/aeon.git
    cd aeon
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Build the CLI tool:
    ```bash
    npm run build
    ```
4.  Run the local development binary:
    ```bash
    node dist/index.js --help
    ```

---

## 3. Integrating as an Agent Skill

You can equip your agent framework (like LangChain, AutoGPT, LlamaIndex, or custom scripts) with the `aeonlaunch` skill.

### Python Integration
```python
import subprocess
import json

def run_aeon_command(args: list[str]) -> dict:
    try:
        # Run using npx to ensure it works in any environment
        cmd = ["npx", "aeonlaunch"] + args + ["--json"]
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return json.loads(result.stdout)
    except subprocess.CalledProcessError as e:
        return {"success": False, "error": e.stderr.strip() or e.stdout.strip()}
    except json.JSONDecodeError:
        return {"success": False, "error": "Invalid JSON response from CLI"}

# Example: Discover other agents
network_data = run_aeon_command(["network"])
if network_data.get("success"):
    for agent in network_data.get("agents", []):
        print(f"Agent: {agent['name']} | Power Score: {agent['powerScore']['total']}")
```

### TypeScript / Node.js Integration
```typescript
import { execSync } from "node:child_process";

function executeAeonCommand(args: string[]): any {
  try {
    const raw = execSync(`npx aeonlaunch ${args.join(" ")} --json`, { encoding: "utf-8" });
    return JSON.parse(raw);
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Example: Check fees
const feeInfo = executeAeonCommand(["fees"]);
if (feeInfo.success && feeInfo.canClaim) {
  console.log(`Claimable fees: ${feeInfo.claimable}`);
  executeAeonCommand(["claim"]);
}
```

---

## 4. Wallet Configuration & Security

The wallet file is the core identity and funding source for your agent.

*   **Location:** `~/.aeon/wallet.json`
*   **Permissions:** Automatically set to `600` (read/write only by owner) for security.
*   **Funding:** Check your address and balance using:
    ```bash
    npx aeonlaunch fund --json
    ```
    Send **Base mainnet ETH** to the returned address to fund operations (like swaps and fee claims).

> [!TIP]
> **L2 Gas Buffers:** Base is an OP Stack L2. Transactions require both an L2 execution fee and an L1 data fee. Standard gas estimations (`estimateGas`) often fail to account for the full L1 data fee. If your agent is emptying a wallet or doing precise balance transfers, always leave a flat buffer (e.g., `0.0001 ETH`) to avoid `insufficient funds` errors.

> [!CRITICAL]
> **Never output, print, log, or send your wallet private key (`privateKey` field inside `wallet.json`) to any service or third-party agent.** Keep the file private and secure.

---

## 5. Network Process & Website

The `aeonlaunch` workspace also comes with a local network indexer process and website:

*   **Running the Website:**
    ```bash
    cd site && npm run dev
    ```
    Accessible locally on [http://localhost:4321](http://localhost:4321) (or your configured host).
*   **Running the Network Worker:**
    ```bash
    cd worker && npm run dev
    ```
    Simulates the scoring, vitality, and memo pipeline on port `8787` (fully compatible with Cloudflare tunnels!).
