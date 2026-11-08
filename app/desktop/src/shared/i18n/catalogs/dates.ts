const messages: Record<string, string> = {
  AM: "오전",
  PM: "오후",
  Today: "오늘",
  Yesterday: "어제",
  "{day} at {time}": "{day} {time}",
  "just now": "방금",
  "on {date}": "{date}",
  "{count} minute ago": "{count}분 전",
  "{count} minutes ago": "{count}분 전",
  "{count} hour ago": "{count}시간 전",
  "{count} hours ago": "{count}시간 전",
  "{count} day ago": "{count}일 전",
  "{count} days ago": "{count}일 전",
  "{prefix} in {channel}": "{channel} · {prefix}",
  "Something in Buzz needs your attention.":
    "Buzz에서 확인이 필요한 항목이 있습니다.",
  "A workflow is waiting for your approval.":
    "워크플로가 승인을 기다리고 있습니다.",
  "New message": "새 메시지",
  "New reply": "새 답글",
  "Direct message": "다이렉트 메시지",
  "@Mention": "멘션",
  "{sender} mentioned you": "{sender}님이 회원님을 언급했습니다",
  "@Mention in {channel}": "{channel}의 멘션",
  "{sender} mentioned you in {channel}":
    "{channel}에서 {sender}님이 회원님을 언급했습니다",
  "Approval Requested": "승인 요청",
  "{sender} requested approval": "{sender}님이 승인을 요청했습니다",
  "Approval Requested in {channel}": "{channel}의 승인 요청",
  "{sender} requested approval in {channel}":
    "{channel}에서 {sender}님이 승인을 요청했습니다",
  Reply: "답글",
  "{sender} replied": "{sender}님이 답글을 남겼습니다",
  "Reply in {channel}": "{channel}의 답글",
  "{sender} replied in {channel}":
    "{channel}에서 {sender}님이 답글을 남겼습니다",
  "Needs Action": "확인 필요",
  "{sender}": "{sender}",
  "Needs Action in {channel}": "{channel}에서 확인이 필요합니다",
  "{sender} in {channel}": "{channel} · {sender}",
};

export default messages;
