const fs = require('fs');
const content = fs.readFileSync('pleasefix', 'utf8');
const issues = JSON.parse(content);
const functions = issues
  .filter(i => i.name === 'function_search_path_mutable')
  .map(i => i.metadata.name);
const uniqueFunctions = [...new Set(functions)];
console.log(uniqueFunctions.join('\n'));
