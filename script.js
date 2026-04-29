/* ===========================
   MONEYMATE - SCRIPT.JS
   =========================== */

// ---- STATE & STORAGE ----

// Data aktif di memori — diisi saat user login
let transaksi      = [];
let targetTabungan = 0;

/**
 * Ambil key localStorage yang unik per user.
 * Contoh: username "tasya" → key "transaksi_tasya" dan "target_tasya"
 */
function getKey(tipe) {
  const username = localStorage.getItem('moneymate_user') || 'guest';
  return tipe + '_' + username;
}

/**
 * Muat data milik user yang sedang login dari localStorage.
 * Dipanggil setiap kali user masuk ke aplikasi.
 */
function muatDataUser() {
  transaksi      = JSON.parse(localStorage.getItem(getKey('transaksi'))) || [];
  targetTabungan = parseFloat(localStorage.getItem(getKey('target'))) || 0;
}

/**
 * Simpan array transaksi milik user aktif ke localStorage.
 */
function simpanData() {
  localStorage.setItem(getKey('transaksi'), JSON.stringify(transaksi));
}

// ---- LOGIN / LOGOUT ----

const loginScreen = document.getElementById('login-screen');
const appWrapper  = document.getElementById('app-wrapper');

/**
 * Cek apakah user sudah login.
 * Jika sudah ada username di localStorage → langsung tampilkan app.
 * Jika belum → tampilkan halaman login.
 */
function cekLogin() {
  const username = localStorage.getItem('moneymate_user');
  if (username) {
    masukApp(username);
  } else {
    loginScreen.style.display = 'flex';
    appWrapper.style.display  = 'none';
  }
}

/**
 * Tampilkan aplikasi utama dan sembunyikan login screen.
 * @param {string} username - Nama user yang login
 */
function masukApp(username) {
  // Muat data milik user ini dari localStorage
  muatDataUser();

  // Sembunyikan login, tampilkan app dengan animasi
  loginScreen.style.display = 'none';
  appWrapper.style.display  = 'flex';

  // Tampilkan sapaan di dashboard
  const sapaanEl = document.getElementById('sapaan-user');
  if (sapaanEl) {
    sapaanEl.innerHTML = `Halo, <strong>${username}</strong> 👋 Semangat mengatur keuangan!`;
  }

  // Render dashboard dengan data user ini
  renderDashboard();
}

// Submit form login
document.getElementById('form-login').addEventListener('submit', (e) => {
  e.preventDefault();
  const username = document.getElementById('input-username').value.trim();

  if (!username) {
    showToast('Masukkan namamu dulu ya!', 'error');
    return;
  }

  // Simpan username ke localStorage
  localStorage.setItem('moneymate_user', username);
  masukApp(username);
  showToast(`Selamat datang, ${username}! 🎉`, 'success');
});

// Tombol Logout
document.getElementById('btn-logout').addEventListener('click', () => {
  if (!confirm('Yakin mau logout?')) return;

  // Hapus hanya sesi username — data transaksi & target user tetap tersimpan
  localStorage.removeItem('moneymate_user');

  // Reset state di memori agar tidak bocor ke user berikutnya
  transaksi      = [];
  targetTabungan = 0;

  // Kembali ke halaman login
  appWrapper.style.display  = 'none';
  loginScreen.style.display = 'flex';

  // Reset input login
  document.getElementById('input-username').value = '';
  showToast('Sampai jumpa! 👋', 'success');
});

// ---- NAVIGASI ----

const navItems = document.querySelectorAll('.nav-item');
const pages   = document.querySelectorAll('.page');

navItems.forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    const target = item.dataset.page;

    // Aktifkan nav item
    navItems.forEach(n => n.classList.remove('active'));
    item.classList.add('active');

    // Tampilkan halaman yang sesuai
    pages.forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + target).classList.add('active');

    // Refresh konten halaman
    if (target === 'dashboard')  renderDashboard();
    if (target === 'transaksi')  renderListTransaksi();
    if (target === 'target')     renderTarget();
  });
});

// ---- FORMAT RUPIAH ----
function formatRupiah(angka) {
  return 'Rp ' + Number(angka).toLocaleString('id-ID');
}

