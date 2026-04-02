const fs = require('fs');
const code = fs.readFileSync('dist/assets/SetupPage-DqRH82gI.js', 'utf-8');

// Find all 'const X' or 'let X' declarations with their positions
const regex = /\b(const|let)\s+([A-Za-z_$][\w$]*)\s*=/g;
const declarations = [];
let match;
while ((match = regex.exec(code)) !== null) {
  declarations.push({
    name: match[2],
    pos: match.index,
  });
}

// For each declaration, check if the variable name appears before its declaration
for (const decl of declarations) {
  const beforeDecl = code.substring(0, decl.pos);
  // Look for the variable used as a standalone reference
  const escapedName = decl.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const usageRegex = new RegExp('(?<![.\\w$])' + escapedName + '(?![\\w$=(?:])', 'g');
  let usageMatch;
  while ((usageMatch = usageRegex.exec(beforeDecl)) !== null) {
    // Skip if it's inside a string
    const charBefore = beforeDecl[usageMatch.index - 1];
    if (charBefore === '"' || charBefore === "'" || charBefore === '`') continue;
    
    // Get context
    const start = Math.max(0, usageMatch.index - 40);
    const end = Math.min(beforeDecl.length, usageMatch.index + decl.name.length + 40);
    const context = beforeDecl.substring(start, end).replace(/[\n\r]/g, ' ');
    
    console.log('TDZ candidate:', decl.name, '(declared at pos', decl.pos + ')');
    console.log('  Used at pos', usageMatch.index, ':', '...' + context + '...');
    console.log();
    break; // Only show first match per variable
  }
}
console.log('Total const/let declarations found:', declarations.length);
