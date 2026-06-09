// Parser: convierte wikitext de planteles FIFA 2026 a JSON limpio
const fs=require('fs'),path=require('path');
const sections=[1,6,11,16,21,26,31,36,41,46,51,56];

function cleanLink(s){
  if(!s)return '';
  // [[A|B]] -> B ; [[A]] -> A ; strip refs/templates
  s=s.replace(/\[\[([^\|\]]+)\|([^\]]+)\]\]/g,'$2');
  s=s.replace(/\[\[([^\]]+)\]\]/g,'$1');
  s=s.replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi,'');
  s=s.replace(/<ref[^/]*\/>/gi,'');
  s=s.replace(/\{\{[^}]*\}\}/g,'');
  s=s.replace(/&nbsp;/g,' ').replace(/&amp;/g,'&');
  return s.trim();
}

function ageToDob(ageBlock){
  // {{birth date and age2|2026|6|11|YYYY|M|D}}
  const m=ageBlock.match(/birth date(?: and age2?)?\|[^|]+\|[^|]+\|[^|]+\|(\d+)\|(\d+)\|(\d+)/);
  if(m){const y=m[1],mo=String(m[2]).padStart(2,'0'),d=String(m[3]).padStart(2,'0');return `${y}-${mo}-${d}`;}
  return '';
}

// Lee 1 jugador desde un bloque {{nat fs g player|...}}
function parsePlayer(block){
  const o={};
  // parse pipe-separated kv inside the template; balance braces
  // Simpler: regex each known key. age may contain {{...}}, so use a custom approach.
  const noM=block.match(/\|\s*no=([^\|}]+)/);if(noM)o.no=parseInt(noM[1].trim())||null;
  const posM=block.match(/\|\s*pos=([^\|}]+)/);if(posM)o.pos=posM[1].trim();
  const nameM=block.match(/\|\s*name=([^\|}]+)/);if(nameM)o.name=cleanLink(nameM[1]);
  // age block (with nested template)
  const ageM=block.match(/\|\s*age=\{\{(birth date[\s\S]*?)\}\}/);
  if(ageM)o.dob=ageToDob(ageM[1]);
  const capsM=block.match(/\|\s*caps=([^\|}]+)/);if(capsM)o.caps=parseInt(capsM[1].trim())||0;
  const goalsM=block.match(/\|\s*goals=([^\|}]+)/);if(goalsM)o.goals=parseInt(goalsM[1].trim())||0;
  const clubM=block.match(/\|\s*club=([^\|}]+)/);if(clubM)o.club=cleanLink(clubM[1]);
  // captain marker
  o.captain=/\|\s*other=.*\(captain\)/i.test(block)||/\|\s*other=.*captain/i.test(block)||false;
  return o;
}

function parseSection(wikitext){
  // Identificar equipos: cada equipo arranca con un H3 "===Team==="
  const teams=[];
  const teamBlocks=wikitext.split(/\n===\s*/).slice(1); // skip pre-H3
  for(const tb of teamBlocks){
    const nameLine=tb.match(/^([^=\n]+)===/);
    if(!nameLine)continue;
    const team=cleanLink(nameLine[1].trim());
    // coach
    let coach='';
    const coachM=tb.match(/\{\{nat fs g coach\|[^}]*name=([^\|}]+)/);
    if(coachM)coach=cleanLink(coachM[1]);
    // Si no encontramos coach, probar otros formatos
    if(!coach){
      const c2=tb.match(/'''Head coach:?'''\s*\[?\[?([^\|\]\n]+)/i);
      if(c2)coach=cleanLink(c2[1]);
    }
    // players
    const players=[];
    // El template puede ser {{nat fs g player|...}} y puede tener llaves anidadas (age={{birth date and age2|...}})
    // Buscamos templates "nat fs g player" balanceando llaves
    const re=/\{\{nat fs (?:g |r )?player\b/g;
    let m;
    while((m=re.exec(tb))){
      let i=m.index+2; // pos justo después de {{
      let depth=2; // we are inside {{
      let end=-1;
      for(;i<tb.length;i++){
        const ch=tb[i],nx=tb[i+1];
        if(ch==='{'&&nx==='{'){depth+=2;i++;}
        else if(ch==='}'&&nx==='}'){depth-=2;i++;if(depth===0){end=i+1;break;}}
      }
      if(end<0)continue;
      const block=tb.slice(m.index,end);
      const p=parsePlayer(block);
      if(p.name)players.push(p);
    }
    if(team&&players.length)teams.push({team,coach,players});
  }
  return teams;
}

const all={};
for(const s of sections){
  const file=path.join(__dirname,`raw-${s}.json`);
  const raw=JSON.parse(fs.readFileSync(file,'utf8'));
  const wikitext=raw.parse?.wikitext?.['*']||'';
  const teams=parseSection(wikitext);
  console.log(`section ${s} → ${teams.length} teams: ${teams.map(t=>`${t.team}(${t.players.length})`).join(', ')}`);
  teams.forEach(t=>{all[t.team]={coach:t.coach,players:t.players};});
}
console.log(`\nTotal teams: ${Object.keys(all).length}`);
console.log(`Total players: ${Object.values(all).reduce((a,t)=>a+t.players.length,0)}`);
fs.writeFileSync(path.join(__dirname,'..','squads.json'),JSON.stringify(all,null,2));
console.log('\nSaved -> data/squads.json');
