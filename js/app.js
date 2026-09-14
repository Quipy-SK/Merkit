// ── BRANCH FILTER ──
const branchC2 = {zhaman:'#C88030',saki:'#4A8890',buryt:'#6A9848',toktagan:'#A84840'};
let activeBranch = 'all';
function applyBranchFilter(branch){
  activeBranch = branch;
  document.querySelectorAll('.bf-btn,.mbb').forEach(b => {
    const on = b.dataset.branch === branch;
    b.classList.toggle('active', on);
    if(b.classList.contains('bf-btn')){
      b.style.background = (on && branch==='all') ? 'rgba(200,152,40,.1)' : '';
      b.style.borderColor = (on && branch==='all') ? '#4A4030' : '';
    }
  });
  if(branch==='all'){
    g.selectAll('.node').classed('search-dim',false);
    g.selectAll('.link').style('opacity',.65);
  } else {
    g.selectAll('.node').classed('search-dim', d=>getBranch(d)!==branch);
    g.selectAll('.link').style('opacity', d=>getBranch(d.target)===branch?.8:.08);
  }
}
document.querySelectorAll('.bf-btn,.mbb').forEach(b =>
  b.addEventListener('click', ()=>applyBranchFilter(b.dataset.branch))
);

// ── ZOOM BUTTONS ──
function doZoom(f){ svg.transition().duration(280).call(zoom.scaleBy, f); }

// Fit transform accounts for each card's actual rendered width (not just its anchor point),
// so labels never get clipped off the edge like the old point-only bbox did.
function computeFitTransform(){
  const nl = root.descendants();
  const xs = nl.map(d=>d.y);
  const xsEnd = nl.map(d=>d.y + (d._cardW||90));
  const ys = nl.map(d=>d.x);
  const x0=Math.min(...xs), x1=Math.max(...xsEnd);
  const y0=Math.min(...ys), y1=Math.max(...ys);
  const pad=60, cW=window.innerWidth, cH=window.innerHeight-60;
  // A wide multi-generation tree on a narrow phone would be forced to an illegible scale
  // if width had to fit too. Floor the scale and let excess width pan off-screen instead.
  const rawScale = Math.min((cW-pad*2)/(x1-x0||1),(cH-pad*2)/(y1-y0||1));
  const floor = window.innerWidth<=700 ? 0.55 : 0.3;
  const s = Math.min(Math.max(rawScale, floor), 1.1);
  return d3.zoomIdentity.translate(pad-x0*s, cH/2-(y0+y1)/2*s).scale(s);
}
function fitAll(){ svg.transition().duration(500).call(zoom.transform, computeFitTransform()); }
// "Home" returns to the original default view, independent of whatever the user has since expanded/collapsed.
let homeTransform = null;
function goHome(){ svg.transition().duration(400).call(zoom.transform, homeTransform || computeFitTransform()); }
document.getElementById('zc-in').addEventListener('click',  ()=>doZoom(1.35));
document.getElementById('zc-out').addEventListener('click', ()=>doZoom(1/1.35));
document.getElementById('zc-fit').addEventListener('click',  fitAll);
document.getElementById('zc-home').addEventListener('click', goHome);
document.getElementById('mzc-fit').addEventListener('click',  fitAll);
document.getElementById('mzc-home').addEventListener('click', goHome);

// ── KEYBOARD ──
document.addEventListener('keydown', e=>{
  if(e.key==='+'||e.key==='=') doZoom(1.35);
  if(e.key==='-') doZoom(1/1.35);
  if(e.key==='f'||e.key==='F') fitAll();
  if(e.key==='Escape') { g.selectAll('.node').classed('hl',false); closePanel(); }
});

// ════════════════════════════════════════════════════════
//  D3 TREE SETUP
// ════════════════════════════════════════════════════════
const svg = d3.select('#tree-svg');
const W = window.innerWidth;
const H = window.innerHeight - 60;
svg.attr('viewBox',`0 0 ${W} ${H}`).attr('width',W).attr('height',H);

const g = svg.append('g');
const zoom = d3.zoom().scaleExtent([0.05,4]).on('zoom',e=>g.attr('transform',e.transform));
svg.call(zoom);

