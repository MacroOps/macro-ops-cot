DELETE FROM price_history WHERE market_id = (SELECT id FROM markets WHERE symbol = 'SR3');
UPDATE markets SET yahoo_symbol = NULL WHERE symbol = 'SR3';