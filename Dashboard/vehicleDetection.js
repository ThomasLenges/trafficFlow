// ───────────────────────── DOM REFERENCES ─────────────────────────
const deviceCard = document.getElementById("card-q");
const detectionCount = document.getElementById("number-detections");
const detectionLog   = document.getElementById("detection-log");
const emptyDetectionLogs = document.getElementById("detection-empty");
const deviceDot = document.getElementById("device-dot");
const deviceLastDetection = document.getElementById("time-q-detection");
const deviceLastConnection = document.getElementById("time-q-connection");

// ───────────────────────── INITIALIZE VALUES ─────────────────────────
if (localStorage.getItem("deviceLastDetection")) {
    deviceLastDetection.innerText = localStorage.getItem("deviceLastDetection");
}
if (localStorage.getItem("deviceLastConnection")) {
    deviceLastConnection.innerText = localStorage.getItem("deviceLastConnection");
}

// ───────────────────────── SOCKET.IO CONNECTION ─────────────────────────
const socket = io("http://bigq0.local:7000", {
    withCredentials: false
});

socket.on("connect", () => {
    console.log("SOCKET: Connected to UNO-Q WebUI");
    deviceCard.className = "device-card connected";
    deviceDot.className = "device-dot connected";
    deviceLastConnection.innerText = new Date().toLocaleTimeString("en-GB");
    localStorage.setItem("deviceLastConnection", deviceLastConnection.innerText);
});

socket.on("disconnect", () => {
    console.log("SOCKET: Disconnected from UNO-Q WebUI");
    deviceCard.className = "device-card disconnected";
    deviceDot.className = "device-dot disconnected";
    deviceLastConnection.innerText = new Date().toLocaleTimeString("en-GB");
    localStorage.setItem("deviceLastConnection", deviceLastConnection.innerText);
});

// ───────────────────────── DETECTION HANDLER ─────────────────────────
let detectionCountValue = 0;

socket.on("vehicle_detection", (message) => {
    //console.log("SOCKET: Received vehicle detection message:", message);

    const entries = JSON.parse(message);

    entries
        .filter(e => e.content.toLowerCase() === "vehicle")  // ignore non-vehicle detections, lower case required as the detection model returns "Vehicle" with a capital V
        .forEach(e => {
            if (emptyDetectionLogs) emptyDetectionLogs.remove();

            // ── Update UNO Q card ──
            detectionCountValue++;
            detectionCount.innerText = detectionCountValue;
            deviceLastDetection.innerText = new Date(e.timestamp).toLocaleTimeString("en-GB");
            localStorage.setItem("deviceLastDetection", deviceLastDetection.innerText);

            // ── Log entry ──
            const entry = document.createElement("div");
            entry.className = "log-entry";
            entry.innerHTML = `
                <span class="log-time">${new Date(e.timestamp).toLocaleTimeString("en-GB")}</span>
                <span class="log-topic">Vehicle Detected</span>
                <span class="log-payload">${e.confidence}% confidence</span>
            `;
            detectionLog.appendChild(entry);
            detectionLog.scrollTop = detectionLog.scrollHeight;

            // ── Local storage ──
            updateDetectionHistory(new Date(e.timestamp));
        });
});

// ───────────────────────── DETECTION HISTORY ─────────────────────────
const detectionHistory = JSON.parse(localStorage.getItem("detectionHistory") || "[]").map(e => ({
    timestamp: new Date(e.timestamp)  // convert string back to Date object
}));   // { timestamp: Date }

// ───────────────────────── CHART SETUP ─────────────────────────
const detectionCtx = document.getElementById("detection-chart").getContext("2d");
const detectionChart = new Chart(detectionCtx, {
    type: "bar",
    data: {
        labels: [],
        datasets: [{
            label:           "Detections",
            data:            [],
            borderColor:     "#0b18d6",
            borderWidth:     2,
            backgroundColor: "#081299",
        }]
    },
    options: {
        responsive: false,
        animation:  false,
        scales: {
            x: {
                ticks: { color: "#475569", font: { family: "Courier New" } },
                grid:  { color: "#1e2530" }
            },
            y: {
                min:   0,
                ticks: { color: "#475569", font: { family: "Courier New" }, stepSize: 1 },
                grid:  { color: "#1e2530" }
            }
        },
        plugins: {
            legend:  { display: false },
            tooltip: {
                backgroundColor: "#111318",
                borderColor:     "#1e2530",
                borderWidth:     1,
                titleColor:      "#475569",
                bodyColor:       "#38bdf8",
                titleFont:       { family: "Courier New" },
                bodyFont:        { family: "Courier New" },
            }
        }
    }
});
// To show restored data (KEY LINE TO PROPERLY WORK)
renderDetectionChart();

// // ───────────────────────── UPDATE RECORDS ─────────────────────────
function updateDetectionHistory(timestamp) {
    detectionHistory.push({ timestamp });
    saveDetectionHistory();
}

