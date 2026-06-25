-- Waluta ceny pozycji w cyfrowym menu.
-- Uruchom w Supabase → SQL Editor.

alter table public.dishes
  add column if not exists menu_price_currency text not null default 'PLN';

alter table public.dishes
  drop constraint if exists dishes_menu_price_currency_check;

alter table public.dishes
  add constraint dishes_menu_price_currency_check
  check (
    menu_price_currency in (
      'PLN', 'EUR', 'USD', 'GBP', 'CHF',
      'CZK', 'SEK', 'NOK', 'DKK', 'HUF',
      'UAH', 'ILS', 'AED', 'CAD', 'AUD'
    )
  );
