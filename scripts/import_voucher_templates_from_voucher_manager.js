#!/usr/bin/env node
/**
 * Script untuk import semua template voucher dari voucher-manager ke sistem CVLMEDIA
 * Template diambil dari file create-multiple-voucher-templates.php
 */

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../data/billing.db');
const db = new sqlite3.Database(dbPath);

// Template dari voucher-manager (dari file create-multiple-voucher-templates.php)
const templates = [
    {
        name: 'Modern Gradient',
        code: `{include file="rad-template-header.tpl"} <!-- DON'T REMOVE THIS LINE -->

<style>
.container {
width: 187px !important;
height: 127px !important;
display: inline-block !important;
margin: 4px 2px !important;
vertical-align: top !important;
box-shadow: 0 4px 12px rgba(0,0,0,0.15);
border-radius: 8px;
overflow: hidden;
position: relative !important;
float: none !important;
background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
border: 2px solid #667eea;
}
.row {
display: flex;
flex-wrap: wrap;
width: 100%;
}
.col-1, .col-2, .col-5, .col-9, .col-10 {
position: relative;
width: 100%;
}
.col-1 { flex: 0 0 10%; max-width: 10%; }
.col-2 { flex: 0 0 20%; max-width: 20%; }
.col-5 { flex: 0 0 50%; max-width: 50%; }
.col-9 { flex: 0 0 90%; max-width: 90%; }
.col-10 { flex: 0 0 100%; max-width: 100%; }
.text-center { text-align: center; }
.mt-2 { margin-top: 4px; }
.mt-5 { margin-top: 10px; }
.p-1 { padding: 2px; }
.pt-1 { padding-top: 2px; }
.pb-1 { padding-bottom: 2px; }
.gradient-header {
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
color: white;
padding: 6px 0;
}
.gradient-price {
background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
color: white;
font-weight: bold;
}
.code-highlight {
background: linear-gradient(135deg, #ffffff 0%, #e3f2fd 100%);
border: 2px solid #667eea;
border-radius: 4px;
padding: 6px;
font-weight: bold;
letter-spacing: 1px;
box-shadow: 0 2px 4px rgba(102, 126, 234, 0.2);
}
</style>

{foreach $v as $vs} <!-- DON'T REMOVE THIS LINE -->
<div class="container" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%); border: 2px solid #667eea; position: relative;">
<div class="row" style="background: rgba(255,255,255,0.95); border-radius: 4px; margin: 2px; padding: 2px 0;">
<div class="col-10">
<div class="row gradient-header" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); margin: 0; display: flex; align-items: center; justify-content: center; padding: 4px 8px;">
{if $vs['logo_url'] neq ''}
<div style="flex: 0 0 auto; margin-right: 8px;">
<img src="{$vs['logo_url']}" alt="Logo" style="max-height: 35px; max-width: 100px; height: auto; width: auto; display: block !important; visibility: visible !important; opacity: 1 !important; object-fit: contain;" onerror="this.style.display='none';">
</div>
{/if}
<div style="flex: 1; text-align: center;">
<p style="margin: 0; color: white; font-size: 11px; font-weight: bold;">
{$vs['company_name']}
</p>
</div>
</div>
<div class="row" style="margin-top: 4px; margin-left: 4px; margin-right: 4px;">
{if $vs['code'] eq $vs['secret']} 
<div class="col-10 text-center p-1">
<p style="margin: 2px 0; font-weight: 600;">
<span style="color: #667eea; font-size:9px; text-transform: uppercase;">
{if $vs['timelimit'] eq 'unlimited'} {if $vs['datalimit'] eq 'unlimited'} {$vs['validperiod']} {else} {$vs['datalimit']} {/if} {else} {$vs['timelimit']} {/if}
</span>
</p>
<div class="code-highlight" style="margin-top: 4px;">
<span style="font-size:24px; color: #667eea; font-family: 'Courier New', monospace;">{$vs['code']}</span>
</div>
</div>
{else} 
<div class="col-5 text-center p-1">
<p style="margin: 2px 0; font-weight: 600;">
<span style="color: #667eea;">USERNAME</span>
</p>
<div class="code-highlight" style="margin-top: 4px;">
<span style="font-size:14px; color: #333; font-family: 'Courier New', monospace;">{$vs['code']}</span>
</div>
</div>
<div class="col-5 text-center p-1">
<p style="margin: 2px 0; font-weight: 600; color: #667eea;">PASSWORD</p>
<div class="code-highlight" style="margin-top: 4px;">
<span style="font-size:14px; color: #333; font-family: 'Courier New', monospace;">{$vs['secret']}</span>
</div>
</div>
{/if} 
</div>
<div class="row gradient-price" style="margin: 4px 0; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
<div class="col-10 text-center" style="padding: 4px 0;">
<h5 style="margin: 0; font-size: 16px; color: white; text-shadow: 1px 1px 2px rgba(0,0,0,0.2);">
{$vs['total']}
</h5>
</div>
</div>
<div class="row" style="margin: 0; padding: 0 4px 2px 4px; position: absolute; bottom: 0; left: 0; right: 0; width: 100%; box-sizing: border-box;">
<div class="col-10 text-center">
<p style="margin: 0; font-size: 10px; color: #333;">
Login: http://{$hotspotdns}
</p>
</div>
</div>
</div>
</div>
</div>
{/foreach} <!-- DON'T REMOVE THIS LINE -->
{include file="rad-template-footer.tpl"} <!-- DON'T REMOVE THIS LINE -->`
    },
    {
        name: 'Classic Blue',
        code: `{include file="rad-template-header.tpl"} <!-- DON'T REMOVE THIS LINE -->

<style>
.container {
width: 187px !important;
height: 127px !important;
display: inline-block !important;
margin: 4px 2px !important;
vertical-align: top !important;
box-shadow: 0 2px 8px rgba(0,0,0,0.1);
border-radius: 4px;
overflow: visible;
position: relative !important;
float: none !important;
background: #ffffff;
border: 2px solid #2196F3;
padding: 0 !important;
box-sizing: border-box;
}
.row {
display: flex;
flex-wrap: wrap;
width: 100%;
margin: 0;
padding: 0;
}
.col-1, .col-2, .col-5, .col-9, .col-10 {
position: relative;
width: 100%;
}
.col-1 { flex: 0 0 10%; max-width: 10%; }
.col-2 { flex: 0 0 20%; max-width: 20%; }
.col-5 { flex: 0 0 50%; max-width: 50%; }
.col-9 { flex: 0 0 90%; max-width: 90%; }
.col-10 { flex: 0 0 100%; max-width: 100%; width: 100% !important; margin: 0 !important; padding: 0 !important; }
.text-center { text-align: center; }
.mt-2 { margin-top: 4px; }
.p-1 { padding: 2px; }
.pt-1 { padding-top: 2px; }
.pb-1 { padding-bottom: 2px; }
</style>

{foreach $v as $vs} <!-- DON'T REMOVE THIS LINE -->
<div class="container" style="background: #ffffff; border: 2px solid #2196F3; overflow: visible; padding: 0 !important; box-sizing: border-box;">
<div class="row" style="margin: 0 !important; padding: 0 !important; width: 100% !important;">
<div class="col-10" style="padding: 0 !important; margin: 0 !important; width: 100% !important;">
<div class="row" style="background: #2196F3; margin: 0 !important; padding: 2px 4px !important; display: flex; align-items: center; justify-content: center; width: 100% !important; min-height: 24px; max-height: 24px; box-sizing: border-box; overflow: hidden;">
{if $vs['logo_url'] neq ''}
<div style="flex: 0 0 auto; margin-right: 4px; max-width: 60px; overflow: hidden;">
<img src="{$vs['logo_url']}" alt="Logo" style="max-height: 20px; max-width: 60px; height: auto; width: auto; display: block !important; visibility: visible !important; opacity: 1 !important; object-fit: contain;" onerror="this.style.display='none';">
</div>
{/if}
<div style="flex: 1; text-align: center; min-width: 0; overflow: hidden;">
<p style="margin: 0; color: white; font-size: 9px; font-weight: bold; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
{$vs['company_name']}
</p>
</div>
</div>
<div class="row" style="margin-top: 3px; margin-bottom: 1px; margin-left: 4px; margin-right: 4px;">
{if $vs['code'] eq $vs['secret']} 
<div class="col-10 text-center p-1" style="text-align: center !important;">
<p style="margin: 1px 0; font-weight: 600; color: #2196F3; font-size: 8px; text-align: center;">
{if $vs['timelimit'] eq 'unlimited'} {if $vs['datalimit'] eq 'unlimited'} {$vs['validperiod']} {else} {$vs['datalimit']} {/if} {else} {$vs['timelimit']} {/if}
</p>
<div style="background: #E3F2FD; border: 2px solid #2196F3; border-radius: 3px; padding: 4px; margin-top: 2px; text-align: center;">
<span style="font-size:18px; color: #1976D2; font-family: 'Courier New', monospace; font-weight: bold; display: inline-block; text-align: center;">{$vs['code']}</span>
</div>
</div>
{else} 
<div class="col-5 text-center p-1" style="text-align: center !important;">
<p style="margin: 1px 0; font-weight: 600; color: #2196F3; font-size: 9px; text-align: center;">USERNAME</p>
<div style="background: #E3F2FD; border: 2px solid #2196F3; border-radius: 3px; padding: 4px; margin-top: 2px; text-align: center;">
<span style="font-size:11px; color: #1976D2; font-family: 'Courier New', monospace; font-weight: bold; display: inline-block; text-align: center;">{$vs['code']}</span>
</div>
</div>
<div class="col-5 text-center p-1" style="text-align: center !important;">
<p style="margin: 1px 0; font-weight: 600; color: #2196F3; font-size: 9px; text-align: center;">PASSWORD</p>
<div style="background: #E3F2FD; border: 2px solid #2196F3; border-radius: 3px; padding: 4px; margin-top: 2px; text-align: center;">
<span style="font-size:11px; color: #1976D2; font-family: 'Courier New', monospace; font-weight: bold; display: inline-block; text-align: center;">{$vs['secret']}</span>
</div>
</div>
{/if} 
</div>
<!-- Pemisah putih antara voucher code dan harga -->
<div class="row" style="background: #ffffff; margin: 2px 0; height: 1px;"></div>
<div class="row" style="margin: 0 0 1px 0; padding: 0 4px; display: flex; align-items: center; justify-content: space-between;">
<div style="background: #1976D2; padding: 2px 5px; display: inline-block; text-align: left;">
<h5 style="margin: 0; font-size: 12px; color: white; font-weight: bold; text-align: left;">
{$vs['total']}
</h5>
</div>
<div style="text-align: right; flex: 1; padding-left: 8px;">
<p style="margin: 0; padding: 0; font-size: 9px; color: #000; text-align: right; line-height: 1.2; font-weight: 400;">
Aktif : {$vs['validity']}<br>
Durasi : {$vs['duration']}
</p>
</div>
</div>
<div class="row" style="margin: 0; padding: 0 4px 2px 4px; position: absolute; bottom: 0; left: 0; right: 0; width: 100%; box-sizing: border-box;">
<div class="col-10" style="padding: 0; text-align: right; padding-right: 4px;">
<p style="margin: 0; padding: 0; font-size: 9px; color: #000; text-align: right; line-height: 1.2; font-weight: 400;">
Login: http://{$hotspotdns}
</p>
</div>
</div>
</div>
</div>
</div>
{/foreach} <!-- DON'T REMOVE THIS LINE -->
{include file="rad-template-footer.tpl"} <!-- DON'T REMOVE THIS LINE -->`
    },
    {
        name: 'Green Nature',
        code: `{include file="rad-template-header.tpl"} <!-- DON'T REMOVE THIS LINE -->

<style>
.container {
width: 187px !important;
height: 127px !important;
display: inline-block !important;
margin: 4px 2px !important;
vertical-align: top !important;
box-shadow: 0 2px 8px rgba(0,0,0,0.1);
border-radius: 4px;
overflow: hidden;
position: relative !important;
float: none !important;
background: #ffffff;
border: 2px solid #4CAF50;
}
.row {
display: flex;
flex-wrap: wrap;
width: 100%;
}
.col-1, .col-2, .col-5, .col-9, .col-10 {
position: relative;
width: 100%;
}
.col-1 { flex: 0 0 10%; max-width: 10%; }
.col-2 { flex: 0 0 20%; max-width: 20%; }
.col-5 { flex: 0 0 50%; max-width: 50%; }
.col-9 { flex: 0 0 90%; max-width: 90%; }
.col-10 { flex: 0 0 100%; max-width: 100%; }
.text-center { text-align: center; }
.mt-2 { margin-top: 4px; }
.p-1 { padding: 2px; }
.pt-1 { padding-top: 2px; }
.pb-1 { padding-bottom: 2px; }
</style>

{foreach $v as $vs} <!-- DON'T REMOVE THIS LINE -->
<div class="container" style="background: #ffffff; border: 2px solid #4CAF50; position: relative;">
<div class="row">
<div class="col-10">
<div class="row" style="background: linear-gradient(135deg, #4CAF50 0%, #388E3C 100%); margin: 0; display: flex; align-items: center; justify-content: center; padding: 4px 8px;">
{if $vs['logo_url'] neq ''}
<div style="flex: 0 0 auto; margin-right: 8px;">
<img src="{$vs['logo_url']}" alt="Logo" style="max-height: 35px; max-width: 100px; height: auto; width: auto; display: block !important; visibility: visible !important; opacity: 1 !important; object-fit: contain;" onerror="this.style.display='none';">
</div>
{/if}
<div style="flex: 1; text-align: center;">
<p style="margin: 0; color: white; font-size: 11px; font-weight: bold;">
{$vs['company_name']}
</p>
</div>
</div>
<div class="row" style="margin-top: 4px; margin-left: 4px; margin-right: 4px;">
{if $vs['code'] eq $vs['secret']} 
<div class="col-10 text-center p-1">
<p style="margin: 2px 0; font-weight: 600; color: #4CAF50; font-size: 9px;">
{if $vs['timelimit'] eq 'unlimited'} {if $vs['datalimit'] eq 'unlimited'} {$vs['validperiod']} {else} {$vs['datalimit']} {/if} {else} {$vs['timelimit']} {/if}
</p>
<div style="background: #E8F5E9; border: 2px solid #4CAF50; border-radius: 4px; padding: 6px; margin-top: 4px;">
<span style="font-size:24px; color: #2E7D32; font-family: 'Courier New', monospace; font-weight: bold;">{$vs['code']}</span>
</div>
</div>
{else} 
<div class="col-5 text-center p-1">
<p style="margin: 2px 0; font-weight: 600; color: #4CAF50; font-size: 10px;">USERNAME</p>
<div style="background: #E8F5E9; border: 2px solid #4CAF50; border-radius: 4px; padding: 6px; margin-top: 4px;">
<span style="font-size:14px; color: #2E7D32; font-family: 'Courier New', monospace; font-weight: bold;">{$vs['code']}</span>
</div>
</div>
<div class="col-5 text-center p-1">
<p style="margin: 2px 0; font-weight: 600; color: #4CAF50; font-size: 10px;">PASSWORD</p>
<div style="background: #E8F5E9; border: 2px solid #4CAF50; border-radius: 4px; padding: 6px; margin-top: 4px;">
<span style="font-size:14px; color: #2E7D32; font-family: 'Courier New', monospace; font-weight: bold;">{$vs['secret']}</span>
</div>
</div>
{/if} 
</div>
<div class="row" style="background: linear-gradient(135deg, #66BB6A 0%, #4CAF50 100%); margin: 4px 0;">
<div class="col-10 text-center" style="padding: 4px 0;">
<h5 style="margin: 0; font-size: 16px; color: white; font-weight: bold;">
Rp {$vs['total']}
</h5>
</div>
</div>
<div class="row" style="margin: 0; padding: 0 4px 2px 4px; position: absolute; bottom: 0; left: 0; right: 0; width: 100%; box-sizing: border-box;">
<div class="col-10 text-center">
<p style="margin: 0; font-size: 10px; color: #33691E;">
<span style="font-weight: 600;">Login:</span> <span style="color: #4CAF50; font-weight: bold;">http://{$hotspotdns}</span>
</p>
</div>
</div>
</div>
</div>
</div>
{/foreach} <!-- DON'T REMOVE THIS LINE -->
{include file="rad-template-footer.tpl"} <!-- DON'T REMOVE THIS LINE -->`
    },
    {
        name: 'Orange Energy',
        code: `{include file="rad-template-header.tpl"} <!-- DON'T REMOVE THIS LINE -->

<style>
.container {
width: 187px !important;
height: 127px !important;
display: inline-block !important;
margin: 4px 2px !important;
vertical-align: top !important;
box-shadow: 0 2px 8px rgba(0,0,0,0.1);
border-radius: 4px;
overflow: hidden;
position: relative !important;
float: none !important;
background: #ffffff;
border: 2px solid #FF9800;
}
.row {
display: flex;
flex-wrap: wrap;
width: 100%;
}
.col-1, .col-2, .col-5, .col-9, .col-10 {
position: relative;
width: 100%;
}
.col-1 { flex: 0 0 10%; max-width: 10%; }
.col-2 { flex: 0 0 20%; max-width: 20%; }
.col-5 { flex: 0 0 50%; max-width: 50%; }
.col-9 { flex: 0 0 90%; max-width: 90%; }
.col-10 { flex: 0 0 100%; max-width: 100%; }
.text-center { text-align: center; }
.mt-2 { margin-top: 4px; }
.p-1 { padding: 2px; }
.pt-1 { padding-top: 2px; }
.pb-1 { padding-bottom: 2px; }
</style>

{foreach $v as $vs} <!-- DON'T REMOVE THIS LINE -->
<div class="container" style="background: #ffffff; border: 2px solid #FF9800; position: relative;">
<div class="row">
<div class="col-10">
<div class="row" style="background: linear-gradient(135deg, #FF9800 0%, #F57C00 100%); margin: 0; display: flex; align-items: center; justify-content: center; padding: 4px 8px;">
{if $vs['logo_url'] neq ''}
<div style="flex: 0 0 auto; margin-right: 8px;">
<img src="{$vs['logo_url']}" alt="Logo" style="max-height: 35px; max-width: 100px; height: auto; width: auto; display: block !important; visibility: visible !important; opacity: 1 !important; object-fit: contain;" onerror="this.style.display='none';">
</div>
{/if}
<div style="flex: 1; text-align: center;">
<p style="margin: 0; color: white; font-size: 11px; font-weight: bold;">
{$vs['company_name']}
</p>
</div>
</div>
<div class="row" style="margin-top: 4px; margin-left: 4px; margin-right: 4px;">
{if $vs['code'] eq $vs['secret']} 
<div class="col-10 text-center p-1">
<p style="margin: 2px 0; font-weight: 600; color: #FF9800; font-size: 9px;">
{if $vs['timelimit'] eq 'unlimited'} {if $vs['datalimit'] eq 'unlimited'} {$vs['validperiod']} {else} {$vs['datalimit']} {/if} {else} {$vs['timelimit']} {/if}
</p>
<div style="background: #FFF3E0; border: 2px solid #FF9800; border-radius: 4px; padding: 6px; margin-top: 4px;">
<span style="font-size:24px; color: #E65100; font-family: 'Courier New', monospace; font-weight: bold;">{$vs['code']}</span>
</div>
</div>
{else} 
<div class="col-5 text-center p-1">
<p style="margin: 2px 0; font-weight: 600; color: #FF9800; font-size: 10px;">USERNAME</p>
<div style="background: #FFF3E0; border: 2px solid #FF9800; border-radius: 4px; padding: 6px; margin-top: 4px;">
<span style="font-size:14px; color: #E65100; font-family: 'Courier New', monospace; font-weight: bold;">{$vs['code']}</span>
</div>
</div>
<div class="col-5 text-center p-1">
<p style="margin: 2px 0; font-weight: 600; color: #FF9800; font-size: 10px;">PASSWORD</p>
<div style="background: #FFF3E0; border: 2px solid #FF9800; border-radius: 4px; padding: 6px; margin-top: 4px;">
<span style="font-size:14px; color: #E65100; font-family: 'Courier New', monospace; font-weight: bold;">{$vs['secret']}</span>
</div>
</div>
{/if} 
</div>
<div class="row" style="background: linear-gradient(135deg, #FFB74D 0%, #FF9800 100%); margin: 4px 0;">
<div class="col-10 text-center" style="padding: 4px 0;">
<h5 style="margin: 0; font-size: 16px; color: white; font-weight: bold;">
Rp {$vs['total']}
</h5>
</div>
</div>
<div class="row" style="margin: 0; padding: 0 4px 2px 4px; position: absolute; bottom: 0; left: 0; right: 0; width: 100%; box-sizing: border-box;">
<div class="col-10 text-center">
<p style="margin: 0; font-size: 10px; color: #E65100;">
<span style="font-weight: 600;">Login:</span> <span style="color: #FF9800; font-weight: bold;">http://{$hotspotdns}</span>
</p>
</div>
</div>
</div>
</div>
</div>
{/foreach} <!-- DON'T REMOVE THIS LINE -->
{include file="rad-template-footer.tpl"} <!-- DON'T REMOVE THIS LINE -->`
    },
    {
        name: 'Red Classic',
        code: `{include file="rad-template-header.tpl"} <!-- DON'T REMOVE THIS LINE -->

<style>
.container {
width: 187px !important;
height: 127px !important;
display: inline-block !important;
margin: 4px 2px !important;
vertical-align: top !important;
box-shadow: 0 2px 8px rgba(0,0,0,0.1);
border-radius: 4px;
overflow: hidden;
position: relative !important;
float: none !important;
background: #ffffff;
border: 2px solid #F44336;
}
.row {
display: flex;
flex-wrap: wrap;
width: 100%;
}
.col-1, .col-2, .col-5, .col-9, .col-10 {
position: relative;
width: 100%;
}
.col-1 { flex: 0 0 10%; max-width: 10%; }
.col-2 { flex: 0 0 20%; max-width: 20%; }
.col-5 { flex: 0 0 50%; max-width: 50%; }
.col-9 { flex: 0 0 90%; max-width: 90%; }
.col-10 { flex: 0 0 100%; max-width: 100%; }
.text-center { text-align: center; }
.mt-2 { margin-top: 4px; }
.p-1 { padding: 2px; }
.pt-1 { padding-top: 2px; }
.pb-1 { padding-bottom: 2px; }
</style>

{foreach $v as $vs} <!-- DON'T REMOVE THIS LINE -->
<div class="container" style="background: #ffffff; border: 2px solid #F44336; position: relative;">
<div class="row">
<div class="col-10">
<div class="row" style="background: linear-gradient(135deg, #F44336 0%, #D32F2F 100%); margin: 0; display: flex; align-items: center; justify-content: center; padding: 4px 8px;">
{if $vs['logo_url'] neq ''}
<div style="flex: 0 0 auto; margin-right: 8px;">
<img src="{$vs['logo_url']}" alt="Logo" style="max-height: 35px; max-width: 100px; height: auto; width: auto; display: block !important; visibility: visible !important; opacity: 1 !important; object-fit: contain;" onerror="this.style.display='none';">
</div>
{/if}
<div style="flex: 1; text-align: center;">
<p style="margin: 0; color: white; font-size: 11px; font-weight: bold;">
{$vs['company_name']}
</p>
</div>
</div>
<div class="row" style="margin-top: 4px; margin-left: 4px; margin-right: 4px;">
{if $vs['code'] eq $vs['secret']} 
<div class="col-10 text-center p-1">
<p style="margin: 2px 0; font-weight: 600; color: #F44336; font-size: 9px;">
{if $vs['timelimit'] eq 'unlimited'} {if $vs['datalimit'] eq 'unlimited'} {$vs['validperiod']} {else} {$vs['datalimit']} {/if} {else} {$vs['timelimit']} {/if}
</p>
<div style="background: #FFEBEE; border: 2px solid #F44336; border-radius: 4px; padding: 6px; margin-top: 4px;">
<span style="font-size:24px; color: #C62828; font-family: 'Courier New', monospace; font-weight: bold;">{$vs['code']}</span>
</div>
</div>
{else} 
<div class="col-5 text-center p-1">
<p style="margin: 2px 0; font-weight: 600; color: #F44336; font-size: 10px;">USERNAME</p>
<div style="background: #FFEBEE; border: 2px solid #F44336; border-radius: 4px; padding: 6px; margin-top: 4px;">
<span style="font-size:14px; color: #C62828; font-family: 'Courier New', monospace; font-weight: bold;">{$vs['code']}</span>
</div>
</div>
<div class="col-5 text-center p-1">
<p style="margin: 2px 0; font-weight: 600; color: #F44336; font-size: 10px;">PASSWORD</p>
<div style="background: #FFEBEE; border: 2px solid #F44336; border-radius: 4px; padding: 6px; margin-top: 4px;">
<span style="font-size:14px; color: #C62828; font-family: 'Courier New', monospace; font-weight: bold;">{$vs['secret']}</span>
</div>
</div>
{/if} 
</div>
<div class="row" style="background: linear-gradient(135deg, #EF5350 0%, #F44336 100%); margin: 4px 0;">
<div class="col-10 text-center" style="padding: 4px 0;">
<h5 style="margin: 0; font-size: 16px; color: white; font-weight: bold;">
Rp {$vs['total']}
</h5>
</div>
</div>
<div class="row" style="margin: 0; padding: 0 4px 2px 4px; position: absolute; bottom: 0; left: 0; right: 0; width: 100%; box-sizing: border-box;">
<div class="col-10 text-center">
<p style="margin: 0; font-size: 10px; color: #C62828;">
<span style="font-weight: 600;">Login:</span> <span style="color: #F44336; font-weight: bold;">http://{$hotspotdns}</span>
</p>
</div>
</div>
</div>
</div>
</div>
{/foreach} <!-- DON'T REMOVE THIS LINE -->
{include file="rad-template-footer.tpl"} <!-- DON'T REMOVE THIS LINE -->`
    }
];

