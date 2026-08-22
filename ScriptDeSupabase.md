##Script de supabase para su funcionamiento

-- ==========================================
-- SCRIPT DE INICIALIZACIÓN DE SUPABASE - ALEPH
-- ==========================================

-- 1. Habilitar extensión para generación de UUIDs si no existe
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Crear tabla gastos
CREATE TABLE IF NOT EXISTS public.gastos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    monto NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    categoria VARCHAR(100) NOT NULL,
    fecha TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fuente VARCHAR(20) NOT NULL CHECK (fuente IN ('voz', 'foto', 'manual')),
    flag_anomalia BOOLEAN NOT NULL DEFAULT FALSE,
    raw_text TEXT NULL,
    descripcion TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Crear índice para optimizar la ordenación y filtrado por fecha
CREATE INDEX IF NOT EXISTS idx_gastos_fecha ON public.gastos(fecha DESC);

-- 4. Habilitar Row Level Security (RLS)
ALTER TABLE public.gastos ENABLE ROW LEVEL SECURITY;

-- 5. Crear políticas de acceso público (adecuado para Hackaton / Anon Key)
DROP POLICY IF EXISTS "Permitir lectura publica de gastos" ON public.gastos;
CREATE POLICY "Permitir lectura publica de gastos" ON public.gastos
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir insercion publica de gastos" ON public.gastos;
CREATE POLICY "Permitir insercion publica de gastos" ON public.gastos
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir eliminacion publica de gastos" ON public.gastos;
CREATE POLICY "Permitir eliminacion publica de gastos" ON public.gastos
    FOR DELETE USING (true);

-- 6. Insertar datos de prueba iniciales (Seed Data)
INSERT INTO public.gastos (monto, categoria, fecha, fuente, flag_anomalia, descripcion, raw_text)
VALUES
    (4500.00, 'Alimentación', NOW() - INTERVAL '2 days', 'foto', false, 'Supermercado Coto', 'SUPERMERCADO COTO TOTAL: $4500.00'),
    (1200.00, 'Transporte', NOW() - INTERVAL '1 day', 'voz', false, 'Recarga SUBE', 'cargué 1200 en la sube'),
    (38000.00, 'Alimentación', NOW(), 'foto', true, 'Cena Restaurante Puerto Madero', 'RESTAURANTE PUERTO MADERO TOTAL: $38000.00');