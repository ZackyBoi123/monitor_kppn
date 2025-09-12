import { createClient } from "https://esm.sh/@supabase/supabase-js@2";  

const SUPABASE_URL = "https://kntomoredgduvwbovgpx.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtudG9tb3JlZGdkdXZ3Ym92Z3B4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2MzI0NzcsImV4cCI6MjA3MDIwODQ3N30.Ei7vJ8RQCiz7KPXis6He8dVzL91Euocxzxzg1ptg1_U";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ---------- Column list (exact DB names; spaces quoted) ----------
const COLUMNS = `
  ID,
  "LOKASI SEKOLAH",
  "NAMA SEKOLAH",
  "STS SEKOLAH",
  "TGL SP2D DETAIL",
  TAHAP,
  GEL,
  NILAI,
  "JMLH SISWA"
   `;
   
// ---------- State ----------
let allData = [];         // full dataset (fetched once)
let filteredData = [];    // after filters + search + sort
let currentPage = 1;
let rowsPerPage = parseInt(document.getElementById("rowsPerPageSelect").value, 10) || 10;
const debounceMs = 200;
let debounceTimer = null;

// Sorting state
let sortColumn = null; // 'NIP', 'NAMA', or 'PEMDA'
let sortDirection = null; // 'asc' or 'desc'

// ---------- Utils ----------
function escapeHTML(s) { return String(s ?? "").replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function highlightHTML(text, term){
  if (!term) return escapeHTML(text ?? "");
  const t = String(text ?? "");
  const esc = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  try {
    return escapeHTML(t).replace(new RegExp(`(${esc})`, 'gi'), `<span class="highlight">$1</span>`);
  } catch(e) {
    return escapeHTML(t);
  }
}

// Script to toggle mobile menu 
document.getElementById("mobileMenuButton").addEventListener("click", () => {
  document.getElementById("mobileMenu").classList.toggle("hidden");
});

// Table scroll shadow effect
const scrollWrapper = document.getElementById("tableScrollWrapper");
scrollWrapper.addEventListener("scroll", () => {
  if (scrollWrapper.scrollLeft > 0) {
    scrollWrapper.classList.add("scrolling-left");
  } else {
    scrollWrapper.classList.remove("scrolling-left");
  }

  if (scrollWrapper.scrollLeft + scrollWrapper.clientWidth < scrollWrapper.scrollWidth) {
    scrollWrapper.classList.add("scrolling-right");
  } else {
    scrollWrapper.classList.remove("scrolling-right");
  }
});

// Save/load state from localStorage for persistence
function saveState() {
  const state = {
    // filters: {
    //   lokasii: $("#filterJenisLokasi").val(),
    //   sekolahh: $("#filterJenisSekolah").val(),
    //   tahapp: $("#filterJenisTahap").val(),
    //   gemm: $("#filterJenisGelombang").val(),
    // },
    searchTerm: document.getElementById("searchInput").value.trim(),
    sortColumn,
    sortDirection,
    currentPage,
  };
  localStorage.setItem("tableState", JSON.stringify(state));
}

function loadState() {
  try {
    const state = JSON.parse(localStorage.getItem("tableState"));
    if (!state) return;
    if(state.filters) {
      $("#filterJenisLokasi").val(state.filters.lokasii).trigger("change");
      $("#filterJenisSekolah").val(state.filters.sekolahh).trigger("change");
      $("#filterJenisTahap").val(state.filters.tahapp).trigger("change");
      $("#filterJenisGelombang").val(state.filters.gemm).trigger("change");
    }
    if(state.searchTerm) {
      document.getElementById("searchInput").value = state.searchTerm;
      document.getElementById("clearBtn").style.display = state.searchTerm ? "block" : "none";
    }
    if(state.sortColumn) {
      sortColumn = state.sortColumn;
    }
    if(state.sortDirection) {
      sortDirection = state.sortDirection;
    }
    if(state.currentPage) {
      currentPage = state.currentPage;
    }
  } catch (e) {
    console.warn("Failed to load saved state", e);
  }
}

function capitalizeWords(str) {
  if (str == null) return "";
  return String(str)
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Staggered animations function
function showContentWithStaggeredAnimation() {
  const heroSection = document.querySelector('.header');
  const filterSection = document.querySelector('.header-bar');
  const mainContent = document.getElementById('mainContent');
  
  // Show hero first
  heroSection.classList.add('visible');
  
  // Then filter section
  setTimeout(() => {
    filterSection.classList.add('visible');
  }, 25);
  
  // Finally main content
  setTimeout(() => {
    mainContent.style.display = 'block';
    mainContent.classList.add('visible');
  }, 50);
}

// Smooth loader hiding
function hideLoaderSmoothly() {
  const loader = document.getElementById('loader');
  
  // Add fade-out class instead of immediately hiding
  loader.classList.add('fade-out');
  
  // Actually hide after transition completes
  setTimeout(() => {
    loader.style.display = 'none';
  }, 600);
}

// ---------- Get Last Updated ----------
async function getLastUpdated() {
  const { data, error } = await supabase
    .from('BOSP')
    .select('updated_at')
    .order('updated_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error(error);
    return;
  }

  if (data.length > 0) {
    const lastUpdated = new Date(data[0].updated_at);
    document.getElementById("last-updated").textContent = "Last Updated: " + lastUpdated.toLocaleString("id-ID", {year: 'numeric',month: 'numeric', day: 'numeric',  hour: 'numeric', minute: 'numeric', hour12: true});
  }
}

getLastUpdated();

// ---------- Fetch ALL rows (batched) ----------
async function fetchAllRowsBatched(batchSize = 1000) {
  // Get exact count first
  const headRes = await supabase
    .from('BOSP')
    .select('ID', { head: true, count: 'exact' });

  if (headRes.error) throw headRes.error;
  const total = headRes.count || 0;
  if (total === 0) return [];

  if (total <= batchSize) {
    const { data, error } = await supabase
      .from('BOSP')
      .select(COLUMNS)
      .order('ID', { ascending: true })
      .range(0, total - 1);
    if (error) throw error;
    return data || [];
  }

  const batches = Math.ceil(total / batchSize);
  const all = [];
  for (let i = 0; i < batches; i++) {
    const from = i * batchSize;
    const to = Math.min(from + batchSize - 1, total - 1);
    const { data, error } = await supabase
      .from('BOSP')
      .select(COLUMNS)
      .order('ID', { ascending: true })
      .range(from, to);
    if (error) throw error;
    all.push(...(data || []));
  }
  return all;
}

// ---------- Populate Select2 dropdowns ----------
function fillSelect(selector, values, placeholderText){
  const el = document.querySelector(selector);
  if(!el) return;
  el.innerHTML = `<option value="">${placeholderText}</option>`;
  values.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = capitalizeWords(v);
    el.appendChild(opt);
  });
  // init/refresh select2
  $(selector).select2({ width: 'resolve' });
}

