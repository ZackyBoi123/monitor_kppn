//* SUPABASE CONFIGURATION
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";  

const SUPABASE_URL = 'https://kntomoredgduvwbovgpx.supabase.co';    // Supabase URL
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtudG9tb3JlZGdkdXZ3Ym92Z3B4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2MzI0NzcsImV4cCI6MjA3MDIwODQ3N30.Ei7vJ8RQCiz7KPXis6He8dVzL91Euocxzxzg1ptg1_U'; // Replace with your Supabase anon key
const BUDGET_TABLE_NAME = 'tabel_donatPaguRealisasi';                     // table for pie/doughnut charts
const COMPARISON_TABLE_NAME = 'tabel_barChartPaguRealisasi';              // table for bar chart

//* INITIALIZE SUPABASE CLIENT
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', function() {
    //* CHECK IF LIBRARY IS LOADED
    if (typeof Chart === 'undefined') {
        console.error('Chart.js not loaded');
        showToast('Error: Chart.js library failed to load', 'error');
        return;
    }

    //* INITIALIZE EVENT LISTENERS & START LOADING DATA
    initializeEventListeners();
    loadDataFromSupabase();
});

let budgetData = [];
let comparisonData = [];
let paguChart = null;
let realisasiChart = null;
let comparisonChart = null;

//* COLOR PALLETE FOR CHARTS
const colors = [
    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', 
    '#9966FF', '#FF9F40', '#f097abff', '#68f5d2',
    '#4BC0C0', '#d37c8fff', '#36A2EB', '#FFCE56'
];

//* MONTHS FOR LINE CHART
const monthlyLabels = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const monthlyPagu = [150, 430, 270, 400, 600, 800, 500, 560, 700, 500, 800, 1000];
const monthlyRealisasi = [500, 700, 800, 650, 900, 1200, 1000, 950, 1100, 1250, 1300, 1400];

//* PIE + DOUGHNUT CHART CONFIG
const chartConfig = {
    type: 'doughnut',
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    padding: 20,
                    usePointStyle: true,
                    font: {
                        size: 12,
                        weight: '600'
                    }
                }
            },
            tooltip: {
                backgroundColor: 'rgba(0,0,0,0.8)',
                titleColor: '#fff',
                bodyColor: '#fff',
                borderColor: 'rgba(255,255,255,0.2)',
                borderWidth: 1,
                cornerRadius: 10,
                callbacks: {
                    label: function(context) {
                        const value = context.parsed;
                        const total = context.dataset.data.reduce((a, b) => a + b, 0);
                        const percentage = ((value / total) * 100).toFixed(1);
                        return `${context.label}: ${formatCurrency(value)} (${percentage}%)`;
                    }
                }
            }
        },
        cutout: '60%',
        animation: {
            animateRotate: true,
            animateScale: true,
            duration: 1000,
            easing: 'easeOutQuart'
        }
    }
};

const ctxMonthly = document.getElementById("monthlyLineChart").getContext("2d");
const gradient = ctxMonthly.createLinearGradient(0, 0, 0, 400);
gradient.addColorStop(0, "rgba(75, 192, 192, 0.4)");
gradient.addColorStop(1, "rgba(75, 192, 192, 0)");

//* LINE CHART BUILDER
const monthlyLineChart = new Chart(ctxMonthly, {
  type: "line",
  data: {
    labels: monthlyLabels,
    datasets: [
      {
        label: "Dummy data",
        data: monthlyRealisasi,
        borderColor: "rgba(75, 192, 192, 1)",
        backgroundColor: gradient,
        fill: false,
        tension: 0.4,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBackgroundColor: "#fff",
        pointBorderWidth: 2
      },
      {
        label: "Dummy data",
        data: monthlyPagu, // e.g. [1000, 1200, 1100, ...]
        borderColor: "rgba(255, 99, 132, 1)", // different color
        borderWidth: 2,
        fill: false,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: "#fff",
        pointBorderColor: "rgba(255, 99, 132, 1)",
        pointBorderWidth: 2
      }
    ]
  },
  options: {
    maintainAspectRatio: false,
    responsive: true,
    plugins: {
      tooltip: {
        callbacks: {
          label: function(context) {
            return "Rp " + context.formattedValue.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
          }
        }
      }
    },
    interaction: {
      mode: "nearest",
      axis: "x",
      intersect: false
    },
    scales: {
      x: {
        grid: { color: "rgba(200,200,200,0.2)" },
        title: { display: true, text: "Bulan" }
      },
      y: {
        grid: { color: "rgba(200,200,200,0.2)" },
        title: { display: true, text: "Realisasi (Rp)" },
        beginAtZero: true
      }
    }
  }
});

