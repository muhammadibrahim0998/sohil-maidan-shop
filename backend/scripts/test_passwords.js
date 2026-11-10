async function run() {
  const passwordsToTest = [
    { pwd: 'super123456', expect: 200 },
    { pwd: 'super123456.', expect: 200 },
    { pwd: 'admin123', expect: 401 },
    { pwd: 'admin', expect: 401 },
    { pwd: '123456', expect: 401 },
    { pwd: 'superadmin', expect: 401 },
    { pwd: 'super12345', expect: 401 },
    { pwd: 'wrongpass', expect: 401 }
  ];

  console.log('Testing password restrictions for Super Admin (Mainyet123@gmail.com):\n');
  for (const item of passwordsToTest) {
    try {
      const res = await fetch('http://localhost:5001/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'Mainyet123@gmail.com', password: item.pwd })
      });
      const data = await res.json();
      const status = res.status;
      const pass = status === item.expect;
      console.log(`Password: '${item.pwd.padEnd(14)}' => Status: ${status} (${data.message || (data.success ? 'Success' : 'Failed')}) | Result: ${pass ? '✅ PASSED' : '❌ FAILED'}`);
    } catch (e) {
      console.error('Error:', e.message);
    }
  }
}

run();
