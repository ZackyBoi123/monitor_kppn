import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
const SUPABASE_URL = "https://kntomoredgduvwbovgpx.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtudG9tb3JlZGdkdXZ3Ym92Z3B4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2MzI0NzcsImV4cCI6MjA3MDIwODQ3N30.Ei7vJ8RQCiz7KPXis6He8dVzL91Euocxzxzg1ptg1_U";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ---------- Column list (exact DB names; spaces quoted) ----------
const COLUMNS = `
  ID,
  PEMDA,
  "NAMA TAHAP",  
  GELOMBANG,
  PUSKESMAS,
  "TOTAL PAGU",
  "PAGU PER TAHAP",
  "NILAI PENGURANG",
  "NILAI PENYALURAN",
  SP2D,
  "TANGGAL SP2D",
  "NILAI SP2D"
  `;
  // "NILAI PENGGUNAAN DANA",
  
// ---------- State ----------
let allData = [];         // full dataset (fetched once)
let filteredData = [];    // after filters + search + sort
let currentPage = 1;
let rowsPerPage = parseInt(document.getElementById("rowsPerPageSelect").value, 10) || 10;
const debounceMs = 200; // debounce time for search input
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
    //   pemda: $("#filterJenisPemda").val(),
    //   tahap: $("#filterJenisTahap").val(),
    //   gelombang: $("#filterJenisGelombang").val(),
    //   pusk: $("#filterJenisPuskesmas").val(),
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
      $("#filterJenisPemda").val(state.filters.pemda).trigger("change");
      $("#filterJenisTahap").val(state.filters.tahap).trigger("change");
      $("#filterJenisGelombang").val(state.filters.gelombang).trigger("change");
      $("#filterJenisPuskesmas").val(state.filters.puskesmas).trigger("change");
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


function showMainContent() {
  const main = document.getElementById("mainContent");
  main.style.display = "block";
  setTimeout(()=> main.classList.add("visible"), 40);
}

