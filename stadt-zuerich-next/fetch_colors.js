const https = require('https');
https.get('https://www.stadt-zuerich.ch/etc/designs/stzh/assets/css/main.min.css', (resp) => {
  let data = '';
  resp.on('data', (chunk) => { data += chunk; });
  resp.on('end', () => {
    const colors = data.match(/#[0-9a-fA-F]{3,6}/g);
    const uniqueColors = [...new Set(colors)];
    console.log(uniqueColors.slice(0, 50));
  });
}).on("error", (err) => {
  console.log("Error: " + err.message);
});
