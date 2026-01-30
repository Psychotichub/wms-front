require('dotenv').config();

const env = require('../src/config/env');
const API_BASE = env.requireApiUrlEnv();

const payload = {
  name: 'suresh',
  email: '4psychotic@gmail.com',
  password: '787223',
  company: 'Sion',
  site: 'Arsi',
  role: 'admin',
};

async function main() {
  try {
    const res = await fetch(`${API_BASE}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    if (!res.ok) {
      console.error('Signup failed', res.status, data);
      process.exit(1);
    }

    console.log('Signup success:', data);
  } catch (err) {
    console.error('Signup error:', err);
    process.exit(1);
  }
}

main();

