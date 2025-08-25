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
        showAlert('Error: Chart.js library failed to load', 'error');
        return;
    }
    if (typeof supabase === 'undefined') {
        console.error('Supabase not loaded');
        showAlert('Error: Supabase library failed to load', 'error');
        return;
    }

    // Initialize Supabase client
    try {
        supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('Supabase client initialized');
    } catch (error) {
        console.error('Failed to initialize Supabase client:', error);
        showAlert('Error: Failed to initialize Supabase client. Check your configuration.', 'error');
        return;
    }

    // Initialize event listeners
    initializeEventListeners();
    
    // Start loading data
    loadDataFromSupabase();
});

let budgetData = [];
let comparisonData = [];
let paguChart = null;
let realisasiChart = null;
let comparisonChart = null;

// Color palette for charts
const colors = [
    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', 
    '#9966FF', '#FF9F40', '#f097abff', '#C9CBCF',
    '#4BC0C0', '#d37c8fff', '#36A2EB', '#FFCE56'
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

// Show alert function
function showAlert(message, type = 'info') {
    const alertBanner = document.getElementById('alertBanner');
    const alertMessage = document.getElementById('alertMessage');
    
    alertBanner.className = `alert alert-${type} alert-banner`;
    alertMessage.textContent = message;
    alertBanner.style.display = 'block';
    
    setTimeout(() => {
        alertBanner.style.display = 'none';
    }, 5000);
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

        // Process comparison data (for bar chart)
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
        
        // Hide skeleton and show content
        document.getElementById('skeletonLoader').style.display = 'none';
        
        // Fade-in dashboard sections
        const sections = ['statsContainer', 'chartsContainer', 'tableContainer', 'controlsPanel'];
        sections.forEach(id => {
            const el = document.getElementById(id);
            el.style.display = ''; // remove display:none
            setTimeout(() => el.classList.add('show'), 50); // slight delay so transition triggers
        });
        
        showAlert('Data loaded successfully!', 'success');

    } catch (error) {
        console.error('❌ Error:', error);
        showAlert(`Error loading data: ${error.message}`, 'error');
        document.getElementById('skeletonLoader').style.display = 'none';
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

// Last updated timestamp
async function getLastUpdated() {
  const { data, error } = await supabaseClient
    .from('barPaguRealisasi')
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


// Initialize all event listeners
function initializeEventListeners() {
    // Region selector
    const regionSelector = document.getElementById('regionSelector');
    if (regionSelector) {
        regionSelector.addEventListener('change', function() {
            if (this.value) {
                updateCharts(this.value);
            }
        });
    }

    // Refresh button
    document.getElementById('refreshData').addEventListener('click', () => {
        showAlert('Refreshing data...', 'info');
        loadDataFromSupabase();
    });

    // Export buttons
    const exportPDF = document.getElementById('exportPDF');
    const exportExcel = document.getElementById('exportExcel');
    const exportCSV = document.getElementById('exportCSV');
    const refreshData = document.getElementById('refreshData');
    
    if (exportPDF) exportPDF.addEventListener('click', exportToPDF);
    if (exportExcel) exportExcel.addEventListener('click', exportToExcel);
    if (exportCSV) exportCSV.addEventListener('click', exportToCSV);
    if (refreshData) refreshData.addEventListener('click', refreshDataHandler);

    // Mobile menu toggle
    const mobileMenuButton = document.getElementById("mobileMenuButton");
    if (mobileMenuButton) {
        mobileMenuButton.addEventListener("click", () => {
            document.getElementById("mobileMenu").classList.toggle("hidden");
        });
    }

    // Auto-hide navbar on scroll
    let lastScrollTop = 0;
    const navbar = document.getElementById("navbar");

    if (navbar) {
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
    }
}

// Export functions
function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text('KPPN Budget Report', 20, 20);
    
    doc.setFontSize(12);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, 40);
    
    // Add table data
    const tableData = comparisonData.map(item => [
        item.Category,
        formatCurrency(item.Pagu),
        formatCurrency(item.Realisasi),
        `${(item.Pagu > 0 ? (item.Realisasi / item.Pagu * 100) : 0).toFixed(1)}%`
    ]);
    
    doc.autoTable({
        head: [['Category', 'Pagu', 'Realisasi', 'Rate']],
        body: tableData,
        startY: 50
    });
    
    doc.save('budget-report.pdf');
    showAlert('PDF exported successfully!', 'success');
}

function exportToExcel() {
    try {
        // Get current region data
        const regionSelector = document.getElementById('regionDropdownLabel');
        const selectedRegion = regionSelector.textContent.trim();
        
        if (!selectedRegion) {
            showAlert('Please select a region first!', 'error');
            return;
        }
        
        const regionData = budgetData.filter(item => item.Region === selectedRegion);
        
        // Create CSV content
        let csvContent = "Category,Pagu,Realisasi,Realization Rate\n";
        regionData.forEach(item => {
            const realizationRate = item.Pagu > 0 ? ((item.Realisasi / item.Pagu) * 100).toFixed(1) : 0;
            csvContent += `"${item.Category}",${item.Pagu},${item.Realisasi},${realizationRate}%\n`;
        });
        
        // Download file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `budget_data_${selectedRegion}_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showAlert('Excel file exported successfully!', 'success');
    } catch (error) {
        console.error('Export error:', error);
        showAlert('Error exporting to Excel', 'error');
    }
}

function exportToCSV() {
    try {
        // Get current region data
        const regionSelector = document.getElementById('regionDropdownLabel');
        const selectedRegion = regionSelector.textContent.trim();
        
        if (!selectedRegion) {
            showAlert('Please select a region first!', 'error');
            return;
        }
        
        const regionData = budgetData.filter(item => item.Region === selectedRegion);
        
        // Create CSV content
        let csvContent = "Category,Pagu,Realisasi,Realization Rate\n";
        regionData.forEach(item => {
            const realizationRate = item.Pagu > 0 ? ((item.Realisasi / item.Realisasi) * 100).toFixed(1) : 0;
            csvContent += `"${item.Category}",${item.Pagu},${item.Realisasi},${realizationRate}%\n`;
        });
        
        // Download file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `budget_data_${selectedRegion}_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showAlert('CSV file exported successfully!', 'success');
        
    } catch (error) {
        console.error('Export error:', error);
    }
}

function refreshDataHandler() {
    
    // Hide content and show skeleton
    document.getElementById('statsContainer').style.display = 'none';
    document.getElementById('chartsContainer').style.display = 'none';
    document.getElementById('tableContainer').style.display = 'none';
    document.getElementById('controlsPanel').style.display = 'none';
    document.getElementById('skeletonLoader').style.display = 'block';

    
    // Clear existing data
    budgetData = [];
    comparisonData = [];
    
    // Reload data
    loadDataFromSupabase();
}

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
    updateDataTable(selectedRegion); // Pass selectedRegion parameter
    updateStats(regionData);
    getLastUpdated();

    // Show charts and table
    document.getElementById('chartsContainer').style.display = 'grid';
    document.getElementById('statsContainer').style.display = 'grid';
    document.getElementById('tableContainer').style.display = 'block';
    document.getElementById('controlsPanel').style.display = 'block';
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

    // Detect if on mobile
    const isMobile = window.innerWidth < 768;

    // Shared dataset styling
    const datasetConfig = {
        data: data,
        backgroundColor: colors.slice(0, labels.length),
        borderColor: '#fff',
        borderWidth: isMobile ? 1 : 2,      // ✅ lighter borders on mobile
        hoverOffset: isMobile ? 4 : 8       // ✅ smaller offset on mobile
    };

    // Animation settings
    const animationConfig = isMobile ? false : {
        animateRotate: true,
        animateScale: true,
        duration: 1000,
        easing: 'easeOutQuart'
    };

    let config;

    if (canvasId === 'paguChart') {
        // Doughnut chart for Pagu
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
        // Pie chart for Realisasi
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

// Update data table  
function updateDataTable() {
    const tableBody = document.querySelector('#budgetTable tbody');
    tableBody.innerHTML = '';

    // Use data from comparisonData 
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

// Update stats section with totals and realization rate
function updateStats(regionData) {
    const totalPagu = regionData.reduce((sum, item) => sum + (item.Pagu || 0), 0);
    const totalRealisasi = regionData.reduce((sum, item) => sum + (item.Realisasi || 0), 0);
    const realizationRate = totalPagu > 0 ? ((totalRealisasi / totalPagu) * 100).toFixed(1) : 0;

    document.getElementById('totalPagu').textContent = formatCurrency(totalPagu);
    document.getElementById('totalRealisasi').textContent = formatCurrency(totalRealisasi);
    document.getElementById('realizationRate').textContent = `${realizationRate}%`;
}