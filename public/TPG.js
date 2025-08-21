import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
const SUPABASE_URL = "https://kntomoredgduvwbovgpx.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtudG9tb3JlZGdkdXZ3Ym92Z3B4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2MzI0NzcsImV4cCI6MjA3MDIwODQ3N30.Ei7vJ8RQCiz7KPXis6He8dVzL91Euocxzxzg1ptg1_U";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ---------- Column list (exact DB names; spaces quoted) ----------
const COLUMNS = `
  ID,
  NIP,  
  NAMA,
  "NAMA PEMILIK REKENING",
  "NO REKENING",
  SATDIK,
  "JENIS TUNJANGAN",
  PEMDA,
  "SALUR BRUTO",
  PPH,
  "POT JKN",
  "SALUR NETTO",
  TRIWULAN
`;

// ---------- State ----------
let allData = [];         // full dataset (fetched once)
let filteredData = [];    // after filters + search + sort
let currentPage = 1;
let rowsPerPage = parseInt(document.getElementById("rowsPerPageSelect").value, 10) || 10;
const debounceMs = 350;
let debounceTimer = null;

// Sorting state
let sortColumn = null; // 'NIP', 'NAMA', or 'SATDIK'
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
    //   satdik: $("#filterJenisSatdik").val(),
    //   triwulan: $("#filterJenisTriwulan").val(),
    //   pemda: $("#filterJenisPemda").val(),
    //   tunj: $("#filterJenisTunjangan").val(),
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
      $("#filterJenisSatdik").val(state.filters.satdik).trigger("change");
      $("#filterJenisTriwulan").val(state.filters.triwulan).trigger("change");
      $("#filterJenisPemda").val(state.filters.pemda).trigger("change");
      $("#filterJenisTunjangan").val(state.filters.tunj).trigger("change");
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
  if (!str) return "";
  return str
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

// ---------- Get Last Updated ----------
async function getLastUpdated() {
  const { data, error } = await supabase
    .from('TKGTPG')
    .select('updated_at')
    .order('updated_at', { ascending: false })
    .limit(1);

    if (error) {
      console.error("Error fetching last updated time:", error);
      return;
    }

    if (data.length > 0) {
      const lastUpdated = new Date(data[0].updated_at);
      document.getElementById("last-updated").textContent = "Last Updated: " + lastUpdated.toLocaleString("id-ID", {year: 'numeric',month: 'long', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true});
    }
}

getLastUpdated();

