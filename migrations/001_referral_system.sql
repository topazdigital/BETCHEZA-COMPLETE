-- Migration: Referral System
-- Generated: 2026-05-06
-- Run this file against your production MySQL database to add the referral tables.
-- Safe to run on existing databases — uses CREATE TABLE IF NOT EXISTS.

-- ─────────────────────────────────────────────────
-- referral_codes  — one persistent code per user
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS referral_codes (
  user_id    INT          NOT NULL PRIMARY KEY,
  code       VARCHAR(20)  NOT NULL UNIQUE,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_rc_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────────
-- referrals  — one row per referred user
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS referrals (
  id                   VARCHAR(40)  NOT NULL PRIMARY KEY,
  referrer_id          INT          NOT NULL,
  referred_user_id     INT          NOT NULL UNIQUE,
  referred_email       VARCHAR(255) NOT NULL,
  referred_username    VARCHAR(100) NOT NULL,
  created_at           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  verified_at          TIMESTAMP    NULL,
  referrer_bonus_paid  TINYINT(1)   NOT NULL DEFAULT 0,
  referee_bonus_paid   TINYINT(1)   NOT NULL DEFAULT 0,
  INDEX idx_referrer   (referrer_id),
  INDEX idx_referred   (referred_user_id),
  CONSTRAINT fk_ref_referrer  FOREIGN KEY (referrer_id)      REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_ref_referred  FOREIGN KEY (referred_user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
