-- Migration: Create voucher_print_templates table
-- Date: 2026-01-09
-- Description: Create table for storing voucher print templates

CREATE TABLE IF NOT EXISTS voucher_print_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_name TEXT NOT NULL UNIQUE,
    template_code TEXT NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'enabled' CHECK (status IN ('enabled', 'disabled')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create index for default template lookup
CREATE INDEX IF NOT EXISTS idx_voucher_print_templates_default ON voucher_print_templates(is_default, status);

-- Create index for status lookup
CREATE INDEX IF NOT EXISTS idx_voucher_print_templates_status ON voucher_print_templates(status);

-- Insert default template (sama persis dengan voucher-manager)
INSERT OR IGNORE INTO voucher_print_templates (template_name, template_code, is_default, status) VALUES (
    'Default Template',
    '<style>
#actprint{
margin-top: 4px;
margin-left: 4px;
padding: 1px 4px 1px 4px;
}
.f10 {
font-size: 10px;
}
.f11 {
font-size: 11px;
}
.f13 {
font-size: 13px;
}
.bold {
font-weight: 700;
}
h5,
h3 {
font-weight: 700;
}
h5 {
font-size: 18px;
}
h3 {
font-size: 22px;
}
.bg-white {
background-color: #fff;
}
.text-white {
color: #fff;
}
.text-gray {
color: #6c757d;
}
.text-dark {
color: #343a40;
}
.bg-light {
background-color: #e9ecef;
}
*,
*:after,
*:before {
margin: 0;
padding: 0;
box-sizing: border-box;
}
body {
margin-left: 4px;
margin-top: 4px;
font-size: 16px;
font-family: sans-serif;
}
img {
width: auto;
max-width: 100%;
height: auto !important;
}
hr{
margin: 7px 0 5px;
}
.container {
width: 187px;
height: 127px;
display: inline-block;
margin-left: 1px;
margin-right: 3px;
margin-bottom: 5px;
}
.row {
display: flex;
flex-wrap: wrap;
}
.col-1,
.col-2,
.col-5,
.col-9,
.col-10 {
position: relative;
width: 100%;
}
.col-1 {
flex: 0 0 10%;
max-width: 10%;
}
.col-2 {
flex: 0 0 20%;
max-width: 20%;
}
.col-5 {
flex: 0 0 50%;
max-width: 50%;
}
.col-9 {
flex: 0 0 90%;
max-width: 90%;
}
.col-10 {
flex: 0 0 100%;
max-width: 100%;
}
.rotate-r90 {
-webkit-transform: rotate(90deg);
-moz-transform: rotate(90deg);
-ms-transform: rotate(90deg);
-o-transform: rotate(90deg);
transform: rotate(90deg);
}
.text-center {
text-align: center;
}
.mt-2 {
margin-top: 4px;
}
.mt-5 {
margin-top: 10px;
}
.mr-2 {
margin-right: 4px;
}
.mr-3 {
margin-right: 6px;
}
.mb-1 {
margin-bottom: 2px;
}
.mb-2 {
margin-bottom: 4px;
}
.ml-2 {
margin-left: 4px;
}
.ml-3 {
margin-left: 6px;
}
.p-1 {
padding: 2px;
}
.pt-1 {
padding-top: 2px;
}
.pr-2 {
padding-right: 4px;
}
.pb-1 {
padding-bottom: 2px;
}
.pl-2 {
padding-left: 4px;
}
.border-1 {
border: 1px solid #dee2e6;
}
.border-top-2 {
border-top: 2px solid #dee2e6;
}
.border-bottom-1 {
border-bottom: 1px solid #dee2e6;
}
.rounded {
border-radius: 0.25rem !important;
}
</style>

{{#each vouchers}}
<div class="container bg-white border-1 border-dark">
<div class="row">
<div class="col-9 border-1 border-dark">
<div class="row">
<div class="col-10 pt-1">
<p class="f13 bold text-center border-bottom-1 border-white text-dark pb-1"><img style="width:100px;height:30px" src="{{logoUrl}}"><br>
Voucher HotSpot
</p>
</div>
</div>
<div class="row mt-2 ml-2 mr-2">
<div class="{{#if (ne username password)}}col-5 text-center p-1{{else}}col-10 text-center p-1{{/if}}">
<p class="f11 text-dark">
{{#if (ne username password)}}
Username
{{else}}
<span style="font-weight:bold;font-size:10px;text-transform: uppercase;">
{{#if validityText}}{{validityText}}{{else}}{{#if uptimeText}}{{uptimeText}}{{/if}}{{/if}}
</span>
{{/if}}
</p>
<p style="font-family: ''Courier New'';font-weight:bold;color:#333" class="f13 text-gray bg-light mt-2 pt-1 pb-1 rounded">{{#if (eq username password)}}<span style="font-size:22px">{{username}}</span>{{else}}{{username}}{{/if}}</p>
</div>
{{#if (ne username password)}}
<div class="col-5 text-center p-1">
<p class="f11 text-dark">Password</p>
<p style="font-family: ''Courier New'';font-weight:bold;color:#333;margin-top: 4px" class="f13 text-gray bg-light pt-1 pb-1 rounded">{{password}}</p>
</div>
{{/if}}
</div>
<div class="row">
<div class="col-10 text-center mb-1">
<h5 class="text-white"><script>{{price}}</script></h5>
</div>
</div>
<div class="row bg-light ml-3 mr-3">
<div class="col-10 text-center p-1">
<p class="f10"><span class="pr-2"></span>
{{#if (ne username password)}}
{{#if validityText}}{{validityText}}{{else}}{{#if uptimeText}}{{uptimeText}}{{/if}}{{/if}}
<br>
{{/if}}
Login : http://{{hotspotDns}}</p>
</div>
</div>
</div>
<div class="col-1 bg-light border-top-2 border-dark">
<h3 style="font-size:14px;" class="rotate-r90 mt-5 text-dark">{{currencyCode}}&nbsp;{{price}}</h3>
</div>
</div>
</div>
{{/each}}',
    1,
    'enabled'
);

-- Trigger to update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_voucher_print_templates_updated_at
    AFTER UPDATE ON voucher_print_templates
    FOR EACH ROW
BEGIN
    UPDATE voucher_print_templates SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
