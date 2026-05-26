let rainData = null;
const apiUrl = 'https://opendata.cwa.gov.tw/api/v1/rest/datastore/O-A0002-001?Authorization=rdec-key-123-45678-011121314';

// Mappa 地圖設定
// 台北市主要測站經緯度座標對照表 (用於地圖定位)
const stationCoords = {
  "湖田國小": { lat: 25.1528, lon: 121.5323 },
  "大屯國小": { lat: 25.1741, lon: 121.4925 },
  "桃源國中": { lat: 25.1397, lon: 121.4914 },
  "北投國小": { lat: 25.1321, lon: 121.5005 },
  "陽明高中": { lat: 25.0945, lon: 121.5148 },
  "太平國小": { lat: 25.0610, lon: 121.5111 },
  "民生國中": { lat: 25.0602, lon: 121.5606 },
  "中正國中": { lat: 25.0336, lon: 121.5201 },
  "三興國小": { lat: 25.0303, lon: 121.5583 },
  "格致國中": { lat: 25.1362, lon: 121.5387 },
  "平等國小": { lat: 25.1278, lon: 121.5714 },
  "至善國中": { lat: 25.1014, lon: 121.5489 },
  "碧湖國小": { lat: 25.0811, lon: 121.5878 },
  "東湖國小": { lat: 25.0689, lon: 121.6169 },
  "瑠公國中": { lat: 25.0372, lon: 121.5847 },
  "舊莊國小": { lat: 25.0402, lon: 121.6186 },
  "博嘉國小": { lat: 25.0000, lon: 121.5886 },
  "北政國中": { lat: 24.9861, lon: 121.5786 },
  "長安國小": { lat: 25.0489, lon: 121.5283 },
  "萬華國中": { lat: 25.0278, lon: 121.4986 },
  "台灣大學(新)": { lat: 25.0175, lon: 121.5397 },
  "雙園": { lat: 25.0232, lon: 121.4925 },
  "中洲": { lat: 25.1235, lon: 121.4608 }
};

let dataTime = ""; // 紀錄 Opendata 資料產生時間
let hoveredFromPanel = null; // 紀錄從左側面板懸停的站名
let myMap;
let canvas;
let mappa;
const options = {
  lat: 25.033, // 台北市中心緯度
  lng: 121.565, // 台北市中心經度
  zoom: 11,     // 縮放層級
  style: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" // 使用 OpenStreetMap 風格
};

function setup() {
  canvas = createCanvas(windowWidth, windowHeight);
  mappa = new Mappa('Leaflet'); // 在 setup 中初始化以確保庫已載入
  myMap = mappa.tileMap(options); // 初始化地圖
  myMap.overlay(canvas); // 將畫布覆蓋在地圖上

  // 啟動時先嘗試從本地儲存讀取上一次的資料 (存取 - 取)
  let cachedData = getItem("lastRainData");
  if (cachedData) {
    rainData = cachedData.data;
    dataTime = cachedData.time;
  }

  fetchRainData();
  
  // 每 10 分鐘自動更新一次資料 (600,000 毫秒)
  setInterval(fetchRainData, 600000);
}

function fetchRainData() {
  // 結合代理伺服器與 API 網址
  let timestamp = new Date().getTime();
  
  // 修正：移除代理伺服器以解決 413 (Content Too Large) 錯誤。
  // 氣象署 API 已支援 CORS，直接加上 format=JSON 參數即可。
  let requestUrl = apiUrl + "&format=JSON&t=" + timestamp;

  loadJSON(requestUrl, (data) => {
    try {
      let actualData = data;
      // 處理部分代理伺服器會將結果包在 contents 字串中的情況
      if (data && data.contents && typeof data.contents === 'string') {
        actualData = JSON.parse(data.contents.trim());
      }

      // 中央氣象署 API 資料位於 records.Station
      if (actualData && actualData.records && Array.isArray(actualData.records.Station)) {
        rainData = actualData.records.Station;
        if (rainData.length > 0) {
          // 修正：嘗試從 ObsTime.DateTime 或 ObservationTime 讀取時間
          let rawTime = "";
          if (rainData[0].ObsTime && rainData[0].ObsTime.DateTime) {
            rawTime = rainData[0].ObsTime.DateTime;
          } else {
            rawTime = rainData[0].ObservationTime || "";
          }
          // 格式化時間：將 "2024-05-26T11:00:00+08:00" 轉換為 "2024-05-26 11:00:00"
          dataTime = rawTime.replace('T', ' ').replace(/\+.*/, '');

          // 1. 自動存取至本地瀏覽器儲存 (存取 - 存)，以便下次開啟網頁時立即顯示
          storeItem("lastRainData", { data: rainData, time: dataTime });
        }
      } else {
        rainData = [];
      }
      
      console.log("資料更新成功，獲取到 " + rainData.length + " 筆測站資料");
    } catch (e) {
      console.error("解析 JSON 資料失敗:", e);
      rainData = [];
    }
  }, (err) => {
    console.error("請求失敗，可能是代理伺服器或政府 API 暫時斷線:", err);
    // 如果抓取失敗，給予空陣列以避免 draw() 發生錯誤，並顯示提示
    rainData = [];
  });
}

