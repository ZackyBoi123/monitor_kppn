// Supabase configuration
const SUPABASE_URL = 'https://kntomoredgduvwbovgpx.supabase.co';    // Supabase URL
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtudG9tb3JlZGdkdXZ3Ym92Z3B4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2MzI0NzcsImV4cCI6MjA3MDIwODQ3N30.Ei7vJ8RQCiz7KPXis6He8dVzL91Euocxzxzg1ptg1_U'; // Replace with your Supabase anon key
const BUDGET_TABLE_NAME = 'paguRealisasi';                          // table for pie/doughnut charts
const COMPARISON_TABLE_NAME = 'barPaguRealisasi';                   // table for bar chart

// Initialize Supabase client
const { createClient } = supabase;
let supabaseClient = null;

document.addEventListener('DOMContentLoaded', function() {
    // Check if libraries are loaded
    if (typeof Chart === 'undefined') {
        console.error('Chart.js not loaded');
        document.getElementById('loadingIndicator').innerHTML = 'Error: Chart.js library failed to load';
        return;
    }
    if (typeof supabase === 'undefined') {
        console.error('Supabase not loaded');
        document.getElementById('loadingIndicator').innerHTML = 'Error: Supabase library failed to load';
        return;
    }

    // Initialize Supabase client
    try {
        supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('Supabase client initialized');
    } catch (error) {
        console.error('Failed to initialize Supabase client:', error);
        document.getElementById('loadingIndicator').innerHTML = 'Error: Failed to initialize Supabase client. Check your configuration.';
        return;
    }

    // Start loading data
    loadDataFromSupabase();
});

let budgetData = [];
let comparisonData = []; // New variable for bar chart data
let paguChart = null;
let realisasiChart = null;
let comparisonChart = null;

// Color palette for charts
const colors = [
    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', 
    '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF',
    '#4BC0C0', '#FF6384', '#36A2EB', '#FFCE56'
];

// Chart configuration
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

// Format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

// Load data from Supabase - both tables
async function loadDataFromSupabase() {
    try {
        // Fetch data from both tables simultaneously
        const [budgetResponse, comparisonResponse] = await Promise.all([
            supabaseClient.from(BUDGET_TABLE_NAME).select('*'),
            supabaseClient.from(COMPARISON_TABLE_NAME).select('*')
        ]);

        // Check for errors in budget table
        if (budgetResponse.error) {
            throw new Error(`Budget table query error: ${budgetResponse.error.message}`);
        }

        // Check for errors in comparison table
        if (comparisonResponse.error) {
            throw new Error(`Comparison table query error: ${comparisonResponse.error.message}`);
        }

        if (!budgetResponse.data || budgetResponse.data.length === 0) {
            throw new Error(`No data found in budget table: ${BUDGET_TABLE_NAME}`);
        }

        if (!comparisonResponse.data || comparisonResponse.data.length === 0) {
            throw new Error(`No data found in comparison table: ${COMPARISON_TABLE_NAME}`);
        }
        
        // Process budget data (for pie/doughnut charts)
        budgetData = budgetResponse.data.map((row) => {
            const processedRow = {
                Region: row.region || row.Region || '',
                Category: row.category || row.Category || '',
                Pagu: 0,
                Realisasi: 0
            };

            // Parse Pagu
            const paguValue = row.pagu || row.Pagu;
            if (paguValue !== null && paguValue !== undefined) {
                const paguNum = typeof paguValue === 'string' ? 
                    parseFloat(paguValue.toString().replace(/[,\.]/g, '')) : 
                    parseFloat(paguValue);
                if (!isNaN(paguNum)) {
                    processedRow.Pagu = paguNum;
                }
            }

            // Parse Realisasi
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

        // Process comparison data (for bar chart) - no region needed
        comparisonData = comparisonResponse.data.map((row, index) => {
            const processedRow = {
                Category: row.category || row.Category || '',
                Pagu: 0,
                Realisasi: 0
            };

            // Parse Pagu
            const paguValue = row.pagu || row.Pagu;
            if (paguValue !== null && paguValue !== undefined) {
                const paguNum = typeof paguValue === 'string' ? 
                    parseFloat(paguValue.toString().replace(/[,\.]/g, '')) : 
                    parseFloat(paguValue);
                if (!isNaN(paguNum)) {
                    processedRow.Pagu = paguNum;
                }
            }

            // Parse Realisasi
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
        document.getElementById('skeletonLoader').style.display = 'none';
            // Fade-in dashboard sections
            const sections = ['statsContainer', 'chartsContainer', 'tableContainer'];
            sections.forEach(id => {
                const el = document.getElementById(id);
                el.style.display = ''; // remove display:none
                setTimeout(() => el.classList.add('show'), 50); // slight delay so transition triggers
            });

    } catch (error) {
        console.error('❌ Error:', error);
        showDebug('❌ ERROR: ' + error.message);
        document.getElementById('loadingIndicator').innerHTML = `
            <div style="color: #ff6b6b; font-weight: bold; margin-bottom: 15px;">❌ Error: ${error.message}</div>
            <div style="font-size: 0.9rem; opacity: 0.9;">
                <strong>Common fixes:</strong><br>
                • Check your Supabase URL and API key are correct<br>
                • Verify your table names are correct:<br>
                &nbsp;&nbsp;- Budget table: ${BUDGET_TABLE_NAME}<br>
                &nbsp;&nbsp;- Comparison table: ${COMPARISON_TABLE_NAME}<br>
                • Make sure both tables have columns: region/Region, category/Category, pagu/Pagu, realisasi/Realisasi<br>
                • Check Row Level Security (RLS) policies allow public read access for both tables<br>
                • Check the debug info above for more details
            </div>
        `;
    }
}

function populateRegionDropdown() {
  const regions = [...new Set(budgetData.map(item => item.Region))].sort();

  const menu = document.querySelector("#regionDropdownMenu .py-1");
  const label = document.getElementById("regionDropdownLabel");

  // Clear old items
  menu.innerHTML = "";

  regions.forEach(region => {
    const item = document.createElement("a");
    item.href = "#";
    item.className = "block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100";
    item.textContent = region;

    item.addEventListener("click", e => {
      e.preventDefault();
      label.textContent = region;   // update button label
      updateCharts(region);         // update dashboard
      document.getElementById("regionDropdownMenu").classList.add("hidden");
    });

    menu.appendChild(item);
  });

  // Default selection
  if (regions.length > 0) {
    label.textContent = regions[5];
    updateCharts(regions[5]);
  }
}

// Toggle dropdown open/close
document.getElementById("regionDropdownButton").addEventListener("click", () => {
  document.getElementById("regionDropdownMenu").classList.toggle("hidden");
});

// Close dropdown when clicking outside
document.addEventListener("click", e => {
  const dropdown = document.getElementById("regionDropdownMenu");
  if (!dropdown.contains(e.target) && !document.getElementById("regionDropdownButton").contains(e.target)) {
    dropdown.classList.add("hidden");
  }
});

// Update charts based on selected region
function updateCharts(selectedRegion) {
    const regionData = budgetData.filter(item => item.Region === selectedRegion);
    
    // Process data for charts
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

    // Update charts - pie/doughnut use budget data with region filter, bar chart shows all categories
    updateChart('paguChart', paguCategories, paguValues, 'Pagu');
    updateChart('realisasiChart', realisasiCategories, realisasiValues, 'Realisasi');
    updateBarChart(); // No parameters - shows all categories
    updateDataTable(); // No parameters - shows all categories
    updateStats(regionData);

    // Show charts and table
    document.getElementById('chartsContainer').style.display = 'grid';
    document.getElementById('statsContainer').style.display = 'grid';
    document.getElementById('tableContainer').style.display = 'block';
}

// Update chart function - handles both Pagu and Realisasi charts
function updateChart(canvasId, labels, data, type) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    
    // Destroy existing chart
    if (canvasId === 'paguChart' && paguChart) {
        paguChart.destroy();
    } else if (canvasId === 'realisasiChart' && realisasiChart) {
        realisasiChart.destroy();
    }

    // Create different chart configurations
    let config;
    
    if (canvasId === 'paguChart') {
        // Doughnut chart for Pagu
        config = {
            ...chartConfig,
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors.slice(0, labels.length),
                    borderColor: '#fff',
                    borderWidth: 3,
                    hoverOffset: 10
                }]
            },
            options: {
                ...chartConfig.options,
                cutout: '60%' // This makes it a doughnut
            }
        };
    } else {
        // Pie chart for Realisasi
        config = {
            ...chartConfig,
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors.slice(0, labels.length),
                    borderColor: '#fff',
                    borderWidth: 3,
                    hoverOffset: 10
                }]
            },
            options: {
                ...chartConfig.options,
                cutout: '0%',
                animation: {
                animateRotate: true,
                animateScale: true,
                duration: 1000,
                easing: 'easeOutQuart'
                }
            }
        };
    }

    // Create new chart
    if (canvasId === 'paguChart') {
        paguChart = new Chart(ctx, config);
    } else {
        realisasiChart = new Chart(ctx, config);
    }
}

