import memoRepairs from "./memo-repairs.json";
import protectedMessages from "@protected-localization";
import projectProps from "./project-props.json";
import finalSinks from "./final-sinks.json";
import finalProps from "./final-props.json";
import reviewFixes from "./review-fixes.json";
import activityReview from "./activity-review.json";
import slotReview from "./slot-review.json";
import attributes from "./attributes.json";
import workflowsExtra from "./workflows-extra.json";
import omissions from "./final-omissions.json";
import fragments from "./fragments.json";
import ephemeral from "./ephemeral.json";
import status from "./status.json";
import workflows from "./workflows.json";
import manual from "./manual.json";
import residual from "./residual.json";
import repairs from "./repairs.json";
import missing from "./missing.json";
import dates from "./dates";
import rich from "./rich";
import batch1 from "./batch-01.json";
import batch2 from "./batch-02.json";
import batch3 from "./batch-03.json";
import batch4 from "./batch-04.json";
import batch5 from "./batch-05.json";
import batch6 from "./batch-06.json";
import rich1 from "./rich-1.json";
import rich2 from "./rich-2.json";
import rich3 from "./rich-3.json";

const korean: Record<string, string> = {
  ...protectedMessages,
  ...memoRepairs,
  ...batch1,
  ...batch2,
  ...batch3,
  ...batch4,
  ...batch5,
  ...batch6,
  ...rich1,
  ...rich2,
  ...rich3,
  ...missing,
  ...residual,
  ...dates,
  ...rich,
  ...repairs,
  ...manual,
  ...workflows,
  ...workflowsExtra,
  ...status,
  ...ephemeral,
  ...fragments,
  ...omissions,
  ...attributes,
  ...reviewFixes,
  ...finalSinks,
  ...projectProps,
  ...finalProps,
  ...activityReview,
  ...slotReview,
  "The app language was saved, but native menus could not be updated. Try again.":
    "앱 언어를 저장했지만 시스템 메뉴에 적용하지 못했습니다. 다시 시도해 주세요.",
  Retry: "다시 시도",
  "Only {name} (owner)": "{name}님만 (소유자)",
  "Only the owner": "소유자만",
  "Not deployed": "배포되지 않음",
  "Declared owner verified": "명시된 소유자 확인됨",
  Yes: "예",
  No: "아니요",
  "Leave blank to use the app default (currently {count}). Custom values may be 1–32.":
    "비워 두면 앱 기본값인 {count}개를 사용합니다. 1~32개로 설정할 수 있습니다.",
  "Current value for this agent. Custom values may be 1–32.":
    "이 에이전트에 적용할 값입니다. 1~32개로 설정할 수 있습니다.",
  Language: "언어",
  "Choose the language used by Buzz on this device.":
    "이 기기에서 Buzz에 사용할 언어를 선택하세요.",
  "Could not save the language. Check storage access and try again.":
    "언어를 저장하지 못했습니다. 저장소 접근 권한을 확인하고 다시 시도해 주세요.",
};
export default korean;
