import { Document, Page } from '@react-pdf/renderer'
import { baseStyles } from '../config/styles'
import ReportHeader from './ReportHeader'
import ReportFooter from './ReportFooter'

export default function PageWrapper({
  reportTitle,
  period,
  generatedAt,
  author,
  children,
}) {
  return (
    <Document
      title={`${reportTitle} (${generatedAt})`}
      author={author}
      creator="나르샤"
      producer="나르샤"
    >
      <Page size="A4" style={baseStyles.page}>
        <ReportHeader
          reportTitle={reportTitle}
          period={period}
          generatedAt={generatedAt}
          author={author}
        />
        {children}
        <ReportFooter />
      </Page>
    </Document>
  )
}
