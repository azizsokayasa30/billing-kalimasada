const http = require('http');

http.get('http://127.0.0.1:3006/admin/billing/customers?month=3&year=2026', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    // Extract the card values
    const match = data.match(/<h3 class="mb-0 fw-bold mt-2" style="color:#6366f1;">(.*?)<\/h3>/);
    console.log("Total Pelanggan from HTML:", match ? match[1].trim() : "not found");
  });
}).on("error", (err) => {
  console.log("Error: " + err.message);
});
