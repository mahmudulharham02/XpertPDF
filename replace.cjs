const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? 
      walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

walkDir('src', function(filePath) {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.css')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let hasChanges = false;
    
    if (content.includes('backdrop-blur-sm') || content.includes('backdrop-blur-md')) {
       content = content.replace(/ backdrop-blur-sm/g, '');
       content = content.replace(/backdrop-blur-sm/g, '');
       content = content.replace(/ backdrop-blur-md/g, '');
       content = content.replace(/backdrop-blur-md/g, '');
       hasChanges = true;
    }
    
    if (content.includes('duration-500')) {
       content = content.replace(/duration-500/g, 'duration-300'); // speed up animations
       hasChanges = true;
    }

    if (hasChanges) {
       fs.writeFileSync(filePath, content);
       console.log('Updated ' + filePath);
    }
  }
});
