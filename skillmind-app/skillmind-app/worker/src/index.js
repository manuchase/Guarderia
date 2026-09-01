const TABLES = {
  professionals:{pk:"id",columns:["id","name","username","password","role","guarderia","created_at"]},
  maestras:{pk:"code",columns:["code","name","funcion","grupo","telefono","professional_id","created_at"]},
  ninos:{pk:"id",columns:["id","name","grupo","foto","fecha_nacimiento","professional_id","created_at","activo"]},
  bitacoras:{pk:"id",columns:["id","nino_id","nino_name","grupo","date","professional_id","alimentacion","panales","siestas","animos","notas"]},
  planes:{pk:"id",columns:["id","nino_id","professional_id","mes","maestra_code","edad_meses","estado","created_at","closed_at","resumen"]},
  plan_objetivos:{pk:"id",columns:["id","plan_id","origen","area","texto","es_principal","nivel_inicial","meta_esperada","progreso","estado","observaciones","visible_padres","updated_at"]},
  plan_registros:{pk:"id",columns:["id","objetivo_id","fecha","progreso","observacion","usuario","created_at"]},
  padres:{pk:"code",columns:["code","name","nino_ids","telefono","professional_id","created_at"]},
  circulares:{pk:"id",columns:["id","professional_id","title","body","created_at"]},
  mensajes_padres:{pk:"id",columns:["id","padre_code","from_role","text","at"]}
};
const JSON_COLUMNS=new Set(["alimentacion","panales","siestas","animos","notas","nino_ids"]);
const BOOL_COLUMNS=new Set(["activo","es_principal","visible_padres"]);

