const fs = require('fs');

const FILE_PATH = 'views/admin/billing/customers.ejs';
let content = fs.readFileSync(FILE_PATH, 'utf8');

const oldCardsRegex = /<!-- Summary Cards -->[\s\S]*?<!-- Customer Table -->/;

const newCardsHtml = `<!-- Month/Year Filter -->
                <form method="GET" action="/admin/billing/customers" class="mb-3 d-flex align-items-end gap-2" id="timeFilterForm">
                    <div>
                        <label class="form-label small fw-bold text-muted mb-1">Bulan</label>
                        <select name="month" class="form-select form-select-sm shadow-sm border-primary" style="width: 150px;">
                            <% const months = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']; %>
                            <% for(let i=1; i<=12; i++) { %>
                                <option value="<%= i %>" <%= typeof selectedMonth !== 'undefined' && selectedMonth == i ? 'selected' : '' %>><%= months[i-1] %></option>
                            <% } %>
                        </select>
                    </div>
                    <div>
                        <label class="form-label small fw-bold text-muted mb-1">Tahun</label>
                        <select name="year" class="form-select form-select-sm shadow-sm border-primary" style="width: 100px;">
                            <% const currentY = new Date().getFullYear(); %>
                            <% for(let y=currentY-3; y<=currentY+1; y++) { %>
                                <option value="<%= y %>" <%= typeof selectedYear !== 'undefined' && selectedYear == y ? 'selected' : '' %>><%= y %></option>
                            <% } %>
                        </select>
                    </div>
                    <button type="submit" class="btn btn-primary btn-sm mb-0">Terapkan Rentang Waktu</button>
                    <!-- Carry over other filters so we don't lose them -->
                    <% if(typeof filters !== 'undefined') { %>
                        <% if(filters.package_id) { %><input type="hidden" name="package_id" value="<%= filters.package_id %>"><% } %>
                        <% if(filters.area) { %><input type="hidden" name="area" value="<%= filters.area %>"><% } %>
                        <% if(filters.collector_id) { %><input type="hidden" name="collector_id" value="<%= filters.collector_id %>"><% } %>
                        <% if(filters.search) { %><input type="hidden" name="search" value="<%= filters.search %>"><% } %>
                    <% } %>
                </form>

                <style>
                    .summary-card:hover { transform: translateY(-3px); box-shadow: 0 .5rem 1rem rgba(0,0,0,.15)!important; }
                </style>

                <!-- Summary Cards -->
                <div class="row mb-4 g-3">
                    <div class="col-xl-2 col-md-4 col-6">
                        <a href="/admin/billing/customers?month=<%= typeof selectedMonth !== 'undefined' ? selectedMonth : '' %>&year=<%= typeof selectedYear !== 'undefined' ? selectedYear : '' %>" class="text-decoration-none">
                            <div class="card border-0 shadow-sm h-100 summary-card" style="border-left: 4px solid #6366f1 !important; border-radius: 12px;">
                                <div class="card-body p-3">
                                    <div class="d-flex justify-content-between align-items-center">
                                        <div>
                                            <p class="text-muted fw-semibold mb-1" style="font-size:0.75rem;">Total Pelanggan</p>
                                            <h3 class="mb-0 fw-bold mt-2" style="color:#6366f1;"><%= typeof customerStats !== 'undefined' ? customerStats.total : 0 %></h3>
                                        </div>
                                        <div class="rounded-circle d-flex align-items-center justify-content-center" style="width:40px;height:40px;background:rgba(99,102,241,0.12);flex-shrink:0;">
                                            <i class="bi bi-people-fill" style="font-size:1.1rem;color:#6366f1;"></i>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </a>
                    </div>

                    <div class="col-xl-2 col-md-4 col-6">
                        <a href="/admin/billing/customers?customer_type=aktif&month=<%= typeof selectedMonth !== 'undefined' ? selectedMonth : '' %>&year=<%= typeof selectedYear !== 'undefined' ? selectedYear : '' %>" class="text-decoration-none">
                            <div class="card border-0 shadow-sm h-100 summary-card" style="border-left: 4px solid #22c55e !important; border-radius: 12px;">
                                <div class="card-body p-3">
                                    <div class="d-flex justify-content-between align-items-center">
                                        <div>
                                            <p class="text-muted fw-semibold mb-1" style="font-size:0.75rem;">Pelanggan Aktif</p>
                                            <h3 class="mb-0 fw-bold mt-2" style="color:#22c55e;"><%= typeof customerStats !== 'undefined' ? customerStats.aktif : 0 %></h3>
                                        </div>
                                        <div class="rounded-circle d-flex align-items-center justify-content-center" style="width:40px;height:40px;background:rgba(34,197,94,0.12);flex-shrink:0;">
                                            <i class="bi bi-person-check-fill" style="font-size:1.1rem;color:#22c55e;"></i>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </a>
                    </div>

                    <div class="col-xl-2 col-md-4 col-6">
                        <a href="/admin/billing/customers?customer_type=nonaktif&month=<%= typeof selectedMonth !== 'undefined' ? selectedMonth : '' %>&year=<%= typeof selectedYear !== 'undefined' ? selectedYear : '' %>" class="text-decoration-none">
                            <div class="card border-0 shadow-sm h-100 summary-card" style="border-left: 4px solid #ef4444 !important; border-radius: 12px;">
                                <div class="card-body p-3">
                                    <div class="d-flex justify-content-between align-items-center">
                                        <div>
                                            <p class="text-muted fw-semibold mb-1" style="font-size:0.75rem;">Nonaktif/Isolir</p>
                                            <h3 class="mb-0 fw-bold mt-2" style="color:#ef4444;"><%= typeof customerStats !== 'undefined' ? customerStats.nonaktif : 0 %></h3>
                                        </div>
                                        <div class="rounded-circle d-flex align-items-center justify-content-center" style="width:40px;height:40px;background:rgba(239,68,68,0.12);flex-shrink:0;">
                                            <i class="bi bi-slash-circle-fill" style="font-size:1.1rem;color:#ef4444;"></i>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </a>
                    </div>

                    <div class="col-xl-2 col-md-4 col-6">
                        <a href="/admin/billing/customers?payment_status=paid&month=<%= typeof selectedMonth !== 'undefined' ? selectedMonth : '' %>&year=<%= typeof selectedYear !== 'undefined' ? selectedYear : '' %>" class="text-decoration-none">
                            <div class="card border-0 shadow-sm h-100 summary-card" style="border-left: 4px solid #10b981 !important; border-radius: 12px;">
                                <div class="card-body p-3">
                                    <div class="d-flex justify-content-between align-items-center">
                                        <div>
                                            <p class="text-muted fw-semibold mb-1" style="font-size:0.75rem;">Sudah Lunas</p>
                                            <h3 class="mb-0 fw-bold mt-2" style="color:#10b981;"><%= typeof customerStats !== 'undefined' ? customerStats.lunas : 0 %></h3>
                                        </div>
                                        <div class="rounded-circle d-flex align-items-center justify-content-center" style="width:40px;height:40px;background:rgba(16,185,129,0.12);flex-shrink:0;">
                                            <i class="bi bi-check-circle-fill" style="font-size:1.1rem;color:#10b981;"></i>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </a>
                    </div>

                    <div class="col-xl-2 col-md-4 col-6">
                        <a href="/admin/billing/customers?payment_status=unpaid&month=<%= typeof selectedMonth !== 'undefined' ? selectedMonth : '' %>&year=<%= typeof selectedYear !== 'undefined' ? selectedYear : '' %>" class="text-decoration-none">
                            <div class="card border-0 shadow-sm h-100 summary-card" style="border-left: 4px solid #f59e0b !important; border-radius: 12px;">
                                <div class="card-body p-3">
                                    <div class="d-flex justify-content-between align-items-center">
                                        <div>
                                            <p class="text-muted fw-semibold mb-1" style="font-size:0.75rem;">Belum Lunas</p>
                                            <h3 class="mb-0 fw-bold mt-2" style="color:#f59e0b;"><%= typeof customerStats !== 'undefined' ? customerStats.belum_lunas : 0 %></h3>
                                        </div>
                                        <div class="rounded-circle d-flex align-items-center justify-content-center" style="width:40px;height:40px;background:rgba(245,158,11,0.12);flex-shrink:0;">
                                            <i class="bi bi-clock-history" style="font-size:1.1rem;color:#f59e0b;"></i>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </a>
                    </div>

                    <div class="col-xl-2 col-md-4 col-6">
                        <a href="/admin/billing/customers?customer_type=baru&month=<%= typeof selectedMonth !== 'undefined' ? selectedMonth : '' %>&year=<%= typeof selectedYear !== 'undefined' ? selectedYear : '' %>" class="text-decoration-none">
                            <div class="card border-0 shadow-sm h-100 summary-card" style="border-left: 4px solid #06b6d4 !important; border-radius: 12px;">
                                <div class="card-body p-3">
                                    <div class="d-flex justify-content-between align-items-center">
                                        <div>
                                            <p class="text-muted fw-semibold mb-1" style="font-size:0.75rem;">Pelanggan Baru</p>
                                            <h3 class="mb-0 fw-bold mt-2" style="color:#06b6d4;"><%= typeof customerStats !== 'undefined' ? customerStats.baru : 0 %></h3>
                                        </div>
                                        <div class="rounded-circle d-flex align-items-center justify-content-center" style="width:40px;height:40px;background:rgba(6,182,212,0.12);flex-shrink:0;">
                                            <i class="bi bi-person-plus-fill" style="font-size:1.1rem;color:#06b6d4;"></i>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </a>
                    </div>
                </div>

                <!-- Customer Table -->`;

content = content.replace(oldCardsRegex, newCardsHtml);
fs.writeFileSync(FILE_PATH, content, 'utf8');
console.log('Modified customers.ejs');
