-- Dodaje kolumnę waluty do rekomendacji sprzedażowych.
-- Uruchom w Supabase → SQL Editor (po dish_recommendations.sql).

alter table public.dish_recommendations
  add column if not exists currency text not null default 'PLN';

alter table public.dish_recommendations
  drop constraint if exists dish_recommendations_currency_check;

alter table public.dish_recommendations
  add constraint dish_recommendations_currency_check
  check (
    currency in (
      'PLN', 'EUR', 'USD', 'GBP', 'CHF',
      'CZK', 'SEK', 'NOK', 'DKK', 'HUF',
      'UAH', 'ILS', 'AED', 'CAD', 'AUD'
    )
  );
