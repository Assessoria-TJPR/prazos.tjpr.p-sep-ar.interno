const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  page.on('console', msg => {
    if (msg.text().includes('FINAL DATE:')) {
      fs.writeFileSync('output_browser_test.txt', msg.text());
      console.log('Result:', msg.text());
    }
  });

  await page.goto('file://' + require('path').resolve('test_browser.html'));
  await browser.close();
})();
