async function testFetch() {
  console.log("Testing fetch to https://www.schev.edu with Firefox UA...");
  
  try {
    const res = await fetch("https://www.schev.edu", {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Referer": "https://www.google.com/",
      },
    });
    
    console.log(`Status: ${res.status}`);
    console.log(`Content-Type: ${res.headers.get("content-type")}`);
    
    if (res.ok) {
      const html = await res.text();
      console.log(`HTML length: ${html.length}`);
      console.log("SUCCESS!");
    } else {
      console.log(`FAILED: ${res.status}`);
    }
  } catch (e) {
    console.error("ERROR:", e.message);
  }
}

testFetch();
