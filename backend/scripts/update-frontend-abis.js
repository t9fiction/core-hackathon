const fs = require('fs');
const path = require('path');

console.log("🔄 Updating Frontend ABIs with Latest Compiled Versions");
console.log("=" .repeat(60));

// Path to artifacts
const artifactsPath = path.join(__dirname, '..', 'artifacts', 'contracts');

// Path to frontend ABIs
const frontendAbisPath = path.join(__dirname, '..', '..', 'src', 'lib', 'contracts', 'abis');

// Contract mappings: artifact file name -> frontend file name
const contracts = {
  'ChainCraftGovernance.sol/ChainCraftGovernance.json': 'governance.ts',
  'ChainCraftFactoryLite.sol/ChainCraftFactoryLite.json': 'factory.ts',
  'ChainCraftToken.sol/ChainCraftToken.json': 'token.ts'
};

// Extract and update ABIs
Object.entries(contracts).forEach(([artifactPath, frontendFile]) => {
  const fullArtifactPath = path.join(artifactsPath, artifactPath);
  const frontendFilePath = path.join(frontendAbisPath, frontendFile);
  
  console.log(`\n📄 Processing ${artifactPath}...`);
  
  try {
    // Read the artifact
    const artifactContent = fs.readFileSync(fullArtifactPath, 'utf8');
    const artifact = JSON.parse(artifactContent);
    
    // Extract contract name and ABI
    const contractName = artifact.contractName;
    const abi = artifact.abi;
    
    // Determine ABI export name based on contract
    let abiExportName;
    switch(contractName) {
      case 'ChainCraftGovernance':
        abiExportName = 'CHAINCRAFT_GOVERNANCE_ABI';
        break;
      case 'ChainCraftFactoryLite':
        abiExportName = 'CHAINCRAFT_FACTORY_ABI';
        break;
      case 'ChainCraftToken':
        abiExportName = 'CHAINCRAFT_TOKEN_ABI';
        break;
      default:
        abiExportName = `${contractName.toUpperCase()}_ABI`;
    }
    
    // Generate TypeScript content
    const tsContent = `// ${contractName} Contract ABI - Auto-generated from compiled artifact
export const ${abiExportName} = ${JSON.stringify(abi, null, 2)} as const;`;

    // Write to frontend file
    fs.writeFileSync(frontendFilePath, tsContent);
    
    console.log(`✅ Updated ${frontendFile} with ${contractName} ABI`);
    console.log(`   → ${abi.length} functions/events/errors exported as ${abiExportName}`);
    
  } catch (error) {
    console.error(`❌ Error processing ${artifactPath}:`, error.message);
  }
});

console.log(`\n🎉 ABI update complete!`);
console.log("=" .repeat(60));
console.log("📁 Updated files:");
console.log("   → src/lib/contracts/abis/governance.ts");
console.log("   → src/lib/contracts/abis/factory.ts");
console.log("   → src/lib/contracts/abis/token.ts");
console.log("\n⚠️  Note: Make sure to update the main index file if needed:");
console.log("   → src/lib/contracts/abis/index.ts");
