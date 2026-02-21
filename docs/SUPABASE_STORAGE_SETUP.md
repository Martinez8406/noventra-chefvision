# Supabase Storage – bucket `food-images`

Aplikacja zapisuje zdjęcia z Chef's Studio w bucketcie **food-images** i zapisuje link w tabeli **dishes** (pole `imageUrl`).

## 1. Utworzenie bucketu

W Supabase: **Storage** → **New bucket**:

- **Name:** `food-images`
- **Public bucket:** włączone (tak, aby linki do zdjęć działały bez logowania, np. w menu publicznym)

## 2. Policies (Storage)

W **Storage** → **Policies** dla bucketu `food-images` dodaj:

### INSERT (upload) – zalogowani użytkownicy mogą wgrywać

- **Policy name:** `Users can upload dish images`
- **Allowed operation:** INSERT
- **Target roles:** authenticated (lub anon, jeśli chcesz upload bez logowania)
- **Policy definition (USING):** np. `true` (wszyscy zalogowani) albo:
  - `bucket_id = 'food-images' AND (storage.foldername(name))[1] = auth.uid()::text`  
  – wtedy użytkownik może wgrywać tylko do folderu ze swoim `userId`.

Przykład w SQL (Supabase → SQL Editor):

```sql
-- Zezwól zalogowanym na upload do food-images (własny folder = userId)
CREATE POLICY "Users can upload dish images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'food-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Zezwól wszystkim na odczyt (publiczne zdjęcia dań)
CREATE POLICY "Public read food-images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'food-images');
```

### SELECT (odczyt) – publiczny

- **Policy name:** `Public read food-images`
- **Allowed operation:** SELECT
- **Target roles:** public
- **USING:** `bucket_id = 'food-images'`

Dzięki temu linki zwracane przez `getPublicUrl()` będą działać bez logowania.

## 3. Tabela `dishes` (menu_items)

Aplikacja zapisuje dania do tabeli **`dishes`** (kolumna `imageUrl` = link z Storage).  
Jeśli w projekcie używasz tabeli **`menu_items`**, możesz:

- zmienić w kodzie nazwę tabeli z `dishes` na `menu_items`,  
albo
- w Supabase mieć widok `dishes` na `menu_items` i dalej pisać do `dishes`.

## 4. Zmienne w `.env.local`

Upewnij się, że są ustawione (Vite ładuje też bez prefiksu):

- `SUPABASE_URL` lub `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_ANON_KEY` lub `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Po zmianie zmiennych zrestartuj `npm run dev`.
