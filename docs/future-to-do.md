# Future To-Do

## #11 · Analytics dashboard

**Trigger:** Build when there are 50+ artists with at least 10 completed sales across the platform. Below that threshold, the earnings dashboard is sufficient and a chart with 3 data points is noise, not signal.

**What to show:**
- Revenue over time (monthly, per artist)
- Inventory value (sum of available works at listed price)
- Collector geography (map view of `current_owner_id` profiles by region)

**Foundation:** The Stripe earnings dashboard. Build on top of existing transfer/sale data in `artworks` and `messages`.
