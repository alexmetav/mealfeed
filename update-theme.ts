import fs from 'fs';
import path from 'path';

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walk(dirPath, callback) : callback(path.join(dir, f));
  });
}

const replacements = [
  { from: /\bbg-black\b/g, to: 'bg-zinc-50 dark:bg-black' },
  { from: /\bbg-\[\#1c1c1e\]\b/g, to: 'bg-white dark:bg-[#1c1c1e]' },
  { from: /\btext-white\b/g, to: 'text-zinc-900 dark:text-white' },
  { from: /\btext-zinc-50\b/g, to: 'text-zinc-900 dark:text-zinc-50' },
  { from: /\btext-zinc-300\b/g, to: 'text-zinc-600 dark:text-zinc-300' },
  { from: /\btext-zinc-400\b/g, to: 'text-zinc-500 dark:text-zinc-400' },
  { from: /\bborder-white\/10\b/g, to: 'border-zinc-200 dark:border-white/10' },
  { from: /\bborder-white\/5\b/g, to: 'border-zinc-200 dark:border-white/5' },
  { from: /\bborder-white\/20\b/g, to: 'border-zinc-300 dark:border-white/20' },
  { from: /\bbg-white\/5\b/g, to: 'bg-zinc-100 dark:bg-white/5' },
  { from: /\bbg-white\/10\b/g, to: 'bg-zinc-200 dark:bg-white/10' },
  { from: /\bbg-white\/20\b/g, to: 'bg-zinc-300 dark:bg-white/20' },
  { from: /\bshadow-black\/20\b/g, to: 'shadow-zinc-200/50 dark:shadow-black/20' },
  { from: /\bshadow-black\/50\b/g, to: 'shadow-zinc-200/50 dark:shadow-black/50' },
  { from: /\bblue-500\b/g, to: 'orange-500' },
  { from: /\bblue-600\b/g, to: 'orange-600' },
  { from: /\bblue-400\b/g, to: 'orange-400' },
  { from: /\bblue-900\b/g, to: 'orange-900' },
  { from: /rgba\(59,130,246,/g, to: 'rgba(249,115,22,' }, // blue-500 rgb to orange-500 rgb
];

walk('./src', (filePath) => {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;
    
    replacements.forEach(r => {
      content = content.replace(r.from, r.to);
    });

    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Updated ${filePath}`);
    }
  }
});
