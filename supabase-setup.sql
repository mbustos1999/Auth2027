-- Ejecuta este SQL en el editor SQL de tu proyecto Supabase
-- (Dashboard > SQL Editor > New query) para crear la tabla y permisos.

-- Tabla de enlaces usuario WordPress <-> Discord
CREATE TABLE IF NOT EXISTS public.user_discord_links (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  link_code TEXT,
  wp_user_id BIGINT,
  discord_id TEXT,
  discord_username TEXT,
  roles JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices útiles
CREATE INDEX IF NOT EXISTS idx_user_discord_links_email ON public.user_discord_links (email);
CREATE INDEX IF NOT EXISTS idx_user_discord_links_discord_id ON public.user_discord_links (discord_id);
CREATE INDEX IF NOT EXISTS idx_user_discord_links_link_code ON public.user_discord_links (link_code);

-- Activar RLS (Row Level Security)
ALTER TABLE public.user_discord_links ENABLE ROW LEVEL SECURITY;

-- Política: la app (anon) puede INSERTAR una fila y hacer SELECT por email
-- (para que al iniciar sesión se cree/actualice la fila y se lea en el dashboard)
CREATE POLICY "anon_insert_user_discord_links"
  ON public.user_discord_links FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "anon_select_user_discord_links"
  ON public.user_discord_links FOR SELECT
  TO anon
  USING (true);

-- Política: la app (anon) puede hacer UPDATE por email (upsert al iniciar sesión)
CREATE POLICY "anon_update_user_discord_links"
  ON public.user_discord_links FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- El bot usa service_role, que bypasea RLS; no hace falta política para él.
