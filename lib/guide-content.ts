// Guide content definitions — pure data, no React dependency

// ── Help panel content ──

export interface HelpStep {
  textKey: string;
}

export interface HelpContent {
  titleKey: string;
  objectiveKey: string;
  conceptKey: string;
  steps: HelpStep[];
}

/** Key = levelId or "playground" */
export const HELP_CONTENTS: Record<string, HelpContent> = {
  playground: {
    titleKey: "helpTitlePlayground",
    objectiveKey: "helpObjPlayground",
    conceptKey: "helpConceptPlayground",
    steps: [
      { textKey: "helpStepPlayground1" },
      { textKey: "helpStepPlayground2" },
      { textKey: "helpStepPlayground3" },
      { textKey: "helpStepPlayground4" },
    ],
  },
  lv1: {
    titleKey: "helpTitleLv1",
    objectiveKey: "helpObjLv1",
    conceptKey: "helpConceptLv1",
    steps: [
      { textKey: "helpStepLv1_1" },
      { textKey: "helpStepLv1_2" },
      { textKey: "helpStepLv1_3" },
      { textKey: "helpStepLv1_4" },
      { textKey: "helpStepLv1_5" },
    ],
  },
  lv2: {
    titleKey: "helpTitleLv2",
    objectiveKey: "helpObjLv2",
    conceptKey: "helpConceptLv2",
    steps: [
      { textKey: "helpStepLv2_1" },
      { textKey: "helpStepLv2_2" },
      { textKey: "helpStepLv2_3" },
      { textKey: "helpStepLv2_4" },
    ],
  },
  lv3: {
    titleKey: "helpTitleLv3",
    objectiveKey: "helpObjLv3",
    conceptKey: "helpConceptLv3",
    steps: [
      { textKey: "helpStepLv3_1" },
      { textKey: "helpStepLv3_2" },
      { textKey: "helpStepLv3_3" },
      { textKey: "helpStepLv3_4" },
    ],
  },
  lv4: {
    titleKey: "helpTitleLv4",
    objectiveKey: "helpObjLv4",
    conceptKey: "helpConceptLv4",
    steps: [
      { textKey: "helpStepLv4_1" },
      { textKey: "helpStepLv4_2" },
      { textKey: "helpStepLv4_3" },
      { textKey: "helpStepLv4_4" },
    ],
  },
};
