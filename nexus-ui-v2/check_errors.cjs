const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    
    page.on('console', msg => {
        console.log(`[PAGE CONSOLE] ${msg.type()}: ${msg.text()}`);
    });
    
    page.on('pageerror', err => {
        console.log(`[PAGE ERROR] ${err.message}`);
    });
    
    await page.goto('http://localhost:8081/', { waitUntil: 'networkidle0' });
    
    console.log("Page loaded. Waiting 3 seconds for animations...");
    await new Promise(r => setTimeout(r, 3000));
    
    await browser.close();
})();
