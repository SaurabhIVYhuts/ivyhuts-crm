import type { PropertyProvider } from "../types";
import { graddingHomesAdapter } from "./graddingHomes";
import type { ProviderAdapter } from "./types";
import { uhomesAdapter } from "./uhomes";
import { uniaccoAdapter } from "./uniacco";
import { universityLivingAdapter } from "./universityLiving";

export const PROVIDER_ADAPTERS: Record<PropertyProvider, ProviderAdapter> = {
  uhomes: uhomesAdapter,
  uniacco: uniaccoAdapter,
  university_living: universityLivingAdapter,
  gradding_homes: graddingHomesAdapter,
};
