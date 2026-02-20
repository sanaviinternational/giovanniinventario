-- SQL para crear la tabla de configuración (logo)
CREATE TABLE settings (
  id TEXT PRIMARY KEY DEFAULT 'global',
  logo_url TEXT,
  logo_dims JSONB,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Política para permitir todo a usuarios anónimos (ajustar según necesidad)
CREATE POLICY "Allow all for anonymous users on settings" ON settings FOR ALL USING (true);

-- Insertar el registro inicial
INSERT INTO settings (id) VALUES ('global') ON CONFLICT (id) DO NOTHING;
