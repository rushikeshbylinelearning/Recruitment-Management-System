/** Only candidates created via public form link track viewed / "New" state. */
export function mapCandidateCardViewFields(candidate) {
  const tracksCardView = Boolean(candidate.requires_card_view);

  return {
    tracksCardView,
    isViewed: tracksCardView ? Boolean(candidate.card_viewed_at) : true,
    lastViewedBy: tracksCardView ? candidate.last_viewed_by_name || null : null,
    lastViewedAt: tracksCardView ? candidate.last_viewed_at || null : null,
  };
}
