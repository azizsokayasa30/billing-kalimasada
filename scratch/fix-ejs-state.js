const fs = require('fs');

const FILE_PATH = 'views/admin/billing/customers.ejs';
let content = fs.readFileSync(FILE_PATH, 'utf8');

// Include all filters in the hidden inputs of both timeFilterForm and the main filter form
// First fix timeFilterForm
const timeFilterFormReplacement = `                    <!-- Carry over other filters so we don't lose them -->
                    <% if(typeof filters !== 'undefined') { %>
                        <% if(filters.package_id) { %><input type="hidden" name="package_id" value="<%= filters.package_id %>"><% } %>
                        <% if(filters.area) { %><input type="hidden" name="area" value="<%= filters.area %>"><% } %>
                        <% if(filters.collector_id) { %><input type="hidden" name="collector_id" value="<%= filters.collector_id %>"><% } %>
                        <% if(filters.payment_status) { %><input type="hidden" name="payment_status" value="<%= filters.payment_status %>"><% } %>
                        <% if(filters.customer_type) { %><input type="hidden" name="customer_type" value="<%= filters.customer_type %>"><% } %>
                    <% } %>`;

content = content.replace(/<!-- Carry over other filters so we don't lose them -->[\s\S]*?<% } %>/g, timeFilterFormReplacement);

// Main filter form needs to carry over month/year/customer_type
const mainFormReplacement = `<form method="GET" action="/admin/billing/customers" class="row mb-4 bg-light p-3 rounded border mx-0">
                            <!-- Preserve time filters and customer_type -->
                            <% if(typeof selectedMonth !== 'undefined') { %><input type="hidden" name="month" value="<%= selectedMonth %>"><% } %>
                            <% if(typeof selectedYear !== 'undefined') { %><input type="hidden" name="year" value="<%= selectedYear %>"><% } %>
                            <% if(typeof filters !== 'undefined' && filters.customer_type) { %><input type="hidden" name="customer_type" value="<%= filters.customer_type %>"><% } %>`;

content = content.replace('<form method="GET" action="/admin/billing/customers" class="row mb-4 bg-light p-3 rounded border mx-0">', mainFormReplacement);

fs.writeFileSync(FILE_PATH, content, 'utf8');
console.log('Fixed EJS state preservation');
