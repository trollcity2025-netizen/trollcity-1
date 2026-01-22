const fs = require('fs');
const path = require('path');

// Read function names
const content = fs.readFileSync('pleasefix', 'utf8');
const issues = JSON.parse(content);
const targetFunctions = new Set(issues
  .filter(i => i.name === 'function_search_path_mutable')
  .map(i => i.metadata.name));

console.log(`Found ${targetFunctions.size} unique functions to fix.`);

const migrationsDir = path.join(__dirname, 'supabase', 'migrations');
const rootDir = __dirname;

const migrationFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).map(f => path.join(migrationsDir, f));
const rootFiles = fs.readdirSync(rootDir).filter(f => f.endsWith('.sql')).map(f => path.join(rootDir, f));
const allFiles = [...migrationFiles, ...rootFiles];

const functionSignatures = new Map(); // funcName -> Set(args)

for (const filePath of allFiles) {
  const sql = fs.readFileSync(filePath, 'utf8');
  
  for (const funcName of targetFunctions) {
    // Regex to find function definition
    // Matches: CREATE [OR REPLACE] FUNCTION [public.]funcName (...) RETURNS
    const regex = new RegExp(`CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+(?:public\\.)?${funcName}\\s*\\(([\\s\\S]*?)\\)\\s+RETURNS`, 'gi');
    
    let match;
    while ((match = regex.exec(sql)) !== null) {
      let args = match[1].replace(/\s+/g, ' ').trim();
      if (!functionSignatures.has(funcName)) {
        functionSignatures.set(funcName, new Set());
      }
      functionSignatures.get(funcName).add(args);
    }
  }
}

let sqlOutput = `-- Fix function search_path mutable issues\n`;
let noSigCount = 0;

for (const funcName of targetFunctions) {
  if (functionSignatures.has(funcName)) {
    const signatures = functionSignatures.get(funcName);
    for (const args of signatures) {
      sqlOutput += `ALTER FUNCTION public.${funcName}(${args}) SET search_path = 'public, extensions';\n`;
    }
  } else {
    // Try without arguments (works if unique)
    sqlOutput += `ALTER FUNCTION public.${funcName} SET search_path = 'public, extensions';\n`;
    noSigCount++;
  }
}

fs.writeFileSync('supabase/migrations/20270123000000_fix_function_search_paths.sql', sqlOutput);
console.log(`Migration generated. ${noSigCount} functions used no-arg ALTER.`);
