-- 200 — Country values the app already offers
--
-- profiles.country is the country_enum type, created in 001 with only NZ, AUS and
-- Global. The admin artist table, the artist picker and CountryEnum in
-- src/types/database.ts all offer UK, US and EU as well, so choosing one of those
-- failed with "invalid input value for enum country_enum".
--
-- Run this on its own: a new enum value cannot be used in the transaction that
-- adds it.

alter type country_enum add value if not exists 'UK';
alter type country_enum add value if not exists 'US';
alter type country_enum add value if not exists 'EU';
