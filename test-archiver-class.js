const archiver = require('archiver');
const fs = require('fs');
const path = require('path');
const frontendPath = path.resolve(__dirname, '../unilife-front-end');
const output = fs.createWriteStream('test-class.zip');
const Archive = archiver.ZipArchive || archiver.Archiver;
console.log('Archive class:', Archive && Archive.name);
const archive = new Archive({ zlib: { level: 9 } });
archive.on('error', err => { console.error('ERR', err); process.exit(1); });
output.on('close', () => { console.log('closed', archive.pointer()); });
archive.pipe(output);
archive.directory(frontendPath, false);
archive.finalize();

