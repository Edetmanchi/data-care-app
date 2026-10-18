import { Baby, Building2, FlaskConical, HeartPulse, Hospital, Pill, Radar, Stethoscope, type LucideIcon } from "lucide-react";
import type { FacilityType } from "@/lib/facility-types";

export const FACILITY_ICON: Record<FacilityType, LucideIcon> = {
  all: Radar,
  phc: Building2,
  hospital: Hospital,
  maternity: Baby,
  midwife: HeartPulse,
  pharmacy: Pill,
  clinic: Stethoscope,
  lab: FlaskConical,
};

/** Extra words people may type for each category (any language), used by the search box. */
export const FACILITY_SYNONYMS: Record<FacilityType, string> = {
  all: "all any everything health care",
  phc: "phc primary health centre center health post comprehensive",
  hospital: "hospital general teaching federal medical centre fmc emergency asibiti ile iwosan ulo ogwu",
  maternity: "maternity maternal birth antenatal labour delivery pregnant pregnancy obstetric gynae women",
  midwife: "midwife midwives tba birth attendant ungozoma agbebi nurse",
  pharmacy: "pharmacy chemist drug medicine patent medicine store kantin magani ile oogun",
  clinic: "clinic doctor doctors klinik",
  lab: "lab laboratory test scan diagnostic",
};