//* FORMAT CURRENCY
function formatCurrency(amount) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

//* SHOW ALERT MESSAGE
function showToast(msg){
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 2325);
}

//* LOAD DATA FROM SUPABASE - both tables
async function loadDataFromSupabase() {
    try {
        
        //* FETCH DATA FROM BOTH TABLES SIMULTANEOUSLY
        const [budgetResponse, comparisonResponse] = await Promise.all([
            supabaseClient.from(BUDGET_TABLE_NAME).select('*'),
            supabaseClient.from(COMPARISON_TABLE_NAME).select('*')
        ]);

        //* CHECK FOR ERRORS IN BUDGET TABLE
        if (budgetResponse.error) {
            throw new Error(`Budget table query error: ${budgetResponse.error.message}`);
        }

        //* CHECK FOR ERRORS IN COMPARISON TABLE
        if (comparisonResponse.error) {
            throw new Error(`Comparison table query error: ${comparisonResponse.error.message}`);
        }

        if (!budgetResponse.data || budgetResponse.data.length === 0) {
            throw new Error(`No data found in budget table: ${BUDGET_TABLE_NAME}`);
        }

        if (!comparisonResponse.data || comparisonResponse.data.length === 0) {
            throw new Error(`No data found in comparison table: ${COMPARISON_TABLE_NAME}`);
        }
        
        //* PROCESS BUDGET DATA (for pie/doughnut charts)
        budgetData = budgetResponse.data.map((row) => {
            const processedRow = {
                Region: row.region || row.Region || '',
                Category: row.category || row.Category || '',
                Pagu: 0,
                Realisasi: 0
            };

            //* PARSE PAGU
            const paguValue = row.pagu || row.Pagu;
            if (paguValue !== null && paguValue !== undefined) {
                const paguNum = typeof paguValue === 'string' ? 
                    parseFloat(paguValue.toString().replace(/[,\.]/g, '')) : 
                    parseFloat(paguValue);
                if (!isNaN(paguNum)) {
                    processedRow.Pagu = paguNum;
                }
            }

            //* PARSE REALISASI
            const realisasiValue = row.realisasi || row.Realisasi;
            if (realisasiValue !== null && realisasiValue !== undefined) {
                const realisasiNum = typeof realisasiValue === 'string' ? 
                    parseFloat(realisasiValue.toString().replace(/[,\.]/g, '')) : 
                    parseFloat(realisasiValue);
                if (!isNaN(realisasiNum)) {
                    processedRow.Realisasi = realisasiNum;
                }
            }

            return processedRow;
        }).filter(row => {
            return row.Region && row.Category && row.Region !== '' && row.Category !== '';
        });

        //* PROCESS COMPARISON DATA (for bar chart)
        comparisonData = comparisonResponse.data.map((row, index) => {
            const processedRow = {
                Category: row.category || row.Category || '',
                Pagu: 0,
                Realisasi: 0
            };

            //* PARSE PAGU
            const paguValue = row.pagu || row.Pagu;
            if (paguValue !== null && paguValue !== undefined) {
                const paguNum = typeof paguValue === 'string' ? 
                    parseFloat(paguValue.toString().replace(/[,\.]/g, '')) : 
                    parseFloat(paguValue);
                if (!isNaN(paguNum)) {
                    processedRow.Pagu = paguNum;
                }
            }

            //* PARSE REALISASI
            const realisasiValue = row.realisasi || row.Realisasi;
            if (realisasiValue !== null && realisasiValue !== undefined) {
                const realisasiNum = typeof realisasiValue === 'string' ? 
                    parseFloat(realisasiValue.toString().replace(/[,\.]/g, '')) : 
                    parseFloat(realisasiValue);
                if (!isNaN(realisasiNum)) {
                    processedRow.Realisasi = realisasiNum;
                }
            }

            return processedRow;
        }).filter(row => {
            return row.Category && row.Category !== '';
        });
        
        populateRegionDropdown();
        
        //* HIDE SKELETON AND SHOW CONTENT
        document.getElementById('skeletonLoader').style.display = 'none';
        
        //* FADE-IN DASHBOARD SECTIONS
        const sections = ['statsContainer','mapContainer', 'chartsContainer', 'tableContainer', 'controlsPanel'];
        sections.forEach(id => {
            const el = document.getElementById(id);
            el.style.display = '';                          //? remove display:none
            setTimeout(() => el.classList.add('show'), 50); //? slight delay so transition triggers
        });
        
        showToast('Data loaded successfully!', 'success');

    } catch (error) {
        console.error('❌ Error:', error);
        showToast(`Error loading data: ${error.message}`, 'error');
        document.getElementById('skeletonLoader').style.display = 'none';
    }
}

