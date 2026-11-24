-- Ledger core: currencies, legal entities, chart of accounts, accounting periods,
-- FX rates, and the double-entry journal with database-enforced invariants.

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE currencies (
  code      char(3) PRIMARY KEY CHECK (code ~ '^[A-Z]{3}$'),
  exponent  smallint NOT NULL CHECK (exponent BETWEEN 0 AND 4),
  name      text NOT NULL
);

INSERT INTO currencies (code, exponent, name) VALUES
  ('USD', 2, 'US Dollar'), ('EUR', 2, 'Euro'), ('GBP', 2, 'Pound Sterling'),
  ('CHF', 2, 'Swiss Franc'), ('CAD', 2, 'Canadian Dollar'), ('AUD', 2, 'Australian Dollar'),
  ('SGD', 2, 'Singapore Dollar'), ('INR', 2, 'Indian Rupee'), ('MXN', 2, 'Mexican Peso'),
  ('JPY', 0, 'Japanese Yen'), ('KRW', 0, 'South Korean Won'),
  ('KWD', 3, 'Kuwaiti Dinar'), ('BHD', 3, 'Bahraini Dinar');

CREATE TABLE entities (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id               uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  code                          text NOT NULL CHECK (code ~ '^[A-Z0-9][A-Z0-9-]{1,15}$'),
  name                          text NOT NULL,
  functional_currency           char(3) NOT NULL REFERENCES currencies (code),
  country_code                  char(2),
  timezone                      text NOT NULL DEFAULT 'UTC' CHECK (length(timezone) BETWEEN 1 AND 64),
  rounding_account_id           uuid,
  retained_earnings_account_id  uuid,
  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code),
  UNIQUE (organization_id, id)
);

CREATE TABLE accounts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL,
  entity_id        uuid NOT NULL,
  code             text NOT NULL,
  name             text NOT NULL,
  description      text,
  type             text NOT NULL CHECK (type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
  parent_id        uuid,
  is_postable      boolean NOT NULL DEFAULT true,
  is_active        boolean NOT NULL DEFAULT true,
  currency         char(3) REFERENCES currencies (code),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_id, code),
  UNIQUE (entity_id, id),
  FOREIGN KEY (organization_id, entity_id) REFERENCES entities (organization_id, id) ON DELETE CASCADE,
  -- A parent must live in the same entity.
  FOREIGN KEY (entity_id, parent_id) REFERENCES accounts (entity_id, id)
);
CREATE INDEX accounts_parent_idx ON accounts (parent_id);

ALTER TABLE entities
  ADD CONSTRAINT entities_rounding_account_fk
    FOREIGN KEY (id, rounding_account_id) REFERENCES accounts (entity_id, id) DEFERRABLE INITIALLY DEFERRED,
  ADD CONSTRAINT entities_retained_earnings_fk
    FOREIGN KEY (id, retained_earnings_account_id) REFERENCES accounts (entity_id, id) DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE accounting_periods (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    uuid NOT NULL,
  entity_id          uuid NOT NULL,
  fiscal_year        integer NOT NULL CHECK (fiscal_year BETWEEN 1900 AND 9999),
  period_number      smallint NOT NULL CHECK (period_number BETWEEN 1 AND 13),
  name               text NOT NULL,
  start_date         date NOT NULL,
  end_date           date NOT NULL,
  status             text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'soft_closed', 'closed')),
  status_changed_at  timestamptz NOT NULL DEFAULT now(),
  status_changed_by  uuid REFERENCES users (id) ON DELETE SET NULL,
  CHECK (end_date >= start_date),
  UNIQUE (entity_id, fiscal_year, period_number),
  UNIQUE (entity_id, id),
  FOREIGN KEY (organization_id, entity_id) REFERENCES entities (organization_id, id) ON DELETE CASCADE,
  -- No two periods of one entity may overlap.
  EXCLUDE USING gist (entity_id WITH =, daterange(start_date, end_date, '[]') WITH &&)
);

CREATE TABLE fx_rates (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  from_currency    char(3) NOT NULL REFERENCES currencies (code),
  to_currency      char(3) NOT NULL REFERENCES currencies (code),
  rate_type        text NOT NULL DEFAULT 'spot' CHECK (rate_type IN ('spot', 'average', 'closing')),
  rate_date        date NOT NULL,
  rate             numeric(24, 10) NOT NULL CHECK (rate > 0),
  created_by       uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (from_currency <> to_currency),
  UNIQUE (organization_id, from_currency, to_currency, rate_type, rate_date)
);

-- Gapless numbering: one counter row per entity and fiscal year, incremented under a row lock.
CREATE TABLE journal_sequences (
  entity_id    uuid NOT NULL REFERENCES entities (id) ON DELETE CASCADE,
  fiscal_year  integer NOT NULL,
  next_value   bigint NOT NULL DEFAULT 1 CHECK (next_value > 0),
  PRIMARY KEY (entity_id, fiscal_year)
);

