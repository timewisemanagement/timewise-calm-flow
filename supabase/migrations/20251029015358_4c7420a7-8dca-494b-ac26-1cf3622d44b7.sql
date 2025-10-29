-- Add first_name, last_name, email, theme, and color_scheme columns
-- Remove display_name (we'll migrate the data first)

-- First, add the new columns
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'light',
ADD COLUMN IF NOT EXISTS color_scheme TEXT DEFAULT 'green';

-- Migrate existing display_name to first_name (take first word as first name)
UPDATE public.profiles 
SET first_name = SPLIT_PART(display_name, ' ', 1),
    last_name = CASE 
      WHEN display_name LIKE '% %' THEN SUBSTRING(display_name FROM POSITION(' ' IN display_name) + 1)
      ELSE NULL
    END
WHERE display_name IS NOT NULL AND first_name IS NULL;

-- Drop the old display_name column
ALTER TABLE public.profiles DROP COLUMN IF EXISTS display_name;

-- Update the handle_new_user function to use first_name and last_name
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', SPLIT_PART(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'last_name'
  );
  RETURN NEW;
END;
$$;