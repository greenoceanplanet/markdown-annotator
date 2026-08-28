# Review Notes for Markdown Preview

마크다운 프리뷰에서 텍스트를 드래그해 인라인 코멘트를 남기고, 모아서 AI 에이전트용 프롬프트로 클립보드에 복사하는 VSCode 확장입니다.

## 사용법

1. 마크다운 파일을 열고 프리뷰(`Ctrl+K V`)를 엽니다.
2. 본문에서 텍스트를 드래그하면 팝업이 뜨고, 코멘트를 남길 수 있습니다.
3. 우측 하단 패널에서 코멘트 목록을 확인하고, 개별/전체 삭제나 복사가 가능합니다.
4. "코멘트 복사" 버튼을 누르면 AI 에이전트에 바로 붙여넣을 수 있는 프롬프트 형식으로 클립보드에 복사됩니다.

코멘트는 브라우저(웹뷰) `localStorage`에 파일 경로별로 저장되어, 프리뷰를 닫았다 열어도 유지됩니다.

## 설치

```
npx --yes @vscode/vsce package
```

생성된 `.vsix` 파일을 VSCode에서 `Ctrl+Shift+P` → `Extensions: Install from VSIX...`로 설치합니다.
