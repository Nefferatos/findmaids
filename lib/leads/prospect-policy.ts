export const prospectStages = [
  "IDENTIFIED", "CONTACTED", "INTERESTED", "PROFILE_DRAFTED", "LISTED_FREE", "TRIAL", "PAYING", "DECLINED", "DO_NOT_CONTACT",
] as const;
export type ProspectStageValue = (typeof prospectStages)[number];

export function canPerformProspectOutreach(stage: ProspectStageValue) {
  return stage !== "DO_NOT_CONTACT" && stage !== "DECLINED";
}

export function validateProspectStage(stage: string): stage is ProspectStageValue {
  return (prospectStages as readonly string[]).includes(stage);
}
