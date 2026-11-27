-- Raise the stock of the seeded ingredients while preserving larger balances.
UPDATE "Ingredient" AS ingredient
SET "quantity" = stock."quantity"
FROM (VALUES
    ('Đường',  50000),
    ('Sữa',   100000),
    ('Cà phê', 30000)
) AS stock ("name", "quantity")
WHERE ingredient."name" = stock."name"
  AND ingredient."quantity" < stock."quantity";
