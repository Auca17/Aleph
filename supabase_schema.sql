-- Tabla gastos para Pockit (QVAC Hackathon 2026)
-- Ejecutar este script en el Editor SQL de Supabase (https://app.supabase.com)

CREATE TABLE IF NOT EXISTS public.gastos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  monto NUMERIC NOT NULL,
  categoria VARCHAR(100) NOT NULL,
  fecha TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fuente VARCHAR(50) NOT NULL DEFAULT 'manual', -- 'voz' | 'foto' | 'manual'
  flag_anomalia BOOLEAN NOT NULL DEFAULT FALSE,
  raw_text TEXT,
  descripcion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para acelerar las consultas de filtrado por categoría y rango de fechas
CREATE INDEX IF NOT EXISTS idx_gastos_categoria ON public.gastos (categoria);
CREATE INDEX IF NOT EXISTS idx_gastos_fecha ON public.gastos (fecha DESC);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.gastos ENABLE ROW LEVEL SECURITY;

-- Política de lectura pública (para demo local)
CREATE POLICY "Permitir lectura publica" ON public.gastos
  FOR SELECT USING (true);

-- Política de inserción pública (para demo local)
CREATE POLICY "Permitir insercion publica" ON public.gastos
  FOR INSERT WITH CHECK (true);

-- Política de eliminación pública (para demo local)
CREATE POLICY "Permitir eliminacion publica" ON public.gastos
  FOR DELETE USING (true);

-- Tabla ingresos para Pockit (QVAC Hackathon 2026)
CREATE TABLE IF NOT EXISTS public.ingresos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  monto NUMERIC NOT NULL,
  categoria VARCHAR(100) NOT NULL,
  fecha TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fuente VARCHAR(50) NOT NULL DEFAULT 'manual',
  descripcion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ingresos_categoria ON public.ingresos (categoria);
CREATE INDEX IF NOT EXISTS idx_ingresos_fecha ON public.ingresos (fecha DESC);

ALTER TABLE public.ingresos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir lectura publica de ingresos" ON public.ingresos FOR SELECT USING (true);
CREATE POLICY "Permitir insercion publica de ingresos" ON public.ingresos FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir eliminacion publica de ingresos" ON public.ingresos FOR DELETE USING (true);

