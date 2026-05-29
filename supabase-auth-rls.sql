-- Migración: user_id + políticas RLS para usuarios autenticados
-- Ejecutar en Supabase → SQL Editor

-- 1) Columna user_id vinculada a auth.users
ALTER TABLE public.gastos
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS gastos_user_id_idx ON public.gastos (user_id);

-- 2) Eliminar políticas temporales anon
DROP POLICY IF EXISTS "anon_select_gastos" ON public.gastos;
DROP POLICY IF EXISTS "anon_insert_gastos" ON public.gastos;
DROP POLICY IF EXISTS "anon_update_gastos" ON public.gastos;
DROP POLICY IF EXISTS "anon_delete_gastos" ON public.gastos;

-- 3) Políticas estrictas para rol authenticated (solo sus propios registros)
CREATE POLICY "authenticated_select_own_gastos"
  ON public.gastos
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "authenticated_insert_own_gastos"
  ON public.gastos
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "authenticated_update_own_gastos"
  ON public.gastos
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "authenticated_delete_own_gastos"
  ON public.gastos
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
