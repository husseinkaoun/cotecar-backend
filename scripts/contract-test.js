// scripts/contract-test.js
const API = "http://localhost:3000";

async function main() {
  // 1) login (change email/password to existing)
  const loginRes = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "husseinkaoun@icloud.com", password: "YOUR_PASSWORD" }),
  });

  const loginText = await loginRes.text();
  console.log("LOGIN status:", loginRes.status);
  console.log("LOGIN body:", loginText);

  if (!loginRes.ok) return;

  const { token } = JSON.parse(loginText);

  // 2) public cars
  const carsRes = await fetch(`${API}/cars`, {
    headers: { Authorization: `Bearer ${token}` }, // remove if /cars is public
  });
  console.log("CARS status:", carsRes.status);
  const cars = await carsRes.json();
  console.log("FIRST CAR keys:", Object.keys(cars[0] || {}));
  console.log("FIRST CAR owner:", cars[0]?.owner);
}

main().catch(console.error);
