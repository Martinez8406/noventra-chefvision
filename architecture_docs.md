
# Architektura Systemu Chefvision

## Stack Technologiczny
- **Frontend:** React 18+ (SPA), TypeScript, Tailwind CSS (Styling).
- **Backend/Baza:** Supabase (PostgreSQL + Auth + Storage).
- **AI:** Google Gemini 2.5 Flash Image (Wizualizacja dań).
- **Infrastruktura:** Vercel lub Netlify.

## Schemat Bazy Danych (SQL)

### Tabela: `restaurants`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | Klucz główny |
| name | text | Nazwa restauracji |
| slug | text (Unique) | URL przyjazny gościom (np. 'la-chef') |
| logo_url | text | URL do logo w Storage |

### Tabela: `users`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | Powiązanie z Supabase Auth |
| role | enum | 'Chef' lub 'Staff' |
| restaurant_id | uuid (FK) | Powiązanie z tabelą restaurants |

### Tabela: `dishes`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | Klucz główny |
| restaurant_id | uuid (FK) | Klucz obcy restauracji |
| name | text | Nazwa dania |
| image_url | text | Link do wygenerowanego obrazu |
| description | text | Opis marketingowy dla gościa |
| technique | text | Technika wykonania dla kucharza |
| ingredients | text[] | Lista składników |
| allergens | text[] | Lista alergenów |
| video_url | text | Link do YT |
| is_standard | boolean | Czy zatwierdzone przez szefa |
| created_at | timestamp | Data utworzenia |

## Routing SPA (Hash Based)
- `/` - Dashboard Admina / Logowanie
- `/#/generator` - Narzędzie AI
- `/#/qr` - Zarządzanie marketingiem
- `/#/[slug]` - Publiczne menu mobilne dla gości