function cors(req){
  const o=req.headers.get("Origin");
  const allowed=o&&/^https:\/\/[a-z0-9-]+\.netlify\.app$/i.test(o)?o:"null";
  return {"Access-Control-Allow-Origin":allowed,"Access-Control-Allow-Headers":"Content-Type, apikey, Authorization, Prefer","Access-Control-Allow-Methods":"GET,POST,DELETE,OPTIONS","Access-Control-Max-Age":"86400","Vary":"Origin"};
}
function out(req,data,status=200,extra={}){
  return new Response(data===null?null:JSON.stringify(data),{status,headers:{...cors(req),"Content-Type":"application/json; charset=utf-8",...extra}});
}
function err(req,status,msg){return out(req,{message:msg,error:msg},status);}
function tableFrom(path){
  const p=path.split("/").filter(Boolean);
  return p[0]==="rest"&&p[1]==="v1"?p[2]:p[0]==="api"?p[1]:null;
}
function dec(v){try{return decodeURIComponent(v)}catch{return v}}
function filters(url,t){
  const a=[];
  for(const [k,raw] of url.searchParams){
    if(["select","order","limit","offset"].includes(k)||!t.columns.includes(k))continue;
    const v=dec(raw);
    if(v.startsWith("eq."))a.push({k,op:"=",v:v.slice(3)});
    else if(v.startsWith("in.(")&&v.endsWith(")"))a.push({k,op:"IN",vs:v.slice(4,-1).split(",").map(x=>x.replace(/^"(.*)"$/,"$1"))});
    else if(v==="is.null")a.push({k,op:"IS NULL"});
    else if(v==="is.not.null")a.push({k,op:"IS NOT NULL"});
  } return a;
}
function selected(url,t){
  const s=url.searchParams.get("select");
  return !s||s==="*"?t.columns:s.split(",").filter(x=>t.columns.includes(x.trim())).map(x=>x.trim());
}
function orders(url,t){
  const s=url.searchParams.get("order"); if(!s)return [];
  return s.split(",").map(x=>{const [f,d="asc"]=x.trim().split(".");return t.columns.includes(f)?`${f} ${d.toLowerCase()==="desc"?"DESC":"ASC"}`:null}).filter(Boolean);
}
function decode(r){
  const x={...r};
  for(const c of JSON_COLUMNS)if(c in x&&typeof x[c]==="string"){try{x[c]=JSON.parse(x[c])}catch{x[c]=[]}}
  for(const c of BOOL_COLUMNS)if(c in x)x[c]=!!x[c];
  return x;
}
function encode(c,v){
  if(v===undefined)return null;
  if(JSON_COLUMNS.has(c))return typeof v==="string"?v:JSON.stringify(v);
  if(BOOL_COLUMNS.has(c))return v===true||v===1||v==="1"?1:0;
  if(v!==null&&typeof v==="object")return JSON.stringify(v);
  return v;
}
async function get(req,env,name,t,url){
  const fs=filters(url,t), where=[],b=[];
  for(const f of fs){
    if(f.op==="IN"){if(!f.vs.length)where.push("1=0");else{where.push(`${f.k} IN (${f.vs.map(()=>"?").join(",")})`);b.push(...f.vs)}}
    else if(f.op.includes("NULL"))where.push(`${f.k} ${f.op}`);
    else{where.push(`${f.k} = ?`);b.push(f.v)}
  }
  let sql=`SELECT ${selected(url,t).join(",")} FROM ${name}`;
  if(where.length)sql+=` WHERE ${where.join(" AND ")}`;
  const os=orders(url,t);if(os.length)sql+=" ORDER BY "+os.join(",");
  const lim=Number(url.searchParams.get("limit"));if(Number.isFinite(lim)&&lim>0){sql+=" LIMIT ?";b.push(Math.floor(lim));const off=Number(url.searchParams.get("offset"));if(Number.isFinite(off)&&off>=0){sql+=" OFFSET ?";b.push(Math.floor(off))}}
  const r=await env.DB.prepare(sql).bind(...b).all();return out(req,(r.results||[]).map(decode));
}
async function post(req,env,name,t){
  let body;try{body=await req.json()}catch{return err(req,400,"JSON inválido")}
  const rows=Array.isArray(body)?body:[body];const statements=[];
  for(const row of rows){
    if(!row||row[t.pk]===undefined)return err(req,400,`Falta ${t.pk}`);
    const cs=t.columns.filter(c=>Object.hasOwn(row,c));if(!cs.length)continue;
    const upd=cs.filter(c=>c!==t.pk);
    let sql=`INSERT INTO ${name} (${cs.join(",")}) VALUES (${cs.map(()=>"?").join(",")})`;
    if(upd.length)sql+=` ON CONFLICT(${t.pk}) DO UPDATE SET `+upd.map(c=>`${c}=excluded.${c}`).join(",");
    statements.push(env.DB.prepare(sql).bind(...cs.map(c=>encode(c,row[c]))));
  }
  await env.DB.batch(statements);
  const result=[];
  for(const row of rows){const r=await env.DB.prepare(`SELECT ${t.columns.join(",")} FROM ${name} WHERE ${t.pk}=?`).bind(row[t.pk]).first();if(r)result.push(decode(r))}
  return out(req,result,201);
}
async function del(req,env,name,t,url){
  const fs=filters(url,t);if(!fs.length)return err(req,400,"DELETE requiere filtro");
  const w=[],b=[];
  for(const f of fs){if(f.op==="IN"){w.push(`${f.k} IN (${f.vs.map(()=>"?").join(",")})`);b.push(...f.vs)}else if(f.op.includes("NULL"))w.push(`${f.k} ${f.op}`);else{w.push(`${f.k}=?`);b.push(f.v)}}
  await env.DB.prepare(`DELETE FROM ${name} WHERE ${w.join(" AND ")}`).bind(...b).run();return out(req,null,204);
}
export default{async fetch(req,env){
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors(req)});
  const u=new URL(req.url);if(u.pathname==="/health")return out(req,{ok:true,service:"guarderia-api",database:"D1"});
  const name=tableFrom(u.pathname),t=TABLES[name];if(!t)return err(req,404,"Ruta no encontrada");
  try{if(req.method==="GET")return get(req,env,name,t,u);if(req.method==="POST")return post(req,env,name,t);if(req.method==="DELETE")return del(req,env,name,t,u);return err(req,405,"Método no permitido")}catch(e){console.error(e);return err(req,500,e?.message||"Error interno")}}
};
