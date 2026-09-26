/* Menu mobile et recherche globale : chargé sur toutes les pages */
(function(){
"use strict";
var $=function(s){return document.querySelector(s)};
function norm(s){return String(s).normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase()}
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
var bar=$(".topbar"),mb=$("#menu-btn");
if(mb)mb.addEventListener("click",function(){var o=bar.classList.toggle("open");mb.setAttribute("aria-expanded",o?"true":"false")});
var ov=$("#srch"),inp=$("#srch-in"),res=$("#srch-res"),idx=null;
function load(){if(idx)return Promise.resolve(idx);return fetch("/assets/search.json").then(function(r){return r.json()}).then(function(d){idx=d;return d})}
function run(){var q=norm(inp.value.trim());if(q.length<2){res.innerHTML='<p class="srch-hint">Tape au moins deux lettres : « romarin », « Salem », « pleine lune »…</p>';return}
  load().then(function(d){var ws=q.split(/\s+/),hits=d.filter(function(e){return ws.every(function(w){return e.x.indexOf(w)>-1})});
    hits.sort(function(a,b){return(norm(b.t).indexOf(ws[0])===0)-(norm(a.t).indexOf(ws[0])===0)||(norm(a.t).indexOf(ws[0])>-1?-1:0)-(norm(b.t).indexOf(ws[0])>-1?-1:0)});
    res.innerHTML=hits.length?hits.slice(0,24).map(function(e){return'<a href="'+e.u+'"><span class="label">'+esc(e.k)+'</span><b>'+esc(e.t)+'</b><em>'+esc(e.d)+'</em></a>'}).join(""):'<p class="srch-hint">Aucun résultat. Essaie un autre mot.</p>'})}
function open(){ov.hidden=false;document.body.style.overflow="hidden";inp.focus();load();run()}
function close(){ov.hidden=true;document.body.style.overflow=""}
var sb=$("#srch-btn");if(sb)sb.addEventListener("click",open);
var sc=$("#srch-close");if(sc)sc.addEventListener("click",close);
if(ov){ov.addEventListener("click",function(e){if(e.target===ov)close()});inp.addEventListener("input",run)}
document.addEventListener("keydown",function(e){if(e.key==="Escape"&&ov&&!ov.hidden)close();if((e.key==="/"||(e.key==="k"&&(e.ctrlKey||e.metaKey)))&&ov&&ov.hidden&&!/INPUT|TEXTAREA|SELECT/.test((e.target||{}).tagName||"")){e.preventDefault();open()}});
/* impression */
document.addEventListener("click",function(e){if(e.target.closest("[data-print]")){e.preventDefault();window.print()}});
/* lettres : n'afficher qu'à partir de la date d'envoi */
var today=new Date(),td=today.getFullYear()+"-"+("0"+(today.getMonth()+1)).slice(-2)+"-"+("0"+today.getDate()).slice(-2),shown=0;
document.querySelectorAll(".lettre[data-date]").forEach(function(el){var on=el.getAttribute("data-date")<=td;el.hidden=!on;if(on)shown++});
var lv=$("#lettre-vide");if(lv&&document.querySelector(".lettre[data-date]"))lv.hidden=shown>0;
})();