// Updated function for bar chart - now shows all categories without region filter
function updateBarChart() {
    const ctx = document.getElementById('comparisonChart').getContext('2d');
    
    // Destroy existing chart
    if (comparisonChart) {
        comparisonChart.destroy();
    }

    // Use ALL data from comparison table (no region filter)
    const allComparisonData = comparisonData;

    // Prepare data for bar chart
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

// Updated function for data table - now uses comparison data
function updateDataTable(selectedRegion) {
    const tableBody = document.querySelector('#budgetTable tbody');
    tableBody.innerHTML = '';

    // Get data from the comparison table for selected region
    const regionComparisonData = comparisonData.filter(item => item.Region === selectedRegion);

    regionComparisonData.forEach(item => {
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

// Update stats section with totals and realization rate
function updateStats(regionData) {
    const totalPagu = regionData.reduce((sum, item) => sum + (item.Pagu || 0), 0);
    const totalRealisasi = regionData.reduce((sum, item) => sum + (item.Realisasi || 0), 0);
    const realizationRate = totalPagu > 0 ? ((totalRealisasi / totalPagu) * 100).toFixed(1) : 0;

    document.getElementById('totalPagu').textContent = formatCurrency(totalPagu);
    document.getElementById('totalRealisasi').textContent = formatCurrency(totalRealisasi);
    document.getElementById('realizationRate').textContent = `${realizationRate}%`;
}

// Event listener for region selection
document.addEventListener('DOMContentLoaded', function() {
    const regionSelector = document.getElementById('regionSelector');
    if (regionSelector) {
        regionSelector.addEventListener('change', function() {
            if (this.value) {
                updateCharts(this.value);
            }
        });
    }
});

// auto-hide navbar on scroll > re-appear on scroll up
  let lastScrollTop = 0;
  const navbar = document.getElementById("navbar");

  window.addEventListener("scroll", () => {
    let scrollTop = window.scrollY || document.documentElement.scrollTop;

    if (scrollTop > lastScrollTop) {
      // Scrolling down → hide navbar
      navbar.style.transform = "translateY(-100%)";
    } else {
      // Scrolling up → show navbar
      navbar.style.transform = "translateY(0)";
    }

    lastScrollTop = scrollTop <= 0 ? 0 : scrollTop; // avoid negative
  });