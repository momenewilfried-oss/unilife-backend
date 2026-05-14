const http = require('http');
const url = 'http://localhost:3002/app/download';
http.get(url, (res) => {
  console.log('statusCode', res.statusCode);
  console.log('headers', res.headers);
  let chunks = [];
  res.on('data', (chunk) => {
    chunks.push(chunk);
    if (Buffer.concat(chunks).length > 16) {
      res.destroy();
    }
  });
  res.on('close', () => {
    const buf = Buffer.concat(chunks);
    console.log('first bytes:', buf.slice(0, 16).toString('hex'));
    console.log('text peek:', buf.toString('utf8').slice(0, 64));
  });
}).on('error', (e) => {
  console.error('error', e);
});
