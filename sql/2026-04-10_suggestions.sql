CREATE TABLE IF NOT EXISTS suggestions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES campaigns(id) ON DELETE CASCADE,
  creative_id uuid REFERENCES creatives(id) ON DELETE SET NULL,

  type text NOT NULL, -- headline_change, description_change, pause_ad, add_negative_keyword, new_headline, new_description
  current_value text,
  suggested_value text,
  reasoning text NOT NULL,

  status text NOT NULL DEFAULT 'pending', -- pending, accepted, rejected, applied
  priority text NOT NULL DEFAULT 'medium', -- high, medium, low

  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by text,

  -- optional metadata
  metadata jsonb
);

CREATE INDEX IF NOT EXISTS idx_suggestions_tenant ON suggestions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_campaign ON suggestions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_status ON suggestions(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_suggestions_priority ON suggestions(tenant_id, priority);

ALTER TABLE suggestions ENABLE ROW LEVEL SECURITY;