//* FILL DROPDOWN WITH REGION
function populateRegionDropdown() {
  const regions = [...new Set(budgetData.map(item => item.Region))].sort();

  const menu = document.querySelector("#regionDropdownMenu .py-1");
  const label = document.getElementById("regionDropdownLabel");

  //* CLEAR OLD ITEMS
  menu.innerHTML = "";

  regions.forEach(region => {
    const item = document.createElement("div");
    item.href = "#";
    item.className = "block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 no-underline";
    item.textContent = region;

    item.addEventListener("click", e => {
      e.preventDefault();
      label.textContent = region;   //? update button label
      updateCharts(region);         //? update dashboard
      document.getElementById("regionDropdownMenu").classList.add("hidden");
    });

    menu.appendChild(item);
  });

  //* DEFAULT SELECTION
  if (regions.length > 0) {
    label.textContent = regions[5];
    updateCharts(regions[5]);
  }
}

//* LAST UPDATED TIMESTAMP
async function getLastUpdated() {
  const { data, error } = await supabaseClient
    .from('tabel_barChartPaguRealisasi')
    .select('updated_at')
    .order('updated_at', { ascending: false })
    .limit(1);

    if (error) {
      console.error("Error fetching last updated time:", error);
      return;
    }

    if (data.length > 0) {
      const lastUpdated = new Date(data[0].updated_at);
      document.getElementById("last-Updated").textContent = "Last Updated: " + lastUpdated.toLocaleString("id-ID", {year: 'numeric',month: 'numeric', day: 'numeric',  hour: 'numeric', minute: 'numeric', hour12: true});
      document.getElementById("barTable").textContent = "Pagu & Realisasi (" + lastUpdated.toLocaleString("id-ID", {year: 'numeric',month: 'numeric', day: 'numeric'}) + ")";
      document.getElementById("tableData").textContent = "Tabel Data Pagu & Realisasi (" + lastUpdated.toLocaleString("id-ID", {year: 'numeric',month: 'numeric', day: 'numeric'}) + ")";
    }
}

//* Toggle dropdown open/close
document.getElementById("regionDropdownButton").addEventListener("click", () => {
  document.getElementById("regionDropdownMenu").classList.toggle("hidden");
});

//* Close dropdown when clicking outside
document.addEventListener("click", e => {
  const dropdown = document.getElementById("regionDropdownMenu");
  if (!dropdown.contains(e.target) && !document.getElementById("regionDropdownButton").contains(e.target)) {
    dropdown.classList.add("hidden");
  }
});

//* Wire up Vercel Analytics
window.si = window.si || function () { (window.siq = window.siq || []).push(arguments); };
window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };

//* Initialize all event listeners
function initializeEventListeners() {

    //* Region selector
    const regionSelector = document.getElementById('regionSelector');
    if (regionSelector) {
        regionSelector.addEventListener('change', function() {
            if (this.value) {
                updateCharts(this.value);
            }
        });
    }

    //* Refresh button
    document.getElementById('refreshData').addEventListener('click', () => {
        showToast('Refreshing data...', 'info');
        loadDataFromSupabase();
    });

  //* Export buttons
  const refreshData = document.getElementById('refreshData');
    
    if (refreshData) refreshData.addEventListener('click', refreshDataHandler);

  //* Mobile menu toggle
  const mobileMenuButton = document.getElementById("mobileMenuButton");
    if (mobileMenuButton) {
        mobileMenuButton.addEventListener("click", () => {
            document.getElementById("mobileMenu").classList.toggle("hidden");
        });
    }

  //* Auto-hide navbar on scroll
  let lastScrollTop = 0;
  const navbar = document.getElementById("navbar");

    if (navbar) {
        window.addEventListener("scroll", () => {
            let scrollTop = window.scrollY || document.documentElement.scrollTop;

            if (scrollTop > lastScrollTop) {
                //* Scrolling down → hide navbar
                navbar.style.transform = "translateY(-100%)";
            } else {
                //* Scrolling up → show navbar
                navbar.style.transform = "translateY(0)";
            }

            lastScrollTop = scrollTop <= 0 ? 0 : scrollTop; //? avoid negative
        });
    }
}

