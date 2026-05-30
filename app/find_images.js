const fs = require('fs');
const path = require('path');

function findRecentImages(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            findRecentImages(fullPath);
        } else if (file.endsWith('.png') || file.endsWith('.jpg')) {
            const timeDiff = Date.now() - stat.mtimeMs;
            if (timeDiff < 60 * 60 * 1000) { // 1 hour
                console.log(fullPath);
            }
        }
    }
}
findRecentImages('/app');
