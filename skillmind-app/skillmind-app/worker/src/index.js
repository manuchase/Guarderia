const TABLES = {
  professionals: {
    pk: "id",
    columns: ["id", "name", "username", "password", "role", "guarderia", "created_at"]
  },
  maestras: {
    pk: "code",
    columns: ["code", "name", "funcion", "grupo", "telefono", "professional_id", "created_at"]
  },
  ninos: {
    pk: "id",
    columns: ["id", "name", "grupo", "foto", "fecha_nacimiento", "professional_id", "created_at", "activo"]
  },
  bitacoras: {
    pk: "id",
    columns: ["id", "nino_id", "nino_name", "grupo", "date", "professional_id", "alimentacion", "panales", "siestas", "animos", "notas"]
  },
  planes: {
    pk: "id",
    columns: ["id", "nino_id", "professional_id", "mes", "maestra_code", "edad_meses", "estado", "created_at", "closed_at", "resumen"]
  },
  plan_objetivos: {
    pk: "id",
    columns: [
      "id",
      "plan_id",
      "origen",
      "area",
      "texto",
      "es_principal",
      "nivel_inicial",
      "meta_esperada",
      "progreso",
      "estado",
      "observaciones",
      "visible_padres",
      "updated_at"
    ]
  },
  plan_registros: {
    pk: "id",
    columns: ["id", "objetivo_id", "fecha", "progreso", "observacion", "usuario", "created_at"]
  },
  padres: {
    pk: "code",
    columns: ["code", "name", "nino_ids", "telefono", "professional_id", "created_at"]
  },
  circulares: {
    pk: "id",
    columns: ["id", "professional_id", "title", "body", "created_at"]
  },
  mensajes_padres: {
    pk: "id",
    columns: ["id", "padre_code", "from_role", "text", "at"]
  }
};

const JSON_COLUMNS = new Set([
  "alimentacion",
  "panales",
  "siestas",
  "animos",
  "notas",
  "nino_ids"
]);

const BOOL_COLUMNS = new Set([
  "activo",
  "es_principal",
  "visible_padres"
]);

function cors(req) {
  const origin = req.headers.get("Origin") || "";

  const allowed =
    origin === "https://kidsnido.netlify.app" ||
    /^https:\/\/[a-z0-9-]+\.netlify\.app$/i.test(origin) ||
    origin === "http://localhost:5173" ||
    origin === "http://localhost:3000";

  return {
    "Access-Control-Allow-Origin": allowed
      ? origin
      : "https://kidsnido.netlify.app",

    "Access-Control-Allow-Headers":
      "Content-Type, apikey, Authorization, Prefer",

    "Access-Control-Allow-Methods":
      "GET, POST, DELETE, OPTIONS",

    "Access-Control-Max-Age": "86400",

    "Vary": "Origin"
  };
}

function out(req, data, status = 200, extra = {}) {
  return new Response(
    data === null ? null : JSON.stringify(data),
    {
      status,
      headers: {
        ...cors(req),
        "Content-Type": "application/json; charset=utf-8",
        ...extra
      }
    }
  );
}

function err(req, status, msg, details = null) {
  return out(
    req,
    {
      message: msg,
      error: msg,
      ...(details ? { details } : {})
    },
    status
  );
}

function tableFrom(path) {
  const p = path.split("/").filter(Boolean);

  if (p[0] === "rest" && p[1] === "v1") {
    return p[2];
  }

  if (p[0] === "api") {
    return p[1];
  }

  return null;
}