//* Toggle profile dropdown
const profileBtn = document.getElementById("profileBtn");
  const dropdownMenu = document.getElementById("dropdownMenu");

  profileBtn.addEventListener("click", () => {
    if (dropdownMenu.classList.contains("hidden")) {
      dropdownMenu.classList.remove("hidden");
      setTimeout(() => {
        dropdownMenu.classList.remove("scale-95", "opacity-0");
        dropdownMenu.classList.add("scale-100", "opacity-100");
      }, 10);
    } else {
      dropdownMenu.classList.remove("scale-100", "opacity-100");
      dropdownMenu.classList.add("scale-95", "opacity-0");
      setTimeout(() => dropdownMenu.classList.add("hidden"), 200);
    }
  });

  //* Close when clicking outside
  document.addEventListener("click", (e) => {
    if (!profileBtn.contains(e.target) && !dropdownMenu.contains(e.target)) {
      dropdownMenu.classList.remove("scale-100", "opacity-100");
      dropdownMenu.classList.add("scale-95", "opacity-0");
      setTimeout(() => dropdownMenu.classList.add("hidden"), 200);
    }
  });


//* Check session on page load
    async function checkSession() {
    const {
      data: { user }
    } = await supabaseClient.auth.getUser();

    if (!user) {
      window.location.href = "login.html";
    } else {
      document.getElementById("appBody").style.display = "block"; //? show only if logged in
    }
  }

  checkSession();

//* Log out function
  document.getElementById("logoutLink").addEventListener("click", async (e) => {
    e.preventDefault(); //? prevent link navigation
    await supabaseClient.auth.signOut();
    window.location.href = "login.html";
  });

function refreshDataHandler() {
    
    //* Hide content and show skeleton
    document.getElementById('statsContainer').style.display = 'none';
    document.getElementById('chartsContainer').style.display = 'none';
    document.getElementById('papuaMap').style.display = 'none';
    document.getElementById('mapContainer').style.display = 'none';
    document.getElementById('tableContainer').style.display = 'none';
    document.getElementById('controlsPanel').style.display = 'none';
    document.getElementById('skeletonLoader').style.display = 'block';
    
    //* Clear existing data
    budgetData = [];
    comparisonData = [];
    
    //* Reload data
    loadDataFromSupabase();
}

//* Update charts based on selected region
function updateCharts(selectedRegion) {
    const regionData = budgetData.filter(item => item.Region === selectedRegion);
    
    //* Process data for charts
    const paguCategories = [];
    const paguValues = [];
    const realisasiCategories = [];
    const realisasiValues = [];

    regionData.forEach(item => {
        if (item.Pagu && item.Pagu > 0) {
            paguCategories.push(item.Category);
            paguValues.push(item.Pagu);
        }
        if (item.Realisasi && item.Realisasi > 0) {
            realisasiCategories.push(item.Category);
            realisasiValues.push(item.Realisasi);
        }
    });

    //* Update charts - pie/doughnut use budget data with region filter, bar chart shows all categories
    updateChart('paguChart', paguCategories, paguValues, 'Pagu');
    updateChart('realisasiChart', realisasiCategories, realisasiValues, 'Realisasi');
    updateBarChart();                 //? No parameters - shows all categories
    updateDataTable(selectedRegion);  //? Pass selectedRegion parameter
    updateStats(regionData);
    getLastUpdated();

    //* Show charts and table
    document.getElementById('chartsContainer').style.display = 'grid';
    document.getElementById('statsContainer').style.display = 'grid';
    document.getElementById('tableContainer').style.display = 'block';
    document.getElementById('mapContainer').style.display = 'block';
    document.getElementById('papuaMap').style.display = 'block';
    document.getElementById('controlsPanel').style.display = 'block';
}

//* Update chart function - handles both Pagu and Realisasi charts
function updateChart(canvasId, labels, data, type) {
    const ctx = document.getElementById(canvasId).getContext('2d');

    //* Destroy existing chart
    if (canvasId === 'paguChart' && paguChart) {
        paguChart.destroy();
    } else if (canvasId === 'realisasiChart' && realisasiChart) {
        realisasiChart.destroy();
    }

    //* Detect if on mobile
    const isMobile = window.innerWidth < 768;

    //* Shared dataset styling
    const datasetConfig = {
        data: data,
        backgroundColor: colors.slice(0, labels.length),
        borderColor: '#fff',
        borderWidth: isMobile ? 1 : 2,      //? ✅ lighter borders on mobile
        hoverOffset: isMobile ? 4 : 8       //? ✅ smaller offset on mobile
    };

    //* Animation settings
    const animationConfig = isMobile ? false : {
        animateRotate: true,
        animateScale: true,
        duration: 1000,
        easing: 'easeOutQuart'
    };

    let config;

    if (canvasId === 'paguChart') {
        //* Doughnut chart for Pagu
        config = {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [datasetConfig]
            },
            options: {
                ...chartConfig.options,
                cutout: '60%',
                animation: animationConfig   
            }
        };
    } else {
        //* Pie chart for Realisasi
        config = {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [datasetConfig]
            },
            options: {
                ...chartConfig.options,
                cutout: '0%',
                animation: animationConfig   
            }
        };
    }

    if (canvasId === 'paguChart') {
        paguChart = new Chart(ctx, config);
    } else {
        realisasiChart = new Chart(ctx, config);
    }
}