// Clicking empty canvas closes the panel and clears highlight
svg.on('click', ()=>{ closePanel(); g.selectAll('.node').classed('hl',false); });

// A node with 2+ wives needs extra room below it for the stacked spouse pills,
// or the next sibling's card collides with them.
function wifeSepFactor(d){
  const n = (d.data.spouses||[]).length;
  return n>1 ? 1 + (n-1)*0.9 : 1;
}
const tree = d3.tree().nodeSize([50,230]).separation((a,b)=>{
  const base = a.parent===b.parent?1.2:2.8;
  return base * Math.max(wifeSepFactor(a), wifeSepFactor(b));
});
const CARD_H = 30;

const root = d3.hierarchy(DATA);
root.x0 = H/2; root.y0 = 0;

// Collapse beyond depth 5
root.descendants().forEach(d=>{
  if(d.depth>=5 && d.children){ d._children=d.children; d.children=null; }
});

let uid=0;
function getUID(d){ if(!d._uid) d._uid='n'+(uid++); return d._uid; }

const branchC    = {zhaman:'#C88030',saki:'#4A8890',buryt:'#6A9848',toktagan:'#A84840',main:'#706858'};
const branchNames = {zhaman:'Жаман тармағы',saki:'Сәкі тармағы',buryt:'Бүріт тармағы',toktagan:'Тоқтаған тармағы'};
const branchBg   = {zhaman:'rgba(200,128,48,.18)',saki:'rgba(74,136,144,.18)',buryt:'rgba(106,152,72,.18)',toktagan:'rgba(168,72,64,.18)'};
const branchBd   = {zhaman:'#C88030',saki:'#4A8890',buryt:'#6A9848',toktagan:'#A84840'};
// Males: branch color fill. Females: fixed clay/terracotta — shape (diamond) + color distinguishes gender
const branchFillM = {zhaman:'rgba(200,128,48,.35)',saki:'rgba(74,136,144,.35)',buryt:'rgba(106,152,72,.35)',toktagan:'rgba(168,72,64,.35)',main:'rgba(112,104,88,.28)'};

function getBranch(d){
  let n=d;
  while(n){ if(n.data.branch) return n.data.branch; n=n.parent; }
  return 'main';
}

// ════════ SPOUSE OVERLAY LAYER ════════
// Each wife renders as her own small pill, stacked below the husband's card and
// tied to it with a short connector line. All children still link from the
// husband's card alone (the source data doesn't record which wife each child
// is from), so a second/third wife never splits the descent line.
const swLayer = g.append('g').attr('class','spouse-layer');

const WIFE_H = 18, WIFE_GAP = 5, WIFE_START = CARD_H/2 + 10;
function wifeCenterY(idx){ return WIFE_START + idx*(WIFE_H+WIFE_GAP) + WIFE_H/2; }
function wifeWidth(s){ return Math.max(58, Math.round(s.name.length*6.4 + 22)); }

function spouseItems(nodes){
  const items = [];
  nodes.forEach(d=>{
    (d.data.spouses||[]).forEach((s,i)=>{
      items.push({ node:d, spouse:s, idx:i, key:d.data.id+'_w'+i });
    });
  });
  return items;
}

