document.addEventListener('DOMContentLoaded', function() {
            // Check if libraries are loaded
            if (typeof Chart === 'undefined') {
                console.error('Chart.js not loaded');
                document.getElementById('loadingIndicator').innerHTML = 'Error: Chart.js library failed to load';
                return;
            }
            if (typeof Papa === 'undefined') {
                console.error('PapaParse not loaded');
                document.getElementById('loadingIndicator').innerHTML = 'Error: PapaParse library failed to load';
                return;
            }
            
            console.log('✅ Libraries loaded successfully');
            loadDataFromGoogleSheets();
        });

        let budgetData = [];
        let paguChart = null;
        let realisasiChart = null;

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

        function showDebug(message) {
            const debugDiv = document.getElementById('debugInfo');
            debugDiv.style.display = 'block';
            debugDiv.innerHTML += message + '<br>';
            console.log(message);
        }

        // Load data from Google Sheets - ENHANCED DEBUGGING
        async function loadDataFromGoogleSheets() {
            try {
                // YOUR GOOGLE SHEETS URL - MAKE SURE THIS IS CORRECT
                // Replace this with your actual Google Sheets URL in CSV export format
                const GOOGLE_SHEETS_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTGeYeqsvN2MRjQYjGYmTq_OdNQk8pn4wOHyAhXkNYj8ArHFEBuOXwrpYMYWdIr-GOl3lCix1LsBpmS/pub?output=csv';

                // showDebug('🔄 Starting data fetch...');
                // showDebug('📋 URL: ' + GOOGLE_SHEETS_URL);
                
                // Test if URL is accessible
                const response = await fetch(GOOGLE_SHEETS_URL);
                
                // showDebug(`📡 Response status: ${response.status} (${response.statusText})`);
                
                if (!response.ok) {
                    if (response.status === 403) {
                        throw new Error('Sheet is not public! Make it viewable by anyone with the link.');
                    } else if (response.status === 404) {
                        throw new Error('Sheet not found! Check your URL.');
                    } else {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                }
                
                const csvText = await response.text();
                // showDebug('✅ CSV data received');
                // showDebug('📄 First 300 characters: ' + csvText.substring(0, 300));
                // showDebug('📏 Total data length: ' + csvText.length + ' characters');
                
                // Parse CSV data with enhanced error checking
                const parsedResult = Papa.parse(csvText, { 
                    header: true, 
                    skipEmptyLines: true,
                    dynamicTyping: false, // Keep as strings first to debug
                    transformHeader: header => header.trim()
                });

                // showDebug('🔍 Papa Parse Results:');
                // showDebug('  - Total rows: ' + parsedResult.data.length);
                // showDebug('  - Errors: ' + parsedResult.errors.length);
                // showDebug('  - Headers detected: ' + JSON.stringify(parsedResult.meta.fields));
                
                // if (parsedResult.errors.length > 0) {
                //     showDebug('⚠️ Parse errors: ' + JSON.stringify(parsedResult.errors));
                // }

                // Show first few raw rows
                // showDebug('📋 First 3 raw rows:');
                // parsedResult.data.slice(0, 3).forEach((row, index) => {
                //     showDebug(`  Row ${index + 1}: ${JSON.stringify(row)}`);
                // });

                // Process and validate data
                budgetData = parsedResult.data.map((row, index) => {
                    // Convert Pagu and Realisasi to numbers
                    const processedRow = {
                        Region: row.Region ? row.Region.toString().trim() : '',
                        Category: row.Category ? row.Category.toString().trim() : '',
                        Pagu: 0,
                        Realisasi: 0
                    };

                    // Parse Pagu
                    if (row.Pagu && row.Pagu.toString().trim() !== '') {
                        const paguStr = row.Pagu.toString().replace(/[,\.]/g, '');
                        const paguNum = parseFloat(paguStr);
                        if (!isNaN(paguNum)) {
                            processedRow.Pagu = paguNum;
                        }
                        // showDebug(`Row ${index + 1} Pagu: "${row.Pagu}" -> ${processedRow.Pagu}`);
                    }

                    // Parse Realisasi
                    if (row.Realisasi && row.Realisasi.toString().trim() !== '') {
                        const realisasiStr = row.Realisasi.toString().replace(/[,\.]/g, '');
                        const realisasiNum = parseFloat(realisasiStr);
                        if (!isNaN(realisasiNum)) {
                            processedRow.Realisasi = realisasiNum;
                        }
                        // showDebug(`Row ${index + 1} Realisasi: "${row.Realisasi}" -> ${processedRow.Realisasi}`);
                    }

                    return processedRow;
                }).filter(row => {
                    return row.Region && row.Category && row.Region !== '' && row.Category !== '';
                });
                
                // showDebug(`✅ Processed ${budgetData.length} valid rows`);
                // showDebug('📊 Sample processed data:');
                // budgetData.slice(0, 2).forEach((row, index) => {
                //     showDebug(`  Processed Row ${index + 1}: ${JSON.stringify(row)}`);
                // });
                
                if (budgetData.length === 0) {
                    throw new Error('No valid data found after processing. Check your sheet format.');
                }
                
                populateRegionDropdown();
                document.getElementById('loadingIndicator').style.display = 'none';
                
                // showDebug('🎉 Data processing completed successfully!');

            } catch (error) {
                console.error('❌ Error:', error);
                showDebug('❌ ERROR: ' + error.message);
                document.getElementById('loadingIndicator').innerHTML = `
                    <div style="color: #ff6b6b; font-weight: bold; margin-bottom: 15px;">❌ Error: ${error.message}</div>
                    <div style="font-size: 0.9rem; opacity: 0.9;">
                        <strong>Common fixes:</strong><br>
                        • Make sure your Google Sheet is PUBLIC (Anyone with link can view)<br>
                        • Check that your URL ends with /export?format=csv&gid=0<br>
                        • Verify columns are named exactly: Region, Category, Pagu, Realisasi<br>
                        • Check the debug info above for more details
                    </div>
                `;
            }
        }

        function populateRegionDropdown() {
            const regions = [...new Set(budgetData.map(item => item.Region))].sort();
            const selector = document.getElementById('regionSelector');
            
            // selector.innerHTML = '<option value="">Select a region...</option>';
            regions.forEach(region => {
                const option = document.createElement('option');
                option.value = region;
                option.textContent = region;
                selector.appendChild(option);
            });

            // showDebug(`📍 Found ${regions.length} regions: ${regions.join(', ')}`);

            // Set default selection to first region
            if (regions.length > 0) {
                selector.value = regions[0];
                updateCharts(regions[0]);
            }
        }

        function updateCharts(selectedRegion) {
            const regionData = budgetData.filter(item => item.Region === selectedRegion);
            
            // showDebug(`🔄 Updating charts for: ${selectedRegion} (${regionData.length} records)`);
            
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

            // Update charts
            updateChart('paguChart', paguCategories, paguValues, 'Pagu');
            updateChart('realisasiChart', realisasiCategories, realisasiValues, 'Realisasi');
            updateStats(regionData);

            // Show charts
            document.getElementById('chartsContainer').style.display = 'grid';
            document.getElementById('statsContainer').style.display = 'grid';
        }

        function updateChart(canvasId, labels, data, type) {
            const ctx = document.getElementById(canvasId).getContext('2d');
            
            // Destroy existing chart
            if (canvasId === 'paguChart' && paguChart) {
                paguChart.destroy();
            } else if (canvasId === 'realisasiChart' && realisasiChart) {
                realisasiChart.destroy();
            }

            const config = {
                ...chartConfig,
                data: {
                    labels: labels,
                    datasets: [{
                        data: data,
                        backgroundColor: colors.slice(0, labels.length),
                        borderColor: '#fff',
                        borderWidth: 3,
                        hoverOffset: 10
                    }]
                }
            };

            // Create new chart
            if (canvasId === 'paguChart') {
                paguChart = new Chart(ctx, config);
            } else {
                realisasiChart = new Chart(ctx, config);
            }
        }

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
            document.getElementById('regionSelector').addEventListener('change', function() {
                if (this.value) {
                    updateCharts(this.value);
                }
            });
        });