//* Map chart function start point
function getColorByRatio(ratio){
    if (ratio == null || isNaN(ratio)) return "#6c757d";  //? Gray for no data
    if (ratio >= 0.9) return "#006837";                   //? Dark green - 90%+
    if (ratio >= 0.75) return "#31a354";                  //? Medium green - 75-89%
    if (ratio >= 0.5) return "#78c679";                   //? Light green - 50-74%
    if (ratio >= 0.25) return "#fecc5c";                  //? Yellow/Orange - 25-49%
    return "#e31a1c";                                     //? Red - 0-24%
}

//* Add legends to map
function addLegend(map) {
  const legend = L.control({ position: 'bottomleft' });

  legend.onAdd = function () {
    const div = L.DomUtil.create('div', 'legend');
    div.style.background = 'rgba(255,255,255,0.95)';
    div.style.padding = '10px';
    div.style.borderRadius = '8px';
    div.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
    div.style.fontSize = '12px';
    div.style.lineHeight = '1.4';
    
    const grades = [0.9, 0.75, 0.5, 0.25, 0];
    div.innerHTML = '<strong class="legend-row" style="margin-bottom: 8px; display: block;"><i class="fas fa-info-circle me-1 text-blue-700"></i>Tingkat Realisasi</strong>';

    for (let i = 0; i < grades.length; i++) {
      const from = grades[i];
      const to = grades[i + 1];
      const color = getColorByRatio(from + 0.001);
      const label = to
        ? `${Math.round(from * 100)}–${Math.round(to * 100)}%`
        : `${Math.round(from * 100)}%+`;
      
      div.innerHTML += `<div class="legend-row" style="display: flex; align-items: center; margin-bottom: 4px;">
                          <i style="background:${color}; width:18px; height:12px; margin-right:8px; display:inline-block; border-radius:2px;"></i> 
                          <span>${label}</span>
                        </div>`;
    }

    //* Add "No data" entry
    div.innerHTML += `<div class="legend-row" style="display: flex; align-items: center; margin-top: 6px;">
                        <i style="background:${getColorByRatio(null)}; width:18px; height:12px; margin-right:8px; display:inline-block; border-radius:2px;"></i> 
                        <span>No Data</span>
                      </div>`;

    return div;
  };

  legend.addTo(map);
}

