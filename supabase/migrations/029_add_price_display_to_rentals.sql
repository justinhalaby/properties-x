-- Add price_display column to rentals table
-- This stores the original price string (e.g., "CA$2,175 / Month")
-- while monthly_rent stores the numeric value

ALTER TABLE rentals ADD COLUMN IF NOT EXISTS price_display TEXT;

-- Create index for filtering/sorting by price display
CREATE INDEX IF NOT EXISTS idx_rentals_price_display ON rentals(price_display);
