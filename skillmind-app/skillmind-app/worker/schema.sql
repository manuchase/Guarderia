PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS professionals (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'coordinadora',
  guarderia TEXT, created_at INTEGER
);
CREATE TABLE IF NOT EXISTS maestras (
  code TEXT PRIMARY KEY, name TEXT NOT NULL, funcion TEXT, grupo TEXT,
  telefono TEXT, professional_id TEXT NOT NULL, created_at INTEGER,
  FOREIGN KEY (professional_id) REFERENCES professionals(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_maestras_professional ON maestras(professional_id);

CREATE TABLE IF NOT EXISTS ninos (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, grupo TEXT, foto TEXT,
  fecha_nacimiento TEXT, professional_id TEXT NOT NULL, created_at INTEGER,
  activo INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (professional_id) REFERENCES professionals(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ninos_professional ON ninos(professional_id);
CREATE INDEX IF NOT EXISTS idx_ninos_grupo ON ninos(professional_id, grupo);

CREATE TABLE IF NOT EXISTS bitacoras (
  id TEXT PRIMARY KEY, nino_id TEXT NOT NULL, nino_name TEXT, grupo TEXT,
  date TEXT NOT NULL, professional_id TEXT NOT NULL,
  alimentacion TEXT NOT NULL DEFAULT '[]', panales TEXT NOT NULL DEFAULT '[]',
  siestas TEXT NOT NULL DEFAULT '[]', animos TEXT NOT NULL DEFAULT '[]',
  notas TEXT NOT NULL DEFAULT '[]',
  FOREIGN KEY (nino_id) REFERENCES ninos(id) ON DELETE CASCADE,
  FOREIGN KEY (professional_id) REFERENCES professionals(id) ON DELETE CASCADE,
  UNIQUE(nino_id, date)
);
CREATE INDEX IF NOT EXISTS idx_bitacoras_prof_date ON bitacoras(professional_id, date);
CREATE INDEX IF NOT EXISTS idx_bitacoras_nino_date ON bitacoras(nino_id, date);

CREATE TABLE IF NOT EXISTS planes (
  id TEXT PRIMARY KEY, nino_id TEXT NOT NULL, professional_id TEXT NOT NULL,
  mes TEXT NOT NULL, maestra_code TEXT, edad_meses INTEGER, estado TEXT,
  created_at INTEGER, closed_at INTEGER, resumen TEXT,
  FOREIGN KEY (nino_id) REFERENCES ninos(id) ON DELETE CASCADE,
  FOREIGN KEY (professional_id) REFERENCES professionals(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_planes_nino_mes ON planes(nino_id, mes);

CREATE TABLE IF NOT EXISTS plan_objetivos (
  id TEXT PRIMARY KEY, plan_id TEXT NOT NULL, origen TEXT, area TEXT, texto TEXT,
  es_principal INTEGER NOT NULL DEFAULT 0, nivel_inicial TEXT, meta_esperada TEXT,
  progreso INTEGER NOT NULL DEFAULT 0, estado TEXT, observaciones TEXT,
  visible_padres INTEGER NOT NULL DEFAULT 0, updated_at INTEGER,
  FOREIGN KEY (plan_id) REFERENCES planes(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_objetivos_plan ON plan_objetivos(plan_id);

CREATE TABLE IF NOT EXISTS plan_registros (
  id TEXT PRIMARY KEY, objetivo_id TEXT NOT NULL, fecha TEXT, progreso INTEGER,
  observacion TEXT, usuario TEXT, created_at INTEGER,
  FOREIGN KEY (objetivo_id) REFERENCES plan_objetivos(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_registros_objetivo ON plan_registros(objetivo_id, created_at DESC);

CREATE TABLE IF NOT EXISTS padres (
  code TEXT PRIMARY KEY, name TEXT NOT NULL, nino_ids TEXT NOT NULL DEFAULT '[]',
  telefono TEXT, professional_id TEXT NOT NULL, created_at INTEGER,
  FOREIGN KEY (professional_id) REFERENCES professionals(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_padres_professional ON padres(professional_id);

CREATE TABLE IF NOT EXISTS circulares (
  id TEXT PRIMARY KEY, professional_id TEXT NOT NULL, title TEXT, body TEXT,
  created_at INTEGER,
  FOREIGN KEY (professional_id) REFERENCES professionals(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_circulares_professional ON circulares(professional_id, created_at DESC);

CREATE TABLE IF NOT EXISTS mensajes_padres (
  id TEXT PRIMARY KEY, padre_code TEXT NOT NULL, from_role TEXT, text TEXT, at INTEGER,
  FOREIGN KEY (padre_code) REFERENCES padres(code) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_mensajes_padre_at ON mensajes_padres(padre_code, at ASC);

INSERT OR IGNORE INTO professionals
(id, name, username, password, role, guarderia, created_at)
VALUES ('p1','Manu','manu','carem2412','superadmin','Superadministrador',strftime('%s','now') * 1000);
