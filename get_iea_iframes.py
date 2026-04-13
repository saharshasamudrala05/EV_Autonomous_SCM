from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By
import json
import time

# 1. Setup Browser
options = webdriver.ChromeOptions()
# options.add_argument('--headless') # Keep browser visible to see the scrolling
driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)

print("Opening IEA Report...")
url = "https://www.iea.org/reports/energy-technology-perspectives-2024"
driver.get(url)

# 2. Lazy Loading Fix: Scroll down to ensure all iframes are loaded
print("Scrolling to load charts...")
last_height = driver.execute_script("return document.body.scrollHeight")
for i in range(5): # Scroll down 5 times
    driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
    time.sleep(2)

# 3. Find all Iframes
iframes = driver.find_elements(By.TAG_NAME, "iframe")
print(f"\nFound {len(iframes)} Iframes. Checking each for charts...\n")

all_charts = []

for index, frame in enumerate(iframes):
    try:
        # --- THE MAGIC SWITCH ---
        # We must tell Selenium to "jump" inside the iframe
        driver.switch_to.frame(frame)
        
        # Run the extraction JS inside the iframe
        script = """
        var data = [];
        if (typeof Highcharts !== 'undefined' && Highcharts.charts) {
            Highcharts.charts.forEach(function(chart) {
                if (chart) {
                    var series = [];
                    chart.series.forEach(s => {
                        series.push({ name: s.name, data: s.options.data });
                    });
                    data.push({ title: chart.title.textStr, series: series });
                }
            });
        }
        return data;
        """
        
        chart_data = driver.execute_script(script)
        
        if chart_data:
            print(f"[SUCCESS] Found {len(chart_data)} chart(s) in Iframe {index+1}")
            all_charts.extend(chart_data)
        
        # --- SWITCH BACK ---
        # Important: Go back to main page before checking the next iframe
        driver.switch_to.default_content()
        
    except Exception as e:
        # If an iframe is blocked or empty, just skip it and switch back
        driver.switch_to.default_content()

# 4. Save Data
if all_charts:
    with open("iea_final_data.json", "w", encoding="utf-8") as f:
        json.dump(all_charts, f, indent=4)
    print(f"\nAll Done! Saved {len(all_charts)} charts to 'iea_final_data.json'.")
else:
    print("\nNo charts found. They might be using 'D3.js' or static images instead of Highcharts.")

driver.quit()