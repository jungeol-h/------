# pdf/ — @react-pdf/renderer 기반 PDF 리포트

전부 **클라이언트 렌더링**이다 (서버 렌더링 금지 — 서버가 없다).

```
config/     fonts.js(Pretendard 등록) · styles.js(colors/fontSize 토큰) · meta.js(ROLE_LABEL 등)
components/ PageWrapper · Section · Table · KpiGrid · InfoGrid(라벨-값 2열) · ChartImage
            ReportHeader/Footer · DownloadPdfButton · PdfPreviewModal
            CounselingFormLayout(관공서 서식 상담 리포트 공용 골격 — 세로 flex:1 금지 주석 필독)
utils/      downloadPdf.js(renderPdfBlob/saveBlob) · captureChart.js(Recharts→PNG) · formatters.js
reports/    UserListReport · StatisticsReport · QuizReport · ReflectionReport
            MonthlyCounselingReport(강사별 월간) · MonthlyLessonReport(강사별 월간 수업보고 —
            교재·과제) · StudentCounselingReport(학생별 — 등록일정은
            data/attendanceBlocks.js 시간블록 기호) — 셋 다 관공서 서식이라
            PageWrapper 대신 자체 Document/Page + CounselingFormLayout 골격
```

## 새 리포트 추가 패턴

1. `reports/XxxReport.jsx` — **DataContext 의존 금지, 순수 props만** (기존 5종 전부 이 원칙).
   PageWrapper > Section > Table/KpiGrid/InfoGrid 조립.
2. 데이터 조립은 selector에서 (예: `selectors/reflectionReport.js`).
3. 트리거 버튼은 `DownloadPdfButton`:
   ```jsx
   <DownloadPdfButton buildDocument={async () => ({ element: <XxxReport {...props} />, filename })} />
   ```
   `buildDocument` 비동기 콜백이 현행 API — 파일명은 `utils/formatters.js`의 `buildFilename()`.
   미리보기 모달(PdfPreviewModal)이 자동으로 붙는다.
4. 차트가 필요하면 화면의 Recharts를 `captureChart.js`로 PNG 캡처 → `ChartImage`로 삽입.

## ⚠️ 금기 (실제 크래시 이력)

- **`render={({ pageNumber }) => …}` 동적 페이지번호 콜백 절대 금지** — @react-pdf 4.5.1에서
  다중 페이지 + 푸터 render 콜백 조합이 `unsupported number` 크래시를 낸다
  (ReportFooter에 경고 주석 있음. 페이지번호는 정적 텍스트로).
- PdfPreviewModal의 iframe에 `flex-1`(basis 0) 주지 말 것 — 높이가 짓눌린다.
- 폰트는 fonts.js에 등록된 것만. 시스템 폰트 가정 금지.
