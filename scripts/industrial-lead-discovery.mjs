#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const OUT="output", STATE="data/leads-state.json", SUMMARY=path.join(OUT,"run-summary.json"), CSV=path.join(OUT,"new-leads.csv");
const START=new Date().toISOString(), COUNTRY="Iran";
const CITIES=["Tehran","Isfahan","Tabriz","Mashhad","Shiraz","Ahvaz","Arak","Qazvin","Karaj","Kermanshah"];
const PRODUCTS=[
 {label:"Carbon Black",key:"carbon-black",terms:["carbon black","N220","N330","N550","N660"],industries:["tire manufacturer","rubber products manufacturer","rubber hose manufacturer","rubber belt manufacturer","rubber compound manufacturer"]},
 {label:"Process Oils",key:"process-oils",terms:["rubber process oil","TDAE","MES","naphthenic process oil"],industries:["tire manufacturer","rubber products manufacturer","rubber compound manufacturer","rubber hose manufacturer"]},
 {label:"Rubber Additives",key:"rubber-additives",terms:["rubber antioxidant","rubber accelerator","CBS","TBBS","TMQ","6PPD"],industries:["tire manufacturer","rubber compound manufacturer","rubber parts manufacturer","rubber seal manufacturer"]},
 {label:"Silica & Fillers",key:"silica-fillers",terms:["precipitated silica","silica filler","calcium carbonate","kaolin filler"],industries:["tire manufacturer","rubber compound manufacturer","masterbatch manufacturer","plastic compound manufacturer"]},
 {label:"Polymer Raw Materials",key:"polymer-raw-materials",terms:["polyethylene","polypropylene","HDPE","LDPE","LLDPE","PP resin"],industries:["plastic products manufacturer","polyethylene film manufacturer","polypropylene products manufacturer","masterbatch manufacturer","plastic pipe manufacturer"]}
];
const INSTANCES=(process.env.SEARXNG_INSTANCES||"https://searx.be,https://search.sapti.me,https://searxng.site,https://searx.work,https://search.ononoki.org,https://searx.tuxcloud.net").split(",").map(x=>x.trim()).filter(Boolean);
const INDUSTRY=/\b(tire|tyre|rubber|hose|belt|seal|gasket|compound|masterbatch|polymer|plastic|polyethylene|polypropylene|pvc|automotive parts|extrusion|injection molding|injection moulding|پلاستیک|لاستیک|تایر|قطعات لاستیکی|مستربچ|پلیمر|شیلنگ|تسمه)\b/i;
const MAKER=/\b(manufacturer|manufacturing|factory|plant|producer|production)\b/i;
const SELLER=/\b(distributor|trader|trading|supplier|wholesaler|exporter|importer|marketplace|directory)\b/i;
const EMAIL=/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig, PHONE=/(?:\+?\d[\d\s()./-]{7,}\d)/g;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const clean=s=>String(s||"").replace(/<[^>]*>/g," ").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/\s+/g," ").trim();
const domain=url=>{try{return new URL(url).hostname.toLowerCase().replace(/^www\./,"")}catch{return ""}};
const key=r=>(r.domain||domain(r.website)||r.company||"").toLowerCase();
const csv=v=>'"'+String(v??"").replace(/"/g,'""').replace(/[\r\n]/g," ")+'"';
async function search(q){
 for(const host of INSTANCES){try{
  const u=host+"/search?q="+encodeURIComponent(q)+"&format=json&pageno=1";
  const res=await fetch(u,{headers:{"Accept":"application/json","User-Agent":"KeeLead/1.0 industrial buyer research"},signal:AbortSignal.timeout(12000)});
  if(!res.ok)continue; const data=await res.json(); if(Array.isArray(data.results))return {results:data.results,ok:true};
 }catch{}}
 return {results:[],ok:false};
}
async function inspect(url){
 const out={emails:[],phones:[],title:""};
 try{
  const u=new URL(url); if(!["http:","https:"].includes(u.protocol))return out;
  const res=await fetch(u.href,{headers:{"User-Agent":"KeeLead/1.0 public company contact discovery","Accept":"text/html"},redirect:"follow",signal:AbortSignal.timeout(9000)});
  if(!res.ok)return out; const html=(await res.text()).slice(0,800000);
  const t=html.match(/<title[^>]*>([\s\S]*?)<\/title>/i); out.title=t?clean(t[1]).slice(0,160):"";
  out.emails=[...new Set((html.match(EMAIL)||[]).map(x=>x.toLowerCase()).filter(x=>!/(example\.|test@|noreply|no-reply)/i.test(x)))].slice(0,8);
  out.phones=[...new Set((html.match(PHONE)||[]).map(x=>x.replace(/\s+/g," ").trim()).filter(x=>x.replace(/\D/g,"").length>=8&&x.replace(/\D/g,"").length<=16))].slice(0,8);
 }catch{}
 return out;
}
async function main(){
 fs.mkdirSync(OUT,{recursive:true});fs.mkdirSync("data",{recursive:true});
 let prior=[];try{prior=JSON.parse(fs.readFileSync(STATE,"utf8"));if(!Array.isArray(prior))prior=[]}catch{}
 const oldKeys=new Set(prior.map(key)), found=new Map();let searchesRun=0,searchErrors=0;
 const tasks=[];for(const p of PRODUCTS)for(const city of CITIES){const industry=p.industries.map(x=>String.fromCharCode(34)+x+String.fromCharCode(34)).join(" OR ");const terms=p.terms.map(x=>String.fromCharCode(34)+x+String.fromCharCode(34)).join(" OR ");tasks.push({p,industry,city,q:"("+terms+") ("+industry+") "+city+" Iran"});}
 for(const task of tasks){
  searchesRun++;const response=await search(task.q);if(!response.ok)searchErrors++;
  for(const item of response.results){
   if(!item?.title||!item?.url)continue;let u;try{u=new URL(item.url)}catch{continue}
   if(!["http:","https:"].includes(u.protocol))continue;
   const d=domain(item.url);if(!d||/(facebook|instagram|linkedin|youtube|tiktok|wikipedia|google|bing|duckduckgo|searx)\./i.test(d))continue;
   const title=clean(item.title),snippet=clean(item.content||""),evidence=title+" "+snippet;
   if(!INDUSTRY.test(evidence))continue;
   if(SELLER.test(title)&&!MAKER.test(evidence))continue;
   const company=title.split(/\s+[|–—]\s+|\s+-\s+/)[0].trim()||d.split(".")[0];
   if(company.length<3||/^(home|official website|contact|about us)$/i.test(company))continue;
   const row={company,domain:d,product:task.p.label,productKey:task.p.key,country:COUNTRY,city:task.city,
    industry_evidence:(evidence.match(INDUSTRY)||[])[0]||task.industry,website:"https://"+d,evidence_url:item.url,
    evidence_title:title,evidence_snippet:snippet.slice(0,450),emails:[],phones:[],source:"SearXNG",first_seen:START,
    confidence:MAKER.test(evidence)?"medium":"low",
    notes:"Potential industrial end-user only; verify actual material consumption and purchasing authority."};
   const prev=found.get(d);if(!prev)found.set(d,row);else{
    if(!prev.product.includes(row.product))prev.product+="; "+row.product;
    if(row.confidence==="medium")prev.confidence="medium";
    if(!prev.evidence_snippet&&row.evidence_snippet)prev.evidence_snippet=row.evidence_snippet;
   }
  }
  await sleep(250);
 }
 const discovered=[...found.values()];let inspected=0;
 for(const row of discovered.slice(0,Number(process.env.MAX_SITE_INSPECTIONS||35))){
  const c=await inspect(row.website);row.emails=c.emails;row.phones=c.phones;
  if(c.title)row.notes+=" Website title: "+c.title;inspected++;await sleep(300);
 }
 const fresh=discovered.filter(r=>!oldKeys.has(key(r))),merged=new Map(prior.map(r=>[key(r),r]));
 for(const r of discovered){const k=key(r),p=merged.get(k);if(!p)merged.set(k,r);else{
  p.product=[...new Set((p.product+"; "+r.product).split(";").map(x=>x.trim()).filter(Boolean))].join("; ");
  p.emails=[...new Set([...(p.emails||[]),...r.emails])];p.phones=[...new Set([...(p.phones||[]),...r.phones])];
  p.evidence_url=r.evidence_url;p.evidence_title=r.evidence_title;p.evidence_snippet=r.evidence_snippet;
 }}
 const all=[...merged.values()];fs.writeFileSync(STATE,JSON.stringify(all,null,2));
 const cols=["company","product","country","city","industry_evidence","website","evidence_url","evidence_title","evidence_snippet","emails","phones","source","first_seen","confidence","notes"];
 fs.writeFileSync(CSV,[cols.join(","),...fresh.map(r=>cols.map(c=>csv(Array.isArray(r[c])?r[c].join("; "):r[c])).join(","))].join("\n")+"\n");
 const summary={status:"success",startedAt:START,finishedAt:new Date().toISOString(),country:COUNTRY,products:PRODUCTS.map(p=>p.label),
  searchesRun,searchErrors,inspectedSites:inspected,discoveredThisRun:discovered.length,newLeads:fresh.length,duplicates:discovered.length-fresh.length,
  cumulativeLeads:all.length,mediumConfidence:discovered.filter(r=>r.confidence==="medium").length,lowConfidence:discovered.filter(r=>r.confidence==="low").length,
  withEmail:discovered.filter(r=>r.emails.length).length,withPhone:discovered.filter(r=>r.phones.length).length,
  withWebsite:discovered.filter(r=>r.website).length,withEvidence:discovered.filter(r=>r.evidence_url).length};
 fs.writeFileSync(SUMMARY,JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));
 if(searchesRun&&searchErrors===searchesRun)process.exitCode=2;
}
main().catch(e=>{fs.mkdirSync(OUT,{recursive:true});const s={status:"failed",startedAt:START,finishedAt:new Date().toISOString(),error:String(e?.stack||e)};fs.writeFileSync(SUMMARY,JSON.stringify(s,null,2));console.error(s.error);process.exitCode=1});
