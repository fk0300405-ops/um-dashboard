/* Report rendering shares the dashboard's data and view functions. No workbook is uploaded. */
const REPORT_MODE=!!window.__UM_EXPORT_PAYLOAD;
function reportAsset(name){return REPORT_MODE&&window.__UM_EXPORT_ASSETS?.[name]||'./'+name;}
async function downloadReport(){
 const btn=document.getElementById('exportButton'),label=document.getElementById('exportLabel'),notice=document.getElementById('exportNotice');
 if(!DATA){notice.hidden=false;notice.dataset.kind='error';notice.textContent='Load the dashboard data before exporting.';return;}
 if(btn.disabled)return;
 btn.disabled=true;btn.setAttribute('aria-busy','true');label.textContent='Exporting PDF';notice.hidden=false;notice.dataset.kind='working';notice.textContent='Downloading the full report saved at publication (default filters).';
 try{
  const response=await fetch('./UM_Performance_Report.pdf?rev='+encodeURIComponent(DATA.revision),{cache:'no-store'});
  if(!response.ok){let err;try{err=(await response.json()).error;}catch{}throw Error(err||'Unable to generate the report.');}
  const blob=await response.blob();if(blob.type!=='application/pdf')throw Error('The report was not returned as a PDF.');
  const url=URL.createObjectURL(blob),link=document.createElement('a'),match=(response.headers.get('Content-Disposition')||'').match(/filename="([^"]+)"/);
  link.href=url;link.download=match?.[1]||'UM_Performance_Report.pdf';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
  notice.dataset.kind='ready';notice.textContent='PDF downloaded.';
 }catch(error){notice.dataset.kind='error';notice.textContent=error.message;}
 finally{btn.disabled=false;btn.removeAttribute('aria-busy');label.textContent='Export PDF';}
}
// Vector equivalents of the two R&M charts for sharp, deterministic PDF output.
// Same dataset, budget colours, linear trend, actuals and data labels as the website.
function reportRMChart(id,labels,datasets,box){
 const isCost=id==='rmCostChart',W=1450,H=isCost?300:280,L=64,R=W-24,T=30,B=H-55,step=(R-L)/Math.max(1,labels.length),x=i=>L+(i+.5)*step;
 const finite=datasets.flatMap(d=>d.data).filter(Number.isFinite),max=Math.max(0,...finite),min=Math.min(0,...finite),span=(max-min)||1,upper=max+span*.15,lower=min,y=v=>B-(v-lower)/(upper-lower)*(B-T),actual=datasets[0].data,second=datasets[1].data;
 let svg=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(isCost?'Monthly R&M cost and budget comparisons':'R&M Rs/Kg vs budget')}">`;
 for(let i=0;i<=4;i++){const v=lower+(upper-lower)*i/4,yy=y(v);svg+=`<line x1="${L}" x2="${R}" y1="${yy}" y2="${yy}" stroke="#dfe8ee"/><text x="${L-8}" y="${yy+4}" text-anchor="end" font-size="12" fill="#52687a">${fmt(v,isCost?0:1)}</text>`;}
 const line=(values,color,dash='')=>{let d='',started=false;values.forEach((v,i)=>{if(!Number.isFinite(v)){started=false;return;}d+=(started?' L ':' M ')+x(i)+' '+y(v);started=true;});return `<path d="${d}" stroke="${color}" stroke-width="3" ${dash?'stroke-dasharray="'+dash+'"':''} fill="none" stroke-linejoin="round"/>`;};
 if(isCost){const bw=Math.min(55,step*.64),palette={'#e00000':['#780000','#ff0808','#a90000'],'#008f3b':['#005323','#06c75b','#007735'],'#084d91':['#06345e','#1267b4','#07427e'],'#438ed7':['#24598c','#519ce7','#286db6'],'#cbd5e1':['#8190a4','#d5dfeb','#9aa9bc']};
  Object.entries(palette).forEach(([c,p],i)=>{svg+=`<defs><linearGradient id="rmExport${i}"><stop offset="0" stop-color="${p[0]}"/><stop offset=".3" stop-color="${p[1]}"/><stop offset=".7" stop-color="${p[1]}"/><stop offset="1" stop-color="${p[2]}"/></linearGradient></defs>`;});
  const keys=Object.keys(palette),index=labels.findIndex(v=>v==='Avg Budget');if(index>0)svg+=`<line x1="${L+step*index}" x2="${L+step*index}" y1="${T}" y2="${B}" stroke="#c42a2a" stroke-dasharray="5 4"/>`;
  actual.forEach((v,i)=>{if(!Number.isFinite(v))return;const top=Math.min(y(0),y(v)),h=Math.max(1,Math.abs(y(0)-y(v))),c=datasets[0].backgroundColor[i],g=keys.indexOf(c),left=x(i)-bw/2;svg+=`<rect x="${left}" y="${top}" width="${bw}" height="${h}" fill="${g>=0?'url(#rmExport'+g+')':esc(c)}" stroke="${esc(datasets[0].borderColor[i])}"/><path d="M${left} ${top} h${bw} l-5 5 h${-bw+10} Z" fill="#ffffff" opacity=".28"/>`;});
  svg+=line(second,'#b8860b');actual.forEach((v,i)=>{if(Number.isFinite(v))svg+=`<text x="${x(i)}" y="${y(v)-7}" text-anchor="middle" font-size="12" font-weight="650" fill="#17354d" stroke="#fff" stroke-width="3" paint-order="stroke">${fmt(v,0)}</text>`;});
 }else{svg+=line(second,'#e05252','7 5')+line(actual,'#0ea5a4');actual.forEach((v,i)=>{if(Number.isFinite(v))svg+=`<circle cx="${x(i)}" cy="${y(v)}" r="3.6" fill="#0ea5a4"/><text x="${x(i)}" y="${y(v)-11}" text-anchor="middle" font-size="13" font-weight="650" fill="#12444d" stroke="white" stroke-width="3" paint-order="stroke">${fmt(v,2)}</text>`;});const indices=second.map((v,i)=>Number.isFinite(v)?i:-1).filter(i=>i>=0),flat=indices.length>0&&indices.every(i=>second[i]===second[indices[0]]);(flat?[indices[Math.floor(indices.length/2)]]:indices).forEach(i=>{svg+=`<text x="${x(i)}" y="${y(second[i])+17}" text-anchor="middle" font-size="12" font-weight="650" fill="#b91c1c" stroke="white" stroke-width="3" paint-order="stroke">${flat?'Budget ':''}${fmt(second[i],2)}</text>`;});}
 labels.forEach((v,i)=>{svg+=`<text x="${x(i)}" y="${B+22}" text-anchor="middle" font-size="12" fill="#334155">${esc(v)}</text>`;});
 if(!isCost)svg+=`<line x1="${W/2-180}" x2="${W/2-160}" y1="${H-6}" y2="${H-6}" stroke="#0ea5a4" stroke-width="3"/><text x="${W/2-152}" y="${H-2}" font-size="12" fill="#334155">Actual Rs/Kg</text><line x1="${W/2+15}" x2="${W/2+35}" y1="${H-6}" y2="${H-6}" stroke="#e05252" stroke-width="3" stroke-dasharray="5 3"/><text x="${W/2+43}" y="${H-2}" font-size="12" fill="#334155">Budget Rs/Kg</text>`;
 box.classList.add('export-vector');box.style.height='auto';box.innerHTML=svg+'</svg>';
}
// Arrange only the PDF incident section according to the populated records.
// The regular website keeps its existing responsive layout.
function arrangeReportIncidents(incidents,entries){
 const dt=incidents.querySelector('.incident-dt');
 const rcas=[...incidents.querySelectorAll('.rca-investigation')];
 const pareto=incidents.querySelector('.incident-pareto');
 const grid=incidents.querySelector('.adaptive-incidents');
 // Export exactly the same count-driven layout as the website. Pareto is outside the grid.
 const layout=document.createElement('div');layout.className='export-incident-layout export-adaptive-layout';
 if(rcas.length>=2)layout.classList.add('export-incident-multiple');
 if(grid)layout.append(grid);if(pareto)layout.append(pareto);
 incidents.appendChild(layout);
 return {incidents,entries,dt,rcas,pareto,layout};
}
function sizeReportPareto(record){
 if(!record.pareto)return;
 const region=record.pareto.querySelector('.pareto-scroll');
 if(!region)return;
 const w=Math.floor(region.getBoundingClientRect().width);
 if(w>0)region.innerHTML=paretoSvg(record.entries,{width:w,compact:record.rcas.length>=2||record.layout.classList.contains('export-long-flow')});
}
// Exceptionally long content flows in reading order, without clipping or moving Pareto above an RCA.
function flowLongIncidents(record){
 const {layout,dt,pareto,rcas}=record;
 layout.className='export-incident-layout export-incident-stack export-long-flow';
 layout.replaceChildren(...[dt,...rcas,pareto].filter(Boolean));
 sizeReportPareto(record);
 [dt,...rcas].filter(Boolean).forEach(c=>{if(c.getBoundingClientRect().height>850)c.classList.add('export-can-split');});
}

