-- Covering indexes for foreign keys flagged by the Supabase database linter
-- (lint 0001_unindexed_foreign_keys). A FK without an index on its own column
-- forces sequential scans for cascade checks and FK-filtered joins.
--
-- All statements are idempotent (IF NOT EXISTS) and safe to re-run. Index names
-- follow idx_<table>_<column>.
--
-- NOT addressed here (deliberate):
--   * 0005_unused_index — these indexes (e.g. idx_opportunities_slug) back
--     real query paths; the linter reports them unused due to low volume /
--     stats reset. Dropping them is riskier than the marginal storage saving.
--   * auth_db_connections_absolute — a project setting (switch Auth to a
--     percentage-based connection strategy in the Supabase dashboard).

create index if not exists idx_application_scores_criterion_id            on public.application_scores (criterion_id);
create index if not exists idx_application_status_log_changed_by          on public.application_status_log (changed_by);
create index if not exists idx_artwork_provenance_ledger_campaign_id      on public.artwork_provenance_ledger (campaign_id);
create index if not exists idx_artwork_provenance_ledger_from_owner_id    on public.artwork_provenance_ledger (from_owner_id);
create index if not exists idx_artwork_provenance_ledger_source_opportunity_id on public.artwork_provenance_ledger (source_opportunity_id);
create index if not exists idx_artworks_creator_id                        on public.artworks (creator_id);
create index if not exists idx_artworks_current_owner_id                  on public.artworks (current_owner_id);
create index if not exists idx_artworks_parent_artwork_id                 on public.artworks (parent_artwork_id);
create index if not exists idx_blog_posts_featured_profile_id             on public.blog_posts (featured_profile_id);
create index if not exists idx_blog_posts_linked_update_id                on public.blog_posts (linked_update_id);
create index if not exists idx_campaign_email_captures_campaign_id        on public.campaign_email_captures (campaign_id);
create index if not exists idx_campaign_files_campaign_id                 on public.campaign_files (campaign_id);
create index if not exists idx_campaign_files_uploaded_by                 on public.campaign_files (uploaded_by);
create index if not exists idx_campaigns_application_id                   on public.campaigns (application_id);
create index if not exists idx_campaigns_hero_work_id                     on public.campaigns (hero_work_id);
create index if not exists idx_campaigns_partner_profile_id               on public.campaigns (partner_profile_id);
create index if not exists idx_chat_messages_sender_id                    on public.chat_messages (sender_id);
create index if not exists idx_claim_tokens_claimed_by                    on public.claim_tokens (claimed_by);
create index if not exists idx_collective_email_invitations_claimed_by    on public.collective_email_invitations (claimed_by);
create index if not exists idx_collective_email_invitations_invited_by    on public.collective_email_invitations (invited_by);
create index if not exists idx_conversations_participant_b                on public.conversations (participant_b);
create index if not exists idx_conversations_source_work_id               on public.conversations (source_work_id);
create index if not exists idx_enquiries_artist_profile_id                on public.enquiries (artist_profile_id);
create index if not exists idx_enquiries_campaign_id                      on public.enquiries (campaign_id);
create index if not exists idx_grants_opportunity_id                      on public.grants (opportunity_id);
create index if not exists idx_grants_project_id                          on public.grants (project_id);
create index if not exists idx_holder_attribution_claims_resolved_by_admin_id on public.holder_attribution_claims (resolved_by_admin_id);
create index if not exists idx_messages_work_id                           on public.messages (work_id);
create index if not exists idx_negotiated_sale_transactions_artist_id     on public.negotiated_sale_transactions (artist_id);
create index if not exists idx_negotiated_sale_transactions_artwork_id    on public.negotiated_sale_transactions (artwork_id);
create index if not exists idx_negotiated_sale_transactions_buyer_id      on public.negotiated_sale_transactions (buyer_id);
create index if not exists idx_negotiated_sale_transactions_conversation_id on public.negotiated_sale_transactions (conversation_id);
create index if not exists idx_opportunity_application_drafts_artist_id   on public.opportunity_application_drafts (artist_id);
create index if not exists idx_opportunity_application_drafts_artwork_id  on public.opportunity_application_drafts (artwork_id);
create index if not exists idx_opportunity_application_drafts_creative_work_id on public.opportunity_application_drafts (creative_work_id);
create index if not exists idx_opportunity_applications_artwork_id        on public.opportunity_applications (artwork_id);
create index if not exists idx_opportunity_applications_creative_work_id  on public.opportunity_applications (creative_work_id);
create index if not exists idx_opportunity_collaborators_invited_by       on public.opportunity_collaborators (invited_by);
create index if not exists idx_outreach_emails_sent_by                    on public.outreach_emails (sent_by);
create index if not exists idx_partner_documents_uploaded_by              on public.partner_documents (uploaded_by);
create index if not exists idx_pending_artists_created_by_holder_id       on public.pending_artists (created_by_holder_id);
create index if not exists idx_pending_ownership_claims_resolved_by       on public.pending_ownership_claims (resolved_by);
create index if not exists idx_primary_sale_transactions_edition_id       on public.primary_sale_transactions (edition_id);
create index if not exists idx_primary_sale_transactions_reverted_by      on public.primary_sale_transactions (reverted_by);
create index if not exists idx_private_room_artworks_artwork_id           on public.private_room_artworks (artwork_id);
create index if not exists idx_profile_achievements_opportunity_id        on public.profile_achievements (opportunity_id);
create index if not exists idx_projects_artwork_id                        on public.projects (artwork_id);
create index if not exists idx_projects_opportunity_id                    on public.projects (opportunity_id);
create index if not exists idx_provenance_links_artist_id                 on public.provenance_links (artist_id);
create index if not exists idx_provenance_links_patron_id                 on public.provenance_links (patron_id);
create index if not exists idx_recurring_cycle_log_opportunity_id         on public.recurring_cycle_log (opportunity_id);
create index if not exists idx_royalty_holds_artist_pending_id            on public.royalty_holds (artist_pending_id);
create index if not exists idx_royalty_holds_artwork_id                   on public.royalty_holds (artwork_id);
create index if not exists idx_series_artworks_artwork_id                 on public.series_artworks (artwork_id);
create index if not exists idx_studio_posts_artist_id                     on public.studio_posts (artist_id);
create index if not exists idx_studio_posts_project_id                    on public.studio_posts (project_id);
create index if not exists idx_user_roles_granted_by                      on public.user_roles (granted_by);
create index if not exists idx_user_roles_granted_to_user_id              on public.user_roles (granted_to_user_id);
create index if not exists idx_user_saved_opportunities_opportunity_id    on public.user_saved_opportunities (opportunity_id);