CREATE TABLE journal_entries (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id          uuid NOT NULL,
  entity_id                uuid NOT NULL,
  period_id                uuid NOT NULL,
  fiscal_year              integer NOT NULL,
  sequence_number          bigint,
  entry_number             text,
  entry_date               date NOT NULL,
  memo                     text NOT NULL,
  reference                text,
  status                   text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'reversed')),
  source                   text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'recurring', 'reversal', 'revaluation', 'import', 'elimination')),
  idempotency_key          text,
  idempotency_fingerprint  text,
  functional_currency      char(3) NOT NULL REFERENCES currencies (code),
  total_debit_functional   bigint NOT NULL DEFAULT 0 CHECK (total_debit_functional >= 0),
  total_credit_functional  bigint NOT NULL DEFAULT 0 CHECK (total_credit_functional >= 0),
  created_by               uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  posted_by                uuid REFERENCES users (id) ON DELETE SET NULL,
  posted_at                timestamptz,
  reversed_by_entry_id     uuid REFERENCES journal_entries (id),
  FOREIGN KEY (organization_id, entity_id) REFERENCES entities (organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (entity_id, period_id) REFERENCES accounting_periods (entity_id, id),
  UNIQUE (entity_id, idempotency_key),
  UNIQUE (entity_id, fiscal_year, sequence_number),
  CHECK (status = 'draft' OR (sequence_number IS NOT NULL AND entry_number IS NOT NULL AND posted_at IS NOT NULL))
);
CREATE INDEX journal_entries_entity_date_idx ON journal_entries (entity_id, entry_date, id);
CREATE INDEX journal_entries_period_status_idx ON journal_entries (period_id, status);

CREATE TABLE journal_lines (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id                uuid NOT NULL REFERENCES journal_entries (id) ON DELETE CASCADE,
  entity_id               uuid NOT NULL,
  line_number             integer NOT NULL CHECK (line_number > 0),
  account_id              uuid NOT NULL,
  side                    text NOT NULL CHECK (side IN ('debit', 'credit')),
  currency                char(3) NOT NULL REFERENCES currencies (code),
  amount_minor            bigint NOT NULL CHECK (amount_minor > 0),
  rate                    numeric(24, 10) NOT NULL CHECK (rate > 0),
  functional_minor        bigint NOT NULL CHECK (functional_minor >= 0),
  memo                    text,
  is_rounding_adjustment  boolean NOT NULL DEFAULT false,
  UNIQUE (entry_id, line_number),
  -- Lines can only hit accounts of the entry's own entity.
  FOREIGN KEY (entity_id, account_id) REFERENCES accounts (entity_id, id)
);
CREATE INDEX journal_lines_account_idx ON journal_lines (account_id, entry_id);

-- Posted history is immutable: lines of a non-draft entry cannot change.
CREATE FUNCTION journal_lines_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_status text;
BEGIN
  SELECT status INTO v_status FROM journal_entries
   WHERE id = CASE WHEN TG_OP = 'INSERT' THEN NEW.entry_id ELSE OLD.entry_id END;
  IF v_status IS NOT NULL AND v_status <> 'draft' THEN
    RAISE EXCEPTION 'journal lines of a % entry are immutable', v_status USING ERRCODE = 'LL002';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER journal_lines_immutable
  BEFORE INSERT OR UPDATE OR DELETE ON journal_lines
  FOR EACH ROW EXECUTE FUNCTION journal_lines_guard();

-- Posted entries may only transition to 'reversed' (linking the reversal); nothing else changes.
CREATE FUNCTION journal_entries_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'draft' THEN
      RAISE EXCEPTION 'a % journal entry cannot be deleted', OLD.status USING ERRCODE = 'LL002';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.status = 'reversed' THEN
    RAISE EXCEPTION 'a reversed journal entry is immutable' USING ERRCODE = 'LL002';
  END IF;
  IF OLD.status = 'posted' THEN
    IF NEW.status = 'reversed' AND NEW.reversed_by_entry_id IS NOT NULL
       AND (NEW.entity_id, NEW.entry_date, NEW.memo, NEW.sequence_number, NEW.entry_number,
            NEW.total_debit_functional, NEW.total_credit_functional, NEW.period_id)
           IS NOT DISTINCT FROM
           (OLD.entity_id, OLD.entry_date, OLD.memo, OLD.sequence_number, OLD.entry_number,
            OLD.total_debit_functional, OLD.total_credit_functional, OLD.period_id) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'a posted journal entry is immutable' USING ERRCODE = 'LL002';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER journal_entries_immutable
  BEFORE UPDATE OR DELETE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION journal_entries_guard();

-- Defence in depth: at COMMIT every posted entry must balance in functional currency,
-- match its header totals, have two or more lines, and sit in a period that is not closed.
CREATE FUNCTION journal_entries_check_posted() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_debit  bigint;
  v_credit bigint;
  v_lines  integer;
  v_period accounting_periods%ROWTYPE;
BEGIN
  SELECT coalesce(sum(functional_minor) FILTER (WHERE side = 'debit'), 0),
         coalesce(sum(functional_minor) FILTER (WHERE side = 'credit'), 0),
         count(*)
    INTO v_debit, v_credit, v_lines
    FROM journal_lines WHERE entry_id = NEW.id;
  IF v_lines < 2 THEN
    RAISE EXCEPTION 'posted entry % has fewer than two lines', NEW.id USING ERRCODE = 'LL003';
  END IF;
  IF v_debit <> v_credit OR v_debit <> NEW.total_debit_functional OR v_credit <> NEW.total_credit_functional THEN
    RAISE EXCEPTION 'posted entry % is unbalanced (debit %, credit %)', NEW.id, v_debit, v_credit
      USING ERRCODE = 'LL003';
  END IF;
  SELECT * INTO v_period FROM accounting_periods WHERE id = NEW.period_id;
  IF NEW.entry_date NOT BETWEEN v_period.start_date AND v_period.end_date THEN
    RAISE EXCEPTION 'entry date % is outside period %', NEW.entry_date, v_period.name USING ERRCODE = 'LL003';
  END IF;
  IF v_period.status = 'closed' THEN
    RAISE EXCEPTION 'period % is closed', v_period.name USING ERRCODE = 'LL003';
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER journal_entries_posted_invariants
  AFTER INSERT OR UPDATE ON journal_entries
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW WHEN (NEW.status = 'posted')
  EXECUTE FUNCTION journal_entries_check_posted();