// ---- HITUNG RINGKASAN ----
function hitungRingkasan() {
  const pemasukan   = transaksi.filter(t => t.jenis === 'pemasukan').reduce((s, t) => s + t.jumlah, 0);
  const pengeluaran = transaksi.filter(t => t.jenis === 'pengeluaran').reduce((s, t) => s + t.jumlah, 0);
  const saldo       = pemasukan - pengeluaran;
  return { pemasukan, pengeluaran, saldo };
}

// ---- RENDER DASHBOARD ----

let chartInstance = null; // Simpan instance chart agar bisa di-destroy sebelum re-render

function renderDashboard() {
  const { pemasukan, pengeluaran, saldo } = hitungRingkasan();

  document.getElementById('total-saldo').textContent      = formatRupiah(saldo);
  document.getElementById('total-pemasukan').textContent  = formatRupiah(pemasukan);
  document.getElementById('total-pengeluaran').textContent = formatRupiah(pengeluaran);

  renderChart();
  renderInsight();
  renderRecentTransaksi();
}

// Render grafik pie pengeluaran per kategori
function renderChart() {
  const pengeluaranData = transaksi.filter(t => t.jenis === 'pengeluaran');

  // Kelompokkan per kategori
  const grouped = {};
  pengeluaranData.forEach(t => {
    grouped[t.kategori] = (grouped[t.kategori] || 0) + t.jumlah;
  });

  const labels = Object.keys(grouped);
  const data   = Object.values(grouped);

  const ctx = document.getElementById('chartKategori').getContext('2d');

  // Hapus chart lama jika ada
  if (chartInstance) {
    chartInstance.destroy();
  }

  if (labels.length === 0) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.font = '14px Poppins';
    ctx.fillStyle = '#ccc';
    ctx.textAlign = 'center';
    ctx.fillText('Belum ada data pengeluaran', ctx.canvas.width / 2, 80);
    return;
  }

  // Palet warna pastel
  const colors = [
    '#F28C8C','#FFB5A7','#FFD6D6','#FFCBA4',
    '#A8D8EA','#B5EAD7','#C7CEEA','#FFDAC1'
  ];

  chartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors.slice(0, labels.length),
        borderWidth: 0,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            font: { family: 'Poppins', size: 11 },
            color: '#666',
            padding: 12,
            boxWidth: 12
          }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => ' ' + formatRupiah(ctx.parsed)
          }
        }
      }
    }
  });
}

// Render insight keuangan
function renderInsight() {
  const container = document.getElementById('insight-list');

  if (transaksi.length === 0) {
    container.innerHTML = '<p class="empty-state">Belum ada data transaksi.</p>';
    return;
  }

  const insights = [];
  const { pemasukan, pengeluaran, saldo } = hitungRingkasan();

  // Insight 1: Kategori pengeluaran terbesar
  const grouped = {};
  transaksi.filter(t => t.jenis === 'pengeluaran').forEach(t => {
    grouped[t.kategori] = (grouped[t.kategori] || 0) + t.jumlah;
  });
  const sortedKat = Object.entries(grouped).sort((a, b) => b[1] - a[1]);
  if (sortedKat.length > 0) {
    insights.push({
      icon: 'fa-fire',
      text: `Pengeluaran terbesar: <strong>${sortedKat[0][0]}</strong> (${formatRupiah(sortedKat[0][1])})`
    });
  }

  // Insight 2: Rasio pengeluaran
  if (pemasukan > 0) {
    const rasio = Math.round((pengeluaran / pemasukan) * 100);
    const warna = rasio > 80 ? '⚠️' : '✅';
    insights.push({
      icon: 'fa-percent',
      text: `${warna} Kamu menggunakan <strong>${rasio}%</strong> dari total pemasukan`
    });
  }

  // Insight 3: Saldo positif/negatif
  if (saldo < 0) {
    insights.push({ icon: 'fa-triangle-exclamation', text: '⚠️ Pengeluaran melebihi pemasukan! Yuk kurangi pengeluaran.' });
  } else if (saldo > 0) {
    insights.push({ icon: 'fa-circle-check', text: `Saldo kamu positif. Pertahankan! 🎉` });
  }

  // Insight 4: Jumlah transaksi
  insights.push({
    icon: 'fa-receipt',
    text: `Total <strong>${transaksi.length}</strong> transaksi tercatat`
  });

  container.innerHTML = insights.map(i => `
    <div class="insight-item">
      <i class="fa-solid ${i.icon}"></i>
      <span>${i.text}</span>
    </div>
  `).join('');
}

