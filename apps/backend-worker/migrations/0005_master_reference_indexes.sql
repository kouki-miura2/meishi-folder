-- Counting a master's cards (the company / department lists, which the card APIs also read to name
-- each card's masters) looked cards up by company and links by department. Without these indexes
-- each count read the whole table: with 150 companies and 300 cards, ~45,000 rows per company list.
CREATE INDEX cards_company_id ON cards (company_id);
CREATE INDEX card_departments_department_id ON card_departments (department_id);
