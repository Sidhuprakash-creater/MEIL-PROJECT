async function testAllUsers() {
  const users = [
    'admin@meil-esg.in',
    'rohit@meil-esg.in',
    'sunita@meil-esg.in',
    'kvenkat@meil-esg.in',
    'priya@meil-esg.in',
    'imran@meil-esg.in',
    'deepika@meil-esg.in',
    'rakesh@meil-esg.in',
    'nisha@meil-esg.in',
    'vikram@meil-esg.in',
    'anita@meil-esg.in',
    'sameer@meil-esg.in',
    'meena@meil-esg.in',
    'karthik@meil-esg.in',
    'rajesh@meil-esg.in',
    'finance@meil-esg.in',
  ];

  console.log('Testing Next.js port 3000 authentication for all 16 users:');
  let passed = 0;
  for (const email of users) {
    const res = await fetch('http://127.0.0.1:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'esg12345' })
    });
    if (res.status === 200) {
      const u = await res.json();
      const roleKey = u.roles?.[0]?.key || 'NO_ROLE';
      console.log(`[+] ${email.padEnd(25)} -> 200 OK | ${u.name.padEnd(20)} | Role: ${roleKey}`);
      passed++;
    } else {
      console.log(`[-] ${email.padEnd(25)} -> ${res.status}`);
    }
  }
  console.log(`Result: ${passed}/${users.length} accounts authenticated on port 3000!`);
}

testAllUsers();