//* --- Fetch region budget data from Supabase ---
async function fetchRegionBudgets() {
  const { data, error } = await supabaseClient
    .from('tabel_donatPaguRealisasi')  // <- Changed table name here
    .select('Region, Pagu, Realisasi'); 

  if (error) {
    console.error("Supabase error:", error.message);
    return {};
  }

  if (!data || data.length === 0) {
    console.warn("Supabase returned no rows. Check table name/columns.");
    return {};
  }

  // Group data by region and sum totals
  const regionTotals = {};
  
  for (const row of data) {
    const region = (row.region || row.Region || '').trim();
    const pagu = Number(row.pagu ?? row.Pagu) || 0;
    const realisasi = Number(row.realisasi ?? row.Realisasi) || 0;

    if (!region) continue;

    const regionKey = region.toLowerCase();
    
    if (!regionTotals[regionKey]) {
      regionTotals[regionKey] = {
        pagu: 0,
        realisasi: 0
      };
    }
    
    // Sum the values for each region
    regionTotals[regionKey].pagu += pagu;
    regionTotals[regionKey].realisasi += realisasi;
  }
  
  return regionTotals;
}

  async function initMap() {
  const map = L.map('papuaMap', { 
    zoomControl: true,
    //* Add attribution control with custom position and prefix
    attributionControl: false //? We'll add our own
  }).setView([-5, 138.5], 6);

  //* Add custom attribution control
  L.control.attribution({
    position: 'bottomright',
    prefix: false //? This removes the "Powered by Leaflet" text
  }).addTo(map);

  //* Clean/light basemap with custom attribution
  const tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '<div style="font-size: 0.65rem;">KPPN Jayapura &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a></div>',
    maxZoom: 19,
    subdomains: 'abcd'
  }).addTo(map);

  //* Add custom map control
  map.addControl(new CustomMapControl({ position: 'topleft' }));

  try {
    //* Load Supabase data first with error handling
    const regionData = await fetchRegionBudgets();
    console.log("Region data loaded:", Object.keys(regionData).length, "regions");

    //* Helper to look up region data (case-insensitive)
    const lookup = (name) => regionData[String(name || "").trim().toLowerCase()] || null;

    //* Load and add province layer
    try {
      const provinceResp = await fetch('geoBoundaries-IDN-ADM1.json');
      if (!provinceResp.ok) {
        throw new Error(`Failed to load province boundaries: ${provinceResp.status}`);
      }
      const provinceGeo = await provinceResp.json();

      const provinceLayer = L.geoJSON(provinceGeo, {
        style: (f) => ({
          color: '#1f78b4',
          weight: 2,
          fillOpacity: 0,
          dashArray: '5, 5' //? Make it dashed to distinguish from kabupaten
        }),
        onEachFeature: (feature, layer) => {
          const shapeName = feature.properties.shapeName || feature.properties.ADM1_NAME || feature.properties.NAME_1;
          const data = lookup(shapeName) || { pagu: null, realisasi: null };
          const popupHtml = `<div class="popup-card">
                               <strong>${shapeName}</strong><br>
                               Pagu: ${data.pagu != null ? data.pagu.toLocaleString('id-ID') : 'N/A'}<br>
                               Realisasi: ${data.realisasi != null ? data.realisasi.toLocaleString('id-ID') : 'N/A'}
                             </div>`;
          layer.bindPopup(popupHtml);
        }
      }).addTo(map);

      console.log("Province layer loaded successfully");
    } catch (error) {
      console.error("Error loading province boundaries:", error);
      //? Continue without province layer
    }

    //* Load and add kabupaten layer
    try {
      const kabResp = await fetch('geoBoundaries-IDN-ADM2.json');
      if (!kabResp.ok) {
        throw new Error(`Failed to load kabupaten boundaries: ${kabResp.status}`);
      }
      const kabGeo = await kabResp.json();
      console.log("Kabupaten GeoJSON loaded, features:", kabGeo.features.length);

      //* Default style function
      function defaultStyle(feature) {
        const shapeName = feature.properties.shapeName || feature.properties.ADM2_NAME || feature.properties.NAME_2;
        const data = lookup(shapeName);
        const ratio = data && data.pagu > 0 ? data.realisasi / data.pagu : null;
        
        return {
          color: '#333',
          weight: 1,
          fillColor: getColorByRatio(ratio),
          fillOpacity: 0.7,
          className: 'leaflet-interactive' //? Add CSS class for better styling
        };
      }

      //* Highlight style
      function highlightStyle() {
        return { 
          weight: 3, 
          color: '#000', 
          fillOpacity: 0.9 
        };
      }

      const kabLayer = L.geoJSON(kabGeo, {
        style: defaultStyle,
        onEachFeature: (feature, layer) => {
            const shapeName = feature.properties.shapeName || feature.properties.ADM2_NAME || feature.properties.NAME_2;
            const data = lookup(shapeName) || { pagu: null, realisasi: null };
            const ratio = (data && data.pagu > 0) ? (data.realisasi / data.pagu) : null;
            
            //* Create badge with exact color matching
            let badgeHtml = '';
            if (ratio != null) {
                const percentage = (ratio * 100).toFixed(1);
                const bgColor = getColorByRatio(ratio);
                const textColor = ratio >= 0.25 ? '#fff' : '#000'; //? White text for dark colors, black for light
                badgeHtml = `<span class="popupinfo-badge" style="background-color: ${bgColor}; color: ${textColor};">
                                <i class="fas fa-percentage" style="margin-right: 4px;"></i>${percentage}%
                            </span>`;
            } else {
                badgeHtml = `<span class="popupinfo-badge" style="background-color: #6c757d; color: #fff;">
                                N/A
                            </span>`;
            }

            const popupHtml = `
                <div class="popupinfo" style="min-width: 200px;">
                    <h5 style="margin-bottom: 10px; color: #333; border-bottom: 2px solid #667eea; padding-bottom: 5px;" class="popupinfo">
                        <i class="fas fa-map-marker-alt me-2"></i>${shapeName}
                    </h5>
                    <div style="margin: 8px 0;">
                        <strong><i class="fas fa-wallet me-1"></i>Pagu:</strong> 
                        <span style="color: #0066cc;">${data.pagu != null ? formatCurrency(data.pagu) : 'N/A'}</span>
                    </div>
                    <div style="margin: 8px 0;">
                        <strong><i class="fas fa-chart-line me-1"></i>Realisasi:</strong> 
                        <span style="color: #28a745;">${data.realisasi != null ? formatCurrency(data.realisasi) : 'N/A'}</span>
                    </div>
                    <div style="margin: 4px 0;text-align: center;">
                        <strong>Tingkat Realisasi:</strong><br>
                        ${badgeHtml}
                    </div>
                </div>
            `;
            
            layer.bindPopup(popupHtml, {
                maxWidth: 300,
                className: 'custom-popup'
            });

            layer.on({
                mouseover: function(e) {
                    const layer = e.target;
                    layer.setStyle(highlightStyle());
                    info.update({
                        name: shapeName,
                        pagu: data.pagu,
                        realisasi: data.realisasi,
                        ratio: ratio
                    });
                    if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
                        layer.bringToFront();
                    }
                },
                mouseout: function(e) {
                    kabLayer.resetStyle(e.target);
                    info.update();
                },
                click: function(e) {
                    map.fitBounds(e.target.getBounds(), { padding: [20, 20] });
                }
            });
        }
    }).addTo(map);

      console.log("Kabupaten layer loaded successfully");
      
      //* Add legend after kabupaten layer is loaded
      addLegend(map);

      //* Add info control
      const info = L.control({ position: 'topright' });
      info.onAdd = function () {
        this._div = L.DomUtil.create('div', 'info-control');
        this.update();
        return this._div;
      };
      
      info.update = function (props) {
        const formatCurrency = (amount) => {
            return new Intl.NumberFormat('id-ID', {
                style: 'currency',
                currency: 'IDR',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(amount);
        };
        
        if (props) {
            let rateBadge = '';
            if (props.ratio != null) {
              
                const percentage = (props.ratio * 100).toFixed(1);
                const bgColor = getColorByRatio(props.ratio);
                const textColor = props.ratio >= 0.25 ? '#fff' : '#000';
                rateBadge = `<div style="margin-top: 8px;"><strong>Rate:</strong> 
                            <span style="background-color: ${bgColor}; color: ${textColor}; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 0.8rem;">
                                ${percentage}%
                            </span></div>`;
            } 
            else {
                rateBadge = `<div style="margin-top: 8px;"><strong>Rate:</strong> 
                            <span style="background-color: #6c757d; color: #fff; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 0.8rem;">
                                N/A
                            </span></div>`;
            }

            this._div.innerHTML = `<div class="hoverinfo">
                <h6 class="fw-bold"><i class="fa-solid fa-location-dot text-blue-700"></i> ${props.name}</h6>
                <div><strong>Pagu:</strong><span class="text-primary fw-bold"> ${props.pagu != null ? formatCurrency(props.pagu) : 'N/A'}</span></div>
                <div><strong>Realisasi:</strong><span class="text-success fw-bold"> ${props.realisasi != null ? formatCurrency(props.realisasi) : 'N/A'}</span></div>
                </div>
                `;
        } else {
            this._div.innerHTML = `<div class="hovertip">
                <h6><i class="fas fa-info-circle me-1"></i>Hover pada wilayah</h6>
                <div class="opacity-50 text-xs">untuk melihat detail anggaran</div>
                </div>
            `;
        }
    };
      info.addTo(map);

      //* Update info control on hover
      kabLayer.eachLayer(layer => {
        layer.on('mouseover', () => {
        });
        layer.on('mouseout', () => info.update());
      });

    } catch (error) {
      console.error("Error loading kabupaten boundaries:", error);
      //* Show error message to user
      const errorControl = L.control({ position: 'topleft' });
      errorControl.onAdd = function() {
        const div = L.DomUtil.create('div', 'leaflet-control leaflet-bar');
        div.style.background = '#ffebee';
        div.style.padding = '10px';
        div.innerHTML = '<strong>Error:</strong> Could not load map boundaries';
        return div;
      };
      errorControl.addTo(map);
    }

    //* Force map to invalidate size after everything loads
    setTimeout(() => {
      map.invalidateSize();
      console.log("Map size invalidated");
    }, 100);

  } catch (error) {
    console.error("Error in map initialization:", error);
    //* Show error in map container
    const mapContainer = document.getElementById('papuaMap');
    mapContainer.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; height: 100%; background: #f5f5f5; color: #666;">
        <div style="text-align: center;">
          <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 1rem;"></i>
          <p>Failed to load map data</p>
          <small>${error.message}</small>
        </div>
      </div>
    `;
  }
}

  //* Custom map control with two buttons (Reset, Fullscreen)
const CustomMapControl = L.Control.extend({
  onAdd: function(map) {
    const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
    div.style.background = 'white';
    div.style.cursor = 'pointer';

    //* Reset button
    const resetBtn = L.DomUtil.create('a', 'map-btn', div);
    resetBtn.innerHTML = '⟳'; //? Home icon
    resetBtn.href = '#';
    resetBtn.title = 'Reset View';
    resetBtn.style.display = 'block';
    resetBtn.style.padding = '5px';
    resetBtn.style.textAlign = 'center';
    resetBtn.onclick = (e) => {
      e.preventDefault();
      map.setView([-5, 138.5], 6);
    };

    //* Fullscreen button
    const fullBtn = L.DomUtil.create('a', 'map-btn', div);
    fullBtn.innerHTML = '⛶'; //? Fullscreen icon
    fullBtn.href = '#';
    fullBtn.title = 'Toggle Fullscreen';
    fullBtn.style.display = 'block';
    fullBtn.style.padding = '5px';
    fullBtn.style.textAlign = 'center';
    fullBtn.style.borderTop = '1px solid #ccc';
    fullBtn.onclick = async (e) => {
      e.preventDefault();
      try {
        const mapElement = document.getElementById('papuaMap');
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        } else if (mapElement.requestFullscreen) {
          await mapElement.requestFullscreen();
        }
        //* Invalidate size after fullscreen change
        setTimeout(() => map.invalidateSize(), 100);
      } catch (error) {
        console.log('Fullscreen not supported or failed');
      }
    };

    return div;
  }
});

  //* start
  initMap().catch(err => console.error(err));

//* Updated function for bar chart - now shows all categories without region filter
function updateBarChart() {
    const ctx = document.getElementById('comparisonChart').getContext('2d');
    
    //* Destroy existing chart
    if (comparisonChart) {
        comparisonChart.destroy();
    }

    //* Use ALL data from comparison table (no region filter)
    const allComparisonData = comparisonData;

    //* Prepare data for bar chart
    const categories = allComparisonData.map(item => item.Category);
    const paguData = allComparisonData.map(item => item.Pagu || 0);
    const realisasiData = allComparisonData.map(item => item.Realisasi || 0);

    const config = {
        type: 'bar',
        data: {
            labels: categories,
            datasets: [
                {
                    label: 'Pagu',
                    data: paguData,
                    backgroundColor: '#36A2EB',
                    borderColor: '#36A2EB',
                    borderWidth: 1,
                    borderRadius: 4,
                },
                {
                    label: 'Realisasi',
                    data: realisasiData,
                    backgroundColor: '#FF6384',
                    borderColor: '#FF6384',
                    borderWidth: 1,
                    borderRadius: 4,
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        padding: 20,
                        usePointStyle: true,
                        font: {
                            size: 12,
                            weight: '600'
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: 'rgba(255,255,255,0.2)',
                    borderWidth: 1,
                    cornerRadius: 10,
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${formatCurrency(context.parsed.y)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 0,
                        font: {
                            size: 10
                        }
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0,0,0,0.1)'
                    },
                    ticks: {
                        callback: function(value) {
                            return formatCurrency(value);
                        },
                        font: {
                            size: 10
                        }
                    }
                }
            },
            animation: {
                duration: 1000,
                easing: 'easeOutQuart'
            }
        }
    };

    comparisonChart = new Chart(ctx, config);
}

//* Update data table  
function updateDataTable() {
    const tableBody = document.querySelector('#budgetTable tbody');
    tableBody.innerHTML = '';

    //* Use data from comparisonData 
    comparisonData.forEach(item => {
        const row = document.createElement('tr');
        const realizationRate = item.Pagu > 0 ? ((item.Realisasi / item.Pagu) * 100).toFixed(1) : 0;

        row.innerHTML = `
            <td class="fw-bold">${item.Category}</td>
            <td class="text-end">${formatCurrency(item.Pagu || 0)}</td>
            <td class="text-end">${formatCurrency(item.Realisasi || 0)}</td>
            <td class="text-end">
                <span class="badge ${realizationRate >= 80 ? 'bg-success' : realizationRate >= 50 ? 'bg-warning' : 'bg-danger'}">
                    ${realizationRate}%
                </span>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

//* Update stats section with totals and realization rate
function updateStats(regionData) {
    const totalPagu = regionData.reduce((sum, item) => sum + (item.Pagu || 0), 0);
    const totalRealisasi = regionData.reduce((sum, item) => sum + (item.Realisasi || 0), 0);
    const realizationRate = totalPagu > 0 ? ((totalRealisasi / totalPagu) * 100).toFixed(1) : 0;

    document.getElementById('totalPagu').textContent = formatCurrency(totalPagu);
    document.getElementById('totalRealisasi').textContent = formatCurrency(totalRealisasi);
    document.getElementById('realizationRate').textContent = `${realizationRate}%`;
}