// Render 5 transaksi terbaru di dashboard
function renderRecentTransaksi() {
  const container = document.getElementById('recent-list');
  const recent = [...transaksi].reverse().slice(0, 5);

  if (recent.length === 0) {
    container.innerHTML = '<p class="empty-state">Belum ada transaksi.</p>';
    return;
  }

  container.innerHTML = recent.map(t => buatItemHTML(t)).join('');

  // Pasang event hapus
  container.querySelectorAll('.btn-hapus').forEach(btn => {
    btn.addEventListener('click', () => hapusTransaksi(btn.dataset.id));
  });
}

// ---- FORM TAMBAH TRANSAKSI ----

// Set tanggal default ke hari ini
document.getElementById('tanggal').valueAsDate = new Date();

// Toggle jenis transaksi
document.querySelectorAll('.toggle-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('jenis').value = btn.dataset.jenis;
  });
});

// Submit form
document.getElementById('form-transaksi').addEventListener('submit', (e) => {
  e.preventDefault();

  const jenis    = document.getElementById('jenis').value;
  // Kalikan 1000: user input "100" → tersimpan sebagai 100.000
  const jumlah   = parseFloat(document.getElementById('jumlah').value) * 1000;
  const kategori = document.getElementById('kategori').value;
  const tanggal  = document.getElementById('tanggal').value;
  const catatan  = document.getElementById('catatan').value.trim();

  // Validasi
  if (!jumlah || jumlah <= 0) {
    showToast('Jumlah harus lebih dari 0', 'error');
    return;
  }
  if (!kategori) {
    showToast('Pilih kategori terlebih dahulu', 'error');
    return;
  }

  // Buat objek transaksi baru
  const data = {
    id: Date.now().toString(),
    jenis,
    jumlah,
    kategori,
    tanggal,
    catatan
  };

  transaksi.push(data);
  simpanData();

  showToast('Transaksi berhasil disimpan! 🎉', 'success');

  // Reset form
  e.target.reset();
  document.getElementById('tanggal').valueAsDate = new Date();
  document.getElementById('jenis').value = 'pemasukan';
  document.querySelectorAll('.toggle-btn').forEach((b, i) => {
    b.classList.toggle('active', i === 0);
  });
});

// ---- RENDER LIST TRANSAKSI ----

function renderListTransaksi() {
  const filterJenis    = document.getElementById('filter-jenis').value;
  const filterKategori = document.getElementById('filter-kategori').value;
  const container      = document.getElementById('list-transaksi');

  // Filter data
  let filtered = [...transaksi].reverse();
  if (filterJenis !== 'semua')    filtered = filtered.filter(t => t.jenis === filterJenis);
  if (filterKategori !== 'semua') filtered = filtered.filter(t => t.kategori === filterKategori);

  if (filtered.length === 0) {
    container.innerHTML = '<p class="empty-state">Tidak ada transaksi ditemukan.</p>';
    return;
  }

  container.innerHTML = filtered.map(t => buatItemHTML(t)).join('');

  // Pasang event hapus
  container.querySelectorAll('.btn-hapus').forEach(btn => {
    btn.addEventListener('click', () => hapusTransaksi(btn.dataset.id));
  });
}

// Event filter
document.getElementById('filter-jenis').addEventListener('change', renderListTransaksi);
document.getElementById('filter-kategori').addEventListener('change', renderListTransaksi);

