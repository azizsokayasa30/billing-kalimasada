const http = require('http');

http.get('http://127.0.0.1:3003/admin/billing/customers?month=3&year=2026', {
  headers: {
    'Cookie': 'connect.sid=s%3A7aVxyE7l3d76y3D_u5eXp3mN7U4T8L6P.R2L4YvL4e0yvj0c0i1F8u6q4T8g1YvG2K1c0W9r0P4k' // using a dummy session might redirect to login...
// let's instead modify adminBilling.js to print what it computes
  }
});
