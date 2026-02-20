-- SQL para crear las tablas en Supabase para SANAVI INTERNATIONAL

-- 1. Tabla de Transacciones (Caja Chica)
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  date DATE NOT NULL,
  detail TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  type TEXT CHECK (type IN ('ingreso', 'egreso')) NOT NULL
);

-- 2. Tabla de Inventario
CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  date DATE NOT NULL,
  product TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  type TEXT CHECK (type IN ('entrada', 'salida')) NOT NULL,
  reason TEXT CHECK (reason IN ('venta', 'regalia')),
  order_number TEXT,
  detail TEXT
);

-- Habilitar RLS (Opcional, pero recomendado)
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

-- Crear políticas de acceso (Permitir todo para el rol anon por ahora, ajustar según sea necesario)
CREATE POLICY "Allow all for anonymous users on transactions" ON transactions FOR ALL USING (true);
CREATE POLICY "Allow all for anonymous users on inventory" ON inventory FOR ALL USING (true);
