// Test different header combinations
const tests = [
  {
    name: "Chrome on Windows (current)",
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
    },
  },
  {
    name: "Safari on Mac",
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Version/17.2 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-us",
      "Accept-Encoding": "gzip, deflate, br",
    },
  },
  {
    name: "Firefox on Windows",
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
      "Accept-Encoding": "gzip, deflate, br",
    },
  },
];

async function test(name, headers) {
  try {
    const res = await fetch("https://www.schev.edu", {
      method: "GET",
      redirect: "follow",
      headers,
    });
    console.log(`${name}: ${res.status}`);
  } catch (e) {
    console.log(`${name}: ERROR - ${e.message}`);
  }
}

async function runTests() {
  for (const t of tests) {
    await test(t.name, t.headers);
    await new Promise(r => setTimeout(r, 500));
  }
}

runTests();