function dec(v) {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

function filters(url, t) {
  const result = [];

  for (const [key, raw] of url.searchParams) {
    if (
      ["select", "order", "limit", "offset"].includes(key) ||
      !t.columns.includes(key)
    ) {
      continue;
    }

    const value = dec(raw);

    if (value.startsWith("eq.")) {
      result.push({
        k: key,
        op: "=",
        v: value.slice(3)
      });
    }

    else if (
      value.startsWith("in.(") &&
      value.endsWith(")")
    ) {
      result.push({
        k: key,
        op: "IN",
        vs: value
          .slice(4, -1)
          .split(",")
          .map(x => x.replace(/^"(.*)"$/, "$1"))
      });
    }

    else if (value === "is.null") {
      result.push({
        k: key,
        op: "IS NULL"
      });
    }

    else if (value === "is.not.null") {
      result.push({
        k: key,
        op: "IS NOT NULL"
      });
    }
  }

  return result;
}

function selected(url, t) {
  const select = url.searchParams.get("select");

  if (!select || select === "*") {
    return t.columns;
  }

  return select
    .split(",")
    .filter(x => t.columns.includes(x.trim()))
    .map(x => x.trim());
}

function orders(url, t) {
  const order = url.searchParams.get("order");

  if (!order) {
    return [];
  }

  return order
    .split(",")
    .map(x => {
      const [field, direction = "asc"] = x.trim().split(".");

      if (!t.columns.includes(field)) {
        return null;
      }

      return `${field} ${
        direction.toLowerCase() === "desc"
          ? "DESC"
          : "ASC"
      }`;
    })
    .filter(Boolean);
}

function decode(row) {
  const result = {
    ...row
  };

  for (const column of JSON_COLUMNS) {
    if (
      column in result &&
      typeof result[column] === "string"
    ) {
      try {
        result[column] = JSON.parse(result[column]);
      } catch {
        result[column] = [];
      }
    }
  }

  for (const column of BOOL_COLUMNS) {
    if (column in result) {
      result[column] = !!result[column];
    }
  }

  return result;
}

function encode(column, value) {
  if (value === undefined) {
    return null;
  }

  if (JSON_COLUMNS.has(column)) {
    return typeof value === "string"
      ? value
      : JSON.stringify(value);
  }

  if (BOOL_COLUMNS.has(column)) {
    return (
      value === true ||
      value === 1 ||
      value === "1"
    )
      ? 1
      : 0;
  }

  if (
    value !== null &&
    typeof value === "object"
  ) {
    return JSON.stringify(value);
  }

  return value;
}

async function get(req, env, name, table, url) {
  const fs = filters(url, table);

  const where = [];
  const bindings = [];

  for (const filter of fs) {
    if (filter.op === "IN") {
      if (!filter.vs.length) {
        where.push("1=0");
      } else {
        where.push(
          `${filter.k} IN (${filter.vs
            .map(() => "?")
            .join(",")})`
        );

        bindings.push(...filter.vs);
      }
    }

    else if (filter.op.includes("NULL")) {
      where.push(
        `${filter.k} ${filter.op}`
      );
    }

    else {
      where.push(`${filter.k} = ?`);
      bindings.push(filter.v);
    }
  }

  let sql = `
    SELECT ${selected(url, table).join(",")}
    FROM ${name}
  `;

  if (where.length) {
    sql += ` WHERE ${where.join(" AND ")}`;
  }

  const order = orders(url, table);

  if (order.length) {
    sql += ` ORDER BY ${order.join(",")}`;
  }

  const limit = Number(
    url.searchParams.get("limit")
  );

  if (
    Number.isFinite(limit) &&
    limit > 0
  ) {
    sql += " LIMIT ?";
    bindings.push(Math.floor(limit));

    const offset = Number(
      url.searchParams.get("offset")
    );

    if (
      Number.isFinite(offset) &&
      offset >= 0
    ) {
      sql += " OFFSET ?";
      bindings.push(Math.floor(offset));
    }
  }

  const result = await env.DB
    .prepare(sql)
    .bind(...bindings)
    .all();

  return out(
    req,
    (result.results || []).map(decode)
  );
}

async function post(req, env, name, table) {
  let body;

  try {
    body = await req.json();
  } catch {
    return err(
      req,
      400,
      "El cuerpo de la solicitud no contiene JSON válido."
    );
  }

  const rows = Array.isArray(body)
    ? body
    : [body];

  if (!rows.length) {
    return err(
      req,
      400,
      "No se recibieron datos para guardar."
    );
  }

  const statements = [];

  for (const row of rows) {
    if (
      !row ||
      row[table.pk] === undefined ||
      row[table.pk] === null ||
      row[table.pk] === ""
    ) {
      return err(
        req,
        400,
        `Falta el campo obligatorio "${table.pk}".`,
        {
          table: name,
          primaryKey: table.pk,
          received: row
        }
      );
    }

    const columns = table.columns.filter(
      column =>
        Object.prototype.hasOwnProperty.call(
          row,
          column
        )
    );

    if (!columns.length) {
      continue;
    }

    const updateColumns = columns.filter(
      column => column !== table.pk
    );

    let sql = `
      INSERT INTO ${name}
      (${columns.join(",")})
      VALUES (${columns.map(() => "?").join(",")})
    `;

    if (updateColumns.length) {
      sql += `
        ON CONFLICT(${table.pk})
        DO UPDATE SET
        ${updateColumns
          .map(
            column =>
              `${column}=excluded.${column}`
          )
          .join(",")}
      `;
    }

    statements.push(
      env.DB
        .prepare(sql)
        .bind(
          ...columns.map(
            column =>
              encode(column, row[column])
          )
        )
    );
  }

  if (!statements.length) {
    return err(
      req,
      400,
      "No hay columnas válidas para guardar.",
      {
        table: name,
        columns: table.columns
      }
    );
  }

  try {
    await env.DB.batch(statements);
  } catch (error) {
    console.error(
      "D1 POST ERROR:",
      name,
      error
    );

    return err(
      req,
      500,
      "D1 rechazó el guardado.",
      {
        table: name,
        message:
          error?.message ||
          String(error)
      }
    );
  }

  const result = [];

  for (const row of rows) {
    try {
      const saved = await env.DB
        .prepare(
          `SELECT ${table.columns.join(",")}
           FROM ${name}
           WHERE ${table.pk} = ?`
        )
        .bind(row[table.pk])
        .first();

      if (saved) {
        result.push(decode(saved));
      }
    } catch (error) {
      console.error(
        "D1 READ AFTER POST ERROR:",
        name,
        error
      );

      return err(
        req,
        500,
        "El registro se guardó, pero no pudo recuperarse.",
        {
          table: name,
          message:
            error?.message ||
            String(error)
        }
      );
    }
  }

  return out(req, result, 200);
}

async function del(
  req,
  env,
  name,
  table,
  url
) {
  const fs = filters(url, table);

  if (!fs.length) {
    return err(
      req,
      400,
      "DELETE requiere al menos un filtro."
    );
  }

  const where = [];
  const bindings = [];

  for (const filter of fs) {
    if (filter.op === "IN") {
      where.push(
        `${filter.k} IN (${filter.vs
          .map(() => "?")
          .join(",")})`
      );

      bindings.push(...filter.vs);
    }

    else if (filter.op.includes("NULL")) {
      where.push(
        `${filter.k} ${filter.op}`
      );
    }

    else {
      where.push(`${filter.k} = ?`);
      bindings.push(filter.v);
    }
  }

  try {
    await env.DB
      .prepare(
        `DELETE FROM ${name}
         WHERE ${where.join(" AND ")}`
      )
      .bind(...bindings)
      .run();

    return out(req, null, 204);
  } catch (error) {
    console.error(
      "D1 DELETE ERROR:",
      name,
      error
    );

    return err(
      req,
      500,
      "D1 rechazó la eliminación.",
      {
        table: name,
        message:
          error?.message ||
          String(error)
      }
    );
  }
}

export default {
  async fetch(req, env) {

    /*
     * CORS
     */
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: cors(req)
      });
    }

    const url = new URL(req.url);

    /*
     * Health check
     */
    if (url.pathname === "/health") {
      return out(req, {
        ok: true,
        service: "guarderia-api",
        database: "D1"
      });
    }

    /*
     * Detectar tabla
     */
    const tableName = tableFrom(
      url.pathname
    );

    const table = TABLES[tableName];

    if (!table) {
      return err(
        req,
        404,
        "Ruta no encontrada."
      );
    }

    try {

      if (req.method === "GET") {
        return await get(
          req,
          env,
          tableName,
          table,
          url
        );
      }

      if (req.method === "POST") {
        return await post(
          req,
          env,
          tableName,
          table
        );
      }

      if (req.method === "DELETE") {
        return await del(
          req,
          env,
          tableName,
          table,
          url
        );
      }

      return err(
        req,
        405,
        "Método no permitido."
      );

    } catch (error) {

      console.error(
        "WORKER ERROR:",
        error
      );

      return err(
        req,
        500,
        "Error interno del servidor.",
        {
          message:
            error?.message ||
            String(error)
        }
      );
    }
  }
};