function updateSpouses(nodes){
  const items = spouseItems(nodes);

  // Tie line from the husband's card to each wife pill
  const tie = swLayer.selectAll('.spouse-tie').data(items, d=>d.key);
  tie.enter().append('line').attr('class','spouse-tie').attr('opacity',0)
  .merge(tie)
    .transition().duration(360)
    .attr('x1', d=>d.node.y+10).attr('y1', d=>d.node.x+CARD_H/2-2)
    .attr('x2', d=>d.node.y+16).attr('y2', d=>d.node.x+wifeCenterY(d.idx))
    .attr('opacity',.6);
  tie.exit().transition().duration(200).attr('opacity',0).remove();

  const sw = swLayer.selectAll('.spouse-wrap').data(items, d=>d.key);

  const swE = sw.enter().append('g').attr('class','spouse-wrap')
    .style('opacity',0)
    .style('cursor','pointer')
    .on('click',(ev,d)=>{ ev.stopPropagation(); showSpousePanel(d.node, d.spouse); });

  swE.append('rect').attr('class','spouse-pill').attr('x',0).attr('y',0).attr('height',WIFE_H).attr('rx',WIFE_H/2);
  swE.append('text').attr('class','spouse-label').attr('x',10).attr('y',WIFE_H/2).attr('dy','0.32em').attr('text-anchor','start');

  const swAll = swE.merge(sw);

  swAll.select('.spouse-pill').transition().duration(360).attr('width', d=>wifeWidth(d.spouse));
  swAll.select('.spouse-label').text(d=>d.spouse.name);

  swAll.transition().duration(360)
    .attr('transform', d=>`translate(${d.node.y+16},${d.node.x+wifeCenterY(d.idx)-WIFE_H/2})`)
    .style('opacity',1);

  sw.exit().transition().duration(250).style('opacity',0).remove();
  swLayer.raise();
}

// ════════ MAIN UPDATE ════════
const linkGen = d3.linkHorizontal().x(p=>p.y).y(p=>p.x);

function update(src){
  tree(root);
  const nodes = root.descendants();
  const links = root.links();

  // Every node's label + pill width must be known before links are drawn,
  // since links now connect card-edge to card-edge rather than point to point.
  nodes.forEach(d=>{
    d._label = d.data.name;
    const charW = d.depth<=4 ? 7.8 : 7.2;
    d._cardW = Math.max(76, Math.round(d._label.length*charW + 32));
  });

  // Links: parent's right card-edge to child's left card-edge
  const link = g.selectAll('.link').data(links,d=>getUID(d.target));
  link.enter().insert('path','.node')
    .attr('class',d=>'link link-'+(getBranch(d.target)||'main'))
  .merge(link)
    .attr('class',d=>'link link-'+(getBranch(d.target)||'main'))
    .attr('d',d=>linkGen({
      source:{x:d.source.x, y:d.source.y + d.source._cardW},
      target:{x:d.target.x, y:d.target.y}
    }));

  link.exit().remove();

  // Nodes — pill-shaped cards, label drawn inside so the whole card is one clickable hit target
  const node = g.selectAll('.node').data(nodes,d=>getUID(d));
  const nE = node.enter().append('g')
    .attr('class',d=>'node '+(d.data.g==='f'?'f':'m'))
    .attr('transform',d=>`translate(${d.y||src.y0||0},${d.x||src.x0||0})`)
    .style('opacity',1);

  nE.append('rect').attr('class','node-shape')
    .attr('x',0).attr('y',-CARD_H/2).attr('height',CARD_H).attr('rx',CARD_H/2)
    .attr('width',d=>d._cardW);
  nE.append('text').attr('class','node-label')
    .attr('dy','0.32em').attr('x',16).attr('text-anchor','start')
    .text(d=>d._label)
    .style('font-size',d=>d.depth<=4?'13px':'12px')
    .style('font-weight',d=>d.depth<=4?'600':'400');

  // Expand/collapse gets its own hit target, separate from the card — on a phone this
  // used to be the card's whole tap action, which meant tapping a person's name never
  // opened their info (the one thing you'd actually want to check). Now the card always
  // opens the panel; this little button next to it is the only thing that expands/collapses.
  const expandToggle = nE.append('g').attr('class','expand-toggle')
    .on('click',(ev,d)=>{
      ev.stopPropagation();
      if(d.children){ d._children=d.children; d.children=null; }
      else if(d._children){ d.children=d._children; d._children=null; }
      update(d);
    });
  expandToggle.append('circle').attr('class','expand-hit').attr('r',15);
  expandToggle.append('text').attr('class','expand').attr('dy','0.32em').attr('text-anchor','middle');

  nE.on('click',(ev,d)=>{
      ev.stopPropagation();
      g.selectAll('.node').classed('hl',nd=>nd.data.id===d.data.id);
      showPanel(d);
    })
    .on('dblclick',(ev,d)=>{
      ev.stopPropagation();
      if(d.children){ d._children=d.children; d.children=null; }
      else if(d._children){ d.children=d._children; d._children=null; }
      update(d);
    });

  const nAll = nE.merge(node);
  nAll.transition().duration(360)
    .attr('transform',d=>`translate(${d.y},${d.x})`);

  nAll.select('.node-shape').transition().duration(360)
    .attr('width', d=>d._cardW)
    .attr('fill',d=>d.data.g==='f'?'rgba(201,100,140,.32)':branchFillM[getBranch(d)])
    .attr('stroke',d=>d.data.g==='f'?'#C9648C':branchC[getBranch(d)])
    .attr('stroke-dasharray',d=>d._children?'3,2':'none');

  nAll.select('.node-label').text(d=>d._label);

  nAll.select('.expand-toggle')
    .attr('transform', d=>`translate(${d._cardW+19},0)`)
    .style('display', d=>(d.children||d._children)?null:'none');
  nAll.select('.expand').text(d=>d._children?'▸':'▾');

  node.exit().transition().duration(360)
    .attr('transform',()=>`translate(${src.y},${src.x})`)
    .style('opacity',0).remove();

  nodes.forEach(d=>{ d.x0=d.x; d.y0=d.y; });

  // Spouse overlays
  updateSpouses(nodes);
}

