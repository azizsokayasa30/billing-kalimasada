#!/usr/bin/env node
/**
 * Script untuk import semua template voucher dari mikhmon-fix ke sistem CVLMEDIA
 * Mencari template di database atau file konfigurasi mikhmon-fix
 */

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const dbPath = path.join(__dirname, '../data/billing.db');
const db = new sqlite3.Database(dbPath);

// Template tambahan dari mikhmon (jika ada di database atau file)
// Template ini adalah template standar mikhmon yang mungkin belum ada di voucher-manager
const mikhmonTemplates = [
    {
        name: 'Mikhmon Classic',
        code: `{include file="rad-template-header.tpl"} <!-- DON'T REMOVE THIS LINE -->

<style>
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

{foreach $v as $vs} <!-- DON'T REMOVE THIS LINE -->
<div class="container bg-white border-1 border-dark">
<div class="row">
<div class="col-9 border-1 border-dark">
<div class="row">
<div class="col-10 pt-1">
<p class="f13 bold text-center border-bottom-1 border-white text-dark pb-1"><img style="width:100px;height:30px" src="{$vs['logo_url']}" onerror="this.style.display='none';"><br>
{$vs['company_name']}
</p>
</div>
</div>
<div class="row mt-2 ml-2 mr-2">
<div class="{{#if (ne username password)}}col-5 text-center p-1{{else}}col-10 text-center p-1{{/if}}">
<p class="f11 text-dark">
{if $vs['code'] neq $vs['secret']}
Username
{else}
<span style="font-weight:bold;font-size:10px;text-transform: uppercase;">
{if $vs['timelimit'] eq 'unlimited'} {if $vs['datalimit'] eq 'unlimited'} {$vs['validperiod']} {else} {$vs['datalimit']} {/if} {else} {$vs['timelimit']} {/if}
</span>
{/if}
</p>
<p style="font-family: 'Courier New';font-weight:bold;color:#333" class="f13 text-gray bg-light mt-2 pt-1 pb-1 rounded">{if $vs['code'] eq $vs['secret']}<span style="font-size:22px">{$vs['code']}</span>{else}{$vs['code']}{/if}</p>
</div>
{if $vs['code'] neq $vs['secret']}
<div class="col-5 text-center p-1">
<p class="f11 text-dark">Password</p>
<p style="font-family: 'Courier New';font-weight:bold;color:#333;margin-top: 4px" class="f13 text-gray bg-light pt-1 pb-1 rounded">{$vs['secret']}</p>
</div>
{/if} 
</div>
<div class="row mt-2 ml-2 mr-2">
<div class="{{#if (ne username password)}}col-5 text-center p-1{{else}}col-10 text-center p-1{{/if}}">
<p class="f11 text-dark">
{if $vs['code'] neq $vs['secret']}
{if $vs['timelimit'] eq 'unlimited'} {if $vs['datalimit'] eq 'unlimited'} {$vs['validperiod']} {else} {$vs['datalimit']} {/if} {else} {$vs['timelimit']} {/if}
{/if}
</p>
</div>
{if $vs['code'] neq $vs['secret']}
<div class="col-5 text-center p-1">
<p class="f11 text-dark">{$vs['total']}</p>
</div>
{/if} 
</div>
</div>
<div class="col-1 rotate-r90 text-center" style="writing-mode: vertical-rl; text-orientation: mixed;">
<p class="f10 bold text-white bg-dark pt-1 pb-1 mb-0">{$vs['total']}</p>
</div>
</div>
<div class="row">
<div class="col-10 text-center">
<p class="f10 text-dark mb-0">Login: http://{$hotspotdns}</p>
</div>
</div>
</div>
{/foreach} <!-- DON'T REMOVE THIS LINE -->
{include file="rad-template-footer.tpl"} <!-- DON'T REMOVE THIS LINE -->`
    },
    {
        name: 'Mikhmon Default',
        code: `{include file="rad-template-header.tpl"} <!-- DON'T REMOVE THIS LINE -->

<style>
.container {
width: 187px !important;
height: 127px !important;
display: inline-block !important;
margin: 4px 2px !important;
vertical-align: top !important;
border: 1px solid #ddd;
border-radius: 4px;
overflow: hidden;
position: relative !important;
float: none !important;
background: #ffffff;
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
<div class="container" style="background: #ffffff; border: 1px solid #ddd; position: relative;">
<div class="row">
<div class="col-10">
<div class="row" style="background: #f8f9fa; margin: 0; padding: 4px 8px; border-bottom: 1px solid #ddd;">
<div style="flex: 1; text-align: center;">
<p style="margin: 0; color: #333; font-size: 11px; font-weight: bold;">
{$vs['company_name']}
</p>
</div>
</div>
<div class="row" style="margin-top: 4px; margin-left: 4px; margin-right: 4px;">
{if $vs['code'] eq $vs['secret']} 
<div class="col-10 text-center p-1">
<p style="margin: 2px 0; font-weight: 600; color: #666; font-size: 9px;">
{if $vs['timelimit'] eq 'unlimited'} {if $vs['datalimit'] eq 'unlimited'} {$vs['validperiod']} {else} {$vs['datalimit']} {/if} {else} {$vs['timelimit']} {/if}
</p>
<div style="background: #f8f9fa; border: 1px solid #ddd; border-radius: 3px; padding: 6px; margin-top: 4px;">
<span style="font-size:20px; color: #333; font-family: 'Courier New', monospace; font-weight: bold;">{$vs['code']}</span>
</div>
</div>
{else} 
<div class="col-5 text-center p-1">
<p style="margin: 1px 0; font-weight: 600; color: #666; font-size: 9px;">USERNAME</p>
<div style="background: #f8f9fa; border: 1px solid #ddd; border-radius: 3px; padding: 4px; margin-top: 2px;">
<span style="font-size:11px; color: #333; font-family: 'Courier New', monospace; font-weight: bold;">{$vs['code']}</span>
</div>
</div>
<div class="col-5 text-center p-1">
<p style="margin: 1px 0; font-weight: 600; color: #666; font-size: 9px;">PASSWORD</p>
<div style="background: #f8f9fa; border: 1px solid #ddd; border-radius: 3px; padding: 4px; margin-top: 2px;">
<span style="font-size:11px; color: #333; font-family: 'Courier New', monospace; font-weight: bold;">{$vs['secret']}</span>
</div>
</div>
{/if} 
</div>
<div class="row" style="margin: 2px 0; padding: 2px 4px;">
<div class="col-10 text-center">
<p style="margin: 0; font-size: 12px; color: #333; font-weight: bold;">
{$vs['total']}
</p>
</div>
</div>
<div class="row" style="margin: 0; padding: 0 4px 2px 4px; position: absolute; bottom: 0; left: 0; right: 0; width: 100%; box-sizing: border-box;">
<div class="col-10 text-center">
<p style="margin: 0; font-size: 9px; color: #666;">
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
        name: 'Mikhmon Default with QR Code',
        code: `{include file="rad-template-header.tpl"} <!-- DON'T REMOVE THIS LINE -->

<style>
.container {
width: 187px !important;
height: 127px !important;
display: inline-block !important;
margin: 4px 2px !important;
vertical-align: top !important;
border: 1px solid #ddd;
border-radius: 4px;
overflow: hidden;
position: relative !important;
float: none !important;
background: #ffffff;
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
.qr-code {
width: 40px;
height: 40px;
margin: 2px auto;
}
</style>

{foreach $v as $vs} <!-- DON'T REMOVE THIS LINE -->
<div class="container" style="background: #ffffff; border: 1px solid #ddd; position: relative;">
<div class="row">
<div class="col-10">
<div class="row" style="background: #f8f9fa; margin: 0; padding: 4px 8px; border-bottom: 1px solid #ddd;">
<div style="flex: 1; text-align: center;">
<p style="margin: 0; color: #333; font-size: 11px; font-weight: bold;">
{$vs['company_name']}
</p>
</div>
</div>
<div class="row" style="margin-top: 2px; margin-left: 4px; margin-right: 4px;">
{if $vs['code'] eq $vs['secret']} 
<div class="col-10 text-center p-1">
<p style="margin: 1px 0; font-weight: 600; color: #666; font-size: 8px;">
{if $vs['timelimit'] eq 'unlimited'} {if $vs['datalimit'] eq 'unlimited'} {$vs['validperiod']} {else} {$vs['datalimit']} {/if} {else} {$vs['timelimit']} {/if}
</p>
<div style="background: #f8f9fa; border: 1px solid #ddd; border-radius: 3px; padding: 4px; margin-top: 2px;">
<span style="font-size:16px; color: #333; font-family: 'Courier New', monospace; font-weight: bold;">{$vs['code']}</span>
</div>
</div>
{else} 
<div class="col-5 text-center p-1">
<p style="margin: 1px 0; font-weight: 600; color: #666; font-size: 8px;">USERNAME</p>
<div style="background: #f8f9fa; border: 1px solid #ddd; border-radius: 3px; padding: 3px; margin-top: 1px;">
<span style="font-size:10px; color: #333; font-family: 'Courier New', monospace; font-weight: bold;">{$vs['code']}</span>
</div>
</div>
<div class="col-5 text-center p-1">
<p style="margin: 1px 0; font-weight: 600; color: #666; font-size: 8px;">PASSWORD</p>
<div style="background: #f8f9fa; border: 1px solid #ddd; border-radius: 3px; padding: 3px; margin-top: 1px;">
<span style="font-size:10px; color: #333; font-family: 'Courier New', monospace; font-weight: bold;">{$vs['secret']}</span>
</div>
</div>
{/if} 
</div>
<div class="row" style="margin: 1px 0; padding: 1px 4px; display: flex; align-items: center; justify-content: space-between;">
<div style="flex: 1; text-align: center;">
<p style="margin: 0; font-size: 11px; color: #333; font-weight: bold;">
{$vs['total']}
</p>
</div>
<div class="qr-code" id="qrcode-{$vs['code']}" style="width: 35px; height: 35px; margin: 0;"></div>
</div>
<div class="row" style="margin: 0; padding: 0 4px 2px 4px; position: absolute; bottom: 0; left: 0; right: 0; width: 100%; box-sizing: border-box;">
<div class="col-10 text-center">
<p style="margin: 0; font-size: 8px; color: #666;">
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
        name: 'Mikhmon Custom with Color',
        code: `{include file="rad-template-header.tpl"} <!-- DON'T REMOVE THIS LINE -->

<style>
.container {
width: 187px !important;
height: 127px !important;
display: inline-block !important;
margin: 4px 2px !important;
vertical-align: top !important;
box-shadow: 0 2px 8px rgba(0,0,0,0.1);
border-radius: 6px;
overflow: hidden;
position: relative !important;
float: none !important;
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
.p-1 { padding: 2px; }
.pt-1 { padding-top: 2px; }
.pb-1 { padding-bottom: 2px; }
</style>

{foreach $v as $vs} <!-- DON'T REMOVE THIS LINE -->
<div class="container" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: 2px solid #667eea; position: relative;">
<div class="row" style="background: rgba(255,255,255,0.98); border-radius: 4px; margin: 2px; padding: 2px 0;">
<div class="col-10">
<div class="row" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); margin: 0; display: flex; align-items: center; justify-content: center; padding: 4px 8px;">
{if $vs['logo_url'] neq ''}
<div style="flex: 0 0 auto; margin-right: 8px;">
<img src="{$vs['logo_url']}" alt="Logo" style="max-height: 30px; max-width: 80px; height: auto; width: auto; display: block !important; visibility: visible !important; opacity: 1 !important; object-fit: contain;" onerror="this.style.display='none';">
</div>
{/if}
<div style="flex: 1; text-align: center;">
<p style="margin: 0; color: white; font-size: 10px; font-weight: bold;">
{$vs['company_name']}
</p>
</div>
</div>
<div class="row" style="margin-top: 3px; margin-left: 4px; margin-right: 4px;">
{if $vs['code'] eq $vs['secret']} 
<div class="col-10 text-center p-1">
<p style="margin: 1px 0; font-weight: 600; color: #667eea; font-size: 8px;">
{if $vs['timelimit'] eq 'unlimited'} {if $vs['datalimit'] eq 'unlimited'} {$vs['validperiod']} {else} {$vs['datalimit']} {/if} {else} {$vs['timelimit']} {/if}
</p>
<div style="background: linear-gradient(135deg, #ffffff 0%, #e3f2fd 100%); border: 2px solid #667eea; border-radius: 4px; padding: 5px; margin-top: 2px;">
<span style="font-size:18px; color: #667eea; font-family: 'Courier New', monospace; font-weight: bold;">{$vs['code']}</span>
</div>
</div>
{else} 
<div class="col-5 text-center p-1">
<p style="margin: 1px 0; font-weight: 600; color: #667eea; font-size: 9px;">USERNAME</p>
<div style="background: linear-gradient(135deg, #ffffff 0%, #e3f2fd 100%); border: 2px solid #667eea; border-radius: 4px; padding: 4px; margin-top: 2px;">
<span style="font-size:11px; color: #333; font-family: 'Courier New', monospace; font-weight: bold;">{$vs['code']}</span>
</div>
</div>
<div class="col-5 text-center p-1">
<p style="margin: 1px 0; font-weight: 600; color: #667eea; font-size: 9px;">PASSWORD</p>
<div style="background: linear-gradient(135deg, #ffffff 0%, #e3f2fd 100%); border: 2px solid #667eea; border-radius: 4px; padding: 4px; margin-top: 2px;">
<span style="font-size:11px; color: #333; font-family: 'Courier New', monospace; font-weight: bold;">{$vs['secret']}</span>
</div>
</div>
{/if} 
</div>
<div class="row" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); margin: 3px 0;">
<div class="col-10 text-center" style="padding: 3px 0;">
<h5 style="margin: 0; font-size: 14px; color: white; font-weight: bold; text-shadow: 1px 1px 2px rgba(0,0,0,0.2);">
{$vs['total']}
</h5>
</div>
</div>
<div class="row" style="margin: 0; padding: 0 4px 2px 4px; position: absolute; bottom: 0; left: 0; right: 0; width: 100%; box-sizing: border-box;">
<div class="col-10 text-center">
<p style="margin: 0; font-size: 9px; color: #333;">
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
        name: 'Mikhmon Small',
        code: `{include file="rad-template-header.tpl"} <!-- DON'T REMOVE THIS LINE -->

<style>
.container {
width: 187px !important;
height: 127px !important;
display: inline-block !important;
margin: 4px 2px !important;
vertical-align: top !important;
border: 1px solid #ddd;
border-radius: 3px;
overflow: hidden;
position: relative !important;
float: none !important;
background: #ffffff;
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
<div class="container" style="background: #ffffff; border: 1px solid #ddd; position: relative;">
<div class="row">
<div class="col-10">
<div class="row" style="background: #f8f9fa; margin: 0; padding: 3px 6px; border-bottom: 1px solid #ddd;">
<div style="flex: 1; text-align: center;">
<p style="margin: 0; color: #333; font-size: 10px; font-weight: bold;">
{$vs['company_name']}
</p>
</div>
</div>
<div class="row" style="margin-top: 3px; margin-left: 3px; margin-right: 3px;">
{if $vs['code'] eq $vs['secret']} 
<div class="col-10 text-center p-1">
<p style="margin: 1px 0; font-weight: 600; color: #666; font-size: 7px;">
{if $vs['timelimit'] eq 'unlimited'} {if $vs['datalimit'] eq 'unlimited'} {$vs['validperiod']} {else} {$vs['datalimit']} {/if} {else} {$vs['timelimit']} {/if}
</p>
<div style="background: #f8f9fa; border: 1px solid #ddd; border-radius: 2px; padding: 4px; margin-top: 2px;">
<span style="font-size:16px; color: #333; font-family: 'Courier New', monospace; font-weight: bold;">{$vs['code']}</span>
</div>
</div>
{else} 
<div class="col-5 text-center p-1">
<p style="margin: 1px 0; font-weight: 600; color: #666; font-size: 8px;">USER</p>
<div style="background: #f8f9fa; border: 1px solid #ddd; border-radius: 2px; padding: 3px; margin-top: 1px;">
<span style="font-size:9px; color: #333; font-family: 'Courier New', monospace; font-weight: bold;">{$vs['code']}</span>
</div>
</div>
<div class="col-5 text-center p-1">
<p style="margin: 1px 0; font-weight: 600; color: #666; font-size: 8px;">PASS</p>
<div style="background: #f8f9fa; border: 1px solid #ddd; border-radius: 2px; padding: 3px; margin-top: 1px;">
<span style="font-size:9px; color: #333; font-family: 'Courier New', monospace; font-weight: bold;">{$vs['secret']}</span>
</div>
</div>
{/if} 
</div>
<div class="row" style="margin: 2px 0; padding: 1px 3px;">
<div class="col-10 text-center">
<p style="margin: 0; font-size: 10px; color: #333; font-weight: bold;">
{$vs['total']}
</p>
</div>
</div>
<div class="row" style="margin: 0; padding: 0 3px 1px 3px; position: absolute; bottom: 0; left: 0; right: 0; width: 100%; box-sizing: border-box;">
<div class="col-10 text-center">
<p style="margin: 0; font-size: 7px; color: #666;">
http://{$hotspotdns}
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
        name: 'Mikhmon Simple',
        code: `{include file="rad-template-header.tpl"} <!-- DON'T REMOVE THIS LINE -->

<style>
.container {
width: 187px !important;
height: 127px !important;
display: inline-block !important;
margin: 4px 2px !important;
vertical-align: top !important;
border: 1px solid #ddd;
border-radius: 4px;
overflow: hidden;
position: relative !important;
float: none !important;
background: #ffffff;
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
<div class="container" style="background: #ffffff; border: 1px solid #ddd; position: relative;">
<div class="row">
<div class="col-10">
<div class="row" style="background: #f8f9fa; margin: 0; padding: 4px 8px; border-bottom: 1px solid #ddd;">
<div style="flex: 1; text-align: center;">
<p style="margin: 0; color: #333; font-size: 11px; font-weight: bold;">
{$vs['company_name']}
</p>
</div>
</div>
<div class="row" style="margin-top: 4px; margin-left: 4px; margin-right: 4px;">
{if $vs['code'] eq $vs['secret']} 
<div class="col-10 text-center p-1">
<p style="margin: 2px 0; font-weight: 600; color: #666; font-size: 9px;">
{if $vs['timelimit'] eq 'unlimited'} {if $vs['datalimit'] eq 'unlimited'} {$vs['validperiod']} {else} {$vs['datalimit']} {/if} {else} {$vs['timelimit']} {/if}
</p>
<div style="background: #f8f9fa; border: 1px solid #ddd; border-radius: 3px; padding: 6px; margin-top: 4px;">
<span style="font-size:20px; color: #333; font-family: 'Courier New', monospace; font-weight: bold;">{$vs['code']}</span>
</div>
</div>
{else} 
<div class="col-5 text-center p-1">
<p style="margin: 1px 0; font-weight: 600; color: #666; font-size: 9px;">USERNAME</p>
<div style="background: #f8f9fa; border: 1px solid #ddd; border-radius: 3px; padding: 4px; margin-top: 2px;">
<span style="font-size:11px; color: #333; font-family: 'Courier New', monospace; font-weight: bold;">{$vs['code']}</span>
</div>
</div>
<div class="col-5 text-center p-1">
<p style="margin: 1px 0; font-weight: 600; color: #666; font-size: 9px;">PASSWORD</p>
<div style="background: #f8f9fa; border: 1px solid #ddd; border-radius: 3px; padding: 4px; margin-top: 2px;">
<span style="font-size:11px; color: #333; font-family: 'Courier New', monospace; font-weight: bold;">{$vs['secret']}</span>
</div>
</div>
{/if} 
</div>
<div class="row" style="margin: 2px 0; padding: 2px 4px;">
<div class="col-10 text-center">
<p style="margin: 0; font-size: 12px; color: #333; font-weight: bold;">
{$vs['total']}
</p>
</div>
</div>
<div class="row" style="margin: 0; padding: 0 4px 2px 4px; position: absolute; bottom: 0; left: 0; right: 0; width: 100%; box-sizing: border-box;">
<div class="col-10 text-center">
<p style="margin: 0; font-size: 9px; color: #666;">
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
        name: 'Test',
        code: `{include file="rad-template-header.tpl"} <!-- DON'T REMOVE THIS LINE -->

<style>
.container {
width: 187px !important;
height: 127px !important;
display: inline-block !important;
margin: 4px 2px !important;
vertical-align: top !important;
border: 2px dashed #999;
border-radius: 4px;
overflow: hidden;
position: relative !important;
float: none !important;
background: #fff9e6;
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
<div class="container" style="background: #fff9e6; border: 2px dashed #999; position: relative;">
<div class="row">
<div class="col-10">
<div class="row" style="background: #ffeb3b; margin: 0; padding: 4px 8px; border-bottom: 2px dashed #999;">
<div style="flex: 1; text-align: center;">
<p style="margin: 0; color: #333; font-size: 10px; font-weight: bold;">
TEST - {$vs['company_name']}
</p>
</div>
</div>
<div class="row" style="margin-top: 4px; margin-left: 4px; margin-right: 4px;">
{if $vs['code'] eq $vs['secret']} 
<div class="col-10 text-center p-1">
<p style="margin: 2px 0; font-weight: 600; color: #666; font-size: 8px;">
{if $vs['timelimit'] eq 'unlimited'} {if $vs['datalimit'] eq 'unlimited'} {$vs['validperiod']} {else} {$vs['datalimit']} {/if} {else} {$vs['timelimit']} {/if}
</p>
<div style="background: #fff; border: 1px dashed #999; border-radius: 3px; padding: 5px; margin-top: 3px;">
<span style="font-size:18px; color: #333; font-family: 'Courier New', monospace; font-weight: bold;">{$vs['code']}</span>
</div>
</div>
{else} 
<div class="col-5 text-center p-1">
<p style="margin: 1px 0; font-weight: 600; color: #666; font-size: 8px;">USERNAME</p>
<div style="background: #fff; border: 1px dashed #999; border-radius: 3px; padding: 4px; margin-top: 2px;">
<span style="font-size:10px; color: #333; font-family: 'Courier New', monospace; font-weight: bold;">{$vs['code']}</span>
</div>
</div>
<div class="col-5 text-center p-1">
<p style="margin: 1px 0; font-weight: 600; color: #666; font-size: 8px;">PASSWORD</p>
<div style="background: #fff; border: 1px dashed #999; border-radius: 3px; padding: 4px; margin-top: 2px;">
<span style="font-size:10px; color: #333; font-family: 'Courier New', monospace; font-weight: bold;">{$vs['secret']}</span>
</div>
</div>
{/if} 
</div>
<div class="row" style="margin: 2px 0; padding: 2px 4px;">
<div class="col-10 text-center">
<p style="margin: 0; font-size: 11px; color: #333; font-weight: bold;">
{$vs['total']}
</p>
</div>
</div>
<div class="row" style="margin: 0; padding: 0 4px 2px 4px; position: absolute; bottom: 0; left: 0; right: 0; width: 100%; box-sizing: border-box;">
<div class="col-10 text-center">
<p style="margin: 0; font-size: 8px; color: #666;">
Login: http://{$hotspotdns}
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

// Fungsi untuk mencari template di database mikhmon-fix (jika ada)
function findMikhmonTemplates() {
    const templates = [];
    
    // Coba cari di database mikhmon-fix
    const possibleDbPaths = [
        '/home/mikhmon-fix/database/mikhmon.db',
        '/home/mikhmon-fix/mikhmon.db',
        '/home/mikhmon-fix/data/mikhmon.db'
    ];
    
    for (const dbPath of possibleDbPaths) {
        if (fs.existsSync(dbPath)) {
            try {
                const mikhmonDb = new sqlite3.Database(dbPath);
                mikhmonDb.all("SELECT * FROM voucher_template WHERE status = 'enabled'", (err, rows) => {
                    if (!err && rows) {
                        rows.forEach(row => {
                            templates.push({
                                name: row.template_name || row.name,
                                code: row.template_code || row.code
                            });
                        });
                    }
                });
                mikhmonDb.close();
            } catch (error) {
                console.warn(`Tidak bisa membaca database ${dbPath}:`, error.message);
            }
        }
    }
    
    return templates;
}

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
        
        console.log('📦 Importing templates from mikhmon-fix...\n');
        
        // Gabungkan template dari mikhmon dengan template yang sudah ada
        const allTemplates = [...mikhmonTemplates];
        
        // Cari template tambahan di database mikhmon-fix
        const foundTemplates = findMikhmonTemplates();
        foundTemplates.forEach(t => {
            if (!allTemplates.find(existing => existing.name === t.name)) {
                allTemplates.push(t);
            }
        });
        
        let created = 0;
        let updated = 0;
        let processed = 0;
        
        if (allTemplates.length === 0) {
            console.log('⚠️  Tidak ada template tambahan ditemukan di mikhmon-fix');
            console.log('✅ Template dari voucher-manager sudah diimport sebelumnya');
            db.close();
            process.exit(0);
        }
        
        allTemplates.forEach((template, index) => {
            // Cek apakah template sudah ada
            db.get(
                'SELECT id FROM voucher_print_templates WHERE template_name = ?',
                [template.name],
                (err, row) => {
                    if (err) {
                        console.error(`Error checking template ${template.name}:`, err);
                        processed++;
                        if (processed === allTemplates.length) {
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
                                if (processed === allTemplates.length) {
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
                        db.run(
                            'INSERT INTO voucher_print_templates (template_name, template_code, is_default, status) VALUES (?, ?, ?, ?)',
                            [template.name, template.code, 0, 'enabled'],
                            function(insertErr) {
                                if (insertErr) {
                                    console.error(`❌ Error inserting template ${template.name}:`, insertErr);
                                } else {
                                    created++;
                                    console.log(`✅ Template '${template.name}' berhasil dibuat`);
                                }
                                processed++;
                                if (processed === allTemplates.length) {
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