async function fetchAllRowsBatched(batchSize = 1000) {
  // Get exact count first
  const headRes = await supabase
    .from('TKGTPG')
    .select('ID', { head: true, count: 'exact' });

  if (headRes.error) throw headRes.error;
  const total = headRes.count || 0;
  if (total === 0) return [];

  if (total <= batchSize) {
    const { data, error } = await supabase
      .from('TKGTPG')
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
      .from('TKGTPG')
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
  const satdik = $("#filterJenisSatdik").val();
  const triwulan = $("#filterJenisTriwulan").val();
  const pemda = $("#filterJenisPemda").val();
  const tunj = $("#filterJenisTunjangan").val();
  const searchTerm = (document.getElementById("searchInput").value || "").trim().toLowerCase();

  filteredData = allData.filter(row => {
    if (satdik && row.SATDIK !== satdik) return false;
    if (triwulan && row.TRIWULAN !== triwulan) return false;
    if (pemda && row.PEMDA !== pemda) return false;
    if (tunj && row["JENIS TUNJANGAN"] !== tunj) return false;

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

  // Headers with sortable columns (NIP, NAMA, SATDIK)
  const headers = [
    { key: "No", label: "#", sortable: true },
    { key: "NIP", label: "NIP", sortable: true },
    { key: "NAMA", label: "Nama", sortable: true },
    { key: "NAMA PEMILIK REKENING", label: "Nama Pemilik Rekening", sortable: true },
    { key: "NO REKENING", label: "No Rekening", sortable: true },
    { key: "SATDIK", label: "Satdik", sortable: true },
    { key: "JENIS TUNJANGAN", label: "Jenis Tunjangan", sortable: true },
    { key: "PEMDA", label: "Kab / Kota", sortable: true },
    { key: "SALUR BRUTO", label: "Salur Bruto", sortable: false },
    { key: "PPH", label: "PPH", sortable: false },
    { key: "POT JKN", label: "Pot JKN", sortable: false },
    { key: "SALUR NETTO", label: "Salur Netto", sortable: false },
    { key: "TRIWULAN", label: "Triwulan", sortable: false },
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
        <td class="nip-cell" data-fulltext="${escapeHTML(row.NIP)}">${highlightHTML(row.NIP, searchTerm)}</td>
        <td class="nama-cell" data-fulltext="${escapeHTML(row.NAMA)}">${highlightHTML(capitalizeWords(row.NAMA), searchTerm)}</td>
        <td class="namarek-cell" data-fulltext="${escapeHTML(row["NAMA PEMILIK REKENING"])}">${highlightHTML(capitalizeWords(row["NAMA PEMILIK REKENING"]), searchTerm)}</td>
        <td class="norek-cell" data-fulltext="${escapeHTML(row["NO REKENING"])}">${highlightHTML(row["NO REKENING"], searchTerm)}</td>
        <td class="satdik-cell" data-fulltext="${escapeHTML(row.SATDIK)}">${highlightHTML(capitalizeWords(row.SATDIK), searchTerm)}</td>
        <td class="jenistunjangan-cell" data-fulltext="${escapeHTML(row["JENIS TUNJANGAN"])}">${highlightHTML(capitalizeWords(row["JENIS TUNJANGAN"]), searchTerm)}</td>
        <td class="pemda-cell" data-fulltext="${escapeHTML(row.PEMDA)}">${highlightHTML(capitalizeWords(row.PEMDA), searchTerm)}</td>
        <td class="salurbrut-cell currency" data-fulltext="${escapeHTML(row["SALUR BRUTO"])}">${formatRupiahWithHighlight(row["SALUR BRUTO"], searchTerm)}</td>
        <td class="pph-cell currency" data-fulltext="${escapeHTML(row.PPH)}">${formatRupiahWithHighlight(row.PPH, searchTerm)}</td>
        <td class="jkn-cell currency" data-fulltext="${escapeHTML(row["POT JKN"])}">${formatRupiahWithHighlight(row["POT JKN"], searchTerm)}</td>
        <td class="salurnet-cell currency" data-fulltext="${escapeHTML(row["SALUR NETTO"])}">${formatRupiahWithHighlight(row["SALUR NETTO"], searchTerm)}</td>
        <td class="triwulan-cell" data-fulltext="${escapeHTML(row.TRIWULAN)}">${highlightHTML(row.TRIWULAN, searchTerm)}</td>
      `;
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
  ["#filterJenisSatdik", "#filterJenisTriwulan", "#filterJenisPemda", "#filterJenisTunjangan"].forEach(sel => {
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
$("#filterJenisSatdik, #filterJenisTriwulan, #filterJenisPemda, #filterJenisTunjangan").on("change", () => {
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
    const satdik = [...new Set(allData.map(r => r.SATDIK).filter(Boolean))].sort();
    const triw = [...new Set(allData.map(r => r.TRIWULAN).filter(Boolean))].sort();
    const pem = [...new Set(allData.map(r => r.PEMDA).filter(Boolean))].sort();
    const tun = [...new Set(allData.map(r => r["JENIS TUNJANGAN"]).filter(Boolean))].sort();

    fillSelect("#filterJenisSatdik", satdik, "[ Pilih Satdik ]");
    fillSelect("#filterJenisTriwulan", triw, "[ Pilih Triwulan ]");
    fillSelect("#filterJenisPemda", pem, "[ Pilih Kab / Kota ]");
    fillSelect("#filterJenisTunjangan", tun, "[ Pilih Tunjangan ]");

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