update(root);
homeTransform = computeFitTransform();
svg.call(zoom.transform, homeTransform);

// ════════════════════════════════════════════════════════
//  PANEL
// ════════════════════════════════════════════════════════
function showPanel(d){
  const p = d.data;
  document.getElementById('pname').textContent = p.name;
  document.getElementById('psub').textContent = p.g==='f'?'Әйел / Женщина':'Ер / Мужчина';

  const br = getBranch(d);
  const bTag = document.getElementById('pbranch');
  if(br && branchNames[br]){
    bTag.innerHTML = `<span class="branch-tag" style="background:${branchBg[br]};border:1px solid ${branchBd[br]};color:${branchBd[br]}">${branchNames[br]}</span>`;
  } else { bTag.innerHTML=''; }

  const spousesEl = document.getElementById('pspouses');
  const spouses = p.spouses||[];
  spousesEl.innerHTML = spouses.map((s,i)=>`
    <div class="panel-row">
      <span class="panel-label">${spouses.length>1 ? (i+1)+'-ші жары' : 'Жары'}</span>
      <span>${s.name}</span>
      ${s.info ? `<span class="panel-subinfo">${s.info}</span>` : ''}
    </div>`).join('');

  const nf = document.getElementById('pnotef');
  if(p.note){ document.getElementById('pnote').textContent=p.note; nf.style.display='block'; }
  else { nf.style.display='none'; }

  const gen = d.depth+1;
  document.getElementById('pgen').textContent = gen+'-ші буын / '+gen+'-е поколение';

  document.getElementById('panel').classList.add('open');
  document.body.classList.add('panel-open');
  g.selectAll('.node').classed('hl',nd=>nd.data.id===p.id);
}

function showSpousePanel(node, spouse){
  const p = node.data;
  document.getElementById('pname').textContent = spouse.name;
  document.getElementById('psub').textContent = 'Жары / Жена — '+p.name;
  document.getElementById('pbranch').innerHTML='';
  document.getElementById('pspouses').innerHTML = spouse.info
    ? `<div class="panel-row"><span class="panel-label">Жүзі</span><span>${spouse.info}</span></div>`
    : '';
  document.getElementById('pnotef').style.display='none';
  const gen = node.depth+1;
  document.getElementById('pgen').textContent = gen+'-ші буын';
  document.getElementById('panel').classList.add('open');
  document.body.classList.add('panel-open');
  g.selectAll('.node').classed('hl',false);
}

function closePanel(){
  document.getElementById('panel').classList.remove('open');
  document.body.classList.remove('panel-open');
  g.selectAll('.node').classed('hl',false);
}
window.closePanel=closePanel;

// Resize
window.addEventListener('resize',()=>{
  const nW=window.innerWidth, nH=window.innerHeight-60;
  svg.attr('viewBox',`0 0 ${nW} ${nH}`).attr('width',nW).attr('height',nH);
});
