import {
  aggregateOfficeWorkforce,
  type AggregateOfficeWorkforceInput,
} from "@/lib/office-workforce";

export type DashboardPlantillaSummary = {
  total: number;
  filled: number;
  vacant: number;
  occupancyRate: number;
};

export function buildDashboardPlantillaSummary(
  input: AggregateOfficeWorkforceInput,
): DashboardPlantillaSummary {
  const { totals } = aggregateOfficeWorkforce(input);
  const { activePlantillaSlots, filledPlantillaSlots, vacantPlantillaSlots } =
    totals;

  return {
    total: activePlantillaSlots,
    filled: filledPlantillaSlots,
    vacant: vacantPlantillaSlots,
    occupancyRate:
      activePlantillaSlots === 0
        ? 0
        : Math.round((filledPlantillaSlots / activePlantillaSlots) * 1000) / 10,
  };
}