function draw() {
  // 清除畫布，讓底下的地圖顯示出來
  clear();

  // 繪製標題背景遮罩
  fill(30, 40, 60, 200);
  noStroke();
  rect(0, 0, width, 70);
  fill(255);
  textSize(22);
  textAlign(LEFT, TOP);
  text("台北市即時雨量監測", 20, 12);
  textSize(14);
  text("資料觀測時間: " + (dataTime || "載入中..."), 20, 45);
  
  drawLegend(); // 繪製顏色圖例

  if (!rainData) {
    text("資料載入中...", 20, 60);
    return;
  }

  if (rainData.length === 0) {
    textSize(14);
    text("無法取得即時資料，顯示測站座標中...", 20, 60);
    // 即使沒資料也繼續執行，以顯示面板
  }

  let hoveredStation = null;

  // 繪製地圖上的雨量點
  for (const stationName in stationCoords) {
    const predefinedStation = stationCoords[stationName];
    const lat = predefinedStation.lat;
    const lon = predefinedStation.lon;

    let rainVal = 0; // 預設雨量值為 0

    // 從氣象署 API 數據中查找對應的測站資料
    const cwaStationData = rainData.find(s => s.StationName === stationName);
    if (cwaStationData && cwaStationData.RainfallElement && cwaStationData.RainfallElement.Now) {
      rainVal = parseFloat(cwaStationData.RainfallElement.Now.Precipitation);
    }
    
    // 檢查經緯度是否為有效數字
    // 這裡使用 predefinedStation 的經緯度，因為這是我們希望顯示的固定位置
    // rainVal 則來自 CWA API 的即時資料
    if (!isNaN(lat) && !isNaN(lon)) {
      // 將經緯度轉換為畫布上的像素座標
      const pos = myMap.latLngToPixel(lat, lon);
      
      // 設定大小
      let size = map(rainVal, 0, 50, 15, 80); 
      size = constrain(size, 8, 150);

      // 如果是從左側面板懸停，則加大直徑
      if (stationName === hoveredFromPanel) {
        size *= 2;
        strokeWeight(4);
        stroke(255, 255, 0); // 黃色外框加強提示
      } else {
        strokeWeight(1);
        stroke(0);
      }
      
      // 檢查滑鼠是否在地圖圓點上懸停
      let d = dist(mouseX, mouseY, pos.x, pos.y);
      if (d < size / 2 + 2) {
        hoveredStation = { name: stationName, value: rainVal, x: pos.x, y: pos.y };
      } else {
        strokeWeight(1);
      }
      
      // 使用六級分類顏色
      fill(getRainColor(rainVal));

      ellipse(pos.x, pos.y, size, size);
    }
  }

  // 繪製懸停資訊框
  if (hoveredStation) {
    drawTooltip(hoveredStation);
  }

  // 繪製左側資料面板
  drawSidePanel();
  
  // 繪製右上角天氣效果
  drawWeatherIcon();
}

// 六級降雨分類顏色邏輯
function getRainColor(val) {
  if (val <= 0)    return color(135, 206, 235, 200); // 天空藍 (無降雨)
  if (val <= 0.5)  return color(0, 255, 255, 200);   // 青色 (極微量)
  if (val <= 10)   return color(255, 255, 0, 220);   // 太陽黃 (輕微)
  if (val <= 20)   return color(255, 165, 0, 220);   // 橘色 (中等)
  if (val <= 40)   return color(255, 0, 0, 220);     // 紅色 (大雨)
  return color(128, 0, 128, 220);                    // 紫色 (豪雨)
}

