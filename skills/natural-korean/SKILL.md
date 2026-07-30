---
name: natural-korean
description: "한국어 답변·PR·커밋·README·설계 메모·리뷰 코멘트를 구어에 가까운 설명체로 쓴다. 단정 연타·가짜 힘 동사·선언 헤더·문어 과다를 줄이고, 사람이 이어서 말하듯 이어 쓴다. Use whenever writing Korean for the user or in repo docs."
---
## Install

<!-- skill-install:start -->

```bash
# generated — do not hand-edit; run: node scripts/emit-skill-md.mjs --skill natural-korean
node scripts/ensure-deps.mjs
```

<!-- skill-install:end -->
<!-- skill-body:start -->

## When to use

한국어로 쓰는 거의 전부. 답변, PR 설명, 커밋 메시지, README, 설계 메모, 리뷰 코멘트.

장르(소설·베스트셀러 산문)를 흉내 내는 스킬이 아니다. **말투**만 맞춘다.
교재/스토리텔링용 산문이 필요하면 별도 스킬을 쓴다.

## One-liner

단정하지 말고, 이어서 말하고, 평소에 쓸 단어만 쓴다.

## Rules

1. **문장 잇기** — `A다. B다.`가 두 개 이상이면 하나로 합치거나, 왜/그래서/근데로 잇는다.
2. **동사는 평범하게** — `박다/살리다/심다/세우다` 같은 번역투 비유 동사 대신 `넣다/고치다/쓰다/옮기다`.
3. **선언 헤더 금지** — `핵심은`, `정리하면`, `무엇을 왜`, `부수 이득`처럼 목차 까는 문장 삭제.
4. **구어는 괜찮다** — `근데`, `그래서`, `이거는`, `그냥`, `좀` 써도 된다. 매 문장마다 넣지 말고 밀도만 조절한다.
5. **확실할 때만 단정** — 추측은 `~일 수 있어요`, `내가 보기엔`. 확인된 사실만 `~요`/`~다`.
6. **길이는 장르마다** — 말투는 같고, PR·커밋은 짧게, 답변은 필요할 만큼.
7. **존댓말 기본값** — 답변·PR·문서는 `요`체. 커밋·코드 주석은 해라체(짧은 관례).

자세한 금지어·패턴은 [references/anti-patterns.md](references/anti-patterns.md),
before/after는 [references/examples.md](references/examples.md).

## Procedure

1. 한국어로 쓸지 확인한다. 쓸 거면 이 스킬을 기본으로 따른다.
2. 초안을 쓴 뒤 anti-patterns를 한 번 훑는다. 단정 연타·가짜 힘 동사·선언 헤더가 있으면 고친다.
3. 표면별 길이만 맞춘다. PR/커밋은 짧게, 설명은 이어서.

## Do not

- 소설화, 베스트셀러 구조, 일부러 짧게 쪼개기
- 문장마다 감탄·비유를 얹어 “문학적”으로 만들기
- 영어 직역 리듬(`~를 통해 ~를 가능하게 한다`)을 한국어에 그대로 옮기기

<!-- skill-body:end -->
