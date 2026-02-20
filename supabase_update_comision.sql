-- Actualizar la restricción de tipo en la tabla de transacciones para incluir 'comision'
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check CHECK (type IN ('ingreso', 'egreso', 'comision'));
