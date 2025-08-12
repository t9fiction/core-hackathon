const fs = require('fs');
const path = require('path');

function extractAbi(artifactPath, outputPath, exportName) {
  try {
    // Read the compiled artifact
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    const abi = artifact.abi;
    
    // Generate TypeScript export
    const content = `// ${artifact.contractName} Contract ABI - Auto-generated from compiled artifact
export const ${exportName} = ${JSON.stringify(abi, null, 2)} as const;
`;
    
    // Write to output file
    fs.writeFileSync(outputPath, content);
    console.log(`✅ Updated ${exportName} in ${outputPath}`);
    
    return true;
  } catch (error) {
    console.error(`❌ Failed to update ${exportName}:`, error.message);
    return false;
  }
}

async function main() {
  console.log("Updating ABIs from compiled artifacts...\n");
  
  const updates = [
    {
      artifact: "./artifacts/contracts/ChainCraftFactoryLite.sol/ChainCraftFactoryLite.json",
      output: "../src/lib/contracts/abis/factory.ts",
      export: "CHAINCRAFT_FACTORY_ABI"
    },
    {
      artifact: "./artifacts/contracts/ChainCraftGovernance.sol/ChainCraftGovernance.json",
      output: "../src/lib/contracts/abis/governance.ts",
      export: "CHAINCRAFT_GOVERNANCE_ABI"
    },
    {
      artifact: "./artifacts/contracts/ChainCraftGovernanceAirdrop.sol/ChainCraftGovernanceAirdrop.json",
      output: "../src/lib/contracts/abis/airdrop.ts",
      export: "CHAINCRAFT_AIRDROP_ABI"
    },
    {
      artifact: "./artifacts/contracts/ChainCraftToken.sol/ChainCraftToken.json",
      output: "../src/lib/contracts/abis/token.ts",
      export: "CHAINCRAFT_TOKEN_ABI"
    }
  ];
  
  let successCount = 0;
  
  for (const update of updates) {
    if (extractAbi(update.artifact, update.output, update.export)) {
      successCount++;
    }
  }
  
  console.log(`\n📊 Summary: ${successCount}/${updates.length} ABIs updated successfully`);
  
  if (successCount === updates.length) {
    console.log("\n🎉 All ABIs have been updated with the latest compiled versions!");
  }
}

main().catch(console.error);