// Split an exceptional register only at actual row boundaries, repeating its
// column headers and retaining the grand total on the final fragment. Reserve
// space for the Pareto after the final DT fragment (no RCA), or after the last RCA.
function paginateLongIncidents(record,makePage,pageLimit){
 const {layout,dt,pareto,rcas}=record;
 if(record.page.getBoundingClientRect().height<=pageLimit)return;
 const measuredRows=dt?[...dt.querySelectorAll('tbody tr')].map(tr=>({tr,height:tr.getBoundingClientRect().height})):[];
 const overhead=dt?Math.max(0,dt.getBoundingClientRect().height-measuredRows.reduce((a,r)=>a+r.height,0)):0;
 const chartHeight=pareto&&!rcas.length?pareto.getBoundingClientRect().height+12:0;
 const heading=record.incidents.querySelector('.detail-heading');
 const originalTitle=record.page.querySelector('.export-page-title h1').textContent;
 const sub=record.page.querySelector('.export-page-title p').textContent;
 let tail=record.page,activeLayout=layout;
 // Move the existing nodes out before measuring the empty report page.
 layout.replaceChildren();
 const capacity=Math.max(100,pageLimit-tail.getBoundingClientRect().height-20);
 function continuation(){
  const section=document.createElement('section');section.className='machine-incidents';
  if(heading)section.append(heading.cloneNode(true));
  const flow=document.createElement('div');flow.className='export-incident-layout export-incident-stack export-long-flow';section.append(flow);
  const next=makePage('classes',originalTitle+' (continued)',sub,[section]);next.classList.add('export-incident-page','is-long');next.dataset.machine=record.page.dataset.machine;tail.after(next);tail=next;activeLayout=flow;
 }
 function append(block){
  if(!block)return;
  const occupied=activeLayout.childElementCount>0;activeLayout.append(block);
  if(occupied&&tail.getBoundingClientRect().height>pageLimit){block.remove();continuation();activeLayout.append(block);}
  if(tail.getBoundingClientRect().height>pageLimit){block.classList.add('export-can-split');block.querySelectorAll('.incident-card').forEach(c=>c.classList.add('export-can-split'));}
 }
 if(dt){
  const fullHeight=overhead+measuredRows.reduce((a,r)=>a+r.height,0);
  const chunks=[];
  if(fullHeight+chartHeight<=capacity||!measuredRows.length)chunks.push(measuredRows);
  else{
   // Pack a trailing group of rows and the total with the Pareto, so the chart
   // is not stranded on its own page just because a new month has many rows.
   let lastStart=measuredRows.length,tailHeight=overhead+chartHeight;
   while(lastStart>0&&tailHeight+measuredRows[lastStart-1].height<=capacity){tailHeight+=measuredRows[--lastStart].height;}
   // If the chart plus even one row cannot fit, use natural consecutive pages.
      let batch=[],height=overhead;
   for(const r of measuredRows.slice(0,lastStart)){
    if(batch.length&&height+r.height>capacity){chunks.push(batch);batch=[];height=overhead;}
    batch.push(r);height+=r.height;
   }
   if(batch.length)chunks.push(batch);
   // If an additional table page is necessary, do not leave a one-row page.
   // Rebalance the final two preceding fragments without changing row order.
   if(chunks.length>=2){
    const a=chunks[chunks.length-2],b=chunks[chunks.length-1],sum=rows=>rows.reduce((n,r)=>n+r.height,0);
    if(sum(b)<sum(a)*.35){
     while(a.length>1&&sum(a)>sum(b)+a[a.length-1].height&&overhead+sum(b)+a[a.length-1].height<=capacity)b.unshift(a.pop());
    }
   }
   if(lastStart<measuredRows.length)chunks.push(measuredRows.slice(lastStart));
  }
  chunks.forEach((rows,i)=>{
   const part=dt.cloneNode(true),body=part.querySelector('tbody');body.replaceChildren(...rows.map(r=>r.tr.cloneNode(true)));
   if(i<chunks.length-1)part.querySelector('tfoot')?.remove();
   if(i>0){const title=part.querySelector('.incident-header h5');if(title)title.textContent+=' (continued)';}
   if(i===chunks.length-1&&pareto&&!rcas.length&&overhead+rows.reduce((a,r)=>a+r.height,0)+chartHeight<=capacity){const group=document.createElement('div');group.className='export-dt-flow';group.append(part,pareto);append(group);}
   else append(part);
  });
 }
 // Keep the last RCA and its Pareto together whenever their combined height fits.
 rcas.forEach((rca,i)=>{
  if(i===rcas.length-1&&pareto&&!pareto.isConnected){
   const group=document.createElement('div');group.className='export-dt-flow';group.append(rca,pareto);append(group);
   if(tail.getBoundingClientRect().height>pageLimit){group.remove();append(rca);append(pareto);}
  }else append(rca);
 });
 if(pareto&&!pareto.isConnected)append(pareto);
}
async function buildExportReport(){
 try{
  document.documentElement.classList.add('report-mode');
  window.__UM_EXPORT_STATE={loading:true};
  const payload=window.__UM_EXPORT_PAYLOAD;
  if(!payload?.data)throw Error(payload.error||'Report snapshot unavailable.');
  DATA=payload.data;const filters=payload.filters||{};
  // Render all sections at the PDF's full landscape width before moving content.
  document.querySelectorAll('.section').forEach(e=>e.classList.add('report-visible'));
  init();$('machineFilter').value='all';if([...$('relMonth').options].some(x=>x.value===filters.rel))$('relMonth').value=filters.rel;
  renderReliability();renderPM();if([...$('pmPeriod').options].some(x=>x.value===filters.pm)){$('pmPeriod').value=filters.pm;renderPM();}
  renderRM();renderWaste();renderRAV();$('fiView').value=filters.fi==='all'?'all':'visible';renderFI();
  const relLabel=periodMonth('relMonth')||'Not reported',pmLabel=$('pmPeriod').value==='current'?(DATA.currentMonth?.label||'Current month'):$('pmPeriod').value;
  const output=document.createElement('div');output.id='exportReport';const incidentRecords=[];
  function page(section,title,sub,nodes){const p=document.createElement('section');p.className='export-page';p.dataset.reportSection=section;const h=document.createElement('header');h.className='export-page-title';h.innerHTML=`<img src="${reportAsset('tripack-logo.png')}" alt="Tri-Pack Films Limited"><div><span class="export-company">TRI-PACK FILMS LIMITED | UTILITIES &amp; MAINTENANCE</span><h1>${esc(title)}</h1><p>${esc(sub||'')}</p></div>`;p.append(h,...nodes);output.appendChild(p);return p;}
  page('overview','Executive Overview','KPI scorecard | '+$('kpiScorePeriod').textContent,[$('overview').querySelector('.panel')]);
  const relPanels=[...$('reliability').querySelectorAll('.reliability-chart-grid > .panel')];
  page('reliability','Machine Downtime Performance','Reporting month: '+relLabel,[$('relCards'),...relPanels.slice(0,2)]);
  page('reliability','Machine Downtime Performance','Reporting month: '+relLabel+' | MTBF',relPanels.slice(2));
  page('pm','PM Compliance','Reporting month: '+pmLabel,[$('pmCards'),$('pm').querySelector('.pm-detail-panel')]);
  page('pm','PM Compliance','YTD 2026 | Machine-wise completed and pending jobs',[$('pm').querySelector('.pm-ring-panel')]);
  page('rm','Mechanical R&M','Monthly costs, budget comparison and cost per kg',[...$('rm').children]);
  const wasteGraphs=[...$('wasteGraphs').children];
  for(let i=0;i<wasteGraphs.length;i+=3){page('waste','Wastage','Monthly and YTD performance'+(i?' | Continued':''),[...(i===0?[$('wasteCards')]:[]),...wasteGraphs.slice(i,i+3)]);}
  if(!wasteGraphs.length)page('waste','Wastage','Monthly and YTD performance',[...$('waste').children]);
  page('rav','RAV','Machine-wise monthly and YTD performance',[$('rav').querySelector('.rav-panel')]);
  for(const group of DATA.classMachines||[]){
   $('classSelect').value=group.class;renderClasses();const machines=[...$('classMachineCards').children];
   for(const machine of machines){
    const name=machine.querySelector('.machine-owner h3').textContent,sub='Class '+group.class+' | '+name+' | '+(DATA.currentMonth?.label||'Current month');
    const incidents=machine.querySelector('.machine-incidents');if(incidents)incidents.remove();
    const p=page('classes','Class '+group.class+' Machines',sub,[machine]);p.classList.add('export-machine-page');p.dataset.machine=name;
    if(incidents){
     const source=group.machines.find(m=>m.machine===name),entries=source?.currentDT||[];
     const record=arrangeReportIncidents(incidents,entries);
     const title=record.rcas.length?(record.dt?'Current Month Downtime & RCA':'Current Month Root Cause Analysis'):'Current Month Downtime Detail';
     const p2=page('classes',title,sub,[incidents]);p2.classList.add('export-incident-page');p2.dataset.machine=name;
     incidentRecords.push({...record,page:p2,performancePage:p});
    }
   }
  }
  page('fi','Financial Impact','Rs. million | Monthly and YTD impact',[$('fi').querySelector('.fi-panel')]);
  const footer=document.createElement('div');footer.className='export-brand-footer';footer.innerHTML=`<img src="${reportAsset('group-brand-strip.png')}" alt="Packages Group branding">`;output.lastElementChild.appendChild(footer);
  document.body.replaceChildren(output);
  // Measure the actual content at the report viewport after all nodes are attached.
  // First try to keep the entire populated incident block with its machine if it fits.
  // Otherwise retain a dedicated, balanced incident page. Only unusually long
  // records flow across physical pages; they are never truncated or split by count.
  const pageLimit=1015;
  for(const record of incidentRecords){
   sizeReportPareto(record);
   if(record.page.getBoundingClientRect().height>pageLimit){record.page.classList.add('is-long');flowLongIncidents(record);paginateLongIncidents(record,page,pageLimit);}
   if(!record.page.classList.contains('is-long')){
    const previous=record.performancePage;
    record.incidents.classList.add('export-inline-incidents');previous.append(record.incidents);
    if(previous.getBoundingClientRect().height<=pageLimit){record.page.remove();previous.classList.add('export-includes-incidents');}
    else{record.incidents.classList.remove('export-inline-incidents');record.page.append(record.incidents);}
   }
  }
  // No interactive controls or animations in the PDF. Wait for actual assets/fonts.
  await document.fonts.ready;await Promise.all([...document.images].map(img=>img.decode().catch(()=>{throw Error('An image required for the report could not be loaded.');})));
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  if(!output.querySelector('.kpi-unified')||!output.querySelector('.fi-unified'))throw Error('Required report tables are unavailable.');
  window.__UM_EXPORT_STATE={ready:true,pages:output.children.length,machines:output.querySelectorAll('.export-machine-page').length};
 }catch(e){console.error('Report generation failed',e);window.__UM_EXPORT_STATE={error:e.message||'Report rendering failed.'};}
}
