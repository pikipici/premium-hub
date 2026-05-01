const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'app', '(public)', 'product', 'sosmed', 'page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace('Clock3,', 'Clock3,\n  ChevronLeft,\n  ChevronRight,');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Icons added!');