function drawSidePanel() {
  let panelW = 200;
  let startY = 90;
  let itemH = 25;

  // 面板背景
  fill(0, 0, 0, 150);
  rect(10, startY - 10, panelW, (Object.keys(stationCoords).length * itemH) + 20, 5);

  hoveredFromPanel = null;
  let i = 0;
  textSize(12);
  textAlign(LEFT, CENTER);

  for (const name in stationCoords) {
    let y = startY + i * itemH;
    let cwaStationData = rainData.find(s => s.StationName === name);
    let rainVal = cwaStationData ? parseFloat(cwaStationData.RainfallElement.Now.Precipitation) : 0;

    // 檢查滑鼠是否懸停在文字上
    if (mouseX > 10 && mouseX < 10 + panelW && mouseY > y - 10 && mouseY < y + 10) {
      hoveredFromPanel = name;
      fill(255, 255, 0); // 懸停變黃色
    } else {
      fill(255);
    }

    text(`${name}: ${rainVal} mm`, 20, y);
    i++;
  }
}

function drawLegend() {
  let lx = width - 180;
  let ly = height - 170;
  
  fill(0, 0, 0, 150);
  rect(lx - 10, ly - 10, 170, 160, 5);
  textSize(12);
  textAlign(LEFT, CENTER);

  let labels = [
    { min: 40.1, label: "> 40 (豪雨)", color: [128, 0, 128] },
    { min: 20.1, label: "20 - 40 (大雨)", color: [255, 0, 0] },
    { min: 10.1, label: "10 - 20 (中雨)", color: [255, 165, 0] },
    { min: 0.6,  label: "0.6 - 10 (小雨)", color: [255, 255, 0] },
    { min: 0.1,  label: "0.1 - 0.5 (微雨)", color: [0, 255, 255] },
    { min: 0,    label: "0 (無雨)", color: [135, 206, 235] }
  ];

  for (let i = 0; i < labels.length; i++) {
    fill(labels[i].color);
    ellipse(lx + 10, ly + 10 + i * 25, 15, 15);
    fill(255);
    text(labels[i].label, lx + 30, ly + 10 + i * 25);
  }
}

function drawWeatherIcon() {
  let iconX = width - 80;
  let iconY = 100;
  
  // 判斷是否正在下雨 (只針對地圖上顯示的台北市測站進行判斷)
  let isRaining = false;
  if (rainData) {
    isRaining = rainData.some(s => {
      // 只檢查在 stationCoords 名單內的測站，且降雨量需大於 0 (排除掉 -99 等異常值)
      return stationCoords.hasOwnProperty(s.StationName) && 
             s.RainfallElement && 
             s.RainfallElement.Now && 
             parseFloat(s.RainfallElement.Now.Precipitation) > 0;
    });
  }

  push();
  translate(iconX, iconY);
  if (isRaining) {
    // 繪製下雨圖示 (雲 + 雨滴)
    fill(180);
    noStroke();
    ellipse(0, 0, 60, 40);
    ellipse(-20, 10, 40, 30);
    ellipse(20, 10, 40, 30);
    
    stroke(100, 200, 255);
    strokeWeight(3);
    for(let i=0; i<5; i++) {
      let rx = -20 + i*10;
      let ry = 25 + (frameCount % 10);
      line(rx, ry, rx - 5, ry + 10);
    }
    fill(255);
    noStroke();
    textAlign(CENTER);
    text("下雨中", 0, 60);
  } else {
    // 繪製大太陽
    fill(255, 200, 0);
    stroke(255, 150, 0);
    strokeWeight(2);
    ellipse(0, 0, 50, 50);
    // 太陽光芒
    for (let n = 0; n < 12; n++) {
      let angle = TWO_PI / 12 * n;
      let x1 = cos(angle) * 30;
      let y1 = sin(angle) * 30;
      let x2 = cos(angle) * 45;
      let y2 = sin(angle) * 45;
      line(x1, y1, x2, y2);
    }
    fill(255);
    noStroke();
    textAlign(CENTER);
    text("天晴", 0, 60);
  }
  pop();
}

function drawTooltip(s) {
  let txt = s.name + "\n降雨量: " + s.value + " mm";
  let tw = textWidth(txt) + 20;
  let th = 50;
  
  push();
  translate(s.x + 10, s.y - 60);
  fill(0, 0, 0, 200);
  stroke(255);
  rect(0, 0, tw, th, 5);
  
  fill(255);
  noStroke();
  textSize(14);
  textAlign(LEFT, TOP);
  text(txt, 10, 10);
  pop();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