// ---- BUAT HTML ITEM TRANSAKSI ----
function buatItemHTML(t) {
  const isIn   = t.jenis === 'pemasukan';
  const icon   = isIn ? 'fa-arrow-up' : 'fa-arrow-down';
  const prefix = isIn ? '+' : '-';
  const tgl    = new Date(t.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

  return `
    <div class="transaksi-item">
      <div class="transaksi-left">
        <div class="transaksi-icon ${isIn ? 'icon-pemasukan' : 'icon-pengeluaran'}">
          <i class="fa-solid ${icon}"></i>
        </div>
        <div class="transaksi-detail">
          <span class="transaksi-kategori">${t.kategori}</span>
          <span class="transaksi-meta">${tgl}${t.catatan ? ' · ' + t.catatan : ''}</span>
        </div>
      </div>
      <div class="transaksi-right">
        <span class="transaksi-jumlah ${isIn ? 'jumlah-pemasukan' : 'jumlah-pengeluaran'}">
          ${prefix} ${formatRupiah(t.jumlah)}
        </span>
        <button class="btn-hapus" data-id="${t.id}" title="Hapus">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    </div>
  `;
}

// ---- HAPUS TRANSAKSI ----
function hapusTransaksi(id) {
  if (!confirm('Hapus transaksi ini?')) return;
  transaksi = transaksi.filter(t => t.id !== id);
  simpanData();
  showToast('Transaksi dihapus', 'error');

  // Refresh halaman yang sedang aktif
  const activePage = document.querySelector('.page.active').id;
  if (activePage === 'page-dashboard')  renderDashboard();
  if (activePage === 'page-transaksi')  renderListTransaksi();
}

// ---- TARGET TABUNGAN ----

function renderTarget() {
  const { saldo } = hitungRingkasan();
  const display   = document.getElementById('target-display');

  // Sembunyikan display jika target belum di-set
  if (targetTabungan <= 0) {
    display.style.display = 'none';
    return;
  }

  display.style.display = 'block';

  // Hitung progress — tampilkan max 100% di UI, tapi simpan nilai asli untuk pesan
  const progressAsli = (saldo / targetTabungan) * 100;
  const persen       = Math.min(Math.round(progressAsli), 100);
  const sisanya      = targetTabungan - saldo;

  // Update info saldo & target
  document.getElementById('target-saldo-now').textContent = formatRupiah(saldo);
  document.getElementById('target-nominal').textContent   = formatRupiah(targetTabungan);

  // Update progress bar & label
  document.getElementById('progress-fill').style.width   = persen + '%';
  document.getElementById('progress-persen').textContent = persen + '%';

  // Update info sisa tabungan
  const sisaEl = document.getElementById('target-sisa');
  if (saldo >= targetTabungan) {
    sisaEl.textContent = '✅ Target sudah terpenuhi';
    sisaEl.className   = 'target-sisa sisa-tercapai';
  } else {
    sisaEl.textContent = `Sisa yang harus ditabung: ${formatRupiah(sisanya)}`;
    sisaEl.className   = 'target-sisa sisa-belum';
  }

  // Pesan dinamis berdasarkan kondisi progress
  const msgEl = document.getElementById('target-message');
  if (persen >= 100) {
    msgEl.className   = 'target-message tercapai';
    msgEl.textContent = '🎉 Selamat! Target tabungan kamu sudah tercapai!';
  } else if (persen >= 50) {
    msgEl.className   = 'target-message hampir';
    msgEl.textContent = `🔥 Semangat! Target kamu hampir tercapai (${persen}%)`;
  } else {
    msgEl.className   = 'target-message belum';
    msgEl.textContent = `💪 Yuk mulai menabung! Kamu baru mencapai ${persen}% dari target`;
  }
}

// Set target
document.getElementById('btn-set-target').addEventListener('click', () => {
  const val = parseFloat(document.getElementById('input-target').value);

  // Validasi: harus angka positif
  if (!val || val <= 0) {
    showToast('Masukkan target yang valid', 'error');
    return;
  }

  targetTabungan = val;
  // Simpan target per user dengan key unik
  localStorage.setItem(getKey('target'), val);
  renderTarget();
  showToast('Target tabungan disimpan! 🎯', 'success');
});

// ---- TOAST NOTIFIKASI ----
function showToast(pesan, tipe = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = pesan;
  toast.className   = 'toast show ' + tipe;
  setTimeout(() => { toast.className = 'toast'; }, 3000);
}

// ---- INIT ----
// Cek status login saat halaman pertama kali dibuka
cekLogin();
