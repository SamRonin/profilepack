/**
 * A scenario bundles the fill-time context that may differ from the
 * persona itself: which locale/country the target site expects.
 * Example: persona "Anna Müller" (de-DE) + scenario "US checkout"
 * (en-US / United States) fills US date formats and country selects.
 */
export interface Scenario {
  id: string;
  name: string;
  personaId: string;
  locale: string;
  country?: string;
  createdAt: number;
}