// Pastikan tabel ada
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS voucher_print_templates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            template_name TEXT NOT NULL UNIQUE,
            template_code TEXT NOT NULL,
            is_default INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'enabled' CHECK (status IN ('enabled', 'disabled')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) {
            console.error('Error creating table:', err);
            process.exit(1);
        }
        
        console.log('📦 Importing templates from voucher-manager...\n');
        
        let created = 0;
        let updated = 0;
        let processed = 0;
        
        templates.forEach((template, index) => {
            // Cek apakah template sudah ada
            db.get(
                'SELECT id FROM voucher_print_templates WHERE template_name = ?',
                [template.name],
                (err, row) => {
                    if (err) {
                        console.error(`Error checking template ${template.name}:`, err);
                        processed++;
                        if (processed === templates.length) {
                            db.close();
                            console.log(`\n✅ Import selesai!`);
                            console.log(`- Template baru: ${created}`);
                            console.log(`- Template diupdate: ${updated}`);
                            process.exit(0);
                        }
                        return;
                    }
                    
                    if (row) {
                        // Update template yang sudah ada
                        db.run(
                            'UPDATE voucher_print_templates SET template_code = ?, updated_at = CURRENT_TIMESTAMP WHERE template_name = ?',
                            [template.code, template.name],
                            function(updateErr) {
                                if (updateErr) {
                                    console.error(`❌ Error updating template ${template.name}:`, updateErr);
                                } else {
                                    updated++;
                                    console.log(`✅ Template '${template.name}' berhasil diupdate`);
                                }
                                processed++;
                                if (processed === templates.length) {
                                    db.close();
                                    console.log(`\n📊 Summary:`);
                                    console.log(`- Template baru: ${created}`);
                                    console.log(`- Template diupdate: ${updated}`);
                                    console.log(`- Total template: ${created + updated}`);
                                    process.exit(0);
                                }
                            }
                        );
                    } else {
                        // Insert template baru
                        // Set template pertama sebagai default
                        const isDefault = index === 0 ? 1 : 0;
                        db.run(
                            'INSERT INTO voucher_print_templates (template_name, template_code, is_default, status) VALUES (?, ?, ?, ?)',
                            [template.name, template.code, isDefault, 'enabled'],
                            function(insertErr) {
                                if (insertErr) {
                                    console.error(`❌ Error inserting template ${template.name}:`, insertErr);
                                } else {
                                    created++;
                                    console.log(`✅ Template '${template.name}' berhasil dibuat${isDefault ? ' (default)' : ''}`);
                                }
                                processed++;
                                if (processed === templates.length) {
                                    db.close();
                                    console.log(`\n📊 Summary:`);
                                    console.log(`- Template baru: ${created}`);
                                    console.log(`- Template diupdate: ${updated}`);
                                    console.log(`- Total template: ${created + updated}`);
                                    process.exit(0);
                                }
                            }
                        );
                    }
                }
            );
        });
    });
});