// //───────────────────────── CHART RENDER ─────────────────────────
// // Thanks Sonnet 4.6 because of how much I struggled with this for whatsoever reason
function renderDetectionChart() {

    const activeBtn = document.querySelector(".detection-filter-btn.active");
    const range     = activeBtn ? activeBtn.dataset.range : "5m";

    const ranges  = { "5m": 5*60*1000, "1h": 60*60*1000, "1d": 24*60*60*1000, "1w": 7*24*60*60*1000 };
    const buckets = { "5m": 30*1000,   "1h": 5*60*1000,  "1d": 60*60*1000,    "1w": 6*60*60*1000   };

    const bucketSize  = buckets[range];

    // Snap now to the NEXT bucket boundary — fixes bucket positions to wall-clock intervals
    const now    = new Date(Math.ceil(Date.now() / bucketSize) * bucketSize);
    const cutoff = new Date(now - ranges[range]);

    const filtered = detectionHistory.filter(e => e.timestamp >= cutoff);

    // Show "no data" message if no records match the filter
    const noDataMsg = document.getElementById("detection-no-data");
    if (filtered.length === 0) {
        noDataMsg.style.display = "block";
    } else {
        noDataMsg.style.display = "none";
    }

    //  ── Build buckets ──
    const bucketCount = Math.ceil(ranges[range] / bucketSize);
    const counts      = new Array(bucketCount).fill(0);

    filtered.forEach(e => {
        const age        = now - e.timestamp;               // ms ago
        const bucketIdx  = Math.floor((ranges[range] - age) / bucketSize); // 0 = oldest bucket
        if (bucketIdx >= 0 && bucketIdx < bucketCount) counts[bucketIdx]++;
    });

    // ── Build labels ──
    const formatLabel = (bucketIdx) => {
        const startTime = new Date(now - ranges[range] + bucketIdx * bucketSize);
        const endTime   = new Date(now - ranges[range] + (bucketIdx + 1) * bucketSize);

        if (range === "1d") {
            return startTime.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) 
                + " -> " 
                + endTime.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
        }
        if (range === "1w") {
            return startTime.toLocaleDateString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" })
                + " -> "
                + endTime.toLocaleDateString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" });
        }
        return startTime.toLocaleTimeString("en-GB") + " -> " + endTime.toLocaleTimeString("en-GB");
    };

    detectionChart.data.labels           = counts.map((_, i) => formatLabel(i));
    detectionChart.data.datasets[0].data = counts;
    detectionChart.update();
}

// // ───────────────────────── FILTER BUTTONS ─────────────────────────
document.querySelectorAll(".detection-filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        renderDetectionChart();
        document.querySelectorAll(".detection-filter-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        refreshDetectionChart();
    });
});

// // ───────────────────────── CLEAR HISTORY BUTTON ─────────────────────────
document.getElementById("detection-clear-btn").addEventListener("click", () => {
    if (!confirm("Clear all detection history?")) return;
    detectionHistory.length = 0;
    localStorage.removeItem("detectionHistory");
    renderDetectionChart();
});

// // ───────────────────────── SAVE HISTORY (One week max) ─────────────────────────
function saveDetectionHistory() {
    const oneWeekAgo = new Date(Date.now() - 7*24*60*60*1000);
    const pruned     = detectionHistory.filter(e => e.timestamp >= oneWeekAgo);
    localStorage.setItem("detectionHistory", JSON.stringify(pruned));
}

// // ───────────────────────── CONTINUOUS CHART REFRESH ─────────────────────────
function refreshDetectionChart() {
    renderDetectionChart();
    const refreshRates = { "5m": 30*1000, "1h": 5*60*1000, "1d": 60*60*1000, "1w": 6*60*60*1000 }; 
    const activeBtn = document.querySelector(".detection-filter-btn.active");
    const range     = activeBtn ? activeBtn.dataset.range : "5m";

    setInterval(renderDetectionChart, refreshRates[range]); // Refresh every 30 seconds to keep the chart updated even without new detections
    console.log("Refresh rate is", refreshRates[range]);
}

refreshDetectionChart();

// // ───────────────────────── COLOR PICKER ─────────────────────────
const detectionColorPicker = document.getElementById("detection-color-picker");

// Restore saved color from localStorage
const savedDetectionColor = localStorage.getItem("detectionChartColor");
if (savedDetectionColor) {
    detectionColorPicker.value = savedDetectionColor;
    applyDetectionChartColor(savedDetectionColor);
}

detectionColorPicker.addEventListener("input", (e) => {
    const color = e.target.value;
    localStorage.setItem("detectionChartColor", color);
    applyDetectionChartColor(color);
});

function applyDetectionChartColor(color) {
    detectionChart.data.datasets[0].borderColor          = color;
    detectionChart.data.datasets[0].backgroundColor      = color + "66"; // add transparency for filling below the temperature
    detectionChart.update();
}