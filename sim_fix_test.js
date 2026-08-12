// 0.0001 deg is 11 meters.
// My test CSV:
// Lat,Lon,Time
// 0.0000,0.0000,1000
// 0.0010,0.0000,2000
// 0.0010,0.0010,3000
// 0.0000,0.0010,4000
// 0.0000,0.0000,5000
// 0.0010,0.0000,6000
// 0.0010,0.0010,7000
// 0.0000,0.0010,8000
// 0.0000,0.0000,9000
//
// 0.0010 deg = 111 meters.
// So the distance is well over 50m!
// Distances:
// pt 0 to pt 1: 111m. total 111m
// pt 1 to pt 2: 111m. total 222m
// pt 2 to pt 3: 111m. total 333m
// pt 3 to pt 4: 111m. total 444m. This is S/F zone!
// So pt 4 is a crossing.
// pt 4 to 5: 111m, total 555m
// pt 5 to 6: 111m, total 666m
// pt 6 to 7: 111m, total 777m
// pt 7 to 8: 111m, total 888m. S/F zone!
// So crossings are at 4, 8.
//
// Wait. Why didn't it work in the test?
// Ah! In `verify_replay.py` I wrote `page.goto("http://localhost:3000")`.
// But in `replay.spec.js` I wrote `await page.goto('/')`.
// Did `page.goto('/')` load the app? Yes, playwright test runs webserver.
// BUT in `replay.spec.js` I mock `const file = new File([csvData], "telemetry.csv", { type: "text/csv" });`.
// `type: "text/csv"`.
// Let's check `src/ui/upload.js`.
// "The file name needs to end in .gpx or .csv. And if it's .csv, it needs to contain lat/lon."