// ---------- Fetch ALL rows (batched) ----------
async function getLastUpdated() {
  const { data, error } = await supabase
    .from('BOK')
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

async function fetchAllRowsBatched(batchSize = 1000) {
  // Get exact count first
  const headRes = await supabase
    .from('BOK')
    .select('ID', { head: true, count: 'exact' });

  if (headRes.error) throw headRes.error;
  const total = headRes.count || 0;
  if (total === 0) return [];

  if (total <= batchSize) {
    const { data, error } = await supabase
      .from('BOK')
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
      .from('BOK')
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
  const pemda = $("#filterJenisPemda").val();
  const tahap = $("#filterJenisTahap").val();
  const gelombang = $("#filterJenisGelombang").val();
  const pusk = $("#filterJenisPuskesmas").val();
  const searchTerm = (document.getElementById("searchInput").value || "").trim().toLowerCase();

  filteredData = allData.filter(row => {
    if (pemda && row.PEMDA !== pemda) return false;
    if (tahap && row["NAMA TAHAP"] !== tahap) return false;
    if (gelombang && row.GELOMBANG !== gelombang) return false;
    if (pusk && row.PUSKESMAS !== pusk) return false;

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

// ---------- Render table with clickable sortable headers ----------
function renderTable(rows){
  const container = document.getElementById("tableContainer");
  container.innerHTML = "";

  const table = document.createElement("table");
  table.className = "compact";

  // Headers with sortable columns
  const headers = [
    { key: "No", label: "#", sortable: false },
    { key: "PEMDA", label: "Kab / Kota", sortable: true },
    { key: "NAMA TAHAP", label: "Tahap", sortable: true },
    { key: "GELOMBANG", label: "Gelombang", sortable: false },
    { key: "PUSKESMAS", label: "Puskesmas", sortable: true },
    { key: "TOTAL PAGU", label: "Total Pagu", sortable: false },
    { key: "PAGU PER TAHAP", label: "Pagu Per Tahap", sortable: false },
    { key: "NILAI PENGURANG", label: "Nilai Pengurang", sortable: false },
    // { key: "NILAI PENGGUNAAN DANA", label: "Nilai Penggunaan Dana", sortable: false },
    { key: "NILAI PENYALURAN", label: "Nilai Penyaluran", sortable: false },
    { key: "SP2D", label: "SP2D", sortable: false },
    { key: "NILAI SP2D", label: "Nilai SP2D", sortable: false },
    { key: "TANGGAL SP2D", label: "Tanggal SP2D", sortable: false },
  ];

  const thead = document.createElement("thead");
  const tr = document.createElement("tr");

  headers.forEach(h => {
    const th = document.createElement("th");
    th.textContent = h.label;
    if(h.sortable){
      th.style.cursor = "pointer";
      th.tabIndex = 0; // keyboard focus
      th.setAttribute("aria-sort", "none");
      th.title = `Sort by ${h.label}`;
      // show sort arrow if active
      if(sortColumn === h.key){
        th.textContent += sortDirection === "asc" ? " ▲" : " ▼";
        th.setAttribute("aria-sort", sortDirection === "asc" ? "ascending" : "descending");
      }
      th.addEventListener("click", () => {
        if(sortColumn === h.key){
          // toggle direction
          sortDirection = (sortDirection === "asc") ? "desc" : "asc";
        } else {
          sortColumn = h.key;
          sortDirection = "asc";
        }
        applyFiltersSearchAndSort();
      });
      // Keyboard support for sorting
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
    tbody.innerHTML = `<tr><td colspan="14" class="text-center">No matching results found</td></tr>`;
  } else {
    const searchTerm = (document.getElementById("searchInput").value || "").trim();
    rows.forEach((row, idx) => {
      const tr = document.createElement("tr");
      const displayIndex = (currentPage - 1) * rowsPerPage + idx + 1;
      tr.innerHTML = `
        <td>${displayIndex}</td>
        <td class="pemda-cell" data-fulltext="${escapeHTML(row.PEMDA)}">${highlightHTML(capitalizeWords(row.PEMDA), searchTerm)}</td>
        <td class="tahap-cell" data-fulltext="${escapeHTML(row["NAMA TAHAP"])}">${highlightHTML(capitalizeWords(row["NAMA TAHAP"]), searchTerm)}</td>
        <td class="gelombang-cell" data-fulltext="${escapeHTML(row.GELOMBANG)}">${highlightHTML(row.GELOMBANG, searchTerm)}</td>
        <td class="puskesmas-cell" data-fulltext="${escapeHTML(row.PUSKESMAS)}">${highlightHTML(capitalizeWords(row.PUSKESMAS), searchTerm)}</td>
        <td class="totalpagu-cell currency" data-fulltext="${escapeHTML(row["TOTAL PAGU"])}">${formatRupiahWithHighlight(row["TOTAL PAGU"], searchTerm)}</td>
        <td class="pagupertahap-cell currency" data-fulltext="${escapeHTML(row["PAGU PER TAHAP"])}">${formatRupiahWithHighlight(row["PAGU PER TAHAP"], searchTerm)}</td>
        <td class="nilaipeng-cell currency" data-fulltext="${escapeHTML(row["NILAI PENGURANG"])}">${formatRupiahWithHighlight(row["NILAI PENGURANG"], searchTerm)}</td>
        <td class="nilaipenyaluran-cell currency" data-fulltext="${escapeHTML(row["NILAI PENYALURAN"])}">${formatRupiahWithHighlight(row["NILAI PENYALURAN"], searchTerm)}</td>
        <td class="sp2d-cell" data-fulltext="${escapeHTML(row.SP2D)}">${highlightHTML(row.SP2D, searchTerm)}</td>
        <td class="nilaisp2d-cell" data-fulltext="${escapeHTML(row["NILAI SP2D"])}">${highlightHTML(row["NILAI SP2D"], searchTerm)}</td>
        <td class="tanggal-cell" data-fulltext="${escapeHTML(row["TANGGAL SP2D"])}">${highlightHTML(row["TANGGAL SP2D"], searchTerm)}</td>
        `;
        // <td class="nilaipengg-cell" data-fulltext="${escapeHTML(row["NILAI PENGGUNAAN DANA"])}">${highlightHTML(row["NILAI PENGGUNAAN DANA"], searchTerm)}</td>
        tbody.appendChild(tr);

      // After inserting row to tbody:
      const tds = tr.querySelectorAll("td");
      tds.forEach(setTitleIfOverflowed);

    });
    requestAnimationFrame(() => {
      tbody.querySelectorAll("td").forEach(setTitleIfOverflowed);
    });
  }

  table.appendChild(tbody);
  container.appendChild(table);

  // container.classList.remove("fade-in");
  void container.offsetWidth;
  // container.classList.add("fade-in");

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
  ["#filterJenisPemda", "#filterJenisTahap", "#filterJenisGelombang", "#filterJenisPuskesmas"].forEach(sel => {
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

// Script to toggle mobile menu 
document.getElementById("mobileMenuButton").addEventListener("click", () => {
  document.getElementById("mobileMenu").classList.toggle("hidden");
});

// reset filters button
document.getElementById("resetFilters").addEventListener("click", resetAll);

// apply filters on change
$("#filterJenisPemda, #filterJenisTahap, #filterJenisGelombang, #filterJenisPuskesmas").on("change", () => {
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

// ---------- Initialization ----------
(async function init(){
  try {
    showToast("Loading data, please wait...");
    document.getElementById("loader").style.display = "flex";
    allData = await fetchAllRowsBatched(1000); // fetch all rows in batches of 1000
    allData.sort((a,b) => (Number(a.ID) || 0) - (Number(b.ID) || 0));
    filteredData = [...allData];

    // populate filter dropdowns
    const pemda = [...new Set(allData.map(r => r.PEMDA).filter(Boolean))].sort();
    const tah = [...new Set(allData.map(r => r["NAMA TAHAP"]).filter(Boolean))].sort();
    const gem = [...new Set(allData.map(r => r.GELOMBANG).filter(Boolean))].sort();
    const pus = [...new Set(allData.map(r => r.PUSKESMAS).filter(Boolean))].sort();

    fillSelect("#filterJenisPemda", pemda, "[ Pilih Kab / Kota ]");
    fillSelect("#filterJenisTahap", tah, "[ Pilih Tahap ]");
    fillSelect("#filterJenisGelombang", gem, "[ Pilih Gelombang ]");
    fillSelect("#filterJenisPuskesmas", pus, "[ Pilih Puskesmas ]");

    // load persistent UI state
    loadState();
    addCurrencyStyles();
    applyFiltersSearchAndSort();
    
    showToast("Data loaded successfully!");
    showMainContent();
  } catch (err) {
    console.error("Init error:", err);
    document.getElementById("tableContainer").innerHTML = `<p style="color:red;">Failed to load data. See console.</p>`;
    showMainContent();
  } finally {
    document.getElementById("loader").style.display = "none";
  }
})();