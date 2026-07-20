# pdf/ — @react-pdf/renderer 기반 PDF 리포트

전부 **클라이언트 렌더링**이다 (서버 렌더링 금지 — 서버가 없다).

```
config/     폰트 등록·스타일 토큰·메타 상수
components/ 리포트 조립 블록(PageWrapper·Section·Table 류) + 트리거(DownloadPdfButton)·미리보기 모달
utils/      blob 렌더·저장 · Recharts→PNG 캡처 · 파일명 포맷터
reports/    리포트 문서들. 일반 리포트는 PageWrapper 골격, 관공서 서식류(상담 리포트)는
            자체 Document/Page + CounselingFormLayout 골격 — 두 계열이 있다
```

## 새 리포트 추가 패턴

1. `reports/XxxReport.jsx` — **DataContext 의존 금지, 순수 props만** (기존 리포트 전부 이 원칙).
2. 데이터 조립은 selector에서 (예: `selectors/reflectionReport.js`).
3. 트리거는 `DownloadPdfButton` — 미리보기 모달이 자동으로 붙는다.
   현행 시그니처·파일명 규약은 해당 컴포넌트와 `utils/formatters.js`가 정본.
4. 차트가 필요하면 화면의 Recharts를 PNG로 캡처해(`captureChart.js`) `ChartImage`로 삽입 —
   PDF 안에서 차트를 직접 그리지 않는다.

## ⚠️ 금기 (실제 크래시 이력)

- **`render={({ pageNumber }) => …}` 동적 페이지번호 콜백 절대 금지** — @react-pdf 4.5.1에서
  다중 페이지 + 푸터 render 콜백 조합이 `unsupported number` 크래시를 낸다
  (ReportFooter에 경고 주석 있음. 페이지번호는 정적 텍스트로).
- PdfPreviewModal의 iframe에 `flex-1`(basis 0) 주지 말 것 — 높이가 짓눌린다.
- 관공서 서식 골격(CounselingFormLayout)에 세로 `flex:1` 금지 — 해당 파일 경고 주석 참고.
- 폰트는 `config/fonts.js`에 등록된 것만. 시스템 폰트 가정 금지.
