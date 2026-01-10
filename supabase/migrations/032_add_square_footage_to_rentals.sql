-- Add square_footage column to rentals table
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS square_footage INTEGER;

-- Add check constraint
ALTER TABLE rentals ADD CONSTRAINT valid_square_footage CHECK (square_footage IS NULL OR square_footage > 0);

-- Add index for searching by square footage
CREATE INDEX IF NOT EXISTS idx_rentals_square_footage ON rentals(square_footage);
