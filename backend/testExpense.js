import fetch from 'node:http';

const data = JSON.stringify({
  title: "Shop Rent September",
  category: "Rent",
  amount: 3500,
  paymentMethod: "BANK",
  paymentSource: "BANK",
  notes: "Rent payment via Bank",
  createdBy: "peshawer shopadmin"
});

const req = fetch.request('http://localhost:5001/api/expenses/shop/1', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`Response: ${body}`);
  });
});

req.write(data);
req.end();