// ---------- Apply filters + search + sorting ----------
function applyFiltersSearchAndSort(){
  const lokasii = $("#filterJenisLokasi").val();
  const sekolahh = $("#filterJenisSekolah").val();
  const tahapp = $("#filterJenisTahap").val();
  // const gemm = $("#filterJenisGelombang").val();
  const searchTerm = (document.getElementById("searchInput").value || "").trim().toLowerCase();

  filteredData = allData.filter(row => {
    if (lokasii && row["LOKASI SEKOLAH"] !== lokasii) return false;
    if (sekolahh && row["NAMA SEKOLAH"] !== sekolahh) return false;
    if (tahapp && String(row["TAHAP"]) !== tahapp) return false;
    // if (gemm && row["GEL"] !== gemm) return false;

    if (!searchTerm) return true;

    for (const v of Object.values(row)) {
      if (v == null) continue;
      if (String(v).toLowerCase().includes(searchTerm)) return true;
    }
    return false;
  });

  // Apply sorting if any
  if(sortColumn && sortDirection){
    filteredData.sort((a,b) => {
      const valA = (a[sortColumn] ?? "").toString().toLowerCase();
      const valB = (b[sortColumn] ?? "").toString().toLowerCase();
      if(valA < valB) return sortDirection === "asc" ? -1 : 1;
      if(valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }

  currentPage = 1;
  saveState();
  renderPaginatedTable();
}

// ---------- Debounced search ----------
window.debounceSearch = function(){
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    applyFiltersSearchAndSort();
  }, debounceMs);
};

// ---------- Clear search ----------
window.clearSearch = function(){
  document.getElementById("searchInput").value = "";
  toggleClear();
  currentPage = 1;
  applyFiltersSearchAndSort();
};

// ---------- Toggle clear ----------
window.toggleClear = function(){
  const val = document.getElementById("searchInput").value;
  const btn = document.getElementById("clearBtn");
  if(val && val.trim().length > 0){
    btn.classList.add("visible");
  } else {
    btn.classList.remove("visible");
  }
}

// ---------- Render paginated table ----------
function renderPaginatedTable(){
  rowsPerPage = parseInt(document.getElementById("rowsPerPageSelect").value, 10);
  const total = filteredData.length;
  const rpp = rowsPerPage === 9999 ? total || 1 : rowsPerPage;
  const totalPages = rpp === 0 ? 1 : Math.max(1, Math.ceil(total / rpp));
  if (currentPage > totalPages) currentPage = totalPages;

  const startIndex = (currentPage - 1) * rpp;
  const pageData = (rowsPerPage === 9999) ? filteredData.slice(0, rpp) : filteredData.slice(startIndex, startIndex + rpp);

  renderTable(pageData);

  const start = total === 0 ? 0 : startIndex + 1;
  const end = Math.min(startIndex + rpp, total);
  document.getElementById("count-display").textContent = `${start}–${end} dari ${total} Data`;

  renderPaginationControls(totalPages);
  toggleClear();
}

// ---------- Renders title if text overflowed ----------
function setTitleIfOverflowed(cell) {
  if (cell.scrollWidth > cell.clientWidth) {
    cell.title = cell.getAttribute('data-fulltext') || cell.textContent;
  } else {
    cell.title = "";
  }
}

// Function to create progress bar HTML
function createProgressBar(percentage) {
  if (!percentage || percentage === '' || percentage === '-') {
    return `
      <div class="percentage-text">-</div>
      <div class="progress-container">
        <div class="progress-bar low" style="width: 0%"></div>
      </div>
    `;
  }

  // Clean percentage value (remove % symbol if present)
  let numValue = parseFloat(String(percentage).replace('%', ''));
  if (isNaN(numValue)) numValue = 0;

  // Determine color class based on thresholds
  let colorClass = 'low';
  if (numValue >= 100) {
    colorClass = 'complete';
  } else if (numValue >= 81) {
    colorClass = 'high';
  } else if (numValue >= 50) {
    colorClass = 'medium';
  }

  // Cap the visual width at 100% for display
  const displayWidth = Math.min(numValue, 100);

  return `
    <div class="percentage-text">${numValue.toFixed(1)}%</div>
    <div class="progress-container">
      <div class="progress-bar ${colorClass}" style="width: ${displayWidth}%"></div>
    </div>
  `;
}

// Format status desa with color coding
// function formatStatusDesa(status, searchTerm = '') {
//   if (!status || status === '' || status === '-') {
//     return '<span class="status-other">-</span>';
//   }

//   // Clean and normalize the status text
//   const statusLower = String(status).toLowerCase().trim();
//   const formattedText = capitalizeWords(status);
  
 // // Define status mapping with their corresponding CSS classes
//   const statusMap = {
//     'mandiri': 'status-mandiri',
//     'berkembang': 'status-berkembang',
//     'maju': 'status-maju',
//     'tertinggal': 'status-tertinggal',
//     'sangat tertinggal': 'status-sangat-tertinggal',

//     Add more status mappings here as needed
//     'your_status': 'status-your-css-class',
//   };

//   Find matching status or use default
//   let cssClass = 'status-other'; // default fallback
  
//   // Check for exact match first
//   if (statusMap[statusLower]) {
//     cssClass = statusMap[statusLower];
//   } else {
//     // Check for partial matches (useful for variations)
//     for (const [key, value] of Object.entries(statusMap)) {
//       if (statusLower.includes(key) || key.includes(statusLower)) {
//         cssClass = value;
//         break;
//       }
//     }
//   }
  
//   // Apply search highlighting if needed
//   const highlightedText = searchTerm ? 
//     highlightHTML(formattedText, searchTerm) : 
//     escapeHTML(formattedText);

//   return `<span class="${cssClass}">${highlightedText}</span>`;
// }

// ---------- Format Rupiah with search highlighting ----------
function formatRupiahWithHighlight(number, searchTerm = '') {
  if (!number || number === '' || number === '-' || isNaN(number)) {
    return searchTerm ? highlightHTML('-', searchTerm) : '-';
  }
  
  const num = parseFloat(number);
  if (num === 0) {
    const formatted = 'Rp. 0';
    return searchTerm ? highlightHTML(formatted, searchTerm) : formatted;
  }
  
  const formatted = 'Rp. ' + num.toLocaleString('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
  
  return searchTerm ? highlightHTML(formatted, searchTerm) : formatted;
}

// ---------- Render table with sorting and filtering ----------
function renderTable(rows){
  const container = document.getElementById("tableContainer");
  container.innerHTML = "";

  const table = document.createElement("table");
  table.className = "compact";
													
  // Headers with sortable columns
  const headers = [
    { key: "No", label: "#", sortable: false },
    { key: "LOKASI SEKOLAH", label: "Kab / Kota", sortable: false },
    { key: "NAMA SEKOLAH", label: "Nama Sekolah", sortable: false },
    { key: "STS SEKOLAH", label: "Status Sekolah", sortable: false },
    { key: "TGL SP2D DETAIL", label: "Tanggal SP2D", sortable: false },
    { key: "TAHAP", label: "Tahap", sortable: false },
    // { key: "GEL", label: "Gelombang", sortable: false },
    { key: "NILAI", label: "Nilai", sortable: false },
    { key: "JMLH SISWA", label: "Jumlah Siswa", sortable: false },
  ];

  const thead = document.createElement("thead");
  const tr = document.createElement("tr");

  headers.forEach(h => {
    const th = document.createElement("th");
    th.textContent = h.label;
    if(h.sortable){
      th.style.cursor = "pointer";
      th.tabIndex = 0;
      th.setAttribute("aria-sort", "none");
      th.title = `Sort by ${h.label}`;
      if(sortColumn === h.key){
        th.textContent += sortDirection === "asc" ? " ▲" : " ▼";
        th.setAttribute("aria-sort", sortDirection === "asc" ? "ascending" : "descending");
      }
      th.addEventListener("click", () => {
        if(sortColumn === h.key){
          sortDirection = (sortDirection === "asc") ? "desc" : "asc";
        } else {
          sortColumn = h.key;
          sortDirection = "asc";
        }
        applyFiltersSearchAndSort();
      });
      th.addEventListener("keydown", (e) => {
        if(e.key === "Enter" || e.key === " "){
          e.preventDefault();
          th.click();
        }
      });
    }
    tr.appendChild(th);
  });
  thead.appendChild(tr);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  if (!rows || rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="13" class="text-center">No matching results found</td></tr>`;
  } else {
    const searchTerm = (document.getElementById("searchInput").value || "").trim();
    rows.forEach((row, idx) => {
      const tr = document.createElement("tr");
      const displayIndex = (currentPage - 1) * rowsPerPage + idx + 1;
      
      tr.innerHTML = `
        <td class="numbers">${displayIndex}</td>
        <td class="" data-fulltext="${escapeHTML(row["LOKASI SEKOLAH"])}">${highlightHTML(capitalizeWords(row["LOKASI SEKOLAH"]), searchTerm)}</td>
        <td class="" data-fulltext="${escapeHTML(row["NAMA SEKOLAH"])}">${highlightHTML(row["NAMA SEKOLAH"], searchTerm)}</td>
        <td class="" data-fulltext="${escapeHTML(row["STS SEKOLAH"])}">${highlightHTML(capitalizeWords(row["STS SEKOLAH"]), searchTerm)}</td>
        <td class="" data-fulltext="${escapeHTML(row["TGL SP2D DETAIL"])}">${highlightHTML(row["TGL SP2D DETAIL"], searchTerm)}</td>
        <td class="" data-fulltext="${escapeHTML(row.TAHAP)}">${highlightHTML(row.TAHAP, searchTerm)}</td>
        <td class="currency" data-fulltext="${escapeHTML(row.NILAI)}">${formatRupiahWithHighlight(row.NILAI, searchTerm)}</td>
        <td class="" data-fulltext="${escapeHTML(row["JMLH SISWA"])}">${highlightHTML(row["JMLH SISWA"], searchTerm)}</td>
        `;
        // <td class="" data-fulltext="${escapeHTML(row.GEL)}">${highlightHTML(row.GEL, searchTerm)}</td>
        
      tbody.appendChild(tr);

      // Set tooltips for overflowed content
      const tds = tr.querySelectorAll("td");
      tds.forEach(setTitleIfOverflowed);
    });

    // Update tooltips after render
    requestAnimationFrame(() => {
      tbody.querySelectorAll("td").forEach(setTitleIfOverflowed);
    });
  }

  table.appendChild(tbody);
  container.appendChild(table);
}

// CSS styles to enhance the currency display
const currencyStyles = `
  .currency {
    text-align: right;
    font-family: 'Courier New', monospace;
    font-weight: 800;
    color: #07c526ff; 
  }
`;

// Add the styles to your page
function addCurrencyStyles() {
  const style = document.createElement('style');
  style.textContent = currencyStyles;
  document.head.appendChild(style);
}

// ---------- Render pagination controls ----------
function renderPaginationControls(totalPages){
  const wrapper = document.getElementById("pagination-controls");
  wrapper.innerHTML = "";
  if (totalPages <= 1) return;

  function createBtn(label, disabled = false, onClick) {
    const btn = document.createElement("button");
    btn.textContent = label;
    btn.disabled = disabled;
    btn.className = disabled ? "disabled" : "";
    btn.addEventListener("click", onClick);
    return btn;
  }

  // Prev
  wrapper.appendChild(createBtn("<", currentPage === 1, () => {
    if(currentPage > 1){
      currentPage--;
      renderPaginatedTable();
    }
  }));

  // First page button
  wrapper.appendChild(createBtn("1", currentPage === 1, () => {
    currentPage = 1;
    renderPaginatedTable();
  }));

  // Window pages
  const windowSize = 3;
  let start = Math.max(2, currentPage - 1);
  let end = Math.min(totalPages - 1, currentPage + 1);

  if (currentPage <= 3  ) { start = 2; end = Math.min(4, totalPages - 1); }
  if (currentPage >= totalPages - 2) { start = Math.max(2, totalPages - 3); end = totalPages - 1; }

  if (start > 2) {
    const span = document.createElement("span");
    span.textContent = "...";
    span.style.margin = "0 6px";
    wrapper.appendChild(span);
  }

  for(let i = start; i <= end; i++){
    wrapper.appendChild(createBtn(i.toString(), currentPage === i, () => {
      currentPage = i;
      renderPaginatedTable();
    }));
  }

  if (end < totalPages - 1) {
    const span = document.createElement("span");
    span.textContent = "...";
    span.style.margin = "0 6px";
    wrapper.appendChild(span);
  }

  // Last page
  if(totalPages > 1){
    wrapper.appendChild(createBtn(totalPages.toString(), currentPage === totalPages, () => {
      currentPage = totalPages;
      renderPaginatedTable();
    }));
  }

  // Next
  wrapper.appendChild(createBtn(">", currentPage === totalPages, () => {
    if(currentPage < totalPages){
      currentPage++;
      renderPaginatedTable();
    }
  }));
}

// ---------- Reset handler ----------
function resetAll(){
  ["#filterJenisLokasi", "#filterJenisSekolah", "#filterJenisTahap"].forEach(sel => {
    $(sel).val("").trigger("change");
  });
  document.getElementById("searchInput").value = "";
  toggleClear();
  sortColumn = null;
  sortDirection = null;
  currentPage = 1;
  rowsPerPage = parseInt(document.getElementById("rowsPerPageSelect").value, 10);
  filteredData = [...allData];
  saveState();
  renderPaginatedTable();
  showToast("Filters and search have been reset!");
}

// ---------- Reset message popup ----------
function showToast(msg){
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 2325);
}

// ---------- copy popup ----------
function showToastCopy(msg){
  const toastCopy = document.getElementById("toastCopy");
  toastCopy.style.left = x + "px";
  toastCopy.style.top = (y - 63) + "px"; // position above cursor
  toastCopy.textContent = msg;
  toastCopy.classList.add("show");
  setTimeout(() => {
    toastCopy.classList.remove("show");
  }, 2325);
}

// Track mouse position for copy popup
let x = 0 
let y = 0;

// Update x and y on mouse move
document.addEventListener("mousemove", (e) => {
  x = e.clientX;
  y = e.clientY;
});

// ---------- Ctrl/Cmd + C popup ----------
document.addEventListener("copy", () => {
    const selection = window.getSelection().toString().trim();
    if (selection.length > 0) {
    showToastCopy("Copied to clipboard!");
  }
});

// ---------- Vercel Analytics ----------
window.si = window.si || function () { (window.siq = window.siq || []).push(arguments); };
window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };

// ---------- Wire UI event listeners ----------
document.getElementById("clearBtn").addEventListener("click", clearSearch);

// rows per page select
document.getElementById("rowsPerPageSelect").addEventListener("change", (e) => {
  const val = parseInt(e.target.value, 10);
  rowsPerPage = isNaN(val) ? 10 : val;
  currentPage = 1;
  applyFiltersSearchAndSort();
});

// reset filters button
document.getElementById("resetFilters").addEventListener("click", resetAll);

// apply filters on change
$("#filterJenisLokasi, #filterJenisSekolah, #filterJenisTahap").on("change", () => {
  currentPage = 1;
  applyFiltersSearchAndSort();
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

// ! Toggle profile dropdown
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

  // Close when clicking outside
  document.addEventListener("click", (e) => {
    if (!profileBtn.contains(e.target) && !dropdownMenu.contains(e.target)) {
      dropdownMenu.classList.remove("scale-100", "opacity-100");
      dropdownMenu.classList.add("scale-95", "opacity-0");
      setTimeout(() => dropdownMenu.classList.add("hidden"), 200);
    }
  });


// * Check session on page load
    async function checkSession() {
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "login.html";
    } else {
      document.getElementById("appBody").style.display = "block"; // show only if logged in
    }
  }

  checkSession();

// Log out function
  document.getElementById("logoutLink").addEventListener("click", async (e) => {
    e.preventDefault(); // prevent link navigation
    await supabase.auth.signOut();
    window.location.href = "login.html";
  });

// ---------- Initialization ----------
(async function init(){
  try {
    showToast("Loading data, please wait...");
    document.getElementById("loader").style.display = "grid";

    allData = await fetchAllRowsBatched(1000); // fetch all rows in batches of 1000
    allData.sort((a,b) => (Number(a.ID) || 0) - (Number(b.ID) || 0));
    filteredData = [...allData];

    // populate filter dropdowns
    const lokasi = [...new Set(allData.map(r => r["LOKASI SEKOLAH"]).filter(Boolean))].sort();
    const sekolah = [...new Set(allData.map(r => r["NAMA SEKOLAH"]).filter(Boolean))].sort();
    const tahap = [...new Set(allData.map(r => r["TAHAP"]).filter(Boolean))].sort();
    // const gem = [...new Set(allData.map(r => r["GEL"]).filter(Boolean))].sort();

    fillSelect("#filterJenisLokasi", lokasi, "[ Pilih Kab / Kota ]");
    fillSelect("#filterJenisSekolah", sekolah, "[ Pilih Sekolah ]");
    fillSelect("#filterJenisTahap", tahap, "[ Pilih Tahap ]");
    // fillSelect("#filterJenisGelombang", gem, "[ Pilih Gelombang ]");

    // load persistent UI state
    loadState();
    addCurrencyStyles();
    applyFiltersSearchAndSort();

    showToast("Data loaded successfully!");
    showContentWithStaggeredAnimation();

  } catch (err) {
    console.error("Init error:", err);
    document.getElementById("tableContainer").innerHTML = `<p style="color:red;">Failed to load data. See console.</p>`;
    showContentWithStaggeredAnimation();
  } finally {
    hideLoaderSmoothly();
  }
})();