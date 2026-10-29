-- Схема для Supabase Cloud Saves с RLS

-- 1. Таблица сохранений
CREATE TABLE IF NOT EXISTS public.saves (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    save_data JSONB NOT NULL,
    save_version INTEGER NOT NULL DEFAULT 6,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Включение Row Level Security (RLS)
ALTER TABLE public.saves ENABLE ROW LEVEL SECURITY;

-- 3. Политика выборки: пользователь видит только своё сохранение
CREATE POLICY "Users can select own save"
    ON public.saves
    FOR SELECT
    USING (auth.uid() = user_id);

-- 4. Политика вставки: пользователь может создать своё сохранение
CREATE POLICY "Users can insert own save"
    ON public.saves
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- 5. Политика обновления: пользователь может обновлять только своё сохранение
CREATE POLICY "Users can update own save"
    ON public.saves
    FOR UPDATE
    USING (auth.uid() = user_id);

-- 6. Триггер для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER set_updated_at
    BEFORE UPDATE ON public.saves
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
